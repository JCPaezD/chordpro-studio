import type { SongSourceKind } from "./types";

export interface SongSource {
  kind: SongSourceKind;
  originalInput?: string;
  cleanedInput?: string;
  originalFormat?: "raw" | "chordpro";
}
