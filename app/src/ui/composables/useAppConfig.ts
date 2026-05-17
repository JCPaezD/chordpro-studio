import { computed, ref, type ComputedRef, type Ref } from "vue";

import {
  ConfigRepository,
  DEFAULT_APP_CONFIG,
  type AppConfig,
  type ChordDiagramInstrument,
  type LastActiveMainView,
  type ConversionMode,
  type PlaygroundPanelVisibility,
  type WindowState
} from "../../adapters/filesystem/ConfigRepository";

export type AppConfigStore = {
  apiKey: ComputedRef<string | null>;
  loading: Ref<boolean>;
  conversionMode: ComputedRef<ConversionMode | undefined>;
  playgroundModel: ComputedRef<string | undefined>;
  playgroundPanelVisibility: ComputedRef<PlaygroundPanelVisibility>;
  lastActiveMainView: ComputedRef<LastActiveMainView | undefined>;
  showChordDiagrams: ComputedRef<boolean>;
  instrument: ComputedRef<ChordDiagramInstrument>;
  windowState: ComputedRef<WindowState | null>;
  lastSongbookPath: ComputedRef<string | undefined>;
  lastOpenedSongPath: ComputedRef<string | null>;
  loadConfig(): Promise<void>;
  setApiKey(key: string): Promise<void>;
  clearApiKey(): Promise<void>;
  setConversionMode(mode: ConversionMode): Promise<void>;
  setPlaygroundModel(model: string): Promise<void>;
  setPlaygroundPanelVisibility(value: PlaygroundPanelVisibility): Promise<void>;
  setLastActiveMainView(value: LastActiveMainView): Promise<void>;
  setShowChordDiagrams(value: boolean): Promise<void>;
  setInstrument(value: ChordDiagramInstrument): Promise<void>;
  setWindowState(value: WindowState): Promise<void>;
  setLastSongbookPath(path: string): Promise<void>;
  clearLastSongbookPath(): Promise<void>;
  setLastOpenedSongPath(path: string): Promise<void>;
  clearLastOpenedSongPath(): Promise<void>;
};

const repository = new ConfigRepository();
const config = ref<AppConfig>({ ...DEFAULT_APP_CONFIG });
const loading = ref(true);
let loadPromise: Promise<void> | null = null;

async function persistConfig(nextConfig: AppConfig): Promise<void> {
  config.value = await repository.save(nextConfig);
}

async function updateConfig(partial: Partial<AppConfig>): Promise<void> {
  await persistConfig({
    ...config.value,
    ...partial
  });
}

async function loadConfig(): Promise<void> {
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    loading.value = true;

    try {
      config.value = await repository.load();
    } catch (err) {
      console.error("Could not load app config.", err);
      config.value = { ...DEFAULT_APP_CONFIG };
    } finally {
      loading.value = false;
      loadPromise = null;
    }
  })();

  return loadPromise;
}

async function setApiKey(key: string): Promise<void> {
  const normalizedKey = key.trim();

  await updateConfig({
    geminiApiKey: normalizedKey.length > 0 ? normalizedKey : null
  });
}

async function clearApiKey(): Promise<void> {
  await updateConfig({ geminiApiKey: null });
}

async function setConversionMode(mode: ConversionMode): Promise<void> {
  await updateConfig({ conversionMode: mode });
}

async function setPlaygroundModel(model: string): Promise<void> {
  await updateConfig({ playgroundModel: model });
}

async function setPlaygroundPanelVisibility(value: PlaygroundPanelVisibility): Promise<void> {
  await updateConfig({ playgroundPanelVisibility: { ...value } });
}

async function setLastActiveMainView(value: LastActiveMainView): Promise<void> {
  await updateConfig({ lastActiveMainView: value });
}

async function setShowChordDiagrams(value: boolean): Promise<void> {
  await updateConfig({ showChordDiagrams: value });
}

async function setInstrument(value: ChordDiagramInstrument): Promise<void> {
  await updateConfig({ instrument: value });
}

async function setWindowState(value: WindowState): Promise<void> {
  await updateConfig({ windowState: { ...value } });
}

async function setLastSongbookPath(path: string): Promise<void> {
  await updateConfig({ lastSongbookPath: path });
}

async function clearLastSongbookPath(): Promise<void> {
  const nextConfig: AppConfig = { ...config.value };
  delete nextConfig.lastSongbookPath;
  await persistConfig(nextConfig);
}

async function setLastOpenedSongPath(path: string): Promise<void> {
  const normalizedPath = path.trim();
  await updateConfig({ lastOpenedSongPath: normalizedPath.length > 0 ? normalizedPath : null });
}

async function clearLastOpenedSongPath(): Promise<void> {
  await updateConfig({ lastOpenedSongPath: null });
}

export function useAppConfig(): AppConfigStore {
  return {
    apiKey: computed(() => config.value.geminiApiKey),
    loading,
    conversionMode: computed(() => config.value.conversionMode),
    playgroundModel: computed(() => config.value.playgroundModel),
    playgroundPanelVisibility: computed(() => config.value.playgroundPanelVisibility ?? { ...DEFAULT_APP_CONFIG.playgroundPanelVisibility! }),
    lastActiveMainView: computed(() => config.value.lastActiveMainView),
    showChordDiagrams: computed(() => config.value.showChordDiagrams ?? true),
    instrument: computed(() => config.value.instrument ?? "piano"),
    windowState: computed(() => config.value.windowState ?? null),
    lastSongbookPath: computed(() => config.value.lastSongbookPath),
    lastOpenedSongPath: computed(() => config.value.lastOpenedSongPath),
    loadConfig,
    setApiKey,
    clearApiKey,
    setConversionMode,
    setPlaygroundModel,
    setPlaygroundPanelVisibility,
    setLastActiveMainView,
    setShowChordDiagrams,
    setInstrument,
    setWindowState,
    setLastSongbookPath,
    clearLastSongbookPath,
    setLastOpenedSongPath,
    clearLastOpenedSongPath
  };
}
