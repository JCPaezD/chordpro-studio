import type { LLMGenerateOptions, LLMGenerateResult, LLMProvider } from "./LLMProvider";

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [500, 1000, 2000];

function createAbortError(): Error {
  if (typeof DOMException !== "undefined") {
    return new DOMException("Gemini request was aborted.", "AbortError");
  }

  const error = new Error("Gemini request was aborted.");
  error.name = "AbortError";
  return error;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    const timeoutId = setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, ms);

    function handleAbort(): void {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", handleAbort);
      reject(createAbortError());
    }

    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 503;
}

function extractRetryableStatus(error: Error): number | undefined {
  if (!error.message.startsWith("Gemini request failed (")) {
    return undefined;
  }

  const statusMatch = error.message.match(/^Gemini request failed \((\d+)\):/);
  return statusMatch ? Number(statusMatch[1]) : undefined;
}

export class GeminiRetryError extends Error {
  readonly retryLog: string[];

  constructor(message: string, retryLog: string[]) {
    super(message);
    this.name = "GeminiRetryError";
    this.retryLog = retryLog;
  }
}

export class GeminiProvider implements LLMProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {
    if (!this.apiKey.trim()) {
      throw new Error("GEMINI_API_KEY is not set.");
    }
  }

  async generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMGenerateResult> {
    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent` +
      `?key=${encodeURIComponent(this.apiKey)}`;

    let lastError: Error | undefined;
    const retryLog: string[] = [];

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
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
          }),
          signal: options?.signal
        });

        if (!response.ok) {
          const errorBody = await response.text();

          if (!isRetryableStatus(response.status)) {
            throw new Error(`Gemini request failed (${response.status}): ${errorBody}`);
          }

          lastError = new Error(`Gemini request failed (${response.status}): ${errorBody}`);
        } else {
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

          return retryLog.length > 0 ? { text, retryLog } : { text };
        }
      } catch (error) {
        if (isAbortError(error)) {
          throw error;
        }

        if (error instanceof Error && error.message.startsWith("Gemini request failed (")) {
          lastError = error;

          const status = extractRetryableStatus(error);
          if (status !== undefined && !isRetryableStatus(status)) {
            throw error;
          }
        } else if (
          error instanceof Error &&
          error.message === "Gemini response did not include generated text."
        ) {
          throw error;
        } else {
          lastError =
            error instanceof Error ? error : new Error("Gemini request failed due to network error.");
        }
      }

      if (attempt < MAX_RETRIES) {
        const retryCount = attempt + 1;
        const retryLabel =
          lastError instanceof Error && lastError.message.startsWith("Gemini request failed (")
            ? lastError.message.match(/^Gemini request failed \((\d+)\):/)?.[1] ?? "network"
            : "network";

        const retryMessage = `Retry ${retryCount}/${MAX_RETRIES} after Gemini error ${retryLabel}`;
        retryLog.push(retryMessage);
        console.warn(retryMessage);
        await delay(RETRY_DELAYS_MS[attempt], options?.signal);
        continue;
      }

      break;
    }

    const finalStatus =
      lastError instanceof Error ? extractRetryableStatus(lastError) : undefined;
    const finalMessage =
      finalStatus !== undefined
        ? `Gemini request failed after ${MAX_RETRIES} retries (HTTP ${finalStatus})`
        : `Gemini request failed after ${MAX_RETRIES} retries (network error)`;

    throw new GeminiRetryError(finalMessage, retryLog);
  }
}
