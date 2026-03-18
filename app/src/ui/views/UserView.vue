<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import { isTauri } from "@tauri-apps/api/core";
import appLogo from "../assets/logo-64.png";
import ChordProEditorPane from "../components/ChordProEditorPane.vue";
import { ConfigRepository, type ConversionMode } from "../../adapters/filesystem/ConfigRepository";
import { useSongWorkspace } from "../composables/useSongWorkspace";

const {
  activePanel,
  rawInput,
  chordProText,
  loading,
  isGeneratingPreview,
  isExportingSongbook,
  error,
  previewSrc,
  previewError,
  exportError,
  exportMessage,
  songbookExportWarning,
  songbookExportError,
  songbookExportMessage,
  document,
  songbook,
  songbookError,
  selectedSongPath,
  pasteFromClipboard,
  clearAllState,
  exportCurrent,
  exportSongbookPdf,
  runPipeline,
  previewFromChordPro,
  copyToClipboard,
  openSongbookFolder,
  refreshSongbook,
  clearSongbook,
  openSongFile,
  saveDocument,
  setChordProText,
  setActivePanel
} = useSongWorkspace();

const configRepository = new ConfigRepository();
const conversionMode = ref<ConversionMode | null>(null);

const selectedModel = computed(() =>
  conversionMode.value === "fast" ? "gemini-flash-lite-latest" : "gemini-flash-latest"
);

async function convertSong(): Promise<void> {
  setActivePanel("convert");
  await runPipeline({ model: selectedModel.value });
}

function updateChordPro(value: string): void {
  setChordProText(value);
}

async function loadConversionMode(): Promise<void> {
  const config = await configRepository.load();
  conversionMode.value = config.conversionMode ?? "quality";
}

async function persistConversionMode(): Promise<void> {
  if (!conversionMode.value) {
    return;
  }

  await configRepository.update({ conversionMode: conversionMode.value });
}

onMounted(async () => {
  await loadConversionMode();
});
</script>

<template>
  <main class="user-view">
    <aside class="nav-rail" aria-label="User panels">
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
      </button>
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
    </aside>

    <header class="card user-header">
      <div>
        <div class="brand-lockup">
          <img :src="appLogo" alt="" class="brand-mark" />
          <span class="brand-title">ChordPro Studio</span>
        </div>
        <p class="eyebrow">Workspace</p>
        <h1>Convert songs and manage your ChordPro songbook</h1>
        <p class="subtitle">
          Create new chord sheets from raw text, open existing `.cho` songs from a folder and keep
          the PDF preview visible while you refine the source.
        </p>
      </div>

      <label v-if="conversionMode" class="mode-select">
        <span>Conversion mode</span>
        <select v-model="conversionMode" :disabled="loading || !conversionMode" @change="persistConversionMode">
          <option value="fast">Fast</option>
          <option value="quality">Quality</option>
        </select>
      </label>
    </header>

    <section class="work-panel">
      <div v-if="activePanel === 'convert'" class="panel-body convert-panel">
        <section class="panel card fill-card">
          <div class="panel-header secondary-header">
            <div>
              <p class="eyebrow">Convert</p>
              <h2>Original text</h2>
              <p>Paste the lyrics and chords you want to transform into ChordPro.</p>
            </div>
            <div class="panel-actions-stack align-end">
              <div class="header-actions">
                <button class="mini-button" @click="pasteFromClipboard">Paste</button>
                <button class="secondary-button" :disabled="loading" @click="clearAllState">Clear</button>
                <button class="primary-button" :disabled="loading || !conversionMode" @click="convertSong">
                  <span :class="['button-content', { loading }]">
                    <span :class="['button-spinner', { 'is-hidden': !loading }]" aria-hidden="true" />
                    <span class="button-label">{{ loading ? "Generating..." : "Generate sheet" }}</span>
                  </span>
                </button>
              </div>
              <p v-if="error" class="action-feedback error-message">{{ error }}</p>
            </div>
          </div>

          <textarea
            v-model="rawInput"
            class="input-textarea"
            placeholder="Paste the original song text here..."
          />

          <div class="embedded-editor">
            <ChordProEditorPane
              :model-value="chordProText"
              collapsible
              :initially-expanded="false"
              collapsed-label="Show ChordPro source"
              expanded-label="Hide ChordPro source"
              placeholder="ChordPro source will appear here after generation."
              @update:model-value="updateChordPro"
            >
              <template #header>
                <div>
                  <h3>Refine the source</h3>
                  <p>Edit the generated `.cho` before refreshing the preview or exporting.</p>
                </div>
              </template>
              <template #actions>
                <button class="mini-button" :disabled="loading || !isTauri() || !chordProText" @click="previewFromChordPro">
                  Refresh preview
                </button>
                <button class="mini-button" :disabled="!chordProText" @click="saveDocument">
                  Save .cho
                </button>
                <button class="mini-button" @click="copyToClipboard(chordProText)">Copy source</button>
              </template>
            </ChordProEditorPane>
          </div>
        </section>
      </div>

      <div v-else class="panel-body songbook-panel">
        <section class="panel card fill-card songbook-card">
          <div class="panel-header secondary-header">
            <div>
              <p class="eyebrow">Songbook</p>
              <h2>Folder library</h2>
              <p>Open a folder of `.cho` files, browse the list and edit the selected song.</p>
            </div>
            <div class="panel-actions-stack align-end">
              <div class="header-actions">
                <button class="mini-button" @click="openSongbookFolder">Open folder</button>
                <button class="mini-button" :disabled="!songbook" @click="refreshSongbook">Refresh</button>
                <button class="secondary-button" :disabled="!songbook" @click="clearSongbook">Clear</button>
              </div>
              <button class="mini-button" :disabled="!songbook || isExportingSongbook" @click="exportSongbookPdf">
                {{ isExportingSongbook ? "Generating songbook..." : "Export Songbook PDF" }}
              </button>
              <p v-if="songbookExportWarning" class="action-feedback warning-message">{{ songbookExportWarning }}</p>
              <p v-if="songbookExportError" class="action-feedback error-message">{{ songbookExportError }}</p>
              <p v-else-if="songbookExportMessage" class="action-feedback success-message">{{ songbookExportMessage }}</p>
              <p class="action-feedback songbook-path" :title="songbook?.path || 'No folder selected'">
                {{ songbook?.path || "No songbook folder selected." }}
              </p>
            </div>
          </div>
          <div class="songbook-meta">
            <p v-if="songbookError" class="message error-message">{{ songbookError }}</p>
          </div>

          <div class="songbook-main">
            <div v-if="songbook" class="songbook-layout">
              <aside class="song-list-panel">
                <div class="song-list-header">
                  <div>
                    <h3>Songs</h3>
                    <p>{{ songbook.songs.length }} files</p>
                  </div>
                </div>
                <div v-if="songbook.songs.length === 0" class="songbook-empty">
                  No `.cho` files were found in this folder.
                </div>
                <button
                  v-for="songEntry in songbook.songs"
                  :key="songEntry.filePath"
                  :class="['song-item', { active: selectedSongPath === songEntry.filePath }]"
                  @click="openSongFile(songEntry.filePath)"
                >
                  {{ songEntry.displayTitle }}
                </button>
              </aside>

              <section class="editor-panel card-subsection">
                <div class="editor-heading">
                  <div>
                    <h3>{{ document.fileName || 'ChordPro source' }}</h3>
                    <p>
                      {{ document.filePath || 'Open a song from the list to edit its `.cho` content.' }}
                    </p>
                  </div>
                  <span v-if="document.dirty" class="dirty-badge">Unsaved changes</span>
                </div>

                <ChordProEditorPane
                  :model-value="chordProText"
                  :rows="18"
                  placeholder="Open a song from the list to edit it here."
                  @update:model-value="updateChordPro"
                >
                  <template #actions>
                    <button class="mini-button" :disabled="!chordProText" @click="saveDocument">
                      Save .cho
                    </button>
                    <button class="mini-button" :disabled="loading || !isTauri() || !chordProText" @click="previewFromChordPro">
                      Refresh preview
                    </button>
                    <button class="mini-button" @click="copyToClipboard(chordProText)">Copy source</button>
                  </template>
                </ChordProEditorPane>
              </section>
            </div>

            <div v-else class="songbook-empty-state">
              <div class="songbook-empty large">
                Open a folder to build a simple songbook from its `.cho` files.
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>

    <section class="panel card preview-panel fill-card">
      <div class="panel-header secondary-header preview-header">
        <div>
          <p class="eyebrow">Preview</p>
          <h2>PDF preview</h2>
          <p>The preview matches the exported PDF.</p>
        </div>
        <div class="panel-actions-stack align-end">
          <div class="header-actions">
            <button class="mini-button" @click="pasteFromClipboard">Paste</button>
            <button class="mini-button" :disabled="!isTauri() || !chordProText" @click="exportCurrent">
              Export PDF (.cho)
            </button>
          </div>
          <p v-if="exportError" class="action-feedback error-message">{{ exportError }}</p>
          <p v-else-if="exportMessage" class="action-feedback success-message">{{ exportMessage }}</p>
        </div>
      </div>

      <p v-if="previewError" class="message error-message">{{ previewError }}</p>
      <p v-else-if="!isTauri()" class="message">
        Preview and export require the Tauri desktop runtime.
      </p>
      <div v-else-if="!previewSrc && isGeneratingPreview" class="preview-loading-empty">
        <div class="preview-loading-card">
          <span class="loading-spinner" aria-hidden="true" />
          <p class="message">Generating preview...</p>
        </div>
      </div>
      <p v-else-if="!previewSrc" class="message">
        Generate or open a song to see the PDF preview.
      </p>

      <div v-if="previewSrc" class="preview-viewer">
        <iframe :key="previewSrc" :src="previewSrc" class="preview-frame" title="ChordPro PDF Preview" />
        <div v-if="isGeneratingPreview" class="preview-loading-overlay">
          <div class="preview-loading-card">
            <span class="loading-spinner" aria-hidden="true" />
            <p class="message">Generating preview...</p>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.user-view {
  display: grid;
  grid-template-columns: 6rem minmax(0, 1.15fr) minmax(24rem, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
  gap: 1rem;
  min-height: 100%;
  align-items: stretch;
}

.card {
  padding: 1.25rem 1.5rem;
  border: 1px solid rgba(24, 32, 25, 0.12);
  background: rgba(255, 250, 241, 0.92);
  box-shadow: 0 18px 40px rgba(74, 58, 32, 0.08);
}

.nav-rail {
  grid-row: 1 / span 2;
  display: grid;
  align-content: start;
  gap: 0.65rem;
  padding: 0.65rem;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  border: 1px solid rgba(24, 32, 25, 0.12);
  background: rgba(255, 250, 241, 0.92);
  box-shadow: 0 18px 40px rgba(74, 58, 32, 0.08);
  overflow: hidden;
}

.nav-button {
  display: grid;
  justify-items: center;
  gap: 0.45rem;
  width: 100%;
  box-sizing: border-box;
  padding: 0.8rem 0.35rem;
  border: 0;
  background: transparent;
  color: #233127;
  font: inherit;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
}

.nav-button svg {
  width: 1.5rem;
  height: 1.5rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.nav-button.active {
  background: linear-gradient(135deg, #1f3124, #37513b);
  color: #f8f3e8;
}

.user-header {
  grid-column: 2 / -1;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
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
  font-size: 1.7rem;
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

.subtitle,
.panel p,
.message {
  margin: 0.4rem 0 0;
  color: #4a564a;
}

.eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.75rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #7a6541;
}

.mode-select {
  display: grid;
  gap: 0.25rem;
  color: #233127;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.mode-select select,
.input-textarea {
  border: 1px solid rgba(47, 59, 49, 0.16);
  background: #fffef9;
  color: #1f251f;
}

.mode-select select {
  min-width: 12rem;
  padding: 0.55rem 0.65rem;
  font: inherit;
  text-transform: none;
  letter-spacing: normal;
}

.work-panel,
.preview-panel,
.panel-body,
.panel,
.songbook-layout,
.song-list-panel,
.editor-panel {
  min-height: 0;
}

.work-panel,
.preview-panel,
.panel-body,
.songbook-card,
.convert-panel {
  display: grid;
  align-content: start;
}

.panel,
.card-subsection {
  display: grid;
  gap: 1rem;
  align-content: start;
}

.panel-header,
.secondary-header,
.editor-heading,
.song-list-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.secondary-header,
.preview-header,
.editor-heading {
  align-items: flex-start;
}

.input-textarea {
  width: 100%;
  min-height: 22rem;
  resize: vertical;
  padding: 0.9rem 1rem;
  box-sizing: border-box;
  font: inherit;
  line-height: 1.5;
}

.embedded-editor {
  padding-top: 0.75rem;
  border-top: 1px solid rgba(24, 32, 25, 0.08);
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
}

.songbook-meta {
  min-height: 0;
}

.songbook-main {
  min-height: 0;
}

.songbook-empty-state {
  display: block;
  min-height: 0;
}

.song-list-panel {
  display: grid;
  align-content: start;
  gap: 0.75rem;
}

.editor-panel {
  display: grid;
  align-content: start;
  gap: 0.75rem;
}

.song-item {
  padding: 0.75rem 0.85rem;
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
  padding: 1rem;
  border: 1px dashed rgba(47, 59, 49, 0.18);
  color: #4a564a;
}

.songbook-empty.large {
  min-height: 0;
  height: auto;
  box-sizing: border-box;
  display: grid;
  justify-items: center;
  align-content: start;
  text-align: center;
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

.preview-panel {
  align-content: start;
}

.preview-panel .message {
  text-align: center;
}

.preview-viewer {
  position: relative;
  min-height: 32rem;
}

.preview-frame {
  width: 100%;
  min-height: 32rem;
  border: 1px solid rgba(47, 59, 49, 0.12);
  background: #fff;
}

.preview-loading-empty,
.preview-loading-overlay {
  display: grid;
  place-items: center;
}

.preview-loading-empty {
  min-height: 18rem;
  border: 1px dashed rgba(47, 59, 49, 0.18);
  background: rgba(255, 255, 255, 0.4);
  align-content: center;
}

.preview-loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(28, 32, 26, 0.24);
}

.preview-loading-card {
  display: grid;
  justify-items: center;
  gap: 0.75rem;
  padding: 1rem 1.35rem;
  background: rgba(255, 250, 241, 0.95);
  box-shadow: 0 16px 28px rgba(24, 32, 25, 0.18);
}

.loading-spinner {
  width: 1.2rem;
  height: 1.2rem;
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

@media (max-width: 1180px) {
  .user-view {
    grid-template-columns: 6rem minmax(0, 1fr);
    grid-template-rows: auto auto auto;
  }

  .user-header {
    grid-column: 2;
  }

  .preview-panel {
    grid-column: 1 / -1;
  }
}

@media (max-width: 900px) {
  .user-view {
    grid-template-columns: 1fr;
    grid-template-rows: auto;
  }

  .nav-rail {
    grid-row: auto;
    grid-auto-flow: column;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .user-header,
  .work-panel,
  .preview-panel {
    grid-column: auto;
  }

  .songbook-layout {
    grid-template-columns: 1fr;
  }

  .user-header,
  .panel-header,
  .secondary-header,
  .editor-heading {
    flex-direction: column;
  }

  .panel-actions-stack.align-end {
    justify-items: start;
  }

  .songbook-path {
    text-align: left;
  }
}
</style>
