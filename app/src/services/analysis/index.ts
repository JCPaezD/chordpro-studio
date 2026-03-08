import type { AnalysisService } from "../contracts";

export const analysisServicePlaceholder: AnalysisService = {
  async analyze(): Promise<string[]> {
    return [];
  }
};
