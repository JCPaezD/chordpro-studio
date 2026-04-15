<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";

import ModalShell from "./ModalShell.vue";

const props = defineProps<{
  visible: boolean;
  fileName: string;
  busy?: boolean;
}>();

const emit = defineEmits<{
  cancel: [];
  confirm: [];
}>();

const cancelButtonRef = ref<HTMLButtonElement | null>(null);

function emitCancel(): void {
  if (props.busy) {
    return;
  }

  emit("cancel");
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key !== "Escape" || !props.visible) {
    return;
  }

  event.preventDefault();
  emitCancel();
}

watch(
  () => props.visible,
  async (visible) => {
    if (visible) {
      await nextTick();
      cancelButtonRef.value?.focus();
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
  <ModalShell :visible="visible" @backdrop="emitCancel">
    <div class="modal-copy">
      <p class="eyebrow">Songbook</p>
      <h2>Delete current song?</h2>
      <p class="modal-description">This removes the `.cho` file from the current songbook folder.</p>
    </div>

    <p class="modal-context">
      File: <span>{{ fileName }}</span>
    </p>

    <div class="modal-actions">
      <button
        ref="cancelButtonRef"
        class="secondary-button"
        type="button"
        :disabled="busy"
        @click="emitCancel"
      >
        Cancel
      </button>
      <button class="primary-button danger-button" type="button" :disabled="busy" @click="emit('confirm')">
        Delete
      </button>
    </div>
  </ModalShell>
</template>

<style scoped>
.modal-copy {
  display: grid;
  gap: 0.35rem;
}

.modal-copy h2,
.modal-copy p,
.modal-context {
  margin: 0;
}

.eyebrow {
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #7a6541;
}

.modal-description,
.modal-context {
  color: #5c654f;
}

.modal-context {
  margin-top: 0.9rem;
  font-size: 0.92rem;
}

.modal-context span {
  color: #233127;
  font-weight: 700;
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

.danger-button {
  background: linear-gradient(135deg, #5b1f1f, #7a3535);
}

.secondary-button:disabled,
.primary-button:disabled {
  opacity: 0.7;
  cursor: default;
}

@media (max-width: 800px) {
  .modal-actions {
    justify-content: stretch;
  }

  .secondary-button,
  .primary-button {
    flex: 1 1 100%;
  }
}
</style>
