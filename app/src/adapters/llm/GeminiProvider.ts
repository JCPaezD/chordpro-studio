import type { LLMProvider } from "./LLMProvider";

type ProcessEnvMap = Record<string, string | undefined>;

function readEnv(name: string): string | undefined {
  const fromProcess = (
    globalThis as { process?: { env?: ProcessEnvMap } }
  ).process?.env?.[name];

  if (typeof fromProcess === "string" && fromProcess.trim().length > 0) {
    return fromProcess.trim();
  }

  return undefined;
}

export class GeminiProvider implements LLMProvider {
  private readonly apiKey: string;

  constructor(private readonly model: string) {
    const apiKey = readEnv("GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set.");
    }
    this.apiKey = apiKey;
  }

  async generate(prompt: string): Promise<string> {
    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent` +
      `?key=${encodeURIComponent(this.apiKey)}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(
        `Gemini request failed (${response.status}): ${await response.text()}`
      );
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
          }>;
        };
      }>;
    };

    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("") ?? "";

    if (!text) {
      throw new Error("Gemini response did not include generated text.");
    }

    return text;
  }
}
