const EXPLANATORY_PATTERNS = [
  /(^|\n)\s*here is\b/i,
  /(^|\n)\s*explanation\b/i,
  /(^|\n)\s*notes?\b/i
];

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
// Valid:
// {start_of_verse}
// Hello world
// {end_of_verse}
// Valid:
// Hello world
