const bundledPrompts = import.meta.glob("../../prompts/*.prompt.md", {
  query: "?raw",
  import: "default",
  eager: true
}) as Record<string, string>;

export class PromptLoader {
  private readonly cache = new Map<string, string>();
  private readonly promptDirectories: string[];

  constructor(promptDirectory?: string) {
    this.promptDirectories = [
      ...(promptDirectory ? [promptDirectory] : []),
      ...this.resolveEnvPromptDirectory(),
      ...this.resolveCwdPromptDirectory()
    ];
  }

  async loadPrompt(name: string): Promise<string> {
    const normalizedName = this.normalizePromptName(name);
    const cachedPrompt = this.cache.get(normalizedName);
    if (cachedPrompt !== undefined) {
      return cachedPrompt;
    }

    const fileName = `${normalizedName}.prompt.md`;
    const prompt = await this.resolvePromptContent(fileName);

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

  private resolveEnvPromptDirectory(): string[] {
    const envValue = (
      globalThis as { process?: { env?: Record<string, string | undefined> } }
    ).process?.env?.CHORDPRO_PROMPTS_DIR;

    return envValue ? [envValue] : [];
  }

  private resolveCwdPromptDirectory(): string[] {
    const cwd = (globalThis as { process?: { cwd?: () => string } }).process?.cwd?.();
    return cwd ? [`${cwd}/app/prompts`] : [];
  }

  private async resolvePromptContent(fileName: string): Promise<string> {
    const bundledKey = Object.keys(bundledPrompts).find((key) =>
      key.endsWith(`/${fileName}`)
    );
    if (bundledKey) {
      return bundledPrompts[bundledKey];
    }

    const fileSystemPrompt = await this.readFromFileSystem(fileName);
    if (fileSystemPrompt !== undefined) {
      return fileSystemPrompt;
    }

    throw new Error(`Prompt file "${fileName}" not found.`);
  }

  private async readFromFileSystem(fileName: string): Promise<string | undefined> {
    if (this.promptDirectories.length === 0) {
      return undefined;
    }

    let fsPromises: typeof import("node:fs/promises");
    for (const directory of this.promptDirectories) {
      try {
        fsPromises ??= await import("node:fs/promises");
        const fullPath = `${directory.replace(/[\\/]+$/g, "")}/${fileName}`;
        await fsPromises.access(fullPath);
        return await fsPromises.readFile(fullPath, "utf8");
      } catch {
        // Try next candidate directory.
      }
    }

    return undefined;
  }
}
