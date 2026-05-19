// @ts-check

import {
  APP_MODES,
  AR_SESSION_STATES,
  CAMERA_FACING_MODES,
  getCameraLabel,
  getCameraSwitchingLabel,
} from './AppState.js';
import { createIdleTrackerStats } from './RealtimeTrackingStore.js';
import { reduceAppIntent } from './app-reducer';

const TRACKING_FEEDBACK_UPDATE_INTERVAL_MS = 350;

/** @typedef {import('../types/domain').AppStateSnapshot} AppStateSnapshot */
/** @typedef {import('../types/domain').ArSessionStatus} ArSessionStatus */
/** @typedef {import('../types/domain').CameraFacingMode} CameraFacingMode */
/** @typedef {import('../types/domain').FaceMeshResults} FaceMeshResults */
/** @typedef {import('../types/domain').NecklaceDebugData} NecklaceDebugData */
/** @typedef {import('../types/domain').RealtimeTrackingSnapshot} RealtimeTrackingSnapshot */
/** @typedef {import('../types/domain').TrackerStats} TrackerStats */
/** @typedef {import('../types/domain').WearAdjustmentPatch} WearAdjustmentPatch */
/** @typedef {import('../types/domain').WorkflowStatusView} WorkflowStatusView */
/** @typedef {import('../types/app-ports').AppStatePort} AppStatePort */
/** @typedef {import('../types/ui-ports').UiControllerPort} UiControllerPort */
/** @typedef {import('../types/scene-ports').NecklaceSceneModePort} NecklaceSceneModePort */
/** @typedef {import('./ArSessionService.js').ArSessionService} ArSessionService */
/** @typedef {import('./app-intents').AppIntent} AppIntent */
/** @typedef {import('./app-reducer').AppReducerResult} AppReducerResult */
/** @typedef {import('./createAppRuntime.js').AppRuntime} AppRuntime */

/**
 * @typedef {{
 *   appState: AppStatePort,
 *   uiController: UiControllerPort,
 *   runtime: AppRuntime,
 * }} ModeControllerOptions
 */

export class ModeController {
  /**
   * @param {ModeControllerOptions} options
   */
  constructor({ appState, uiController, runtime }) {
    this.appState = appState;
    this.ui = uiController;
    this.realtimeStore = runtime.realtimeStore;
    /** @type {NecklaceSceneModePort} */
    this.scene = /** @type {NecklaceSceneModePort} */ (runtime.scene);
    this.controller = runtime.necklaceController;
    this.debugOverlay = runtime.debugOverlay;
    /** @type {ArSessionService | null} */
    this.sessionService = null;
    /** @type {Promise<ArSessionService> | null} */
    this.sessionServicePromise = null;
    this.modelCatalog = runtime.modelCatalog;
    this.calibrationService = runtime.calibrationService;
    this.shareWorkflow = runtime.shareWorkflow;
    this.rendererLoop = runtime.rendererLoop;
    this.feedbackService = runtime.feedbackService;
    /** @type {number | null} */
    this.trackingFeedbackTimer = null;
    this.lastTrackingFeedbackUpdateAt = 0;
    this.capturePreviewUrl = '';
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
    const state = this.getState();
    const realtime = this.realtimeStore.getSnapshot();
    if (!this.calibrationService.startDrag(event, { ...state, hasFace: realtime.hasFace })) return;

    this.ui.setCalibrationDragging(true);
  }

  /**
   * @param {PointerEvent} event
   * @returns {void}
   */
  handleCalibrationPointerMove(event) {
    const state = this.getState();
    const result = this.calibrationService.updateDrag(event, state.adjustments);
    if (!result) return;

    this.applyTuning(result.adjustments, 'calibration-drag');
    this.ui.syncTuningControlsFromAdjustments(this.appState.get('adjustments'));
    this.applyCalibrationHint(result.hint);
  }

  /**
   * @param {PointerEvent} event
   * @returns {void}
   */
  handleCalibrationPointerUp(event) {
    if (!this.calibrationService.endDrag(event)) return;

    this.ui.setCalibrationDragging(false);
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
    this.controller.fadeOut();
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
    const state = this.getState();
    if (!state.cameraStarted && !state.isSwitchingCamera) return;

    this.ui.clearError();
    this.stopCameraSession();
    this.ui.setStatus('idle', '相機已關閉', '鏡頭已停止，可重新開啟相機');
  }

  /**
   * @returns {Promise<void>}
   */
  async switchCamera() {
    const state = this.getState();
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
    this.controller.reset();
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
   * @returns {Promise<void>}
   */
  async handleCapture() {
    this.ui.clearError();
    const state = this.getState();
    const realtime = this.realtimeStore.getSnapshot();
    const captureState = { ...state, hasFace: realtime.hasFace };
    const blocker = this.shareWorkflow.getCaptureBlocker(captureState, {
      hasCurrentVideoFrame: this.ui.hasCurrentVideoFrame(),
    });

    if (blocker) {
      this.applyStatusView(blocker.view);
      return;
    }

    this.ui.setCaptureDisabled(true);
    this.ui.setCaptureBusy(true);
    this.appState.transitionSession(AR_SESSION_STATES.CAPTURING, {}, 'capture-start');

    try {
      const result = await this.shareWorkflow.capture(captureState);
      this.appState.transitionSession(
        AR_SESSION_STATES.SHARING,
        {
          captureDataUrl: result.capture.url,
          captureBlob: result.capture.blob,
        },
        'capture-create',
      );
      this.rememberCapturePreviewUrl(result.capture.url);
      this.ui.setShareImage(result.capture.url);
      this.ui.openShareSheet();
      this.applyStatusView(result.view);
    } catch (error) {
      this.appState.transitionSession(AR_SESSION_STATES.ERROR, {}, 'capture-error');
      this.showError(`無法產生美圖：${formatUnknownError(error)}`);
    } finally {
      this.ui.setCaptureDisabled(!this.appState.get('cameraStarted'));
      this.ui.setCaptureBusy(false);
    }
  }

  /**
   * @returns {void}
   */
  downloadCapture() {
    const state = this.getState();
    const statusView = this.shareWorkflow.download({
      blob: state.captureBlob,
      dataUrl: state.captureDataUrl,
    });
    if (!statusView) return;

    this.applyStatusView(statusView);
  }

  /**
   * @returns {Promise<void>}
   */
  async shareCapture() {
    const state = this.getState();
    if (!state.captureBlob) return;

    try {
      const statusView = await this.shareWorkflow.share({
        blob: state.captureBlob,
        dataUrl: state.captureDataUrl,
      });
      if (statusView) this.applyStatusView(statusView);
    } catch (error) {
      this.appState.transitionSession(AR_SESSION_STATES.ERROR, {}, 'capture-share-error');
      this.showError(`分享失敗：${formatUnknownError(error)}`);
    }
  }

  /**
   * @returns {void}
   */
  closeShareSheet() {
    this.ui.closeShareSheet();
    const state = this.getState();
    if (state.sessionStatus !== AR_SESSION_STATES.SHARING) return;

    this.appState.transitionSession(this.getLiveSessionStatus(state), {}, 'share-close');
  }

  /**
   * @param {string} url
   * @returns {void}
   */
  rememberCapturePreviewUrl(url) {
    if (this.capturePreviewUrl && this.capturePreviewUrl !== url && this.capturePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.capturePreviewUrl);
    }

    this.capturePreviewUrl = url;
  }

  /**
   * @param {string | null | undefined} necklaceId
   * @returns {void}
   */
  selectNecklace(necklaceId) {
    if (!necklaceId) return;

    const next = this.modelCatalog.getById(necklaceId);
    if (!next) return;

    const state = this.getState();
    if (next.id === state.selectedNecklace.id) {
      this.ui.syncNecklaceSelection(next.id);
      return;
    }

    this.appState.set(this.modelCatalog.createSelectionPatch(next), 'necklace-select');
    this.controller.reset();
    this.applyCalibrationForSelectedNecklace();
    this.loadSelectedNecklace();
  }

  /**
   * @param {string | null | undefined} colorId
   * @param {string | null | undefined} targetId
   * @returns {void}
   */
  selectColor(colorId, targetId) {
    if (!colorId) return;

    const state = this.getState();
    const selection = this.modelCatalog.createColorSelection(state, colorId, targetId);
    if (!selection) return;

    this.appState.set(selection.patch, 'color-select');
    this.modelCatalog.applySelectedColors(this.getState(), selection.targetIds);
    this.rendererLoop.requestRender();
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
    const tuning = this.ui.readTuningControls();
    this.applyTuning(tuning.adjustments, 'calibration-input');
    this.updateCalibrationHint({ dirty: true });
  }

  /**
   * @returns {void}
   */
  saveCalibration() {
    const state = this.getState();
    const result = this.calibrationService.save(state.selectedNecklace.id, state.adjustments);
    this.applyCalibrationHint(result.hint);
  }

  /**
   * @returns {void}
   */
  resetCalibration() {
    const state = this.getState();
    const result = this.calibrationService.reset(state.selectedNecklace.id);
    this.ui.syncTuningControlsFromAdjustments(result.adjustments);
    this.applyTuning(result.adjustments, 'calibration-reset');
    this.applyCalibrationHint(result.hint);
  }

  /**
   * @returns {void}
   */
  applyCalibrationForSelectedNecklace() {
    const state = this.getState();
    const result = this.calibrationService.load(state.selectedNecklace.id);
    this.ui.syncTuningControlsFromAdjustments(result.adjustments);
    this.applyTuning(result.adjustments, 'calibration-load');
    this.applyCalibrationHint(result.hint);
  }

  /**
   * @param {{ dirty?: boolean }} [options]
   * @returns {void}
   */
  updateCalibrationHint({ dirty = false } = {}) {
    const state = this.getState();
    this.applyCalibrationHint(
      this.calibrationService.getHint({
        necklaceId: state.selectedNecklace.id,
        dirty,
      }),
    );
  }

  /**
   * @param {WearAdjustmentPatch} adjustments
   * @param {string} [eventName]
   * @returns {void}
   */
  applyTuning(adjustments, eventName = 'tuning-change') {
    const currentAdjustments = this.appState.get('adjustments') ?? {};
    const normalizedAdjustments = this.calibrationService.mergeAdjustments(currentAdjustments, adjustments);

    this.appState.set({ adjustments: normalizedAdjustments }, eventName);
    this.controller.setAdjustments(normalizedAdjustments);
    this.rendererLoop.requestRender();
  }

  /**
   * @param {{ message: string, options?: { isDirty?: boolean, isSaved?: boolean }} | null} hint
   * @returns {void}
   */
  applyCalibrationHint(hint) {
    if (!hint) return;

    this.ui.setCalibrationHint(hint.message, hint.options ?? {});
  }

  /**
   * @returns {Promise<void>}
   */
  async loadSelectedNecklace() {
    const selectedNecklace = this.appState.get('selectedNecklace');
    this.appState.set({ modelLoaded: false }, 'model-load-start');
    this.ui.clearError();
    this.syncColorAvailability();
    this.ui.setStatus('loading', '款式載入中', selectedNecklace.label);

    try {
      const result = await this.modelCatalog.load(selectedNecklace);
      if (result.status === 'stale') return;

      this.appState.set({ modelLoaded: true }, 'model-load-success');
      const colorDefaultsPatch = this.modelCatalog.ensureColorSelectionForMatchedTargets(this.getState());
      if (colorDefaultsPatch) {
        this.appState.set(colorDefaultsPatch, 'color-target-defaults');
      }
      this.modelCatalog.applySelectedColors(this.getState());
      this.syncColorAvailability();
      this.syncModeEffects();
      this.rendererLoop.requestRender();
    } catch (error) {
      if (isAbortError(error)) return;

      const message =
        `無法載入 ${selectedNecklace.url}。請確認 .glb 已放在 public/models/necklace.glb。` +
        ` 原始錯誤：${formatUnknownError(error)}`;
      this.showError(message);
      this.ui.setStatus('error', '模型載入失敗', '請先放置 necklace.glb');
      this.syncColorAvailability();
    }
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
    const state = this.getState();
    if (state.mode !== APP_MODES.AR || !state.cameraStarted) return;

    const landmarks = results.multiFaceLandmarks?.[0] ?? null;
    const hasFace = Boolean(landmarks);
    /** @type {NecklaceDebugData | null} */
    let debugData = null;

    if (!state.modelLoaded || !landmarks) {
      this.controller.fadeOut();
    } else {
      debugData = this.controller.updateFromLandmarks(landmarks, state.necklaceVisible);
      this.markCalibrationReady();
    }

    this.realtimeStore.updateFrame({
      landmarks,
      hasFace,
      debugData,
    });
    this.rendererLoop.requestRender();

    const didTransition = this.transitionLiveFaceStatus(
      hasFace ? AR_SESSION_STATES.TRACKING : AR_SESSION_STATES.NO_FACE,
    );
    this.scheduleTrackingFeedbackUpdate({ force: didTransition });
  }

  /**
   * @param {ArSessionStatus} nextStatus
   * @returns {boolean}
   */
  transitionLiveFaceStatus(nextStatus) {
    const state = this.getState();
    if (this.shouldPreserveWorkflowStatus(state)) return false;
    if (state.sessionStatus === nextStatus) return false;

    this.appState.transitionSession(nextStatus, {}, 'face-results');
    return true;
  }

  /**
   * @param {AppStateSnapshot} state
   * @returns {boolean}
   */
  shouldPreserveWorkflowStatus(state) {
    return state.sessionStatus === AR_SESSION_STATES.CAPTURING || state.sessionStatus === AR_SESSION_STATES.SHARING;
  }

  /**
   * @returns {void}
   */
  markCalibrationReady() {
    const necklaceId = this.appState.get('selectedNecklace').id;
    const hint = this.calibrationService.markFaceReady(necklaceId);
    this.applyCalibrationHint(hint);
  }

  /**
   * @param {TrackerStats} stats
   * @returns {void}
   */
  handleFaceTrackerStats(stats) {
    this.realtimeStore.setTrackerStats(stats);
    const state = this.getState();
    if (!state.cameraStarted || !state.debugEnabled) return;

    this.scheduleTrackingFeedbackUpdate();
  }

  /**
   * @param {{ force?: boolean }} [options]
   * @returns {void}
   */
  scheduleTrackingFeedbackUpdate({ force = false } = {}) {
    const state = this.getState();
    if (!state.cameraStarted) return;

    const now = performance.now();
    const elapsed = now - this.lastTrackingFeedbackUpdateAt;

    if (force || elapsed >= TRACKING_FEEDBACK_UPDATE_INTERVAL_MS) {
      if (this.trackingFeedbackTimer !== null) {
        window.clearTimeout(this.trackingFeedbackTimer);
        this.trackingFeedbackTimer = null;
      }
      this.flushTrackingFeedback(now);
      return;
    }

    if (this.trackingFeedbackTimer !== null) return;

    this.trackingFeedbackTimer = window.setTimeout(() => {
      this.trackingFeedbackTimer = null;
      this.flushTrackingFeedback(performance.now());
    }, TRACKING_FEEDBACK_UPDATE_INTERVAL_MS - elapsed);
  }

  /**
   * @param {number} [now]
   * @returns {void}
   */
  flushTrackingFeedback(now = performance.now()) {
    const state = this.getState();
    if (state.mode !== APP_MODES.AR || !state.cameraStarted) {
      this.lastTrackingFeedbackUpdateAt = now;
      return;
    }

    this.lastTrackingFeedbackUpdateAt = now;
    this.updateTrackingStatus();
    this.updateDeveloperPanel();
  }

  /**
   * @returns {void}
   */
  updateDeveloperPanel() {
    const state = this.getState();
    if (!state.debugEnabled) return;
    this.ui.updateDeveloperPanel(
      this.feedbackService.createDeveloperPanelModel(state, this.realtimeStore.getSnapshot()),
    );
  }

  /**
   * @returns {void}
   */
  updateTrackingStatus() {
    const state = this.getState();
    const statusView = this.feedbackService.createTrackingStatus(state, this.realtimeStore.getSnapshot());
    this.applyStatusView(statusView);
  }

  /**
   * @returns {void}
   */
  syncColorAvailability() {
    const state = this.getState();
    const colorUiModel = this.modelCatalog.buildColorUiModel(state);

    this.ui.populateColorSwatches(colorUiModel.swatches);
    this.ui.updateColorUiAvailability(colorUiModel.availability);
  }

  /**
   * @returns {string}
   */
  getActiveCameraLabel() {
    return `目前使用${getCameraLabel(this.appState.get('cameraFacingMode'))}`;
  }

  /**
   * @param {AppStateSnapshot} state
   * @param {RealtimeTrackingSnapshot} [realtime]
   * @returns {ArSessionStatus}
   */
  getLiveSessionStatus(state, realtime = this.realtimeStore.getSnapshot()) {
    if (!state.cameraStarted) return AR_SESSION_STATES.AR_IDLE;
    return realtime.hasFace ? AR_SESSION_STATES.TRACKING : AR_SESSION_STATES.NO_FACE;
  }

  /**
   * @param {WorkflowStatusView | null | undefined} statusView
   * @returns {void}
   */
  applyStatusView(statusView) {
    if (!statusView) return;

    this.ui.setStatus(statusView.kind, statusView.label, statusView.metrics);
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
    this.sessionService?.pauseTracking();
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

    this.sessionService?.resumeTracking().catch((error) => {
      this.showError(`Face Mesh 恢復偵測失敗：${formatUnknownError(error)}`);
    });
  }

  /**
   * @returns {Promise<ArSessionService>}
   */
  async getSessionService() {
    if (this.sessionService) return this.sessionService;

    if (!this.sessionServicePromise) {
      this.sessionServicePromise = import('./ArSessionService.js')
        .then(({ ArSessionService }) => {
          const service = new ArSessionService({
            videoElement: this.ui.elements.video,
            onResults: (results) => this.handleFaceResults(results),
            onError: (error) => this.showError(`Face Mesh 偵測發生錯誤：${formatUnknownError(error)}`),
            onStatsUpdate: (stats) => this.handleFaceTrackerStats(stats),
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
 * @param {unknown} error
 * @returns {boolean}
 */
function isAbortError(error) {
  return Boolean(error && typeof error === 'object' && 'name' in error && error.name === 'AbortError');
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
