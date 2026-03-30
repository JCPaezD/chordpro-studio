<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

import { isTauri } from "@tauri-apps/api/core";
import appLogo from "../assets/logo-64.png";
import ChordProEditorPane from "../components/ChordProEditorPane.vue";
import LoadingOverlayCard from "../components/LoadingOverlayCard.vue";
import SongList from "../components/SongList.vue";
import SongbookPerformanceMode from "../components/SongbookPerformanceMode.vue";
import {
  type ChordDiagramInstrument,
  type ConversionMode
} from "../../adapters/filesystem/ConfigRepository";
import { useAppConfig } from "../composables/useAppConfig";
import { usePdfFit } from "../composables/usePdfFit";
import { useSongWorkspace } from "../composables/useSongWorkspace";

type ChordProEditorPaneExpose = {
  scrollToTop: () => void;
};

type SongListExpose = {
  focus: () => void;
  getRootElement: () => HTMLElement | null;
  getItemElement: (index: number) => HTMLButtonElement | null;
};

const props = defineProps<{
  mode: "user" | "playground";
}>();

const emit = defineEmits<{
  "change-mode": [mode: "user" | "playground"];
  "immersive-change": [value: boolean];
}>();

const isDev = import.meta.env.DEV;
const appConfig = useAppConfig();
const {
  activePanel,
  rawInput,
  chordProText,
  loading,
  isGeneratingPreview,
  isRefreshingPreview,
  isManualPreviewRefresh,
  isExportingSongbook,
  error,
  previewSrc,
  previewError,
  document: workspaceDocument,
  songMetadata,
  songbook,
  songbookError,
  selectedSongPath,
  pasteFromClipboard,
  requestClearAllState,
  exportCurrent,
  exportSongbookPdf,
  runPipeline,
  abortConversion,
  previewFromChordPro,
  openSongbookFolder,
  refreshSongbook,
  clearSongbook,
  openSongFile,
  saveDocument,
  setChordProText,
  setActivePanel
} = useSongWorkspace();

type PreviewFrameId = "A" | "B";
type SongbookSortField = "title" | "artist";
type SongbookSortDirection = "asc" | "desc";
type InputSource = "keyboard" | "mouse";

const PREVIEW_FRAME_SWAP_DELAY_MS = 100;
const PREVIEW_FRAME_TRANSITION_MS = 180;
const PREVIEW_LOADING_INDICATOR_DELAY_MS = 150;

const isPerformanceMode = ref(false);
const showChordProEditor = ref(false);
const showApiKeyModal = ref(false);
const apiKeyDraft = ref("");
const apiKeyFeedback = ref("");
const isSavingApiKey = ref(false);
const showPreferencesMenu = ref(false);
const preferencesButtonRef = ref<HTMLElement | null>(null);
const preferencesPanelRef = ref<HTMLElement | null>(null);
const activePreviewFrame = ref<PreviewFrameId>("A");
const pendingPreviewFrame = ref<PreviewFrameId | null>(null);
const previewFrameSrcA = ref("");
const previewFrameSrcB = ref("");
let previewFrameCleanupTimerA: ReturnType<typeof setTimeout> | null = null;
let previewFrameCleanupTimerB: ReturnType<typeof setTimeout> | null = null;
let previewFrameSwapTimer: ReturnType<typeof setTimeout> | null = null;
let previewFrameSwapToken = 0;

const conversionMode = computed<ConversionMode>(() => appConfig.conversionMode.value ?? "quality");
const configLoading = computed(() => appConfig.loading.value);
const hasApiKey = computed(() => !!appConfig.apiKey.value);
const showChordDiagrams = computed(() => appConfig.showChordDiagrams.value);
const chordDiagramInstrument = computed(() => appConfig.instrument.value);
const canGenerate = computed(() => !configLoading.value && hasApiKey.value && !loading.value);

const selectedModel = computed(() =>
  conversionMode.value === "fast" ? "gemini-flash-lite-latest" : "gemini-flash-latest"
);

const conversionModeLabel = computed(() =>
  conversionMode.value === "fast" ? "Fast" : "Quality"
);

const apiKeyButtonLabel = computed(() => (hasApiKey.value ? "Change API Key" : "Set API Key"));

const songbookEditorTitle = computed(() => {
  const title = songMetadata.value.title?.trim();
  const artist = songMetadata.value.artist?.trim();

  if (title && artist) {
    return `${title} - ${artist}`;
  }

  return title || artist || workspaceDocument.value.fileName || "ChordPro source";
});

const songbookEditorSubtitle = computed(() =>
  workspaceDocument.value.fileName || "Open a song from the list to edit its `.cho` content."
);
const songbookHeaderLabel = computed(() => {
  const path = songbook.value?.path?.trim();
  if (!path) {
    return "Songs";
  }

  const normalizedPath = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const parts = normalizedPath.split("/");
  return parts[parts.length - 1] || "Songs";
});

const hasBufferedPreview = computed(() => !!previewFrameSrcA.value || !!previewFrameSrcB.value);
const songbookSongs = computed(() => songbook.value?.songs ?? []);
const songbookSortField = ref<SongbookSortField>("artist");
const songbookSortDirection = ref<SongbookSortDirection>("asc");
const songbookListItems = computed(() => {
  const items = songbookSongs.value.map((songEntry) => {
    const separatorIndex = songEntry.displayTitle.lastIndexOf(" - ");
    const normalizedPath = songEntry.filePath.replace(/\\/g, "/");
    const pathParts = normalizedPath.split("/");
    const fallbackName = pathParts[pathParts.length - 1] || normalizedPath;

    if (separatorIndex < 0) {
      return {
        ...songEntry,
        title: songEntry.displayTitle,
        artist: "",
        fallbackName
      };
    }

    return {
      ...songEntry,
      title: songEntry.displayTitle.slice(0, separatorIndex).trim(),
      artist: songEntry.displayTitle.slice(separatorIndex + 3).trim(),
      fallbackName
    };
  });

  const primaryField = songbookSortField.value;
  const secondaryField = primaryField === "artist" ? "title" : "artist";
  const directionMultiplier = songbookSortDirection.value === "asc" ? 1 : -1;

  return [...items].sort((left, right) => {
    const primaryComparison =
      compareSongbookSortValues(left[primaryField], right[primaryField]) * directionMultiplier;
    if (primaryComparison !== 0) {
      return primaryComparison;
    }

    const secondaryComparison = compareSongbookSortValues(left[secondaryField], right[secondaryField]);
    if (secondaryComparison !== 0) {
      return secondaryComparison;
    }

    return compareSongbookSortValues(left.fallbackName, right.fallbackName);
  });
});
const currentSongbookIndex = computed(() => {
  const songs = songbookListItems.value;
  if (!selectedSongPath.value) {
    return -1;
  }

  return songs.findIndex((songEntry) => songEntry.filePath === selectedSongPath.value);
});
const songListRef = ref<SongListExpose | null>(null);
const songbookEditorPaneRef = ref<ChordProEditorPaneExpose | null>(null);
const previewViewerRef = ref<HTMLElement | null>(null);
const { applyFit: applyPreviewFit, scheduleFitUpdate: schedulePreviewFitUpdate } = usePdfFit(previewViewerRef);
const viewerFrameSrcA = computed(() => applyPreviewFit(previewFrameSrcA.value));
const viewerFrameSrcB = computed(() => applyPreviewFit(previewFrameSrcB.value));
const songbookSelectionPath = ref<string | null>(null);
const songListLastInputSource = ref<InputSource>("mouse");
const currentSongbookSelectionIndex = computed(() => {
  const items = songbookListItems.value;
  if (!songbookSelectionPath.value) {
    return -1;
  }

  return items.findIndex((songEntry) => songEntry.filePath === songbookSelectionPath.value);
});
const showPreviewLoadingIndicator = ref(false);
let previewLoadingIndicatorTimer: ReturnType<typeof setTimeout> | null = null;

function compareSongbookSortValues(left: string, right: string): number {
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

function getInactivePreviewFrame(frame: PreviewFrameId): PreviewFrameId {
  return frame === "A" ? "B" : "A";
}

function getPreviewFrameSrc(frame: PreviewFrameId): string {
  return frame === "A" ? previewFrameSrcA.value : previewFrameSrcB.value;
}

function setPreviewFrameSrc(frame: PreviewFrameId, value: string): void {
  if (frame === "A") {
    previewFrameSrcA.value = value;
    return;
  }

  previewFrameSrcB.value = value;
}

function revokeBlobUrl(url: string): void {
  if (url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

function clearPreviewFrameCleanup(frame: PreviewFrameId): void {
  if (frame === "A" && previewFrameCleanupTimerA !== null) {
    clearTimeout(previewFrameCleanupTimerA);
    previewFrameCleanupTimerA = null;
    return;
  }

  if (frame === "B" && previewFrameCleanupTimerB !== null) {
    clearTimeout(previewFrameCleanupTimerB);
    previewFrameCleanupTimerB = null;
  }
}

function releasePreviewFrame(frame: PreviewFrameId, options?: { preserveUrl?: string }): void {
  const url = getPreviewFrameSrc(frame);
  if (!url) {
    return;
  }

  setPreviewFrameSrc(frame, "");

  if (url === options?.preserveUrl) {
    return;
  }

  if (url !== getPreviewFrameSrc(getInactivePreviewFrame(frame))) {
    revokeBlobUrl(url);
  }
}

function cancelPendingPreviewSwap(): void {
  previewFrameSwapToken += 1;

  if (previewFrameSwapTimer !== null) {
    clearTimeout(previewFrameSwapTimer);
    previewFrameSwapTimer = null;
  }
}

function schedulePreviewFrameRelease(frame: PreviewFrameId): void {
  clearPreviewFrameCleanup(frame);

  const timer = setTimeout(() => {
    releasePreviewFrame(frame);

    if (frame === "A") {
      previewFrameCleanupTimerA = null;
    } else {
      previewFrameCleanupTimerB = null;
    }
  }, PREVIEW_FRAME_TRANSITION_MS);

  if (frame === "A") {
    previewFrameCleanupTimerA = timer;
    return;
  }

  previewFrameCleanupTimerB = timer;
}

function clearAllPreviewFrames(options?: { preserveUrl?: string }): void {
  cancelPendingPreviewSwap();
  clearPreviewFrameCleanup("A");
  clearPreviewFrameCleanup("B");
  releasePreviewFrame("A", options);
  releasePreviewFrame("B", options);
  pendingPreviewFrame.value = null;
  activePreviewFrame.value = "A";
}
function handlePreviewFrameLoad(frame: PreviewFrameId): void {
  schedulePreviewFitUpdate();

  if (pendingPreviewFrame.value !== frame) {
    return;
  }

  cancelPendingPreviewSwap();

  const previousActiveFrame = activePreviewFrame.value;

  if (previousActiveFrame === frame) {
    pendingPreviewFrame.value = null;
    return;
  }

  const swapToken = previewFrameSwapToken + 1;
  previewFrameSwapToken = swapToken;
  previewFrameSwapTimer = setTimeout(() => {
    if (pendingPreviewFrame.value !== frame || previewFrameSwapToken !== swapToken) {
      return;
    }

    activePreviewFrame.value = frame;
    pendingPreviewFrame.value = null;
    previewFrameSwapTimer = null;
    schedulePreviewFrameRelease(previousActiveFrame);
  }, PREVIEW_FRAME_SWAP_DELAY_MS);
}

watch(isGeneratingPreview, (value) => {
  if (previewLoadingIndicatorTimer !== null) {
    clearTimeout(previewLoadingIndicatorTimer);
    previewLoadingIndicatorTimer = null;
  }

  if (value) {
    if (isManualPreviewRefresh.value) {
      showPreviewLoadingIndicator.value = true;
      return;
    }

    previewLoadingIndicatorTimer = setTimeout(() => {
      showPreviewLoadingIndicator.value = true;
      previewLoadingIndicatorTimer = null;
    }, PREVIEW_LOADING_INDICATOR_DELAY_MS);
    return;
  }

  showPreviewLoadingIndicator.value = false;
}, { immediate: true });

watch(previewSrc, (nextUrl) => {
  if (isPerformanceMode.value) {
    return;
  }

  cancelPendingPreviewSwap();

  if (!nextUrl) {
    clearAllPreviewFrames();
    return;
  }

  const activeFrame = activePreviewFrame.value;
  const inactiveFrame = getInactivePreviewFrame(activeFrame);
  const activeUrl = getPreviewFrameSrc(activeFrame);
  const inactiveUrl = getPreviewFrameSrc(inactiveFrame);

  if (nextUrl === activeUrl || nextUrl === inactiveUrl) {
    return;
  }

  clearPreviewFrameCleanup(inactiveFrame);
  setPreviewFrameSrc(inactiveFrame, nextUrl);

  if (inactiveUrl && inactiveUrl !== activeUrl) {
    revokeBlobUrl(inactiveUrl);
  }

  pendingPreviewFrame.value = inactiveFrame;
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handlePreferencesPointerDown);
  window.removeEventListener("keydown", handleWindowKeydown);
  window.removeEventListener("keydown", handlePreferencesEscape);

  if (previewLoadingIndicatorTimer !== null) {
    clearTimeout(previewLoadingIndicatorTimer);
    previewLoadingIndicatorTimer = null;
  }

  clearAllPreviewFrames();
});

async function convertSong(): Promise<void> {
  if (!canGenerate.value) {
    return;
  }

  setActivePanel("convert");
  await runPipeline({ model: selectedModel.value });
}

function updateChordPro(value: string): void {
  setChordProText(value);
}

function enterPerformanceMode(): void {
  if (!songbook.value) {
    return;
  }

  setActivePanel("songbook");
  isPerformanceMode.value = true;
}

function exitPerformanceMode(): void {
  isPerformanceMode.value = false;
}

watch(isPerformanceMode, (value, previousValue) => {
  emit("immersive-change", value);

  if (previousValue && !value) {
    const preservedPreviewUrl = previewSrc.value;
    clearAllPreviewFrames({ preserveUrl: preservedPreviewUrl });

    if (preservedPreviewUrl) {
      const entryFrame = getInactivePreviewFrame(activePreviewFrame.value);
      setPreviewFrameSrc(entryFrame, preservedPreviewUrl);
      pendingPreviewFrame.value = entryFrame;
    }

    if (activePanel.value === "songbook" && selectedSongPath.value) {
      syncSongbookSelectionToActiveSong();
      scrollSongbookSelectionIntoView("auto");
    }
  }
}, { immediate: true });

onMounted(() => {
  document.addEventListener("pointerdown", handlePreferencesPointerDown);
  window.addEventListener("keydown", handleWindowKeydown);
  window.addEventListener("keydown", handlePreferencesEscape);

});


function syncSongbookSelection(): void {
  const songs = songbookListItems.value;

  if (songs.length === 0) {
    songbookSelectionPath.value = null;
    return;
  }

  const selectedIndex = selectedSongPath.value
    ? songs.findIndex((songEntry) => songEntry.filePath === selectedSongPath.value)
    : -1;

  if (selectedIndex >= 0) {
    songbookSelectionPath.value = songs[selectedIndex]?.filePath ?? null;
    return;
  }

  const currentSelectionIndex = currentSongbookSelectionIndex.value;
  if (currentSelectionIndex >= 0) {
    return;
  }

  songbookSelectionPath.value = songs[0]?.filePath ?? null;
}

function syncSongbookSelectionToActiveSong(): void {
  const songs = songbookListItems.value;

  if (songs.length === 0) {
    songbookSelectionPath.value = null;
    return;
  }

  const activeIndex = selectedSongPath.value
    ? songs.findIndex((songEntry) => songEntry.filePath === selectedSongPath.value)
    : -1;

  if (activeIndex >= 0) {
    songbookSelectionPath.value = songs[activeIndex]?.filePath ?? null;
    return;
  }

  songbookSelectionPath.value = songs[0]?.filePath ?? null;
}

function scrollSongbookSelectionIntoView(behavior: ScrollBehavior = "smooth"): void {
  const index = currentSongbookSelectionIndex.value;
  if (index < 0) {
    return;
  }

  void nextTick(() => {
    songListRef.value?.getItemElement(index)?.scrollIntoView({
      block: "nearest",
      behavior
    });
  });
}

function handleSongbookListFocus(): void {
  syncSongbookSelection();
}

function setSongbookSelectionByIndex(index: number): void {
  const songEntry = songbookListItems.value[index];
  songbookSelectionPath.value = songEntry?.filePath ?? null;
}

function handleSongListHover(filePath: string): void {
  if (songListLastInputSource.value !== "mouse") {
    return;
  }

  songbookSelectionPath.value = filePath;
}

function handleSongListMouseMove(filePath: string): void {
  songListLastInputSource.value = "mouse";
  songbookSelectionPath.value = filePath;
}

function handleSongListWheel(): void {
  songListLastInputSource.value = "mouse";
}

function handleSongListOpen(filePath: string): void {
  songListLastInputSource.value = "mouse";
  songbookSelectionPath.value = filePath;
  void openSongFromSongbook(filePath, { restoreListFocus: true });
}

function toggleSongbookSort(field: SongbookSortField): void {
  if (songbookSortField.value === field) {
    songbookSortDirection.value = songbookSortDirection.value === "asc" ? "desc" : "asc";
  } else {
    songbookSortField.value = field;
    songbookSortDirection.value = "asc";
  }

  void nextTick(() => {
    songListRef.value?.focus();
  });
}

function isInteractiveElement(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  if (element.isContentEditable) {
    return true;
  }

  return !!element.closest("input, textarea, button, select, option, iframe, a[href], summary, [contenteditable='true'], [contenteditable='']");
}

function handleSongbookNavigationKeydown(event: KeyboardEvent, options?: { restoreListFocus?: boolean }): void {
  const songs = songbookListItems.value;
  if (songs.length === 0) {
    return;
  }

  const selectedIndex = currentSongbookSelectionIndex.value >= 0 ? currentSongbookSelectionIndex.value : 0;

  if (event.key === "ArrowDown") {
    songListLastInputSource.value = "keyboard";
    event.preventDefault();
    event.stopPropagation();
    setSongbookSelectionByIndex(Math.min(selectedIndex + 1, songs.length - 1));
    scrollSongbookSelectionIntoView();
    return;
  }

  if (event.key === "ArrowUp") {
    songListLastInputSource.value = "keyboard";
    event.preventDefault();
    event.stopPropagation();
    setSongbookSelectionByIndex(Math.max(selectedIndex - 1, 0));
    scrollSongbookSelectionIntoView();
    return;
  }

  if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
    songListLastInputSource.value = "keyboard";
    event.preventDefault();
    event.stopPropagation();
    const selectedSong = songs[selectedIndex];
    if (selectedSong) {
      void openSongFromSongbook(selectedSong.filePath, { restoreListFocus: options?.restoreListFocus });
    }
  }
}

function handleSongbookListKeydown(event: KeyboardEvent): void {
  handleSongbookNavigationKeydown(event, { restoreListFocus: true });
}

watch(
  () => [songbook.value, selectedSongPath.value],
  () => {
    syncSongbookSelection();
  },
  { immediate: true }
);

watch(
  () => [songbookSortField.value, songbookSortDirection.value, activePanel.value, isPerformanceMode.value] as const,
  ([, , panel, performanceMode]) => {
    if (panel !== "songbook" || performanceMode) {
      return;
    }

    scrollSongbookSelectionIntoView("auto");
  }
);

watch(
  () => [activePanel.value, selectedSongPath.value] as const,
  ([panel, filePath], previousValue) => {
    if (panel !== "songbook" || isPerformanceMode.value) {
      return;
    }

    const [previousPanel, previousFilePath] = previousValue ?? [];
    const enteredSongbook = previousPanel !== "songbook";
    const selectedSongChanged = filePath !== previousFilePath;

    if ((enteredSongbook || selectedSongChanged) && filePath) {
      syncSongbookSelectionToActiveSong();
      scrollSongbookSelectionIntoView("auto");
    }
  },
  { immediate: true }
);

watch(
  () => selectedSongPath.value,
  async (filePath, previousFilePath) => {
    if (!filePath || filePath === previousFilePath) {
      return;
    }

    await nextTick();
    songbookEditorPaneRef.value?.scrollToTop();
  }
);



async function openSongFromSongbook(filePath: string, options?: { restoreListFocus?: boolean }): Promise<void> {
  await openSongFile(filePath);

  if (options?.restoreListFocus) {
    void nextTick(() => {
      songListRef.value?.focus();
    });
  }
}

async function openSongInPerformanceMode(filePath: string): Promise<void> {
  await openSongFile(filePath, { bypassUnsavedChanges: true });
}

function handleWindowKeydown(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return;
  }

  if (event.key === "F11") {
    if (!songbook.value) {
      return;
    }

    event.preventDefault();
    setActivePanel("songbook");
    isPerformanceMode.value = !isPerformanceMode.value;
    return;
  }

  if (activePanel.value !== "songbook" || isPerformanceMode.value) {
    return;
  }

  if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar") {
    return;
  }

  const eventTarget = event.target instanceof Element ? event.target : null;
  const activeElement = document.activeElement;
  const songListElement = songListRef.value?.getRootElement();

  if (songListElement?.contains(eventTarget) || songListElement?.contains(activeElement)) {
    return;
  }

  if (isInteractiveElement(eventTarget) || isInteractiveElement(activeElement)) {
    return;
  }

  handleSongbookNavigationKeydown(event);
}

function closePreferencesMenu(): void {
  showPreferencesMenu.value = false;
}

function togglePreferencesMenu(): void {
  showPreferencesMenu.value = !showPreferencesMenu.value;
}

async function toggleChordDiagramsPreference(): Promise<void> {
  await appConfig.setShowChordDiagrams(!showChordDiagrams.value);
}

async function setInstrumentPreference(value: ChordDiagramInstrument): Promise<void> {
  if (chordDiagramInstrument.value === value) {
    return;
  }

  await appConfig.setInstrument(value);
}

function handlePreferencesPointerDown(event: MouseEvent): void {
  const target = event.target instanceof Node ? event.target : null;
  if (!target) {
    return;
  }

  if (preferencesButtonRef.value?.contains(target) || preferencesPanelRef.value?.contains(target)) {
    return;
  }

  closePreferencesMenu();
}

function handlePreferencesEscape(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    closePreferencesMenu();
  }
}

async function toggleConversionMode(): Promise<void> {
  const nextMode: ConversionMode = conversionMode.value === "quality" ? "fast" : "quality";
  await appConfig.setConversionMode(nextMode);
}

function openApiKeyModal(): void {
  apiKeyDraft.value = appConfig.apiKey.value ?? "";
  apiKeyFeedback.value = "";
  showApiKeyModal.value = true;
}

function closeApiKeyModal(): void {
  if (isSavingApiKey.value) {
    return;
  }

  showApiKeyModal.value = false;
}

async function saveApiKey(): Promise<void> {
  if (!apiKeyDraft.value.trim()) {
    return;
  }

  isSavingApiKey.value = true;
  apiKeyFeedback.value = "";

  try {
    await appConfig.setApiKey(apiKeyDraft.value);
    showApiKeyModal.value = false;
  } catch (err) {
    apiKeyFeedback.value = err instanceof Error ? err.message : "Could not save API key.";
  } finally {
    isSavingApiKey.value = false;
  }
}

async function clearApiKey(): Promise<void> {
  isSavingApiKey.value = true;
  apiKeyFeedback.value = "";

  try {
    await appConfig.clearApiKey();
    apiKeyDraft.value = "";
    showApiKeyModal.value = false;
  } catch (err) {
    apiKeyFeedback.value = err instanceof Error ? err.message : "Could not clear API key.";
  } finally {
    isSavingApiKey.value = false;
  }
}
</script>

<template>
  <main class="user-view">
    <SongbookPerformanceMode
      v-if="isPerformanceMode"
      :songbook="songbook"
      :song-list-items="songbookListItems"
      :songbook-error="songbookError"
      :selected-song-path="selectedSongPath"
      :current-song-title="songbookEditorTitle"
      :is-generating-preview="isGeneratingPreview"
      :is-refreshing-preview="isRefreshingPreview"
      :preview-error="previewError"
      :preview-src="previewSrc"
      :open-song="openSongInPerformanceMode"
      :exit-performance-mode="exitPerformanceMode"
    />

    <template v-else>
    <header class="card user-header">
      <div class="header-copy">
        <div class="brand-lockup">
          <img :src="appLogo" alt="" class="brand-mark" />
          <span class="brand-title">ChordPro Studio</span>
        </div>
        <p v-if="isDev" class="eyebrow">Workspace</p>
        <h1>Convert songs and manage your ChordPro songbook</h1>
      </div>

      <div class="header-controls">
        <div v-if="isDev" class="view-toggle" role="tablist" aria-label="View mode">
          <button
            :class="['view-button', { active: props.mode === 'user' }]"
            @click="emit('change-mode', 'user')"
          >
            User
          </button>
          <button
            :class="['view-button', { active: props.mode === 'playground' }]"
            @click="emit('change-mode', 'playground')"
          >
            Playground
          </button>
        </div>
      </div>
    </header>

    <section class="user-main">
      <aside class="nav-rail" aria-label="User panels">
        <div class="nav-rail-main">
          <button
            :class="['nav-button', { active: activePanel === 'convert' }]"
            title="Convert"
            @click="setActivePanel('convert')"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 6h14M5 12h9M5 18h14" />
              <path d="M16 9l3 3-3 3" />
            </svg>
            <span>Convert</span>
          </button>
          <button
            :class="['nav-button', { active: activePanel === 'songbook' }]"
            title="Songbook"
            @click="setActivePanel('songbook')"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 4h10a2 2 0 0 1 2 2v12H8a2 2 0 0 0-2 2V4Z" />
              <path d="M8 18h10v2H8a2 2 0 0 1 0-4h10" />
            </svg>
            <span>Songbook</span>
          </button>        </div>

        <div class="nav-rail-footer">
          <button
            ref="preferencesButtonRef"
            :class="['nav-button', { active: showPreferencesMenu }]"
            title="Preferences"
            aria-haspopup="dialog"
            :aria-expanded="showPreferencesMenu ? 'true' : 'false'"
            @click="togglePreferencesMenu"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 8.25A3.75 3.75 0 1 0 12 15.75A3.75 3.75 0 1 0 12 8.25Z" />
              <path d="M19.14 12a7.53 7.53 0 0 0-.08-1l2.02-1.57-1.92-3.32-2.45.76a7.9 7.9 0 0 0-1.73-1l-.44-2.53h-3.84l-.44 2.53a7.9 7.9 0 0 0-1.73 1l-2.45-.76-1.92 3.32L4.94 11a7.53 7.53 0 0 0 0 2l-2.02 1.57 1.92 3.32 2.45-.76a7.9 7.9 0 0 0 1.73 1l.44 2.53h3.84l.44-2.53a7.9 7.9 0 0 0 1.73-1l2.45.76 1.92-3.32L19.06 13c.05-.33.08-.67.08-1Z" />
            </svg>
            <span>Prefs</span>
          </button>
          <Transition name="preferences-popover">
            <div v-if="showPreferencesMenu" ref="preferencesPanelRef" class="preferences-popover">
              <p class="preferences-heading">Preferences</p>
              <div class="preferences-item">
                <div class="preferences-item-copy">
                  <span class="preferences-item-label">Show chord diagrams</span>
                  <span class="preferences-item-value">{{ showChordDiagrams ? 'ON' : 'OFF' }}</span>
                </div>
                <button
                  class="preferences-switch"
                  type="button"
                  role="switch"
                  :aria-checked="showChordDiagrams"
                  :disabled="configLoading"
                  @click="toggleChordDiagramsPreference"
                >
                  <span :class="['preferences-switch-track', { on: showChordDiagrams }]">
                    <span class="preferences-switch-thumb" />
                  </span>
                </button>
              </div>
              <div class="preferences-item">
                <div class="preferences-item-copy">
                  <span class="preferences-item-label">Instrument</span>
                </div>
                <div
                  class="preferences-segmented-control"
                  role="group"
                  aria-label="Instrument"
                  :aria-disabled="configLoading"
                >
                  <button
                    class="preferences-segmented-option"
                    :class="{ active: chordDiagramInstrument === 'piano' }"
                    type="button"
                    :disabled="configLoading"
                    :aria-pressed="chordDiagramInstrument === 'piano'"
                    @click="setInstrumentPreference('piano')"
                  >
                    Piano
                  </button>
                  <button
                    class="preferences-segmented-option"
                    :class="{ active: chordDiagramInstrument === 'guitar' }"
                    type="button"
                    :disabled="configLoading"
                    :aria-pressed="chordDiagramInstrument === 'guitar'"
                    @click="setInstrumentPreference('guitar')"
                  >
                    Guitar
                  </button>
                  <button
                    class="preferences-segmented-option"
                    :class="{ active: chordDiagramInstrument === 'ukulele' }"
                    type="button"
                    :disabled="configLoading"
                    :aria-pressed="chordDiagramInstrument === 'ukulele'"
                    @click="setInstrumentPreference('ukulele')"
                  >
                    Ukulele
                  </button>
                </div>
              </div>
              </div>
            </Transition>
        </div>
      </aside>

      <section class="panel card workspace-panel">
        <div v-if="activePanel === 'convert'" class="panel-shell">
          <div class="panel-header secondary-header">
            <div>
              <p class="eyebrow">Convert</p>
              <h2>New sheet</h2>
            </div>
            <div class="panel-actions-stack align-end">
              <div class="header-actions convert-actions">
                <button class="mini-button" :disabled="loading || configLoading" @click="toggleConversionMode">
                  {{ conversionModeLabel }}
                </button>
                <button class="mini-button" @click="openApiKeyModal">
                  {{ apiKeyButtonLabel }}
                </button>
                <button class="mini-button" @click="showChordProEditor = !showChordProEditor">
                  {{ showChordProEditor ? "Hide ChordPro editor" : "Show ChordPro editor" }}
                </button>
                <button v-if="loading" class="primary-button" @click="abortConversion">
                  <span class="button-content">
                    <span class="button-label">Abort</span>
                  </span>
                </button>
                <button v-else class="primary-button" :disabled="!canGenerate" @click="convertSong">
                  <span class="button-content">
                    <span class="button-label">Generate</span>
                  </span>
                </button>
              </div>
              <p v-if="!hasApiKey && !configLoading" class="action-feedback warning-message">
                API key required to generate
              </p>
              <p v-if="error" class="action-feedback error-message">{{ error }}</p>
            </div>
          </div>

          <div class="panel-content">
            <div :class="['convert-layout', { split: showChordProEditor }]">
              <section class="editor-column">
                <div class="editor-heading convert-heading">
                  <div>
                    <h3>Original text</h3>
                  </div>
                  <div class="header-actions">
                    <button class="mini-button" @click="pasteFromClipboard">Paste</button>
                    <button class="secondary-button" :disabled="loading" @click="requestClearAllState">New Sheet</button>
                  </div>
                </div>

                <textarea
                  v-model="rawInput"
                  class="input-textarea editor-monospace"
                  placeholder="Paste the original song text here..."
                />
              </section>

              <section v-if="showChordProEditor" class="editor-column">
                <ChordProEditorPane
                  :model-value="chordProText"
                  :disabled="loading"
                  :loading="loading"
                  loading-message="Generating ChordPro..."
                  placeholder="ChordPro source will appear here after generation."
                  @update:model-value="updateChordPro"
                >
                  <template #header>
                    <div class="editor-heading convert-heading">
                      <div>
                        <h3>ChordPro source</h3>
                      </div>
                      <div class="header-actions">
                        <button class="mini-button" :disabled="loading || isGeneratingPreview || isRefreshingPreview || !isTauri() || !chordProText" @click="previewFromChordPro">
                          Refresh
                        </button>
                        <button class="mini-button" :disabled="!chordProText" @click="saveDocument">
                          Save
                        </button>
                      </div>
                    </div>
                  </template>
                </ChordProEditorPane>
              </section>
            </div>
          </div>
        </div>

        <div v-else class="panel-shell">
          <div class="panel-header secondary-header">
            <div>
              <p class="eyebrow">Songbook</p>
              <h2>Folder library</h2>
            </div>
            <div class="panel-actions-stack align-end">
              <div class="header-actions">
                <button class="mini-button" @click="openSongbookFolder">Open folder</button>
                <button class="mini-button" :disabled="!songbook" @click="refreshSongbook">Refresh</button>
                <button class="secondary-button" :disabled="!songbook" @click="clearSongbook">Clear</button>
                <button class="mini-button songbook-export-button" :disabled="!songbook || isExportingSongbook" @click="exportSongbookPdf">
                  {{ isExportingSongbook ? "Creating PDF..." : "Songbook PDF" }}
                </button>
                <button class="mini-button" :disabled="!songbook" @click="enterPerformanceMode">
                  Performance mode
                </button>
              </div>
              <p class="action-feedback songbook-path" :title="songbook?.path || 'No folder selected'">
                {{ songbook?.path || "No songbook folder selected." }}
              </p>
            </div>
            </div>

          <div class="panel-content songbook-content">
            <p v-if="songbookError" class="message error-message">{{ songbookError }}</p>

            <div v-if="songbook" class="songbook-layout">
              <aside class="song-list-panel">
                <div class="song-list-header">
                  <div class="song-list-title-row">
                    <h3 :title="songbook?.path || songbookHeaderLabel">{{ songbookHeaderLabel }}</h3>
                    <span class="song-count-badge">{{ songbook.songs.length }}</span>
                  </div>
                  <div class="song-list-header-actions">
                    <div class="song-sort-controls" aria-label="Songbook sorting controls">
                      <button
                        :class="['song-sort-button', { active: songbookSortField === 'title' }]"
                        type="button"
                        @click="toggleSongbookSort('title')"
                      >
                        <span>Title</span>
                        <span
                          :class="['song-sort-direction', { visible: songbookSortField === 'title' }]"
                          aria-hidden="true"
                        >
                          {{ songbookSortDirection === "asc" ? "↑" : "↓" }}
                        </span>
                      </button>
                      <button
                        :class="['song-sort-button', { active: songbookSortField === 'artist' }]"
                        type="button"
                        @click="toggleSongbookSort('artist')"
                      >
                        <span>Artist</span>
                        <span
                          :class="['song-sort-direction', { visible: songbookSortField === 'artist' }]"
                          aria-hidden="true"
                        >
                          {{ songbookSortDirection === "asc" ? "↑" : "↓" }}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
                <SongList
                  ref="songListRef"
                  :songs="songbookListItems"
                  :selected-song-path="songbookSelectionPath"
                  :active-song-path="selectedSongPath"
                  empty-message="No `.cho` files were found in this folder."
                  @focus="handleSongbookListFocus"
                  @keydown="handleSongbookListKeydown"
                  @hover="handleSongListHover"
                  @mousemove="handleSongListMouseMove"
                  @open="handleSongListOpen"
                  @wheel="handleSongListWheel"
                />
              </aside>

              <section class="editor-panel card-subsection">
                <div class="editor-heading">
                  <div>
                    <h3>{{ songbookEditorTitle }}</h3>
                    <p>
                      {{ songbookEditorSubtitle }}
                    </p>
                  </div>
                  <div class="editor-heading-aside">
                    <span v-if="workspaceDocument.dirty" class="dirty-badge">Unsaved changes</span>
                    <div class="header-actions">
                      <button class="mini-button" :disabled="!chordProText" @click="saveDocument">
                        Save
                      </button>
                      <button class="mini-button" :disabled="loading || isGeneratingPreview || isRefreshingPreview || !isTauri() || !chordProText" @click="previewFromChordPro">
                        Refresh
                      </button>
                    </div>
                  </div>
                </div>

                <ChordProEditorPane
                  ref="songbookEditorPaneRef"
                  :model-value="chordProText"
                  placeholder="Open a song from the list to edit it here."
                  @update:model-value="updateChordPro"
                />
              </section>
            </div>

            <div v-else class="songbook-empty-state">
              <div class="songbook-empty large songbook-start-state">
                <div class="empty-state-copy">
                  <h3>Open a folder to get started</h3>
                  <p>Build your songbook from .cho files</p>
                </div>
                <button class="mini-button empty-state-button" @click="openSongbookFolder">
                  Open folder
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="panel card preview-panel">
        <div class="panel-header secondary-header preview-header">
          <div>
            <p class="eyebrow">Preview</p>
            <h2>PDF preview</h2>
          </div>
          <div class="panel-actions-stack align-end">
            <div class="header-actions export-split-actions">
              <button class="mini-button export-action-button" :disabled="!isTauri() || !chordProText" @click="exportCurrent('pdf')">
                Export PDF
              </button>
              <button class="mini-button export-action-button" :disabled="!isTauri() || !chordProText" @click="exportCurrent('cho')">
                Export CHO
              </button>
            </div>
            <p v-if="previewError && previewSrc" class="action-feedback error-message">{{ previewError }}</p>
          </div>
        </div>

        <div class="panel-content preview-content">
          <div v-if="!isTauri()" class="preview-state">
            <p class="message">
              Preview and export require the Tauri desktop runtime.
            </p>
          </div>
          <div v-else-if="!hasBufferedPreview && showPreviewLoadingIndicator" class="preview-state preview-loading-empty">
            <LoadingOverlayCard :overlay="false" message="Generating preview..." />
          </div>
          <div v-else-if="!hasBufferedPreview && previewError" class="preview-state">
            <p class="message error-message">{{ previewError }}</p>
          </div>
          <div v-else-if="!hasBufferedPreview" class="preview-state preview-empty-state">
            <div class="empty-state-copy preview-empty-copy">
              <p class="message preview-empty-title">
                Generate or open a song to see the PDF preview
              </p>
              <p class="empty-state-subtitle">
                {{ songbook ? "Select a song from the list or convert a new song" : "Convert a new song to get started" }}
              </p>
            </div>
          </div>
          <div v-else ref="previewViewerRef" class="preview-viewer">
            <iframe
              :src="viewerFrameSrcA"
              class="preview-frame"
              :class="activePreviewFrame === 'A' ? 'preview-frame-active' : 'preview-frame-inactive'"
              title="ChordPro PDF Preview"
              @load="handlePreviewFrameLoad('A')"
            />
            <iframe
              :src="viewerFrameSrcB"
              class="preview-frame"
              :class="activePreviewFrame === 'B' ? 'preview-frame-active' : 'preview-frame-inactive'"
              title="ChordPro PDF Preview"
              @load="handlePreviewFrameLoad('B')"
            />
            <div v-if="isRefreshingPreview" class="preview-refresh-indicator" aria-hidden="true">
              <span class="preview-refresh-spinner" />
            </div>
            <LoadingOverlayCard v-if="showPreviewLoadingIndicator" message="Generating preview..." />
          </div>
        </div>
      </section>
    </section>
    </template>

    <div v-if="showApiKeyModal" class="modal-backdrop" @click.self="closeApiKeyModal">
      <div class="modal-card">
        <div class="modal-copy">
          <p class="eyebrow">Gemini</p>
          <h2>{{ hasApiKey ? "Change API Key" : "Set API Key" }}</h2>
          <p>Stored locally in the app config and used for new generation requests.</p>
        </div>

        <label class="modal-field">
          <span>API Key</span>
          <input v-model="apiKeyDraft" type="password" autocomplete="off" placeholder="Paste your Gemini API key" />
        </label>

        <p v-if="apiKeyFeedback" class="action-feedback error-message">{{ apiKeyFeedback }}</p>

        <div class="modal-actions">
          <button class="secondary-button" :disabled="isSavingApiKey" @click="closeApiKeyModal">Cancel</button>
          <button
            v-if="hasApiKey"
            class="mini-button"
            :disabled="isSavingApiKey"
            @click="clearApiKey"
          >
            Clear Key
          </button>
          <button class="primary-button" :disabled="isSavingApiKey || !apiKeyDraft.trim()" @click="saveApiKey">
            Save
          </button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.user-view {
  --nav-rail-padding: 0.65rem;
  --nav-button-size: 5.45rem;

  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  gap: 1rem;
  overflow: hidden;
}

.card {
  padding: 1.25rem 1.5rem;
  border: 1px solid rgba(24, 32, 25, 0.12);
  background: rgba(255, 250, 241, 0.92);
  box-shadow: 0 18px 40px rgba(74, 58, 32, 0.08);
}

.user-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  min-width: 0;
}

.header-copy,
.header-controls {
  min-width: 0;
}

.header-controls {
  display: grid;
  gap: 1rem;
  justify-items: end;
}

.view-toggle {
  display: inline-flex;
  gap: 0.25rem;
  padding: 0.25rem;
  border: 1px solid rgba(35, 49, 39, 0.18);
  background: #f7f0e1;
}

.view-button {
  padding: 0.6rem 1rem;
  border: 0;
  background: transparent;
  color: #233127;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
}

.view-button.active {
  background: linear-gradient(135deg, #1f3124, #37513b);
  color: #f8f3e8;
}

.brand-lockup {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.brand-mark {
  width: 2.5rem;
  height: 2.5rem;
  flex: 0 0 auto;
}

.brand-title {
  color: #182019;
  font-family: "Inter", "Segoe UI", sans-serif;
  font-size: 1.55rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.01em;
}

.user-header h1,
.panel-header h2,
.panel h3,
.song-list-header h3,
.editor-heading h3 {
  margin: 0;
}

.panel p,
.message {
  margin: 0.4rem 0 0;
  color: #4a564a;
}

.eyebrow {
  margin: 0 0 0.3rem;
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #7a6541;
}

.user-main,
.nav-rail,
.workspace-panel,
.preview-panel,
.panel-shell,
.panel-content,
.convert-layout,
.editor-column,
.songbook-layout,
.song-list-panel,
.editor-panel,
.preview-content,
.preview-state,
.preview-viewer,
.songbook-content,
.songbook-empty-state {
  min-height: 0;
}

.user-main {
  display: grid;
  grid-template-columns: calc(var(--nav-button-size) + (var(--nav-rail-padding) * 2)) minmax(0, 1.1fr) minmax(24rem, 1fr);
  gap: 1rem;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.nav-rail {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  align-items: center;
  padding: var(--nav-rail-padding);
  border: 1px solid rgba(24, 32, 25, 0.12);
  background: rgba(255, 250, 241, 0.92);
  box-shadow: 0 18px 40px rgba(74, 58, 32, 0.08);
  overflow: visible;
}

.nav-rail-main {
  display: grid;
  gap: 0.65rem;
  align-self: center;
  justify-items: stretch;
  width: var(--nav-button-size);
}

.nav-rail-footer {
  position: relative;
  margin-top: auto;
  display: grid;
  align-self: center;
  justify-items: stretch;
  width: var(--nav-button-size);
}

.nav-button {
  display: grid;
  grid-template-rows: auto auto;
  align-content: center;
  justify-items: center;
  width: 100%;
  min-height: var(--nav-button-size);
  aspect-ratio: 1 / 1;
  gap: 0.38rem;
  box-sizing: border-box;
  padding: 0.7rem 0.45rem;
  border: 1px solid rgba(35, 49, 39, 0.12);
  background: rgba(255, 250, 241, 0.42);
  color: #233127;
  font: inherit;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  line-height: 1.1;
  text-align: center;
  text-transform: uppercase;
  cursor: pointer;
}


.nav-rail-main > .nav-button {
  justify-self: center;
}

.nav-button svg {
  width: 2.65rem;
  height: 2.65rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.1;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.nav-button:hover:not(.active) {
  border-color: rgba(35, 49, 39, 0.18);
  background: rgba(255, 250, 241, 0.62);
}

.nav-button.active {
  background: linear-gradient(135deg, #1f3124, #37513b);
  border-color: rgba(31, 49, 36, 0.18);
  color: #f8f3e8;
}

.preferences-popover {
  position: absolute;
  left: calc(100% + 0.75rem);
  bottom: 0;
  z-index: 20;
  display: grid;
  gap: 0.85rem;
  width: min(22rem, calc(100vw - 11rem));
  padding: 0.9rem 1rem;
  border: 1px solid rgba(24, 32, 25, 0.24);
  background: #fffefb;
  box-shadow: 0 26px 52px rgba(24, 32, 25, 0.24), inset 0 0 0 1px rgba(255, 255, 255, 0.72);
}

.preferences-heading {
  margin: 0;
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #7a6541;
}

.preferences-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.preferences-item-copy {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.preferences-item-label {
  color: #233127;
  font-weight: 700;
}

.preferences-item-value {
  color: #7a6541;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.preferences-switch {
  display: inline-flex;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.preferences-switch:disabled {
  opacity: 0.65;
  cursor: default;
}

.preferences-switch-track {
  display: inline-flex;
  align-items: center;
  width: 2.8rem;
  padding: 0.22rem;
  border-radius: 999px;
  background: #d6d1c6;
  transition: background 160ms ease, justify-content 160ms ease;
}

.preferences-switch-track.on {
  justify-content: flex-end;
  background: #37513b;
}

.preferences-switch-thumb {
  width: 1rem;
  height: 1rem;
  border-radius: 999px;
  background: #fffaf1;
  box-shadow: 0 4px 10px rgba(24, 32, 25, 0.18);
}

.preferences-segmented-control {
  display: inline-grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-left: auto;
  padding: 0.25rem;
  border: 1px solid rgba(35, 49, 39, 0.14);
  background: #f4ecdd;
}

.preferences-segmented-option {
  min-height: 2.25rem;
  padding: 0.55rem 0.8rem;
  border: 0;
  background: transparent;
  color: #233127;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 160ms ease, color 160ms ease;
}

.preferences-segmented-option.active {
  background: linear-gradient(135deg, #1f3124, #37513b);
  color: #f8f3e8;
}

.preferences-segmented-option:disabled {
  opacity: 0.65;
  cursor: default;
}

.preferences-popover-enter-active,
.preferences-popover-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
}

.preferences-popover-enter-from,
.preferences-popover-leave-to {
  opacity: 0;
  transform: translateY(6px);
}


.workspace-panel,
.preview-panel,
.panel-shell,
.panel-content,
.editor-column,
.song-list-panel,
.editor-panel,
.card-subsection,
.preview-content,
.songbook-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.panel-shell {
  gap: 0;
}

.workspace-panel,
.preview-panel,
.panel-shell,
.panel-content,
.preview-content,
.songbook-content {
  flex: 1;
}

.workspace-panel,
.preview-panel {
  overflow: hidden;
}

.panel-header,
.secondary-header,
.editor-heading,
.song-list-header,
.editor-heading-aside {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.secondary-header,
.preview-header,
.editor-heading,
.editor-heading-aside {
  align-items: flex-start;
}

.panel-header,
.song-list-header,
.editor-heading {
  flex: 0 0 auto;
}

.panel-header {
  margin-bottom: 1.35rem;
}

.panel-content,
.songbook-content {
  gap: 1rem;
  overflow: hidden;
}

.convert-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  flex: 1;
}

.convert-layout.split {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.editor-column {
  gap: 0.75rem;
}



.input-textarea {
  flex: 1;
  width: 100%;
  min-height: 0;
  resize: none;
  overflow: auto;
  padding: 0.9rem 1rem;
  border: 1px solid rgba(47, 59, 49, 0.16);
  background: #fffef9;
  color: #1f251f;
  box-sizing: border-box;
  font: inherit;
  line-height: 1.5;
}

.input-textarea.editor-monospace {
  font-family: var(--editor-monospace-family);
}

.panel-actions-stack {
  display: grid;
  gap: 0.55rem;
}

.panel-actions-stack.align-end {
  justify-items: end;
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: center;
}

.convert-actions {
  justify-content: flex-end;
}

.mini-button,
.secondary-button,
.primary-button {
  min-height: 2.75rem;
  padding: 0.7rem 0.95rem;
  border: 1px solid rgba(35, 49, 39, 0.18);
  color: #233127;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.mini-button,
.secondary-button {
  background: #f7efe0;
}

.primary-button {
  min-width: 10.5rem;
  background: linear-gradient(135deg, #1f3124, #37513b);
  color: #f8f3e8;
}

.mini-button:disabled,
.secondary-button:disabled,
.primary-button:disabled {
  opacity: 0.7;
  cursor: default;
}

.export-split-actions {
  justify-content: flex-end;
}

.export-action-button {
  min-width: 7.9rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.songbook-export-button {
  width: 10rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.button-content {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.button-content.loading {
  padding-left: 1.2rem;
}

.button-spinner {
  position: absolute;
  left: 0;
  width: 0.8rem;
  height: 0.8rem;
  border: 2px solid rgba(248, 243, 232, 0.35);
  border-top-color: currentColor;
  border-radius: 999px;
  animation: spin 0.8s linear infinite;
}

.button-spinner.is-hidden {
  opacity: 0;
}

.button-label {
  display: inline-flex;
  justify-content: center;
  width: 100%;
}

.action-feedback {
  font-size: 0.92rem;
  font-weight: 700;
}

.songbook-path {
  max-width: 22rem;
  margin-top: 0;
  color: #29603f;
  overflow-wrap: anywhere;
  text-align: right;
}

.success-message {
  color: #29603f;
}

.error-message {
  color: #8f3131;
}

.warning-message {
  color: #8a5a14;
}

.songbook-layout {
  display: grid;
  grid-template-columns: minmax(13rem, 14rem) minmax(0, 1fr);
  gap: 1rem;
  flex: 1;
  overflow: hidden;
}

.song-list-panel,
.editor-panel {
  gap: 0.75rem;
  overflow: hidden;
}

.song-list-header > div {
  width: 100%;
}

.song-list-header {
  flex-direction: column;
  align-items: stretch;
  gap: 0.45rem;
}

.song-list-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
}

.song-list-header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.55rem;
  min-width: 0;
}

.song-sort-controls {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.song-sort-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.22rem;
  min-height: 1.55rem;
  padding: 0.16rem 0.48rem;
  border: 1px solid rgba(35, 49, 39, 0.12);
  background: rgba(255, 254, 249, 0.9);
  color: rgba(74, 86, 74, 0.88);
  font: inherit;
  font-size: 0.76rem;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease;
}

.song-sort-button:hover {
  background: rgba(243, 247, 241, 0.98);
  border-color: rgba(55, 81, 59, 0.22);
}

.song-sort-button.active {
  border-color: rgba(55, 81, 59, 0.28);
  background: #eef4ed;
  color: #233127;
}

.song-sort-direction {
  display: inline-flex;
  justify-content: center;
  width: 0.65rem;
  font-size: 0.72rem;
  font-weight: 700;
  opacity: 0.22;
}

.song-sort-direction.visible {
  opacity: 1;
}

.song-count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.9rem;
  min-height: 1.28rem;
  padding: 0.06rem 0.4rem;
  background: rgba(233, 240, 230, 0.92);
  color: #526152;
  font-size: 0.76rem;
  font-weight: 700;
  line-height: 1;
}

@media (max-width: 900px) {
  .song-list-title-row {
    align-items: flex-start;
    gap: 0.5rem;
  }

  .song-list-header-actions {
    flex-wrap: wrap;
    justify-content: flex-start;
  }
}

.songbook-empty {
  padding: 1rem;
  border: 1px dashed rgba(47, 59, 49, 0.18);
  color: #4a564a;
}

.song-list-hint,
.empty-state-subtitle {
  color: rgba(74, 86, 74, 0.78);
  font-size: 0.92rem;
  font-weight: 400;
}

.song-list-hint {
  margin-top: 0.35rem;
}

.empty-state-copy {
  display: grid;
  gap: 0.35rem;
  justify-items: center;
}

.empty-state-copy h3,
.empty-state-copy p {
  margin: 0;
}

.empty-state-copy h3 {
  color: #233127;
}

.empty-state-button {
  margin-top: 0.35rem;
}

.songbook-empty-state {
  display: flex;
  flex: 1;
}

.songbook-empty.large {
  display: grid;
  flex: 1;
  justify-items: center;
  align-content: center;
  text-align: center;
}

.songbook-start-state {
  gap: 0.85rem;
}

.dirty-badge {
  padding: 0.35rem 0.55rem;
  background: #f0dfb9;
  color: #5b4320;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.preview-panel .message {
  margin: 0;
  text-align: center;
}

.preview-empty-state {
  color: rgba(74, 86, 74, 0.82);
}

.preview-empty-copy {
  gap: 0.45rem;
  max-width: 28rem;
}

.preview-empty-title {
  color: #314034;
  font-size: 1rem;
  font-weight: 600;
}

.preview-state,
.preview-loading-empty {
  display: grid;
  place-items: center;
}

.preview-state {
  flex: 1;
  border: 1px dashed rgba(47, 59, 49, 0.18);
  background: rgba(255, 255, 255, 0.4);
  padding: 1rem;
  box-sizing: border-box;
}

.preview-viewer {
  position: relative;
  flex: 1;
  overflow: hidden;
}

.preview-frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 1px solid rgba(47, 59, 49, 0.12);
  background: #fff;
  transition: opacity 180ms ease-in-out;
}

.preview-frame-active {
  opacity: 1;
  pointer-events: auto;
}

.preview-frame-inactive {
  opacity: 0;
  pointer-events: none;
}

.preview-refresh-indicator {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  background: rgba(255, 250, 241, 0.92);
  box-shadow: 0 10px 20px rgba(24, 32, 25, 0.12);
  pointer-events: none;
}

.preview-refresh-spinner {
  width: 0.9rem;
  height: 0.9rem;
  border: 2px solid rgba(55, 81, 59, 0.18);
  border-top-color: #37513b;
  border-radius: 999px;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}


.api-key-note {
  margin-top: 0;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(24, 32, 25, 0.28);
}

.modal-card {
  display: grid;
  gap: 1rem;
  width: min(100%, 28rem);
  padding: 1.25rem;
  border: 1px solid rgba(24, 32, 25, 0.12);
  background: #fffaf1;
  box-shadow: 0 22px 44px rgba(24, 32, 25, 0.2);
}

.modal-copy h2,
.modal-copy p {
  margin: 0;
}

.modal-copy {
  display: grid;
  gap: 0.4rem;
}

.modal-field {
  display: grid;
  gap: 0.45rem;
  font-weight: 700;
  color: #233127;
}

.modal-field input {
  min-height: 2.75rem;
  padding: 0.7rem 0.85rem;
  border: 1px solid rgba(47, 59, 49, 0.16);
  background: #fffef9;
  color: #1f251f;
  font: inherit;
}

.modal-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.65rem;
}

@media (max-width: 1180px) {
  .user-main {
    grid-template-columns: calc(var(--nav-button-size) + (var(--nav-rail-padding) * 2)) minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
  }

  .nav-rail {
    grid-row: 1 / span 2;
  }

  .preview-panel {
    grid-column: 2;
  }
}

@media (max-width: 900px) {
  .user-view {
    --nav-rail-padding: 0.55rem;
    --nav-button-size: 4.35rem;
  }

  .user-main {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr) minmax(0, 1fr);
  }

  .nav-rail {
    grid-row: auto;
    flex-direction: row;
    align-items: stretch;
  }

  .nav-rail-main {
    display: grid;
    flex: 1;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;
  }

  
.nav-rail-main > .nav-button {
    width: 100%;
    justify-self: stretch;
  }

  .nav-button svg {
    width: 2.3rem;
    height: 2.3rem;
  }

  .nav-rail-footer .nav-button {
    width: var(--nav-button-size);
  }



  .preferences-popover {
    top: calc(100% + 0.65rem);
    right: 0;
    bottom: auto;
    left: auto;
    width: min(22rem, calc(100vw - 2rem));
  }

  .workspace-panel,
  .preview-panel {
    grid-column: auto;
  }

  .convert-layout.split {
    grid-template-columns: 1fr;
    grid-template-rows: repeat(2, minmax(0, 1fr));
  }

  .songbook-layout {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(12rem, 0.8fr) minmax(0, 1.2fr);
  }

  .user-header,
  .panel-header,
  .secondary-header,
  .editor-heading,
  .editor-heading-aside {
    flex-direction: column;
  }

  .header-controls {
    justify-items: start;
  }

  .panel-actions-stack.align-end {
    justify-items: start;
  }

  .convert-actions,
  .header-actions,
  .modal-actions {
    justify-content: flex-start;
  }

  .songbook-path {
    text-align: left;
  }
}
</style>






