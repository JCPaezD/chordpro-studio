<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import { isTauri } from "@tauri-apps/api/core";
import appLogo from "../assets/logo-64.png";
import type { PipelineEntryPoint } from "../../services/pipeline/SongPipelineService";
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
  hasRenderablePreviewSource,
  previewPlaceholderInfo,
  copyToClipboard,
  pasteFromClipboard,
  requestClearAllState,
  exportCurrent,
  runPipeline: runWorkspacePipeline,
  abortConversion
} = useSongWorkspace();

const appConfig = useAppConfig();
type PlaygroundStageId = "raw" | "cleaned" | "chordPro" | "json" | "preview";
type PlaygroundStageState = "input" | "fresh" | "stale";

const STAGE_ORDER: PlaygroundStageId[] = ["raw", "cleaned", "chordPro", "json", "preview"];
const STAGE_NUMBERS: Record<PlaygroundStageId, string> = {
  raw: "01",
  cleaned: "02",
  chordPro: "03",
  json: "04",
  preview: "05"
};
const STAGE_TOGGLE_LABELS: Record<PlaygroundStageId, string> = {
  raw: "Raw",
  cleaned: "Cleaned",
  chordPro: "ChordPro",
  json: "JSON",
  preview: "Preview"
};
const availableGeminiModels = ref<string[]>([
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash-lite"
]);
const selectedGeminiModel = ref<string | null>(null);
const geminiModelOverride = ref("");
const resolvedGeminiModel = computed(() => geminiModelOverride.value || selectedGeminiModel.value);
const lastPipelineEntryPoint = ref<PipelineEntryPoint | null>(null);
const lastFailedStage = ref<PlaygroundStageId | null>(null);
const panelVisibility = ref<Record<PlaygroundStageId, boolean>>({
  raw: true,
  cleaned: true,
  chordPro: true,
  json: true,
  preview: true
});

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

function entryPointStage(entryPoint: PipelineEntryPoint): PlaygroundStageId {
  if (entryPoint === "raw") {
    return "raw";
  }

  if (entryPoint === "cleaned") {
    return "cleaned";
  }

  return "chordPro";
}

function resolveFailedStage(entryPoint: PipelineEntryPoint): PlaygroundStageId | null {
  if (previewError.value) {
    return "preview";
  }

  if (!error.value && !validationReason.value) {
    return null;
  }

  return entryPoint === "chordPro" ? "json" : "chordPro";
}

function getStageState(stage: PlaygroundStageId): PlaygroundStageState {
  if (!lastPipelineEntryPoint.value) {
    return "fresh";
  }

  const sourceStage = entryPointStage(lastPipelineEntryPoint.value);
  if (stage === sourceStage) {
    return "input";
  }

  const sourceIndex = STAGE_ORDER.indexOf(sourceStage);
  const stageIndex = STAGE_ORDER.indexOf(stage);
  const failedStage = lastFailedStage.value;

  if (!failedStage) {
    return stageIndex < sourceIndex ? "stale" : "fresh";
  }

  const failedIndex = STAGE_ORDER.indexOf(failedStage);
  if (stageIndex < sourceIndex) {
    return "stale";
  }

  if (stageIndex < failedIndex) {
    return "fresh";
  }

  return "stale";
}

function getStageStatusLabel(stage: PlaygroundStageId): string {
  const state = getStageState(stage);

  if (state === "input") {
    return "Source";
  }

  if (state === "stale") {
    return "Stale";
  }

  return "";
}

function getStageError(stage: PlaygroundStageId): string {
  if (stage === "preview") {
    return previewError.value;
  }

  if (lastFailedStage.value !== stage) {
    return "";
  }

  if (error.value) {
    return error.value;
  }

  if (validationReason.value) {
    return `Reason: ${validationReason.value}`;
  }

  return "Pipeline execution failed.";
}

function stageClasses(stage: PlaygroundStageId): string[] {
  const state = getStageState(stage);
  return [
    `stage-state-${state}`,
    stage === "raw" ? "stage-input" : ""
  ].filter(Boolean);
}

function isStageVisible(stage: PlaygroundStageId): boolean {
  return panelVisibility.value[stage];
}

function toggleStageVisibility(stage: PlaygroundStageId): void {
  panelVisibility.value[stage] = !panelVisibility.value[stage];
}

async function runFromEntryPoint(entryPoint: PipelineEntryPoint): Promise<void> {
  if ((entryPoint === "raw" || entryPoint === "cleaned") && !resolvedGeminiModel.value) {
    return;
  }

  const executed = await runWorkspacePipeline({
    model: entryPoint === "chordPro" ? undefined : resolvedGeminiModel.value ?? undefined,
    clearBeforeRun: entryPoint === "raw",
    entryPoint,
    input:
      entryPoint === "raw"
        ? rawInput.value
        : entryPoint === "cleaned"
          ? cleanedText.value
          : chordProText.value
  });

  if (!executed) {
    return;
  }

  lastPipelineEntryPoint.value = entryPoint;
  lastFailedStage.value = resolveFailedStage(entryPoint);
}

async function runPipeline(): Promise<void> {
  await runFromEntryPoint("raw");
}

async function runFromCleanedText(): Promise<void> {
  await runFromEntryPoint("cleaned");
}

async function runFromChordPro(): Promise<void> {
  await runFromEntryPoint("chordPro");
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
        <h1>Inspect and rerun the pipeline</h1>
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

        <div class="header-tools">
          <label v-if="selectedGeminiModel" class="model-select playground-model-select">
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

          <div class="panel-toggle-cluster" aria-label="Panel visibility">
            <button
              v-for="stage in STAGE_ORDER"
              :key="stage"
              type="button"
              class="panel-toggle-button"
              :class="{ 'panel-toggle-button-active': isStageVisible(stage) }"
              :aria-pressed="isStageVisible(stage)"
              @click="toggleStageVisibility(stage)"
            >
              <span class="panel-toggle-index">{{ STAGE_NUMBERS[stage] }}</span>
              <span class="panel-toggle-label">{{ STAGE_TOGGLE_LABELS[stage] }}</span>
            </button>
          </div>
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
      <section v-show="isStageVisible('raw')" :class="['panel', 'stage', 'raw-panel', 'card-shell', ...stageClasses('raw')]">
        <div class="panel-header stage-header raw-header">
          <div class="stage-title-row">
            <span class="stage-index">01</span>
            <div class="stage-copy">
              <h2>Raw Input</h2>
              <span v-if="getStageStatusLabel('raw')" class="stage-status-chip">
                {{ getStageStatusLabel('raw') }}
              </span>
            </div>
          </div>
          <div class="panel-actions raw-actions">
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

      <section v-show="isStageVisible('cleaned')" :class="['panel', 'stage', 'card-shell', ...stageClasses('cleaned')]">
        <div class="panel-header stage-header">
          <div class="stage-title-row">
            <span class="stage-index">02</span>
            <div class="stage-copy">
              <h2>Cleaned Text</h2>
              <span v-if="getStageStatusLabel('cleaned')" class="stage-status-chip">
                {{ getStageStatusLabel('cleaned') }}
              </span>
              <p v-if="getStageError('cleaned')" class="stage-error">{{ getStageError("cleaned") }}</p>
            </div>
          </div>
          <div class="panel-actions">
            <button
              class="run-button run-button-secondary"
              :disabled="loading || isGeneratingPreview || !resolvedGeminiModel"
              @click="runFromCleanedText"
            >
              <span class="button-content">
                <span class="button-label">Run</span>
              </span>
            </button>
            <button class="mini-button" @click="copyToClipboard(cleanedText)">Copy</button>
          </div>
        </div>
        <div class="panel-content">
          <textarea v-model="cleanedText" class="editor-monospace" />
        </div>
      </section>

      <section v-show="isStageVisible('chordPro')" :class="['panel', 'stage', 'card-shell', ...stageClasses('chordPro')]">
        <div class="panel-header stage-header">
          <div class="stage-title-row">
            <span class="stage-index">03</span>
            <div class="stage-copy">
              <h2>ChordPro Result</h2>
              <span v-if="getStageStatusLabel('chordPro')" class="stage-status-chip">
                {{ getStageStatusLabel('chordPro') }}
              </span>
              <p v-if="getStageError('chordPro')" class="stage-error">{{ getStageError("chordPro") }}</p>
            </div>
          </div>
          <div class="panel-actions">
            <button
              class="run-button run-button-secondary"
              :disabled="loading || isGeneratingPreview || !chordProText"
              @click="runFromChordPro"
            >
              <span class="button-content">
                <span class="button-label">Run</span>
              </span>
            </button>
            <button class="mini-button" @click="copyToClipboard(chordProText)">Copy</button>
          </div>
        </div>
        <div class="panel-content">
          <textarea v-model="chordProText" class="editor-monospace" />
        </div>
      </section>

      <section v-show="isStageVisible('json')" :class="['panel', 'stage', 'card-shell', ...stageClasses('json')]">
        <div class="panel-header stage-header">
          <div class="stage-title-row">
            <span class="stage-index">04</span>
            <div class="stage-copy">
              <h2>Song JSON</h2>
              <span v-if="getStageStatusLabel('json')" class="stage-status-chip">
                {{ getStageStatusLabel('json') }}
              </span>
              <p v-if="getStageError('json')" class="stage-error">{{ getStageError("json") }}</p>
            </div>
          </div>
          <div class="panel-actions">
            <button class="mini-button" @click="copyToClipboard(songJson)">Copy</button>
          </div>
        </div>
        <div class="panel-content">
          <pre>{{ songJson }}</pre>
        </div>
      </section>

      <section v-show="isStageVisible('preview')" :class="['panel', 'preview-panel', 'card-shell', ...stageClasses('preview')]">
        <div class="panel-header stage-header">
          <div class="stage-title-row">
            <span class="stage-index">05</span>
            <div class="stage-copy">
              <h2>Preview</h2>
              <span v-if="getStageStatusLabel('preview')" class="stage-status-chip">
                {{ getStageStatusLabel('preview') }}
              </span>
              <p v-if="getStageError('preview')" class="stage-error">{{ getStageError("preview") }}</p>
            </div>
          </div>
          <div class="panel-actions preview-actions">
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
          <div
            v-else-if="!previewSrc && !hasRenderablePreviewSource && previewPlaceholderInfo.hasContext"
            class="preview-state"
          >
            <div class="preview-empty-copy">
              <div class="preview-context-block">
                <p class="preview-message preview-context-title">
                  {{ previewPlaceholderInfo.title || previewPlaceholderInfo.fileName }}
                </p>
                <p v-if="previewPlaceholderInfo.artist" class="preview-message preview-context-detail preview-context-meta">
                  {{ previewPlaceholderInfo.artist }}
                </p>
                <p v-if="previewPlaceholderInfo.album" class="preview-message preview-context-detail preview-context-meta">
                  {{ previewPlaceholderInfo.album }}
                </p>
                <p v-if="previewPlaceholderInfo.year" class="preview-message preview-context-detail preview-context-meta">
                  {{ previewPlaceholderInfo.year }}
                </p>
                <p v-if="previewPlaceholderInfo.fileName" class="preview-message preview-context-detail preview-context-meta preview-context-file-name">
                  {{ previewPlaceholderInfo.fileName }}
                </p>
              </div>
              <div class="preview-context-footer">
                <span class="preview-context-separator" aria-hidden="true" />
                <p class="preview-message preview-context-hint">Preview will appear when the song has renderable content.</p>
              </div>
            </div>
          </div>
          <div v-else-if="!previewSrc" class="preview-state">
            <div class="preview-empty-copy">
              <div class="preview-context-block">
                <p class="preview-message preview-context-title">
                  Run the pipeline to generate a ChordPro CLI preview PDF.
                </p>
              </div>
              <div class="preview-context-footer">
                <span class="preview-context-separator" aria-hidden="true" />
                <p class="preview-message preview-context-hint">
                  The preview will appear here after the pipeline produces renderable ChordPro content.
                </p>
              </div>
            </div>
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

.header-copy {
  display: block;
}

.header-controls {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  align-items: flex-end;
  align-self: stretch;
  justify-content: space-between;
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

.header-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: flex-end;
  gap: 0.75rem;
}

.panel-toggle-cluster {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  justify-content: flex-end;
  max-width: 42rem;
}

.panel-toggle-button {
  min-height: 2.7rem;
  padding: 0.35rem 0.75rem 0.35rem 0.4rem;
  border: 1px solid rgba(35, 49, 39, 0.18);
  background: rgba(247, 240, 225, 0.7);
  color: #6a756c;
  font: inherit;
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
}

.panel-toggle-button-active {
  background: linear-gradient(135deg, #1f3124, #37513b);
  color: #f8f3e8;
  border-color: rgba(31, 49, 36, 0.2);
  box-shadow: 0 10px 24px rgba(35, 49, 39, 0.12);
}

.panel-toggle-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.9rem;
  height: 1.9rem;
  border-radius: 999px;
  background: rgba(35, 49, 39, 0.14);
  color: inherit;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.panel-toggle-button-active .panel-toggle-index {
  background: rgba(248, 243, 232, 0.18);
}

.panel-toggle-label {
  white-space: nowrap;
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
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  gap: 1rem;
  flex: 1;
  min-height: 0;
  overflow: auto;
  align-content: stretch;
}

.panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto auto;
  gap: 0.7rem;
  align-items: start;
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

.stage-title-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  min-width: 0;
}

.stage-copy {
  min-width: 0;
  display: grid;
  gap: 0.3rem;
}

.stage-status-chip {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  justify-content: center;
  padding: 0.18rem 0.5rem;
  border: 1px solid rgba(35, 49, 39, 0.14);
  background: rgba(247, 240, 225, 0.9);
  color: #566359;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.stage-error {
  color: #8b1228;
  font-size: 0.84rem;
  line-height: 1.35;
}

.stage-state-input {
  border-color: rgba(31, 49, 36, 0.42);
  box-shadow: inset 0 0 0 3px rgba(31, 49, 36, 0.36), 0 18px 40px rgba(74, 58, 32, 0.08);
}

.stage-state-input .stage-status-chip {
  border-color: rgba(31, 49, 36, 0.22);
  background: rgba(31, 49, 36, 0.08);
  color: #1f3124;
}

.stage-state-stale {
  opacity: 0.5;
}

.panel-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  width: 100%;
}

.raw-actions {
  align-items: center;
}

.preview-actions {
  align-items: center;
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

.playground-model-select {
  min-width: 11.5rem;
}

.model-select select {
  min-width: 11.5rem;
  min-height: 2.5rem;
  padding: 0.45rem 0.6rem;
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

.preview-empty-copy {
  display: grid;
  gap: 0.35rem;
  justify-items: center;
  max-width: 28rem;
}

.preview-context-block {
  display: grid;
  gap: 0.18rem;
}

.preview-context-title {
  color: #314034;
  font-size: 1rem;
  font-weight: 600;
}

.preview-context-detail {
  color: rgba(95, 108, 96, 0.84);
}

.preview-context-meta {
  font-size: 0.88rem;
}

.preview-context-file-name {
  font-family: var(--editor-monospace-family);
  font-size: 0.84rem;
  letter-spacing: 0.01em;
}

.preview-context-footer {
  display: grid;
  justify-items: center;
  margin-top: 1.25rem;
  gap: 0.45rem;
}

.preview-context-separator {
  width: 4.5rem;
  border-top: 1px solid rgba(95, 108, 96, 0.18);
}

.preview-context-hint {
  width: 100%;
  color: rgba(95, 108, 96, 0.74);
  font-size: 0.87rem;
  line-height: 1.45;
  text-align: center;
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
  width: 100%;
  flex: 1;
  min-height: 0;
  margin: 0;
  border: 1px solid rgba(47, 59, 49, 0.16);
  border-radius: 0;
  background: #fffef9;
  color: #1f251f;
  font-family: "Courier New", monospace;
  font-size: 0.9rem;
  line-height: 1.4;
  padding: 0.75rem;
  box-sizing: border-box;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.run-button {
  width: auto;
  min-width: 0;
  min-height: 2.5rem;
  box-sizing: border-box;
  position: relative;
  padding: 0.65rem 0.95rem;
  border: 0;
  background: linear-gradient(135deg, #1f3124, #37513b);
  color: #f8f3e8;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
}

.run-button-secondary {
  min-height: 2.5rem;
  padding: 0.55rem 0.85rem;
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
  padding: 0.4rem 0.68rem;
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

@media (max-width: 1280px) {
  .panel-toggle-cluster {
    max-width: 32rem;
  }

  .playground-grid {
    grid-auto-flow: row;
    grid-auto-columns: auto;
    grid-template-columns: 1fr;
    grid-template-rows: none;
    grid-auto-rows: minmax(20rem, auto);
    padding-right: 0.2rem;
  }
}

@media (max-width: 800px) {
  .playground-header,
  .error,
  .retry-log-header,
  .subpanel-header,
  .raw-header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .header-controls {
    align-self: auto;
    width: 100%;
    align-items: stretch;
  }

  .header-tools {
    justify-content: flex-start;
  }

  .panel-actions,
  .raw-actions,
  .preview-actions,
  .export-actions {
    justify-content: flex-start;
    justify-items: start;
  }

  .panel-header {
    display: grid;
  }

  .panel-toggle-cluster {
    justify-content: flex-start;
    max-width: none;
  }

  .action-feedback {
    text-align: left;
  }

  .playground-grid {
    grid-template-columns: 1fr;
    grid-auto-rows: minmax(22rem, auto);
    overflow: auto;
    padding-right: 0.2rem;
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
