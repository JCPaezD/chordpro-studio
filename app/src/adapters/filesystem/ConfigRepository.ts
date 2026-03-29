import { invoke } from "@tauri-apps/api/core";

export type ConversionMode = "quality" | "fast";
export type ChordDiagramInstrument = "guitar" | "piano" | "ukulele";

export type AppConfig = {
  geminiApiKey: string | null;
  lastSongbookPath?: string;
  lastOpenedSongPath: string | null;
  conversionMode?: ConversionMode;
  playgroundModel?: string;
  showChordDiagrams?: boolean;
  instrument?: ChordDiagramInstrument;
};

export const DEFAULT_APP_CONFIG: AppConfig = {
  geminiApiKey: null,
  lastOpenedSongPath: null,
  showChordDiagrams: true,
  instrument: "piano"
};

function normalizeConfig(config: Partial<AppConfig> | null | undefined): AppConfig {
  return {
    ...DEFAULT_APP_CONFIG,
    ...(config ?? {}),
    geminiApiKey: typeof config?.geminiApiKey === "string" && config.geminiApiKey.trim().length > 0
      ? config.geminiApiKey.trim()
      : null,
    lastOpenedSongPath: typeof config?.lastOpenedSongPath === "string" && config.lastOpenedSongPath.trim().length > 0
      ? config.lastOpenedSongPath
      : null,
    showChordDiagrams: typeof config?.showChordDiagrams === "boolean"
      ? config.showChordDiagrams
      : true,
    instrument: config?.instrument === "guitar" || config?.instrument === "piano" || config?.instrument === "ukulele"
      ? config.instrument
      : "piano"
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
