import type { LLMGenerateOptions, LLMGenerateResult, LLMProvider } from "./LLMProvider";

const OPENAI_API_URL = "https://api.openai.com/v1/responses";

export class OpenAIProvider implements LLMProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {
    if (!this.apiKey.trim()) {
      throw new Error("OPENAI_API_KEY is not set.");
    }
  }

  async generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMGenerateResult> {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        input: prompt
      }),
      signal: options?.signal
    });

    if (!response.ok) {
      throw new Error(
        `OpenAI request failed (${response.status}): ${await response.text()}`
      );
    }

    const data = (await response.json()) as {
      output_text?: string;
      output?: Array<{
        content?: Array<{
          type?: string;
          text?: string;
        }>;
      }>;
    };

    if (typeof data.output_text === "string" && data.output_text.length > 0) {
      return { text: data.output_text };
    }

    const fallbackText =
      data.output
        ?.flatMap((item) => item.content ?? [])
        .find((content) => content.type === "output_text" && content.text)?.text ??
      "";

    if (!fallbackText) {
      throw new Error("OpenAI response did not include generated text.");
    }

    return { text: fallbackText };
  }
}
