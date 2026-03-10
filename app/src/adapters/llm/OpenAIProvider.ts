import type { LLMGenerateResult, LLMProvider } from "./LLMProvider";

const OPENAI_API_URL = "https://api.openai.com/v1/responses";

function readOpenAiApiKey(): string | undefined {
  const fromProcess = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env?.OPENAI_API_KEY;

  if (typeof fromProcess === "string" && fromProcess.trim().length > 0) {
    return fromProcess.trim();
  }

  const fromVite = import.meta.env?.VITE_OPENAI_API_KEY;
  if (typeof fromVite === "string" && fromVite.trim().length > 0) {
    return fromVite.trim();
  }

  return undefined;
}

export class OpenAIProvider implements LLMProvider {
  private readonly apiKey: string;

  constructor(private readonly model: string) {
    const apiKey = readOpenAiApiKey();
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set.");
    }
    this.apiKey = apiKey;
  }

  async generate(prompt: string): Promise<LLMGenerateResult> {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        input: prompt
      })
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
