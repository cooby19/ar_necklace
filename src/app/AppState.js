// @ts-check

/** @typedef {import('../types/domain').AppMode} AppMode */
/** @typedef {import('../types/domain').AppStateListener} AppStateListener */
/** @typedef {import('../types/domain').AppStatePatch} AppStatePatch */
/** @typedef {import('../types/domain').AppStateSnapshot} AppStateSnapshot */
/** @typedef {import('../types/domain').ArSessionStatus} ArSessionStatus */
/** @typedef {import('../types/domain').CameraFacingMode} CameraFacingMode */
/** @typedef {import('../types/domain').ColorSelectionByTarget} ColorSelectionByTarget */
/** @typedef {import('../types/domain').NecklaceConfig} NecklaceConfig */
/** @typedef {import('../types/domain').TuningDefaults} TuningDefaults */

/** @satisfies {TuningDefaults} */
export const TUNING_DEFAULTS = {
  verticalOffset: 0,
  scale: 100,
  rotation: 0,
};

/** @satisfies {{ readonly USER: CameraFacingMode, readonly ENVIRONMENT: CameraFacingMode }} */
export const CAMERA_FACING_MODES = {
  USER: 'user',
  ENVIRONMENT: 'environment',
};

/** @satisfies {{ readonly SHOWCASE: AppMode, readonly AR: AppMode }} */
export const APP_MODES = {
  SHOWCASE: 'showcase',
  AR: 'ar',
};

/** @satisfies {Record<string, ArSessionStatus>} */
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

/** @type {Record<ArSessionStatus, readonly ArSessionStatus[]>} */
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
  /**
   * @param {{ necklaces: readonly NecklaceConfig[] }} options
   */
  constructor({ necklaces }) {
    const defaultNecklace = necklaces[0];

    /** @type {AppStateSnapshot} */
    this.state = {
      mode: APP_MODES.SHOWCASE,
      sessionStatus: AR_SESSION_STATES.SHOWCASE,
      cameraStarted: false,
      cameraFacingMode: CAMERA_FACING_MODES.USER,
      isSwitchingCamera: false,
      modelLoaded: false,
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

    /** @type {Set<AppStateListener>} */
    this.listeners = new Set();
  }

  /**
   * @template {keyof AppStateSnapshot} K
   * @param {K} key
   * @returns {AppStateSnapshot[K]}
   */
  get(key) {
    return this.state[key];
  }

  /**
   * @returns {AppStateSnapshot}
   */
  getSnapshot() {
    return {
      ...this.state,
      selectedColorIdsByTarget: { ...this.state.selectedColorIdsByTarget },
      adjustments: { ...this.state.adjustments },
    };
  }

  /**
   * @param {AppStatePatch | null | undefined} patch
   * @param {string} [eventName]
   * @returns {AppStateSnapshot}
   */
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

    const changes = /** @type {(keyof AppStatePatch)[]} */ (Object.keys(patch));
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

  /**
   * @param {(snapshot: AppStateSnapshot) => AppStatePatch | null | undefined} updater
   * @param {string} [eventName]
   * @returns {AppStateSnapshot}
   */
  update(updater, eventName = 'update') {
    const patch = updater(this.getSnapshot());
    return this.set(patch, eventName);
  }

  /**
   * @param {ArSessionStatus} nextStatus
   * @param {AppStatePatch} [patch]
   * @param {string} [eventName]
   * @returns {AppStateSnapshot}
   */
  transitionSession(nextStatus, patch = {}, eventName = 'session-transition') {
    if (!canTransitionSession(this.state.sessionStatus, nextStatus)) {
      console.warn(
        `[AppState] 忽略不合法的 AR session transition：${this.state.sessionStatus} -> ${nextStatus}`,
      );
      return this.getSnapshot();
    }

    return this.set(createSessionPatch(nextStatus, patch), eventName);
  }

  /**
   * @param {AppStateListener} listener
   * @returns {() => void}
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

/**
 * @param {string | null | undefined} actualFacingMode
 * @param {CameraFacingMode} fallbackFacingMode
 * @returns {CameraFacingMode}
 */
export function normalizeFacingMode(actualFacingMode, fallbackFacingMode) {
  if (actualFacingMode === CAMERA_FACING_MODES.USER || actualFacingMode === CAMERA_FACING_MODES.ENVIRONMENT) {
    return actualFacingMode;
  }

  return fallbackFacingMode;
}

/**
 * @param {CameraFacingMode} facingMode
 * @returns {boolean}
 */
export function isSelfieCamera(facingMode) {
  return facingMode !== CAMERA_FACING_MODES.ENVIRONMENT;
}

/**
 * @param {CameraFacingMode} facingMode
 * @returns {string}
 */
export function getCameraLabel(facingMode) {
  return isSelfieCamera(facingMode) ? '前鏡頭' : '後鏡頭';
}

/**
 * @param {CameraFacingMode} facingMode
 * @returns {string}
 */
export function getCameraSwitchingLabel(facingMode) {
  return `準備使用${getCameraLabel(facingMode)}`;
}

/**
 * @param {NecklaceConfig | null | undefined} necklace
 * @returns {ColorSelectionByTarget}
 */
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

/**
 * @param {ArSessionStatus} currentStatus
 * @param {ArSessionStatus} nextStatus
 * @returns {boolean}
 */
export function canTransitionSession(currentStatus, nextStatus) {
  return Boolean(SESSION_TRANSITIONS[currentStatus]?.includes(nextStatus));
}

/**
 * @param {ArSessionStatus} nextStatus
 * @param {AppStatePatch} [patch]
 * @returns {AppStatePatch}
 */
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
    };
  }

  if (nextStatus === AR_SESSION_STATES.CAMERA_STARTING) {
    return {
      ...nextPatch,
    };
  }

  if (nextStatus === AR_SESSION_STATES.NO_FACE) {
    return nextPatch;
  }

  if (nextStatus === AR_SESSION_STATES.TRACKING) {
    return nextPatch;
  }

  if (nextStatus === AR_SESSION_STATES.ERROR && nextPatch.cameraStarted === false) {
    return {
      ...nextPatch,
      isSwitchingCamera: false,
    };
  }

  return nextPatch;
}
