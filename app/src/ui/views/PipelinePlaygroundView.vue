<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import { isTauri } from "@tauri-apps/api/core";
import appLogo from "../assets/logo-64.png";
import { useAppConfig } from "../composables/useAppConfig";
import { useSongWorkspace } from "../composables/useSongWorkspace";

const props = defineProps<{
  mode: "user" | "playground";
}>();

const emit = defineEmits<{
  "change-mode": [mode: "user" | "playground"];
}>();

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
  copyToClipboard,
  pasteFromClipboard,
  requestClearAllState,
  exportCurrent,
  runPipeline: runWorkspacePipeline,
  abortConversion,
  previewFromChordPro
} = useSongWorkspace();

const appConfig = useAppConfig();
const availableGeminiModels = ref<string[]>([
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash-lite"
]);
const selectedGeminiModel = ref<string | null>(null);
const geminiModelOverride = ref("");
const resolvedGeminiModel = computed(() => geminiModelOverride.value || selectedGeminiModel.value);

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
  if (!resolvedGeminiModel.value) {
    return;
  }

  await runWorkspacePipeline({ model: resolvedGeminiModel.value, clearBeforeRun: true });
}

function loadPlaygroundModel(): void {
  selectedGeminiModel.value = geminiModelOverride.value || (appConfig.playgroundModel.value ?? "gemini-flash-latest");
}

async function persistPlaygroundModel(): Promise<void> {
  if (!selectedGeminiModel.value || geminiModelOverride.value) {
    return;
  }

  await appConfig.setPlaygroundModel(selectedGeminiModel.value);
}

onMounted(async () => {
  geminiModelOverride.value = readGeminiModelOverride() ?? "";

  loadPlaygroundModel();
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
    <header class="card playground-header">
      <div class="header-copy">
        <div class="brand-lockup">
          <img :src="appLogo" alt="" class="brand-mark" />
          <span class="brand-title">ChordPro Studio</span>
        </div>
        <p class="eyebrow">Playground</p>
        <h1>Inspect the pipeline and preview output</h1>
        <p class="header-description">Developer view for pipeline inspection and debugging.</p>
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

    <p v-if="geminiModelOverride" class="model-override-note">
      Gemini model override active via environment: {{ geminiModelOverride }}
    </p>

    <section v-if="error" class="error card-shell">
      <div class="error-content">
        <p>{{ error }}</p>
        <p v-if="validationReason" class="error-reason">Reason: {{ validationReason }}</p>

        <section v-if="validationRawOutput" class="subpanel raw-output-panel">
          <div class="subpanel-header">
            <strong>LLM Raw Output</strong>
            <button class="mini-button" @click="copyToClipboard(validationRawOutput)">Copy Raw</button>
          </div>
          <div class="subpanel-content">
            <pre>{{ validationRawOutput }}</pre>
          </div>
        </section>
      </div>

      <button class="mini-button" @click="copyToClipboard(error)">Copy Error</button>
    </section>

    <section v-if="retryLog.length > 0" class="panel retry-panel card-shell">
      <div class="panel-header retry-log-header">
        <div>
          <h2>LLM Retries</h2>
          <p>Temporary Gemini retry events captured during conversion.</p>
        </div>
        <button class="mini-button" @click="copyToClipboard(retryLog.join('\n'))">Copy Retries</button>
      </div>
      <div class="panel-content">
        <pre>{{ retryLog.join("\n") }}</pre>
      </div>
    </section>

    <section class="playground-grid">
      <section class="panel stage stage-input raw-panel card-shell">
        <div class="panel-header stage-header raw-header">
          <span class="stage-index">01</span>
          <div class="stage-copy">
            <h2>Raw Input</h2>
                      </div>
          <div class="panel-actions raw-actions">
            <label v-if="selectedGeminiModel" class="model-select">
              <span>Model</span>
              <select
                v-model="selectedGeminiModel"
                :disabled="loading || !!geminiModelOverride"
                @change="persistPlaygroundModel"
              >
                <option v-for="model in availableGeminiModels" :key="model" :value="model">
                  {{ model }}
                </option>
              </select>
            </label>
            <button class="mini-button" @click="pasteFromClipboard">Paste</button>
            <button class="mini-button" @click="copyToClipboard(rawInput)">Copy</button>
            <button class="mini-button" :disabled="loading" @click="requestClearAllState">Clear all</button>
            <button v-if="loading" class="run-button" @click="abortConversion">
              <span class="button-content">
                <span class="button-label">Abort</span>
              </span>
            </button>
            <button v-else :disabled="!resolvedGeminiModel" class="run-button" @click="runPipeline">
              <span class="button-content">
                <span class="button-label">Run Pipeline</span>
              </span>
            </button>
          </div>
        </div>
        <div class="panel-content">
          <textarea v-model="rawInput" class="editor-monospace" placeholder="Paste raw chord sheet text here..." />
        </div>
      </section>

      <section class="panel stage card-shell">
        <div class="panel-header stage-header">
          <span class="stage-index">02</span>
          <div class="stage-copy">
            <h2>Cleaned Text</h2>
                      </div>
          <div class="panel-actions">
            <button class="mini-button" @click="copyToClipboard(cleanedText)">Copy</button>
          </div>
        </div>
        <div class="panel-content">
          <textarea :value="cleanedText" class="editor-monospace" readonly />
        </div>
      </section>

      <section class="panel stage card-shell">
        <div class="panel-header stage-header">
          <span class="stage-index">03</span>
          <div class="stage-copy">
            <h2>ChordPro Result</h2>
                      </div>
          <div class="panel-actions">
            <button class="mini-button" @click="copyToClipboard(chordProText)">Copy</button>
          </div>
        </div>
        <div class="panel-content">
          <textarea v-model="chordProText" class="editor-monospace" />
        </div>
      </section>

      <section class="panel stage card-shell">
        <div class="panel-header stage-header">
          <span class="stage-index">04</span>
          <div class="stage-copy">
            <h2>Song JSON</h2>
                      </div>
          <div class="panel-actions">
            <button class="mini-button" @click="copyToClipboard(songJson)">Copy</button>
          </div>
        </div>
        <div class="panel-content">
          <pre>{{ songJson }}</pre>
        </div>
      </section>

      <section class="panel preview-panel card-shell">
        <div class="panel-header stage-header">
          <span class="stage-index">05</span>
          <div class="stage-copy">
            <h2>Preview</h2>
                      </div>
          <div class="panel-actions preview-actions">
            <button
              class="mini-button"
              :disabled="loading || isGeneratingPreview || !isTauri() || !chordProText"
              @click="previewFromChordPro"
            >
              Refresh preview
            </button>
            <div class="export-actions">
              <button class="mini-button export-action-button" :disabled="!isTauri() || !chordProText" @click="exportCurrent('pdf')">
                Export PDF
              </button>
              <button class="mini-button export-action-button" :disabled="!isTauri() || !chordProText" @click="exportCurrent('cho')">
                Export CHO
              </button>
            </div>
          </div>
        </div>
        <div class="panel-content preview-panel-content">
          <p v-if="previewPath" class="preview-path">{{ previewPath }}</p>
          <div v-if="previewError" class="preview-state">
            <p class="preview-message preview-error">{{ previewError }}</p>
          </div>
          <div v-else-if="!isTauri()" class="preview-state">
            <p class="preview-message">Preview and export require the Tauri desktop runtime.</p>
          </div>
          <div v-else-if="!previewSrc && isGeneratingPreview" class="preview-state">
            <div class="preview-loading-card">
              <span class="loading-spinner" aria-hidden="true" />
              <p class="preview-message">Generating preview...</p>
            </div>
          </div>
          <div v-else-if="!previewSrc" class="preview-state">
            <p class="preview-message">Run the pipeline to generate a ChordPro CLI preview PDF.</p>
          </div>
          <div v-else class="preview-viewer">
            <iframe :key="previewSrc" :src="previewSrc" class="preview-frame" title="ChordPro PDF Preview" />
            <div v-if="isGeneratingPreview" class="preview-loading-overlay">
              <div class="preview-loading-card">
                <span class="loading-spinner" aria-hidden="true" />
                <p class="preview-message">Generating preview...</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </section>
  </main>
</template>

<style scoped>
.playground {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  gap: 1rem;
  overflow: hidden;
  color: #182019;
}

.card,
.card-shell {
  border: 1px solid rgba(24, 32, 25, 0.12);
  background: rgba(255, 250, 241, 0.92);
  box-shadow: 0 18px 40px rgba(74, 58, 32, 0.08);
}

.card {
  padding: 1.25rem 1.5rem;
}

.playground-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex: 0 0 auto;
}

.header-copy,
.header-controls,
.view-toggle,
.playground-grid,
.panel,
.panel-content,
.preview-panel-content,
.preview-viewer,
.preview-state,
.subpanel-content {
  min-width: 0;
  min-height: 0;
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
  font-size: 1.55rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.01em;
}

.eyebrow {
  margin: 0 0 0.3rem;
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #7a6541;
}

.playground-header h1,
.panel h2,
.subpanel strong {
  margin: 0;
}

.playground-header h1 {
  font-size: 1.18rem;
}

.header-description {
  margin: 0.45rem 0 0;
  color: #4a564a;
  font-size: 0.95rem;
}

.model-override-note {
  margin: 0;
  color: #5f6c60;
  font-size: 0.9rem;
  flex: 0 0 auto;
}

.error {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem 1.25rem;
  flex: 0 0 auto;
  color: #8b1228;
  background: rgba(255, 236, 239, 0.9);
  border-color: rgba(176, 0, 32, 0.18);
}

.error-content,
.subpanel {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.error-content {
  gap: 0.85rem;
  flex: 1;
}

.error p,
.panel p,
.preview-message,
.preview-path {
  margin: 0;
}

.error-reason,
.panel p {
  color: #5f6c60;
  font-size: 0.92rem;
}

.subpanel {
  gap: 0.65rem;
}

.subpanel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.subpanel-content {
  display: flex;
  flex: 1;
}

.retry-panel {
  display: flex;
  flex: 0 0 11rem;
  flex-direction: column;
  overflow: hidden;
}

.playground-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  grid-template-rows: minmax(0, 1fr);
  gap: 1rem;
  flex: 1;
  overflow: hidden;
}

.raw-panel {
  grid-column: span 2;
}

.panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 1rem 1rem 0.85rem;
  flex: 0 0 auto;
}

.panel-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0 1rem 1rem;
  overflow: hidden;
}

.raw-header {
  align-items: center;
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

.stage-copy {
  min-width: 0;
}

.panel-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
}

.raw-actions {
  align-items: end;
}

.preview-actions {
  align-items: flex-start;
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
  min-height: 2.75rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid rgba(35, 49, 39, 0.18);
  background: #f7f0e1;
  color: #233127;
  font: inherit;
  text-transform: none;
  letter-spacing: normal;
}

.export-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  justify-content: flex-end;
}

.export-action-button {
  min-width: 7.9rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.action-feedback {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.3;
  text-align: right;
  word-break: break-word;
}

.stage-input {
  background: linear-gradient(180deg, rgba(255, 249, 237, 0.96), rgba(250, 243, 230, 0.94));
}

.preview-panel-content {
  flex: 1;
}

.preview-path {
  color: #5f6c60;
  font-size: 0.85rem;
  word-break: break-all;
}

.preview-state,
.preview-viewer {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.preview-state {
  justify-content: center;
  align-items: center;
  border: 1px dashed rgba(47, 59, 49, 0.16);
  background: #fffef9;
  padding: 1rem;
  text-align: center;
}

.preview-viewer {
  position: relative;
}

.preview-frame {
  width: 100%;
  height: 100%;
  min-height: 0;
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

.preview-message {
  color: #5f6c60;
}

.preview-error {
  color: #8b1228;
}

.preview-success {
  color: #214d2d;
}

textarea {
  width: 100%;
  flex: 1;
  min-height: 0;
  border: 1px solid rgba(47, 59, 49, 0.16);
  border-radius: 0;
  background: #fffef9;
  color: #1f251f;
  font-family: var(--editor-monospace-family);
  font-size: 0.9rem;
  line-height: 1.4;
  padding: 0.75rem;
  box-sizing: border-box;
  resize: none;
  overflow: auto;
}

pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.run-button {
  width: 12.75rem;
  min-height: 2.75rem;
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
  min-height: 2.75rem;
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

.run-button:disabled,
.mini-button:disabled,
.model-select select:disabled {
  opacity: 0.72;
  cursor: default;
}

.loading-spinner {
  width: 2rem;
  height: 2rem;
  border: 0.2rem solid rgba(35, 49, 39, 0.16);
  border-top-color: #233127;
  border-radius: 999px;
  animation: spin 0.9s linear infinite;
}

@media (max-width: 1200px) {
  .playground-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: repeat(3, minmax(0, 1fr));
  }

  .raw-panel {
    grid-column: 1 / -1;
  }
}

@media (max-width: 800px) {
  .playground-header,
  .error,
  .retry-log-header,
  .subpanel-header,
  .panel-header,
  .raw-header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .header-controls {
    justify-items: start;
  }

  .panel-actions,
  .raw-actions,
  .preview-actions,
  .export-actions {
    justify-content: flex-start;
    justify-items: start;
  }

  .action-feedback {
    text-align: left;
  }

  .playground-grid {
    grid-template-columns: 1fr;
    grid-template-rows: repeat(5, minmax(12rem, 1fr));
  }

  .raw-panel {
    grid-column: auto;
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
