// @ts-check

import {
  AR_SESSION_STATES,
  CAMERA_FACING_MODES,
  getCameraLabel,
  getCameraSwitchingLabel,
} from '../AppState.js';
import { createIdleTrackerStats } from '../RealtimeTrackingStore.js';

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
    this.ui.clearError();
    this.ui.elements.startButton.disabled = true;
    this.ui.elements.switchCameraButton.disabled = true;
    this.ui.elements.stopCameraButton.disabled = true;
    this.ui.setStartButtonLabel('啟動中...');
    this.realtimeStore.clearTracking();
    this.necklaceController.fadeOut();
    this.appState.transitionSession(AR_SESSION_STATES.CAMERA_STARTING, {}, 'camera-start-request');

    try {
      const sessionService = await this.getSessionService();
      const session = await sessionService.start(this.appState.get('cameraFacingMode'));
      this.rendererLoop.resume();
      this.scene.resize();
      this.debugOverlay.resize();
      this.appState.transitionSession(
        AR_SESSION_STATES.NO_FACE,
        {
          cameraStarted: true,
          cameraFacingMode: session.cameraFacingMode,
        },
        'camera-start',
      );
      this.ui.setCameraOn(true);
      this.ui.setCaptureDisabled(false);
      this.ui.setStatus('idle', '相機已啟動', '正在尋找臉部');
      this.ui.setStartButtonLabel('相機運作中');
    } catch (error) {
      this.stopCameraSession({ eventName: 'camera-start-cleanup' });
      this.appState.transitionSession(
        AR_SESSION_STATES.ERROR,
        { cameraStarted: false },
        'camera-start-error',
      );
      this.showError(`無法啟動相機：${formatUnknownError(error)}`);
      this.ui.setStatus('error', '相機啟動失敗', '請確認瀏覽器權限與 HTTPS/localhost 環境');
    }
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
    this.appState.transitionSession(
      AR_SESSION_STATES.CAMERA_STARTING,
      { isSwitchingCamera: true },
      'camera-switch-start',
    );
    this.ui.setCaptureDisabled(true);
    this.ui.setStatus('idle', '正在切換鏡頭', getCameraSwitchingLabel(nextFacingMode));

    try {
      const sessionService = await this.getSessionService();
      const session = await sessionService.switchCamera(previousFacingMode, {
        onRestoreStart: ({ error }) => {
          const failedLabel = getCameraLabel(nextFacingMode);
          this.showError(`無法切換到${failedLabel}：${formatUnknownError(error)}`);
          this.ui.setStatus('error', '鏡頭切換失敗', `正在恢復${getCameraLabel(previousFacingMode)}`);
        },
      });
      this.scene.resize();
      this.debugOverlay.resize();
      this.appState.transitionSession(
        AR_SESSION_STATES.NO_FACE,
        {
          cameraStarted: true,
          cameraFacingMode: session.cameraFacingMode,
          isSwitchingCamera: false,
        },
        session.status === 'restored' ? 'camera-switch-restore' : 'camera-switch-success',
      );

      if (session.status === 'restored') {
        this.ui.setStatus('idle', '已恢復原鏡頭', this.getActiveCameraLabel());
      } else {
        this.ui.setStatus('idle', '鏡頭已切換', this.getActiveCameraLabel());
      }
    } catch (error) {
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
      this.ui.setCaptureDisabled(!this.appState.get('cameraStarted'));
    }
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
