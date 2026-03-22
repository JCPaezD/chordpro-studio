import { onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue";

export type PdfFitMode = "fit" | "fith" | "fitv";

const RESIZE_DEBOUNCE_MS = 80;
const MIN_SIZE_DELTA_PX = 8;
const A4_PAGE_RATIO = 1 / Math.sqrt(2);
const PDF_VIEWER_CHROME_HEIGHT_PX = 56;
const FIT_HYSTERESIS = 0.03;

export function usePdfFit(targetRef: Ref<HTMLElement | null>) {
  const fitMode = ref<PdfFitMode>("fitv");
  const fitRevision = ref(0);

  let resizeObserver: ResizeObserver | null = null;
  let resizeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastAppliedWidth = 0;
  let lastAppliedHeight = 0;

  function clearScheduledFitUpdate(): void {
    if (resizeDebounceTimer !== null) {
      clearTimeout(resizeDebounceTimer);
      resizeDebounceTimer = null;
    }
  }

  function resolveFitMode(width: number, height: number): PdfFitMode {
    const effectiveHeight = Math.max(1, height - PDF_VIEWER_CHROME_HEIGHT_PX);
    const effectiveRatio = width / effectiveHeight;

    if (fitMode.value === "fitv") {
      return effectiveRatio < A4_PAGE_RATIO - FIT_HYSTERESIS ? "fith" : "fitv";
    }

    if (fitMode.value === "fith") {
      return effectiveRatio > A4_PAGE_RATIO + FIT_HYSTERESIS ? "fitv" : "fith";
    }

    return effectiveRatio >= A4_PAGE_RATIO ? "fitv" : "fith";
  }

  function updateFitMode(forceReapply = false): void {
    const target = targetRef.value;
    if (!target) {
      return;
    }

    const width = target.clientWidth;
    const height = target.clientHeight;
    if (width <= 0 || height <= 0) {
      return;
    }

    const nextFitMode = resolveFitMode(width, height);
    const sizeChanged = Math.abs(width - lastAppliedWidth) >= MIN_SIZE_DELTA_PX
      || Math.abs(height - lastAppliedHeight) >= MIN_SIZE_DELTA_PX;

    if (nextFitMode !== fitMode.value || sizeChanged || forceReapply) {
      fitMode.value = nextFitMode;
      fitRevision.value += 1;
      lastAppliedWidth = width;
      lastAppliedHeight = height;
    }
  }

  function scheduleFitUpdate(forceReapply = false): void {
    clearScheduledFitUpdate();
    resizeDebounceTimer = setTimeout(() => {
      resizeDebounceTimer = null;
      updateFitMode(forceReapply);
    }, RESIZE_DEBOUNCE_MS);
  }

  function applyFit(url: string): string {
    if (!url) {
      return "";
    }

    const baseUrl = url.split("#", 1)[0];
    return `${baseUrl}#view=${fitMode.value}&cpfit=${fitRevision.value}`;
  }

  function observeTarget(target: HTMLElement): void {
    resizeObserver?.observe(target);
    updateFitMode();
    requestAnimationFrame(() => {
      updateFitMode();
    });
  }

  function handleWindowResize(): void {
    scheduleFitUpdate(true);
  }

  onMounted(() => {
    window.addEventListener("resize", handleWindowResize);
    resizeObserver = new ResizeObserver(() => {
      scheduleFitUpdate(true);
    });

    if (targetRef.value) {
      observeTarget(targetRef.value);
    }
  });

  watch(targetRef, (target, previousTarget) => {
    if (previousTarget) {
      resizeObserver?.unobserve(previousTarget);
    }

    if (target) {
      observeTarget(target);
    }
  }, { immediate: true });

  onBeforeUnmount(() => {
    window.removeEventListener("resize", handleWindowResize);
    resizeObserver?.disconnect();
    resizeObserver = null;
    clearScheduledFitUpdate();
  });

  return {
    fitMode,
    fitRevision,
    applyFit,
    scheduleFitUpdate
  };
}
