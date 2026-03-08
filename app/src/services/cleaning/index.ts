import type { CleaningService } from "../contracts";
import { CleaningService as LocalCleaningService } from "./CleaningService";

const cleaningService = new LocalCleaningService();
export const cleaningServicePlaceholder: CleaningService = {
  async clean(input: string): Promise<string> {
    return cleaningService.clean(input);
  }
};

export { CleaningService } from "./CleaningService";
