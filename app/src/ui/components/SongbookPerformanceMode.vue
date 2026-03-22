<template>
  <section class="performance-mode">
    <section class="performance-stage">
      <div class="performance-controls">
        <button class="mini-button control-button" @click="toggleSongList">
          {{ isSongListOpen ? "Hide songs" : "Songs" }}
        </button>
        <button class="mini-button control-button" @click="props.exitPerformanceMode">Exit</button>
      </div>

      <div v-if="isSongListOpen" class="performance-sidebar-backdrop" aria-hidden="true" @click="closeSongList" />

      <aside :class="['performance-sidebar-overlay', { open: isSongListOpen }]" :aria-hidden="!isSongListOpen">
        <div class="performance-sidebar-shell">
          <div class="performance-sidebar-top">
            <div class="performance-sidebar-copy">
              <p class="eyebrow">Songbook</p>
              <h1>Performance mode</h1>
              <p v-if="props.songbook">{{ props.songbook.songs.length }} files</p>
            </div>
            <button class="mini-button sidebar-close-button" @click="closeSongList">Close</button>
          </div>

          <p v-if="props.songbookError" class="message error-message">{{ props.songbookError }}</p>

          <div
            v-if="props.songbook"
            ref="songListRef"
            class="performance-song-list"
            tabindex="0"
            @keydown="handleSongListKeydown"
          >
            <div v-if="props.songbook.songs.length === 0" class="songbook-empty">
              No `.cho` files were found in this folder.
            </div>
            <button
              v-for="(songEntry, index) in props.songbook.songs"
              :key="songEntry.filePath"
              :ref="setSongItemRef(index)"
              :class="['song-item', { active: performanceSelectionIndex === index }]"
              @click="void selectSong(index, true)"
            >
              {{ songEntry.displayTitle }}
            </button>
          </div>

          <div v-else class="songbook-empty large">
            No songbook loaded.
          </div>
        </div>
      </aside>

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
        <div v-else-if="!hasBufferedPreview" class="preview-state">
          <p class="message">
            Open a song to see the PDF preview.
          </p>
        </div>
        <div v-else ref="previewViewerRef" class="preview-viewer">
          <iframe
            :src="bufferedFrameSrcA"
            class="preview-frame"
            :class="activePreviewFrame === 'A' ? 'preview-frame-active' : 'preview-frame-inactive'"
            title="ChordPro PDF Preview"
            @load="handlePreviewFrameLoad('A')"
          />
          <iframe
            :src="bufferedFrameSrcB"
            class="preview-frame"
            :class="activePreviewFrame === 'B' ? 'preview-frame-active' : 'preview-frame-inactive'"
            title="ChordPro PDF Preview"
            @load="handlePreviewFrameLoad('B')"
          />
          <div v-if="props.isRefreshingPreview" class="preview-refresh-indicator" aria-hidden="true">
            <span class="preview-refresh-spinner" />
          </div>
          <div class="performance-navigation">
            <button
              class="navigation-button"
              :disabled="!canSelectPreviousSong"
              aria-label="Previous song"
              title="Previous song"
              @click="void selectRelativeSong(-1)"
            >
              &uarr;
            </button>
            <button
              class="navigation-button"
              :disabled="!canSelectNextSong"
              aria-label="Next song"
              title="Next song"
              @click="void selectRelativeSong(1)"
            >
              &darr;
            </button>
          </div>
          <div v-if="showPreviewLoadingIndicator" class="preview-loading-overlay">
            <div class="preview-loading-card">
              <span class="loading-spinner" aria-hidden="true" />
              <p class="message">Generating preview...</p>
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
import type { Songbook } from "../../domain/songbook";
import { usePdfFit } from "../composables/usePdfFit";

type PreviewFrameId = "A" | "B";

const PREVIEW_LOADING_INDICATOR_DELAY_MS = 150;
const PREVIEW_FRAME_SWAP_DELAY_MS = 100;
const PREVIEW_FRAME_TRANSITION_MS = 180;

const props = defineProps<{
  songbook: Songbook | null;
  songbookError: string;
  selectedSongPath: string;
  currentSongTitle: string;
  isGeneratingPreview: boolean;
  isRefreshingPreview: boolean;
  previewError: string;
  previewSrc: string;
  openSong: (filePath: string) => Promise<void>;
  exitPerformanceMode: () => void;
}>();

const songListRef = ref<HTMLElement | null>(null);
const previewViewportRef = ref<HTMLElement | null>(null);
const previewViewerRef = ref<HTMLElement | null>(null);
const songItemRefs = ref<(HTMLButtonElement | null)[]>([]);
const performanceSelectionIndex = ref(-1);
const isSongListOpen = ref(true);
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
const songEntries = computed(() => props.songbook?.songs ?? []);
const canSelectPreviousSong = computed(() => performanceSelectionIndex.value > 0);
const canSelectNextSong = computed(() => {
  const songs = songEntries.value;
  return songs.length > 0 && performanceSelectionIndex.value >= 0 && performanceSelectionIndex.value < songs.length - 1;
});
const { applyFit, fitRevision, scheduleFitUpdate } = usePdfFit(previewViewerRef);
const activePreviewBaseUrl = computed(() => props.previewSrc);
const nextRenderedPreviewUrl = computed(() => applyFit(activePreviewBaseUrl.value));
const hasBufferedPreview = computed(() => !!bufferedFrameSrcA.value || !!bufferedFrameSrcB.value);

function syncPerformanceSelection(): void {
  const songs = songEntries.value;

  if (songs.length === 0) {
    performanceSelectionIndex.value = -1;
    return;
  }

  const selectedIndex = props.selectedSongPath
    ? songs.findIndex((songEntry) => songEntry.filePath === props.selectedSongPath)
    : -1;

  if (selectedIndex >= 0) {
    performanceSelectionIndex.value = selectedIndex;
    return;
  }

  if (performanceSelectionIndex.value < 0 || performanceSelectionIndex.value >= songs.length) {
    performanceSelectionIndex.value = 0;
  }
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

function setSongItemRef(index: number) {
  return (element: Element | null): void => {
    songItemRefs.value[index] = element instanceof HTMLButtonElement ? element : null;
  };
}

function scrollPerformanceSelectionIntoView(): void {
  const index = performanceSelectionIndex.value;
  if (index < 0) {
    return;
  }

  void nextTick(() => {
    songItemRefs.value[index]?.scrollIntoView({
      block: "nearest",
      behavior: "smooth"
    });
  });
}

function openSongList(): void {
  isSongListOpen.value = true;
  focusSongList();
}

function closeSongList(options?: { focusPreview?: boolean }): void {
  isSongListOpen.value = false;

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
    closeSongList();
    return;
  }

  openSongList();
}

async function selectSong(index: number, closeListAfterOpen = false): Promise<void> {
  const songEntry = songEntries.value[index];
  if (!songEntry) {
    return;
  }

  performanceSelectionIndex.value = index;
  await props.openSong(songEntry.filePath);

  if (closeListAfterOpen) {
    closeSongList({ focusPreview: true });
    return;
  }

  focusSongList();
}

async function selectRelativeSong(delta: number): Promise<void> {
  const songs = songEntries.value;
  if (songs.length === 0 || performanceSelectionIndex.value < 0) {
    return;
  }

  const nextIndex = Math.max(0, Math.min(performanceSelectionIndex.value + delta, songs.length - 1));
  if (nextIndex === performanceSelectionIndex.value) {
    return;
  }

  await selectSong(nextIndex, !isSongListOpen.value);
}

function handleSongListKeydown(event: KeyboardEvent): void {
  const songs = songEntries.value;
  if (songs.length === 0) {
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    performanceSelectionIndex.value = Math.min(performanceSelectionIndex.value + 1, songs.length - 1);
    scrollPerformanceSelectionIntoView();
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    performanceSelectionIndex.value = Math.max(performanceSelectionIndex.value - 1, 0);
    scrollPerformanceSelectionIntoView();
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    void selectSong(performanceSelectionIndex.value, true);
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

  if (isSongListOpen.value) {
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
  () => [props.songbook, props.selectedSongPath],
  () => {
    syncPerformanceSelection();
    songItemRefs.value = songItemRefs.value.slice(0, songEntries.value.length);
  },
  { immediate: true }
);

watch(isSongListOpen, (isOpen) => {
  if (isOpen) {
    focusSongList();
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
.preview-viewer,
.performance-song-list {
  min-width: 0;
  min-height: 0;
}

.performance-mode {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.performance-stage {
  position: relative;
  display: flex;
  flex: 1;
  overflow: hidden;
  padding: 0.04rem;
  border: 1px solid rgba(24, 32, 25, 0.07);
  background: rgba(255, 250, 241, 0.9);
  box-shadow: 0 18px 40px rgba(74, 58, 32, 0.08);
}

.performance-controls {
  position: absolute;
  top: 3.35rem;
  right: 0.45rem;
  z-index: 5;
  display: flex;
  gap: 0.45rem;
}

.performance-sidebar-backdrop {
  position: absolute;
  inset: 0;
  z-index: 2;
  background: rgba(18, 24, 18, 0.12);
}

.performance-sidebar-overlay {
  position: absolute;
  top: 0.45rem;
  left: 0.45rem;
  bottom: 0.45rem;
  z-index: 4;
  width: min(19rem, calc(100vw - 2rem));
  max-width: calc(100% - 0.9rem);
  pointer-events: none;
  transform: translateX(-1rem);
  opacity: 0;
  transition:
    transform 160ms ease,
    opacity 160ms ease;
}

.performance-sidebar-overlay.open {
  pointer-events: auto;
  transform: translateX(0);
  opacity: 1;
}

.performance-sidebar-shell {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  height: 100%;
  padding: 0.58rem;
  border: 1px solid rgba(24, 32, 25, 0.12);
  background: rgba(255, 250, 241, 0.97);
  box-shadow: 0 18px 32px rgba(24, 32, 25, 0.18);
  backdrop-filter: blur(6px);
}

.performance-sidebar-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.55rem;
}

.performance-sidebar-copy {
  min-width: 0;
}

.performance-sidebar-copy h1 {
  margin: 0;
  font-size: 0.98rem;
}

.performance-sidebar-copy p {
  margin: 0.16rem 0 0;
  color: #4a564a;
}

.eyebrow {
  margin: 0 0 0.18rem;
  font-size: 0.66rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #7a6541;
}

.performance-song-list {
  display: grid;
  flex: 1;
  align-content: start;
  gap: 0.3rem;
  overflow: auto;
  padding-right: 0.08rem;
  outline: none;
}

.performance-song-list:focus-visible {
  outline: 2px solid rgba(55, 81, 59, 0.35);
  outline-offset: 0.18rem;
}

.song-item {
  padding: 0.62rem 0.68rem;
  border: 1px solid rgba(35, 49, 39, 0.12);
  background: #fffef9;
  color: #233127;
  text-align: left;
  font: inherit;
  cursor: pointer;
}

.song-item.active {
  border-color: #37513b;
  background: #eef4ed;
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
}

.preview-state,
.preview-loading-empty,
.preview-loading-overlay {
  display: grid;
  place-items: center;
}

.preview-state {
  flex: 1;
  border: 1px dashed rgba(47, 59, 49, 0.18);
  background: rgba(255, 255, 255, 0.4);
  padding: 0.75rem;
  box-sizing: border-box;
}

.preview-state .message {
  margin: 0;
  color: #4a564a;
  text-align: center;
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
  border: 1px solid rgba(47, 59, 49, 0.07);
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
  display: grid;
  place-items: center;
  width: 1.8rem;
  height: 1.8rem;
  border-radius: 999px;
  background: rgba(255, 250, 241, 0.92);
  box-shadow: 0 10px 20px rgba(24, 32, 25, 0.12);
  pointer-events: none;
}

.performance-navigation {
  position: absolute;
  right: 0.45rem;
  bottom: 0.45rem;
  z-index: 5;
  display: grid;
  gap: 0.45rem;
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

.mini-button,
.navigation-button {
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

.navigation-button {
  display: grid;
  place-items: center;
  width: 2.7rem;
  height: 2.7rem;
  border-radius: 999px;
  padding: 0;
  font-size: 1.2rem;
  line-height: 1;
  backdrop-filter: blur(6px);
}

.mini-button:disabled,
.navigation-button:disabled {
  opacity: 0.62;
  cursor: default;
}

.control-button,
.sidebar-close-button {
  backdrop-filter: blur(6px);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 720px) {
  .performance-stage {
    padding: 0.02rem;
  }

  .performance-controls {
    top: 2.95rem;
    right: 0.35rem;
    gap: 0.35rem;
  }

  .performance-navigation {
    right: 0.35rem;
    bottom: 0.35rem;
    gap: 0.35rem;
  }

  .performance-sidebar-overlay {
    top: 0.35rem;
    left: 0.35rem;
    bottom: 0.35rem;
    width: min(18rem, calc(100vw - 1rem));
    max-width: calc(100% - 0.7rem);
  }
}
</style>
