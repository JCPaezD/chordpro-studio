import type { SongSegment } from "./segment";

export interface SongLine {
  lyrics: string;
  chords: string[];
  segments?: SongSegment[];
}
