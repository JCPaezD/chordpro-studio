import { isTauri } from "@tauri-apps/api/core";
import { PhysicalPosition, PhysicalSize, availableMonitors, getCurrentWindow } from "@tauri-apps/api/window";

import type { WindowState } from "../../adapters/filesystem/ConfigRepository";
import type { AppConfigStore } from "./useAppConfig";

const WINDOW_STATE_SAVE_DELAY_MS = 500;
const MIN_RESTORED_WINDOW_WIDTH = 900;
const MIN_RESTORED_WINDOW_HEIGHT = 650;
const MIN_CAPTURED_WINDOW_WIDTH = 300;
const MIN_CAPTURED_WINDOW_HEIGHT = 200;
const WINDOWS_MINIMIZED_POSITION_THRESHOLD = -30000;

type WindowStatePersistence = {
  restoreWindowState(): Promise<void>;
  startWindowStatePersistence(): Promise<void>;
  stopWindowStatePersistence(): void;
};

type UnlistenFn = () => void;

function clampWindowState(state: WindowState): WindowState {
  return {
    ...state,
    width: Math.max(MIN_RESTORED_WINDOW_WIDTH, Math.round(state.width)),
    height: Math.max(MIN_RESTORED_WINDOW_HEIGHT, Math.round(state.height)),
    x: Math.round(state.x),
    y: Math.round(state.y)
  };
}

function rectanglesIntersect(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

function isWindowsMinimizedPosition(position: { x: number; y: number }): boolean {
  return (
    position.x <= WINDOWS_MINIMIZED_POSITION_THRESHOLD ||
    position.y <= WINDOWS_MINIMIZED_POSITION_THRESHOLD
  );
}

function isCapturedWindowSizeValid(size: { width: number; height: number }): boolean {
  return size.width >= MIN_CAPTURED_WINDOW_WIDTH && size.height >= MIN_CAPTURED_WINDOW_HEIGHT;
}

function getCapturedSizeForMaximizedWindow(currentState: WindowState | null, size: PhysicalSize): PhysicalSize {
  if (currentState && isCapturedWindowSizeValid(currentState)) {
    return new PhysicalSize(currentState.width, currentState.height);
  }

  return size;
}

async function isRestoredWindowVisible(state: WindowState): Promise<boolean> {
  const monitors = await availableMonitors();
  if (monitors.length === 0) {
    return true;
  }

  const windowRect = {
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height
  };

  return monitors.some((monitor) => {
    const workArea = monitor.workArea;
    return rectanglesIntersect(windowRect, {
      x: workArea.position.x,
      y: workArea.position.y,
      width: workArea.size.width,
      height: workArea.size.height
    });
  });
}

export function useWindowStatePersistence(appConfig: AppConfigStore): WindowStatePersistence {
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let unlistenResize: UnlistenFn | null = null;
  let unlistenMove: UnlistenFn | null = null;

  async function restoreWindowState(): Promise<void> {
    if (!isTauri()) {
      return;
    }

    const savedWindowState = appConfig.windowState.value;
    if (!savedWindowState) {
      return;
    }

    const windowState = clampWindowState(savedWindowState);
    if (!(await isRestoredWindowVisible(windowState))) {
      return;
    }

    const window = getCurrentWindow();
    try {
      await window.setSize(new PhysicalSize(windowState.width, windowState.height));
      await window.setPosition(new PhysicalPosition(windowState.x, windowState.y));

      if (windowState.maximized) {
        await window.maximize();
      }
    } catch (err) {
      console.error("Could not restore window state.", err);
    }
  }

  async function captureWindowState(): Promise<void> {
    if (!isTauri()) {
      return;
    }

    const window = getCurrentWindow();
    try {
      if (await window.isMinimized()) {
        return;
      }

      const maximized = await window.isMaximized();
      const currentState = appConfig.windowState.value;

      const [position, size] = await Promise.all([
        window.outerPosition(),
        window.outerSize()
      ]);

      if (isWindowsMinimizedPosition(position) || !isCapturedWindowSizeValid(size)) {
        return;
      }

      const capturedSize = maximized ? getCapturedSizeForMaximizedWindow(currentState, size) : size;
      const capturedState = {
        x: position.x,
        y: position.y,
        width: capturedSize.width,
        height: capturedSize.height,
        maximized
      };
      if (!(await isRestoredWindowVisible(capturedState))) {
        return;
      }

      await appConfig.setWindowState(capturedState);
    } catch (err) {
      console.error("Could not persist window state.", err);
    }
  }

  function scheduleWindowStateSave(): void {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
    }

    saveTimer = setTimeout(() => {
      saveTimer = null;
      void captureWindowState();
    }, WINDOW_STATE_SAVE_DELAY_MS);
  }

  async function startWindowStatePersistence(): Promise<void> {
    if (!isTauri()) {
      return;
    }

    const window = getCurrentWindow();
    try {
      unlistenResize = await window.onResized(scheduleWindowStateSave);
      unlistenMove = await window.onMoved(scheduleWindowStateSave);
      scheduleWindowStateSave();
    } catch (err) {
      console.error("Could not start window state persistence.", err);
    }
  }

  function stopWindowStatePersistence(): void {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }

    unlistenResize?.();
    unlistenMove?.();
    unlistenResize = null;
    unlistenMove = null;
  }

  return {
    restoreWindowState,
    startWindowStatePersistence,
    stopWindowStatePersistence
  };
}
