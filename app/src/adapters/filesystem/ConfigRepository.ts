import { invoke } from "@tauri-apps/api/core";

export type ConversionMode = "quality" | "fast";
export type ChordDiagramInstrument = "guitar" | "piano" | "ukulele";
export type PlaygroundPanelVisibility = {
  raw: boolean;
  cleaned: boolean;
  chordPro: boolean;
  json: boolean;
  preview: boolean;
};

export type AppConfig = {
  geminiApiKey: string | null;
  lastSongbookPath?: string;
  lastOpenedSongPath: string | null;
  conversionMode?: ConversionMode;
  playgroundModel?: string;
  playgroundPanelVisibility?: PlaygroundPanelVisibility;
  showChordDiagrams?: boolean;
  instrument?: ChordDiagramInstrument;
};

export const DEFAULT_PLAYGROUND_PANEL_VISIBILITY: PlaygroundPanelVisibility = {
  raw: true,
  cleaned: true,
  chordPro: true,
  json: true,
  preview: true
};

export const DEFAULT_APP_CONFIG: AppConfig = {
  geminiApiKey: null,
  lastOpenedSongPath: null,
  playgroundPanelVisibility: { ...DEFAULT_PLAYGROUND_PANEL_VISIBILITY },
  showChordDiagrams: true,
  instrument: "piano"
};

function normalizePlaygroundPanelVisibility(
  value: Partial<PlaygroundPanelVisibility> | null | undefined
): PlaygroundPanelVisibility {
  return {
    raw: typeof value?.raw === "boolean" ? value.raw : true,
    cleaned: typeof value?.cleaned === "boolean" ? value.cleaned : true,
    chordPro: typeof value?.chordPro === "boolean" ? value.chordPro : true,
    json: typeof value?.json === "boolean" ? value.json : true,
    preview: typeof value?.preview === "boolean" ? value.preview : true
  };
}

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
    playgroundPanelVisibility: normalizePlaygroundPanelVisibility(config?.playgroundPanelVisibility),
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
