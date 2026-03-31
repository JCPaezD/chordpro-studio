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
import {
  SongPipelineService,
  type PipelineEntryPoint
} from "../../services/pipeline/SongPipelineService";
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
  entryPoint?: PipelineEntryPoint;
  input?: string;
};

type PreviewPlaceholderInfo = {
  title: string;
  artist: string;
  album: string;
  year: string;
  fileName: string;
  hasContext: boolean;
};

type UnsavedContentResolution = "save" | "discard" | "cancel";
type RawInputDiscardResolution = "discard" | "cancel";
type SaveFilenameMismatchResolution = "keep-current" | "save-as-new" | "cancel";
type ExistingDocumentSaveTarget = {
  writePath: string;
  finalPath: string;
  applyCaseOnlyRename: boolean;
};

const PROCESSING_CANCELLED_MESSAGE = "Processing cancelled";

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
  hasRenderablePreviewSource: ComputedRef<boolean>;
  previewPlaceholderInfo: ComputedRef<PreviewPlaceholderInfo>;
  songMetadata: ComputedRef<SongMetadata>;
  document: Ref<WorkspaceDocument>;
  songbook: Ref<Songbook | null>;
  selectedSongPath: ComputedRef<string>;
  hasUnsavedChanges: ComputedRef<boolean>;
  showUnsavedContentModal: ComputedRef<boolean>;
  unsavedContentModalMode: Ref<"dirty" | "raw-input" | null>;
  unsavedContentMetadataLine: ComputedRef<string>;
  rawInputDiscardMessage: Ref<string>;
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
  openSongFile(filePath: string, options?: { bypassUnsavedChanges?: boolean; persistLastOpenedSong?: boolean }): Promise<boolean>;
  saveDocument(): Promise<boolean>;
  setChordProText(value: string): void;
  setActivePanel(panel: "songbook" | "convert"): void;
  confirmUnsavedContentSave(): Promise<void>;
  confirmUnsavedContentDiscard(): void;
  confirmUnsavedContentCancel(): void;
  confirmRawInputDiscard(): void;
  confirmRawInputCancel(): void;
  confirmKeepCurrentFileName(): void;
  confirmSaveAsNewFile(): void;
  confirmSaveFilenameMismatchCancel(): void;
  abortConversion(): void;
  runPipeline(options?: RunPipelineOptions): Promise<boolean>;
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
  const unsavedContentModalMode = ref<"dirty" | "raw-input" | null>(null);
  const showUnsavedContentModal = computed(() => unsavedContentModalMode.value !== null);
  const isResolvingUnsavedContent = ref(false);
  const showSaveFilenameMismatchModal = ref(false);
  const saveFilenameMismatchCurrentName = ref("");
  const saveFilenameMismatchSuggestedName = ref("");
  const rawInputDiscardMessage = ref("");
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
  let pendingRawInputDiscardResolution: Promise<RawInputDiscardResolution> | null = null;
  let resolveRawInputDiscardResolution: ((choice: RawInputDiscardResolution) => void) | null = null;
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

  function parseChordProDirective(line: string): { key: string; value?: string } | null {
    const directiveMatch = line.match(/^\{([^}]+)\}$/);
    if (!directiveMatch) {
      return null;
    }

    const content = directiveMatch[1].trim();
    const separatorIndex = content.indexOf(":");

    if (separatorIndex === -1) {
      return { key: content.toLowerCase() };
    }

    const key = content.slice(0, separatorIndex).trim().toLowerCase();
    const value = content.slice(separatorIndex + 1).trim();

    return {
      key,
      value: value.length > 0 ? value : undefined
    };
  }

  function isMetadataDirectiveKey(key: string): boolean {
    return key === "title" || key === "artist" || key === "album" || key === "year";
  }

  function analyzePreviewSource(chordPro: string): {
    isEffectivelyEmpty: boolean;
    isMetadataOnly: boolean;
  } {
    let hasRenderableContent = false;
    let hasMetadata = false;
    let inTabBlock = false;

    for (const rawLine of chordPro.replace(/\r\n?/g, "\n").split("\n")) {
      const trimmed = rawLine.trim();

      if (!trimmed) {
        continue;
      }

      const directive = parseChordProDirective(trimmed);
      if (directive) {
        if (directive.key === "start_of_tab") {
          inTabBlock = true;
          continue;
        }

        if (directive.key === "end_of_tab") {
          inTabBlock = false;
          continue;
        }

        if (directive.value && isMetadataDirectiveKey(directive.key)) {
          hasMetadata = true;
        }

        continue;
      }

      if (inTabBlock || trimmed.length > 0) {
        hasRenderableContent = true;
        break;
      }
    }

    return {
      isEffectivelyEmpty: !hasRenderableContent,
      isMetadataOnly: !hasRenderableContent && hasMetadata
    };
  }

  function getRenderStyle(): ChordproRenderStyle {
    return {
      showChordDiagrams: appConfig.showChordDiagrams.value,
      instrument: appConfig.instrument.value
    };
  }

  const hasRenderablePreviewSource = computed(() => !analyzePreviewSource(document.value.chordProText).isEffectivelyEmpty);
  const previewPlaceholderInfo = computed<PreviewPlaceholderInfo>(() => {
    const title = songMetadata.value.title?.trim() ?? "";
    const artist = songMetadata.value.artist?.trim() ?? "";
    const album = songMetadata.value.album?.trim() ?? "";
    const year = songMetadata.value.year?.trim() ?? "";
    const fileName = document.value.fileName.trim();

    return {
      title,
      artist,
      album,
      year,
      fileName,
      hasContext:
        title.length > 0 ||
        artist.length > 0 ||
        album.length > 0 ||
        year.length > 0 ||
        fileName.length > 0
    };
  });

  function refreshPreviewForRenderPreferenceChange(): void {
    const previewSource = analyzePreviewSource(document.value.chordProText);

    if (previewSource.isEffectivelyEmpty) {
      cancelPendingPreviewRefresh();
      clearPreviewState();
      return;
    }

    if (!previewSrc.value) {
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

  function clearPreviewState(): void {
    previewPath.value = "";
    revokePreviewUrl();
    previewSrc.value = "";
    isRefreshingPreview.value = false;
    isManualPreviewRefresh.value = false;
    clearOperationMessages();
  }

  function cancelActiveGeneration(): void {
    if (!loading.value && !isGeneratingPreview.value && !currentAbortController) {
      return;
    }

    abortActiveOperation();
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
    const requestId = options?.requestId ?? previewRequestId + 1;
    const refreshingState = options?.refreshingState ?? false;
    const previewSource = analyzePreviewSource(chordPro);
    const bypassCache = (options?.bypassCache ?? false) || previewSource.isMetadataOnly;
    const requestStillActive = () => requestId === previewRequestId;

    if (options?.requestId === undefined) {
      previewRequestId = requestId;
    }

    previewError.value = "";

    if (previewSource.isEffectivelyEmpty) {
      if (requestStillActive()) {
        clearPreviewState();
      }
      return;
    }

    if (manageLoadingState) {
      isGeneratingPreview.value = true;
    }

    if (refreshingState) {
      isRefreshingPreview.value = true;
    }

    try {
      const preview = await chordproAdapter.generatePreview(chordPro, {
        bypassCache,
        renderStyle: getRenderStyle(),
        fileName: document.value.fileName
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

    cancelPendingPreviewRefresh();

    if (analyzePreviewSource(chordPro).isEffectivelyEmpty) {
      clearPreviewState();
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
    }, 500);
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
    clearPreviewState();
  }

  function clearAllState(): void {
    rawInput.value = "";
    clearGeneratedState();
  }

  function hasRawInputContent(): boolean {
    return rawInput.value.trim().length > 0;
  }

  function clearUnsavedModalState(): void {
    unsavedContentModalMode.value = null;
    rawInputDiscardMessage.value = "";
  }

  function requestRawInputDiscardResolution(message: string): Promise<RawInputDiscardResolution> {
    if (!hasRawInputContent()) {
      return Promise.resolve("discard");
    }

    if (pendingRawInputDiscardResolution) {
      return pendingRawInputDiscardResolution;
    }

    isResolvingUnsavedContent.value = false;
    unsavedContentModalMode.value = "raw-input";
    rawInputDiscardMessage.value = message;
    pendingRawInputDiscardResolution = new Promise<RawInputDiscardResolution>((resolve) => {
      resolveRawInputDiscardResolution = (choice) => {
        clearUnsavedModalState();
        pendingRawInputDiscardResolution = null;
        resolveRawInputDiscardResolution = null;
        resolve(choice);
      };
    });

    return pendingRawInputDiscardResolution;
  }

  function sanitizeFilenamePart(value: string): string {
    return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  }

  function extractChordProMetadata(chordPro: string): SongMetadata {
    const titleMatch = chordPro.match(/^\{title:\s*(.+?)\s*\}$/im);
    const artistMatch = chordPro.match(/^\{artist:\s*(.+?)\s*\}$/im);
    const albumMatch = chordPro.match(/^\{album:\s*(.+?)\s*\}$/im);
    const yearMatch = chordPro.match(/^\{year:\s*(.+?)\s*\}$/im);

    return {
      title: titleMatch?.[1]?.trim(),
      artist: artistMatch?.[1]?.trim(),
      album: albumMatch?.[1]?.trim(),
      year: yearMatch?.[1]?.trim()
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
        renderStyle: getRenderStyle(),
        fileName: document.value.fileName
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

  function abortActiveOperation(options?: { showFeedback?: boolean }): boolean {
    const hadActiveOperation = loading.value || isGeneratingPreview.value || currentAbortController !== null;

    if (!hadActiveOperation) {
      return false;
    }

    currentPipelineRequestId += 1;
    loading.value = false;
    isGeneratingPreview.value = false;
    cancelPendingPreviewRefresh();

    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }

    if (options?.showFeedback !== false) {
      feedback.showFeedback({
        type: "info",
        message: PROCESSING_CANCELLED_MESSAGE
      });
    }

    return true;
  }

  function abortConversion(): void {
    abortActiveOperation();
  }

  function clearPipelineRunState(clearBeforeRun = false): void {
    if (clearBeforeRun) {
      clearGeneratedState();
      return;
    }

    error.value = "";
    retryLog.value = [];
    validationReason.value = "";
    validationRawOutput.value = "";
    clearOperationMessages();
  }

  function applyGeneratedPipelineResult(
    result: {
      cleanedText: string;
      chordPro: string;
      song: Song;
      retryLog?: string[];
    },
    entryPoint: PipelineEntryPoint
  ): void {
    if (entryPoint !== "chordPro") {
      cleanedText.value = result.cleanedText;
      replaceDocument(
        createDocumentFromChordPro(result.chordPro, {
          filePath: "",
          song: result.song,
          dirty: false
        })
      );
    } else {
      cancelPendingPreviewRefresh();
      document.value = {
        ...document.value,
        chordProText: result.chordPro,
        song: result.song
      };
      songJson.value = JSON.stringify(result.song, null, 2);
    }

    retryLog.value = result.retryLog ?? [];
  }

  async function runPipeline(options?: RunPipelineOptions): Promise<boolean> {
    if (!(await ensureDocumentCanBeReplaced())) {
      return false;
    }

    const entryPoint = options?.entryPoint ?? "raw";
    const pipelineInput = options?.input ?? (entryPoint === "raw" ? rawInput.value : entryPoint === "cleaned" ? cleanedText.value : document.value.chordProText);
    clearPipelineRunState(options?.clearBeforeRun ?? false);

    const localRequestId = currentPipelineRequestId + 1;
    currentPipelineRequestId = localRequestId;
    const canAbortPipeline = entryPoint !== "chordPro";
    const abortController =
      canAbortPipeline && typeof AbortController !== "undefined" ? new AbortController() : null;
    currentAbortController = abortController;
    loading.value = canAbortPipeline;
    isGeneratingPreview.value = true;

    try {
      const pipeline = createPipeline(options?.model);
      const result = await pipeline.process(
        {
          entryPoint,
          input: pipelineInput
        },
        options?.preferences,
        abortController
          ? {
              signal: abortController.signal
            }
          : undefined
      );

      if (localRequestId !== currentPipelineRequestId) {
        return false;
      }

      applyGeneratedPipelineResult(result, entryPoint);

      const previewRequestIdForRun = previewRequestId + 1;
      previewRequestId = previewRequestIdForRun;
      clearCurrentAbortController(abortController);
      loading.value = false;
      await refreshPreview(result.chordPro, {
        manageLoadingState: false,
        requestId: previewRequestIdForRun
      });
      return true;
    } catch (err) {
      if (localRequestId !== currentPipelineRequestId || isAbortError(err)) {
        return false;
      }

      console.error("Pipeline execution failed.", err);

      if (err instanceof ChordProValidationError && entryPoint !== "chordPro") {
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
      return true;
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

    if (analyzePreviewSource(document.value.chordProText).isEffectivelyEmpty) {
      clearPreviewState();
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
    cancelPendingPreviewRefresh();
    clearPreviewState();
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
    unsavedContentModalMode.value = "dirty";
    pendingUnsavedContentResolution = new Promise<UnsavedContentResolution>((resolve) => {
      resolveUnsavedContentResolution = (choice) => {
        clearUnsavedModalState();
        isResolvingUnsavedContent.value = false;
        pendingUnsavedContentResolution = null;
        resolveUnsavedContentResolution = null;
        resolve(choice);
      };
    });

    return pendingUnsavedContentResolution;
  }

  async function resolveUnsavedChanges(): Promise<UnsavedContentResolution> {
    if (!hasUnsavedChanges.value) {
      return "discard";
    }

    return requestUnsavedContentResolution();
  }

  async function ensureDocumentCanBeReplaced(): Promise<boolean> {
    const resolution = await resolveUnsavedChanges();
    return resolution !== "cancel";
  }

  async function requestClearAllState(): Promise<void> {
    const resolution = await resolveUnsavedChanges();

    if (resolution === "cancel") {
      return;
    }

    const rawInputResolution = await requestRawInputDiscardResolution("Discard the current original text?");
    if (rawInputResolution === "cancel") {
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

  function confirmRawInputDiscard(): void {
    resolveRawInputDiscardResolution?.("discard");
  }

  function confirmRawInputCancel(): void {
    resolveRawInputDiscardResolution?.("cancel");
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
  async function openSongFile(filePath: string, options?: { bypassUnsavedChanges?: boolean; persistLastOpenedSong?: boolean }): Promise<boolean> {
    if (!options?.bypassUnsavedChanges && !(await ensureDocumentCanBeReplaced())) {
      return false;
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

      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Could not open the selected song.";
      return false;
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
            if (!hasUnsavedChanges.value && !hasRawInputContent()) {
              return;
            }

            event.preventDefault();

            if (hasUnsavedChanges.value) {
              const resolution = await resolveUnsavedChanges();

              if (resolution === "cancel") {
                return;
              }
            }

            const rawInputResolution = await requestRawInputDiscardResolution(
              "Closing the app will discard the current original text. Continue?"
            );
            if (rawInputResolution === "cancel") {
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
    abortActiveOperation({ showFeedback: false });

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
    hasRenderablePreviewSource,
    previewPlaceholderInfo,
    songMetadata,
    document,
    songbook,
    selectedSongPath,
    hasUnsavedChanges,
    showUnsavedContentModal,
    unsavedContentModalMode,
    unsavedContentMetadataLine,
    rawInputDiscardMessage,
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
    confirmRawInputDiscard,
    confirmRawInputCancel,
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
