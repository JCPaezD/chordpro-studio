import { computed, ref, type ComputedRef, type Ref } from "vue";

import { isTauri } from "@tauri-apps/api/core";
import { dirname, join } from "@tauri-apps/api/path";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { message, open, save } from "@tauri-apps/plugin-dialog";
import { GeminiRetryError, GeminiProvider } from "../../adapters/llm/GeminiProvider";
import { OpenAIProvider } from "../../adapters/llm/OpenAIProvider";
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

export type SongWorkspace = {
  activePanel: Ref<"songbook" | "convert">;
  rawInput: Ref<string>;
  cleanedText: Ref<string>;
  chordProText: Ref<string>;
  songJson: Ref<string>;
  loading: Ref<boolean>;
  isGeneratingPreview: Ref<boolean>;
  isRefreshingPreview: Ref<boolean>;
  isExportingSongbook: Ref<boolean>;
  error: Ref<string>;
  songbookError: Ref<string>;
  retryLog: Ref<string[]>;
  validationReason: Ref<string>;
  validationRawOutput: Ref<string>;
  previewPath: Ref<string>;
  previewSrc: Ref<string>;
  previewError: Ref<string>;
  exportError: Ref<string>;
  exportMessage: Ref<string>;
  songbookExportWarning: Ref<string>;
  songbookExportError: Ref<string>;
  songbookExportMessage: Ref<string>;
  songMetadata: ComputedRef<SongMetadata>;
  document: Ref<WorkspaceDocument>;
  songbook: Ref<Songbook | null>;
  selectedSongPath: ComputedRef<string>;
  hasUnsavedChanges: ComputedRef<boolean>;
  initialize(): Promise<void>;
  copyToClipboard(value: string): Promise<void>;
  pasteFromClipboard(): Promise<void>;
  refreshPreview(chordPro: string, options?: { manageLoadingState?: boolean; requestId?: number; refreshingState?: boolean }): Promise<void>;
  clearGeneratedState(): void;
  clearAllState(): void;
  exportCurrent(): Promise<void>;
  exportSongbookPdf(): Promise<void>;
  openSongbookFolder(): Promise<void>;
  refreshSongbook(): Promise<void>;
  clearSongbook(): Promise<void>;
  openSongFile(filePath: string, options?: { bypassUnsavedChanges?: boolean }): Promise<void>;
  saveDocument(): Promise<boolean>;
  setChordProText(value: string): void;
  setActivePanel(panel: "songbook" | "convert"): void;
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
  const isExportingSongbook = ref(false);
  const error = ref("");
  const songbookError = ref("");
  const retryLog = ref<string[]>([]);
  const validationReason = ref("");
  const validationRawOutput = ref("");
  const previewPath = ref("");
  const previewSrc = ref("");
  const previewError = ref("");
  const exportError = ref("");
  const exportMessage = ref("");
  const songbookExportWarning = ref("");
  const songbookExportError = ref("");
  const songbookExportMessage = ref("");
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

  const chordproAdapter = new TauriChordproAdapter();
  const parser = new ChordProParser();
  const songRepository = new SongRepository();
  const songbookService = new SongbookService(songRepository, parser);
  let unlistenWindowCloseRequested: null | (() => void) = null;
  let initializePromise: Promise<void> | null = null;
  let hasLoadedInitialConfig = false;
  let previewRefreshDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let previewRequestId = 0;
  let currentPipelineRequestId = 0;
  let currentAbortController: AbortController | null = null;

  const chordProText = computed({
    get: () => document.value.chordProText,
    set: (value: string) => {
      document.value = {
        ...document.value,
        chordProText: value,
        dirty: true
      };
      exportMessage.value = "";
      exportError.value = "";
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

  function clearOperationMessages(): void {
    previewError.value = "";
    exportError.value = "";
    exportMessage.value = "";
  }

  function clearSongbookExportFeedback(): void {
    songbookExportError.value = "";
    songbookExportMessage.value = "";
  }

  function setActivePanel(panel: "songbook" | "convert"): void {
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
    }
  ): Promise<void> {
    const manageLoadingState = options?.manageLoadingState ?? true;
    const requestId = options?.requestId;
    const refreshingState = options?.refreshingState ?? false;
    previewError.value = "";

    if (manageLoadingState) {
      isGeneratingPreview.value = true;
    }

    if (refreshingState) {
      isRefreshingPreview.value = true;
    }

    try {
      const preview = await chordproAdapter.generatePreview(chordPro);

      if (requestId !== undefined && requestId !== previewRequestId) {
        return;
      }

      const nextPreviewUrl = createPdfBlobUrl(preview.pdfBase64);

      if (requestId !== undefined && requestId !== previewRequestId) {
        URL.revokeObjectURL(nextPreviewUrl);
        return;
      }

      previewPath.value = preview.pdfPath;
      previewSrc.value = nextPreviewUrl;
    } catch (err) {
      if (requestId !== undefined && requestId !== previewRequestId) {
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

      if (refreshingState && requestId === previewRequestId) {
        isRefreshingPreview.value = false;
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
    const folderPath = await dirname(filePath);
    return join(folderPath, buildSuggestedExportName("cho", metadata));
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

  async function renameSongPathSafely(currentPath: string, targetPath: string): Promise<string> {
    if (normalizeComparablePath(currentPath) === normalizeComparablePath(targetPath)) {
      return currentPath;
    }

    if (normalizeCaseInsensitivePath(currentPath) === normalizeCaseInsensitivePath(targetPath)) {
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

    if (await songRepository.songExists(targetPath)) {
      return currentPath;
    }

    await songRepository.renameSong(currentPath, targetPath);
    return targetPath;
  }

  async function resolveSavedDocumentPath(filePath: string, metadata: SongMetadata): Promise<string> {
    const suggestedPath = await buildSuggestedDocumentPath(filePath, metadata);
    return renameSongPathSafely(filePath, suggestedPath);
  }

  async function buildSuggestedSongbookExportPath(): Promise<string> {
    const folderName = songbook.value?.path ? sanitizeFilenamePart(getFilenameFromPath(songbook.value.path)) : "songbook";
    const fileName = `${folderName || "songbook"}.pdf`;

    return songbook.value?.path ? join(songbook.value.path, fileName) : fileName;
  }
  async function exportCurrent(): Promise<void> {
    exportError.value = "";
    exportMessage.value = "";

    try {
      if (!document.value.chordProText) {
        exportError.value = "Export failed.";
        return;
      }

      const selectedPath = await save({
        title: "Export ChordPro output",
        defaultPath: await buildSuggestedExportPath("pdf"),
        filters: [
          {
            name: "PDF file",
            extensions: ["pdf"]
          },
          {
            name: "ChordPro file",
            extensions: ["cho"]
          }
        ]
      });

      if (!selectedPath) {
        return;
      }

      const normalizedPath = selectedPath.toLowerCase().endsWith(".cho")
        ? selectedPath
        : selectedPath.toLowerCase().endsWith(".pdf")
          ? selectedPath
          : `${selectedPath}.pdf`;

      if (normalizedPath.toLowerCase().endsWith(".cho")) {
        let finalPath = normalizedPath;
        const currentFilePath = document.value.filePath;

        if (currentFilePath && normalizeCaseInsensitivePath(currentFilePath) === normalizeCaseInsensitivePath(normalizedPath)) {
          const currentSong = document.value.song;
          const currentMetadata = currentSong?.metadata ?? extractChordProMetadata(document.value.chordProText);
          await songRepository.writeSong(currentFilePath, document.value.chordProText);
          finalPath = await resolveSavedDocumentPath(currentFilePath, currentMetadata);
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
        exportMessage.value = `Saved to: ${getFilenameFromPath(finalPath)}`;
        return;
      }

      const exportedPath = await chordproAdapter.exportPdf(document.value.chordProText, normalizedPath);
      exportMessage.value = `Saved to: ${getFilenameFromPath(exportedPath)}`;
    } catch (err) {
      exportError.value = "Export failed.";
    }
  }

  async function exportSongbookPdf(): Promise<void> {
    songbookExportWarning.value = document.value.filePath && document.value.dirty
      ? "You have unsaved changes. The export will use the last saved versions."
      : "";
    clearSongbookExportFeedback();

    if (!songbook.value?.path) {
      songbookExportError.value = "No songbook folder selected.";
      return;
    }

    isExportingSongbook.value = true;

    try {
      const songFiles = await songbookService.listSongFiles(songbook.value.path);

      if (songFiles.length === 0) {
        songbookExportError.value = "No songs found.";
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
        : `${selectedPath}.pdf`;

      await chordproAdapter.exportSongbookPdf(songFiles, normalizedPath);
      songbookExportMessage.value = "Songbook exported.";
    } catch (err) {
      songbookExportError.value = err instanceof Error ? err.message : "Songbook export failed.";
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
      const activeFilePath = document.value.filePath;
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
          filePath: activeFilePath,
          song: result.song,
          dirty: activeFilePath.length > 0
        })
      );
      retryLog.value = result.retryLog ?? [];

      const previewRequestIdForRun = previewRequestId + 1;
      previewRequestId = previewRequestIdForRun;
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

    if (!document.value.chordProText) {
      previewError.value = "Preview generation failed.";
      return;
    }

    syncDocumentSongFromChordPro(document.value.chordProText);
    await refreshPreview(document.value.chordProText);
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
    songbook.value = null;
    songbookError.value = "";
    songbookExportWarning.value = "";
    clearSongbookExportFeedback();

    try {
      await appConfig.clearLastSongbookPath();
    } catch (err) {
      console.error("Could not clear lastSongbookPath.", err);
    }
  }

  async function resolveUnsavedChanges(): Promise<"save" | "discard" | "cancel"> {
    if (!hasUnsavedChanges.value) {
      return "discard";
    }

    const choice = await message("This song has unsaved changes.", {
      title: "Unsaved changes",
      kind: "warning",
      buttons: {
        yes: "Save",
        no: "Discard",
        cancel: "Cancel"
      }
    });

    if (choice === "Cancel") {
      return "cancel";
    }

    if (choice === "Save") {
      const saved = await saveDocument();
      return saved ? "save" : "cancel";
    }

    return "discard";
  }

  async function ensureDocumentCanBeReplaced(): Promise<boolean> {
    const resolution = await resolveUnsavedChanges();
    return resolution !== "cancel";
  }

  async function saveDocument(): Promise<boolean> {
    if (!document.value.chordProText) {
      return false;
    }

    error.value = "";
    songbookError.value = "";

    try {
      let parsedSong = document.value.song;
      try {
        parsedSong = parser.parse(document.value.chordProText);
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

        targetPath = selectedPath.toLowerCase().endsWith(".cho") ? selectedPath : `${selectedPath}.cho`;
        await songbookService.saveSong(targetPath, document.value.chordProText);
      } else {
        await songbookService.saveSong(targetPath, document.value.chordProText);

        if (parsedSong) {
          targetPath = await resolveSavedDocumentPath(targetPath, parsedSong.metadata);
        }
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

      return true;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      error.value = detail;
      songbookError.value = detail;
      return false;
    }
  }

  async function openSongFile(filePath: string, options?: { bypassUnsavedChanges?: boolean }): Promise<void> {
    if (!options?.bypassUnsavedChanges && !(await ensureDocumentCanBeReplaced())) {
      return;
    }

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
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Could not open the selected song.";
    }
  }

  async function openSongbookFolder(): Promise<void> {
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

      if (!appConfig.lastSongbookPath.value || songbook.value) {
        return;
      }

      try {
        songbook.value = await songbookService.loadSongbook(appConfig.lastSongbookPath.value);
      } catch {
        songbook.value = null;
      }
    })();

    try {
      await initializePromise;
    } finally {
      initializePromise = null;
    }
  }
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
    isExportingSongbook,
    error,
    songbookError,
    retryLog,
    validationReason,
    validationRawOutput,
    previewPath,
    previewSrc,
    previewError,
    exportError,
    exportMessage,
    songbookExportWarning,
    songbookExportError,
    songbookExportMessage,
    songMetadata,
    document,
    songbook,
    selectedSongPath,
    hasUnsavedChanges,
    initialize,
    copyToClipboard,
    pasteFromClipboard,
    refreshPreview,
    clearGeneratedState,
    clearAllState,
    exportCurrent,
    exportSongbookPdf,
    openSongbookFolder,
    refreshSongbook,
    clearSongbook,
    openSongFile,
    saveDocument,
    setChordProText,
    setActivePanel,
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


