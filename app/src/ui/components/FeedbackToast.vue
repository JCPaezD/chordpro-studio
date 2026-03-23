<script setup lang="ts">
import { computed } from "vue";

import { useFeedback } from "../composables/useFeedback";

const feedback = useFeedback();

const toneClass = computed(() => ({
  "feedback-toast-success": feedback.type.value === "success",
  "feedback-toast-error": feedback.type.value === "error",
  "feedback-toast-info": feedback.type.value === "info"
}));

const icon = computed(() => {
  if (feedback.type.value === "success") {
    return "✓";
  }

  if (feedback.type.value === "error") {
    return "!";
  }

  return "i";
});
</script>

<template>
  <Teleport to="body">
    <Transition name="feedback-toast">
      <div v-if="feedback.hasMessage.value" class="feedback-toast-shell" role="status" aria-live="polite">
        <div :class="['feedback-toast', toneClass]">
          <span class="feedback-icon" aria-hidden="true">{{ icon }}</span>
          <p class="feedback-message">{{ feedback.message.value }}</p>
          <button class="feedback-close" type="button" aria-label="Dismiss feedback" @click="feedback.dismissFeedback">
            ×
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.feedback-toast-shell {
  position: fixed;
  right: 1.2rem;
  bottom: 1.2rem;
  z-index: 1200;
  pointer-events: none;
}

.feedback-toast {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  max-width: min(26rem, calc(100vw - 2rem));
  padding: 0.85rem 0.95rem;
  border-radius: 14px;
  color: #fffaf1;
  background: rgba(30, 24, 16, 0.94);
  box-shadow: 0 16px 34px rgba(24, 17, 9, 0.22);
  border: 1px solid rgba(255, 250, 241, 0.08);
  pointer-events: auto;
}

.feedback-toast-success {
  border-left: 4px solid #98c56d;
}

.feedback-toast-error {
  border-left: 4px solid #d66f5c;
}

.feedback-toast-info {
  border-left: 4px solid #c5a15a;
}

.feedback-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.35rem;
  height: 1.35rem;
  flex: 0 0 auto;
  border-radius: 999px;
  background: rgba(255, 250, 241, 0.14);
  font-weight: 700;
  font-size: 0.82rem;
}

.feedback-message {
  margin: 0;
  flex: 1;
  font-size: 0.95rem;
  line-height: 1.35;
}

.feedback-close {
  flex: 0 0 auto;
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 1.15rem;
  line-height: 1;
  cursor: pointer;
  opacity: 0.82;
}

.feedback-close:hover {
  opacity: 1;
}

.feedback-toast-enter-active,
.feedback-toast-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.feedback-toast-enter-from,
.feedback-toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (max-width: 800px) {
  .feedback-toast-shell {
    left: 0.75rem;
    right: 0.75rem;
    bottom: 0.8rem;
  }

  .feedback-toast {
    max-width: none;
  }
}
</style>
