import { BaseDirectory, exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

export type ConversionMode = "quality" | "fast";

export type AppConfig = {
  lastSongbookPath?: string;
  conversionMode?: ConversionMode;
  playgroundModel?: string;
};

const CONFIG_FILE_NAME = "config.json";

export class ConfigRepository {
  private async ensureConfigDirectory(): Promise<void> {
    await mkdir("", {
      baseDir: BaseDirectory.AppConfig,
      recursive: true
    });
  }

  async load(): Promise<AppConfig> {
    const hasConfig = await exists(CONFIG_FILE_NAME, { baseDir: BaseDirectory.AppConfig });

    if (!hasConfig) {
      return {};
    }

    try {
      const rawConfig = await readTextFile(CONFIG_FILE_NAME, { baseDir: BaseDirectory.AppConfig });
      const parsed = JSON.parse(rawConfig) as AppConfig;
      return typeof parsed === "object" && parsed ? parsed : {};
    } catch {
      return {};
    }
  }

  async save(config: AppConfig): Promise<void> {
    await this.ensureConfigDirectory();

    await writeTextFile(CONFIG_FILE_NAME, JSON.stringify(config, null, 2), {
      baseDir: BaseDirectory.AppConfig
    });
  }

  async update(partial: Partial<AppConfig>): Promise<void> {
    const currentConfig = await this.load();
    await this.save({
      ...currentConfig,
      ...partial
    });
  }

  async remove<K extends keyof AppConfig>(...keys: K[]): Promise<void> {
    const currentConfig = await this.load();

    for (const key of keys) {
      delete currentConfig[key];
    }

    await this.save(currentConfig);
  }
}
