<template>
  <section class="performance-mode">
    <section class="performance-stage">
      <div :class="['performance-main', { 'with-song-list': isSongListOpen }]">
        <aside :class="['performance-sidebar-overlay', { open: isSongListOpen }]" :aria-hidden="!isSongListOpen">
          <div class="performance-sidebar-shell">
            <div class="performance-sidebar-top">
              <div class="performance-sidebar-copy">
                <p class="eyebrow">Performance</p>
                <div class="performance-sidebar-title-row">
                  <h1>Songbook</h1>
                  <span v-if="props.songbook" class="performance-song-count">{{ props.songbook.songs.length }}</span>
                </div>
              </div>
            </div>

            <p v-if="props.songbookError" class="message error-message">{{ props.songbookError }}</p>

            <SongList
              v-if="props.songbook"
              ref="songListRef"
              :songs="props.songListItems"
              :selected-song-path="selectedSongListPath"
              :active-song-path="props.selectedSongPath"
              empty-message="No `.cho` files were found in this folder."
              @keydown="handleSongListKeydown"
              @hover="handleSongListHover"
              @leave="handleSongListLeave"
              @mousemove="handleSongListMouseMove"
              @open="handleSongListOpen"
            />

            <div v-else class="songbook-empty large">
              No songbook loaded.
            </div>
          </div>
        </aside>

        <button
          :class="['performance-icon-button', 'performance-list-handle', { open: isSongListOpen }]"
          :aria-label="isSongListOpen ? 'Hide songs' : 'Show songs'"
          :aria-pressed="isSongListOpen"
          :title="isSongListOpen ? 'Hide songs' : 'Show songs'"
          @click="toggleSongList"
        >
          <PanelLeftClose v-if="isSongListOpen" aria-hidden="true" />
          <PanelLeftOpen v-else aria-hidden="true" />
        </button>

        <div ref="previewViewportRef" class="preview-content" tabindex="-1">
          <div v-if="!isTauri()" class="preview-state">
            <p class="message">
              Preview requires the Tauri desktop runtime.
            </p>
          </div>
          <div v-else-if="!hasBufferedPreview && showPreviewLoadingIndicator" class="preview-state preview-loading-empty">
            <div class="preview-loading-card">
              <span class="loading-spinner" aria-hidden="true" />
              <p class="message">Generating preview...</p>
            </div>
          </div>
          <div v-else-if="!hasBufferedPreview && props.previewError" class="preview-state">
            <p class="message error-message">{{ props.previewError }}</p>
          </div>
          <div
            v-else-if="!hasBufferedPreview && !props.hasRenderablePreviewSource && props.previewPlaceholderInfo.hasContext"
            class="preview-state"
          >
            <div class="preview-empty-copy">
              <div class="preview-context-block">
                <p class="message preview-context-title">
                  {{ props.previewPlaceholderInfo.title || props.previewPlaceholderInfo.fileName }}
                </p>
                <p v-if="props.previewPlaceholderInfo.artist" class="message preview-context-detail preview-context-meta">
                  {{ props.previewPlaceholderInfo.artist }}
                </p>
                <p v-if="props.previewPlaceholderInfo.album" class="message preview-context-detail preview-context-meta">
                  {{ props.previewPlaceholderInfo.album }}
                </p>
                <p v-if="props.previewPlaceholderInfo.year" class="message preview-context-detail preview-context-meta">
                  {{ props.previewPlaceholderInfo.year }}
                </p>
                <p v-if="props.previewPlaceholderInfo.fileName" class="message preview-context-detail preview-context-meta preview-context-file-name">
                  {{ props.previewPlaceholderInfo.fileName }}
                </p>
              </div>
              <div class="preview-context-footer">
                <span class="preview-context-separator" aria-hidden="true" />
                <p class="message preview-context-hint">
                  Preview will appear when the song has renderable content.
                </p>
              </div>
            </div>
          </div>
          <div v-else-if="!hasBufferedPreview" class="preview-state">
            <div class="preview-empty-copy">
              <div class="preview-context-block">
                <p class="message preview-context-title">
                  Open a song to see the PDF preview.
                </p>
              </div>
              <div class="preview-context-footer">
                <span class="preview-context-separator" aria-hidden="true" />
                <p class="message preview-context-hint">
                  Use the song list to load a document into the preview.
                </p>
              </div>
            </div>
          </div>
          <div v-else class="preview-viewer">
            <PdfPreviewViewer
              :src="props.previewSrc"
              :loading="showPreviewLoadingIndicator"
              :manage-blob-cleanup="true"
              :immersive="true"
              :show-scroll-controls="true"
              loading-message="Generating preview..."
              aria-label="Performance PDF preview"
            />
            <div v-if="props.isRefreshingPreview" class="preview-refresh-indicator" aria-hidden="true">
              <span class="preview-refresh-spinner" />
            </div>
            <div class="performance-dock-shell" aria-label="Performance controls">
              <button
                class="performance-icon-button performance-exit-button"
                aria-label="Exit performance mode"
                title="Exit performance mode"
                @keydown="handleDockButtonKeydown"
                @click="props.exitPerformanceMode"
              >
                <X aria-hidden="true" />
              </button>

              <div class="performance-dock">
                <div class="performance-dock-group">
                  <button
                    class="performance-icon-button"
                    :disabled="!canSelectPreviousSong"
                    aria-label="Previous song"
                    title="Previous song"
                    @keydown="handleDockButtonKeydown"
                    @click="void selectRelativeSong(-1)"
                  >
                    <ChevronUp aria-hidden="true" />
                  </button>
                  <button
                    class="performance-icon-button"
                    :disabled="!canSelectNextSong"
                    aria-label="Next song"
                    title="Next song"
                    @keydown="handleDockButtonKeydown"
                    @click="void selectRelativeSong(1)"
                  >
                    <ChevronDown aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

import { isTauri } from "@tauri-apps/api/core";
import { ChevronDown, ChevronUp, PanelLeftClose, PanelLeftOpen, X } from "lucide-vue-next";
import type { Songbook } from "../../domain/songbook";
import PdfPreviewViewer from "./PdfPreviewViewer.vue";
import SongList from "./SongList.vue";
import { usePdfFit } from "../composables/usePdfFit";

type PreviewFrameId = "A" | "B";
type SongListItem = {
  filePath: string;
  title: string;
  artist: string;
};
type PreviewPlaceholderInfo = {
  title: string;
  artist: string;
  album: string;
  year: string;
  fileName: string;
  hasContext: boolean;
};
type SongListExpose = {
  focus: () => void;
  getItemElement: (index: number) => HTMLButtonElement | null;
};

const PREVIEW_LOADING_INDICATOR_DELAY_MS = 150;
const PREVIEW_FRAME_SWAP_DELAY_MS = 100;
const PREVIEW_FRAME_TRANSITION_MS = 180;

const props = defineProps<{
  songbook: Songbook | null;
  songListItems: SongListItem[];
  songbookError: string;
  selectedSongPath: string;
  selectedListPath: string | null;
  currentSongTitle: string;
  isGeneratingPreview: boolean;
  isRefreshingPreview: boolean;
  previewError: string;
  previewSrc: string;
  hasRenderablePreviewSource: boolean;
  previewPlaceholderInfo: PreviewPlaceholderInfo;
  openSong: (filePath: string) => Promise<boolean>;
  exitPerformanceMode: () => void;
}>();
const emit = defineEmits<{
  "selected-change": [filePath: string | null];
}>();

const songListRef = ref<SongListExpose | null>(null);
const previewViewportRef = ref<HTMLElement | null>(null);
const previewViewerRef = ref<HTMLElement | null>(null);
const isSongListOpen = ref(true);
const hoveredSongPath = ref<string | null>(null);
const showPreviewLoadingIndicator = ref(false);
const activePreviewFrame = ref<PreviewFrameId>("A");
const pendingPreviewFrame = ref<PreviewFrameId | null>(null);
const pendingPreviewUrl = ref("");
const desiredPreviewUrl = ref("");
const bufferedFrameSrcA = ref("");
const bufferedFrameSrcB = ref("");
const loadedFrameSrcA = ref("");
const loadedFrameSrcB = ref("");
let previewLoadingIndicatorTimer: ReturnType<typeof setTimeout> | null = null;
let previewFrameCleanupTimerA: ReturnType<typeof setTimeout> | null = null;
let previewFrameCleanupTimerB: ReturnType<typeof setTimeout> | null = null;
let previewFrameNavigationRafA: number | null = null;
let previewFrameNavigationRafB: number | null = null;
let previewFrameSwapTimer: ReturnType<typeof setTimeout> | null = null;
let previewFrameSwapToken = 0;
const songEntries = computed(() => props.songListItems);
const currentSongIndex = computed(() => {
  const songs = songEntries.value;
  if (!props.selectedSongPath) {
    return -1;
  }

  return songs.findIndex((songEntry) => songEntry.filePath === props.selectedSongPath);
});
const canSelectPreviousSong = computed(() => currentSongIndex.value > 0);
const canSelectNextSong = computed(() => {
  const songs = songEntries.value;
  return songs.length > 0 && currentSongIndex.value >= 0 && currentSongIndex.value < songs.length - 1;
});
const selectedSongListPath = computed(() => hoveredSongPath.value);
const { applyFit, fitRevision, scheduleFitUpdate } = usePdfFit(previewViewerRef);
const activePreviewBaseUrl = computed(() => props.previewSrc);
const nextRenderedPreviewUrl = computed(() => applyFit(activePreviewBaseUrl.value));
const hasBufferedPreview = computed(() => !!props.previewSrc);

function setSelectedListPath(filePath: string | null): void {
  if (props.selectedListPath === filePath) {
    return;
  }

  emit("selected-change", filePath);
}

function syncPerformanceSelection(): void {
  const songs = songEntries.value;

  if (songs.length === 0) {
    setSelectedListPath(null);
    return;
  }

  if (currentSongIndex.value >= 0) {
    setSelectedListPath(songEntries.value[currentSongIndex.value]?.filePath ?? null);
    return;
  }

  setSelectedListPath(songEntries.value[0]?.filePath ?? null);
}

function getSongListIndexByPath(filePath: string | null): number {
  if (!filePath) {
    return -1;
  }

  return songEntries.value.findIndex((songEntry) => songEntry.filePath === filePath);
}

function focusSongList(): void {
  if (!isSongListOpen.value) {
    return;
  }

  void nextTick(() => {
    songListRef.value?.focus();
  });
}

function focusPreviewViewport(): void {
  void nextTick(() => {
    previewViewportRef.value?.focus();
  });
}

function scrollPerformanceIndexIntoView(index: number, behavior: ScrollBehavior = "smooth"): void {
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

function alignPerformanceViewportToActiveSong(behavior: ScrollBehavior = "auto"): void {
  if (!isSongListOpen.value) {
    return;
  }

  void nextTick(() => {
    const activeIndex = currentSongIndex.value;
    if (activeIndex < 0) {
      scrollPerformanceIndexIntoView(0, behavior);
      return;
    }

    songListRef.value?.getItemElement(activeIndex)?.scrollIntoView({
      block: "nearest",
      behavior
    });
  });
}

function handleSongListHover(filePath: string): void {
  hoveredSongPath.value = filePath;
}

function handleSongListLeave(): void {
  hoveredSongPath.value = null;
}

function handleSongListMouseMove(filePath: string): void {
  hoveredSongPath.value = filePath;
}

function handleSongListOpen(filePath: string): void {
  const nextIndex = songEntries.value.findIndex((songEntry) => songEntry.filePath === filePath);
  if (nextIndex >= 0) {
    void selectSong(nextIndex, { closeList: false, focusTarget: "list" });
  }
}

function openSongList(): void {
  isSongListOpen.value = true;
  focusSongList();
  alignPerformanceViewportToActiveSong("auto");
}

function closeSongList(options?: { focusPreview?: boolean }): void {
  isSongListOpen.value = false;
  hoveredSongPath.value = null;

  if (options?.focusPreview) {
    focusPreviewViewport();
  }
}

function getInactivePreviewFrame(frame: PreviewFrameId): PreviewFrameId {
  return frame === "A" ? "B" : "A";
}

function getBufferedFrameSrc(frame: PreviewFrameId): string {
  return frame === "A" ? bufferedFrameSrcA.value : bufferedFrameSrcB.value;
}

function getLoadedFrameSrc(frame: PreviewFrameId): string {
  return frame === "A" ? loadedFrameSrcA.value : loadedFrameSrcB.value;
}

function setLoadedFrameSrc(frame: PreviewFrameId, value: string): void {
  if (frame === "A") {
    loadedFrameSrcA.value = value;
    return;
  }

  loadedFrameSrcB.value = value;
}

function setBufferedFrameSrc(frame: PreviewFrameId, value: string): void {
  if (getBufferedFrameSrc(frame) !== value) {
    setLoadedFrameSrc(frame, "");
  }

  if (frame === "A") {
    bufferedFrameSrcA.value = value;
    return;
  }

  bufferedFrameSrcB.value = value;
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

function clearPreviewFrameNavigation(frame: PreviewFrameId): void {
  if (frame === "A" && previewFrameNavigationRafA !== null) {
    cancelAnimationFrame(previewFrameNavigationRafA);
    previewFrameNavigationRafA = null;
    return;
  }

  if (frame === "B" && previewFrameNavigationRafB !== null) {
    cancelAnimationFrame(previewFrameNavigationRafB);
    previewFrameNavigationRafB = null;
  }
}

function schedulePreviewFrameNavigation(frame: PreviewFrameId, nextUrl: string): void {
  clearPreviewFrameNavigation(frame);
  clearPreviewFrameCleanup(frame);

  const currentUrl = getBufferedFrameSrc(frame);
  if (!currentUrl) {
    setBufferedFrameSrc(frame, nextUrl);
    return;
  }

  setBufferedFrameSrc(frame, "about:blank");

  const rafId = requestAnimationFrame(() => {
    if (frame === "A") {
      previewFrameNavigationRafA = null;
    } else {
      previewFrameNavigationRafB = null;
    }

    setBufferedFrameSrc(frame, nextUrl);
  });

  if (frame === "A") {
    previewFrameNavigationRafA = rafId;
    return;
  }

  previewFrameNavigationRafB = rafId;
}

function releasePreviewFrame(frame: PreviewFrameId): void {
  setBufferedFrameSrc(frame, "");
  setLoadedFrameSrc(frame, "");
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

function clearAllPreviewFrames(): void {
  cancelPendingPreviewSwap();
  clearPreviewFrameNavigation("A");
  clearPreviewFrameNavigation("B");
  clearPreviewFrameCleanup("A");
  clearPreviewFrameCleanup("B");
  releasePreviewFrame("A");
  releasePreviewFrame("B");
  pendingPreviewFrame.value = null;
  pendingPreviewUrl.value = "";
  desiredPreviewUrl.value = "";
  activePreviewFrame.value = "A";
}

function stagePreviewUrl(nextUrl: string): void {
  desiredPreviewUrl.value = nextUrl;
  cancelPendingPreviewSwap();

  if (!nextUrl) {
    clearAllPreviewFrames();
    return;
  }

  const activeFrame = activePreviewFrame.value;
  const inactiveFrame = getInactivePreviewFrame(activeFrame);
  const activeUrl = getBufferedFrameSrc(activeFrame);
  const inactiveUrl = getBufferedFrameSrc(inactiveFrame);

  if (nextUrl === activeUrl) {
    pendingPreviewFrame.value = null;
    pendingPreviewUrl.value = "";
    clearPreviewFrameCleanup(inactiveFrame);

    if (inactiveUrl) {
      releasePreviewFrame(inactiveFrame);
    }

    return;
  }

  if (nextUrl === inactiveUrl) {
    clearPreviewFrameCleanup(inactiveFrame);
    pendingPreviewFrame.value = inactiveFrame;
    pendingPreviewUrl.value = nextUrl;

    if (getLoadedFrameSrc(inactiveFrame) === nextUrl) {
      queuePreviewFrameSwap(inactiveFrame);
    }

    return;
  }

  pendingPreviewFrame.value = inactiveFrame;
  pendingPreviewUrl.value = nextUrl;
  schedulePreviewFrameNavigation(inactiveFrame, nextUrl);
}

function reconcilePreviewUrl(): void {
  const desiredUrl = desiredPreviewUrl.value;
  if (!desiredUrl) {
    return;
  }

  if (getBufferedFrameSrc(activePreviewFrame.value) === desiredUrl) {
    return;
  }

  stagePreviewUrl(desiredUrl);
}

function queuePreviewFrameSwap(frame: PreviewFrameId): void {
  cancelPendingPreviewSwap();

  const previousActiveFrame = activePreviewFrame.value;
  if (previousActiveFrame === frame) {
    pendingPreviewFrame.value = null;
    pendingPreviewUrl.value = "";
    reconcilePreviewUrl();
    return;
  }

  const swapToken = previewFrameSwapToken + 1;
  previewFrameSwapToken = swapToken;
  previewFrameSwapTimer = setTimeout(() => {
    if (pendingPreviewFrame.value !== frame || previewFrameSwapToken !== swapToken) {
      reconcilePreviewUrl();
      return;
    }

    const finalFrameUrl = getBufferedFrameSrc(frame);
    if (!finalFrameUrl || finalFrameUrl !== pendingPreviewUrl.value || finalFrameUrl !== desiredPreviewUrl.value) {
      previewFrameSwapTimer = null;
      reconcilePreviewUrl();
      return;
    }

    activePreviewFrame.value = frame;
    pendingPreviewFrame.value = null;
    pendingPreviewUrl.value = "";
    previewFrameSwapTimer = null;
    schedulePreviewFrameRelease(previousActiveFrame);
    reconcilePreviewUrl();
  }, PREVIEW_FRAME_SWAP_DELAY_MS);
}

function handlePreviewFrameLoad(frame: PreviewFrameId): void {
  scheduleFitUpdate();

  const frameUrl = getBufferedFrameSrc(frame);
  if (frameUrl) {
    setLoadedFrameSrc(frame, frameUrl);
  }

  if (frameUrl === "about:blank") {
    return;
  }

  if (pendingPreviewFrame.value !== frame) {
    return;
  }

  if (!frameUrl || frameUrl !== pendingPreviewUrl.value || frameUrl !== desiredPreviewUrl.value) {
    reconcilePreviewUrl();
    return;
  }

  queuePreviewFrameSwap(frame);
}

function toggleSongList(): void {
  if (isSongListOpen.value) {
    closeSongList({ focusPreview: true });
    return;
  }

  openSongList();
}

async function selectSong(
  index: number,
  options?: {
    closeList?: boolean;
    focusTarget?: "list" | "preview" | "preserve";
  }
): Promise<void> {
  const songEntry = songEntries.value[index];
  if (!songEntry) {
    return;
  }

  const opened = await props.openSong(songEntry.filePath);
  if (!opened) {
    return;
  }

  hoveredSongPath.value = null;
  setSelectedListPath(songEntry.filePath);

  if (options?.closeList) {
    closeSongList({
      focusPreview: options.focusTarget === "preview"
    });
    return;
  }

  if (options?.focusTarget === "list") {
    focusSongList();
    return;
  }

  if (options?.focusTarget === "preview") {
    focusPreviewViewport();
  }
}

async function selectRelativeSong(delta: number): Promise<void> {
  const songs = songEntries.value;
  if (songs.length === 0 || currentSongIndex.value < 0) {
    return;
  }

  const nextIndex = Math.max(0, Math.min(currentSongIndex.value + delta, songs.length - 1));
  if (nextIndex === currentSongIndex.value) {
    return;
  }

  await selectSong(nextIndex, {
    closeList: false,
    focusTarget: "preserve"
  });

  alignPerformanceViewportToActiveSong("smooth");
}

function handleSongListKeydown(event: KeyboardEvent): void {
  const songs = songEntries.value;

  if (event.key === "ArrowDown") {
    if (songs.length === 0) {
      return;
    }

    event.preventDefault();
    void selectRelativeSong(1);
    return;
  }

  if (event.key === "ArrowUp") {
    if (songs.length === 0) {
      return;
    }

    event.preventDefault();
    void selectRelativeSong(-1);
    return;
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    focusPreviewViewport();
    return;
  }

  if (event.key === "Enter") {
    if (songs.length === 0) {
      return;
    }

    event.preventDefault();
    const targetIndex = getSongListIndexByPath(hoveredSongPath.value || props.selectedSongPath);
    void selectSong(targetIndex >= 0 ? targetIndex : 0, { closeList: false, focusTarget: "list" });
    return;
  }

  if (event.key === " " || event.key === "Spacebar") {
    if (songs.length === 0) {
      return;
    }

    event.preventDefault();
    const targetIndex = getSongListIndexByPath(hoveredSongPath.value || props.selectedSongPath);
    void selectSong(targetIndex >= 0 ? targetIndex : 0, { closeList: false, focusTarget: "list" });
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closeSongList({ focusPreview: true });
  }
}

function handleDockButtonKeydown(event: KeyboardEvent): void {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    void selectRelativeSong(1);
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    void selectRelativeSong(-1);
    return;
  }

  if (event.key === "ArrowLeft" && !isSongListOpen.value) {
    event.preventDefault();
    openSongList();
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    if (isSongListOpen.value) {
      closeSongList({ focusPreview: true });
      return;
    }

    props.exitPerformanceMode();
  }
}

function handleWindowKeydown(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();

    if (isSongListOpen.value) {
      closeSongList({ focusPreview: true });
      return;
    }

    props.exitPerformanceMode();
    return;
  }

  if (!isSongListOpen.value && event.key === "Enter") {
    event.preventDefault();
    openSongList();
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    void selectRelativeSong(1);
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    void selectRelativeSong(-1);
  }
}

watch(
  () => props.isGeneratingPreview,
  (value) => {
    if (previewLoadingIndicatorTimer !== null) {
      clearTimeout(previewLoadingIndicatorTimer);
      previewLoadingIndicatorTimer = null;
    }

    if (value) {
      previewLoadingIndicatorTimer = setTimeout(() => {
        showPreviewLoadingIndicator.value = true;
        previewLoadingIndicatorTimer = null;
      }, PREVIEW_LOADING_INDICATOR_DELAY_MS);
      return;
    }

    showPreviewLoadingIndicator.value = false;
  },
  { immediate: true }
);

watch(
  () => [props.songbook, props.selectedSongPath, props.selectedListPath],
  () => {
    syncPerformanceSelection();
  },
  { immediate: true }
);

watch(isSongListOpen, (isOpen) => {
  if (isOpen) {
    focusSongList();
    alignPerformanceViewportToActiveSong("auto");
  }
});

watch(
  () => [props.previewSrc, fitRevision.value],
  () => {
    stagePreviewUrl(nextRenderedPreviewUrl.value);
  },
  { immediate: true }
);

onMounted(() => {
  focusSongList();
  alignPerformanceViewportToActiveSong("auto");
  window.addEventListener("keydown", handleWindowKeydown);

  void nextTick(() => {
    scheduleFitUpdate();
  });
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleWindowKeydown);

  if (previewLoadingIndicatorTimer !== null) {
    clearTimeout(previewLoadingIndicatorTimer);
    previewLoadingIndicatorTimer = null;
  }

  clearAllPreviewFrames();
});
</script>

<style scoped>
.performance-mode,
.performance-stage,
.preview-content,
.preview-state,
.preview-viewer {
  min-width: 0;
  min-height: 0;
}

.performance-mode {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.performance-stage {
  --performance-inset: 0.04rem;
  --performance-sidebar-width: clamp(14rem, 26vw, 18.5rem);
  --performance-control-size: 2.7rem;
  --performance-control-gap: 0;
  --performance-float-edge: calc(var(--performance-control-size) * 0.18);
  --performance-dock-edge: calc(var(--performance-control-size) * 0.46);
  --performance-toolbar-clearance: calc(var(--performance-dock-edge) * 2.5);

  position: relative;
  display: flex;
  flex: 1;
  overflow: hidden;
  padding: var(--performance-inset);
  border: 1px solid rgba(24, 32, 25, 0.07);
  background: rgba(255, 250, 241, 0.9);
  box-shadow: 0 18px 40px rgba(74, 58, 32, 0.08);
}

.performance-main {
  position: relative;
  display: flex;
  flex: 1;
  gap: 0;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.performance-main.with-song-list {
  gap: 0;
}

.performance-sidebar-overlay {
  position: relative;
  z-index: 5;
  flex: 0 0 0;
  width: 0;
  max-width: 0;
  min-width: 0;
  overflow: hidden;
  pointer-events: none;
  transform: translateX(-0.35rem);
  opacity: 0;
  transition:
    flex-basis 180ms ease,
    width 180ms ease,
    max-width 180ms ease,
    transform 160ms ease,
    opacity 160ms ease;
}

.performance-sidebar-overlay.open {
  flex-basis: var(--performance-sidebar-width);
  width: var(--performance-sidebar-width);
  max-width: var(--performance-sidebar-width);
  pointer-events: auto;
  transform: translateX(0);
  opacity: 1;
}

.performance-sidebar-shell {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  height: 100%;
  box-sizing: border-box;
  padding: 0.42rem;
  border: 0;
  border-right: 1px solid rgba(47, 59, 49, 0.08);
  background: rgba(255, 250, 241, 0.82);
  box-shadow: none;
}

.performance-sidebar-shell:focus-within {
  background: rgba(255, 253, 247, 0.92);
  box-shadow: inset -3px 0 0 rgba(55, 81, 59, 0.12);
}

.performance-sidebar-shell :deep(.song-item.selected:not(.active)) {
  border-color: rgba(55, 81, 59, 0.24);
  background: #f8fbf6;
  box-shadow: none;
}

.performance-sidebar-shell :deep(.song-item.active) {
  border-color: #37513b;
  background: #eef4ed;
  box-shadow: 0 0 0 1px rgba(55, 81, 59, 0.14);
}

.performance-sidebar-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.45rem;
}

.performance-sidebar-copy {
  display: grid;
  gap: 0.32rem;
  min-width: 0;
}

.performance-sidebar-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-width: 0;
}

.performance-sidebar-copy h1 {
  margin: 0;
  color: #0d1811;
  font-size: 1.08rem;
  line-height: 1;
}

.performance-song-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-width: 1.9rem;
  min-height: 1.55rem;
  padding: 0.06rem 0.4rem;
  background: rgba(233, 240, 230, 0.92);
  color: #526152;
  font-size: 0.76rem;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.eyebrow {
  margin: 0 0 0.18rem;
  font-size: 0.66rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #7a6541;
}

.songbook-empty {
  padding: 0.82rem;
  border: 1px dashed rgba(47, 59, 49, 0.18);
  color: #4a564a;
}

.songbook-empty.large {
  display: grid;
  flex: 1;
  align-content: center;
  justify-items: center;
  text-align: center;
}

.preview-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
}

.preview-state,
.preview-loading-empty,
.preview-loading-overlay {
  display: grid;
  place-items: center;
}

.preview-state {
  flex: 1;
  border: 0;
  background: rgba(255, 254, 249, 0.36);
  padding: 0.75rem;
  box-sizing: border-box;
}

.preview-state .message {
  margin: 0;
  color: #4a564a;
  text-align: center;
}

.preview-empty-copy {
  display: grid;
  gap: 0.35rem;
  justify-items: center;
  max-width: 28rem;
}

.preview-context-block {
  display: grid;
  gap: 0.18rem;
}

.preview-context-title {
  color: #314034;
  font-size: 1rem;
  font-weight: 600;
}

.preview-context-detail {
  color: rgba(74, 86, 74, 0.82);
}

.preview-context-meta {
  font-size: 0.9rem;
}

.preview-context-file-name {
  font-family: var(--editor-monospace-family);
  font-size: 0.84rem;
  letter-spacing: 0.01em;
}

.preview-context-footer {
  display: grid;
  justify-items: center;
  margin-top: 0.95rem;
  gap: 0.36rem;
}

.preview-context-separator {
  width: 4.5rem;
  border-top: 1px solid rgba(74, 86, 74, 0.18);
}

.preview-context-hint {
  width: 100%;
  color: rgba(74, 86, 74, 0.72);
  font-size: 0.88rem;
  line-height: 1.45;
  text-align: center;
}

.preview-viewer {
  position: relative;
  flex: 1;
  overflow: hidden;
  background: rgba(255, 254, 249, 0.34);
}

.preview-frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
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
  top: 0.5rem;
  right: 0.5rem;
  z-index: 3;
  display: grid;
  place-items: center;
  width: 1.8rem;
  height: 1.8rem;
  border-radius: 999px;
  background: rgba(255, 250, 241, 0.92);
  box-shadow: 0 10px 20px rgba(24, 32, 25, 0.12);
  pointer-events: none;
}

.performance-dock-shell {
  position: absolute;
  inset: 0;
  z-index: 6;
  padding:
    var(--performance-toolbar-clearance)
    var(--performance-dock-edge)
    var(--performance-dock-edge);
  display: flex;
  justify-content: flex-end;
  align-items: center;
  pointer-events: none;
}

.performance-exit-button {
  position: absolute;
  top: var(--performance-toolbar-clearance);
  right: var(--performance-dock-edge);
  pointer-events: auto;
}

.performance-dock {
  display: grid;
  gap: 0;
  padding: 0;
  border: 1px solid rgba(24, 32, 25, 0.16);
  background: rgba(255, 250, 241, 0.92);
  box-shadow: 0 14px 26px rgba(24, 32, 25, 0.15);
  backdrop-filter: blur(6px);
  pointer-events: auto;
}

.performance-dock:focus-within {
  border-color: rgba(55, 81, 59, 0.36);
  background: rgba(255, 253, 247, 0.94);
  box-shadow:
    0 16px 32px rgba(24, 32, 25, 0.16),
    0 0 0 3px rgba(55, 81, 59, 0.18);
}

.performance-dock-group {
  display: grid;
  gap: var(--performance-control-gap);
}

.performance-dock-group:last-child .performance-icon-button:last-child {
  border-bottom: 0;
}

.performance-icon-button {
  display: grid;
  place-items: center;
  width: var(--performance-control-size);
  height: var(--performance-control-size);
  padding: 0;
  border: 0;
  border-bottom: 1px solid rgba(35, 49, 39, 0.14);
  background: rgba(255, 250, 241, 0.92);
  color: #233127;
  cursor: pointer;
  box-shadow: none;
}

.performance-icon-button svg {
  width: 1.28rem;
  height: 1.28rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.15;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.performance-icon-button.active {
  border-color: #37513b;
  background: #eef4ed;
}

.performance-icon-button:hover:not(:disabled) {
  background: rgba(238, 244, 237, 0.96);
}

.performance-list-handle {
  position: absolute;
  top: var(--performance-toolbar-clearance);
  left: 0;
  z-index: 8;
  width: var(--performance-control-size);
  height: 4.9rem;
  border: 1px solid rgba(35, 49, 39, 0.16);
  border-left: 0;
  border-radius: 0 0.72rem 0.72rem 0;
  background: rgba(238, 244, 237, 0.96);
  box-shadow: 0 10px 20px rgba(24, 32, 25, 0.12);
  transition:
    left 180ms ease,
    background-color 140ms ease,
    border-color 140ms ease,
    box-shadow 140ms ease;
}

.performance-list-handle.open {
  left: calc(var(--performance-sidebar-width) - 1px);
  background: rgba(255, 250, 241, 0.96);
}

.performance-list-handle svg {
  width: 1.28rem;
  height: 1.28rem;
}

.performance-icon-button:focus-visible {
  outline: 3px solid rgba(55, 81, 59, 0.36);
  outline-offset: 0.24rem;
}

.performance-icon-button:focus-visible {
  border-color: rgba(55, 81, 59, 0.42);
  background: #f4f8f1;
  box-shadow:
    0 10px 24px rgba(24, 32, 25, 0.12),
    0 0 0 3px rgba(55, 81, 59, 0.18);
}

.preview-refresh-spinner {
  width: 0.82rem;
  height: 0.82rem;
  border: 2px solid rgba(55, 81, 59, 0.18);
  border-top-color: #37513b;
  border-radius: 999px;
  animation: spin 0.8s linear infinite;
}

.preview-loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(28, 32, 26, 0.24);
}

.preview-loading-card {
  display: grid;
  justify-items: center;
  gap: 0.55rem;
  padding: 0.85rem 1rem;
  background: rgba(255, 250, 241, 0.95);
  box-shadow: 0 16px 28px rgba(24, 32, 25, 0.18);
}

.loading-spinner {
  width: 1.1rem;
  height: 1.1rem;
  border: 2px solid rgba(55, 81, 59, 0.18);
  border-top-color: #37513b;
  border-radius: 999px;
  animation: spin 0.8s linear infinite;
}

.message {
  margin: 0;
}

.error-message {
  color: #8f3131;
  font-weight: 700;
}

.mini-button {
  border: 1px solid rgba(35, 49, 39, 0.18);
  background: rgba(247, 239, 224, 0.96);
  color: #233127;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 10px 24px rgba(24, 32, 25, 0.12);
}

.mini-button {
  min-height: 2.2rem;
  padding: 0.5rem 0.72rem;
}

.mini-button:disabled,
.performance-icon-button:disabled {
  opacity: 0.62;
  cursor: default;
}

.performance-dock {
  backdrop-filter: blur(6px);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 720px) {
  .performance-stage {
    --performance-inset: 0.02rem;
    --performance-control-size: 2.7rem;
    --performance-control-gap: 0.4rem;
    --performance-float-edge: calc(var(--performance-control-size) * 0.16);
    --performance-dock-edge: calc(var(--performance-control-size) * 0.36);
    --performance-toolbar-clearance: calc(var(--performance-dock-edge) * 2.4);
    --performance-sidebar-mobile-width: min(18rem, calc(100vw - (var(--performance-float-edge) * 2) - 0.7rem));
  }

  .performance-main.with-song-list {
    gap: 0;
  }

  .performance-sidebar-overlay {
    position: absolute;
    top: var(--performance-float-edge);
    left: var(--performance-float-edge);
    bottom: var(--performance-float-edge);
    flex: 0 0 auto;
    width: var(--performance-sidebar-mobile-width);
    max-width: calc(100% - (var(--performance-float-edge) * 2));
    transform: translateX(-1rem);
  }

  .performance-sidebar-overlay.open {
    flex-basis: auto;
    width: var(--performance-sidebar-mobile-width);
    max-width: calc(100% - (var(--performance-float-edge) * 2));
  }

  .performance-list-handle {
    top: calc(var(--performance-float-edge) + var(--performance-toolbar-clearance));
    left: var(--performance-float-edge);
  }

  .performance-list-handle.open {
    left: calc(var(--performance-float-edge) + var(--performance-sidebar-mobile-width) - 1px);
  }

  .performance-sidebar-shell {
    padding: 0.58rem;
    border: 1px solid rgba(24, 32, 25, 0.2);
    background: #fffefb;
    box-shadow: 0 22px 42px rgba(24, 32, 25, 0.22);
  }
}
</style>
