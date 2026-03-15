<script setup lang="ts">
import { onMounted, ref } from "vue";

import { isTauri } from "@tauri-apps/api/core";
import appLogo from "../assets/logo-64.png";
import { useSongWorkspace } from "../composables/useSongWorkspace";

const {
  rawInput,
  cleanedText,
  chordProText,
  songJson,
  loading,
  isGeneratingPreview,
  error,
  retryLog,
  validationReason,
  validationRawOutput,
  previewPath,
  previewSrc,
  previewError,
  exportError,
  exportMessage,
  copyToClipboard,
  pasteFromClipboard,
  clearAllState,
  exportCurrent,
  runPipeline: runWorkspacePipeline,
  previewFromChordPro
} = useSongWorkspace();
const availableGeminiModels = ref<string[]>([
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash-lite"
]);
const selectedGeminiModel = ref("");
const geminiModelOverride = ref("");

function readGeminiApiKey(): string | undefined {
  const fromProcess = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env?.GEMINI_API_KEY;

  if (typeof fromProcess === "string" && fromProcess.trim().length > 0) {
    return fromProcess.trim();
  }

  const fromVite = import.meta.env?.VITE_GEMINI_API_KEY;
  if (typeof fromVite === "string" && fromVite.trim().length > 0) {
    return fromVite.trim();
  }

  return undefined;
}

function readGeminiModelOverride(): string | undefined {
  const fromProcess = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env?.GEMINI_MODEL;

  if (typeof fromProcess === "string" && fromProcess.trim().length > 0) {
    return fromProcess.trim();
  }

  const fromVite = import.meta.env?.VITE_GEMINI_MODEL;
  if (typeof fromVite === "string" && fromVite.trim().length > 0) {
    return fromVite.trim();
  }

  return undefined;
}

function resolveGeminiModel(): string {
  return geminiModelOverride.value || selectedGeminiModel.value || "gemini-2.5-flash";
}

function normalizeGeminiModelName(modelName: string): string {
  return modelName.startsWith("models/") ? modelName.slice("models/".length) : modelName;
}

async function loadGeminiModels(): Promise<void> {
  const apiKey = readGeminiApiKey();
  if (!apiKey) {
    return;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
    );

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as {
      models?: Array<{
        name?: string;
        supportedGenerationMethods?: string[];
      }>;
    };

    const discoveredModels =
      data.models
        ?.filter((model) => model.supportedGenerationMethods?.includes("generateContent"))
        .map((model) => normalizeGeminiModelName(model.name ?? ""))
        .filter((model) => model.startsWith("gemini-"))
        .filter((model, index, models) => model.length > 0 && models.indexOf(model) === index) ?? [];

    if (discoveredModels.length > 0) {
      availableGeminiModels.value = discoveredModels;
    }
  } catch {
    // Keep the fallback list when live model discovery is unavailable.
  }
}

async function runPipeline(): Promise<void> {
  await runWorkspacePipeline({ model: resolveGeminiModel(), clearBeforeRun: true });
}

onMounted(async () => {
  geminiModelOverride.value = readGeminiModelOverride() ?? "";
  selectedGeminiModel.value = geminiModelOverride.value || "gemini-2.5-flash";

  await loadGeminiModels();

  if (
    selectedGeminiModel.value &&
    !availableGeminiModels.value.includes(selectedGeminiModel.value)
  ) {
    availableGeminiModels.value = [selectedGeminiModel.value, ...availableGeminiModels.value];
  }
});
</script>

<template>
  <main class="playground">
    <header class="hero">
      <div>
        <div class="brand-lockup">
          <img :src="appLogo" alt="" class="brand-mark" />
          <span class="brand-title">ChordPro Studio</span>
        </div>
        <p class="eyebrow">Developer Tool</p>
        <h1>Pipeline Playground</h1>
        <p class="subtitle">
          Raw input flows through cleaning, conversion and parsing so you can inspect each
          intermediate stage without leaving the app.
        </p>
      </div>

      <div class="actions">
        <label class="model-select">
          <span>Model</span>
          <select v-model="selectedGeminiModel" :disabled="loading || !!geminiModelOverride">
            <option v-for="model in availableGeminiModels" :key="model" :value="model">
              {{ model }}
            </option>
          </select>
        </label>
        <button class="mini-button" :disabled="loading" @click="clearAllState">
          Clear all
        </button>
        <button :disabled="loading" class="run-button" @click="runPipeline">
          <span :class="['button-content', { loading }]">
            <span :class="['button-spinner', { 'is-hidden': !loading }]" aria-hidden="true" />
            <span class="button-label">{{ loading ? "Running..." : "Run Pipeline" }}</span>
          </span>
        </button>
      </div>
    </header>

    <p v-if="geminiModelOverride" class="model-override-note">
      Gemini model override active via environment: {{ geminiModelOverride }}
    </p>

    <div v-if="error" class="error">
      <div class="error-content">
        <p>{{ error }}</p>
        <p v-if="validationReason" class="error-reason">Reason: {{ validationReason }}</p>

        <div v-if="validationRawOutput" class="error-raw-output">
          <div class="error-raw-header">
            <strong>LLM Raw Output</strong>
            <button class="mini-button" @click="copyToClipboard(validationRawOutput)">Copy Raw</button>
          </div>
          <pre>{{ validationRawOutput }}</pre>
        </div>
      </div>

      <button class="mini-button" @click="copyToClipboard(error)">Copy Error</button>
    </div>

    <section class="workspace-layout">
      <div class="debug-column">
        <section v-if="retryLog.length > 0" class="retry-log">
          <div class="retry-log-header">
            <div>
              <h2>LLM Retries</h2>
              <p>Temporary Gemini retry events captured during conversion.</p>
            </div>
            <button class="mini-button" @click="copyToClipboard(retryLog.join('\n'))">Copy Retries</button>
          </div>
          <pre>{{ retryLog.join("\n") }}</pre>
        </section>

        <section class="pipeline-grid">
          <section class="stage stage-input">
            <div class="stage-header">
              <span class="stage-index">01</span>
              <div>
                <h2>Raw Input</h2>
                <p>Paste the original chord sheet text here.</p>
              </div>
              <div class="panel-actions">
                <button class="mini-button" @click="pasteFromClipboard">Paste</button>
                <button class="mini-button" @click="copyToClipboard(rawInput)">Copy</button>
              </div>
            </div>
            <textarea
              v-model="rawInput"
              rows="18"
              placeholder="Paste raw chord sheet text here..."
            />
          </section>

          <section class="stage">
            <div class="stage-header">
              <span class="stage-index">02</span>
              <div>
                <h2>Cleaned Text</h2>
                <p>Conservative normalization result.</p>
              </div>
              <div class="panel-actions">
                <button class="mini-button" @click="copyToClipboard(cleanedText)">Copy</button>
              </div>
            </div>
            <textarea :value="cleanedText" rows="18" readonly />
          </section>

          <section class="stage">
            <div class="stage-header">
              <span class="stage-index">03</span>
              <div>
                <h2>ChordPro Result</h2>
                <p>Editable `.cho` text used by preview and export.</p>
              </div>
              <div class="panel-actions">
                <button class="mini-button" @click="copyToClipboard(chordProText)">Copy</button>
              </div>
            </div>
            <textarea v-model="chordProText" rows="18" />
          </section>

          <section class="stage">
            <div class="stage-header">
              <span class="stage-index">04</span>
              <div>
                <h2>Song JSON</h2>
                <p>Parsed domain model snapshot.</p>
              </div>
              <div class="panel-actions">
                <button class="mini-button" @click="copyToClipboard(songJson)">Copy</button>
              </div>
            </div>
            <pre>{{ songJson }}</pre>
          </section>
        </section>
      </div>

      <aside class="preview-column">
        <section class="preview-stage">
          <div class="stage-header">
            <span class="stage-index">05</span>
            <div class="stage-copy">
              <h2>Preview</h2>
              <p>Rendered by the bundled ChordPro CLI and loaded through the native PDF viewer.</p>
            </div>
            <div class="panel-actions">
              <button
                class="mini-button"
                :disabled="loading || !isTauri() || !chordProText"
                @click="previewFromChordPro"
              >
                Refresh preview
              </button>
              <div class="export-actions">
                <button class="mini-button" :disabled="!isTauri() || !chordProText" @click="exportCurrent">
                  Export PDF (.cho)
                </button>
                <p v-if="exportError" class="action-feedback preview-error">{{ exportError }}</p>
                <p v-else-if="exportMessage" class="action-feedback preview-success">
                  {{ exportMessage }}
                </p>
              </div>
            </div>
          </div>

          <p v-if="previewPath" class="preview-path">{{ previewPath }}</p>
          <p v-if="previewError" class="preview-message preview-error">{{ previewError }}</p>
          <p v-else-if="!isTauri()" class="preview-message">
            Preview and PDF export require the Tauri desktop runtime.
          </p>
          <div v-else-if="!previewSrc && isGeneratingPreview" class="preview-loading-empty">
            <div class="preview-loading-card">
              <span class="loading-spinner" aria-hidden="true" />
              <p class="preview-message">Generating preview...</p>
            </div>
          </div>
          <p v-else-if="!previewSrc" class="preview-message">
            Run the pipeline to generate a ChordPro CLI preview PDF.
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
                <p class="preview-message">Generating preview...</p>
              </div>
            </div>
          </div>
        </section>
      </aside>
    </section>
  </main>
</template>

<style scoped>
.playground {
  display: grid;
  gap: 1.25rem;
  color: #182019;
}

.hero {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  border: 1px solid rgba(24, 32, 25, 0.12);
  background: rgba(255, 250, 241, 0.85);
  box-shadow: 0 18px 40px rgba(74, 58, 32, 0.08);
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

.eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.75rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #7a6541;
}

.hero h1 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 0.95;
}

.subtitle {
  max-width: 52rem;
  margin: 0.65rem 0 0;
  color: #4a564a;
}

.actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.model-select {
  display: grid;
  gap: 0.25rem;
  color: #233127;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.model-select select {
  min-width: 14rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid rgba(35, 49, 39, 0.18);
  background: #f7f0e1;
  color: #233127;
  font: inherit;
  text-transform: none;
  letter-spacing: normal;
}

.model-override-note {
  margin: 0;
  color: #5f6c60;
  font-size: 0.9rem;
}

.stage-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  background: #233127;
  color: #f6f1e7;
  font-size: 0.8rem;
  font-weight: 700;
}

.pipeline-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
  align-items: start;
}

.stage {
  display: grid;
  gap: 0.85rem;
  min-width: 0;
  padding: 1rem;
  border: 1px solid rgba(24, 32, 25, 0.12);
  background: rgba(255, 252, 246, 0.9);
  box-shadow: 0 18px 36px rgba(74, 58, 32, 0.08);
}

.workspace-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(22rem, 1fr);
  gap: 1rem;
  align-items: start;
}

.debug-column {
  display: grid;
  gap: 1rem;
}

.preview-column {
  min-width: 0;
}

.preview-stage {
  display: grid;
  gap: 0.85rem;
  min-width: 0;
  padding: 1rem;
  border: 1px solid rgba(24, 32, 25, 0.12);
  background: rgba(255, 252, 246, 0.9);
  box-shadow: 0 18px 36px rgba(74, 58, 32, 0.08);
}

.retry-log {
  display: grid;
  gap: 0.85rem;
  min-width: 0;
  padding: 1rem;
  border: 1px solid rgba(24, 32, 25, 0.12);
  background: rgba(255, 252, 246, 0.9);
  box-shadow: 0 18px 36px rgba(74, 58, 32, 0.08);
}

.retry-log h2 {
  margin: 0;
  font-size: 1.05rem;
}

.retry-log p {
  margin: 0.2rem 0 0;
  color: #5f6c60;
  font-size: 0.92rem;
}

.retry-log-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 1rem;
}

.retry-log pre {
  height: 10rem;
  min-height: 10rem;
}

.preview-path {
  margin: 0;
  color: #5f6c60;
  font-size: 0.85rem;
  word-break: break-all;
}

.preview-message {
  margin: 0;
  color: #5f6c60;
}

.preview-error {
  color: #8b1228;
}

.preview-success {
  color: #214d2d;
}

.preview-frame {
  width: 100%;
  min-height: 56rem;
  border: 1px solid rgba(47, 59, 49, 0.16);
  background: #fffef9;
}

.preview-viewer {
  position: relative;
  display: block;
}

.preview-loading-empty {
  display: grid;
  place-items: center;
  min-height: 24rem;
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

.stage-header {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.75rem;
  align-items: center;
}

.stage-copy {
  min-width: 0;
}

.stage h2,
.preview-stage h2 {
  margin: 0;
  font-size: 1.05rem;
}

.panel-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.export-actions {
  display: grid;
  gap: 0.35rem;
  justify-items: end;
}

.action-feedback {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.3;
  text-align: right;
  word-break: break-word;
}

.stage p,
.preview-stage p {
  margin: 0.2rem 0 0;
  color: #5f6c60;
  font-size: 0.92rem;
}

.stage-input {
  background: linear-gradient(180deg, rgba(255, 249, 237, 0.96), rgba(250, 243, 230, 0.94));
}

textarea,
pre {
  width: 100%;
  height: 28rem;
  min-height: 28rem;
  border: 1px solid rgba(47, 59, 49, 0.16);
  border-radius: 0;
  background: #fffef9;
  color: #1f251f;
  font-family: "Courier New", monospace;
  font-size: 0.9rem;
  line-height: 1.4;
  padding: 0.75rem;
  box-sizing: border-box;
  resize: vertical;
}

pre {
  margin: 0;
  display: block;
  white-space: pre-wrap;
  word-break: break-word;
  overflow: auto;
}

.run-button {
  width: fit-content;
  width: 12.75rem;
  min-height: 2.5rem;
  box-sizing: border-box;
  position: relative;
  padding: 0.85rem 1.35rem;
  border: 0;
  background: linear-gradient(135deg, #1f3124, #37513b);
  color: #f8f3e8;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
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

.mini-button {
  width: fit-content;
  min-height: 2.5rem;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 0.75rem;
  border: 1px solid rgba(35, 49, 39, 0.18);
  background: #f7f0e1;
  color: #233127;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
}

.run-button:disabled {
  cursor: wait;
  opacity: 0.72;
}

.error {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 1rem;
  padding: 0.9rem 1rem;
  margin: 0;
  border: 1px solid rgba(176, 0, 32, 0.18);
  background: rgba(255, 236, 239, 0.9);
  color: #8b1228;
}

.error p {
  margin: 0;
}

.error-content {
  display: grid;
  gap: 0.75rem;
  width: 100%;
  min-width: 0;
}

.error-reason {
  font-size: 0.92rem;
}

.error-raw-output {
  display: grid;
  gap: 0.6rem;
}

.error-raw-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.error-raw-output pre {
  height: 12rem;
  min-height: 12rem;
  background: rgba(255, 250, 245, 0.96);
}

@media (max-width: 1200px) {
  .workspace-layout {
    grid-template-columns: 1fr;
  }

  .pipeline-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 800px) {
  .hero {
    align-items: start;
    flex-direction: column;
  }

  .pipeline-grid {
    grid-template-columns: 1fr;
  }

  .error {
    align-items: start;
    flex-direction: column;
  }

  .retry-log-header {
    align-items: start;
    flex-direction: column;
  }

  .error-raw-header {
    align-items: start;
    flex-direction: column;
  }

  .export-actions {
    justify-items: start;
  }

  .action-feedback {
    text-align: left;
  }

  textarea,
  pre {
    height: 18rem;
    min-height: 18rem;
  }

  .preview-frame {
    min-height: 32rem;
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
