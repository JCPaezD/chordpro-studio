export interface PreviewResult {
  pdfPath: string;
  pdfBase64: string;
}

export interface ChordproAdapter {
  generatePreview(chordproText: string, options?: { bypassCache?: boolean }): Promise<PreviewResult>;
  exportPdf(chordproText: string, outputPath: string): Promise<string>;
  exportSongbookPdf(inputPaths: string[], outputPath: string): Promise<string>;
}
