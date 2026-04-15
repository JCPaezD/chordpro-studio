<script setup lang="ts">
import { computed, useSlots } from "vue";

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    showUnsavedChanges?: boolean;
    unsavedChangesLabel?: string;
  }>(),
  {
    subtitle: "",
    showUnsavedChanges: false,
    unsavedChangesLabel: "Unsaved changes"
  }
);

const slots = useSlots();
const hasPrimaryActions = computed(() => !!slots.primaryActions);
const hasActions = computed(() => !!slots.actions);
</script>

<template>
  <div class="editor-header">
    <div class="editor-header-main">
      <div class="editor-header-copy">
        <h3 :title="props.title">{{ props.title }}</h3>
        <p v-if="props.subtitle" :title="props.subtitle">{{ props.subtitle }}</p>
      </div>
      <div v-if="hasPrimaryActions" class="editor-header-primary-actions">
        <slot name="primaryActions" />
      </div>
    </div>
    <div
      v-if="props.showUnsavedChanges || hasActions"
      :class="['editor-header-toolbar', { 'has-dirty-badge': props.showUnsavedChanges }]"
    >
      <span v-if="props.showUnsavedChanges" class="dirty-badge">{{ props.unsavedChangesLabel }}</span>
      <div v-if="hasActions" class="editor-header-actions">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-header {
  display: grid;
  gap: 0.8rem;
  flex: 0 0 auto;
}

.editor-header-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1rem;
  align-items: start;
}

.editor-header-copy h3,
.editor-header-copy p {
  margin: 0;
}

.editor-header-copy {
  display: grid;
  gap: 0.4rem;
  min-width: 0;
  min-height: calc((1.3em * 2) + 0.4rem);
}

.editor-header-copy h3,
.editor-header-copy p {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.editor-header-copy p {
  color: #4a564a;
}

.editor-header-primary-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: center;
  justify-content: flex-end;
}

.editor-header-toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.75rem 1rem;
  align-items: center;
}

.editor-header-toolbar.has-dirty-badge {
  justify-content: space-between;
}

.editor-header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
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
  .editor-header-main {
    grid-template-columns: 1fr;
  }

  .editor-header-toolbar,
  .editor-header-primary-actions,
  .editor-header-actions {
    justify-content: flex-start;
  }
}
</style>
