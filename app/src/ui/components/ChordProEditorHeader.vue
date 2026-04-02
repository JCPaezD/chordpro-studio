<script setup lang="ts">
import { computed, useSlots } from "vue";

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    showUnsavedChanges?: boolean;
  }>(),
  {
    subtitle: "",
    showUnsavedChanges: false
  }
);

const slots = useSlots();
const hasActions = computed(() => !!slots.actions);
</script>

<template>
  <div class="editor-header">
    <div class="editor-header-copy">
      <h3>{{ props.title }}</h3>
      <p v-if="props.subtitle">{{ props.subtitle }}</p>
    </div>
    <div v-if="props.showUnsavedChanges || hasActions" class="editor-header-aside">
      <span v-if="props.showUnsavedChanges" class="dirty-badge">Unsaved changes</span>
      <div v-if="hasActions" class="editor-header-actions">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-header,
.editor-header-aside {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.editor-header,
.editor-header-aside {
  align-items: flex-start;
}

.editor-header {
  flex: 0 0 auto;
}

.editor-header-copy h3,
.editor-header-copy p {
  margin: 0;
}

.editor-header-copy p {
  margin-top: 0.4rem;
  color: #4a564a;
}

.editor-header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: center;
}

.dirty-badge {
  padding: 0.35rem 0.55rem;
  background: #f0dfb9;
  color: #5b4320;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

@media (max-width: 900px) {
  .editor-header,
  .editor-header-aside {
    flex-direction: column;
  }
}
</style>
