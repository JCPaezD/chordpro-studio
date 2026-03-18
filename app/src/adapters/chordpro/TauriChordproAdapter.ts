import { invoke, isTauri } from "@tauri-apps/api/core";

import type { ChordproAdapter, PreviewResult } from "./adapter";

interface GeneratePreviewResponse {
  pdfPath: string;
  pdfBase64: string;
}

interface ExportPdfResponse {
  outputPath: string;
}

interface TauriCommandError {
  code?: string;
  message?: string;
  stdout?: string;
  stderr?: string;
  details?: string;
}

function formatTauriError(error: unknown): Error {
  if (typeof error === "object" && error !== null) {
    const commandError = error as TauriCommandError;
    const parts = [commandError.message ?? "ChordPro CLI command failed."];

    if (commandError.stderr) {
      parts.push(commandError.stderr);
    } else if (commandError.stdout) {
      parts.push(commandError.stdout);
    }

    return new Error(parts.join("\n\n"));
  }

  return error instanceof Error ? error : new Error("ChordPro CLI command failed.");
}

export class TauriChordproAdapter implements ChordproAdapter {
  async generatePreview(chordproText: string): Promise<PreviewResult> {
    if (!isTauri()) {
      throw new Error("Preview generation requires the Tauri desktop runtime.");
    }

    try {
      const response = await invoke<GeneratePreviewResponse>("generate_preview", {
        chordproText
      });

      return {
        pdfPath: response.pdfPath,
        pdfBase64: response.pdfBase64
      };
    } catch (error) {
      throw formatTauriError(error);
    }
  }

  async exportPdf(chordproText: string, outputPath: string): Promise<string> {
    if (!isTauri()) {
      throw new Error("PDF export requires the Tauri desktop runtime.");
    }

    try {
      const response = await invoke<ExportPdfResponse>("export_pdf", {
        chordproText,
        outputPath
      });
      return response.outputPath;
    } catch (error) {
      throw formatTauriError(error);
    }
  }

  async exportSongbookPdf(inputPaths: string[], outputPath: string): Promise<string> {
    if (!isTauri()) {
      throw new Error("PDF export requires the Tauri desktop runtime.");
    }

    try {
      const response = await invoke<ExportPdfResponse>("export_songbook_pdf", {
        inputPaths,
        outputPath
      });
      return response.outputPath;
    } catch (error) {
      throw formatTauriError(error);
    }
  }
}