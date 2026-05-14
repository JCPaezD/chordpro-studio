<script setup lang="ts">
withDefaults(
  defineProps<{
    visible: boolean;
    width?: "default" | "wide";
  }>(),
  {
    width: "default"
  }
);

const emit = defineEmits<{
  backdrop: [];
}>();
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="visible"
        class="modal-backdrop"
        role="dialog"
        aria-modal="true"
        @click.self="emit('backdrop')"
      >
        <div class="modal-card" :data-width="width">
          <slot />
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
  padding: 1rem;
  background: rgba(28, 32, 26, 0.24);
}

.modal-card {
  display: grid;
  gap: 0.68rem;
  width: min(26rem, 100%);
  padding: 0.86rem 0.92rem 0.92rem;
  border-radius: 6px;
  border: 1px solid rgba(24, 32, 25, 0.12);
  background: rgba(255, 250, 241, 0.97);
  box-shadow: 0 16px 30px rgba(24, 32, 25, 0.14);
  font: inherit;
  font-size: 0.92rem;
}

.modal-card[data-width="wide"] {
  width: min(28rem, 100%);
}

.modal-card :deep(.modal-copy) {
  display: grid;
  gap: 0.28rem;
  padding-bottom: 0.58rem;
  border-bottom: 1px solid rgba(35, 49, 39, 0.1);
}

.modal-card :deep(.modal-copy h2) {
  margin: 0;
  color: #182019;
  font-size: 1.1rem;
  line-height: 1.12;
}

.modal-card :deep(.modal-copy p),
.modal-card :deep(.modal-description) {
  margin: 0;
  color: #4a564a;
  font-size: 0.88rem;
  line-height: 1.35;
}

.modal-card :deep(.eyebrow) {
  margin: 0;
  color: #7a6541;
  font-size: 0.64rem;
  letter-spacing: 0.15em;
  line-height: 1;
  text-transform: uppercase;
}

.modal-card :deep(.modal-context) {
  margin: 0.04rem 0 0;
  padding: 0.2rem 0.48rem;
  border: 1px solid rgba(35, 49, 39, 0.12);
  border-radius: 0;
  background: rgba(247, 239, 224, 0.48);
  color: #4a564a;
  font-size: 0.84rem;
  line-height: 1.18;
}

.modal-card :deep(.modal-actions) {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.52rem;
  margin-top: 0.1rem;
  padding-top: 0.64rem;
  border-top: 1px solid rgba(35, 49, 39, 0.1);
}

.modal-card :deep(.secondary-button),
.modal-card :deep(.primary-button),
.modal-card :deep(.mini-button) {
  min-height: 2.18rem;
  min-width: 0;
  padding: 0.42rem 0.78rem;
  border: 1px solid rgba(35, 49, 39, 0.16);
  border-radius: 0;
  box-shadow: none;
  font: inherit;
  font-size: 0.86rem;
  font-weight: 700;
}

.modal-card :deep(.secondary-button),
.modal-card :deep(.mini-button) {
  background: rgba(247, 240, 225, 0.72);
  color: #233127;
}

.modal-card :deep(.primary-button) {
  background: #233b29;
  color: #f8f3e8;
}

.modal-card :deep(.danger-button) {
  background: #6f3330;
  color: #fffaf1;
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
    padding: 0.82rem;
  }
}
</style>
