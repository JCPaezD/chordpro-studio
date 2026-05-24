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

const detailParts = computed(() => {
  const detail = feedback.detail.value.trim();
  const match = detail.match(/^(.*?)\s+(\([^)]*\))$/);

  if (!match) {
    return {
      main: detail,
      meta: ""
    };
  }

  return {
    main: match[1],
    meta: match[2]
  };
});
</script>

<template>
  <Teleport to="body">
    <Transition name="feedback-toast">
      <div v-if="feedback.hasMessage.value" class="feedback-toast-shell" role="status" aria-live="polite">
        <div :class="['feedback-toast', toneClass]">
          <span class="feedback-icon" aria-hidden="true">{{ icon }}</span>
          <p class="feedback-message">
            <span>{{ feedback.message.value }}</span>
            <span v-if="feedback.detail.value" class="feedback-detail">
              <strong>{{ detailParts.main }}</strong>
              <span v-if="detailParts.meta" class="feedback-detail-meta">{{ detailParts.meta }}</span>
            </span>
          </p>
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
  right: 0.72rem;
  bottom: 0.72rem;
  z-index: 1200;
  pointer-events: none;
}

.feedback-toast {
  display: flex;
  align-items: stretch;
  gap: 0;
  max-width: min(24rem, calc(100vw - 1.44rem));
  padding: 0;
  border-radius: 6px;
  color: #233127;
  background: rgba(255, 250, 241, 0.97);
  box-shadow: 0 14px 28px rgba(24, 32, 25, 0.14);
  border: 1px solid rgba(24, 32, 25, 0.14);
  pointer-events: auto;
  overflow: hidden;
}

.feedback-toast-success {
  border-left: 4px solid #557d4d;
}

.feedback-toast-error {
  border-left: 4px solid #9a4a3f;
}

.feedback-toast-info {
  border-left: 4px solid #b58b3a;
}

.feedback-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.18rem;
  flex: 0 0 auto;
  border-right: 1px solid rgba(35, 49, 39, 0.1);
  background: rgba(247, 240, 225, 0.72);
  font-weight: 700;
  font-size: 0.78rem;
}

.feedback-message {
  display: grid;
  gap: 0.12rem;
  margin: 0;
  flex: 1;
  padding: 0.46rem 0.72rem;
  font-size: 0.88rem;
  line-height: 1.35;
}

.feedback-message strong {
  font-weight: 780;
}

.feedback-detail {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.feedback-detail-meta {
  font-weight: 500;
}

.feedback-close {
  flex: 0 0 auto;
  border: 0;
  border-left: 1px solid rgba(35, 49, 39, 0.1);
  align-self: stretch;
  min-width: 2.18rem;
  background: rgba(247, 240, 225, 0.5);
  color: inherit;
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  opacity: 0.76;
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
    left: 0.5rem;
    right: 0.5rem;
    bottom: 0.5rem;
  }

  .feedback-toast {
    max-width: none;
  }
}
</style>
