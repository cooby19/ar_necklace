// @ts-check

import { CalibrationUseCase } from './use-cases/CalibrationUseCase.js';
import { CameraSessionUseCase } from './use-cases/CameraSessionUseCase.js';
import { ModeUseCase } from './use-cases/ModeUseCase.js';
import { ModelUseCase } from './use-cases/ModelUseCase.js';
import { RouteUseCase } from './use-cases/RouteUseCase.js';
import { RuntimeLifecycleUseCase } from './use-cases/RuntimeLifecycleUseCase.js';
import { ShareUseCase } from './use-cases/ShareUseCase.js';
import { StageInteractionUseCase } from './use-cases/StageInteractionUseCase.js';
import { TrackingUseCase } from './use-cases/TrackingUseCase.js';
import { APP_ROUTES } from './AppState.js';
import { installRouter, parseUrlState } from './router.js';

/** @typedef {import('../types/domain').AppMode} AppMode */
/** @typedef {import('../types/domain').AppStateMeta} AppStateMeta */
/** @typedef {import('../types/domain').AppStatePatch} AppStatePatch */
/** @typedef {import('../types/domain').AppStateSnapshot} AppStateSnapshot */
/** @typedef {import('../types/domain').ArSessionStatus} ArSessionStatus */
/** @typedef {import('../types/domain').DeveloperPanelModel} DeveloperPanelModel */
/** @typedef {import('../types/domain').FaceMeshResults} FaceMeshResults */
/** @typedef {import('../types/domain').NecklaceConfig} NecklaceConfig */
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
/** @typedef {import('./createAppRuntime.js').AppRuntime} AppRuntime */
/** @typedef {import('./router.js').UrlState} UrlState */

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
 *   populateGallery: () => void,
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
 *   uiRoot: AppRuntimeUiPort,
 *   runtime: AppRuntime,
 * }} AppRuntimeControllerOptions
 */

export class AppRuntimeController {
  /**
   * @param {AppRuntimeControllerOptions} options
   */
  constructor({ appState, uiRoot, runtime }) {
    if (!uiRoot) {
      throw new Error('AppRuntimeController requires a uiRoot');
    }

    this.runtime = runtime;
    this.appState = appState;
    this.ui = uiRoot;
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
    /** @type {UrlState | null} */
    this._pendingUrlState = null;
    this._suppressUrlSync = false;

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
    this.modeUseCase = new ModeUseCase({
      appState: this.appState,
      ui: this.ui,
      scene: this.scene,
      debugOverlay: this.debugOverlay,
      necklaceController: this.controller,
      rendererLoop: this.rendererLoop,
      cameraSessionUseCase: this.cameraSessionUseCase,
      trackingUseCase: this.trackingUseCase,
      preloadSessionService: () => this.preloadSessionService(),
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
    this.routeUseCase = new RouteUseCase({
      appState: this.appState,
      modelCatalog: this.modelCatalog,
      modelUseCase: this.modelUseCase,
      modeUseCase: this.modeUseCase,
      cameraSessionUseCase: this.cameraSessionUseCase,
    });
    this.stageInteractionUseCase = new StageInteractionUseCase({
      appState: this.appState,
      ui: this.ui,
      scene: this.scene,
      calibrationUseCase: this.calibrationUseCase,
    });
    this.lifecycleUseCase = new RuntimeLifecycleUseCase({
      appState: this.appState,
      ui: this.ui,
      realtimeStore: this.realtimeStore,
      rendererLoop: this.rendererLoop,
      necklaceController: this.controller,
      calibrationUseCase: this.calibrationUseCase,
      cameraSessionUseCase: this.cameraSessionUseCase,
      modelUseCase: this.modelUseCase,
      modeUseCase: this.modeUseCase,
      trackingUseCase: this.trackingUseCase,
    });
    this.lifecycleDisposers = this.lifecycleUseCase.lifecycleDisposers;

    runtime.setRenderStatsUpdateHandler(() => this.scheduleTrackingFeedbackUpdate());
  }

  /** @returns {void} */
  init() {
    const urlState = parseUrlState();
    this.applyInitialUrlState(urlState);

    const state = this.getState();
    this.ui.populateNecklaceSelect(state.selectedNecklace.id);
    this.ui.populateGallery();
    this.ui.populateColorSwatches({
      necklace: state.selectedNecklace,
      selectedColorIdsByTarget: state.selectedColorIdsByTarget,
      fallbackColorId: state.selectedColorId,
      targetIds: [],
    });
    this.ui.syncFromState(state);
    this.calibrationUseCase.applyCalibrationForSelectedNecklace();
    this.modelUseCase.syncColorAvailability();
    this.modeUseCase.syncModeEffects();
    void this.loadSelectedNecklace().then(() => this.applyPendingUrlColors());
    this.bindPageLifecycle();
    this.rendererLoop.start();
    this.scheduleSessionServicePreload();
    this.lifecycleDisposers.push(
      installRouter({
        onHashChange: (nextUrlState) => {
          void this.applyUrlState(nextUrlState);
        },
      }),
    );
  }

  /** @returns {void} */
  destroy() {
    this.lifecycleUseCase.destroy();
    this.runtime.setRenderStatsUpdateHandler(null);
  }

  /** @returns {boolean} */
  isApplyingUrlState() {
    return this._suppressUrlSync;
  }

  /**
   * @param {UrlState} urlState
   * @returns {Promise<void>}
   */
  async applyUrlState(urlState) {
    const necklace = urlState.necklaceId ? this.modelCatalog.getById(urlState.necklaceId) : null;

    if (!necklace) {
      // Empty or unknown hash returns to the gallery (e.g. browser Back from a deep link).
      if (this.appState.get('route') !== APP_ROUTES.GALLERY) {
        this.appState.set({ route: APP_ROUTES.GALLERY }, 'route-gallery');
      }
      return;
    }

    const previousSuppression = this._suppressUrlSync;
    this._suppressUrlSync = true;

    try {
      this._pendingUrlState = urlState;
      const currentNecklace = this.appState.get('selectedNecklace');

      if (currentNecklace.id !== necklace.id) {
        this.appState.set(createUrlHydrationPatch(this.modelCatalog, necklace, urlState), 'url-hydrate');
        this.controller.reset();
        this.applyCalibrationForSelectedNecklace();
        await this.loadSelectedNecklace();
      }

      // Set the route independently of the necklace check so a deep link to the
      // already-selected style (e.g. the default) still leaves the gallery.
      if (this.appState.get('route') !== APP_ROUTES.EXPERIENCE) {
        this.appState.set({ route: APP_ROUTES.EXPERIENCE }, 'route-experience');
      }

      this.applyPendingUrlColors();
    } finally {
      this._suppressUrlSync = previousSuppression;
    }
  }

  /** @returns {void} */
  applyPendingUrlColors() {
    if (!this._pendingUrlState) return;

    const targetIds = this.modelCatalog.getColorableTargets();
    if (!targetIds.length && !this.appState.get('modelLoaded')) return;

    const urlState = this._pendingUrlState;
    const necklace = this.appState.get('selectedNecklace');
    const previousSuppression = this._suppressUrlSync;
    this._suppressUrlSync = true;

    try {
      targetIds.forEach((targetId) => {
        const targetColorId = urlState.colorByTarget[targetId];
        if (isPaletteColor(necklace, targetColorId)) {
          this.selectColor(targetColorId, targetId);
          return;
        }

        const fallbackColorId = urlState.colorFallback;
        if (fallbackColorId && isPaletteColor(necklace, fallbackColorId)) {
          this.selectColor(fallbackColorId, targetId);
        }
      });
    } finally {
      this._pendingUrlState = null;
      this._suppressUrlSync = previousSuppression;
    }
  }

  /**
   * @param {UrlState} urlState
   * @returns {void}
   */
  applyInitialUrlState(urlState) {
    if (!urlState.necklaceId) return;

    const necklace = this.modelCatalog.getById(urlState.necklaceId);
    if (!necklace) return;

    const previousSuppression = this._suppressUrlSync;
    this._suppressUrlSync = true;

    try {
      this.appState.set(
        { ...createUrlHydrationPatch(this.modelCatalog, necklace, urlState), route: APP_ROUTES.EXPERIENCE },
        'url-hydrate',
      );
      this._pendingUrlState = urlState;
    } finally {
      this._suppressUrlSync = previousSuppression;
    }
  }

  /**
   * @param {AppMode | string | null | undefined} mode
   * @returns {void}
   */
  selectMode(mode) {
    this.modeUseCase.selectMode(mode);
  }

  /**
   * @param {string | null | undefined} necklaceId
   * @returns {void}
   */
  enterExperience(necklaceId) {
    this.routeUseCase.enterExperience(necklaceId);
  }

  /** @returns {void} */
  showGallery() {
    this.routeUseCase.showGallery();
  }

  /**
   * @param {string | null | undefined} panelName
   * @returns {void}
   */
  selectControlPanel(panelName) {
    this.modeUseCase.selectControlPanel(panelName);
  }

  /** @returns {void} */
  toggleBottomSheet() {
    this.modeUseCase.toggleBottomSheet();
  }

  /**
   * @param {PointerEvent} event
   * @returns {void}
   */
  handleShowcasePointerDown(event) {
    this.stageInteractionUseCase.handlePointerDown(event);
  }

  /**
   * @param {PointerEvent} event
   * @returns {void}
   */
  handleShowcasePointerMove(event) {
    this.stageInteractionUseCase.handlePointerMove(event);
  }

  /**
   * @param {PointerEvent} event
   * @returns {void}
   */
  handleShowcasePointerUp(event) {
    this.stageInteractionUseCase.handlePointerUp(event);
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

  /** @returns {Promise<void>} */
  async startExperience() {
    return this.cameraSessionUseCase.startExperience();
  }

  /** @returns {void} */
  stopExperience() {
    this.cameraSessionUseCase.stopExperience();
  }

  /** @returns {Promise<void>} */
  async switchCamera() {
    return this.cameraSessionUseCase.switchCamera();
  }

  /**
   * @param {{ nextStatus?: ArSessionStatus, eventName?: string }} [options]
   * @returns {void}
   */
  stopCameraSession(options) {
    this.cameraSessionUseCase.stopCameraSession(options);
  }

  /** @returns {Promise<void>} */
  async handleCapture() {
    return this.shareUseCase.handleCapture();
  }

  /** @returns {void} */
  downloadCapture() {
    this.shareUseCase.downloadCapture();
  }

  /** @returns {Promise<void>} */
  async shareCapture() {
    return this.shareUseCase.shareCapture();
  }

  /** @returns {void} */
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
    this.modeUseCase.handleDebugToggle(isEnabled);
  }

  /**
   * @param {boolean} isVisible
   * @returns {void}
   */
  handleNecklaceToggle(isVisible) {
    this.modeUseCase.handleNecklaceToggle(isVisible);
  }

  /** @returns {void} */
  updateTuningFromControls() {
    this.calibrationUseCase.updateTuningFromControls();
  }

  /** @returns {void} */
  saveCalibration() {
    this.calibrationUseCase.saveCalibration();
  }

  /** @returns {void} */
  resetCalibration() {
    this.calibrationUseCase.resetCalibration();
  }

  /** @returns {void} */
  applyCalibrationForSelectedNecklace() {
    this.calibrationUseCase.applyCalibrationForSelectedNecklace();
  }

  /**
   * @param {{ dirty?: boolean }} [options]
   * @returns {void}
   */
  updateCalibrationHint(options) {
    this.calibrationUseCase.updateHint(options);
  }

  /**
   * @param {WearAdjustmentPatch} adjustments
   * @param {string} [eventName]
   * @returns {void}
   */
  applyTuning(adjustments, eventName) {
    this.calibrationUseCase.applyTuning(adjustments, eventName);
  }

  /**
   * @param {{ message: string, options?: { isDirty?: boolean, isSaved?: boolean }} | null} hint
   * @returns {void}
   */
  applyCalibrationHint(hint) {
    this.calibrationUseCase.applyHint(hint);
  }

  /** @returns {Promise<void>} */
  async loadSelectedNecklace() {
    return this.modelUseCase.loadSelectedNecklace();
  }

  /** @returns {void} */
  syncModeEffects() {
    this.modeUseCase.syncModeEffects();
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

  /** @returns {void} */
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
  scheduleTrackingFeedbackUpdate(options) {
    this.trackingUseCase.scheduleFeedbackUpdate(options);
  }

  /**
   * @param {number} [now]
   * @returns {void}
   */
  flushTrackingFeedback(now) {
    this.trackingUseCase.flushFeedback(now);
  }

  /** @returns {void} */
  updateDeveloperPanel() {
    this.trackingUseCase.updateDeveloperPanel();
  }

  /** @returns {void} */
  updateTrackingStatus() {
    this.trackingUseCase.updateTrackingStatus();
  }

  /** @returns {void} */
  syncColorAvailability() {
    this.modelUseCase.syncColorAvailability();
  }

  /** @returns {string} */
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

  /** @returns {void} */
  bindPageLifecycle() {
    this.lifecycleUseCase.bindPageLifecycle();
  }

  /** @returns {void} */
  handlePageHidden() {
    this.lifecycleUseCase.handlePageHidden();
  }

  /** @returns {void} */
  handlePageVisible() {
    this.lifecycleUseCase.handlePageVisible();
  }

  /** @returns {Promise<import('./ArSessionService.js').ArSessionService>} */
  async getSessionService() {
    return this.cameraSessionUseCase.getSessionService();
  }

  /** @returns {Promise<import('./ArSessionService.js').ArSessionService | null>} */
  preloadSessionService() {
    return this.cameraSessionUseCase.preloadSessionService();
  }

  /** @returns {void} */
  scheduleSessionServicePreload() {
    this.lifecycleUseCase.scheduleSessionServicePreload();
  }

  /** @returns {AppStateSnapshot} */
  getState() {
    return this.appState.getSnapshot();
  }
}

/**
 * @param {import('./ModelCatalogService.js').ModelCatalogService} modelCatalog
 * @param {NecklaceConfig} necklace
 * @param {UrlState} urlState
 * @returns {AppStatePatch}
 */
function createUrlHydrationPatch(modelCatalog, necklace, urlState) {
  const patch = modelCatalog.createSelectionPatch(necklace);
  const selectedColorIdsByTarget = { ...(patch.selectedColorIdsByTarget ?? {}) };

  Object.entries(urlState.colorByTarget).forEach(([targetId, colorId]) => {
    if (!isConfiguredColorTarget(necklace, targetId) || !isPaletteColor(necklace, colorId)) return;
    selectedColorIdsByTarget[targetId] = colorId;
  });

  patch.selectedColorIdsByTarget = selectedColorIdsByTarget;

  const fallbackColorId = urlState.colorFallback;
  if (fallbackColorId && isPaletteColor(necklace, fallbackColorId)) {
    patch.selectedColorId = fallbackColorId;
  }

  return patch;
}

/**
 * @param {NecklaceConfig} necklace
 * @param {string | null | undefined} colorId
 * @returns {boolean}
 */
function isPaletteColor(necklace, colorId) {
  if (!colorId) return false;
  return Boolean(necklace.colorCustomization?.palette?.some((colorOption) => colorOption.id === colorId));
}

/**
 * @param {NecklaceConfig} necklace
 * @param {string} targetId
 * @returns {boolean}
 */
function isConfiguredColorTarget(necklace, targetId) {
  return Boolean(necklace.colorCustomization?.targets?.some((target) => target.id === targetId));
}
