export interface ChordproAdapter {
  exportPdf(chordproText: string, outputPath: string): Promise<void>;
}
