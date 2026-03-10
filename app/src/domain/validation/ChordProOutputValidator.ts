const EXPLANATORY_PATTERNS = [
  /(^|\n)\s*here is\b/i,
  /(^|\n)\s*explanation\b/i,
  /(^|\n)\s*notes?\b/i
];

const CHORDPRO_TAG_PATTERN = /\{(?:title|artist|album|year)\s*:|\{start_of_/i;
const CHORD_PATTERN = /\[[A-G](?:#|b)?(?:m|maj|min|sus|add|dim|aug)?\d*(?:\/[A-G](?:#|b)?)?\]/i;

export interface ChordProValidationDetails {
  reason: string;
  rawOutput?: string;
}

export class ChordProValidationError extends Error {
  readonly code: string;
  readonly details?: ChordProValidationDetails;

  constructor(code: string, details?: ChordProValidationDetails) {
    super(ChordProOutputValidator.buildMessage(details));
    this.name = "ChordProValidationError";
    this.code = code;
    this.details = details;
  }
}

export class ChordProOutputValidator {
  static validate(output: string): void {
    const normalizedOutput = output.trim();

    if (normalizedOutput.length === 0) {
      throw new ChordProValidationError("INVALID_CHORDPRO_OUTPUT", {
        reason: "empty_output",
        rawOutput: output
      });
    }

    if (normalizedOutput.includes("```")) {
      throw new ChordProValidationError("INVALID_CHORDPRO_OUTPUT", {
        reason: "markdown_fence_detected",
        rawOutput: output
      });
    }

    if (EXPLANATORY_PATTERNS.some((pattern) => pattern.test(normalizedOutput))) {
      throw new ChordProValidationError("INVALID_CHORDPRO_OUTPUT", {
        reason: "explanatory_text_detected",
        rawOutput: output
      });
    }

    if (!CHORDPRO_TAG_PATTERN.test(normalizedOutput)) {
      throw new ChordProValidationError("INVALID_CHORDPRO_OUTPUT", {
        reason: "missing_chordpro_tag",
        rawOutput: output
      });
    }

    if (!CHORD_PATTERN.test(normalizedOutput)) {
      throw new ChordProValidationError("INVALID_CHORDPRO_OUTPUT", {
        reason: "missing_chord",
        rawOutput: output
      });
    }
  }

  private static buildMessage(details?: ChordProValidationDetails): string {
    const reason = details?.reason ?? "unknown";
    return `Invalid ChordPro output from LLM: ${reason}.`;
  }
}

// Development examples:
// Invalid: "This is a song"
// Invalid: "```chordpro"
// Invalid: "Here is the converted song"
// Valid:
// {title: Test}
// [C]Hello world
