import {
  LLMProviderError,
  type LLMErrorCategory,
  type LLMGenerateOptions,
  type LLMGenerateResult,
  type LLMProvider
} from "./LLMProvider";

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

type GeminiErrorBody = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: unknown[];
  };
};

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 503;
}

function parseJsonBody(body: string): GeminiErrorBody | null {
  try {
    const parsed = JSON.parse(body) as GeminiErrorBody;
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

function includesAny(value: string, patterns: string[]): boolean {
  const normalized = value.toLowerCase();
  return patterns.some((pattern) => normalized.includes(pattern));
}

function stringifyDetails(details: unknown): string {
  try {
    return JSON.stringify(details ?? "");
  } catch {
    return "";
  }
}

function extractHelpLinks(details: unknown[] | undefined): string[] {
  const links: string[] = [];

  for (const detail of details ?? []) {
    if (typeof detail !== "object" || detail === null) {
      continue;
    }

    const candidate = detail as { links?: Array<{ url?: unknown }> };
    for (const link of candidate.links ?? []) {
      if (typeof link.url === "string" && link.url.trim()) {
        links.push(link.url.trim());
      }
    }
  }

  return [...new Set(links)];
}

function classifyResourceExhausted(message: string, details: unknown[] | undefined): LLMErrorCategory {
  const detailText = stringifyDetails(details);
  const combined = `${message}\n${detailText}`;

  if (includesAny(combined, ["quota", "quotafailure", "daily limit", "billing"])) {
    return "quota";
  }

  if (includesAny(combined, ["rate", "per minute", "per day", "too many requests", "throttle"])) {
    return "rate_limit";
  }

  return "rate_or_quota";
}

function classifyGeminiError(statusCode: number, providerStatus: string | undefined, message: string, details: unknown[] | undefined): LLMErrorCategory {
  const combined = `${message}\n${providerStatus ?? ""}\n${stringifyDetails(details)}`;

  if (statusCode === 401 || includesAny(combined, ["api key not valid", "api_key_invalid", "invalid api key"])) {
    return "invalid_api_key";
  }

  if (statusCode === 403 || providerStatus === "PERMISSION_DENIED") {
    return includesAny(combined, ["billing", "paid", "tier", "country", "region"])
      ? "billing_or_tier"
      : "permission";
  }

  if (statusCode === 404 || providerStatus === "NOT_FOUND") {
    return "model_unavailable";
  }

  if (statusCode === 429 || providerStatus === "RESOURCE_EXHAUSTED") {
    return classifyResourceExhausted(message, details);
  }

  if (statusCode === 500 || statusCode === 503 || providerStatus === "INTERNAL" || providerStatus === "UNAVAILABLE") {
    return "service_unavailable";
  }

  if (statusCode === 504 || providerStatus === "DEADLINE_EXCEEDED") {
    return "timeout";
  }

  if (statusCode === 400 || providerStatus === "INVALID_ARGUMENT" || providerStatus === "FAILED_PRECONDITION") {
    return includesAny(combined, ["billing", "paid", "tier", "country", "region"])
      ? "billing_or_tier"
      : "invalid_request";
  }

  return "unknown";
}

function createGeminiError(statusCode: number, body: string, requestedModel: string): LLMProviderError {
  const parsedBody = parseJsonBody(body);
  const providerStatus = parsedBody?.error?.status;
  const message = parsedBody?.error?.message || body || `Gemini request failed with HTTP ${statusCode}.`;
  const details = parsedBody?.error?.details;
  const category = classifyGeminiError(statusCode, providerStatus, message, details);

  return new LLMProviderError({
    provider: "gemini",
    requestedModel,
    statusCode,
    providerStatus,
    category,
    retryable: isRetryableStatus(statusCode),
    technicalMessage: `Gemini request failed (${statusCode}${providerStatus ? ` ${providerStatus}` : ""}): ${message}`,
    rawBody: body,
    details,
    helpLinks: extractHelpLinks(details)
  });
}

function createGeminiNetworkError(error: unknown, requestedModel: string): LLMProviderError {
  const technicalMessage = error instanceof Error ? error.message : "Gemini request failed due to network error.";

  return new LLMProviderError({
    provider: "gemini",
    requestedModel,
    category: "network",
    retryable: true,
    technicalMessage
  });
}

function retryLabel(error: Error): string {
  if (error instanceof LLMProviderError) {
    return error.statusCode !== undefined ? String(error.statusCode) : error.category;
  }

  return "network";
}

export class GeminiRetryError extends Error {
  readonly retryLog: string[];
  readonly causeError?: LLMProviderError;

  constructor(message: string, retryLog: string[], causeError?: LLMProviderError) {
    super(message);
    this.name = "GeminiRetryError";
    this.retryLog = retryLog;
    this.causeError = causeError;
  }
}

export class GeminiProvider implements LLMProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {
    if (!this.apiKey.trim()) {
      throw new LLMProviderError({
        provider: "gemini",
        requestedModel: this.model,
        category: "missing_api_key",
        retryable: false,
        technicalMessage: "GEMINI_API_KEY is not set."
      });
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
          const geminiError = createGeminiError(response.status, errorBody, this.model);

          if (!isRetryableStatus(response.status)) {
            throw geminiError;
          }

          lastError = geminiError;
        } else {
          const data = (await response.json()) as {
            modelVersion?: string;
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

          return {
            text,
            provider: "gemini",
            requestedModel: this.model,
            modelVersion: data.modelVersion,
            ...(retryLog.length > 0 ? { retryLog } : {})
          };
        }
      } catch (error) {
        if (isAbortError(error)) {
          throw error;
        }

        if (error instanceof LLMProviderError) {
          lastError = error;

          if (!error.retryable) {
            throw error;
          }
        } else if (
          error instanceof Error &&
          error.message === "Gemini response did not include generated text."
        ) {
          throw new LLMProviderError({
            provider: "gemini",
            requestedModel: this.model,
            category: "empty_response",
            retryable: false,
            technicalMessage: error.message
          });
        } else {
          lastError = createGeminiNetworkError(error, this.model);
        }
      }

      if (attempt < MAX_RETRIES) {
        const retryCount = attempt + 1;
        const retryMessage = `Retry ${retryCount}/${MAX_RETRIES} after Gemini error ${lastError ? retryLabel(lastError) : "network"}`;
        retryLog.push(retryMessage);
        console.warn(retryMessage);
        await delay(RETRY_DELAYS_MS[attempt], options?.signal);
        continue;
      }

      break;
    }

    const retryCause = lastError instanceof LLMProviderError ? lastError : undefined;
    const finalMessage = retryCause?.statusCode !== undefined
      ? `Gemini request failed after ${MAX_RETRIES} retries (HTTP ${retryCause.statusCode})`
      : `Gemini request failed after ${MAX_RETRIES} retries (${retryCause?.category ?? "network error"})`;

    throw new GeminiRetryError(finalMessage, retryLog, retryCause);
  }
}
