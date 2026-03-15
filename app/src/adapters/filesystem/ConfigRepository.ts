import { BaseDirectory, exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

export type AppConfig = {
  lastSongbookPath?: string;
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
    await this.ensureConfigDirectory();

    const hasConfig = await exists(CONFIG_FILE_NAME, { baseDir: BaseDirectory.AppConfig });

    if (!hasConfig) {
      const config: AppConfig = {};
      await this.save(config);
      return config;
    }

    try {
      const rawConfig = await readTextFile(CONFIG_FILE_NAME, { baseDir: BaseDirectory.AppConfig });
      const parsed = JSON.parse(rawConfig) as AppConfig;
      return typeof parsed === "object" && parsed ? parsed : {};
    } catch {
      const config: AppConfig = {};
      await this.save(config);
      return config;
    }
  }

  async save(config: AppConfig): Promise<void> {
    await this.ensureConfigDirectory();

    await writeTextFile(CONFIG_FILE_NAME, JSON.stringify(config, null, 2), {
      baseDir: BaseDirectory.AppConfig
    });
  }
}
