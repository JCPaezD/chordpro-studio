import type { SongMetadata } from "./metadata";
import type { SongSection } from "./section";
import type { SongSource } from "./source";
import type { SongId } from "./types";

export interface Song {
  id?: SongId;
  metadata: SongMetadata;
  source?: SongSource;
  sections: SongSection[];
}
