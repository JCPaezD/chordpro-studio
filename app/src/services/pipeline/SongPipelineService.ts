import type { Song } from "../../domain/song";
import { ChordProOutputValidator } from "../../domain/validation/ChordProOutputValidator";
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
  ): Promise<{
    cleanedText: string;
    chordPro: string;
    retryLog?: string[];
    song: Song;
  }> {
    const cleanedText = this.cleaningService.clean(rawText);
    const conversionResult = await this.conversionService.convert(cleanedText, preferences);
    ChordProOutputValidator.validate(conversionResult.text);
    const song = this.chordProParser.parse(conversionResult.text);

    return {
      cleanedText,
      chordPro: conversionResult.text,
      retryLog: conversionResult.retryLog,
      song
    };
  }
}
