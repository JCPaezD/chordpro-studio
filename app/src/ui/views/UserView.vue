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
  previewPath,
  previewSrc,
  previewError,
  exportError,
  exportSuccess,
  pasteFromClipboard,
  clearGeneratedState,
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
          <div class="header-actions">
            <button class="mini-button" @click="pasteFromClipboard">Paste</button>
            <button class="secondary-button" :disabled="loading" @click="clearGeneratedState">
              Clear
            </button>
            <button class="primary-button" :disabled="loading" @click="convertSong">
              {{ loading ? "Generating..." : "Generate sheet" }}
            </button>
          </div>
        </div>

        <textarea
          v-model="rawInput"
          class="input-textarea"
          placeholder="Paste the original song text here..."
        />

        <p v-if="error" class="message error-message">{{ error }}</p>
      </section>

      <section class="panel preview-panel">
        <div class="panel-header">
          <div>
            <h2>PDF preview</h2>
            <p>The preview matches the exported PDF.</p>
          </div>
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
        </div>

        <p v-if="previewPath" class="preview-path">{{ previewPath }}</p>
        <p v-if="previewError" class="message error-message">{{ previewError }}</p>
        <p v-else-if="exportError" class="message error-message">{{ exportError }}</p>
        <p v-else-if="exportSuccess" class="message success-message">
          {{ exportSuccess }}
        </p>
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

.primary-button,
.secondary-button,
.mini-button,
.source-toggle {
  width: fit-content;
  cursor: pointer;
}

.primary-button {
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
  padding: 0.45rem 0.75rem;
  border: 1px solid rgba(35, 49, 39, 0.18);
  background: #f7f0e1;
  color: #233127;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.preview-path {
  margin: 0;
  color: #5f6c60;
  font-size: 0.85rem;
  word-break: break-all;
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
  color: #214d2d;
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
