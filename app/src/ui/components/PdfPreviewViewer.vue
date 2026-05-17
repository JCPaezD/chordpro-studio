<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, RotateCcw, ZoomIn, ZoomOut } from "lucide-vue-next";
import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
  type RenderTask
} from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

import LoadingOverlayCard from "./LoadingOverlayCard.vue";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const RESIZE_DEBOUNCE_MS = 90;
const SCROLL_DEBOUNCE_MS = 40;
const PAGE_GAP_PX = 14;
const MIN_SIZE_DELTA_PX = 8;
const TWO_PAGE_MIN_WIDTH_PX = 1080;
const MIN_ZOOM = 0.7;
const MAX_ZOOM = 2.3;
const ZOOM_STEP = 0.15;

const props = withDefaults(
  defineProps<{
    src: string;
    loading?: boolean;
    loadingMessage?: string;
    ariaLabel?: string;
    manageBlobCleanup?: boolean;
    immersive?: boolean;
    showScrollControls?: boolean;
  }>(),
  {
    loading: false,
    loadingMessage: "Generating preview...",
    ariaLabel: "PDF preview viewer",
    manageBlobCleanup: false,
    immersive: false,
    showScrollControls: false
  }
);

const pageAreaRef = ref<HTMLElement | null>(null);
const pagesRef = ref<HTMLElement | null>(null);
const displayedSrc = ref("");
const pageCount = ref(0);
const currentPage = ref(1);
const zoomFactor = ref(1);
const viewerError = ref("");
const isDocumentLoading = ref(false);
const isRendering = ref(false);
const hasDocument = ref(false);
const isDragging = ref(false);

let activeDocument: PDFDocumentProxy | null = null;
let resizeObserver: ResizeObserver | null = null;
let resizeTimer: ReturnType<typeof setTimeout> | null = null;
let scrollTimer: ReturnType<typeof setTimeout> | null = null;
let renderTasks = new Set<RenderTask>();
let loadToken = 0;
let renderToken = 0;
let lastRenderWidth = 0;
let lastRenderHeight = 0;
let dragStartX = 0;
let dragStartY = 0;
let dragStartScrollLeft = 0;
let dragStartScrollTop = 0;

type ScrollAnchor = {
  x: number;
  y: number;
};

const canUseDocumentControls = computed(() => hasDocument.value && pageCount.value > 0 && !isDocumentLoading.value);
const canGoToPreviousPage = computed(() => currentPage.value > 1 && canUseDocumentControls.value);
const canGoToNextPage = computed(() => currentPage.value < pageCount.value && canUseDocumentControls.value);
const canZoomOut = computed(() => zoomFactor.value > MIN_ZOOM && canUseDocumentControls.value);
const canZoomIn = computed(() => zoomFactor.value < MAX_ZOOM && canUseDocumentControls.value);
const zoomLabel = computed(() => `${Math.round(zoomFactor.value * 100)}%`);
const showLoadingOverlay = computed(() => props.loading || isDocumentLoading.value || isRendering.value);

function clearResizeTimer(): void {
  if (resizeTimer !== null) {
    clearTimeout(resizeTimer);
    resizeTimer = null;
  }
}

function clearScrollTimer(): void {
  if (scrollTimer !== null) {
    clearTimeout(scrollTimer);
    scrollTimer = null;
  }
}

function revokeBlobUrl(url: string): void {
  if (url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

function cancelRenderTasks(): void {
  for (const task of renderTasks) {
    task.cancel();
  }

  renderTasks.clear();
}

async function destroyDocument(pdfDocument: PDFDocumentProxy | null): Promise<void> {
  if (!pdfDocument) {
    return;
  }

  try {
    await pdfDocument.destroy();
  } catch {
    // Cancelling an in-flight PDF.js render can make destroy reject. The next render/load is still authoritative.
  }
}

function getPageAreaSize(): { width: number; height: number } {
  const pageArea = pageAreaRef.value;
  if (!pageArea) {
    return { width: 0, height: 0 };
  }

  const styles = window.getComputedStyle(pageArea);
  const horizontalPadding = Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight);
  const verticalPadding = Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom);

  return {
    width: Math.max(0, pageArea.clientWidth - horizontalPadding),
    height: Math.max(0, pageArea.clientHeight - verticalPadding)
  };
}

function resolveColumnCount(width: number, pageWidth: number, numPages: number): number {
  if (numPages < 2 || width < TWO_PAGE_MIN_WIDTH_PX || zoomFactor.value > 1.05) {
    return 1;
  }

  return width >= pageWidth * 2 + PAGE_GAP_PX ? 2 : 1;
}

function getScrollAnchor(): ScrollAnchor | null {
  const pageArea = pageAreaRef.value;
  if (!pageArea || pageArea.scrollWidth <= 0 || pageArea.scrollHeight <= 0) {
    return null;
  }

  return {
    x: (pageArea.scrollLeft + pageArea.clientWidth / 2) / pageArea.scrollWidth,
    y: (pageArea.scrollTop + pageArea.clientHeight / 2) / pageArea.scrollHeight
  };
}

function restoreScrollAnchor(anchor: ScrollAnchor | null): void {
  const pageArea = pageAreaRef.value;
  if (!pageArea || !anchor) {
    return;
  }

  pageArea.scrollLeft = Math.max(0, pageArea.scrollWidth * anchor.x - pageArea.clientWidth / 2);
  pageArea.scrollTop = Math.max(0, pageArea.scrollHeight * anchor.y - pageArea.clientHeight / 2);
}

function replaceRenderedPages(fragment: DocumentFragment, sourceUrl: string, pdfDocument: PDFDocumentProxy): void {
  const pagesRoot = pagesRef.value;
  if (!pagesRoot) {
    return;
  }

  const previousDocument = activeDocument;
  const previousSourceUrl = displayedSrc.value;
  pagesRoot.replaceChildren(fragment);
  activeDocument = pdfDocument;
  displayedSrc.value = sourceUrl;
  pageCount.value = pdfDocument.numPages;
  hasDocument.value = true;
  currentPage.value = Math.min(currentPage.value || 1, pdfDocument.numPages || 1);

  if (previousDocument && previousDocument !== pdfDocument) {
    void destroyDocument(previousDocument);
  }

  if (props.manageBlobCleanup && previousSourceUrl && previousSourceUrl !== sourceUrl) {
    revokeBlobUrl(previousSourceUrl);
  }
}

async function renderDocument(
  pdfDocument: PDFDocumentProxy,
  sourceUrl: string,
  options?: {
    commitDocument?: boolean;
    force?: boolean;
    scrollAnchor?: ScrollAnchor | null;
  }
): Promise<boolean> {
  const pagesRoot = pagesRef.value;
  const { width, height } = getPageAreaSize();
  if (!pagesRoot || width <= 0 || height <= 0) {
    return false;
  }

  const sizeChanged =
    Math.abs(width - lastRenderWidth) >= MIN_SIZE_DELTA_PX ||
    Math.abs(height - lastRenderHeight) >= MIN_SIZE_DELTA_PX;

  if (!options?.force && !sizeChanged && !options?.commitDocument) {
    return true;
  }

  const currentRenderToken = renderToken + 1;
  renderToken = currentRenderToken;
  cancelRenderTasks();
  isRendering.value = true;

  try {
    const firstPage = await pdfDocument.getPage(1);
    if (currentRenderToken !== renderToken) {
      return false;
    }

    const baseViewport = firstPage.getViewport({ scale: 1 });
    const baseScale = Math.max(0.05, height / baseViewport.height);
    const renderScale = baseScale * zoomFactor.value;
    const pageWidth = baseViewport.width * renderScale;
    const columns = resolveColumnCount(width, pageWidth, pdfDocument.numPages);
    const outputScale = window.devicePixelRatio || 1;
    const fragment = document.createDocumentFragment();

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = pageNumber === 1 ? firstPage : await pdfDocument.getPage(pageNumber);
      if (currentRenderToken !== renderToken) {
        return false;
      }

      const viewport = page.getViewport({ scale: renderScale });
      const pageShell = document.createElement("section");
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Could not create PDF canvas context.");
      }

      pageShell.className = "pdf-preview-page-shell";
      pageShell.dataset.pageNumber = String(pageNumber);
      canvas.className = "pdf-preview-canvas";
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      context.setTransform(outputScale, 0, 0, outputScale, 0, 0);

      const task = page.render({
        canvasContext: context,
        viewport
      });
      renderTasks.add(task);

      await task.promise;
      renderTasks.delete(task);

      if (currentRenderToken !== renderToken) {
        return false;
      }

      pageShell.appendChild(canvas);
      fragment.appendChild(pageShell);
    }

    if (currentRenderToken !== renderToken) {
      return false;
    }

    pagesRoot.style.setProperty("--pdf-preview-columns", String(columns));
    pagesRoot.style.setProperty("--pdf-preview-gap", `${PAGE_GAP_PX}px`);
    pagesRoot.dataset.pageCount = String(pdfDocument.numPages);
    pagesRoot.dataset.renderScale = String(renderScale);
    replaceRenderedPages(fragment, sourceUrl, pdfDocument);
    lastRenderWidth = width;
    lastRenderHeight = height;
    viewerError.value = "";
    await nextTick();
    restoreScrollAnchor(options?.scrollAnchor ?? null);
    updateCurrentPageFromScroll();
    return true;
  } catch (err) {
    if (err instanceof Error && err.name === "RenderingCancelledException") {
      return false;
    }

    if (currentRenderToken === renderToken) {
      viewerError.value = err instanceof Error ? err.message : "Could not render PDF preview.";
    }
    return false;
  } finally {
    if (currentRenderToken === renderToken) {
      renderTasks.clear();
      isRendering.value = false;
    }
  }
}

async function renderActiveDocument(force = false, scrollAnchor?: ScrollAnchor | null): Promise<void> {
  if (!activeDocument || !displayedSrc.value) {
    return;
  }

  await renderDocument(activeDocument, displayedSrc.value, { force, scrollAnchor });
}

async function loadDocument(sourceUrl: string): Promise<void> {
  const currentLoadToken = loadToken + 1;
  loadToken = currentLoadToken;
  viewerError.value = "";
  isDocumentLoading.value = true;

  try {
    await nextTick();
    const loadingTask = getDocument(sourceUrl);
    const nextDocument = await loadingTask.promise;

    if (currentLoadToken !== loadToken) {
      await destroyDocument(nextDocument);
      return;
    }

    const committed = await renderDocument(nextDocument, sourceUrl, {
      commitDocument: true,
      force: true
    });

    if (currentLoadToken === loadToken && !committed && activeDocument !== nextDocument) {
      await destroyDocument(nextDocument);
    }
  } catch (err) {
    if (currentLoadToken === loadToken) {
      viewerError.value = err instanceof Error ? err.message : "Could not load PDF preview.";
    }
  } finally {
    if (currentLoadToken === loadToken) {
      isDocumentLoading.value = false;
    }
  }
}

function clearDocument(): void {
  loadToken += 1;
  renderToken += 1;
  cancelRenderTasks();
  clearResizeTimer();
  clearScrollTimer();

  void destroyDocument(activeDocument);
  activeDocument = null;
  displayedSrc.value = "";
  pageCount.value = 0;
  currentPage.value = 1;
  hasDocument.value = false;
  viewerError.value = "";
  isDocumentLoading.value = false;
  isRendering.value = false;
  pagesRef.value?.replaceChildren();
}

function scheduleRender(force = false): void {
  clearResizeTimer();
  resizeTimer = setTimeout(() => {
    resizeTimer = null;
    void renderActiveDocument(force);
  }, RESIZE_DEBOUNCE_MS);
}

function handleWindowResize(): void {
  scheduleRender(true);
}

function getPageElements(): HTMLElement[] {
  return Array.from(pagesRef.value?.querySelectorAll<HTMLElement>(".pdf-preview-page-shell") ?? []);
}

function updateCurrentPageFromScroll(): void {
  const pageArea = pageAreaRef.value;
  if (!pageArea) {
    return;
  }

  const areaTop = pageArea.getBoundingClientRect().top;
  let nearestPage = currentPage.value;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const pageElement of getPageElements()) {
    const pageNumber = Number(pageElement.dataset.pageNumber ?? "0");
    const distance = Math.abs(pageElement.getBoundingClientRect().top - areaTop - 8);

    if (pageNumber > 0 && distance < nearestDistance) {
      nearestDistance = distance;
      nearestPage = pageNumber;
    }
  }

  currentPage.value = nearestPage;
}

function handleScroll(): void {
  clearScrollTimer();
  scrollTimer = setTimeout(() => {
    scrollTimer = null;
    updateCurrentPageFromScroll();
  }, SCROLL_DEBOUNCE_MS);
}

function scrollToPage(pageNumber: number): void {
  const boundedPage = Math.min(Math.max(pageNumber, 1), pageCount.value || 1);
  const pageElement = pagesRef.value?.querySelector<HTMLElement>(`[data-page-number="${boundedPage}"]`);
  if (!pageElement) {
    return;
  }

  pageElement.scrollIntoView({
    block: "start",
    inline: "nearest",
    behavior: "smooth"
  });
  currentPage.value = boundedPage;
}

function goToPreviousPage(): void {
  if (canGoToPreviousPage.value) {
    scrollToPage(currentPage.value - 1);
  }
}

function goToNextPage(): void {
  if (canGoToNextPage.value) {
    scrollToPage(currentPage.value + 1);
  }
}

function scrollByPages(direction: -1 | 1): void {
  const pageArea = pageAreaRef.value;
  if (!pageArea) {
    return;
  }

  pageArea.scrollBy({
    top: direction * pageArea.clientHeight * 0.82,
    behavior: "smooth"
  });
}

function handlePointerDown(event: PointerEvent): void {
  if (event.button !== 0) {
    return;
  }

  const pageArea = pageAreaRef.value;
  if (!pageArea) {
    return;
  }

  isDragging.value = true;
  dragStartX = event.clientX;
  dragStartY = event.clientY;
  dragStartScrollLeft = pageArea.scrollLeft;
  dragStartScrollTop = pageArea.scrollTop;
  pageArea.setPointerCapture(event.pointerId);
}

function handlePointerMove(event: PointerEvent): void {
  if (!isDragging.value) {
    return;
  }

  const pageArea = pageAreaRef.value;
  if (!pageArea) {
    return;
  }

  event.preventDefault();
  pageArea.scrollLeft = dragStartScrollLeft - (event.clientX - dragStartX);
  pageArea.scrollTop = dragStartScrollTop - (event.clientY - dragStartY);
}

function stopDragging(event: PointerEvent): void {
  if (!isDragging.value) {
    return;
  }

  isDragging.value = false;
  pageAreaRef.value?.releasePointerCapture(event.pointerId);
}

function zoomOut(): void {
  if (!canZoomOut.value) {
    return;
  }

  zoomFactor.value = Math.max(MIN_ZOOM, Number((zoomFactor.value - ZOOM_STEP).toFixed(2)));
}

function zoomIn(): void {
  if (!canZoomIn.value) {
    return;
  }

  zoomFactor.value = Math.min(MAX_ZOOM, Number((zoomFactor.value + ZOOM_STEP).toFixed(2)));
}

function resetZoom(): void {
  zoomFactor.value = 1;
}

watch(() => props.src, (nextSource) => {
  if (!nextSource) {
    clearDocument();
    return;
  }

  if (nextSource === displayedSrc.value) {
    return;
  }

  void loadDocument(nextSource);
}, { immediate: true });

watch(zoomFactor, () => {
  void renderActiveDocument(true, getScrollAnchor());
});

onMounted(() => {
  resizeObserver = new ResizeObserver(() => {
    scheduleRender(true);
  });

  if (pageAreaRef.value) {
    resizeObserver.observe(pageAreaRef.value);
  }

  window.addEventListener("resize", handleWindowResize);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleWindowResize);
  resizeObserver?.disconnect();
  resizeObserver = null;
  clearDocument();
});
</script>

<template>
  <div :class="['pdf-preview-viewer', { immersive }]" :aria-label="ariaLabel">
    <div class="pdf-preview-toolbar" aria-label="PDF preview controls">
      <div class="pdf-preview-toolbar-group">
        <button
          type="button"
          class="pdf-preview-button"
          aria-label="Previous page"
          title="Previous page"
          :disabled="!canGoToPreviousPage"
          @click="goToPreviousPage"
        >
          <ChevronLeft aria-hidden="true" class="pdf-preview-icon" />
        </button>
        <span class="pdf-preview-page-label" aria-live="polite">
          {{ pageCount ? `${currentPage} / ${pageCount}` : "0 / 0" }}
        </span>
        <button
          type="button"
          class="pdf-preview-button"
          aria-label="Next page"
          title="Next page"
          :disabled="!canGoToNextPage"
          @click="goToNextPage"
        >
          <ChevronRight aria-hidden="true" class="pdf-preview-icon" />
        </button>
      </div>

      <div class="pdf-preview-toolbar-group">
        <button
          type="button"
          class="pdf-preview-button"
          aria-label="Zoom out"
          title="Zoom out"
          :disabled="!canZoomOut"
          @click="zoomOut"
        >
          <ZoomOut aria-hidden="true" class="pdf-preview-icon" />
        </button>
        <button
          type="button"
          class="pdf-preview-button pdf-preview-zoom-reset"
          aria-label="Reset zoom"
          title="Reset zoom"
          :disabled="!canUseDocumentControls || zoomFactor === 1"
          @click="resetZoom"
        >
          {{ zoomLabel }}
        </button>
        <button
          type="button"
          class="pdf-preview-button"
          aria-label="Zoom in"
          title="Zoom in"
          :disabled="!canZoomIn"
          @click="zoomIn"
        >
          <ZoomIn aria-hidden="true" class="pdf-preview-icon" />
        </button>
        <button
          type="button"
          class="pdf-preview-button"
          aria-label="Refit page"
          title="Refit page"
          :disabled="!canUseDocumentControls"
          @click="resetZoom"
        >
          <RotateCcw aria-hidden="true" class="pdf-preview-icon" />
        </button>
      </div>
    </div>

    <div
      ref="pageAreaRef"
      :class="['pdf-preview-page-area', { dragging: isDragging }]"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="stopDragging"
      @pointercancel="stopDragging"
      @pointerleave="stopDragging"
      @scroll="handleScroll"
    >
      <div ref="pagesRef" class="pdf-preview-pages" />
      <div v-if="showScrollControls" class="pdf-preview-scroll-controls" aria-label="PDF scroll controls">
        <button
          type="button"
          class="pdf-preview-floating-button"
          aria-label="Scroll up"
          title="Scroll up"
          :disabled="!canUseDocumentControls"
          @click="scrollByPages(-1)"
        >
          <ChevronUp aria-hidden="true" class="pdf-preview-icon" />
        </button>
        <button
          type="button"
          class="pdf-preview-floating-button"
          aria-label="Scroll down"
          title="Scroll down"
          :disabled="!canUseDocumentControls"
          @click="scrollByPages(1)"
        >
          <ChevronDown aria-hidden="true" class="pdf-preview-icon" />
        </button>
      </div>
      <p v-if="viewerError" class="pdf-preview-error">{{ viewerError }}</p>
      <LoadingOverlayCard
        v-if="showLoadingOverlay"
        :message="loadingMessage"
      />
    </div>
  </div>
</template>

<style scoped>
.pdf-preview-viewer {
  display: flex;
  flex: 1;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  background: #f3eddf;
}

.pdf-preview-toolbar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-height: 2.9rem;
  padding: 0.38rem 0.5rem;
  border-bottom: 1px solid rgba(35, 49, 39, 0.1);
  background: rgba(247, 240, 225, 0.78);
  color: #233127;
  box-sizing: border-box;
}

.pdf-preview-toolbar-group {
  display: inline-flex;
  align-items: center;
  border: 1px solid rgba(35, 49, 39, 0.12);
  background: rgba(255, 250, 241, 0.38);
}

.pdf-preview-toolbar-group:last-child {
  border-right: 1px solid rgba(35, 49, 39, 0.12);
}

.pdf-preview-button {
  display: inline-grid;
  place-items: center;
  min-width: 2.08rem;
  min-height: 2.08rem;
  padding: 0 0.44rem;
  border: 0;
  border-right: 1px solid rgba(35, 49, 39, 0.1);
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
}

.pdf-preview-button:last-child {
  border-right: 0;
}

.pdf-preview-button:hover:not(:disabled),
.pdf-preview-floating-button:hover:not(:disabled) {
  background: rgba(35, 59, 41, 0.08);
}

.pdf-preview-button:disabled,
.pdf-preview-floating-button:disabled {
  cursor: default;
  opacity: 0.38;
}

.pdf-preview-icon {
  width: 1rem;
  height: 1rem;
}

.pdf-preview-page-label {
  min-width: 4.1rem;
  padding: 0 0.64rem;
  color: #233127;
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1;
  text-align: center;
}

.pdf-preview-zoom-reset {
  min-width: 3.15rem;
}

.pdf-preview-page-area {
  position: relative;
  flex: 1;
  width: 100%;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 0.52rem;
  box-sizing: border-box;
  background: #e8e0d1;
  cursor: grab;
  user-select: none;
}

.pdf-preview-page-area.dragging {
  cursor: grabbing;
}

.pdf-preview-pages {
  display: grid;
  grid-template-columns: repeat(var(--pdf-preview-columns, 1), max-content);
  align-items: start;
  justify-content: center;
  gap: var(--pdf-preview-gap, 14px);
  min-width: min-content;
  padding-bottom: 0.52rem;
}

:deep(.pdf-preview-page-shell) {
  display: grid;
  place-items: center;
}

:deep(.pdf-preview-canvas) {
  display: block;
  max-width: none;
  max-height: none;
  background: #fff;
  box-shadow: 0 8px 20px rgba(24, 32, 25, 0.18);
}

.pdf-preview-scroll-controls {
  position: absolute;
  z-index: 4;
  right: 0.38rem;
  bottom: 0.38rem;
  display: grid;
  gap: 0;
  pointer-events: none;
}

.pdf-preview-floating-button {
  display: inline-grid;
  place-items: center;
  width: 2.18rem;
  height: 2.18rem;
  border: 1px solid rgba(35, 49, 39, 0.14);
  border-bottom: 0;
  background: rgba(255, 250, 241, 0.92);
  color: #233127;
  box-shadow: 0 10px 20px rgba(24, 32, 25, 0.12);
  pointer-events: auto;
  cursor: pointer;
}

.pdf-preview-floating-button:last-child {
  border-bottom: 1px solid rgba(35, 49, 39, 0.14);
}

.pdf-preview-error {
  position: absolute;
  left: 0.75rem;
  right: 0.75rem;
  bottom: 0.75rem;
  z-index: 5;
  margin: 0;
  padding: 0.45rem 0.6rem;
  border: 1px solid rgba(139, 18, 40, 0.2);
  background: rgba(255, 250, 241, 0.95);
  color: #8b1228;
  font-size: 0.82rem;
  line-height: 1.35;
  text-align: center;
}

.pdf-preview-viewer.immersive {
  background: #30302f;
}

.pdf-preview-viewer.immersive .pdf-preview-toolbar {
  border-bottom-color: rgba(255, 250, 241, 0.1);
  background: #3a3a38;
  color: #fffaf1;
}

.pdf-preview-viewer.immersive .pdf-preview-toolbar-group {
  border-color: rgba(255, 250, 241, 0.12);
  background: rgba(255, 250, 241, 0.04);
}

.pdf-preview-viewer.immersive .pdf-preview-button {
  border-right-color: rgba(255, 250, 241, 0.1);
}

.pdf-preview-viewer.immersive .pdf-preview-page-label {
  color: #fffaf1;
}

.pdf-preview-viewer.immersive .pdf-preview-page-area {
  background: #30302f;
}
</style>
