import type { SongLine } from "./line";
import type { SectionType } from "./types";

export interface SongSection {
  type: SectionType;
  label?: string;
  lines: SongLine[];
}
