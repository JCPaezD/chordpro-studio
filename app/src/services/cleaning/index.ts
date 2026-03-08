import type { CleaningService } from "../contracts";

export const cleaningServicePlaceholder: CleaningService = {
  async clean(input: string): Promise<string> {
    return input;
  }
};
