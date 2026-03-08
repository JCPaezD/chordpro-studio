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

function createProvider(): LLMProvider {
  try {
    return new OpenAIProvider("gpt-4.1-mini");
  } catch {
    try {
      return new GeminiProvider("gemini-1.5-flash");
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
    <h1>Pipeline Playground</h1>

    <section class="stage">
      <h2>Raw Input</h2>
      <textarea v-model="rawInput" rows="10" placeholder="Paste raw chord sheet text here..." />
    </section>

    <button :disabled="loading" class="run-button" @click="runPipeline">
      {{ loading ? "Running..." : "Run Pipeline" }}
    </button>

    <p v-if="error" class="error">{{ error }}</p>

    <section class="stage">
      <h2>Cleaned Text</h2>
      <textarea :value="cleanedText" rows="8" readonly />
    </section>

    <section class="stage">
      <h2>ChordPro Result</h2>
      <textarea :value="chordProText" rows="10" readonly />
    </section>

    <section class="stage">
      <h2>Song JSON</h2>
      <pre>{{ songJson }}</pre>
    </section>
  </main>
</template>

<style scoped>
.playground {
  display: grid;
  gap: 1rem;
  margin: 1.5rem;
  font-family: sans-serif;
}

.stage {
  display: grid;
  gap: 0.5rem;
}

textarea,
pre {
  width: 100%;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: "Courier New", monospace;
  font-size: 0.9rem;
  line-height: 1.4;
  padding: 0.75rem;
  box-sizing: border-box;
}

pre {
  margin: 0;
  min-height: 10rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.run-button {
  width: fit-content;
  padding: 0.5rem 1rem;
}

.error {
  color: #b00020;
  margin: 0;
}
</style>
