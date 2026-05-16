// @ts-check

import {
  APP_MODES,
  AR_SESSION_STATES,
  CAMERA_FACING_MODES,
  getCameraLabel,
  getCameraSwitchingLabel,
} from './AppState.js';
import { CalibrationService } from './CalibrationService.js';
import { ModelCatalogService } from './ModelCatalogService.js';
import { RendererLoop } from './RendererLoop.js';
import { ShareWorkflow } from './ShareWorkflow.js';
import { TrackingFeedbackService } from './TrackingFeedbackService.js';
import { DebugOverlay } from '../core/DebugOverlay.js';
import { FaceQualityAdvisor } from '../core/FaceQualityAdvisor.js';
import { NecklaceController } from '../core/NecklaceController.js';
import { NecklaceScene } from '../core/NecklaceScene.js';

/** @typedef {import('../types/domain').AppMode} AppMode */
/** @typedef {import('../types/domain').AppStateMeta} AppStateMeta */
/** @typedef {import('../types/domain').AppStatePatch} AppStatePatch */
/** @typedef {import('../types/domain').AppStateSnapshot} AppStateSnapshot */
/** @typedef {import('../types/domain').ArSessionStatus} ArSessionStatus */
/** @typedef {import('../types/domain').CameraFacingMode} CameraFacingMode */
/** @typedef {import('../types/domain').ColorSelectionByTarget} ColorSelectionByTarget */
/** @typedef {import('../types/domain').FaceLandmarkList} FaceLandmarkList */
/** @typedef {import('../types/domain').FaceMeshResults} FaceMeshResults */
/** @typedef {import('../types/domain').NecklaceConfig} NecklaceConfig */
/** @typedef {import('../types/domain').NecklaceDebugData} NecklaceDebugData */
/** @typedef {import('../types/domain').RenderStats} RenderStats */
/** @typedef {import('../types/domain').TrackerStats} TrackerStats */
/** @typedef {import('../types/domain').WearAdjustmentPatch} WearAdjustmentPatch */
/** @typedef {import('../types/domain').WearAdjustments} WearAdjustments */
/** @typedef {import('../types/domain').WorkflowStatusView} WorkflowStatusView */
/** @typedef {import('./ArSessionService.js').ArSessionService} ArSessionService */

/**
 * @typedef {{
 *   get: <K extends keyof AppStateSnapshot>(key: K) => AppStateSnapshot[K],
 *   getSnapshot: () => AppStateSnapshot,
 *   set: (patch: AppStatePatch | null | undefined, eventName?: string) => AppStateSnapshot,
 *   update: (
 *     updater: (snapshot: AppStateSnapshot) => AppStatePatch | null | undefined,
 *     eventName?: string,
 *   ) => AppStateSnapshot,
 *   transitionSession: (
 *     nextStatus: ArSessionStatus,
 *     patch?: AppStatePatch,
 *     eventName?: string,
 *   ) => AppStateSnapshot,
 * }} AppStatePort
 */

/**
 * @typedef {{
 *   stage: HTMLElement,
 *   video: HTMLVideoElement,
 *   threeCanvas: HTMLCanvasElement,
 *   debugCanvas: HTMLCanvasElement,
 *   startButton: HTMLButtonElement,
 *   switchCameraButton: HTMLButtonElement,
 *   stopCameraButton: HTMLButtonElement,
 * }} UiElementsPort
 */

/**
 * @typedef {{
 *   swatches: {
 *     necklace: NecklaceConfig,
 *     selectedColorIdsByTarget: ColorSelectionByTarget,
 *     fallbackColorId: string,
 *     targetIds: string[],
 *   },
 *   availability: {
 *     necklace: NecklaceConfig,
 *     modelLoaded: boolean,
 *     hasColorableMaterials: boolean,
 *     targetLabels: string[],
 *   },
 * }} ColorUiModel
 */

/**
 * @typedef {{
 *   debugData: NecklaceDebugData | null,
 *   stats: TrackerStats & { renderFps?: number },
 *   modelUrl?: string,
 *   materialHitCount?: number,
 * }} DeveloperPanelModel
 */

/**
 * @typedef {{
 *   elements: UiElementsPort,
 *   populateNecklaceSelect: (selectedNecklaceId: string) => void,
 *   populateColorSwatches: (model: ColorUiModel['swatches']) => void,
 *   syncFromState: (state: AppStateSnapshot, meta?: Partial<AppStateMeta>) => void,
 *   canSelectControlPanel: (panelName: string) => boolean,
 *   setShowcaseDragging: (isDragging: boolean) => void,
 *   setCalibrationDragging: (isDragging: boolean) => void,
 *   syncTuningControlsFromAdjustments: (adjustments: WearAdjustmentPatch) => unknown,
 *   setCalibrationHint: (message: string, options?: { isDirty?: boolean, isSaved?: boolean }) => void,
 *   readTuningControls: () => {
 *     raw: { verticalOffset: number, scale: number, rotation: number },
 *     adjustments: WearAdjustmentPatch,
 *   },
 *   clearError: () => void,
 *   showError: (message: string) => void,
 *   setStartButtonLabel: (label: string) => void,
 *   setCameraOn: (isCameraOn: boolean) => void,
 *   setCaptureDisabled: (isDisabled: boolean) => void,
 *   setCaptureBusy: (isBusy: boolean) => void,
 *   setStatus: (kind: WorkflowStatusView['kind'], label: string, metrics: string) => void,
 *   setShareImage: (dataUrl: string) => void,
 *   openShareSheet: () => void,
 *   closeShareSheet: () => void,
 *   updateDeveloperPanel: (model: DeveloperPanelModel) => void,
 *   updateColorUiAvailability: (availability: ColorUiModel['availability']) => void,
 *   syncNecklaceSelection: (necklaceId: string) => void,
 *   hasCurrentVideoFrame: () => boolean,
 * }} UiControllerPort
 */

/**
 * @typedef {{
 *   createCapture: (options: { mirrored: boolean }) => Promise<{ dataUrl: string, blob: Blob }>,
 *   download: (dataUrl: string) => void,
 *   share: (blob: Blob) => Promise<{ status: 'shared' | 'unsupported' | 'aborted' | 'empty' }>,
 * }} CaptureServicePort
 */

/**
 * @typedef {{
 *   loadNecklace: (necklace: NecklaceConfig) => Promise<unknown>,
 *   getColorableTargets: () => string[],
 *   hasColorableMaterials: () => boolean,
 *   getColorableMaterialCount: () => number,
 *   applyColor: (targetId: string, color: string) => boolean,
 *   renderForCapture: () => void,
 *   resize: () => void,
 *   setShowcaseMode: (isShowcase: boolean) => void,
 *   beginShowcaseDrag: (clientX: number) => void,
 *   dragShowcase: (clientX: number) => void,
 *   endShowcaseDrag: () => void,
 *   screenToWorld: (point: import('../types/domain').LandmarkPoint) =>
 *     Required<Pick<import('../types/domain').LandmarkPoint, 'x' | 'y' | 'z'>>,
 *   normalizedSegmentToWorldLength: (
 *     start: import('../types/domain').LandmarkPoint,
 *     end: import('../types/domain').LandmarkPoint,
 *   ) => number,
 *   updateTransform: (transform: {
 *     position: Required<Pick<import('../types/domain').LandmarkPoint, 'x' | 'y' | 'z'>>,
 *     scale: number,
 *     rotationY: number,
 *     rotationZ: number,
 *   }) => void,
 *   setOpacity: (opacity: number) => void,
 * }} NecklaceSceneModePort
 */

/**
 * @typedef {{
 *   appState: AppStatePort,
 *   uiController: UiControllerPort,
 *   captureService: CaptureServicePort,
 *   necklaces: readonly NecklaceConfig[],
 * }} ModeControllerOptions
 */

export class ModeController {
  /**
   * @param {ModeControllerOptions} options
   */
  constructor({ appState, uiController, captureService, necklaces }) {
    this.appState = appState;
    this.ui = uiController;
    this.necklaces = necklaces;

    /** @type {NecklaceSceneModePort} */
    this.scene = /** @type {NecklaceSceneModePort} */ (new NecklaceScene({
      canvas: this.ui.elements.threeCanvas,
      stageElement: this.ui.elements.stage,
      onError: /** @param {string} message */ (message) => this.showError(message),
    }));
    this.controller = new NecklaceController(this.scene);
    this.faceQualityAdvisor = new FaceQualityAdvisor({
      video: this.ui.elements.video,
    });
    this.debugOverlay = new DebugOverlay({
      canvas: this.ui.elements.debugCanvas,
      stageElement: this.ui.elements.stage,
    });
    /** @type {ArSessionService | null} */
    this.sessionService = null;
    /** @type {Promise<ArSessionService> | null} */
    this.sessionServicePromise = null;
    this.modelCatalog = new ModelCatalogService({
      scene: this.scene,
      necklaces: this.necklaces,
    });
    this.calibrationService = new CalibrationService({
      stageElement: this.ui.elements.stage,
      pointerElement: this.ui.elements.threeCanvas,
    });
    this.shareWorkflow = new ShareWorkflow({
      captureService,
      scene: this.scene,
    });
    this.rendererLoop = new RendererLoop({
      scene: this.scene,
      debugOverlay: this.debugOverlay,
      getState: () => this.getState(),
      onDebugFrame: () => this.updateDeveloperPanel(),
    });
    this.feedbackService = new TrackingFeedbackService({
      faceQualityAdvisor: this.faceQualityAdvisor,
      getTrackerStats: () => this.sessionService?.getStats() ?? createIdleTrackerStats(),
      getRenderStats: () => this.rendererLoop.getStats(),
      modelCatalog: this.modelCatalog,
      calibrationService: this.calibrationService,
    });
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
    this.rendererLoop.start();
  }

  /**
   * @param {string | null | undefined} mode
   * @returns {void}
   */
  selectMode(mode) {
    const state = this.getState();
    if (!isAppMode(mode) || state.mode === mode) return;

    if (mode === APP_MODES.SHOWCASE && state.cameraStarted) {
      this.stopCameraSession({
        nextStatus: AR_SESSION_STATES.SHOWCASE,
        eventName: 'mode-camera-stop',
      });
    }

    /** @type {AppStatePatch} */
    const patch = {
      mode,
    };

    if (mode !== APP_MODES.AR && state.activePanel === 'fit') {
      patch.activePanel = 'styles';
    }

    this.appState.transitionSession(
      mode === APP_MODES.SHOWCASE ? AR_SESSION_STATES.SHOWCASE : AR_SESSION_STATES.AR_IDLE,
      patch,
      'mode-select',
    );

    if (mode === APP_MODES.AR) {
      this.scene.setShowcaseMode(false);
      this.controller.reset();
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
    this.appState.set({ activePanel: panelName }, 'panel-select');
  }

  /**
   * @returns {void}
   */
  toggleBottomSheet() {
    this.appState.update((state) => ({ controlsCollapsed: !state.controlsCollapsed }), 'bottom-sheet-toggle');
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
    if (!this.calibrationService.startDrag(event, state)) return;

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
    this.controller.fadeOut();
    this.appState.transitionSession(AR_SESSION_STATES.CAMERA_STARTING, {}, 'camera-start-request');

    try {
      const sessionService = await this.getSessionService();
      const session = await sessionService.start(this.appState.get('cameraFacingMode'));
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
  }

  /**
   * @returns {Promise<void>}
   */
  async handleCapture() {
    this.ui.clearError();
    const state = this.getState();
    const blocker = this.shareWorkflow.getCaptureBlocker(state, {
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
      const result = await this.shareWorkflow.capture(state);
      this.appState.transitionSession(
        AR_SESSION_STATES.SHARING,
        {
          captureDataUrl: result.capture.dataUrl,
          captureBlob: result.capture.blob,
        },
        'capture-create',
      );
      this.ui.setShareImage(result.capture.dataUrl);
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
    const dataUrl = this.appState.get('captureDataUrl');
    const statusView = this.shareWorkflow.download(dataUrl);
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
  }

  /**
   * @param {boolean} isEnabled
   * @returns {void}
   */
  handleDebugToggle(isEnabled) {
    this.appState.set({ debugEnabled: isEnabled }, 'debug-toggle');
    this.debugOverlay.setEnabled(this.appState.get('mode') === APP_MODES.AR && isEnabled);
    this.updateDeveloperPanel();
    this.updateTrackingStatus();
  }

  /**
   * @param {boolean} isVisible
   * @returns {void}
   */
  handleNecklaceToggle(isVisible) {
    this.appState.set({ necklaceVisible: isVisible }, 'necklace-toggle');

    if (!isVisible) {
      this.controller.fadeOut();
    }
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
      this.ui.setStatus(
        state.modelLoaded ? 'tracking' : 'loading',
        state.modelLoaded ? '模型展示' : '模型載入中',
        state.modelLoaded ? '拖曳旋轉模型，選擇喜歡的色彩' : state.selectedNecklace.label,
      );
      return;
    }

    this.scene.setShowcaseMode(false);

    if (!state.cameraStarted && state.modelLoaded) {
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

    if (!state.modelLoaded || !landmarks) {
      this.controller.fadeOut();
      this.commitFaceResult(hasFace ? AR_SESSION_STATES.TRACKING : AR_SESSION_STATES.NO_FACE, {
        lastLandmarks: landmarks,
        hasFace,
        lastDebugData: null,
      });
      this.updateTrackingStatus();
      this.updateDeveloperPanel();
      return;
    }

    const lastDebugData = this.controller.updateFromLandmarks(landmarks, state.necklaceVisible);
    this.markCalibrationReady();
    this.commitFaceResult(AR_SESSION_STATES.TRACKING, {
      lastLandmarks: landmarks,
      hasFace,
      lastDebugData,
    });
    this.updateTrackingStatus();
    this.updateDeveloperPanel();
  }

  /**
   * @param {ArSessionStatus} nextStatus
   * @param {AppStatePatch} patch
   * @returns {void}
   */
  commitFaceResult(nextStatus, patch) {
    const state = this.getState();
    const shouldPreserveWorkflowStatus =
      state.sessionStatus === AR_SESSION_STATES.CAPTURING ||
      state.sessionStatus === AR_SESSION_STATES.SHARING;

    if (shouldPreserveWorkflowStatus) {
      this.appState.set(patch, 'face-results');
      return;
    }

    this.appState.transitionSession(nextStatus, patch, 'face-results');
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
   * @returns {void}
   */
  handleFaceTrackerStats() {
    const state = this.getState();
    if (!state.cameraStarted || !state.debugEnabled) return;

    this.updateTrackingStatus();
    this.updateDeveloperPanel();
  }

  /**
   * @returns {void}
   */
  updateDeveloperPanel() {
    const state = this.getState();
    this.ui.updateDeveloperPanel(this.feedbackService.createDeveloperPanelModel(state));
  }

  /**
   * @returns {void}
   */
  updateTrackingStatus() {
    const state = this.getState();
    const statusView = this.feedbackService.createTrackingStatus(state);
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
   * @returns {ArSessionStatus}
   */
  getLiveSessionStatus(state) {
    if (!state.cameraStarted) return AR_SESSION_STATES.AR_IDLE;
    return state.hasFace ? AR_SESSION_STATES.TRACKING : AR_SESSION_STATES.NO_FACE;
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
            onStatsUpdate: () => this.handleFaceTrackerStats(),
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
 * @param {string | null | undefined} mode
 * @returns {mode is AppMode}
 */
function isAppMode(mode) {
  return mode === APP_MODES.SHOWCASE || mode === APP_MODES.AR;
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

/**
 * @returns {TrackerStats}
 */
function createIdleTrackerStats() {
  return {
    currentFps: 0,
    targetFps: 0,
    averageInferenceMs: 0,
    lastInferenceMs: 0,
    skippedFrameCount: 0,
    inferenceCount: 0,
    schedulerType: 'raf',
  };
}
