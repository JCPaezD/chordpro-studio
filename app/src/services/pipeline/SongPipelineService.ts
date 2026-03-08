import type { Song } from "../../domain/song";
import type { CleaningService } from "../cleaning";
import type { ConversionService } from "../conversion";
import type { ChordProParser } from "../parser/ChordProParser";

export class SongPipelineService {
  constructor(
    private readonly cleaningService: CleaningService,
    private readonly conversionService: ConversionService,
    private readonly chordProParser: ChordProParser
  ) {}

  async process(
    rawText: string,
    preferences?: Record<string, unknown>
  ): Promise<{ chordPro: string; song: Song }> {
    const cleanedText = this.cleaningService.clean(rawText);
    const chordPro = await this.conversionService.convert(cleanedText, preferences);
    const song = this.chordProParser.parse(chordPro);

    return {
      chordPro,
      song
    };
  }
}
