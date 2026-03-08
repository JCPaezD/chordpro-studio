import type { Song } from "../../domain/song/song";

export interface AnalysisService {
  analyze(song: Song): Promise<string[]>;
}
