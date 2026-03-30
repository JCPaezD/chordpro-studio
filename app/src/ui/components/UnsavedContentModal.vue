<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";

import { useSongWorkspace } from "../composables/useSongWorkspace";

const workspace = useSongWorkspace();
const primaryActionButtonRef = ref<HTMLButtonElement | null>(null);
const modalMode = computed(() => workspace.unsavedContentModalMode.value);
const isDirtyMode = computed(() => modalMode.value === "dirty");
const isRawInputMode = computed(() => modalMode.value === "raw-input");
const modalEyebrow = computed(() => (isRawInputMode.value ? "Original text" : "Unsaved content"));
const modalTitle = computed(() =>
  isRawInputMode.value ? "You have original text that would be discarded." : "You have unsaved content."
);
const modalQuestion = computed(() =>
  isRawInputMode.value ? workspace.rawInputDiscardMessage.value : "What do you want to do?"
);

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape" && workspace.showUnsavedContentModal.value) {
    event.preventDefault();
    if (isRawInputMode.value) {
      workspace.confirmRawInputCancel();
      return;
    }

    workspace.confirmUnsavedContentCancel();
  }
}

watch(
  () => workspace.showUnsavedContentModal.value,
  async (visible) => {
    if (visible) {
      await nextTick();
      primaryActionButtonRef.value?.focus();
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
        v-if="workspace.showUnsavedContentModal.value"
        class="modal-backdrop"
        @click.self="isRawInputMode ? workspace.confirmRawInputCancel() : workspace.confirmUnsavedContentCancel()"
      >
        <div class="modal-card">
          <div class="modal-copy">
            <p class="eyebrow">{{ modalEyebrow }}</p>
            <h2>{{ modalTitle }}</h2>
          </div>

          <div v-if="isDirtyMode && workspace.unsavedContentMetadataLine.value" class="modal-context">
            <p class="modal-meta">
              {{ workspace.unsavedContentMetadataLine.value }}
            </p>
          </div>
          <p class="modal-question">{{ modalQuestion }}</p>

          <div class="modal-actions">
            <template v-if="isDirtyMode">
              <button
                ref="primaryActionButtonRef"
                class="primary-button"
                :disabled="workspace.isResolvingUnsavedContent.value"
                @click="workspace.confirmUnsavedContentSave()"
              >
                Save
              </button>
              <button
                class="mini-button"
                :disabled="workspace.isResolvingUnsavedContent.value"
                @click="workspace.confirmUnsavedContentDiscard()"
              >
                Discard
              </button>
              <button
                class="secondary-button"
                :disabled="workspace.isResolvingUnsavedContent.value"
                @click="workspace.confirmUnsavedContentCancel()"
              >
                Cancel
              </button>
            </template>

            <template v-else>
              <button
                ref="primaryActionButtonRef"
                class="primary-button"
                @click="workspace.confirmRawInputDiscard()"
              >
                Discard
              </button>
              <button
                class="secondary-button"
                @click="workspace.confirmRawInputCancel()"
              >
                Cancel
              </button>
            </template>
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
  width: min(28rem, 100%);
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

.modal-context {
  display: grid;
  width: fit-content;
  max-width: calc(100% - 1.1rem);
  justify-self: start;
  gap: 0.1rem;
  margin: 0.85rem 0.55rem 0;
  padding: 0.42rem 1.15rem 0.42rem 0.95rem;
  border-radius: 16px;
  background: rgba(247, 239, 224, 0.72);
  border: 1px solid rgba(35, 49, 39, 0.08);
}

.eyebrow {
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #7a6541;
}

.modal-meta {
  color: #6a755f;
  font-size: 0.92rem;
  line-height: 1.35;
  padding-left: 0.35rem;
}

.modal-question {
  margin: 0.68rem 0 0 1.25rem;
  color: #233127;
  font-weight: 600;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.7rem;
  margin-top: 1.2rem;
}

.mini-button,
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

.mini-button,
.secondary-button {
  background: #f7efe0;
}

.primary-button {
  min-width: 8rem;
  background: linear-gradient(135deg, #1f3124, #37513b);
  color: #f8f3e8;
}

.mini-button:disabled,
.secondary-button:disabled,
.primary-button:disabled {
  opacity: 0.7;
  cursor: default;
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

  .mini-button,
  .secondary-button,
  .primary-button {
    flex: 1 1 100%;
  }
}
</style>

