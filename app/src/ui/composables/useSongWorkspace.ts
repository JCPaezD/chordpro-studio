import { inject, provide, ref, type InjectionKey, type Ref } from "vue";

import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { GeminiRetryError, GeminiProvider } from "../../adapters/llm/GeminiProvider";
import { OpenAIProvider } from "../../adapters/llm/OpenAIProvider";
import { TauriChordproAdapter } from "../../adapters/chordpro/TauriChordproAdapter";
import { ChordProValidationError } from "../../domain/validation/ChordProOutputValidator";
import type { SongMetadata } from "../../domain/song";
import { CleaningService } from "../../services/cleaning";
import { ConversionService } from "../../services/conversion";
import { ChordProParser } from "../../services/parser/ChordProParser";
import { SongPipelineService } from "../../services/pipeline/SongPipelineService";

type RunPipelineOptions = {
  model?: string;
  preferences?: Record<string, unknown>;
};

export type SongWorkspace = {
  rawInput: Ref<string>;
  cleanedText: Ref<string>;
  chordProText: Ref<string>;
  songJson: Ref<string>;
  loading: Ref<boolean>;
  error: Ref<string>;
  retryLog: Ref<string[]>;
  validationReason: Ref<string>;
  validationRawOutput: Ref<string>;
  previewPath: Ref<string>;
  previewSrc: Ref<string>;
  previewError: Ref<string>;
  exportError: Ref<string>;
  exportSuccess: Ref<string>;
  songMetadata: Ref<SongMetadata>;
  copyToClipboard(value: string): Promise<void>;
  pasteFromClipboard(): Promise<void>;
  refreshPreview(chordPro: string): Promise<void>;
  clearGeneratedState(): void;
  exportCurrent(): Promise<void>;
  runPipeline(options?: RunPipelineOptions): Promise<void>;
  previewFromChordPro(): Promise<void>;
  dispose(): void;
};

const songWorkspaceKey: InjectionKey<SongWorkspace> = Symbol("song-workspace");

export function createSongWorkspace(): SongWorkspace {
  const rawInput = ref("");
  const cleanedText = ref("");
  const chordProText = ref("");
  const songJson = ref("");
  const loading = ref(false);
  const error = ref("");
  const retryLog = ref<string[]>([]);
  const validationReason = ref("");
  const validationRawOutput = ref("");
  const previewPath = ref("");
  const previewSrc = ref("");
  const previewError = ref("");
  const exportError = ref("");
  const exportSuccess = ref("");
  const songMetadata = ref<SongMetadata>({});

  const chordproAdapter = new TauriChordproAdapter();

  function revokePreviewUrl(): void {
    if (previewSrc.value.startsWith("blob:")) {
      URL.revokeObjectURL(previewSrc.value);
    }
  }

  function createPdfBlobUrl(pdfBase64: string): string {
    const binary = atob(pdfBase64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
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

  async function refreshPreview(chordPro: string): Promise<void> {
    previewError.value = "";

    try {
      const preview = await chordproAdapter.generatePreview(chordPro);
      const nextPreviewUrl = createPdfBlobUrl(preview.pdfBase64);
      revokePreviewUrl();
      previewPath.value = preview.pdfPath;
      previewSrc.value = nextPreviewUrl;
    } catch (err) {
      previewError.value = err instanceof Error ? err.message : "Preview generation failed.";
    }
  }

  function clearGeneratedState(): void {
    cleanedText.value = "";
    chordProText.value = "";
    songJson.value = "";
    error.value = "";
    retryLog.value = [];
    validationReason.value = "";
    validationRawOutput.value = "";
    songMetadata.value = {};
    previewPath.value = "";
    revokePreviewUrl();
    previewSrc.value = "";
    previewError.value = "";
    exportError.value = "";
    exportSuccess.value = "";
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

  function buildSuggestedExportName(extension: "pdf" | "cho"): string {
    const metadata = {
      ...songMetadata.value,
      ...extractChordProMetadata(chordProText.value)
    };

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

  async function exportCurrent(): Promise<void> {
    exportError.value = "";
    exportSuccess.value = "";

    try {
      if (!chordProText.value) {
        exportError.value = "No ChordPro text available to export.";
        return;
      }

      const selectedPath = await save({
        title: "Export ChordPro output",
        defaultPath: buildSuggestedExportName("pdf"),
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
        await writeTextFile(normalizedPath, chordProText.value);
        exportSuccess.value = `ChordPro exported to ${normalizedPath}`;
        return;
      }

      const exportedPath = await chordproAdapter.exportPdf(chordProText.value, normalizedPath);
      exportSuccess.value = `PDF exported to ${exportedPath}`;
    } catch (err) {
      if (err instanceof Error && err.message) {
        exportError.value = err.message;
        return;
      }

      if (typeof err === "string" && err.trim().length > 0) {
        exportError.value = err;
        return;
      }

      exportError.value = JSON.stringify(err) || "PDF export failed.";
    }
  }

  function createProvider(model = "gemini-2.5-flash") {
    try {
      return new GeminiProvider(model);
    } catch {
      try {
        return new OpenAIProvider("gpt-4.1-mini");
      } catch {
        return {
          async generate() {
            throw new Error("No LLM API key configured. Set OPENAI_API_KEY or GEMINI_API_KEY.");
          }
        };
      }
    }
  }

  function createPipeline(model?: string): SongPipelineService {
    return new SongPipelineService(
      new CleaningService(),
      new ConversionService(createProvider(model)),
      new ChordProParser()
    );
  }

  async function runPipeline(options?: RunPipelineOptions): Promise<void> {
    clearGeneratedState();
    loading.value = true;

    try {
      const pipeline = createPipeline(options?.model);
      const result = await pipeline.process(rawInput.value, options?.preferences);
      cleanedText.value = result.cleanedText;
      chordProText.value = result.chordPro;
      songMetadata.value = result.song.metadata;
      retryLog.value = result.retryLog ?? [];
      songJson.value = JSON.stringify(result.song, null, 2);
      await refreshPreview(result.chordPro);
    } catch (err) {
      if (err instanceof ChordProValidationError) {
        validationReason.value = err.details?.reason ?? "";
        validationRawOutput.value = err.details?.rawOutput ?? "";
        chordProText.value = validationRawOutput.value;
      }

      if (err instanceof GeminiRetryError) {
        retryLog.value = err.retryLog;
      }

      error.value = err instanceof Error ? err.message : "Pipeline execution failed.";
    } finally {
      loading.value = false;
    }
  }

  async function previewFromChordPro(): Promise<void> {
    previewError.value = "";
    exportError.value = "";
    exportSuccess.value = "";

    if (!chordProText.value) {
      previewError.value = "No ChordPro text available for preview.";
      return;
    }

    await refreshPreview(chordProText.value);
  }

  function dispose(): void {
    revokePreviewUrl();
  }

  return {
    rawInput,
    cleanedText,
    chordProText,
    songJson,
    loading,
    error,
    retryLog,
    validationReason,
    validationRawOutput,
    previewPath,
    previewSrc,
    previewError,
    exportError,
    exportSuccess,
    songMetadata,
    copyToClipboard,
    pasteFromClipboard,
    refreshPreview,
    clearGeneratedState,
    exportCurrent,
    runPipeline,
    previewFromChordPro,
    dispose
  };
}

export function provideSongWorkspace(workspace: SongWorkspace): void {
  provide(songWorkspaceKey, workspace);
}

export function useSongWorkspace(): SongWorkspace {
  const workspace = inject(songWorkspaceKey);

  if (!workspace) {
    throw new Error("Song workspace not provided.");
  }

  return workspace;
}
