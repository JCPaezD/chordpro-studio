export interface LLMGenerateResult {
  text: string;
  retryLog?: string[];
}

export interface LLMGenerateOptions {
  signal?: AbortSignal;
}

export interface LLMProvider {
  generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMGenerateResult>;
}
