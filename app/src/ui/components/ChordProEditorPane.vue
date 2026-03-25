<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
  }>(),
  {
    placeholder: "ChordPro text"
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

function handleInput(event: Event): void {
  emit("update:modelValue", (event.target as HTMLTextAreaElement).value);
}
</script>

<template>
  <section class="editor-pane">
    <div v-if="$slots.header" class="editor-header">
      <slot name="header" />
    </div>

    <textarea
      :value="modelValue"
      class="editor-textarea editor-monospace"
      :placeholder="placeholder"
      @input="handleInput"
    />

    <div v-if="$slots.actions" class="editor-actions">
      <slot name="actions" />
    </div>
  </section>
</template>

<style scoped>
.editor-pane {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.85rem;
  min-height: 0;
}

.editor-textarea {
  flex: 1;
  width: 100%;
  min-height: 0;
  resize: none;
  overflow: auto;
  padding: 0.9rem 1rem;
  border: 1px solid rgba(47, 59, 49, 0.16);
  background: #fffef9;
  color: #1f251f;
  font: inherit;
  line-height: 1.5;
  box-sizing: border-box;
}

.editor-textarea.editor-monospace {
  font-family: var(--editor-monospace-family);
}

.editor-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}
</style>
