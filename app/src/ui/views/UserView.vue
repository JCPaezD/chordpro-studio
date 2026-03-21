<script setup lang="ts">
import { computed, ref } from "vue";

import { isTauri } from "@tauri-apps/api/core";
import appLogo from "../assets/logo-64.png";
import ChordProEditorPane from "../components/ChordProEditorPane.vue";
import { type ConversionMode } from "../../adapters/filesystem/ConfigRepository";
import { useAppConfig } from "../composables/useAppConfig";
import { useSongWorkspace } from "../composables/useSongWorkspace";

const props = defineProps<{
  mode: "user" | "playground";
}>();

const emit = defineEmits<{
  "change-mode": [mode: "user" | "playground"];
}>();

const appConfig = useAppConfig();
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
  openSongbookFolder,
  refreshSongbook,
  clearSongbook,
  openSongFile,
  saveDocument,
  setChordProText,
  setActivePanel
} = useSongWorkspace();

const showChordProEditor = ref(false);
const showApiKeyModal = ref(false);
const apiKeyDraft = ref("");
const apiKeyFeedback = ref("");
const isSavingApiKey = ref(false);

const conversionMode = computed<ConversionMode>(() => appConfig.conversionMode.value ?? "quality");
const configLoading = computed(() => appConfig.loading.value);
const hasApiKey = computed(() => !!appConfig.apiKey.value);
const canGenerate = computed(() => !configLoading.value && hasApiKey.value && !loading.value);

const selectedModel = computed(() =>
  conversionMode.value === "fast" ? "gemini-flash-lite-latest" : "gemini-flash-latest"
);

const conversionModeLabel = computed(() =>
  conversionMode.value === "fast" ? "Fast" : "Quality"
);

const apiKeyButtonLabel = computed(() => (hasApiKey.value ? "Change API Key" : "Set API Key"));

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
    <header class="card user-header">
      <div class="header-copy">
        <div class="brand-lockup">
          <img :src="appLogo" alt="" class="brand-mark" />
          <span class="brand-title">ChordPro Studio</span>
        </div>
        <p class="eyebrow">Workspace</p>
        <h1>Convert songs and manage your ChordPro songbook</h1>
      </div>

      <div class="header-controls">
        <div class="view-toggle" role="tablist" aria-label="View mode">
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
        </button>
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
                <button class="primary-button" :disabled="!canGenerate" @click="convertSong">
                  <span :class="['button-content', { loading }]">
                    <span :class="['button-spinner', { 'is-hidden': !loading }]" aria-hidden="true" />
                    <span class="button-label">{{ loading ? "Generating..." : "Generate" }}</span>
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
                    <button class="secondary-button" :disabled="loading" @click="clearAllState">Clear</button>
                  </div>
                </div>

                <textarea
                  v-model="rawInput"
                  class="input-textarea"
                  placeholder="Paste the original song text here..."
                />
              </section>

              <section v-if="showChordProEditor" class="editor-column">
                <ChordProEditorPane
                  :model-value="chordProText"
                  placeholder="ChordPro source will appear here after generation."
                  @update:model-value="updateChordPro"
                >
                  <template #header>
                    <div class="editor-heading convert-heading">
                      <div>
                        <h3>ChordPro source</h3>
                      </div>
                      <div class="header-actions">
                        <button class="mini-button" :disabled="loading || !isTauri() || !chordProText" @click="previewFromChordPro">
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
                <button class="mini-button" :disabled="!songbook || isExportingSongbook" @click="exportSongbookPdf">
                  {{ isExportingSongbook ? "Generating songbook..." : "Export Songbook PDF" }}
                </button>
              </div>
              <p v-if="songbookExportWarning" class="action-feedback warning-message">{{ songbookExportWarning }}</p>
              <p v-if="songbookExportError" class="action-feedback error-message">{{ songbookExportError }}</p>
              <p v-else-if="songbookExportMessage" class="action-feedback success-message">{{ songbookExportMessage }}</p>
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
                  <div>
                    <h3>Songs</h3>
                    <p>{{ songbook.songs.length }} files</p>
                  </div>
                </div>
                <div class="song-list-body">
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
                </div>
              </aside>

              <section class="editor-panel card-subsection">
                <div class="editor-heading">
                  <div>
                    <h3>{{ document.fileName || 'ChordPro source' }}</h3>
                    <p>
                      {{ document.filePath || 'Open a song from the list to edit its `.cho` content.' }}
                    </p>
                  </div>
                  <div class="editor-heading-aside">
                    <span v-if="document.dirty" class="dirty-badge">Unsaved changes</span>
                    <div class="header-actions">
                      <button class="mini-button" :disabled="!chordProText" @click="saveDocument">
                        Save
                      </button>
                      <button class="mini-button" :disabled="loading || !isTauri() || !chordProText" @click="previewFromChordPro">
                        Refresh
                      </button>
                    </div>
                  </div>
                </div>

                <ChordProEditorPane
                  :model-value="chordProText"
                  placeholder="Open a song from the list to edit it here."
                  @update:model-value="updateChordPro"
                />
              </section>
            </div>

            <div v-else class="songbook-empty-state">
              <div class="songbook-empty large">
                Open a folder to build a simple songbook from its `.cho` files.
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
            <div class="header-actions">
              <button class="mini-button" :disabled="!isTauri() || !chordProText" @click="exportCurrent">
                Export PDF (.cho)
              </button>
            </div>
            <p v-if="exportError" class="action-feedback error-message">{{ exportError }}</p>
            <p v-else-if="exportMessage" class="action-feedback success-message">{{ exportMessage }}</p>
          </div>
        </div>

        <div class="panel-content preview-content">
          <div v-if="previewError" class="preview-state">
            <p class="message error-message">{{ previewError }}</p>
          </div>
          <div v-else-if="!isTauri()" class="preview-state">
            <p class="message">
              Preview and export require the Tauri desktop runtime.
            </p>
          </div>
          <div v-else-if="!previewSrc && isGeneratingPreview" class="preview-state preview-loading-empty">
            <div class="preview-loading-card">
              <span class="loading-spinner" aria-hidden="true" />
              <p class="message">Generating preview...</p>
            </div>
          </div>
          <div v-else-if="!previewSrc" class="preview-state">
            <p class="message">
              Generate or open a song to see the PDF preview.
            </p>
          </div>
          <div v-else class="preview-viewer">
            <iframe :key="previewSrc" :src="previewSrc" class="preview-frame" title="ChordPro PDF Preview" />
            <div v-if="isGeneratingPreview" class="preview-loading-overlay">
              <div class="preview-loading-card">
                <span class="loading-spinner" aria-hidden="true" />
                <p class="message">Generating preview...</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </section>

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
.song-list-body,
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
  grid-template-columns: 6rem minmax(0, 1.1fr) minmax(24rem, 1fr);
  gap: 1rem;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.nav-rail {
  display: grid;
  align-content: start;
  gap: 0.65rem;
  padding: 0.65rem;
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

.song-list-body {
  display: grid;
  align-content: start;
  gap: 0.75rem;
  overflow: auto;
  padding-right: 0.25rem;
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
  text-align: center;
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
  padding: 1rem;
  box-sizing: border-box;
}

.preview-viewer {
  position: relative;
  flex: 1;
  overflow: hidden;
}

.preview-frame {
  width: 100%;
  height: 100%;
  border: 1px solid rgba(47, 59, 49, 0.12);
  background: #fff;
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
    grid-template-columns: 6rem minmax(0, 1fr);
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
  .user-main {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr) minmax(0, 1fr);
  }

  .nav-rail {
    grid-row: auto;
    grid-auto-flow: column;
    grid-template-columns: repeat(2, minmax(0, 1fr));
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







