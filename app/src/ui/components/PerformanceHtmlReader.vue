<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    html: string;
    title?: string;
    artist?: string;
    loading?: boolean;
    error?: string;
    fontScale?: number;
  }>(),
  {
    title: "",
    artist: "",
    loading: false,
    error: "",
    fontScale: 1
  }
);

const scrollRef = ref<HTMLElement | null>(null);
const documentRef = ref<HTMLElement | null>(null);
const columnFitCount = ref(1);
let resizeObserver: ResizeObserver | null = null;
let layoutFrame: number | null = null;

const sanitizedHtml = computed(() => sanitizeChordProHtml(props.html));
const readerTitle = computed(() => props.title.trim());
const readerArtist = computed(() => props.artist.trim());
const readerStyle = computed(() => ({
  "--performance-reader-scale": String(props.fontScale),
  "--performance-reader-columns": String(columnFitCount.value)
}));

function sanitizeChordProHtml(html: string): string {
  if (!html.trim()) {
    return "";
  }

  const document = new DOMParser().parseFromString(html, "text/html");
  const body = document.body;

  body
    .querySelectorAll("script, style, link, meta, iframe, object, embed, form, input, button")
    .forEach((element) => element.remove());

  body.querySelectorAll("*").forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();

      if (name.startsWith("on") || name === "style" || value.startsWith("javascript:")) {
        element.removeAttribute(attribute.name);
      }
    }
  });

  return body.innerHTML;
}

function scrollToTop(): void {
  if (scrollRef.value) {
    scrollRef.value.scrollTop = 0;
    scrollRef.value.scrollLeft = 0;
  }
}

function cancelReaderLayout(): void {
  if (layoutFrame !== null) {
    cancelAnimationFrame(layoutFrame);
    layoutFrame = null;
  }
}

function scheduleReaderLayout(): void {
  cancelReaderLayout();
  layoutFrame = requestAnimationFrame(() => {
    layoutFrame = null;
    void updateReaderLayout();
  });
}

async function updateReaderLayout(): Promise<void> {
  await nextTick();

  const scrollElement = scrollRef.value;
  const documentElement = documentRef.value;
  if (!scrollElement || !documentElement || !sanitizedHtml.value) {
    columnFitCount.value = 1;
    return;
  }

  columnFitCount.value = 1;
  await nextTick();

  if (scrollElement.clientWidth < 980 || scrollElement.clientHeight < 520) {
    return;
  }

  for (const columns of [3, 2]) {
    columnFitCount.value = columns;
    await nextTick();

    const hasVerticalOverflow = scrollElement.scrollHeight > scrollElement.clientHeight + 4;
    const hasHorizontalOverflow = scrollElement.scrollWidth > scrollElement.clientWidth + 4;
    const hasColumnLineOverflow = columnContentOverflows(documentElement, columns);
    if (!hasVerticalOverflow && !hasHorizontalOverflow && !hasColumnLineOverflow) {
      return;
    }
  }

  columnFitCount.value = 1;
}

function columnContentOverflows(documentElement: HTMLElement, columns: number): boolean {
  const songElement = documentElement.querySelector(".song");
  if (!(songElement instanceof HTMLElement)) {
    return false;
  }

  const computedStyle = getComputedStyle(songElement);
  const columnGap = Number.parseFloat(computedStyle.columnGap) || 0;
  const columnWidth = (songElement.clientWidth - columnGap * (columns - 1)) / columns;
  if (columnWidth <= 0) {
    return true;
  }

  const denseElements = songElement.querySelectorAll("table.songline, .tab");
  return Array.from(denseElements).some((element) => {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    return element.scrollWidth > columnWidth + 6;
  });
}

watch(() => [sanitizedHtml.value, props.fontScale] as const, scheduleReaderLayout);

onMounted(() => {
  if (scrollRef.value) {
    resizeObserver = new ResizeObserver(scheduleReaderLayout);
    resizeObserver.observe(scrollRef.value);
  }

  scheduleReaderLayout();
});

onBeforeUnmount(() => {
  cancelReaderLayout();
  resizeObserver?.disconnect();
  resizeObserver = null;
});

defineExpose({
  scrollToTop
});
</script>

<template>
  <section class="performance-html-reader" :style="readerStyle" aria-label="Performance HTML reader">
    <header v-if="readerTitle" class="performance-reader-header">
      <h1>{{ readerTitle }}</h1>
      <p v-if="readerArtist">{{ readerArtist }}</p>
    </header>

    <div ref="scrollRef" class="performance-html-scroll">
      <div
        v-if="sanitizedHtml"
        ref="documentRef"
        :class="['performance-html-document', { 'has-fixed-title': readerTitle, 'column-fit': columnFitCount > 1 }]"
        v-html="sanitizedHtml"
      />
      <div v-else class="performance-html-empty">
        <p>{{ loading ? "Preparing reader..." : "Reader will appear when the song has renderable content." }}</p>
      </div>
    </div>

    <div v-if="loading" class="performance-html-loading" aria-live="polite">
      <span class="loading-spinner" aria-hidden="true" />
      <p>Preparing reader...</p>
    </div>

    <p v-if="error" class="performance-html-error">{{ error }}</p>
  </section>
</template>

<style scoped>
.performance-html-reader {
  position: absolute;
  inset: 0;
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background:
    linear-gradient(90deg, rgba(255, 250, 241, 0.07), transparent 18%, transparent 82%, rgba(255, 250, 241, 0.06)),
    #30302f;
}

.performance-html-scroll {
  flex: 1;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: auto;
  padding:
    clamp(4.9rem, 9vh, 6.4rem)
    clamp(1.2rem, 4vw, 4.4rem)
    clamp(2.6rem, 5vh, 4.2rem)
    max(clamp(1.2rem, 4vw, 4.4rem), var(--performance-reader-left-safe-area, 0rem));
  box-sizing: border-box;
}

.performance-reader-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 4;
  display: grid;
  gap: 0.12rem;
  align-content: start;
  box-sizing: border-box;
  min-height: 4.1rem;
  padding: 0.56rem 18rem 0.9rem clamp(4.2rem, 7vw, 7.2rem);
  background:
    linear-gradient(180deg, rgba(48, 48, 47, 0.98) 0%, rgba(48, 48, 47, 0.9) 72%, rgba(48, 48, 47, 0) 100%);
  color: #fffaf1;
  backdrop-filter: blur(7px);
  pointer-events: none;
}

.performance-reader-header h1,
.performance-reader-header p {
  overflow: hidden;
  margin: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.performance-reader-header h1 {
  font-size: clamp(1.1rem, 2.1vw, 1.9rem);
  font-weight: 850;
  line-height: 1.06;
}

.performance-reader-header p {
  color: rgba(255, 250, 241, 0.62);
  font-size: 0.96rem;
  font-weight: 650;
  line-height: 1.15;
}

.performance-html-document {
  width: min(100%, 62rem);
  margin: 0 auto;
  color: #f8f3e8;
  font-size: calc(1.12rem * var(--performance-reader-scale, 1));
  line-height: 1.55;
}

.performance-html-empty {
  display: grid;
  min-height: 100%;
  place-items: center;
  color: rgba(255, 250, 241, 0.72);
  font-size: 0.95rem;
  text-align: center;
}

.performance-html-empty p,
.performance-html-loading p,
.performance-html-error {
  margin: 0;
}

.performance-html-loading {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 5;
  display: grid;
  min-width: 11rem;
  transform: translate(-50%, -50%);
  justify-items: center;
  gap: 0.55rem;
  padding: 0.85rem 1rem;
  border: 1px solid rgba(255, 250, 241, 0.14);
  background: rgba(38, 40, 37, 0.92);
  color: #fffaf1;
  box-shadow: 0 18px 32px rgba(15, 17, 15, 0.24);
}

.performance-html-error {
  position: absolute;
  left: 50%;
  bottom: 1rem;
  z-index: 6;
  max-width: min(34rem, calc(100% - 2rem));
  transform: translateX(-50%);
  padding: 0.5rem 0.68rem;
  border: 1px solid rgba(226, 179, 129, 0.24);
  background: rgba(55, 34, 30, 0.94);
  color: #ffe0c2;
  font-size: 0.82rem;
  font-weight: 700;
  line-height: 1.35;
  text-align: center;
  box-shadow: 0 14px 24px rgba(15, 17, 15, 0.2);
}

.loading-spinner {
  width: 1.1rem;
  height: 1.1rem;
  border: 2px solid rgba(255, 250, 241, 0.18);
  border-top-color: #fffaf1;
  border-radius: 999px;
  animation: spin 0.8s linear infinite;
}

:deep(.song) {
  display: block;
}

:deep(.title) {
  margin: 0 0 0.16em;
  color: #fffaf1;
  font-size: calc(1.95em * var(--performance-reader-scale, 1));
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: 0;
}

:deep(.subtitle) {
  margin-top: -0.6em;
  color: rgba(255, 250, 241, 0.64);
  font-size: calc(0.94em * var(--performance-reader-scale, 1));
  font-weight: 600;
}

.has-fixed-title :deep(.title),
.has-fixed-title :deep(.subtitle) {
  display: none;
}

:deep(.verse),
:deep(.chorus),
:deep(.bridge),
:deep(.intro),
:deep(.outro),
:deep(.solo),
:deep(.instrumental),
:deep(.tab),
:deep(.comment),
:deep(.comment_italic) {
  max-width: 100%;
  margin: 1.18em 0;
  break-inside: avoid;
}

:deep(.verse + .comment),
:deep(.verse + .comment_italic),
:deep(.verse + .chorus),
:deep(.chorus + .comment),
:deep(.chorus + .comment_italic),
:deep(.chorus + .verse),
:deep(.bridge + .comment),
:deep(.bridge + .comment_italic),
:deep(.intro + .comment),
:deep(.intro + .comment_italic),
:deep(.solo + .comment),
:deep(.solo + .comment_italic),
:deep(.instrumental + .comment),
:deep(.instrumental + .comment_italic) {
  margin-top: 1.85em;
}

:deep(.chorus) {
  padding-left: 0;
  border-left: 0;
}

:deep(.comment),
:deep(.comment_italic),
:deep(.label) {
  margin: 1.48em 0 0.32em;
}

:deep(.comment span),
:deep(.comment_italic span),
:deep(.label) {
  display: inline-flex;
  align-items: center;
  min-height: 1.36em;
  padding: 0.14em 0.54em;
  border: 1px solid rgba(226, 179, 129, 0.16);
  background: rgba(226, 179, 129, 0.18);
  color: #e2b381;
  font-size: calc(0.82em * var(--performance-reader-scale, 1));
  font-weight: 850;
  letter-spacing: 0.09em;
  line-height: 1;
  text-transform: uppercase;
}

:deep(table.songline) {
  width: auto;
  max-width: 100%;
  margin: 0.2em 0;
  border-collapse: collapse;
  break-inside: avoid;
}

:deep(table.songline td) {
  margin: 0;
  padding: 0;
  white-space: pre;
  vertical-align: bottom;
}

:deep(table.songline tr.chords td) {
  color: #e2b381;
  font-size: calc(0.9em * var(--performance-reader-scale, 1));
  font-weight: 850;
  line-height: 1.05;
}

:deep(table.songline tr.lyrics td) {
  color: #fffaf1;
  font-size: calc(1.08em * var(--performance-reader-scale, 1));
  font-weight: 520;
  line-height: 1.22;
}

:deep(.tab) {
  overflow: auto;
  padding: 0.62em 0.72em;
  border: 1px solid rgba(255, 250, 241, 0.12);
  background: rgba(255, 250, 241, 0.06);
  color: rgba(255, 250, 241, 0.9);
  font-family: var(--editor-monospace-family);
  font-size: calc(0.88em * var(--performance-reader-scale, 1));
  line-height: 1.35;
  white-space: pre;
}

:deep(img) {
  max-width: 100%;
  height: auto;
}

.performance-html-document.column-fit {
  width: min(100%, 82rem);
}

.performance-html-document.column-fit :deep(.song) {
  column-count: var(--performance-reader-columns);
  column-gap: clamp(2.4rem, 4vw, 5rem);
  column-rule: 1px solid rgba(255, 250, 241, 0.08);
}

.performance-html-document.column-fit :deep(.title),
.performance-html-document.column-fit :deep(.subtitle) {
  column-span: all;
}

.performance-html-document.column-fit :deep(.verse),
.performance-html-document.column-fit :deep(.chorus),
.performance-html-document.column-fit :deep(.bridge),
.performance-html-document.column-fit :deep(.intro),
.performance-html-document.column-fit :deep(.outro),
.performance-html-document.column-fit :deep(.solo),
.performance-html-document.column-fit :deep(.instrumental),
.performance-html-document.column-fit :deep(.tab),
.performance-html-document.column-fit :deep(.comment),
.performance-html-document.column-fit :deep(.comment_italic),
.performance-html-document.column-fit :deep(table.songline) {
  break-inside: avoid-column;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 760px) {
  .performance-html-scroll {
    padding-top: 4.5rem;
    padding-right: 1rem;
    padding-left: max(1rem, var(--performance-reader-left-safe-area, 0rem));
  }

  .performance-reader-header {
    min-height: 4rem;
    padding-right: 4.6rem;
    padding-left: 3.8rem;
  }

  .performance-html-document {
    font-size: calc(1rem * var(--performance-reader-scale, 1));
  }
}

</style>
