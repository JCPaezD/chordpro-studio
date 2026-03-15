<script setup lang="ts">
import { computed, ref } from "vue";

import { isTauri } from "@tauri-apps/api/core";
import { useSongWorkspace } from "../composables/useSongWorkspace";

const {
  rawInput,
  chordProText,
  loading,
  isGeneratingPreview,
  error,
  previewSrc,
  previewError,
  exportError,
  exportMessage,
  pasteFromClipboard,
  clearAllState,
  exportCurrent,
  runPipeline,
  previewFromChordPro,
  copyToClipboard
} = useSongWorkspace();

const selectedMode = ref<"fast" | "quality">("fast");
const sourceExpanded = ref(false);

const selectedModel = computed(() =>
  selectedMode.value === "quality" ? "gemini-flash-latest" : "gemini-flash-lite-latest"
);

async function convertSong(): Promise<void> {
  await runPipeline({ model: selectedModel.value });
}
</script>

<template>
  <main class="user-view">
    <section class="hero">
      <div>
        <p class="eyebrow">Main View</p>
        <h1>Create a chord sheet</h1>
        <p class="subtitle">
          Paste the song text, generate the sheet, review the final PDF preview and export it as
          PDF or ChordPro.
        </p>
      </div>

      <label class="mode-select">
        <span>Conversion mode</span>
        <select v-model="selectedMode" :disabled="loading">
          <option value="fast">Fast</option>
          <option value="quality">Quality</option>
        </select>
      </label>
    </section>

    <div class="layout">
      <section class="panel input-panel">
        <div class="panel-header">
          <div>
            <h2>Original text</h2>
            <p>Paste the lyrics and chords you want to convert.</p>
          </div>
          <div class="panel-actions-stack">
            <div class="header-actions">
              <button class="mini-button" @click="pasteFromClipboard">Paste</button>
            <button class="secondary-button" :disabled="loading" @click="clearAllState">Clear</button>
            <button class="primary-button" :disabled="loading" @click="convertSong">
              <span :class="['button-content', { loading } ]">
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
      </section>

      <section class="panel preview-panel">
        <div class="panel-header">
          <div>
            <h2>PDF preview</h2>
            <p>The preview matches the exported PDF.</p>
          </div>
          <div class="preview-actions">
            <div class="header-actions">
              <button class="mini-button" @click="pasteFromClipboard">Paste</button>
              <button
                class="mini-button"
                :disabled="!isTauri() || !chordProText"
                @click="exportCurrent"
              >
                Export PDF (.cho)
              </button>
            </div>
            <p v-if="exportError" class="action-feedback error-message">{{ exportError }}</p>
            <p v-else-if="exportMessage" class="action-feedback success-message">
              {{ exportMessage }}
            </p>
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
          Generate the sheet to see the PDF preview.
        </p>

        <div v-if="previewSrc" class="preview-viewer">
          <iframe
            :key="previewSrc"
            :src="previewSrc"
            class="preview-frame"
            title="ChordPro PDF Preview"
          />
          <div v-if="isGeneratingPreview" class="preview-loading-overlay">
            <div class="preview-loading-card">
              <span class="loading-spinner" aria-hidden="true" />
              <p class="message">Generating preview...</p>
            </div>
          </div>
        </div>

        <section class="source-panel">
          <button class="source-toggle" @click="sourceExpanded = !sourceExpanded">
            {{ sourceExpanded ? "Hide ChordPro source" : "Show ChordPro source" }}
          </button>

          <div v-if="sourceExpanded" class="source-body">
            <textarea
              v-model="chordProText"
              class="source-textarea"
              placeholder="ChordPro source will appear here after generation."
            />

            <div class="source-actions">
              <button
                class="mini-button"
                :disabled="loading || !isTauri() || !chordProText"
                @click="previewFromChordPro"
              >
                Refresh preview
              </button>
              <button class="mini-button" @click="copyToClipboard(chordProText)">
                Copy source
              </button>
            </div>
          </div>
        </section>
      </section>
    </div>
  </main>
</template>

<style scoped>
.user-view {
  display: grid;
  gap: 1.25rem;
  min-height: 100%;
  grid-template-rows: auto minmax(0, 1fr);
}

.hero,
.panel {
  padding: 1.25rem 1.5rem;
  border: 1px solid rgba(24, 32, 25, 0.12);
  background: rgba(255, 250, 241, 0.85);
  box-shadow: 0 18px 40px rgba(74, 58, 32, 0.08);
}

.hero {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 1rem;
}

.eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.75rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #7a6541;
}

.hero h1,
.panel h2 {
  margin: 0;
}

.subtitle,
.panel p,
.message {
  color: #4a564a;
}

.subtitle {
  max-width: 46rem;
  margin: 0.65rem 0 0;
}

.mode-select {
  display: grid;
  gap: 0.25rem;
  color: #233127;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.mode-select select,
.input-textarea,
.source-textarea {
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

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(24rem, 1.15fr);
  gap: 1rem;
  align-items: stretch;
  min-height: 0;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 0;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 1rem;
}

.panel-header p {
  margin: 0.2rem 0 0;
}

.input-textarea {
  width: 100%;
  min-height: 18rem;
  flex: 1 1 auto;
  min-width: 0;
  padding: 0.9rem;
  resize: vertical;
  box-sizing: border-box;
  font: inherit;
  line-height: 1.5;
}

.header-actions,
.source-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.panel-actions-stack {
  display: grid;
  gap: 0.35rem;
  justify-items: end;
}

.preview-actions {
  display: grid;
  gap: 0.35rem;
  justify-items: end;
}

.primary-button,
.secondary-button,
.mini-button,
.source-toggle {
  width: fit-content;
  min-height: 2.5rem;
  box-sizing: border-box;
  cursor: pointer;
}

.primary-button {
  position: relative;
  width: 12.75rem;
  padding: 0.85rem 1.35rem;
  border: 0;
  background: linear-gradient(135deg, #1f3124, #37513b);
  color: #f8f3e8;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.secondary-button,
.mini-button,
.source-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.65rem 0.95rem;
  border: 1px solid rgba(35, 49, 39, 0.18);
  background: #f7f0e1;
  color: #233127;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.button-content {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 100%;
}

.button-spinner {
  position: absolute;
  left: 0;
  width: 0.95rem;
  height: 0.95rem;
  border: 0.14rem solid rgba(248, 243, 232, 0.34);
  border-top-color: #f8f3e8;
  border-radius: 999px;
  animation: spin 0.9s linear infinite;
}

.button-spinner.is-hidden {
  visibility: hidden;
}

.button-label {
  display: inline-block;
}

.button-content.loading .button-label {
  padding-left: 1.35rem;
}

.action-feedback {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.3;
  text-align: right;
  word-break: break-word;
  font-weight: 700;
}

.preview-frame {
  width: 100%;
  min-height: 20rem;
  flex: 1 1 auto;
  min-width: 0;
  border: 1px solid rgba(47, 59, 49, 0.16);
  background: #fffef9;
}

.preview-viewer {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
}

.preview-loading-empty {
  display: grid;
  place-items: center;
  min-height: 20rem;
  border: 1px solid rgba(47, 59, 49, 0.16);
  background: #fffef9;
}

.preview-loading-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(31, 37, 31, 0.24);
}

.preview-loading-card {
  display: grid;
  justify-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border: 1px solid rgba(47, 59, 49, 0.16);
  background: rgba(255, 254, 249, 0.94);
  box-shadow: 0 12px 28px rgba(35, 49, 39, 0.12);
}

.loading-spinner {
  width: 2rem;
  height: 2rem;
  border: 0.2rem solid rgba(35, 49, 39, 0.16);
  border-top-color: #233127;
  border-radius: 999px;
  animation: spin 0.9s linear infinite;
}

.source-panel {
  display: grid;
  gap: 0.75rem;
  padding-top: 0.25rem;
}

.source-toggle {
  justify-self: start;
}

.source-body {
  display: grid;
  gap: 0.75rem;
}

.source-textarea {
  width: 100%;
  min-height: 14rem;
  padding: 0.85rem;
  box-sizing: border-box;
  resize: vertical;
  font-family: "Courier New", monospace;
  font-size: 0.9rem;
  line-height: 1.4;
}

.error-message {
  color: #8b1228;
}

.success-message {
  color: #255c36;
}

@media (max-width: 1100px) {
  .layout {
    grid-template-columns: 1fr;
    align-items: start;
    min-height: auto;
  }

  .input-panel,
  .preview-panel {
    min-height: auto;
  }
}

@media (max-width: 800px) {
  .hero,
  .panel-header,
  .header-actions,
  .source-actions {
    align-items: start;
    flex-direction: column;
  }

  .panel-actions-stack,
  .preview-actions {
    justify-items: start;
  }

  .action-feedback {
    text-align: left;
  }

  .layout {
    gap: 1.25rem;
  }

  .preview-frame {
    min-height: 28rem;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
