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

.modal-card[data-width="wide"] {
  width: min(30rem, 100%);
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
}
</style>
