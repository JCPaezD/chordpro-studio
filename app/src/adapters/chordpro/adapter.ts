export interface PreviewResult {
  pdfPath: string;
  pdfBase64: string;
}

export interface ChordproAdapter {
  generatePreview(chordproText: string): Promise<PreviewResult>;
  exportPdf(chordproText: string, outputPath: string): Promise<string>;
}
