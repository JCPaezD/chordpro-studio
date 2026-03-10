export interface LLMGenerateResult {
  text: string;
  retryLog?: string[];
}

export interface LLMProvider {
  generate(prompt: string): Promise<LLMGenerateResult>;
}
