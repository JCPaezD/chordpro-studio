<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";

import { isTauri } from "@tauri-apps/api/core";
import { GeminiRetryError } from "../../adapters/llm/GeminiProvider";
import { TauriChordproAdapter } from "../../adapters/chordpro/TauriChordproAdapter";
import { GeminiProvider } from "../../adapters/llm/GeminiProvider";
import type { LLMProvider } from "../../adapters/llm/LLMProvider";
import { OpenAIProvider } from "../../adapters/llm/OpenAIProvider";
import { ChordProValidationError } from "../../domain/validation/ChordProOutputValidator";
import { CleaningService } from "../../services/cleaning";
import { ConversionService } from "../../services/conversion";
import { ChordProParser } from "../../services/parser/ChordProParser";
import { SongPipelineService } from "../../services/pipeline/SongPipelineService";

const rawInput = ref("");
const cleanedText = ref("");
const chordProText = ref("");
const songJson = ref("");
const loading = ref(false);
const error = ref("");
const retryLog = ref<string[]>([]);
const validationReason = ref("");
const validationRawOutput = ref("");
const previewPath = ref("");
const previewSrc = ref("");
const previewError = ref("");
const exportError = ref("");
const exportSuccess = ref("");

const chordproAdapter = new TauriChordproAdapter();

function revokePreviewUrl(): void {
  if (previewSrc.value.startsWith("blob:")) {
    URL.revokeObjectURL(previewSrc.value);
  }
}

function createPdfBlobUrl(pdfBase64: string): string {
  const binary = atob(pdfBase64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
}

async function copyToClipboard(value: string): Promise<void> {
  if (!value) {
    return;
  }

  await navigator.clipboard.writeText(value);
}

async function pasteFromClipboard(): Promise<void> {
  rawInput.value = await navigator.clipboard.readText();
}

async function refreshPreview(chordPro: string): Promise<void> {
  previewError.value = "";

  try {
    const preview = await chordproAdapter.generatePreview(chordPro);
    const nextPreviewUrl = createPdfBlobUrl(preview.pdfBase64);
    revokePreviewUrl();
    previewPath.value = preview.pdfPath;
    previewSrc.value = nextPreviewUrl;
  } catch (error) {
    previewError.value =
      error instanceof Error ? error.message : "Preview generation failed.";
  }
}

function buildSuggestedPdfPath(): string {
  if (previewPath.value.toLowerCase().endsWith("preview.pdf")) {
    return previewPath.value;
  }

  return "preview.pdf";
}

async function exportPdfFile(): Promise<void> {
  exportError.value = "";
  exportSuccess.value = "";

  try {
    if (!chordProText.value) {
      exportError.value = "No ChordPro text available to export.";
      return;
    }

    const requestedPath = window.prompt(
      "Enter the output PDF path",
      buildSuggestedPdfPath()
    );
    if (!requestedPath) {
      return;
    }

    const exportedPath = await chordproAdapter.exportPdf(
      chordProText.value,
      requestedPath
    );
    exportSuccess.value = `PDF exported to ${exportedPath}`;
  } catch (error) {
    exportError.value = error instanceof Error ? error.message : "PDF export failed.";
  }
}

function createProvider(): LLMProvider {
  try {
    return new OpenAIProvider("gpt-4.1-mini");
  } catch {
    try {
      return new GeminiProvider("gemini-flash-latest");
    } catch {
      return {
        async generate() {
          throw new Error("No LLM API key configured. Set OPENAI_API_KEY or GEMINI_API_KEY.");
        }
      };
    }
  }
}

const pipeline = new SongPipelineService(
  new CleaningService(),
  new ConversionService(createProvider()),
  new ChordProParser()
);

async function runPipeline(): Promise<void> {
  error.value = "";
  retryLog.value = [];
  validationReason.value = "";
  validationRawOutput.value = "";
  previewError.value = "";
  exportError.value = "";
  exportSuccess.value = "";
  loading.value = true;

  try {
    const result = await pipeline.process(rawInput.value);
    cleanedText.value = result.cleanedText;
    chordProText.value = result.chordPro;
    retryLog.value = result.retryLog ?? [];
    songJson.value = JSON.stringify(result.song, null, 2);
    await refreshPreview(result.chordPro);
  } catch (err) {
    if (err instanceof ChordProValidationError) {
      validationReason.value = err.details?.reason ?? "";
      validationRawOutput.value = err.details?.rawOutput ?? "";
      chordProText.value = validationRawOutput.value;
    }

    if (err instanceof GeminiRetryError) {
      retryLog.value = err.retryLog;
    }

    error.value = err instanceof Error ? err.message : "Pipeline execution failed.";
  } finally {
    loading.value = false;
  }
}

onBeforeUnmount(() => {
  revokePreviewUrl();
});
</script>

<template>
  <main class="playground">
    <header class="hero">
      <div>
        <p class="eyebrow">Developer Tool</p>
        <h1>Pipeline Playground</h1>
        <p class="subtitle">
          Raw input flows through cleaning, conversion and parsing so you can inspect each
          intermediate stage without leaving the app.
        </p>
      </div>

      <div class="actions">
        <button :disabled="loading" class="run-button" @click="runPipeline">
          {{ loading ? "Running..." : "Run Pipeline" }}
        </button>
      </div>
    </header>

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

    <section class="workspace">
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
                <p>Raw model output passed to the parser.</p>
              </div>
              <div class="panel-actions">
                <button class="mini-button" @click="copyToClipboard(chordProText)">Copy</button>
              </div>
            </div>
            <textarea :value="chordProText" rows="18" readonly />
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
            <div>
              <h2>Preview</h2>
              <p>Rendered by the bundled ChordPro CLI and loaded through the native PDF viewer.</p>
            </div>
            <div class="panel-actions">
              <button class="mini-button" :disabled="!isTauri() || !chordProText" @click="exportPdfFile">
                Export PDF
              </button>
            </div>
          </div>

          <p v-if="previewPath" class="preview-path">{{ previewPath }}</p>
          <p v-if="previewError" class="preview-message preview-error">{{ previewError }}</p>
          <p v-else-if="exportError" class="preview-message preview-error">{{ exportError }}</p>
          <p v-else-if="exportSuccess" class="preview-message preview-success">{{ exportSuccess }}</p>
          <p v-else-if="!isTauri()" class="preview-message">
            Preview and PDF export require the Tauri desktop runtime.
          </p>
          <p v-else-if="!previewSrc" class="preview-message">
            Run the pipeline to generate a ChordPro CLI preview PDF.
          </p>

          <iframe
            v-if="previewSrc"
            :key="previewSrc"
            :src="previewSrc"
            class="preview-frame"
            title="ChordPro PDF Preview"
          >
            <p class="preview-message preview-error">
              The embedded PDF preview could not be displayed.
            </p>
          </iframe>
        </section>
      </aside>
    </section>
  </main>
</template>

<style scoped>
.playground {
  display: grid;
  gap: 1.25rem;
  min-height: 100vh;
  padding: 1.5rem;
  color: #182019;
  background:
    radial-gradient(circle at top left, rgba(235, 194, 111, 0.24), transparent 28%),
    radial-gradient(circle at top right, rgba(133, 165, 129, 0.2), transparent 24%),
    linear-gradient(180deg, #f7f2e8 0%, #efe6d6 100%);
  font-family: "Trebuchet MS", "Segoe UI", sans-serif;
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
}

.map-step,
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

.workspace {
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

.stage-header {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.75rem;
  align-items: start;
}

.stage h2 {
  margin: 0;
  font-size: 1.05rem;
}

.panel-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.stage p {
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
  padding: 0.85rem 1.35rem;
  border: 0;
  background: linear-gradient(135deg, #1f3124, #37513b);
  color: #f8f3e8;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
}

.mini-button {
  width: fit-content;
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
  .workspace {
    grid-template-columns: 1fr;
  }

  .pipeline-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 800px) {
  .playground {
    padding: 1rem;
  }

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

  textarea,
  pre {
    height: 18rem;
    min-height: 18rem;
  }

  .preview-frame {
    min-height: 32rem;
  }
}
</style>
