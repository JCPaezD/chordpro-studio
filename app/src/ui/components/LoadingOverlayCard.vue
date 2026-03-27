<script setup lang="ts">
withDefaults(
  defineProps<{
    message: string;
    overlay?: boolean;
    scrim?: boolean;
  }>(),
  {
    overlay: true,
    scrim: true
  }
);
</script>

<template>
  <div :class="['loading-surface', { overlay, scrim }]">
    <div class="loading-card">
      <span class="loading-spinner" aria-hidden="true" />
      <p class="loading-message">{{ message }}</p>
    </div>
  </div>
</template>

<style scoped>
.loading-surface {
  display: grid;
  place-items: center;
}

.loading-surface.overlay {
  position: absolute;
  inset: 0;
}

.loading-surface.scrim {
  background: rgba(28, 32, 26, 0.24);
}

.loading-card {
  display: grid;
  justify-items: center;
  gap: 0.75rem;
  padding: 1rem 1.35rem;
  background: rgba(255, 250, 241, 0.95);
  box-shadow: 0 16px 28px rgba(24, 32, 25, 0.18);
}

.loading-spinner {
  width: 1.2rem;
  height: 1.2rem;
  border: 2px solid rgba(55, 81, 59, 0.18);
  border-top-color: #37513b;
  border-radius: 999px;
  animation: spin 0.8s linear infinite;
}

.loading-message {
  margin: 0;
  color: #4a564a;
  text-align: center;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
