import { invoke } from "@tauri-apps/api/core";

export type ConversionMode = "quality" | "fast";
export type ChordDiagramInstrument = "guitar" | "piano" | "ukulele";
export type LastActiveMainView = "convert" | "songbook" | "performance";
export type PlaygroundPanelVisibility = {
  raw: boolean;
  cleaned: boolean;
  chordPro: boolean;
  json: boolean;
  preview: boolean;
};
export type WindowState = {
  x: number;
  y: number;
  width: number;
  height: number;
  maximized: boolean;
};

export type AppConfig = {
  geminiApiKey: string | null;
  lastSongbookPath?: string;
  lastOpenedSongPath: string | null;
  conversionMode?: ConversionMode;
  playgroundModel?: string;
  playgroundPanelVisibility?: PlaygroundPanelVisibility;
  lastActiveMainView?: LastActiveMainView;
  showChordDiagrams?: boolean;
  instrument?: ChordDiagramInstrument;
  windowState?: WindowState | null;
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

function normalizePositiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : fallback;
}

function normalizeInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : fallback;
}

function normalizeLastActiveMainView(value: unknown): LastActiveMainView | undefined {
  return value === "convert" || value === "songbook" || value === "performance"
    ? value
    : undefined;
}

function normalizeWindowState(value: Partial<WindowState> | null | undefined): WindowState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const width = normalizePositiveInteger(value.width, 0);
  const height = normalizePositiveInteger(value.height, 0);
  if (width <= 0 || height <= 0) {
    return null;
  }

  return {
    x: normalizeInteger(value.x, 0),
    y: normalizeInteger(value.y, 0),
    width,
    height,
    maximized: typeof value.maximized === "boolean" ? value.maximized : false
  };
}

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
    lastActiveMainView: normalizeLastActiveMainView(config?.lastActiveMainView),
    playgroundPanelVisibility: normalizePlaygroundPanelVisibility(config?.playgroundPanelVisibility),
    showChordDiagrams: typeof config?.showChordDiagrams === "boolean"
      ? config.showChordDiagrams
      : true,
    instrument: config?.instrument === "guitar" || config?.instrument === "piano" || config?.instrument === "ukulele"
      ? config.instrument
      : "piano",
    windowState: normalizeWindowState(config?.windowState)
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
