<script setup lang="ts">
import { ref } from "vue";

import { FileText } from "lucide-vue-next";

type SongListItem = {
  filePath: string;
  title: string;
  artist: string;
};

const props = withDefaults(
  defineProps<{
    songs: SongListItem[];
    selectedSongPath?: string | null;
    activeSongPath?: string | null;
    emptyMessage?: string;
    tabindex?: number;
  }>(),
  {
    selectedSongPath: null,
    activeSongPath: null,
    emptyMessage: "No `.cho` files were found in this folder.",
    tabindex: 0
  }
);

const emit = defineEmits<{
  hover: [filePath: string];
  mousemove: [filePath: string];
  open: [filePath: string];
  wheel: [];
  focus: [];
  keydown: [event: KeyboardEvent];
}>();

const rootRef = ref<HTMLElement | null>(null);
const itemRefs = ref<(HTMLButtonElement | null)[]>([]);

function setItemRef(index: number) {
  return (element: Element | null): void => {
    itemRefs.value[index] = element instanceof HTMLButtonElement ? element : null;
  };
}

function focus(): void {
  rootRef.value?.focus();
}

function getRootElement(): HTMLElement | null {
  return rootRef.value;
}

function getItemElement(index: number): HTMLButtonElement | null {
  return itemRefs.value[index] ?? null;
}

defineExpose({
  focus,
  getRootElement,
  getItemElement
});
</script>

<template>
  <div
    ref="rootRef"
    class="song-list"
    :tabindex="tabindex"
    @focus="emit('focus')"
    @keydown="emit('keydown', $event)"
    @wheel="emit('wheel')"
  >
    <div v-if="songs.length === 0" class="songbook-empty">
      {{ emptyMessage }}
    </div>
    <button
      v-for="(songEntry, index) in songs"
      :key="songEntry.filePath"
      :ref="setItemRef(index)"
      tabindex="-1"
      :class="['song-item', {
        active: activeSongPath === songEntry.filePath,
        selected: selectedSongPath === songEntry.filePath
      }]"
      @mouseenter="emit('hover', songEntry.filePath)"
      @mousemove="emit('mousemove', songEntry.filePath)"
      @click="emit('open', songEntry.filePath)"
    >
      <span class="song-item-icon" aria-hidden="true">
        <FileText />
      </span>
      <span class="song-item-copy">
        <span class="song-item-title" :title="songEntry.title">{{ songEntry.title }}</span>
        <span class="song-item-artist" :title="songEntry.artist || ''">
          {{ songEntry.artist || "\u00A0" }}
        </span>
      </span>
    </button>
  </div>
</template>

<style scoped>
.song-list {
  display: grid;
  flex: 1;
  align-content: start;
  gap: 0.36rem;
  overflow: auto;
  padding-right: 0.25rem;
  outline: none;
  min-width: 0;
  min-height: 0;
}

.song-list:focus-visible {
  outline: 2px solid rgba(55, 81, 59, 0.35);
  outline-offset: 0.18rem;
}

.song-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 0.48rem;
  padding: 0.42rem 0.56rem;
  border: 1px solid rgba(35, 49, 39, 0.12);
  background: #fffef9;
  color: #233127;
  text-align: left;
  font: inherit;
  cursor: pointer;
  transition:
    border-color 140ms ease,
    background-color 140ms ease,
    box-shadow 140ms ease;
}

.song-item.active {
  border-color: rgba(55, 81, 59, 0.28);
  background: #f3f7f1;
}

.song-item.selected {
  border-color: #37513b;
  background: #eef4ed;
  box-shadow: 0 0 0 2px rgba(55, 81, 59, 0.16);
}

.song-item.active.selected {
  background: #e8f1e5;
  box-shadow: 0 0 0 2px rgba(55, 81, 59, 0.22);
}

.song-item-icon {
  display: inline-grid;
  place-items: center;
  width: 1.42rem;
  height: 1.42rem;
  margin-top: 0.02rem;
  color: rgba(74, 86, 74, 0.56);
}

.song-item-icon svg {
  width: 100%;
  height: 100%;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.song-item-copy {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.song-item-title,
.song-item-artist {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-item-title {
  color: #233127;
  font-size: 0.86rem;
  font-weight: 600;
  line-height: 1.2;
}

.song-item-artist {
  color: rgba(74, 86, 74, 0.82);
  font-size: 0.72rem;
  line-height: 1.15;
}

.songbook-empty {
  padding: 0.82rem;
  border: 1px dashed rgba(47, 59, 49, 0.18);
  color: #4a564a;
}
</style>
