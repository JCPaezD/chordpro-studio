<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

import { useSongWorkspace } from "./ui/composables/useSongWorkspace";
import UserView from "./ui/views/UserView.vue";
import PipelinePlaygroundView from "./ui/views/PipelinePlaygroundView.vue";

const mode = ref<"user" | "playground">("user");
const workspace = useSongWorkspace();

onMounted(async () => {
  await workspace.initialize();
});

onBeforeUnmount(() => {
  workspace.dispose();
});
</script>

<template>
  <main class="app-shell">
    <div v-show="mode === 'user'" class="view-host">
      <UserView :mode="mode" @change-mode="mode = $event" />
    </div>

    <div v-show="mode === 'playground'" class="view-host playground-shell">
      <header class="mode-bar">
        <div>
          <p class="eyebrow">ChordPro Studio</p>
          <h1>Playground</h1>
        </div>

        <div class="mode-toggle" role="tablist" aria-label="View mode">
          <button
            :class="['mode-button', { active: mode === 'user' }]"
            @click="mode = 'user'"
          >
            User
          </button>
          <button
            :class="['mode-button', { active: mode === 'playground' }]"
            @click="mode = 'playground'"
          >
            Playground
          </button>
        </div>
      </header>

      <div class="playground-host">
        <PipelinePlaygroundView />
      </div>
    </div>
  </main>
</template>

<style scoped>
.app-shell {
  display: flex;
  min-height: 0;
  height: 100dvh;
  padding: 1.5rem;
  box-sizing: border-box;
  overflow: hidden;
  background:
    radial-gradient(circle at top left, rgba(235, 194, 111, 0.24), transparent 28%),
    radial-gradient(circle at top right, rgba(133, 165, 129, 0.2), transparent 24%),
    linear-gradient(180deg, #f7f2e8 0%, #efe6d6 100%);
  color: #182019;
  font-family: "Trebuchet MS", "Segoe UI", sans-serif;
}

:global(html),
:global(body),
:global(#app) {
  height: 100%;
  margin: 0;
  overflow: hidden;
}

.mode-bar {
  z-index: 20;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border: 1px solid rgba(24, 32, 25, 0.12);
  background: #fbf4e8;
  box-shadow: 0 18px 40px rgba(74, 58, 32, 0.08);
}

.eyebrow {
  margin: 0 0 0.25rem;
  font-size: 0.75rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #7a6541;
}

.mode-bar h1 {
  margin: 0;
  font-size: 1.1rem;
}

.playground-shell {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: 1rem;
}

.playground-host,
.mode-toggle {
  min-height: 0;
}

.mode-toggle {
  display: inline-flex;
  padding: 0.25rem;
  border: 1px solid rgba(35, 49, 39, 0.18);
  background: #f7f0e1;
}

.mode-button {
  padding: 0.6rem 1rem;
  border: 0;
  background: transparent;
  color: #233127;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
}

.mode-button.active {
  background: linear-gradient(135deg, #1f3124, #37513b);
  color: #f8f3e8;
}

.view-host {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.playground-host {
  flex: 1;
  overflow: auto;
}

@media (max-width: 800px) {
  .app-shell {
    padding: 1rem;
  }

  .mode-bar {
    align-items: start;
    flex-direction: column;
  }
}
</style>
