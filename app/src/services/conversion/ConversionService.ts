import type { LLMGenerateOptions, LLMGenerateResult, LLMProvider } from "../../adapters/llm/LLMProvider";
import { PromptLoader } from "../../utils/PromptLoader";

export const INSUFFICIENT_INPUT_SENTINEL = "ERROR: insufficient input";
export const NOT_ENOUGH_INPUT_MESSAGE = "Not enough input to generate a song sheet";

export class InsufficientInputError extends Error {
  constructor() {
    super(NOT_ENOUGH_INPUT_MESSAGE);
    this.name = "InsufficientInputError";
  }
}

export class ConversionService {
  constructor(
    private readonly provider: LLMProvider,
    private readonly promptLoader: PromptLoader = new PromptLoader()
  ) {}

  async convert(
    cleanedText: string,
    preferences?: Record<string, unknown>,
    options?: LLMGenerateOptions
  ): Promise<LLMGenerateResult> {
    if (!cleanedText.trim()) {
      throw new InsufficientInputError();
    }

    const prompt = await this.promptLoader.renderPrompt("conversion", {
      song_text: cleanedText,
      user_preferences: JSON.stringify(preferences ?? {})
    });

    const result = await this.provider.generate(prompt, options);

    if (result.text.includes(INSUFFICIENT_INPUT_SENTINEL)) {
      throw new InsufficientInputError();
    }

    return result;
  }
}
