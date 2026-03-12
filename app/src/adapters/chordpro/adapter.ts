export interface PreviewResult {
  htmlPath: string;
  htmlContent: string;
}

export interface ChordproAdapter {
  generatePreview(chordproText: string): Promise<PreviewResult>;
  exportPdf(chordproText: string, outputPath: string): Promise<string>;
}
