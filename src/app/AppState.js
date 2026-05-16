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

export const AR_SESSION_STATES = {
  SHOWCASE: 'showcase',
  AR_IDLE: 'arIdle',
  CAMERA_STARTING: 'cameraStarting',
  NO_FACE: 'noFace',
  TRACKING: 'tracking',
  CAPTURING: 'capturing',
  SHARING: 'sharing',
  ERROR: 'error',
};

const SESSION_TRANSITIONS = {
  [AR_SESSION_STATES.SHOWCASE]: [
    AR_SESSION_STATES.SHOWCASE,
    AR_SESSION_STATES.AR_IDLE,
    AR_SESSION_STATES.ERROR,
  ],
  [AR_SESSION_STATES.AR_IDLE]: [
    AR_SESSION_STATES.AR_IDLE,
    AR_SESSION_STATES.SHOWCASE,
    AR_SESSION_STATES.CAMERA_STARTING,
    AR_SESSION_STATES.ERROR,
  ],
  [AR_SESSION_STATES.CAMERA_STARTING]: [
    AR_SESSION_STATES.CAMERA_STARTING,
    AR_SESSION_STATES.NO_FACE,
    AR_SESSION_STATES.TRACKING,
    AR_SESSION_STATES.AR_IDLE,
    AR_SESSION_STATES.SHOWCASE,
    AR_SESSION_STATES.ERROR,
  ],
  [AR_SESSION_STATES.NO_FACE]: [
    AR_SESSION_STATES.NO_FACE,
    AR_SESSION_STATES.TRACKING,
    AR_SESSION_STATES.CAMERA_STARTING,
    AR_SESSION_STATES.AR_IDLE,
    AR_SESSION_STATES.SHOWCASE,
    AR_SESSION_STATES.ERROR,
  ],
  [AR_SESSION_STATES.TRACKING]: [
    AR_SESSION_STATES.TRACKING,
    AR_SESSION_STATES.NO_FACE,
    AR_SESSION_STATES.CAMERA_STARTING,
    AR_SESSION_STATES.CAPTURING,
    AR_SESSION_STATES.AR_IDLE,
    AR_SESSION_STATES.SHOWCASE,
    AR_SESSION_STATES.ERROR,
  ],
  [AR_SESSION_STATES.CAPTURING]: [
    AR_SESSION_STATES.CAPTURING,
    AR_SESSION_STATES.SHARING,
    AR_SESSION_STATES.TRACKING,
    AR_SESSION_STATES.NO_FACE,
    AR_SESSION_STATES.AR_IDLE,
    AR_SESSION_STATES.ERROR,
  ],
  [AR_SESSION_STATES.SHARING]: [
    AR_SESSION_STATES.SHARING,
    AR_SESSION_STATES.TRACKING,
    AR_SESSION_STATES.NO_FACE,
    AR_SESSION_STATES.AR_IDLE,
    AR_SESSION_STATES.SHOWCASE,
    AR_SESSION_STATES.ERROR,
  ],
  [AR_SESSION_STATES.ERROR]: [
    AR_SESSION_STATES.ERROR,
    AR_SESSION_STATES.SHOWCASE,
    AR_SESSION_STATES.AR_IDLE,
    AR_SESSION_STATES.CAMERA_STARTING,
    AR_SESSION_STATES.NO_FACE,
    AR_SESSION_STATES.TRACKING,
  ],
};

export class AppState {
  constructor({ necklaces }) {
    const defaultNecklace = necklaces[0];

    this.state = {
      mode: APP_MODES.SHOWCASE,
      sessionStatus: AR_SESSION_STATES.SHOWCASE,
      cameraStarted: false,
      cameraFacingMode: CAMERA_FACING_MODES.USER,
      isSwitchingCamera: false,
      modelLoaded: false,
      hasFace: false,
      lastLandmarks: null,
      lastDebugData: null,
      selectedNecklace: defaultNecklace,
      selectedColorId: defaultNecklace?.colorCustomization?.defaultColor ?? '',
      selectedColorIdsByTarget: createDefaultColorSelection(defaultNecklace),
      necklaceVisible: true,
      debugEnabled: false,
      activePanel: 'styles',
      controlsCollapsed: true,
      captureDataUrl: '',
      captureBlob: null,
      adjustments: {
        horizontalOffset: 0,
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
      selectedColorIdsByTarget: { ...this.state.selectedColorIdsByTarget },
      adjustments: { ...this.state.adjustments },
    };
  }

  set(patch, eventName = 'set') {
    if (!patch || !Object.keys(patch).length) return this.getSnapshot();

    const previous = this.state;
    this.state = {
      ...this.state,
      ...patch,
      selectedColorIdsByTarget: patch.selectedColorIdsByTarget
        ? { ...patch.selectedColorIdsByTarget }
        : previous.selectedColorIdsByTarget,
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

  transitionSession(nextStatus, patch = {}, eventName = 'session-transition') {
    if (!canTransitionSession(this.state.sessionStatus, nextStatus)) {
      console.warn(
        `[AppState] 忽略不合法的 AR session transition：${this.state.sessionStatus} -> ${nextStatus}`,
      );
      return this.getSnapshot();
    }

    return this.set(createSessionPatch(nextStatus, patch), eventName);
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

export function createDefaultColorSelection(necklace) {
  const colorCustomization = necklace?.colorCustomization;
  const defaultColor = colorCustomization?.defaultColor ?? '';
  if (!defaultColor) return {};

  const defaultTarget = colorCustomization?.defaultTarget ?? 'all';
  const targetIds = colorCustomization?.targets?.map((target) => target.id).filter(Boolean) ?? [];

  if (defaultTarget === 'all') {
    return Object.fromEntries(targetIds.map((targetId) => [targetId, defaultColor]));
  }

  return {
    [defaultTarget]: defaultColor,
  };
}

export function canTransitionSession(currentStatus, nextStatus) {
  return Boolean(SESSION_TRANSITIONS[currentStatus]?.includes(nextStatus));
}

export function createSessionPatch(nextStatus, patch = {}) {
  const nextPatch = {
    ...patch,
    sessionStatus: nextStatus,
  };

  if (nextStatus === AR_SESSION_STATES.SHOWCASE || nextStatus === AR_SESSION_STATES.AR_IDLE) {
    return {
      ...nextPatch,
      cameraStarted: false,
      isSwitchingCamera: false,
      hasFace: false,
      lastLandmarks: null,
      lastDebugData: null,
    };
  }

  if (nextStatus === AR_SESSION_STATES.CAMERA_STARTING) {
    return {
      ...nextPatch,
      hasFace: false,
      lastLandmarks: null,
      lastDebugData: null,
    };
  }

  if (nextStatus === AR_SESSION_STATES.NO_FACE) {
    return {
      ...nextPatch,
      hasFace: false,
      lastLandmarks: null,
      lastDebugData: null,
    };
  }

  if (nextStatus === AR_SESSION_STATES.TRACKING) {
    return {
      ...nextPatch,
      hasFace: true,
    };
  }

  if (nextStatus === AR_SESSION_STATES.ERROR && nextPatch.cameraStarted === false) {
    return {
      ...nextPatch,
      isSwitchingCamera: false,
      hasFace: false,
      lastLandmarks: null,
      lastDebugData: null,
    };
  }

  return nextPatch;
}
