import type { Song } from "../../domain/song/song";

export interface CleaningService {
  clean(input: string): Promise<string>;
}

export interface ConversionService {
  convert(cleanedText: string): Promise<Song>;
}

export interface AnalysisService {
  analyze(song: Song): Promise<string[]>;
}
