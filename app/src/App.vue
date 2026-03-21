<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import { useAppConfig } from "./ui/composables/useAppConfig";
import { useSongWorkspace } from "./ui/composables/useSongWorkspace";
import UserView from "./ui/views/UserView.vue";
import PipelinePlaygroundView from "./ui/views/PipelinePlaygroundView.vue";

const isDev = import.meta.env.DEV;
const mode = ref<"user" | "playground">("user");
const appConfig = useAppConfig();
const configLoading = computed(() => appConfig.loading.value);
const workspace = useSongWorkspace({ appConfig });

onMounted(async () => {
  await appConfig.loadConfig();
  await workspace.initialize();
});

onBeforeUnmount(() => {
  workspace.dispose();
});
</script>

<template>
  <main class="app-shell">
    <div v-if="configLoading" class="boot-screen">
      <div class="boot-card">
        <p class="eyebrow">ChordPro Studio</p>
        <h1>Loading workspace...</h1>
      </div>
    </div>

    <template v-else>
      <div v-show="mode === 'user' || !isDev" class="view-host">
        <UserView :mode="mode" @change-mode="mode = $event" />
      </div>

      <div v-if="isDev" v-show="mode === 'playground'" class="view-host">
        <PipelinePlaygroundView :mode="mode" @change-mode="mode = $event" />
      </div>
    </template>
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

.boot-screen {
  display: grid;
  flex: 1;
  place-items: center;
}

.boot-card {
  padding: 1.5rem 1.75rem;
  border: 1px solid rgba(24, 32, 25, 0.12);
  background: rgba(255, 250, 241, 0.92);
  box-shadow: 0 18px 40px rgba(74, 58, 32, 0.08);
}

.boot-card h1 {
  margin: 0;
}

.eyebrow {
  margin: 0 0 0.25rem;
  font-size: 0.75rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #7a6541;
}

.view-host {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

@media (max-width: 800px) {
  .app-shell {
    padding: 1rem;
  }
}
</style>
