// @ts-check

import {
  AR_SESSION_STATES,
  CAMERA_FACING_MODES,
  getCameraLabel,
  getCameraSwitchingLabel,
} from '../AppState.js';
import { createIdleTrackerStats } from '../RealtimeTrackingStore.js';
import { runtimeErrorReporter } from '../../telemetry/RuntimeErrorReporter.js';

const FACE_MESH_INIT_TIMEOUT_CODE = 'FACE_MESH_INIT_TIMEOUT';

/** @typedef {import('../../types/domain').ArSessionStatus} ArSessionStatus */
/** @typedef {import('../../types/domain').CameraFacingMode} CameraFacingMode */
/** @typedef {import('../../types/domain').FaceMeshResults} FaceMeshResults */
/** @typedef {import('../../types/domain').TrackerStats} TrackerStats */
/** @typedef {import('../../types/domain').WorkflowStatusView} WorkflowStatusView */
/** @typedef {import('../../types/app-ports').AppStatePort} AppStatePort */
/** @typedef {import('../../types/scene-ports').NecklaceSceneModePort} NecklaceSceneModePort */
/** @typedef {import('../ArSessionService.js').ArSessionService} ArSessionService */
/** @typedef {import('../RealtimeTrackingStore.js').RealtimeTrackingStore} RealtimeTrackingStore */

/**
 * @typedef {{
 *   elements: {
 *     video: HTMLVideoElement,
 *     startButton: HTMLButtonElement,
 *     switchCameraButton: HTMLButtonElement,
 *     stopCameraButton: HTMLButtonElement,
 *   },
 *   clearError: () => void,
 *   setStartButtonLabel: (label: string) => void,
 *   setCameraOn: (isCameraOn: boolean) => void,
 *   setCaptureDisabled: (isDisabled: boolean) => void,
 *   setStatus: (kind: WorkflowStatusView['kind'], label: string, metrics: string) => void,
 *   setCalibrationDragging: (isDragging: boolean) => void,
 * }} CameraSessionUiPort
 */

/**
 * @typedef {{
 *   appState: AppStatePort,
 *   ui: CameraSessionUiPort,
 *   realtimeStore: RealtimeTrackingStore,
 *   scene: NecklaceSceneModePort,
 *   debugOverlay: import('../../core/DebugOverlay.js').DebugOverlay,
 *   necklaceController: import('../../core/NecklaceController.js').NecklaceController,
 *   calibrationService: import('../CalibrationService.js').CalibrationService,
 *   rendererLoop: import('../RendererLoop.js').RendererLoop,
 *   onFaceResults: (results: FaceMeshResults) => void,
 *   onFaceTrackerStats: (stats: TrackerStats) => void,
 *   showError: (message: string) => void,
 * }} CameraSessionUseCaseOptions
 */

export class CameraSessionUseCase {
  /**
   * @param {CameraSessionUseCaseOptions} options
   */
  constructor({
    appState,
    ui,
    realtimeStore,
    scene,
    debugOverlay,
    necklaceController,
    calibrationService,
    rendererLoop,
    onFaceResults,
    onFaceTrackerStats,
    showError,
  }) {
    this.appState = appState;
    this.ui = ui;
    this.realtimeStore = realtimeStore;
    this.scene = scene;
    this.debugOverlay = debugOverlay;
    this.necklaceController = necklaceController;
    this.calibrationService = calibrationService;
    this.rendererLoop = rendererLoop;
    this.onFaceResults = onFaceResults;
    this.onFaceTrackerStats = onFaceTrackerStats;
    this.showError = showError;
    /** @type {ArSessionService | null} */
    this.sessionService = null;
    /** @type {Promise<ArSessionService> | null} */
    this.sessionServicePromise = null;
  }

  /**
   * @returns {Promise<void>}
   */
  async startExperience() {
    if (this.appState.get('cameraStarted')) {
      await this.retryFaceTracking();
      return;
    }

    this.ui.clearError();
    this.ui.elements.startButton.disabled = true;
    this.ui.elements.switchCameraButton.disabled = true;
    this.ui.elements.stopCameraButton.disabled = true;
    this.ui.setStartButtonLabel('啟動相機中...');
    this.realtimeStore.clearTracking();
    this.necklaceController.fadeOut();
    this.appState.transitionSession(AR_SESSION_STATES.CAMERA_STARTING, {}, 'camera-start-request');
    this.ui.setStatus('loading', '正在啟動相機', '請允許瀏覽器使用鏡頭');

    /** @type {ArSessionService} */
    let sessionService;
    try {
      sessionService = await this.getSessionService();
    } catch (error) {
      this.handleFaceTrackingLoadError(error, { cameraStarted: false, eventName: 'session-service-load-error' });
      return;
    }

    await this.startCameraAndFaceTracking(sessionService);
  }

  /**
   * @returns {void}
   */
  stopExperience() {
    const state = this.appState.getSnapshot();
    if (!state.cameraStarted && !state.isSwitchingCamera) return;

    this.ui.clearError();
    this.stopCameraSession();
    this.ui.setStatus('idle', '相機已關閉', '鏡頭已停止，可重新開啟相機');
  }

  /**
   * @returns {Promise<void>}
   */
  async switchCamera() {
    const state = this.appState.getSnapshot();
    if (!state.cameraStarted || state.isSwitchingCamera) return;

    const previousFacingMode = state.cameraFacingMode;
    const nextFacingMode = getNextFacingMode(previousFacingMode);

    this.ui.clearError();
    this.realtimeStore.clearTracking();
    this.necklaceController.fadeOut();
    this.appState.transitionSession(
      AR_SESSION_STATES.CAMERA_STARTING,
      { isSwitchingCamera: true },
      'camera-switch-start',
    );
    this.ui.setCaptureDisabled(true);
    this.ui.setStatus('idle', '正在切換鏡頭', getCameraSwitchingLabel(nextFacingMode));

    try {
      const sessionService = await this.getSessionService();
      const session = await sessionService.switchCameraStream(previousFacingMode, {
        onRestoreStart: ({ error }) => {
          const failedLabel = getCameraLabel(nextFacingMode);
          this.showError(`無法切換到${failedLabel}：${formatUnknownError(error)}`);
          this.ui.setStatus('error', '鏡頭切換失敗', `正在恢復${getCameraLabel(previousFacingMode)}`);
        },
      });
      this.applyCameraReady(
        session,
        session.status === 'restored' ? 'camera-switch-restore' : 'camera-switch-success',
      );
      await this.startFaceTracking(sessionService, {
        eventName: session.status === 'restored' ? 'face-tracking-restore-start' : 'face-tracking-switch-start',
      });
    } catch (error) {
      this.reportCameraError(error, 'camera.switch_failed');
      this.stopCameraSession({ eventName: 'camera-switch-cleanup' });
      this.appState.transitionSession(
        AR_SESSION_STATES.ERROR,
        { cameraStarted: false },
        'camera-switch-error',
      );
      const restoreError = getRestoreError(error);
      this.showError(`鏡頭切換失敗，且無法恢復原鏡頭：${formatUnknownError(restoreError)}`);
      this.ui.setStatus('error', '相機已停止', '請重新啟動相機');
    } finally {
      if (this.appState.get('isSwitchingCamera')) {
        this.appState.set({ isSwitchingCamera: false }, 'camera-switch-end');
      }
      this.ui.setCaptureDisabled(this.shouldDisableCapture());
    }
  }

  /**
   * @param {ArSessionService} sessionService
   * @returns {Promise<void>}
   */
  async startCameraAndFaceTracking(sessionService) {
    try {
      const session = await sessionService.startCamera(this.appState.get('cameraFacingMode'));
      this.applyCameraReady(session, 'camera-start');
    } catch (error) {
      this.reportCameraError(error, 'camera.start_failed');
      this.stopCameraSession({ eventName: 'camera-start-cleanup' });
      this.appState.transitionSession(
        AR_SESSION_STATES.ERROR,
        { cameraStarted: false },
        'camera-start-error',
      );
      this.showError(`無法啟動相機：${formatUnknownError(error)}`);
      this.ui.setStatus('error', '相機啟動失敗', '請確認瀏覽器權限與 HTTPS/localhost 環境');
      return;
    }

    await this.startFaceTracking(sessionService, { eventName: 'face-tracking-start' });
  }

  /**
   * @returns {Promise<void>}
   */
  async retryFaceTracking() {
    this.ui.clearError();
    this.realtimeStore.clearTracking();
    this.necklaceController.fadeOut();

    /** @type {ArSessionService} */
    let sessionService;
    try {
      sessionService = await this.getSessionService();
    } catch (error) {
      this.handleFaceTrackingLoadError(error, {
        cameraStarted: this.appState.get('cameraStarted'),
        eventName: 'session-service-retry-load-error',
      });
      return;
    }

    if (typeof sessionService.isCameraActive === 'function' && !sessionService.isCameraActive()) {
      this.ui.elements.startButton.disabled = true;
      this.ui.elements.switchCameraButton.disabled = true;
      this.ui.elements.stopCameraButton.disabled = true;
      this.ui.setStartButtonLabel('啟動相機中...');
      this.ui.setStatus('loading', '正在重新啟動相機', '鏡頭已中斷，需重新取得相機');
      this.appState.transitionSession(
        AR_SESSION_STATES.CAMERA_STARTING,
        { cameraStarted: false },
        'camera-restart-after-interrupt',
      );
      await this.startCameraAndFaceTracking(sessionService);
      return;
    }

    await this.startFaceTracking(sessionService, { eventName: 'face-tracking-retry' });
  }

  /**
   * @param {ArSessionService} sessionService
   * @param {{ eventName?: string }} [options]
   * @returns {Promise<void>}
   */
  async startFaceTracking(sessionService, { eventName = 'face-tracking-start' } = {}) {
    this.realtimeStore.clearTracking();
    this.ui.elements.startButton.disabled = true;
    this.ui.elements.switchCameraButton.disabled = true;
    this.ui.elements.stopCameraButton.disabled = false;
    this.ui.setStartButtonLabel('追蹤載入中...');
    this.ui.setCaptureDisabled(true);
    if (this.appState.get('sessionStatus') !== AR_SESSION_STATES.TRACKING_STARTING) {
      this.appState.transitionSession(AR_SESSION_STATES.TRACKING_STARTING, {}, eventName);
    }
    this.ui.setStatus('loading', '相機已啟動', '正在載入臉部追蹤資產');

    try {
      await sessionService.startFaceTracking();
      this.appState.transitionSession(AR_SESSION_STATES.NO_FACE, {}, 'face-tracking-ready');
      this.ui.elements.startButton.disabled = true;
      this.ui.elements.switchCameraButton.disabled = false;
      this.ui.elements.stopCameraButton.disabled = false;
      this.ui.setStartButtonLabel('相機運作中');
      this.ui.setCaptureDisabled(false);
      this.ui.setStatus('idle', '臉部追蹤已啟動', '正在尋找臉部');
    } catch (error) {
      this.handleFaceTrackingLoadError(error, {
        cameraStarted: true,
        eventName: 'face-tracking-error',
      });
    }
  }

  /**
   * @param {{ cameraFacingMode: CameraFacingMode }} session
   * @param {string} eventName
   * @returns {void}
   */
  applyCameraReady(session, eventName) {
    this.rendererLoop.resume();
    this.scene.resize();
    this.debugOverlay.resize();
    this.appState.transitionSession(
      AR_SESSION_STATES.TRACKING_STARTING,
      {
        cameraStarted: true,
        cameraFacingMode: session.cameraFacingMode,
        isSwitchingCamera: false,
      },
      eventName,
    );
    this.ui.setCameraOn(true);
    this.ui.elements.stopCameraButton.disabled = false;
    this.ui.elements.switchCameraButton.disabled = true;
    this.ui.setCaptureDisabled(true);
    this.ui.setStatus('loading', '相機已啟動', '正在載入臉部追蹤資產');
  }

  /**
   * @param {unknown} error
   * @param {{ cameraStarted: boolean, eventName: string }} options
   * @returns {void}
   */
  handleFaceTrackingLoadError(error, { cameraStarted, eventName }) {
    this.reportFaceTrackingError(error);
    this.realtimeStore.clearTracking();
    this.realtimeStore.setTrackerStats(createIdleTrackerStats());
    this.necklaceController.fadeOut();
    this.appState.transitionSession(
      cameraStarted ? AR_SESSION_STATES.TRACKING_ERROR : AR_SESSION_STATES.ERROR,
      {
        cameraStarted,
        isSwitchingCamera: false,
      },
      eventName,
    );
    this.ui.setCameraOn(cameraStarted);
    this.ui.setCaptureDisabled(true);
    this.ui.elements.startButton.disabled = false;
    this.ui.elements.switchCameraButton.disabled = !cameraStarted;
    this.ui.elements.stopCameraButton.disabled = !cameraStarted;
    this.ui.setStartButtonLabel('重試臉部追蹤');
    const errorLabel = getFaceTrackingLoadErrorLabel(error);
    this.showError(formatFaceTrackingLoadError(error, errorLabel));
    this.ui.setStatus(
      'error',
      errorLabel,
      cameraStarted ? '相機仍在運作，可重試載入臉部追蹤' : '請重試載入臉部追蹤資產',
    );
    this.rendererLoop.requestRender();
  }

  /**
   * @returns {boolean}
   */
  shouldDisableCapture() {
    const status = this.appState.get('sessionStatus');
    return (
      !this.appState.get('cameraStarted') ||
      status === AR_SESSION_STATES.TRACKING_STARTING ||
      status === AR_SESSION_STATES.TRACKING_ERROR
    );
  }

  /**
   * @param {{ nextStatus?: ArSessionStatus, eventName?: string }} [options]
   * @returns {void}
   */
  stopCameraSession({ nextStatus = AR_SESSION_STATES.AR_IDLE, eventName = 'camera-stop' } = {}) {
    this.sessionService?.stop();
    this.realtimeStore.clearTracking();
    this.realtimeStore.setTrackerStats(createIdleTrackerStats());
    this.necklaceController.reset();
    this.calibrationService.cancelDrag();
    this.ui.setCalibrationDragging(false);
    this.appState.transitionSession(
      nextStatus,
      {
        cameraStarted: false,
        isSwitchingCamera: false,
      },
      eventName,
    );
    this.ui.setCameraOn(false);
    this.ui.setCaptureDisabled(true);
    this.ui.elements.startButton.disabled = false;
    this.ui.setStartButtonLabel('開始相機');
    this.rendererLoop.requestRender();
  }

  /**
   * @returns {void}
   */
  pauseTracking() {
    this.sessionService?.pauseTracking();
  }

  /**
   * @returns {Promise<void>}
   */
  async resumeTracking() {
    await this.sessionService?.resumeTracking();
  }

  /**
   * @returns {string}
   */
  getActiveCameraLabel() {
    return `目前使用${getCameraLabel(this.appState.get('cameraFacingMode'))}`;
  }

  /**
   * @returns {Promise<ArSessionService>}
   */
  async getSessionService() {
    if (this.sessionService) return this.sessionService;

    if (!this.sessionServicePromise) {
      this.sessionServicePromise = import('../ArSessionService.js')
        .then(({ ArSessionService }) => {
          const service = new ArSessionService({
            videoElement: this.ui.elements.video,
            onResults: (results) => this.onFaceResults(results),
            onError: (error) => this.showError(`Face Mesh 偵測發生錯誤：${formatUnknownError(error)}`),
            onStatsUpdate: (stats) => this.onFaceTrackerStats(stats),
          });
          this.sessionService = service;
          return service;
        })
        .catch((error) => {
          this.sessionServicePromise = null;
          throw error;
        });
    }

    return this.sessionServicePromise;
  }

  /**
   * Loads the AR session service bundle ahead of the first camera start.
   * This only creates the service shell; camera permission and Face Mesh frame processing still begin in start().
   *
   * @returns {Promise<ArSessionService | null>}
   */
  preloadSessionService() {
    return this.getSessionService().catch((error) => {
      runtimeErrorReporter.captureError(error, {
        eventType: 'ar_session.preload_failed',
        feature: 'ar-session',
        level: 'warning',
      });
      return null;
    });
  }

  /**
   * @param {unknown} error
   * @param {string} eventType
   * @returns {void}
   */
  reportCameraError(error, eventType) {
    runtimeErrorReporter.captureError(error, {
      eventType,
      feature: 'camera',
      extra: {
        requestedFacingMode: this.appState.get('cameraFacingMode'),
      },
    });
  }

  /**
   * @param {unknown} error
   * @returns {void}
   */
  reportFaceTrackingError(error) {
    const isTimeout = isFaceMeshInitTimeoutError(error);
    runtimeErrorReporter.captureError(error, {
      eventType: isTimeout ? 'face_tracking.init_timeout' : 'face_tracking.init_failed',
      feature: 'face-tracking',
      tags: {
        error_code: getErrorCode(error),
      },
      extra: {
        sessionStatus: this.appState.get('sessionStatus'),
        timeoutMs: getErrorTimeoutMs(error),
        assetUrls: getErrorStringArray(error, 'assetUrls'),
        resolvedAssetUrls: getErrorStringArray(error, 'resolvedAssetUrls'),
        expectedAssetUrls: getErrorStringArray(error, 'expectedAssetUrls'),
      },
    });
  }
}

/**
 * @param {unknown} error
 * @returns {string}
 */
function formatUnknownError(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * @param {unknown} error
 * @returns {string}
 */
function getFaceTrackingLoadErrorLabel(error) {
  return isFaceMeshInitTimeoutError(error) ? '臉部追蹤資產載入逾時' : '臉部追蹤資產載入失敗';
}

/**
 * @param {unknown} error
 * @param {string} label
 * @returns {string}
 */
function formatFaceTrackingLoadError(error, label) {
  const message = formatUnknownError(error);
  return message.includes(label) ? message : `${label}：${message}`;
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
function isFaceMeshInitTimeoutError(error) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === FACE_MESH_INIT_TIMEOUT_CODE
  );
}

/**
 * @param {unknown} error
 * @returns {string | undefined}
 */
function getErrorCode(error) {
  if (!error || typeof error !== 'object' || !('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
}

/**
 * @param {unknown} error
 * @returns {number | undefined}
 */
function getErrorTimeoutMs(error) {
  if (!error || typeof error !== 'object' || !('timeoutMs' in error)) return undefined;
  return typeof error.timeoutMs === 'number' ? error.timeoutMs : undefined;
}

/**
 * @param {unknown} error
 * @param {'assetUrls' | 'resolvedAssetUrls' | 'expectedAssetUrls'} key
 * @returns {string[] | undefined}
 */
function getErrorStringArray(error, key) {
  if (!error || typeof error !== 'object' || !(key in error)) return undefined;
  const value = /** @type {Record<string, unknown>} */ (error)[key];
  if (!Array.isArray(value)) return undefined;
  return value.filter((item) => typeof item === 'string');
}

/**
 * @param {unknown} error
 * @returns {unknown}
 */
function getRestoreError(error) {
  if (error && typeof error === 'object' && 'restoreError' in error) {
    return error.restoreError ?? error;
  }

  return error;
}

/**
 * @param {CameraFacingMode} facingMode
 * @returns {CameraFacingMode}
 */
function getNextFacingMode(facingMode) {
  return facingMode === CAMERA_FACING_MODES.USER
    ? CAMERA_FACING_MODES.ENVIRONMENT
    : CAMERA_FACING_MODES.USER;
}
