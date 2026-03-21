import { computed, ref, type ComputedRef, type Ref } from "vue";

import {
  ConfigRepository,
  DEFAULT_APP_CONFIG,
  type AppConfig,
  type ConversionMode
} from "../../adapters/filesystem/ConfigRepository";

export type AppConfigStore = {
  apiKey: ComputedRef<string | null>;
  loading: Ref<boolean>;
  conversionMode: ComputedRef<ConversionMode | undefined>;
  playgroundModel: ComputedRef<string | undefined>;
  lastSongbookPath: ComputedRef<string | undefined>;
  loadConfig(): Promise<void>;
  setApiKey(key: string): Promise<void>;
  clearApiKey(): Promise<void>;
  setConversionMode(mode: ConversionMode): Promise<void>;
  setPlaygroundModel(model: string): Promise<void>;
  setLastSongbookPath(path: string): Promise<void>;
  clearLastSongbookPath(): Promise<void>;
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

async function setLastSongbookPath(path: string): Promise<void> {
  await updateConfig({ lastSongbookPath: path });
}

async function clearLastSongbookPath(): Promise<void> {
  const nextConfig: AppConfig = { ...config.value };
  delete nextConfig.lastSongbookPath;
  await persistConfig(nextConfig);
}

export function useAppConfig(): AppConfigStore {
  return {
    apiKey: computed(() => config.value.geminiApiKey),
    loading,
    conversionMode: computed(() => config.value.conversionMode),
    playgroundModel: computed(() => config.value.playgroundModel),
    lastSongbookPath: computed(() => config.value.lastSongbookPath),
    loadConfig,
    setApiKey,
    clearApiKey,
    setConversionMode,
    setPlaygroundModel,
    setLastSongbookPath,
    clearLastSongbookPath
  };
}
