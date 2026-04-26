<script setup lang="ts">
import { computed, useSlots } from "vue";

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    subtitleLabel?: string;
    subtitleSurface?: boolean;
    showUnsavedChanges?: boolean;
    unsavedChangesLabel?: string;
  }>(),
  {
    subtitle: "",
    subtitleLabel: "",
    subtitleSurface: false,
    showUnsavedChanges: false,
    unsavedChangesLabel: "Unsaved changes"
  }
);

const slots = useSlots();
const hasTitleActions = computed(() => !!slots.titleActions);
const hasSubtitleActions = computed(() => !!slots.subtitleActions);
const hasPrimaryActions = computed(() => !!slots.primaryActions);
const hasActions = computed(() => !!slots.actions);
</script>

<template>
  <div class="editor-header">
    <div class="editor-header-main">
      <div class="editor-header-copy">
        <div class="editor-title-line">
          <h3 :title="props.title">{{ props.title }}</h3>
          <div v-if="hasTitleActions" class="editor-title-actions">
            <slot name="titleActions" />
          </div>
        </div>
        <div
          v-if="props.subtitle || hasSubtitleActions"
          :class="['editor-subtitle-line', { 'has-subtitle-surface': props.subtitleSurface }]"
        >
          <p
            v-if="props.subtitle"
            :class="['editor-subtitle-value', { 'is-surface': props.subtitleSurface }]"
            :title="props.subtitleLabel || props.subtitle"
            :aria-label="props.subtitleLabel || props.subtitle"
          >
            {{ props.subtitle }}
          </p>
          <div v-if="hasSubtitleActions" class="editor-subtitle-actions">
            <slot name="subtitleActions" />
          </div>
        </div>
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

.editor-title-line {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.editor-title-line h3 {
  min-width: 0;
}

.editor-title-actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
}

.editor-subtitle-line {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
}

.editor-subtitle-line.has-subtitle-surface {
  gap: 0;
}

.editor-subtitle-line p {
  min-width: 0;
}

.editor-subtitle-value.is-surface {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  height: var(--editor-subtitle-surface-height, 1.56rem);
  min-height: var(--editor-subtitle-surface-height, 1.56rem);
  max-width: min(24rem, 100%);
  padding: 0 0.4rem;
  border: 1px solid rgba(35, 49, 39, 0.14);
  border-right: 0;
  background: rgba(247, 239, 224, 0.36);
  color: #3d493f;
  font-size: 0.78rem;
  line-height: 1;
}

.editor-subtitle-actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
}

.editor-header-copy {
  display: grid;
  gap: 0.4rem;
  min-width: 0;
  min-height: calc((1.3em * 2) + 0.4rem);
}

.editor-header-copy p {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.editor-header-copy h3 {
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
