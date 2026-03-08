import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export class PromptLoader {
  private readonly cache = new Map<string, string>();
  private readonly promptDirectories: string[];

  constructor(promptDirectory?: string) {
    const localPromptsDir = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../prompts"
    );
    const cwdPromptsDir = path.resolve(process.cwd(), "app/prompts");

    this.promptDirectories = [
      ...(promptDirectory ? [promptDirectory] : []),
      ...(process.env.CHORDPRO_PROMPTS_DIR ? [process.env.CHORDPRO_PROMPTS_DIR] : []),
      cwdPromptsDir,
      localPromptsDir
    ];
  }

  async loadPrompt(name: string): Promise<string> {
    const normalizedName = this.normalizePromptName(name);
    const cachedPrompt = this.cache.get(normalizedName);
    if (cachedPrompt !== undefined) {
      return cachedPrompt;
    }

    const fileName = `${normalizedName}.prompt.md`;
    const promptPath = await this.resolvePromptPath(fileName);
    const prompt = await readFile(promptPath, "utf8");

    this.cache.set(normalizedName, prompt);
    return prompt;
  }

  async renderPrompt(
    name: string,
    variables: Record<string, string>
  ): Promise<string> {
    const template = await this.loadPrompt(name);

    return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, variableName) => {
      return Object.prototype.hasOwnProperty.call(variables, variableName)
        ? variables[variableName]
        : match;
    });
  }

  private normalizePromptName(name: string): string {
    const normalized = name.trim().replace(/\.prompt\.md$/i, "");
    if (!normalized) {
      throw new Error("Prompt name cannot be empty.");
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(normalized)) {
      throw new Error(`Invalid prompt name: "${name}".`);
    }

    return normalized;
  }

  private async resolvePromptPath(fileName: string): Promise<string> {
    for (const directory of this.promptDirectories) {
      const fullPath = path.resolve(directory, fileName);
      try {
        await access(fullPath);
        return fullPath;
      } catch {
        // Try next candidate directory.
      }
    }

    throw new Error(
      `Prompt file "${fileName}" not found in: ${this.promptDirectories.join(", ")}`
    );
  }
}
