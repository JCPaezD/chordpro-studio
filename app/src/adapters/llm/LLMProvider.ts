export interface LLMGenerateResult {
  text: string;
  provider?: LLMProviderName;
  requestedModel?: string;
  modelVersion?: string;
  retryLog?: string[];
}

export interface LLMGenerateOptions {
  signal?: AbortSignal;
}

export interface LLMProvider {
  generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMGenerateResult>;
}

export type LLMProviderName = "gemini" | "openai";

export type LLMErrorCategory =
  | "missing_api_key"
  | "invalid_api_key"
  | "permission"
  | "invalid_request"
  | "model_unavailable"
  | "rate_limit"
  | "quota"
  | "rate_or_quota"
  | "billing_or_tier"
  | "service_unavailable"
  | "timeout"
  | "network"
  | "empty_response"
  | "unknown";

export type LLMProviderErrorDetails = {
  provider: LLMProviderName;
  requestedModel?: string;
  statusCode?: number;
  providerStatus?: string;
  category: LLMErrorCategory;
  retryable: boolean;
  technicalMessage: string;
  rawBody?: string;
  details?: unknown;
  helpLinks?: string[];
};

export class LLMProviderError extends Error {
  readonly provider: LLMProviderName;
  readonly requestedModel?: string;
  readonly statusCode?: number;
  readonly providerStatus?: string;
  readonly category: LLMErrorCategory;
  readonly retryable: boolean;
  readonly technicalMessage: string;
  readonly rawBody?: string;
  readonly details?: unknown;
  readonly helpLinks: string[];

  constructor(details: LLMProviderErrorDetails) {
    super(details.technicalMessage);
    this.name = "LLMProviderError";
    this.provider = details.provider;
    this.requestedModel = details.requestedModel;
    this.statusCode = details.statusCode;
    this.providerStatus = details.providerStatus;
    this.category = details.category;
    this.retryable = details.retryable;
    this.technicalMessage = details.technicalMessage;
    this.rawBody = details.rawBody;
    this.details = details.details;
    this.helpLinks = details.helpLinks ?? [];
  }
}
