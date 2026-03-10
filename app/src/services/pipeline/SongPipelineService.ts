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
  ): Promise<{ cleanedText: string; chordPro: string; song: Song }> {
    const cleanedText = this.cleaningService.clean(rawText);
    const chordPro = await this.conversionService.convert(cleanedText, preferences);
    ChordProOutputValidator.validate(chordPro);
    const song = this.chordProParser.parse(chordPro);

    return {
      cleanedText,
      chordPro,
      song
    };
  }
}
