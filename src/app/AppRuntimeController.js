// @ts-check

import {
  APP_MODES,
  AR_SESSION_STATES,
} from './AppState.js';
import { reduceAppIntent } from './app-reducer';
import { CalibrationUseCase } from './use-cases/CalibrationUseCase.js';
import { CameraSessionUseCase } from './use-cases/CameraSessionUseCase.js';
import { ModelUseCase } from './use-cases/ModelUseCase.js';
import { ShareUseCase } from './use-cases/ShareUseCase.js';
import { TrackingUseCase } from './use-cases/TrackingUseCase.js';

/** @typedef {import('../types/domain').AppStateMeta} AppStateMeta */
/** @typedef {import('../types/domain').AppStateSnapshot} AppStateSnapshot */
/** @typedef {import('../types/domain').ArSessionStatus} ArSessionStatus */
/** @typedef {import('../types/domain').DeveloperPanelModel} DeveloperPanelModel */
/** @typedef {import('../types/domain').FaceMeshResults} FaceMeshResults */
/** @typedef {import('../types/domain').RealtimeTrackingSnapshot} RealtimeTrackingSnapshot */
/** @typedef {import('../types/domain').TrackerStats} TrackerStats */
/** @typedef {import('../types/domain').WearAdjustmentPatch} WearAdjustmentPatch */
/** @typedef {import('../types/domain').WorkflowStatusView} WorkflowStatusView */
/** @typedef {import('../types/app-ports').AppStatePort} AppStatePort */
/** @typedef {import('../types/ui-ports').CalibrationHintOptions} CalibrationHintOptions */
/** @typedef {import('../types/ui-ports').ColorAvailabilityUiModel} ColorAvailabilityUiModel */
/** @typedef {import('../types/ui-ports').ColorSwatchesUiModel} ColorSwatchesUiModel */
/** @typedef {import('../types/ui-ports').TuningControlsReadResult} TuningControlsReadResult */
/** @typedef {import('../types/scene-ports').NecklaceSceneModePort} NecklaceSceneModePort */
/** @typedef {import('./app-intents').AppIntent} AppIntent */
/** @typedef {import('./app-reducer').AppReducerResult} AppReducerResult */
/** @typedef {import('./createAppRuntime.js').AppRuntime} AppRuntime */

/**
 * Local composition port for the UI root surface consumed by runtime wiring and use-cases.
 * It is intentionally kept out of shared type modules so individual use-cases can own narrower ports.
 *
 * @typedef {{
 *   elements: {
 *     video: HTMLVideoElement,
 *     threeCanvas: HTMLCanvasElement,
 *     startButton: HTMLButtonElement,
 *     switchCameraButton: HTMLButtonElement,
 *     stopCameraButton: HTMLButtonElement,
 *   },
 *   populateNecklaceSelect: (selectedNecklaceId: string) => void,
 *   populateColorSwatches: (model: ColorSwatchesUiModel) => void,
 *   syncFromState: (state: AppStateSnapshot, meta?: Partial<AppStateMeta>) => void,
 *   canSelectControlPanel: (panelName: string) => boolean,
 *   setShowcaseDragging: (isDragging: boolean) => void,
 *   setCalibrationDragging: (isDragging: boolean) => void,
 *   syncTuningControlsFromAdjustments: (adjustments: WearAdjustmentPatch) => TuningControlsReadResult,
 *   setCalibrationHint: (message: string, options?: CalibrationHintOptions) => void,
 *   readTuningControls: () => TuningControlsReadResult,
 *   clearError: () => void,
 *   showError: (message: string) => void,
 *   setStartButtonLabel: (label: string) => void,
 *   setCameraOn: (isCameraOn: boolean) => void,
 *   setCaptureDisabled: (isDisabled: boolean) => void,
 *   setCaptureBusy: (isBusy: boolean) => void,
 *   setStatus: (kind: WorkflowStatusView['kind'], label: string, metrics: string) => void,
 *   setShareImage: (url: string) => void,
 *   openShareSheet: () => void,
 *   closeShareSheet: () => void,
 *   updateDeveloperPanel: (model: DeveloperPanelModel) => void,
 *   updateColorUiAvailability: (availability: ColorAvailabilityUiModel) => void,
 *   syncNecklaceSelection: (necklaceId: string) => void,
 *   hasCurrentVideoFrame: () => boolean,
 * }} AppRuntimeUiPort
 */

/**
 * @typedef {{
 *   appState: AppStatePort,
 *   uiRoot?: AppRuntimeUiPort,
 *   uiController?: AppRuntimeUiPort,
 *   runtime: AppRuntime,
 * }} AppRuntimeControllerOptions
 */

export class AppRuntimeController {
  /**
   * @param {AppRuntimeControllerOptions} options
   */
  constructor({ appState, uiRoot, uiController, runtime }) {
    const ui = uiRoot ?? uiController;
    if (!ui) {
      throw new Error('AppRuntimeController requires a uiRoot');
    }

    this.runtime = runtime;
    this.appState = appState;
    this.ui = ui;
    this.realtimeStore = runtime.realtimeStore;
    /** @type {NecklaceSceneModePort} */
    this.scene = /** @type {NecklaceSceneModePort} */ (runtime.scene);
    this.controller = runtime.necklaceController;
    this.debugOverlay = runtime.debugOverlay;
    this.modelCatalog = runtime.modelCatalog;
    this.calibrationService = runtime.calibrationService;
    this.shareWorkflow = runtime.shareWorkflow;
    this.rendererLoop = runtime.rendererLoop;
    this.feedbackService = runtime.feedbackService;
    /** @type {(() => void) | null} */
    this.cancelSessionServicePreload = null;
    this.calibrationUseCase = new CalibrationUseCase({
      appState: this.appState,
      ui: this.ui,
      realtimeStore: this.realtimeStore,
      calibrationService: this.calibrationService,
      necklaceController: this.controller,
      rendererLoop: this.rendererLoop,
    });
    this.shareUseCase = new ShareUseCase({
      appState: this.appState,
      ui: this.ui,
      realtimeStore: this.realtimeStore,
      shareWorkflow: this.shareWorkflow,
      showError: (message) => this.showError(message),
    });
    this.trackingUseCase = new TrackingUseCase({
      appState: this.appState,
      ui: this.ui,
      realtimeStore: this.realtimeStore,
      necklaceController: this.controller,
      rendererLoop: this.rendererLoop,
      feedbackService: this.feedbackService,
      calibrationUseCase: this.calibrationUseCase,
    });
    this.cameraSessionUseCase = new CameraSessionUseCase({
      appState: this.appState,
      ui: this.ui,
      realtimeStore: this.realtimeStore,
      scene: this.scene,
      debugOverlay: this.debugOverlay,
      necklaceController: this.controller,
      calibrationService: this.calibrationService,
      rendererLoop: this.rendererLoop,
      onFaceResults: (results) => this.handleFaceResults(results),
      onFaceTrackerStats: (stats) => this.handleFaceTrackerStats(stats),
      showError: (message) => this.showError(message),
    });
    this.modelUseCase = new ModelUseCase({
      appState: this.appState,
      ui: this.ui,
      modelCatalog: this.modelCatalog,
      necklaceController: this.controller,
      rendererLoop: this.rendererLoop,
      applyCalibrationForSelectedNecklace: () => this.applyCalibrationForSelectedNecklace(),
      syncModeEffects: () => this.syncModeEffects(),
      showError: (message) => this.showError(message),
    });
    /** @type {(() => void)[]} */
    this.lifecycleDisposers = [];
    runtime.setRenderStatsUpdateHandler(() => this.scheduleTrackingFeedbackUpdate());
  }

  /**
   * @returns {void}
   */
  init() {
    const state = this.getState();
    this.ui.populateNecklaceSelect(state.selectedNecklace.id);
    this.ui.populateColorSwatches({
      necklace: state.selectedNecklace,
      selectedColorIdsByTarget: state.selectedColorIdsByTarget,
      fallbackColorId: state.selectedColorId,
      targetIds: [],
    });
    this.ui.syncFromState(state);
    this.applyCalibrationForSelectedNecklace();
    this.syncColorAvailability();
    this.syncModeEffects();
    this.loadSelectedNecklace();
    this.bindPageLifecycle();
    this.rendererLoop.start();
    this.scheduleSessionServicePreload();
  }

  /**
   * @returns {void}
   */
  destroy() {
    this.cancelSessionServicePreload?.();
    this.cancelSessionServicePreload = null;
    this.lifecycleDisposers.splice(0).forEach((dispose) => dispose());
    this.trackingUseCase.dispose();
    this.runtime.setRenderStatsUpdateHandler(null);
  }

  /**
   * @param {AppIntent} intent
   * @returns {AppStateSnapshot | null}
   */
  dispatchAppIntent(intent) {
    return this.applyAppReducerResult(reduceAppIntent(this.getState(), intent));
  }

  /**
   * @param {AppReducerResult} result
   * @returns {AppStateSnapshot | null}
   */
  applyAppReducerResult(result) {
    if (result.kind === 'none') return null;

    if (result.kind === 'session-transition') {
      return this.appState.transitionSession(result.nextStatus, result.patch, result.eventName);
    }

    return this.appState.set(result.patch, result.eventName);
  }

  /**
   * @param {string | null | undefined} mode
   * @returns {void}
   */
  selectMode(mode) {
    const state = this.getState();
    const result = reduceAppIntent(state, { type: 'mode/select', mode });
    if (result.kind === 'none') return;

    if (mode === APP_MODES.SHOWCASE && state.cameraStarted) {
      this.stopCameraSession({
        nextStatus: AR_SESSION_STATES.SHOWCASE,
        eventName: 'mode-camera-stop',
      });
    }

    this.applyAppReducerResult(result);

    if (mode === APP_MODES.AR) {
      this.scene.setShowcaseMode(false);
      this.controller.reset();
      this.rendererLoop.requestRender();
      void this.preloadSessionService();
    }

    this.syncModeEffects();
  }

  /**
   * @param {string | null | undefined} panelName
   * @returns {void}
   */
  selectControlPanel(panelName) {
    if (!panelName) return;
    if (!this.ui.canSelectControlPanel(panelName)) return;
    this.dispatchAppIntent({ type: 'panel/select', panelName });
  }

  /**
   * @returns {void}
   */
  toggleBottomSheet() {
    this.dispatchAppIntent({ type: 'bottom-sheet/toggle' });
  }

  /**
   * @param {PointerEvent} event
   * @returns {void}
   */
  handleShowcasePointerDown(event) {
    const state = this.getState();
    if (state.mode === APP_MODES.AR) {
      this.handleCalibrationPointerDown(event);
      return;
    }

    if (state.mode !== APP_MODES.SHOWCASE || !state.modelLoaded) return;

    this.ui.elements.threeCanvas.setPointerCapture?.(event.pointerId);
    this.ui.setShowcaseDragging(true);
    this.scene.beginShowcaseDrag(event.clientX);
  }

  /**
   * @param {PointerEvent} event
   * @returns {void}
   */
  handleShowcasePointerMove(event) {
    const state = this.getState();
    if (state.mode === APP_MODES.AR) {
      this.handleCalibrationPointerMove(event);
      return;
    }

    if (state.mode !== APP_MODES.SHOWCASE || !state.modelLoaded) return;

    this.scene.dragShowcase(event.clientX);
  }

  /**
   * @param {PointerEvent} event
   * @returns {void}
   */
  handleShowcasePointerUp(event) {
    const state = this.getState();
    if (state.mode === APP_MODES.AR) {
      this.handleCalibrationPointerUp(event);
      return;
    }

    if (state.mode !== APP_MODES.SHOWCASE) return;

    this.ui.elements.threeCanvas.releasePointerCapture?.(event.pointerId);
    this.ui.setShowcaseDragging(false);
    this.scene.endShowcaseDrag();
  }

  /**
   * @param {PointerEvent} event
   * @returns {void}
   */
  handleCalibrationPointerDown(event) {
    this.calibrationUseCase.handlePointerDown(event);
  }

  /**
   * @param {PointerEvent} event
   * @returns {void}
   */
  handleCalibrationPointerMove(event) {
    this.calibrationUseCase.handlePointerMove(event);
  }

  /**
   * @param {PointerEvent} event
   * @returns {void}
   */
  handleCalibrationPointerUp(event) {
    this.calibrationUseCase.handlePointerUp(event);
  }

  /**
   * @returns {Promise<void>}
   */
  async startExperience() {
    return this.cameraSessionUseCase.startExperience();
  }

  /**
   * @returns {void}
   */
  stopExperience() {
    this.cameraSessionUseCase.stopExperience();
  }

  /**
   * @returns {Promise<void>}
   */
  async switchCamera() {
    return this.cameraSessionUseCase.switchCamera();
  }

  /**
   * @param {{ nextStatus?: ArSessionStatus, eventName?: string }} [options]
   * @returns {void}
   */
  stopCameraSession({ nextStatus = AR_SESSION_STATES.AR_IDLE, eventName = 'camera-stop' } = {}) {
    this.cameraSessionUseCase.stopCameraSession({ nextStatus, eventName });
  }

  /**
   * @returns {Promise<void>}
   */
  async handleCapture() {
    return this.shareUseCase.handleCapture();
  }

  /**
   * @returns {void}
   */
  downloadCapture() {
    this.shareUseCase.downloadCapture();
  }

  /**
   * @returns {Promise<void>}
   */
  async shareCapture() {
    return this.shareUseCase.shareCapture();
  }

  /**
   * @returns {void}
   */
  closeShareSheet() {
    this.shareUseCase.closeShareSheet();
  }

  /**
   * @param {string} url
   * @returns {void}
   */
  rememberCapturePreviewUrl(url) {
    this.shareUseCase.rememberCapturePreviewUrl(url);
  }

  /**
   * @param {string | null | undefined} necklaceId
   * @returns {void}
   */
  selectNecklace(necklaceId) {
    this.modelUseCase.selectNecklace(necklaceId);
  }

  /**
   * @param {string | null | undefined} colorId
   * @param {string | null | undefined} targetId
   * @returns {void}
   */
  selectColor(colorId, targetId) {
    this.modelUseCase.selectColor(colorId, targetId);
  }

  /**
   * @param {boolean} isEnabled
   * @returns {void}
   */
  handleDebugToggle(isEnabled) {
    this.dispatchAppIntent({ type: 'debug/toggle', isEnabled });
    this.debugOverlay.setEnabled(this.appState.get('mode') === APP_MODES.AR && isEnabled);
    this.updateDeveloperPanel();
    this.updateTrackingStatus();
  }

  /**
   * @param {boolean} isVisible
   * @returns {void}
   */
  handleNecklaceToggle(isVisible) {
    this.dispatchAppIntent({ type: 'necklace-visibility/toggle', isVisible });

    if (!isVisible) {
      this.controller.fadeOut();
    }
    this.rendererLoop.requestRender();
  }

  /**
   * @returns {void}
   */
  updateTuningFromControls() {
    this.calibrationUseCase.updateTuningFromControls();
  }

  /**
   * @returns {void}
   */
  saveCalibration() {
    this.calibrationUseCase.saveCalibration();
  }

  /**
   * @returns {void}
   */
  resetCalibration() {
    this.calibrationUseCase.resetCalibration();
  }

  /**
   * @returns {void}
   */
  applyCalibrationForSelectedNecklace() {
    this.calibrationUseCase.applyCalibrationForSelectedNecklace();
  }

  /**
   * @param {{ dirty?: boolean }} [options]
   * @returns {void}
   */
  updateCalibrationHint({ dirty = false } = {}) {
    this.calibrationUseCase.updateHint({ dirty });
  }

  /**
   * @param {WearAdjustmentPatch} adjustments
   * @param {string} [eventName]
   * @returns {void}
   */
  applyTuning(adjustments, eventName = 'tuning-change') {
    this.calibrationUseCase.applyTuning(adjustments, eventName);
  }

  /**
   * @param {{ message: string, options?: { isDirty?: boolean, isSaved?: boolean }} | null} hint
   * @returns {void}
   */
  applyCalibrationHint(hint) {
    this.calibrationUseCase.applyHint(hint);
  }

  /**
   * @returns {Promise<void>}
   */
  async loadSelectedNecklace() {
    return this.modelUseCase.loadSelectedNecklace();
  }

  /**
   * @returns {void}
   */
  syncModeEffects() {
    const state = this.getState();
    const isShowcase = state.mode === APP_MODES.SHOWCASE;

    this.debugOverlay.setEnabled(!isShowcase && state.debugEnabled);

    if (isShowcase) {
      this.scene.setShowcaseMode(state.modelLoaded);
      this.rendererLoop.requestRender();
      this.ui.setStatus(
        state.modelLoaded ? 'tracking' : 'loading',
        state.modelLoaded ? '模型展示' : '模型載入中',
        state.modelLoaded ? '拖曳旋轉模型，選擇喜歡的色彩' : state.selectedNecklace.label,
      );
      return;
    }

    this.scene.setShowcaseMode(false);

    if (!state.cameraStarted && state.modelLoaded) {
      this.controller.reset();
      this.rendererLoop.requestRender();
      this.ui.setStatus('idle', 'AR 試戴', '開啟相機後即可即時試戴');
    }
  }

  /**
   * @param {FaceMeshResults} results
   * @returns {void}
   */
  handleFaceResults(results) {
    this.trackingUseCase.handleFaceResults(results);
  }

  /**
   * @param {ArSessionStatus} nextStatus
   * @returns {boolean}
   */
  transitionLiveFaceStatus(nextStatus) {
    return this.trackingUseCase.transitionLiveFaceStatus(nextStatus);
  }

  /**
   * @param {AppStateSnapshot} state
   * @returns {boolean}
   */
  shouldPreserveWorkflowStatus(state) {
    return this.trackingUseCase.shouldPreserveWorkflowStatus(state);
  }

  /**
   * @returns {void}
   */
  markCalibrationReady() {
    this.calibrationUseCase.markFaceReady();
  }

  /**
   * @param {TrackerStats} stats
   * @returns {void}
   */
  handleFaceTrackerStats(stats) {
    this.trackingUseCase.handleFaceTrackerStats(stats);
  }

  /**
   * @param {{ force?: boolean }} [options]
   * @returns {void}
   */
  scheduleTrackingFeedbackUpdate({ force = false } = {}) {
    this.trackingUseCase.scheduleFeedbackUpdate({ force });
  }

  /**
   * @param {number} [now]
   * @returns {void}
   */
  flushTrackingFeedback(now = performance.now()) {
    this.trackingUseCase.flushFeedback(now);
  }

  /**
   * @returns {void}
   */
  updateDeveloperPanel() {
    this.trackingUseCase.updateDeveloperPanel();
  }

  /**
   * @returns {void}
   */
  updateTrackingStatus() {
    this.trackingUseCase.updateTrackingStatus();
  }

  /**
   * @returns {void}
   */
  syncColorAvailability() {
    this.modelUseCase.syncColorAvailability();
  }

  /**
   * @returns {string}
   */
  getActiveCameraLabel() {
    return this.cameraSessionUseCase.getActiveCameraLabel();
  }

  /**
   * @param {AppStateSnapshot} state
   * @param {RealtimeTrackingSnapshot} [realtime]
   * @returns {ArSessionStatus}
   */
  getLiveSessionStatus(state, realtime = this.realtimeStore.getSnapshot()) {
    return this.shareUseCase.getLiveSessionStatus(state, realtime);
  }

  /**
   * @param {WorkflowStatusView | null | undefined} statusView
   * @returns {void}
   */
  applyStatusView(statusView) {
    this.trackingUseCase.applyStatusView(statusView);
  }

  /**
   * @param {string} message
   * @returns {void}
   */
  showError(message) {
    this.ui.showError(message);
  }

  /**
   * @returns {void}
   */
  bindPageLifecycle() {
    if (this.lifecycleDisposers.length) return;

    const onVisibilityChange = () => {
      if (document.hidden) {
        this.handlePageHidden();
        return;
      }

      this.handlePageVisible();
    };
    const onPageHide = () => this.handlePageHidden();
    const onPageShow = () => this.handlePageVisible();

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);

    this.lifecycleDisposers.push(
      () => document.removeEventListener('visibilitychange', onVisibilityChange),
      () => window.removeEventListener('pagehide', onPageHide),
      () => window.removeEventListener('pageshow', onPageShow),
    );
  }

  /**
   * @returns {void}
   */
  handlePageHidden() {
    this.rendererLoop.pause();
    this.cameraSessionUseCase.pauseTracking();
    this.realtimeStore.clearTracking();
    this.controller.fadeOut();
  }

  /**
   * @returns {void}
   */
  handlePageVisible() {
    this.rendererLoop.resume();
    this.rendererLoop.requestRender();

    if (!this.appState.get('cameraStarted')) return;

    this.cameraSessionUseCase.resumeTracking().catch((error) => {
      this.showError(`Face Mesh 恢復偵測失敗：${formatUnknownError(error)}`);
    });
  }

  /**
   * @returns {Promise<import('./ArSessionService.js').ArSessionService>}
   */
  async getSessionService() {
    return this.cameraSessionUseCase.getSessionService();
  }

  /**
   * @returns {Promise<import('./ArSessionService.js').ArSessionService | null>}
   */
  preloadSessionService() {
    return this.cameraSessionUseCase.preloadSessionService();
  }

  /**
   * @returns {void}
   */
  scheduleSessionServicePreload() {
    if (this.cancelSessionServicePreload) return;

    this.cancelSessionServicePreload = scheduleIdleWork(() => {
      this.cancelSessionServicePreload = null;
      void this.preloadSessionService();
    });
  }

  /**
   * @returns {AppStateSnapshot}
   */
  getState() {
    return this.appState.getSnapshot();
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
 * @param {() => void} callback
 * @returns {() => void}
 */
function scheduleIdleWork(callback) {
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(callback, { timeout: 2500 });
    return () => window.cancelIdleCallback(handle);
  }

  const handle = globalThis.setTimeout(callback, 0);
  return () => globalThis.clearTimeout(handle);
}
