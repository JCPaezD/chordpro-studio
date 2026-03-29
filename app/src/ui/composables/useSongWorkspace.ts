import { computed, ref, watch, type ComputedRef, type Ref } from "vue";

import { isTauri } from "@tauri-apps/api/core";
import { dirname, join } from "@tauri-apps/api/path";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open, save } from "@tauri-apps/plugin-dialog";
import { GeminiRetryError, GeminiProvider } from "../../adapters/llm/GeminiProvider";
import { OpenAIProvider } from "../../adapters/llm/OpenAIProvider";
import type { ChordproRenderStyle } from "../../adapters/chordpro/adapter";
import { TauriChordproAdapter } from "../../adapters/chordpro/TauriChordproAdapter";
import type { AppConfigStore } from "./useAppConfig";
import { SongRepository } from "../../adapters/filesystem/SongRepository";
import type { Song, SongMetadata } from "../../domain/song";
import type { Songbook } from "../../domain/songbook";
import { ChordProValidationError } from "../../domain/validation/ChordProOutputValidator";
import { CleaningService } from "../../services/cleaning";
import { ConversionService } from "../../services/conversion";
import { ChordProParser } from "../../services/parser/ChordProParser";
import { SongPipelineService } from "../../services/pipeline/SongPipelineService";
import { SongbookService } from "../../services/songbook/SongbookService";
import { useFeedback } from "./useFeedback";

type WorkspaceDocument = {
  filePath: string;
  fileName: string;
  chordProText: string;
  song: Song | null;
  dirty: boolean;
};

type RunPipelineOptions = {
  model?: string;
  preferences?: Record<string, unknown>;
  clearBeforeRun?: boolean;
};

type UnsavedContentResolution = "save" | "discard" | "cancel";
type SaveFilenameMismatchResolution = "keep-current" | "save-as-new" | "cancel";
type ExistingDocumentSaveTarget = {
  writePath: string;
  finalPath: string;
  applyCaseOnlyRename: boolean;
};

export type SongWorkspace = {
  activePanel: Ref<"songbook" | "convert">;
  rawInput: Ref<string>;
  cleanedText: Ref<string>;
  chordProText: Ref<string>;
  songJson: Ref<string>;
  loading: Ref<boolean>;
  isGeneratingPreview: Ref<boolean>;
  isRefreshingPreview: Ref<boolean>;
  isManualPreviewRefresh: Ref<boolean>;
  isExportingSongbook: Ref<boolean>;
  error: Ref<string>;
  songbookError: Ref<string>;
  retryLog: Ref<string[]>;
  validationReason: Ref<string>;
  validationRawOutput: Ref<string>;
  previewPath: Ref<string>;
  previewSrc: Ref<string>;
  previewError: Ref<string>;
  songMetadata: ComputedRef<SongMetadata>;
  document: Ref<WorkspaceDocument>;
  songbook: Ref<Songbook | null>;
  selectedSongPath: ComputedRef<string>;
  hasUnsavedChanges: ComputedRef<boolean>;
  showUnsavedContentModal: Ref<boolean>;
  unsavedContentMetadataLine: ComputedRef<string>;
  isResolvingUnsavedContent: Ref<boolean>;
  showSaveFilenameMismatchModal: Ref<boolean>;
  saveFilenameMismatchCurrentName: Ref<string>;
  saveFilenameMismatchSuggestedName: Ref<string>;
  initialize(): Promise<void>;
  copyToClipboard(value: string): Promise<void>;
  pasteFromClipboard(): Promise<void>;
  refreshPreview(chordPro: string, options?: { manageLoadingState?: boolean; requestId?: number; refreshingState?: boolean; bypassCache?: boolean }): Promise<void>;
  clearGeneratedState(): void;
  clearAllState(): void;
  requestClearAllState(): Promise<void>;
  exportCurrent(defaultExtension?: "pdf" | "cho"): Promise<void>;
  exportSongbookPdf(): Promise<void>;
  openSongbookFolder(): Promise<void>;
  refreshSongbook(): Promise<void>;
  clearSongbook(): Promise<void>;
  openSongFile(filePath: string, options?: { bypassUnsavedChanges?: boolean; persistLastOpenedSong?: boolean }): Promise<void>;
  saveDocument(): Promise<boolean>;
  setChordProText(value: string): void;
  setActivePanel(panel: "songbook" | "convert"): void;
  confirmUnsavedContentSave(): Promise<void>;
  confirmUnsavedContentDiscard(): void;
  confirmUnsavedContentCancel(): void;
  confirmKeepCurrentFileName(): void;
  confirmSaveAsNewFile(): void;
  confirmSaveFilenameMismatchCancel(): void;
  abortConversion(): void;
  runPipeline(options?: RunPipelineOptions): Promise<void>;
  previewFromChordPro(): Promise<void>;
  dispose(): void;
};

type SongWorkspaceDependencies = {
  appConfig: AppConfigStore;
};

function createSongWorkspace({ appConfig }: SongWorkspaceDependencies): SongWorkspace {
  const activePanel = ref<"songbook" | "convert">("convert");
  const rawInput = ref("");
  const cleanedText = ref("");
  const songJson = ref("");
  const loading = ref(false);
  const isGeneratingPreview = ref(false);
  const isRefreshingPreview = ref(false);
  const isManualPreviewRefresh = ref(false);
  const isExportingSongbook = ref(false);
  const error = ref("");
  const songbookError = ref("");
  const retryLog = ref<string[]>([]);
  const validationReason = ref("");
  const validationRawOutput = ref("");
  const previewPath = ref("");
  const previewSrc = ref("");
  const previewError = ref("");
  const document = ref<WorkspaceDocument>({
    filePath: "",
    fileName: "",
    chordProText: "",
    song: null,
    dirty: false
  });
  const songbook = ref<Songbook | null>(null);
  const songMetadata = computed<SongMetadata>(() => document.value.song?.metadata ?? extractChordProMetadata(document.value.chordProText));
  const selectedSongPath = computed(() => document.value.filePath);
  const hasUnsavedChanges = computed(() => {
    if (document.value.filePath) {
      return document.value.dirty;
    }

    return document.value.chordProText.trim().length > 0;
  });
  const showUnsavedContentModal = ref(false);
  const isResolvingUnsavedContent = ref(false);
  const showSaveFilenameMismatchModal = ref(false);
  const saveFilenameMismatchCurrentName = ref("");
  const saveFilenameMismatchSuggestedName = ref("");
  const unsavedContentMetadataLine = computed(() => {
    const title = songMetadata.value.title?.trim();
    const artist = songMetadata.value.artist?.trim();

    if (title && artist) {
      return `${title} - ${artist}`;
    }

    return title || artist || "";
  });

  const chordproAdapter = new TauriChordproAdapter();
  const parser = new ChordProParser();
  const songRepository = new SongRepository();
  const songbookService = new SongbookService(songRepository, parser);
  const feedback = useFeedback();
  let unlistenWindowCloseRequested: null | (() => void) = null;
  let initializePromise: Promise<void> | null = null;
  let hasLoadedInitialConfig = false;
  let previewRefreshDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let previewRequestId = 0;
  let currentPipelineRequestId = 0;
  let currentAbortController: AbortController | null = null;
  let pendingUnsavedContentResolution: Promise<UnsavedContentResolution> | null = null;
  let resolveUnsavedContentResolution: ((choice: UnsavedContentResolution) => void) | null = null;
  let pendingSaveFilenameMismatchResolution: Promise<SaveFilenameMismatchResolution> | null = null;
  let resolveSaveFilenameMismatchResolution: ((choice: SaveFilenameMismatchResolution) => void) | null = null;

  const chordProText = computed({
    get: () => document.value.chordProText,
    set: (value: string) => {
      document.value = {
        ...document.value,
        chordProText: value,
        dirty: true
      };
    }
  });

  function revokePreviewUrl(url = previewSrc.value): void {
    if (url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  }

  function createPdfBlobUrl(pdfBase64: string): string {
    const bytes = Uint8Array.from(atob(pdfBase64), (character) => character.charCodeAt(0));
    return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  }

  function getRenderStyle(): ChordproRenderStyle {
    return {
      showChordDiagrams: appConfig.showChordDiagrams.value,
      instrument: appConfig.instrument.value
    };
  }

  function refreshPreviewForRenderPreferenceChange(): void {
    if (!previewSrc.value || !document.value.chordProText.trim()) {
      return;
    }

    cancelPendingPreviewRefresh();
    const requestId = previewRequestId + 1;
    previewRequestId = requestId;
    void refreshPreview(document.value.chordProText, {
      manageLoadingState: false,
      requestId,
      refreshingState: true
    });
  }

  function clearOperationMessages(): void {
    previewError.value = "";
  }

  function cancelActiveGeneration(): void {
    if (!loading.value && !isGeneratingPreview.value && !currentAbortController) {
      return;
    }

    abortConversion();
  }

  function setActivePanel(panel: "songbook" | "convert"): void {
    if (activePanel.value !== panel) {
      cancelActiveGeneration();
    }

    activePanel.value = panel;
  }

  function getFilenameFromPath(path: string): string {
    const normalized = path.replace(/\\/g, "/");
    const parts = normalized.split("/");
    return parts[parts.length - 1] || path;
  }

  async function copyToClipboard(value: string): Promise<void> {
    if (!value) {
      return;
    }

    await navigator.clipboard.writeText(value);
  }

  async function pasteFromClipboard(): Promise<void> {
    rawInput.value = await navigator.clipboard.readText();
  }

  function replaceDocument(nextDocument: WorkspaceDocument): void {
    cancelPendingPreviewRefresh();
    document.value = nextDocument;
    songJson.value = nextDocument.song ? JSON.stringify(nextDocument.song, null, 2) : "";
  }

  function createDocumentFromChordPro(
    chordPro: string,
    options?: {
      filePath?: string;
      dirty?: boolean;
      song?: Song | null;
    }
  ): WorkspaceDocument {
    const filePath = options?.filePath ?? "";

    return {
      filePath,
      fileName: filePath ? getFilenameFromPath(filePath) : "",
      chordProText: chordPro,
      song: options?.song ?? null,
      dirty: options?.dirty ?? false
    };
  }

  function cancelPendingPreviewRefresh(): void {
    previewRequestId += 1;

    if (previewRefreshDebounceTimer !== null) {
      clearTimeout(previewRefreshDebounceTimer);
      previewRefreshDebounceTimer = null;
    }

    isRefreshingPreview.value = false;
    isManualPreviewRefresh.value = false;
  }

  function syncDocumentSongFromChordPro(chordPro: string): void {
    try {
      const parsedSong = parser.parse(chordPro);
      document.value = {
        ...document.value,
        chordProText: chordPro,
        song: parsedSong
      };
      songJson.value = JSON.stringify(parsedSong, null, 2);
    } catch {
      document.value = {
        ...document.value,
        chordProText: chordPro
      };
    }
  }

  async function refreshPreview(
    chordPro: string,
    options?: {
      manageLoadingState?: boolean;
      requestId?: number;
      refreshingState?: boolean;
      bypassCache?: boolean;
    }
  ): Promise<void> {
    const manageLoadingState = options?.manageLoadingState ?? true;
    const requestId = options?.requestId;
    const refreshingState = options?.refreshingState ?? false;
    const bypassCache = options?.bypassCache ?? false;
    const requestStillActive = () => requestId === undefined || requestId === previewRequestId;
    previewError.value = "";

    if (manageLoadingState) {
      isGeneratingPreview.value = true;
    }

    if (refreshingState) {
      isRefreshingPreview.value = true;
    }

    try {
      const preview = await chordproAdapter.generatePreview(chordPro, {
        bypassCache,
        renderStyle: getRenderStyle()
      });

      if (!requestStillActive()) {
        return;
      }

      const nextPreviewUrl = createPdfBlobUrl(preview.pdfBase64);

      if (!requestStillActive()) {
        URL.revokeObjectURL(nextPreviewUrl);
        return;
      }

      previewPath.value = preview.pdfPath;
      previewSrc.value = nextPreviewUrl;
    } catch (err) {
      if (!requestStillActive()) {
        return;
      }

      const detail = err instanceof Error ? err.message.trim() : "";
      previewError.value = detail
        ? `Preview generation failed: ${detail}`
        : "Preview generation failed.";
    } finally {
      if (manageLoadingState) {
        isGeneratingPreview.value = false;
      }

      if (refreshingState && requestStillActive()) {
        isRefreshingPreview.value = false;
      }

      if (manageLoadingState && requestStillActive()) {
        isManualPreviewRefresh.value = false;
      }
    }
  }

  function schedulePreviewRefreshFromEditor(chordPro: string): void {
    if (!isTauri()) {
      return;
    }

    if (previewRefreshDebounceTimer !== null) {
      clearTimeout(previewRefreshDebounceTimer);
      previewRefreshDebounceTimer = null;
    }

    if (!chordPro.trim()) {
      isRefreshingPreview.value = false;
      isManualPreviewRefresh.value = false;
      return;
    }

    const requestId = previewRequestId + 1;
    previewRequestId = requestId;

    previewRefreshDebounceTimer = setTimeout(() => {
      previewRefreshDebounceTimer = null;
      void refreshPreview(chordPro, {
        manageLoadingState: false,
        requestId,
        refreshingState: true
      });
    }, 750);
  }
  function clearGeneratedState(): void {
    cleanedText.value = "";
    songJson.value = "";
    error.value = "";
    songbookError.value = "";
    retryLog.value = [];
    validationReason.value = "";
    validationRawOutput.value = "";
    replaceDocument(createDocumentFromChordPro(""));
    previewPath.value = "";
    revokePreviewUrl();
    previewSrc.value = "";
    clearOperationMessages();
  }

  function clearAllState(): void {
    rawInput.value = "";
    clearGeneratedState();
  }

  function hasContentThatNeedsClearConfirmation(): boolean {
    if (rawInput.value.trim().length > 0) {
      return true;
    }

    if (cleanedText.value.trim().length > 0 || songJson.value.trim().length > 0) {
      return true;
    }

    if (document.value.filePath) {
      return document.value.dirty;
    }

    return document.value.chordProText.trim().length > 0;
  }

  function sanitizeFilenamePart(value: string): string {
    return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  }

  function extractChordProMetadata(chordPro: string): SongMetadata {
    const titleMatch = chordPro.match(/^\{title:\s*(.+?)\s*\}$/im);
    const artistMatch = chordPro.match(/^\{artist:\s*(.+?)\s*\}$/im);

    return {
      title: titleMatch?.[1]?.trim(),
      artist: artistMatch?.[1]?.trim()
    };
  }

  function buildSuggestedExportName(extension: "pdf" | "cho", metadata: SongMetadata = songMetadata.value): string {
    const title = metadata.title ? sanitizeFilenamePart(metadata.title) : "";
    const artist = metadata.artist ? sanitizeFilenamePart(metadata.artist) : "";

    if (artist && title) {
      return `${artist} - ${title}.${extension}`;
    }

    if (artist) {
      return `${artist}.${extension}`;
    }

    if (title) {
      return `${title}.${extension}`;
    }

    return `song.${extension}`;
  }

  async function buildSuggestedExportPath(extension: "pdf" | "cho"): Promise<string> {
    const fileName = buildSuggestedExportName(extension);
    const basePath = songbook.value?.path
      ? songbook.value.path
      : document.value.filePath
        ? await dirname(document.value.filePath)
        : "";

    return basePath ? join(basePath, fileName) : fileName;
  }

  function normalizeComparablePath(path: string): string {
    return path.replace(/\\/g, "/");
  }

  function normalizeCaseInsensitivePath(path: string): string {
    return normalizeComparablePath(path).toLowerCase();
  }

  async function buildSuggestedDocumentPath(filePath: string, metadata: SongMetadata): Promise<string> {
    const title = metadata.title ? sanitizeFilenamePart(metadata.title) : "";
    const artist = metadata.artist ? sanitizeFilenamePart(metadata.artist) : "";

    if (!title && !artist) {
      return filePath;
    }

    const folderPath = await dirname(filePath);
    return join(folderPath, buildSuggestedExportName("cho", metadata));
  }

  async function normalizeChoSavePath(selectedPath: string): Promise<string> {
    return selectedPath.toLowerCase().endsWith(".cho") ? selectedPath : selectedPath + ".cho";
  }

  async function buildTemporaryRenamePath(filePath: string): Promise<string> {
    const folderPath = await dirname(filePath);
    const fileName = getFilenameFromPath(filePath);

    for (let attempt = 1; attempt <= 100; attempt += 1) {
      const temporaryPath = await join(folderPath, `__rename__-${attempt}-${fileName}`);

      if (!(await songRepository.songExists(temporaryPath))) {
        return temporaryPath;
      }
    }

    throw new Error("Could not allocate a temporary path for renaming.");
  }

  async function applyCaseOnlyRename(currentPath: string, targetPath: string): Promise<string> {
    if (normalizeComparablePath(currentPath) === normalizeComparablePath(targetPath)) {
      return currentPath;
    }

    if (normalizeCaseInsensitivePath(currentPath) !== normalizeCaseInsensitivePath(targetPath)) {
      return currentPath;
    }

    const temporaryPath = await buildTemporaryRenamePath(currentPath);
    await songRepository.renameSong(currentPath, temporaryPath);

    try {
      await songRepository.renameSong(temporaryPath, targetPath);
    } catch (err) {
      await songRepository.renameSong(temporaryPath, currentPath);
      throw err;
    }

    return targetPath;
  }

  function requestSaveFilenameMismatchResolution(currentPath: string, suggestedPath: string): Promise<SaveFilenameMismatchResolution> {
    if (pendingSaveFilenameMismatchResolution) {
      return pendingSaveFilenameMismatchResolution;
    }

    saveFilenameMismatchCurrentName.value = getFilenameFromPath(currentPath);
    saveFilenameMismatchSuggestedName.value = getFilenameFromPath(suggestedPath);
    showSaveFilenameMismatchModal.value = true;

    pendingSaveFilenameMismatchResolution = new Promise<SaveFilenameMismatchResolution>((resolve) => {
      resolveSaveFilenameMismatchResolution = (choice) => {
        showSaveFilenameMismatchModal.value = false;
        saveFilenameMismatchCurrentName.value = "";
        saveFilenameMismatchSuggestedName.value = "";
        pendingSaveFilenameMismatchResolution = null;
        resolveSaveFilenameMismatchResolution = null;
        resolve(choice);
      };
    });

    return pendingSaveFilenameMismatchResolution;
  }

  async function promptSaveAsNewDocument(defaultPath: string): Promise<string | null> {
    const selectedPath = await save({
      title: "Save as new ChordPro file",
      defaultPath,
      filters: [
        {
          name: "ChordPro file",
          extensions: ["cho"]
        }
      ]
    });

    if (!selectedPath) {
      return null;
    }

    return normalizeChoSavePath(selectedPath);
  }

  async function resolveSaveTargetPathForExistingDocument(filePath: string, metadata: SongMetadata): Promise<ExistingDocumentSaveTarget | null> {
    const suggestedPath = await buildSuggestedDocumentPath(filePath, metadata);

    if (getFilenameFromPath(filePath) === getFilenameFromPath(suggestedPath)) {
      return {
        writePath: filePath,
        finalPath: filePath,
        applyCaseOnlyRename: false
      };
    }

    const resolution = await requestSaveFilenameMismatchResolution(filePath, suggestedPath);

    if (resolution === "cancel") {
      return null;
    }

    if (resolution === "keep-current") {
      return {
        writePath: filePath,
        finalPath: filePath,
        applyCaseOnlyRename: false
      };
    }

    const saveAsPath = await promptSaveAsNewDocument(suggestedPath);

    if (!saveAsPath) {
      return null;
    }

    if (normalizeCaseInsensitivePath(saveAsPath) === normalizeCaseInsensitivePath(filePath)) {
      const finalPath = normalizeCaseInsensitivePath(suggestedPath) === normalizeCaseInsensitivePath(filePath)
        ? suggestedPath
        : saveAsPath;

      return {
        writePath: filePath,
        finalPath,
        applyCaseOnlyRename: normalizeComparablePath(finalPath) !== normalizeComparablePath(filePath)
      };
    }

    return {
      writePath: saveAsPath,
      finalPath: saveAsPath,
      applyCaseOnlyRename: false
    };
  }

  async function buildSuggestedSongbookExportPath(): Promise<string> {
    const folderName = songbook.value?.path ? sanitizeFilenamePart(getFilenameFromPath(songbook.value.path)) : "songbook";
    const fileName = `${folderName || "songbook"}.pdf`;

    return songbook.value?.path ? join(songbook.value.path, fileName) : fileName;
  }
  async function exportCurrent(defaultExtension: "pdf" | "cho" = "pdf"): Promise<void> {
    try {
      if (!document.value.chordProText) {
        feedback.showFeedback({
          type: "error",
          message: "Export failed."
        });
        return;
      }

      const filters = defaultExtension === "pdf"
        ? [
            {
              name: "PDF file",
              extensions: ["pdf"]
            },
            {
              name: "ChordPro file",
              extensions: ["cho"]
            }
          ]
        : [
            {
              name: "ChordPro file",
              extensions: ["cho"]
            },
            {
              name: "PDF file",
              extensions: ["pdf"]
            }
          ];

      const selectedPath = await save({
        title: defaultExtension === "pdf" ? "Export PDF" : "Export ChordPro output",
        defaultPath: await buildSuggestedExportPath(defaultExtension),
        filters
      });

      if (!selectedPath) {
        return;
      }

      const normalizedPath = selectedPath.toLowerCase().endsWith(".cho")
        ? selectedPath
        : selectedPath.toLowerCase().endsWith(".pdf")
          ? selectedPath
          : selectedPath + `.${defaultExtension}`;

      if (normalizedPath.toLowerCase().endsWith(".cho")) {
        let finalPath = normalizedPath;
        const currentFilePath = document.value.filePath;

        if (currentFilePath && normalizeCaseInsensitivePath(currentFilePath) === normalizeCaseInsensitivePath(normalizedPath)) {
          await songRepository.writeSong(currentFilePath, document.value.chordProText);
          finalPath = currentFilePath;
        } else {
          await songRepository.writeSong(normalizedPath, document.value.chordProText);
        }

        replaceDocument(
          createDocumentFromChordPro(document.value.chordProText, {
            filePath: finalPath,
            song: document.value.song,
            dirty: false
          })
        );
        if (songbook.value) {
          await refreshSongbook();
        }
        feedback.showFeedback({
          type: "success",
          message: "Saved to: " + getFilenameFromPath(finalPath)
        });
        return;
      }

      const exportedPath = await chordproAdapter.exportPdf(document.value.chordProText, normalizedPath, {
        renderStyle: getRenderStyle()
      });
      feedback.showFeedback({
        type: "success",
        message: "Saved to: " + getFilenameFromPath(exportedPath)
      });
    } catch {
      feedback.showFeedback({
        type: "error",
        message: "Export failed."
      });
    }
  }
  async function exportSongbookPdf(): Promise<void> {
    if (document.value.filePath && document.value.dirty) {
      feedback.showFeedback({
        type: "info",
        message: "You have unsaved changes. The export will use the last saved versions."
      });
    }

    if (!songbook.value?.path) {
      feedback.showFeedback({
        type: "error",
        message: "No songbook folder selected."
      });
      return;
    }

    isExportingSongbook.value = true;

    try {
      const songFiles = await songbookService.listSongFiles(songbook.value.path);

      if (songFiles.length === 0) {
        feedback.showFeedback({
          type: "error",
          message: "No songs found."
        });
        return;
      }

      const selectedPath = await save({
        title: "Export songbook PDF",
        defaultPath: await buildSuggestedSongbookExportPath(),
        filters: [
          {
            name: "PDF file",
            extensions: ["pdf"]
          }
        ]
      });

      if (!selectedPath) {
        return;
      }

      const normalizedPath = selectedPath.toLowerCase().endsWith(".pdf")
        ? selectedPath
        : selectedPath + ".pdf";

      await chordproAdapter.exportSongbookPdf(songFiles, normalizedPath, {
        renderStyle: getRenderStyle()
      });
      feedback.showFeedback({
        type: "success",
        message: "Songbook exported."
      });
    } catch (err) {
      feedback.showFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Songbook export failed."
      });
    } finally {
      isExportingSongbook.value = false;
    }
  }
  function readOpenAiApiKeyFromEnvironment(): string | undefined {
    const fromProcess = (
      globalThis as { process?: { env?: Record<string, string | undefined> } }
    ).process?.env?.OPENAI_API_KEY;

    if (typeof fromProcess === "string" && fromProcess.trim().length > 0) {
      return fromProcess.trim();
    }

    const fromVite = import.meta.env?.VITE_OPENAI_API_KEY;
    if (typeof fromVite === "string" && fromVite.trim().length > 0) {
      return fromVite.trim();
    }

    return undefined;
  }

  function isOpenAiModel(model: string): boolean {
    return model.startsWith("gpt-");
  }

  function createProvider(model = "gemini-2.5-flash") {
    if (isOpenAiModel(model)) {
      const openAiApiKey = readOpenAiApiKeyFromEnvironment();

      if (!openAiApiKey) {
        throw new Error("OPENAI_API_KEY is not set.");
      }

      return new OpenAIProvider(openAiApiKey, model);
    }

    const geminiApiKey = appConfig.apiKey.value;

    if (!geminiApiKey) {
      throw new Error("API key required to generate.");
    }

    return new GeminiProvider(geminiApiKey, model);
  }

  function createPipeline(model?: string): SongPipelineService {
    return new SongPipelineService(
      new CleaningService(),
      new ConversionService(createProvider(model)),
      new ChordProParser()
    );
  }

  function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === "AbortError";
  }

  function clearCurrentAbortController(controller?: AbortController | null): void {
    if (!controller || currentAbortController !== controller) {
      return;
    }

    currentAbortController = null;
  }

  function abortConversion(): void {
    currentPipelineRequestId += 1;
    loading.value = false;
    isGeneratingPreview.value = false;
    cancelPendingPreviewRefresh();

    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }
  }

  async function runPipeline(options?: RunPipelineOptions): Promise<void> {
    if (!(await ensureDocumentCanBeReplaced())) {
      return;
    }

    if (options?.clearBeforeRun) {
      clearGeneratedState();
    } else {
      error.value = "";
      retryLog.value = [];
      validationReason.value = "";
      validationRawOutput.value = "";
      clearOperationMessages();
    }

    const localRequestId = currentPipelineRequestId + 1;
    currentPipelineRequestId = localRequestId;
    const abortController = typeof AbortController !== "undefined" ? new AbortController() : null;
    currentAbortController = abortController;
    loading.value = true;
    isGeneratingPreview.value = true;

    try {
      const pipeline = createPipeline(options?.model);
      const result = await pipeline.process(rawInput.value, options?.preferences, {
        signal: abortController?.signal
      });

      if (localRequestId !== currentPipelineRequestId) {
        return;
      }

      cleanedText.value = result.cleanedText;
      replaceDocument(
        createDocumentFromChordPro(result.chordPro, {
          filePath: "",
          song: result.song,
          dirty: false
        })
      );
      retryLog.value = result.retryLog ?? [];

      const previewRequestIdForRun = previewRequestId + 1;
      previewRequestId = previewRequestIdForRun;
      clearCurrentAbortController(abortController);
      loading.value = false;
      await refreshPreview(result.chordPro, {
        manageLoadingState: false,
        requestId: previewRequestIdForRun
      });
    } catch (err) {
      if (localRequestId !== currentPipelineRequestId || isAbortError(err)) {
        return;
      }

      if (err instanceof ChordProValidationError) {
        validationReason.value = err.details?.reason ?? "";
        validationRawOutput.value = err.details?.rawOutput ?? "";
        replaceDocument(
          createDocumentFromChordPro(validationRawOutput.value, {
            song: null,
            dirty: false
          })
        );
      }

      if (err instanceof GeminiRetryError) {
        retryLog.value = err.retryLog;
      }

      error.value = err instanceof Error ? err.message : "Pipeline execution failed.";
    } finally {
      clearCurrentAbortController(abortController);

      if (localRequestId === currentPipelineRequestId) {
        loading.value = false;
        isGeneratingPreview.value = false;
      }
    }
  }

  async function previewFromChordPro(): Promise<void> {
    cancelPendingPreviewRefresh();
    clearOperationMessages();

    if (isGeneratingPreview.value || isRefreshingPreview.value) {
      return;
    }

    if (!document.value.chordProText.trim()) {
      isManualPreviewRefresh.value = false;
      previewError.value = "Preview generation failed.";
      return;
    }

    syncDocumentSongFromChordPro(document.value.chordProText);
    isManualPreviewRefresh.value = true;
    await refreshPreview(document.value.chordProText, { bypassCache: true });
  }

  function setChordProText(value: string): void {
    chordProText.value = value;
    syncDocumentSongFromChordPro(value);
    schedulePreviewRefreshFromEditor(value);
  }

  async function refreshSongbook(): Promise<void> {
    if (!songbook.value?.path) {
      return;
    }

    songbookError.value = "";

    try {
      songbook.value = await songbookService.loadSongbook(songbook.value.path);
    } catch (err) {
      songbookError.value = err instanceof Error ? err.message : "Could not refresh the songbook.";
      return;
    }

    try {
      await appConfig.setLastSongbookPath(songbook.value.path);
    } catch (err) {
      console.error("Could not persist lastSongbookPath.", err);
    }
  }

  async function clearSongbook(): Promise<void> {
    cancelActiveGeneration();
    songbook.value = null;
    songbookError.value = "";
    try {
      await appConfig.clearLastSongbookPath();
      await appConfig.clearLastOpenedSongPath();
    } catch (err) {
      console.error("Could not clear persisted songbook state.", err);
    }
  }

  function requestUnsavedContentResolution(): Promise<UnsavedContentResolution> {
    if (pendingUnsavedContentResolution) {
      return pendingUnsavedContentResolution;
    }

    isResolvingUnsavedContent.value = false;
    showUnsavedContentModal.value = true;
    pendingUnsavedContentResolution = new Promise<UnsavedContentResolution>((resolve) => {
      resolveUnsavedContentResolution = (choice) => {
        showUnsavedContentModal.value = false;
        isResolvingUnsavedContent.value = false;
        pendingUnsavedContentResolution = null;
        resolveUnsavedContentResolution = null;
        resolve(choice);
      };
    });

    return pendingUnsavedContentResolution;
  }

  async function resolveUnsavedChanges(options?: { includeRawInput?: boolean }): Promise<UnsavedContentResolution> {
    const shouldProtect = options?.includeRawInput ? hasContentThatNeedsClearConfirmation() : hasUnsavedChanges.value;

    if (!shouldProtect) {
      return "discard";
    }

    return requestUnsavedContentResolution();
  }

  async function ensureDocumentCanBeReplaced(): Promise<boolean> {
    const resolution = await resolveUnsavedChanges();
    return resolution !== "cancel";
  }

  async function requestClearAllState(): Promise<void> {
    const resolution = await resolveUnsavedChanges({ includeRawInput: true });

    if (resolution === "cancel") {
      return;
    }

    clearAllState();
  }

  async function confirmUnsavedContentSave(): Promise<void> {
    if (isResolvingUnsavedContent.value) {
      return;
    }

    if (!document.value.chordProText.trim()) {
      feedback.showFeedback({
        type: "error",
        message: "There is no ChordPro content to save yet."
      });
      return;
    }

    isResolvingUnsavedContent.value = true;
    const saved = await saveDocument();

    if (!saved) {
      isResolvingUnsavedContent.value = false;
      return;
    }

    resolveUnsavedContentResolution?.("save");
  }

  function confirmUnsavedContentDiscard(): void {
    if (isResolvingUnsavedContent.value) {
      return;
    }

    resolveUnsavedContentResolution?.("discard");
  }

  function confirmUnsavedContentCancel(): void {
    if (isResolvingUnsavedContent.value) {
      return;
    }

    resolveUnsavedContentResolution?.("cancel");
  }

  function confirmKeepCurrentFileName(): void {
    resolveSaveFilenameMismatchResolution?.("keep-current");
  }

  function confirmSaveAsNewFile(): void {
    resolveSaveFilenameMismatchResolution?.("save-as-new");
  }

  function confirmSaveFilenameMismatchCancel(): void {
    resolveSaveFilenameMismatchResolution?.("cancel");
  }

  async function saveDocument(): Promise<boolean> {
    if (!document.value.chordProText) {
      return false;
    }

    error.value = "";
    songbookError.value = "";

    try {
      let parsedSong = document.value.song;
      let currentMetadata = extractChordProMetadata(document.value.chordProText);
      try {
        parsedSong = parser.parse(document.value.chordProText);
        currentMetadata = parsedSong.metadata;
      } catch {
        // Keep the previous valid song snapshot if the current draft cannot be parsed.
      }

      let targetPath = document.value.filePath;

      if (!targetPath) {
        const selectedPath = await save({
          title: "Save ChordPro file",
          defaultPath: await buildSuggestedExportPath("cho"),
          filters: [
            {
              name: "ChordPro file",
              extensions: ["cho"]
            }
          ]
        });

        if (!selectedPath) {
          return false;
        }

        targetPath = await normalizeChoSavePath(selectedPath);
        await songbookService.saveSong(targetPath, document.value.chordProText);
      } else {
        const saveTarget = await resolveSaveTargetPathForExistingDocument(targetPath, currentMetadata);
        if (!saveTarget) {
          return false;
        }

        await songbookService.saveSong(saveTarget.writePath, document.value.chordProText);
        targetPath = saveTarget.applyCaseOnlyRename
          ? await applyCaseOnlyRename(saveTarget.writePath, saveTarget.finalPath)
          : saveTarget.finalPath;
      }

      replaceDocument(
        createDocumentFromChordPro(document.value.chordProText, {
          filePath: targetPath,
          song: parsedSong,
          dirty: false
        })
      );

      if (songbook.value) {
        await refreshSongbook();
      }

      feedback.showFeedback({
        type: "success",
        message: "Saved to: " + getFilenameFromPath(targetPath)
      });

      return true;
    } catch (err) {
      feedback.showFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Could not save file."
      });
      return false;
    }
  }
  async function openSongFile(filePath: string, options?: { bypassUnsavedChanges?: boolean; persistLastOpenedSong?: boolean }): Promise<void> {
    if (!options?.bypassUnsavedChanges && !(await ensureDocumentCanBeReplaced())) {
      return;
    }

    cancelActiveGeneration();
    clearOperationMessages();
    error.value = "";
    songbookError.value = "";

    try {
      const loadedSong = await songbookService.openSong(filePath);
      replaceDocument(
        createDocumentFromChordPro(loadedSong.chordProText, {
          filePath: loadedSong.filePath,
          song: loadedSong.song,
          dirty: false
        })
      );
      rawInput.value = "";
      cleanedText.value = "";
      retryLog.value = [];
      validationReason.value = "";
      validationRawOutput.value = "";
      await refreshPreview(loadedSong.chordProText);

      if (options?.persistLastOpenedSong !== false) {
        try {
          await appConfig.setLastOpenedSongPath(loadedSong.filePath);
        } catch (err) {
          console.error("Could not persist lastOpenedSongPath.", err);
        }
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Could not open the selected song.";
    }
  }

  async function openSongbookFolder(): Promise<void> {
    cancelActiveGeneration();
    const selectedFolder = await open({
      title: "Open songbook folder",
      directory: true,
      multiple: false,
      recursive: true
    });

    if (!selectedFolder || Array.isArray(selectedFolder)) {
      return;
    }

    songbook.value = {
      path: selectedFolder,
      songs: []
    };
    activePanel.value = "songbook";

    try {
      await appConfig.clearLastOpenedSongPath();
    } catch (err) {
      console.error("Could not clear lastOpenedSongPath for the new songbook.", err);
    }

    await refreshSongbook();
  }

  async function initialize(): Promise<void> {
    if (initializePromise) {
      return initializePromise;
    }

    initializePromise = (async () => {
      if (isTauri() && !unlistenWindowCloseRequested) {
        const currentWindow = getCurrentWindow();
        unlistenWindowCloseRequested = await currentWindow.onCloseRequested(async (event) => {
          try {
            if (!hasUnsavedChanges.value) {
              return;
            }

            event.preventDefault();

            const resolution = await resolveUnsavedChanges();

            if (resolution === "cancel") {
              return;
            }

            await currentWindow.destroy();
          } catch (err) {
            console.error("Window close interception failed.", err);

            try {
              await currentWindow.destroy();
            } catch (closeErr) {
              console.error("Forced window close failed.", closeErr);
            }
          }
        });
      }

      if (hasLoadedInitialConfig) {
        return;
      }

      hasLoadedInitialConfig = true;

      if (songbook.value) {
        activePanel.value = "songbook";
        return;
      }

      const lastSongbookPath = appConfig.lastSongbookPath.value;
      if (!lastSongbookPath) {
        activePanel.value = "convert";
        return;
      }

      try {
        const restoredSongbook = await songbookService.loadSongbook(lastSongbookPath);
        songbook.value = restoredSongbook;
        activePanel.value = "songbook";

        const lastOpenedSongPath = appConfig.lastOpenedSongPath.value;
        if (!lastOpenedSongPath) {
          return;
        }

        const normalizedLastOpenedSongPath = normalizeCaseInsensitivePath(lastOpenedSongPath);
        const isSongInRestoredSongbook = restoredSongbook.songs.some((songEntry) =>
          normalizeCaseInsensitivePath(songEntry.filePath) === normalizedLastOpenedSongPath
        );

        if (!isSongInRestoredSongbook || !(await songRepository.songExists(lastOpenedSongPath))) {
          return;
        }

        await openSongFile(lastOpenedSongPath, {
          bypassUnsavedChanges: true,
          persistLastOpenedSong: false
        });
      } catch {
        songbook.value = null;
        activePanel.value = "convert";
      }
    })();

    try {
      await initializePromise;
    } finally {
      initializePromise = null;
    }
  }
  watch(
    () => ({
      showChordDiagrams: appConfig.showChordDiagrams.value,
      instrument: appConfig.instrument.value
    }),
    (nextValue, previousValue) => {
      if (
        nextValue.showChordDiagrams === previousValue?.showChordDiagrams &&
        nextValue.instrument === previousValue?.instrument
      ) {
        return;
      }

      refreshPreviewForRenderPreferenceChange();
    }
  );

  function dispose(): void {
    abortConversion();

    if (unlistenWindowCloseRequested) {
      unlistenWindowCloseRequested();
      unlistenWindowCloseRequested = null;
    }

    revokePreviewUrl();
  }

  return {
    activePanel,
    rawInput,
    cleanedText,
    chordProText,
    songJson,
    loading,
    isGeneratingPreview,
    isRefreshingPreview,
    isManualPreviewRefresh,
    isExportingSongbook,
    error,
    songbookError,
    retryLog,
    validationReason,
    validationRawOutput,
    previewPath,
    previewSrc,
    previewError,
    songMetadata,
    document,
    songbook,
    selectedSongPath,
    hasUnsavedChanges,
    showUnsavedContentModal,
    unsavedContentMetadataLine,
    isResolvingUnsavedContent,
    showSaveFilenameMismatchModal,
    saveFilenameMismatchCurrentName,
    saveFilenameMismatchSuggestedName,
    initialize,
    copyToClipboard,
    pasteFromClipboard,
    refreshPreview,
    clearGeneratedState,
    clearAllState,
    requestClearAllState,
    exportCurrent,
    exportSongbookPdf,
    openSongbookFolder,
    refreshSongbook,
    clearSongbook,
    openSongFile,
    saveDocument,
    setChordProText,
    setActivePanel,
    confirmUnsavedContentSave,
    confirmUnsavedContentDiscard,
    confirmUnsavedContentCancel,
    confirmKeepCurrentFileName,
    confirmSaveAsNewFile,
    confirmSaveFilenameMismatchCancel,
    abortConversion,
    runPipeline,
    previewFromChordPro,
    dispose
  };
}

let songWorkspace: SongWorkspace | null = null;

export function useSongWorkspace(dependencies?: SongWorkspaceDependencies): SongWorkspace {
  if (!songWorkspace) {
    if (!dependencies) {
      throw new Error("Song workspace dependencies are not configured.");
    }

    songWorkspace = createSongWorkspace(dependencies);
  }

  return songWorkspace;
}
