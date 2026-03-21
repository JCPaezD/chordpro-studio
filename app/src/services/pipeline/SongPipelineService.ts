import type { Song } from "../../domain/song";
import { normalizeMetadata } from "../../domain/song/normalizeMetadata";
import { ChordProOutputValidator } from "../../domain/validation/ChordProOutputValidator";
import type { CleaningService } from "../cleaning";
import type { ConversionService } from "../conversion";
import type { ChordProParser } from "../parser/ChordProParser";

const METADATA_DIRECTIVE_PATTERNS = {
  title: /^\{title:\s*(.*?)\s*\}$/im,
  artist: /^\{artist:\s*(.*?)\s*\}$/im
} as const;

type NormalizableMetadataKey = keyof typeof METADATA_DIRECTIVE_PATTERNS;

function normalizeConvertedChordProMetadata(chordPro: string): string {
  const normalizedMetadata = normalizeMetadata({
    title: chordPro.match(METADATA_DIRECTIVE_PATTERNS.title)?.[1],
    artist: chordPro.match(METADATA_DIRECTIVE_PATTERNS.artist)?.[1]
  });

  let normalizedChordPro = chordPro;

  for (const key of Object.keys(METADATA_DIRECTIVE_PATTERNS) as NormalizableMetadataKey[]) {
    const normalizedValue = normalizedMetadata[key];
    if (normalizedValue === undefined) {
      continue;
    }

    normalizedChordPro = normalizedChordPro.replace(
      METADATA_DIRECTIVE_PATTERNS[key],
      `{${key}: ${normalizedValue}}`
    );
  }

  return normalizedChordPro;
}

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
    const chordPro = normalizeConvertedChordProMetadata(conversionResult.text);
    const song = this.chordProParser.parse(chordPro);

    return {
      cleanedText,
      chordPro,
      retryLog: conversionResult.retryLog,
      song
    };
  }
}
