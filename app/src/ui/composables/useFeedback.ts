import { computed, readonly, ref } from "vue";

export type FeedbackType = "success" | "error" | "info";

type FeedbackPayload = {
  type: FeedbackType;
  message: string;
};

const feedbackType = ref<FeedbackType>("info");
const feedbackMessage = ref("");
const isVisible = ref(false);

let dismissTimer: ReturnType<typeof setTimeout> | null = null;

function clearDismissTimer(): void {
  if (dismissTimer !== null) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
}

function dismissFeedback(): void {
  clearDismissTimer();
  isVisible.value = false;
}

function showFeedback(payload: FeedbackPayload): void {
  clearDismissTimer();
  feedbackType.value = payload.type;
  feedbackMessage.value = payload.message;
  isVisible.value = true;

  if (payload.type !== "error") {
    dismissTimer = setTimeout(() => {
      dismissTimer = null;
      isVisible.value = false;
    }, 2500);
  }
}

export function useFeedback() {
  return {
    type: readonly(feedbackType),
    message: readonly(feedbackMessage),
    isVisible: readonly(isVisible),
    hasMessage: computed(() => isVisible.value && feedbackMessage.value.trim().length > 0),
    showFeedback,
    dismissFeedback
  };
}
