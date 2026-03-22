import type { LLMGenerateOptions, LLMGenerateResult, LLMProvider } from "../../adapters/llm/LLMProvider";
import { PromptLoader } from "../../utils/PromptLoader";

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
    const prompt = await this.promptLoader.renderPrompt("conversion", {
      song_text: cleanedText,
      user_preferences: JSON.stringify(preferences ?? {})
    });

    return this.provider.generate(prompt, options);
  }
}
