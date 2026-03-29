<script setup lang="ts">
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";

import FeedbackToast from "./ui/components/FeedbackToast.vue";
import SaveFilenameMismatchModal from "./ui/components/SaveFilenameMismatchModal.vue";
import UnsavedContentModal from "./ui/components/UnsavedContentModal.vue";
import logo64 from "./ui/assets/logo-64.png";
import { useAppConfig } from "./ui/composables/useAppConfig";
import { useSongWorkspace } from "./ui/composables/useSongWorkspace";
import UserView from "./ui/views/UserView.vue";
import PipelinePlaygroundView from "./ui/views/PipelinePlaygroundView.vue";

const isDev = import.meta.env.DEV;
const mode = ref<"user" | "playground">("user");
const isImmersive = ref(false);
const appConfig = useAppConfig();
const configLoading = computed(() => appConfig.loading.value);
const workspace = useSongWorkspace({ appConfig });
const bootVisible = ref(true);
const bootStatus = ref("Loading...");
let hasShownMainWindow = false;

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

async function settleInitialUi(): Promise<void> {
  await nextTick();
  await waitForNextFrame();
  await waitForNextFrame();
}

async function showMainWindowWhenBootReady(): Promise<void> {
  if (hasShownMainWindow || !isTauri()) {
    return;
  }

  await settleInitialUi();

  try {
    await getCurrentWindow().show();
    hasShownMainWindow = true;
  } catch (err) {
    console.error("Could not show main window after boot loader render.", err);
  }
}

async function initializeApp(): Promise<void> {
  try {
    bootStatus.value = "Preparing window...";
    await showMainWindowWhenBootReady();
    bootStatus.value = "Loading config...";
    await appConfig.loadConfig();
    bootStatus.value = "Restoring workspace...";
    await workspace.initialize();
    bootStatus.value = "Finalizing UI...";
    await settleInitialUi();
  } catch (err) {
    console.error("App initialization failed.", err);
    bootStatus.value = "Startup failed";
  } finally {
    bootVisible.value = false;
  }
}

onMounted(() => {
  void initializeApp();
});

onBeforeUnmount(() => {
  workspace.dispose();
});
</script>

<template>
  <main :class="['app-shell', { immersive: isImmersive }]">
    <div v-if="!configLoading" class="view-host-layer">
      <div v-show="mode === 'user' || !isDev" class="view-host">
        <UserView :mode="mode" @change-mode="mode = $event" @immersive-change="isImmersive = $event" />
      </div>

      <div v-if="isDev" v-show="mode === 'playground'" class="view-host">
        <PipelinePlaygroundView :mode="mode" @change-mode="mode = $event" />
      </div>
    </div>

    <Transition name="boot-fade">
      <div v-if="bootVisible" class="boot-screen">
        <div class="boot-card">
          <img class="boot-logo" :src="logo64" alt="" />
          <div class="boot-copy">
            <p class="boot-title">ChordPro Studio</p>
            <p class="boot-status">{{ bootStatus }}</p>
          </div>
        </div>
      </div>
    </Transition>

    <FeedbackToast />
    <SaveFilenameMismatchModal />
    <UnsavedContentModal />
  </main>
</template>

<style scoped>
.app-shell {
  position: relative;
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
}

.app-shell.immersive {
  padding: 0.3rem;
}

:global(html),
:global(body),
:global(#app) {
  height: 100%;
  margin: 0;
  overflow: hidden;
  font-family: "Trebuchet MS", "Segoe UI", sans-serif;
  --editor-monospace-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}


.view-host-layer {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.boot-screen {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: inherit;
  background:
    radial-gradient(circle at top left, rgba(235, 194, 111, 0.24), transparent 28%),
    radial-gradient(circle at top right, rgba(133, 165, 129, 0.2), transparent 24%),
    linear-gradient(180deg, #f7f2e8 0%, #efe6d6 100%);
  z-index: 5;
}

.boot-card {
  display: inline-flex;
  align-items: center;
  gap: 1.05rem;
  padding: 1.1rem 1.35rem;
  border: 1px solid rgba(24, 32, 25, 0.12);
  background: rgba(255, 250, 241, 0.92);
  box-shadow: 0 18px 40px rgba(74, 58, 32, 0.08);
}

.boot-logo {
  width: 3.6rem;
  height: 3.6rem;
  object-fit: contain;
  flex: 0 0 auto;
}

.boot-copy {
  min-width: 0;
}

.boot-title,
.boot-status {
  margin: 0;
}

.boot-title {
  font-size: 1.18rem;
  font-weight: 700;
}

.boot-status {
  margin-top: 0.2rem;
  font-size: 0.96rem;
  color: #7a6541;
}

.boot-fade-enter-active,
.boot-fade-leave-active {
  transition: opacity 160ms ease;
}

.boot-fade-enter-from,
.boot-fade-leave-to {
  opacity: 0;
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

  .app-shell.immersive {
    padding: 0.2rem;
  }
}
</style>



