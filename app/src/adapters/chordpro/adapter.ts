export type ChordproDiagramInstrument = "guitar" | "piano" | "ukulele";

export interface PreviewResult {
  pdfPath: string;
  pdfBase64: string;
}

export interface ChordproRenderStyle {
  showChordDiagrams: boolean;
  instrument: ChordproDiagramInstrument;
}

export interface ChordproPreviewOptions {
  bypassCache?: boolean;
  renderStyle?: ChordproRenderStyle;
  fileName?: string;
}

export interface ChordproExportOptions {
  renderStyle?: ChordproRenderStyle;
  fileName?: string;
}

export interface ChordproAdapter {
  generatePreview(chordproText: string, options?: ChordproPreviewOptions): Promise<PreviewResult>;
  exportPdf(chordproText: string, outputPath: string, options?: ChordproExportOptions): Promise<string>;
  exportSongbookPdf(inputPaths: string[], outputPath: string, options?: ChordproExportOptions): Promise<string>;
}
