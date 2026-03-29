<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";

import { useSongWorkspace } from "../composables/useSongWorkspace";

const workspace = useSongWorkspace();
const keepCurrentButtonRef = ref<HTMLButtonElement | null>(null);

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape" && workspace.showSaveFilenameMismatchModal.value) {
    event.preventDefault();
    workspace.confirmSaveFilenameMismatchCancel();
  }
}

watch(
  () => workspace.showSaveFilenameMismatchModal.value,
  async (visible) => {
    if (visible) {
      await nextTick();
      keepCurrentButtonRef.value?.focus();
      window.addEventListener("keydown", handleKeydown);
      return;
    }

    window.removeEventListener("keydown", handleKeydown);
  }
);

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="workspace.showSaveFilenameMismatchModal.value"
        class="modal-backdrop"
        @click.self="workspace.confirmSaveFilenameMismatchCancel()"
      >
        <div class="modal-card">
          <div class="modal-copy">
            <p class="eyebrow">Filename change</p>
            <h2>The song metadata has changed.</h2>
            <p class="modal-description">Do you want to update the file name?</p>
          </div>

          <div class="modal-context">
            <p class="modal-row">
              <span class="modal-label">Current</span>
              <span class="modal-value">{{ workspace.saveFilenameMismatchCurrentName.value }}</span>
            </p>
            <p class="modal-row">
              <span class="modal-label">Suggested</span>
              <span class="modal-value">{{ workspace.saveFilenameMismatchSuggestedName.value }}</span>
            </p>
          </div>

          <div class="modal-actions">
            <button
              ref="keepCurrentButtonRef"
              class="secondary-button"
              @click="workspace.confirmKeepCurrentFileName()"
            >
              Keep current file name
            </button>
            <button
              class="primary-button"
              @click="workspace.confirmSaveAsNewFile()"
            >
              Save as new file
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1400;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgba(28, 32, 26, 0.24);
}

.modal-card {
  width: min(30rem, 100%);
  padding: 1.4rem 1.5rem;
  border-radius: 22px;
  border: 1px solid rgba(24, 32, 25, 0.12);
  background: rgba(255, 250, 241, 0.95);
  box-shadow: 0 24px 48px rgba(44, 33, 16, 0.18);
  font: inherit;
}

.modal-copy {
  display: grid;
  gap: 0.35rem;
}

.modal-copy h2,
.modal-copy p {
  margin: 0;
}

.eyebrow {
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #7a6541;
}

.modal-description {
  color: #5c654f;
}

.modal-context {
  display: grid;
  gap: 0.4rem;
  margin-top: 0.9rem;
  padding: 0.8rem 1rem;
  border-radius: 18px;
  background: rgba(247, 239, 224, 0.72);
  border: 1px solid rgba(35, 49, 39, 0.08);
}

.modal-row {
  display: grid;
  gap: 0.16rem;
  margin: 0;
}

.modal-label {
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #7a6541;
}

.modal-value {
  color: #233127;
  font-weight: 600;
  word-break: break-word;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.7rem;
  margin-top: 1.2rem;
}

.secondary-button,
.primary-button {
  min-height: 2.75rem;
  padding: 0.7rem 0.95rem;
  border: 1px solid rgba(35, 49, 39, 0.18);
  color: #233127;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.secondary-button {
  background: #f7efe0;
}

.primary-button {
  min-width: 8rem;
  background: linear-gradient(135deg, #1f3124, #37513b);
  color: #f8f3e8;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 160ms ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

@media (max-width: 800px) {
  .modal-card {
    padding: 1.2rem 1.1rem;
  }

  .modal-actions {
    justify-content: stretch;
  }

  .secondary-button,
  .primary-button {
    flex: 1 1 100%;
  }
}
</style>
