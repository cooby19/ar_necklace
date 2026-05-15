export const TUNING_DEFAULTS = {
  verticalOffset: 0,
  scale: 100,
  rotation: 0,
};

export const CAMERA_FACING_MODES = {
  USER: 'user',
  ENVIRONMENT: 'environment',
};

export const APP_MODES = {
  SHOWCASE: 'showcase',
  AR: 'ar',
};

export class AppState {
  constructor({ necklaces }) {
    const defaultNecklace = necklaces[0];

    this.state = {
      mode: APP_MODES.SHOWCASE,
      cameraStarted: false,
      cameraFacingMode: CAMERA_FACING_MODES.USER,
      isSwitchingCamera: false,
      modelLoaded: false,
      hasFace: false,
      lastLandmarks: null,
      lastDebugData: null,
      selectedNecklace: defaultNecklace,
      selectedColorId: defaultNecklace?.colorCustomization?.defaultColor ?? '',
      necklaceVisible: true,
      debugEnabled: false,
      activePanel: 'styles',
      controlsCollapsed: true,
      captureDataUrl: '',
      captureBlob: null,
      adjustments: {
        verticalOffset: 0,
        scaleMultiplier: 1,
        rotationOffset: 0,
      },
    };

    this.listeners = new Set();
  }

  get(key) {
    return this.state[key];
  }

  getSnapshot() {
    return {
      ...this.state,
      adjustments: { ...this.state.adjustments },
    };
  }

  set(patch, eventName = 'set') {
    if (!patch || !Object.keys(patch).length) return this.getSnapshot();

    const previous = this.state;
    this.state = {
      ...this.state,
      ...patch,
      adjustments: patch.adjustments
        ? { ...previous.adjustments, ...patch.adjustments }
        : previous.adjustments,
    };

    const changes = Object.keys(patch);
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => {
      listener(snapshot, {
        previous,
        changes,
        eventName,
      });
    });

    return snapshot;
  }

  update(updater, eventName = 'update') {
    const patch = updater(this.getSnapshot());
    return this.set(patch, eventName);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export function normalizeFacingMode(actualFacingMode, fallbackFacingMode) {
  if (actualFacingMode === CAMERA_FACING_MODES.USER || actualFacingMode === CAMERA_FACING_MODES.ENVIRONMENT) {
    return actualFacingMode;
  }

  return fallbackFacingMode;
}

export function isSelfieCamera(facingMode) {
  return facingMode !== CAMERA_FACING_MODES.ENVIRONMENT;
}

export function getCameraLabel(facingMode) {
  return isSelfieCamera(facingMode) ? '前鏡頭' : '後鏡頭';
}

export function getCameraSwitchingLabel(facingMode) {
  return `準備使用${getCameraLabel(facingMode)}`;
}
