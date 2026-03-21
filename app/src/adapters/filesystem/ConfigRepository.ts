import { invoke } from "@tauri-apps/api/core";

export type ConversionMode = "quality" | "fast";

export type AppConfig = {
  geminiApiKey: string | null;
  lastSongbookPath?: string;
  conversionMode?: ConversionMode;
  playgroundModel?: string;
};

export const DEFAULT_APP_CONFIG: AppConfig = {
  geminiApiKey: null
};

function normalizeConfig(config: Partial<AppConfig> | null | undefined): AppConfig {
  return {
    ...DEFAULT_APP_CONFIG,
    ...(config ?? {}),
    geminiApiKey: typeof config?.geminiApiKey === "string" && config.geminiApiKey.trim().length > 0
      ? config.geminiApiKey.trim()
      : null
  };
}

export class ConfigRepository {
  async load(): Promise<AppConfig> {
    const config = await invoke<Partial<AppConfig>>("read_config");
    return normalizeConfig(config);
  }

  async save(config: AppConfig): Promise<AppConfig> {
    const persisted = await invoke<Partial<AppConfig>>("write_config", {
      config: normalizeConfig(config)
    });

    return normalizeConfig(persisted);
  }
}
