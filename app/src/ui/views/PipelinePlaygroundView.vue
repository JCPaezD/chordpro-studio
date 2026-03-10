<script setup lang="ts">
import { ref } from "vue";

import { GeminiProvider } from "../../adapters/llm/GeminiProvider";
import type { LLMProvider } from "../../adapters/llm/LLMProvider";
import { OpenAIProvider } from "../../adapters/llm/OpenAIProvider";
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

async function copyToClipboard(value: string): Promise<void> {
  if (!value) {
    return;
  }

  await navigator.clipboard.writeText(value);
}

async function pasteFromClipboard(): Promise<void> {
  rawInput.value = await navigator.clipboard.readText();
}

function createProvider(): LLMProvider {
  try {
    return new OpenAIProvider("gpt-4.1-mini");
  } catch {
    try {
      return new GeminiProvider("gemini-flash-latest");
    } catch {
      return {
        async generate(): Promise<string> {
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
  loading.value = true;

  try {
    const result = await pipeline.process(rawInput.value);
    cleanedText.value = result.cleanedText;
    chordProText.value = result.chordPro;
    songJson.value = JSON.stringify(result.song, null, 2);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Pipeline execution failed.";
  } finally {
    loading.value = false;
  }
}
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
      <p>{{ error }}</p>
      <button class="mini-button" @click="copyToClipboard(error)">Copy Error</button>
    </div>

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
  align-items: center;
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

@media (max-width: 1200px) {
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

  textarea,
  pre {
    height: 18rem;
    min-height: 18rem;
  }
}
</style>
