<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";

import ModalShell from "./ModalShell.vue";

const props = defineProps<{
  visible: boolean;
  currentFileName: string;
  busy?: boolean;
}>();

const emit = defineEmits<{
  cancel: [];
  confirm: [nextFileName: string];
}>();

const nameInputRef = ref<HTMLInputElement | null>(null);
const draftName = ref("");

function stripChoExtension(fileName: string): string {
  return fileName.replace(/\.cho$/i, "");
}

const currentBaseName = computed(() => stripChoExtension(props.currentFileName));
const trimmedDraftName = computed(() => stripChoExtension(draftName.value.trim()));
const validationMessage = computed(() => {
  if (!trimmedDraftName.value) {
    return "Enter a file name.";
  }

  if (/[\\/]/.test(trimmedDraftName.value)) {
    return "The file name cannot include path separators.";
  }

  return "";
});
const canConfirm = computed(() =>
  !props.busy &&
  trimmedDraftName.value.length > 0 &&
  !validationMessage.value &&
  trimmedDraftName.value !== currentBaseName.value
);

function syncDraftName(): void {
  draftName.value = currentBaseName.value;
}

function emitCancel(): void {
  if (props.busy) {
    return;
  }

  emit("cancel");
}

function submitRename(): void {
  if (!canConfirm.value) {
    return;
  }

  emit("confirm", `${trimmedDraftName.value}.cho`);
}

function handleKeydown(event: KeyboardEvent): void {
  if (!props.visible) {
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    emitCancel();
  }
}

watch(
  () => props.visible,
  async (visible) => {
    if (visible) {
      syncDraftName();
      await nextTick();
      nameInputRef.value?.focus();
      nameInputRef.value?.select();
      window.addEventListener("keydown", handleKeydown);
      return;
    }

    window.removeEventListener("keydown", handleKeydown);
  }
);

watch(
  () => props.currentFileName,
  () => {
    if (props.visible) {
      syncDraftName();
    }
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
      <h2>Rename current song</h2>
      <p class="modal-description">Keep it in the current folder. The `.cho` extension stays fixed.</p>
    </div>

    <label class="modal-field">
      <span>File name</span>
      <div class="input-row">
        <input
          ref="nameInputRef"
          v-model="draftName"
          type="text"
          :disabled="busy"
          spellcheck="false"
          @keydown.enter.prevent="submitRename"
        />
        <span class="file-suffix">.cho</span>
      </div>
    </label>

    <p class="modal-context">
      Current: <span>{{ currentFileName }}</span>
    </p>
    <p v-if="validationMessage" class="modal-feedback error-message">{{ validationMessage }}</p>

    <div class="modal-actions">
      <button class="secondary-button" type="button" :disabled="busy" @click="emitCancel">
        Cancel
      </button>
      <button class="primary-button" type="button" :disabled="!canConfirm" @click="submitRename">
        Rename
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
.modal-field,
.modal-field span,
.modal-context,
.modal-feedback {
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

.modal-field {
  display: grid;
  gap: 0.45rem;
  margin-top: 1rem;
  color: #233127;
  font-weight: 700;
}

.input-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.55rem;
  align-items: center;
}

.input-row input {
  min-height: 2.6rem;
  padding: 0.55rem 0.8rem;
  border: 1px solid rgba(47, 59, 49, 0.16);
  background: #fffef9;
  color: #1f251f;
  font: inherit;
}

.file-suffix {
  color: #6a755f;
  font-weight: 700;
}

.modal-feedback {
  margin-top: 0.75rem;
  font-size: 0.9rem;
  font-weight: 700;
}

.error-message {
  color: #8f3131;
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

.secondary-button:disabled,
.primary-button:disabled,
.input-row input:disabled {
  opacity: 0.7;
  cursor: default;
}

@media (max-width: 800px) {
  .input-row {
    grid-template-columns: minmax(0, 1fr);
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
