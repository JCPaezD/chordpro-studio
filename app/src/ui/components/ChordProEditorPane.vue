<script setup lang="ts">
import { ref } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    collapsible?: boolean;
    collapsedLabel?: string;
    expandedLabel?: string;
    initiallyExpanded?: boolean;
    rows?: number;
  }>(),
  {
    placeholder: "ChordPro text",
    collapsible: false,
    collapsedLabel: "Show ChordPro source",
    expandedLabel: "Hide ChordPro source",
    initiallyExpanded: true,
    rows: 14
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const expanded = ref(props.collapsible ? props.initiallyExpanded : true);

function handleInput(event: Event): void {
  emit("update:modelValue", (event.target as HTMLTextAreaElement).value);
}
</script>

<template>
  <section class="editor-pane">
    <button v-if="collapsible" class="editor-toggle" @click="expanded = !expanded">
      {{ expanded ? expandedLabel : collapsedLabel }}
    </button>

    <div v-if="expanded" class="editor-body">
      <div v-if="$slots.header" class="editor-header">
        <slot name="header" />
      </div>

      <textarea
        :value="modelValue"
        :rows="rows"
        class="editor-textarea"
        :placeholder="placeholder"
        @input="handleInput"
      />

      <div v-if="$slots.actions" class="editor-actions">
        <slot name="actions" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.editor-pane {
  display: grid;
  gap: 0.85rem;
  min-height: 0;
}

.editor-toggle {
  justify-self: start;
  padding: 0.65rem 0.9rem;
  border: 1px solid rgba(47, 59, 49, 0.16);
  background: #f7efe0;
  color: #233127;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.editor-body {
  display: grid;
  gap: 0.85rem;
  min-height: 0;
}

.editor-textarea {
  width: 100%;
  min-height: 15rem;
  resize: vertical;
  padding: 0.9rem 1rem;
  border: 1px solid rgba(47, 59, 49, 0.16);
  background: #fffef9;
  color: #1f251f;
  font: inherit;
  line-height: 1.5;
  box-sizing: border-box;
}

.editor-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}
</style>
