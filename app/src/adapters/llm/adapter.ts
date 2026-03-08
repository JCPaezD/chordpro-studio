export interface LlmAdapter {
  complete(prompt: string): Promise<string>;
}
