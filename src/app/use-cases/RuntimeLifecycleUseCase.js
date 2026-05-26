// @ts-check

/** @typedef {import('../../types/domain').AppStateMeta} AppStateMeta */
/** @typedef {import('../../types/domain').AppStateSnapshot} AppStateSnapshot */
/** @typedef {import('../../types/domain').WearAdjustmentPatch} WearAdjustmentPatch */
/** @typedef {import('../../types/app-ports').AppStatePort} AppStatePort */
/** @typedef {import('../../types/ui-ports').ColorSwatchesUiModel} ColorSwatchesUiModel */

/**
 * @typedef {{
 *   populateNecklaceSelect: (selectedNecklaceId: string) => void,
 *   populateColorSwatches: (model: ColorSwatchesUiModel) => void,
 *   syncFromState: (state: AppStateSnapshot, meta?: Partial<AppStateMeta>) => void,
 *   showError: (message: string) => void,
 * }} RuntimeLifecycleUiPort
 */

/**
 * @typedef {{
 *   appState: AppStatePort,
 *   ui: RuntimeLifecycleUiPort,
 *   realtimeStore: import('../RealtimeTrackingStore.js').RealtimeTrackingStore,
 *   rendererLoop: import('../RendererLoop.js').RendererLoop,
 *   necklaceController: import('../../core/NecklaceController.js').NecklaceController,
 *   calibrationUseCase: import('./CalibrationUseCase.js').CalibrationUseCase,
 *   cameraSessionUseCase: import('./CameraSessionUseCase.js').CameraSessionUseCase,
 *   modelUseCase: import('./ModelUseCase.js').ModelUseCase,
 *   modeUseCase: import('./ModeUseCase.js').ModeUseCase,
 *   trackingUseCase: import('./TrackingUseCase.js').TrackingUseCase,
 * }} RuntimeLifecycleUseCaseOptions
 */

export class RuntimeLifecycleUseCase {
  /**
   * @param {RuntimeLifecycleUseCaseOptions} options
   */
  constructor({
    appState,
    ui,
    realtimeStore,
    rendererLoop,
    necklaceController,
    calibrationUseCase,
    cameraSessionUseCase,
    modelUseCase,
    modeUseCase,
    trackingUseCase,
  }) {
    this.appState = appState;
    this.ui = ui;
    this.realtimeStore = realtimeStore;
    this.rendererLoop = rendererLoop;
    this.necklaceController = necklaceController;
    this.calibrationUseCase = calibrationUseCase;
    this.cameraSessionUseCase = cameraSessionUseCase;
    this.modelUseCase = modelUseCase;
    this.modeUseCase = modeUseCase;
    this.trackingUseCase = trackingUseCase;
    /** @type {(() => void) | null} */
    this.cancelSessionServicePreload = null;
    /** @type {(() => void)[]} */
    this.lifecycleDisposers = [];
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
    this.calibrationUseCase.applyCalibrationForSelectedNecklace();
    this.modelUseCase.syncColorAvailability();
    this.modeUseCase.syncModeEffects();
    void this.modelUseCase.loadSelectedNecklace();
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
    this.necklaceController.fadeOut();
  }

  /**
   * @returns {void}
   */
  handlePageVisible() {
    this.rendererLoop.resume();
    this.rendererLoop.requestRender();

    if (!this.appState.get('cameraStarted')) return;

    this.cameraSessionUseCase.resumeTracking().catch((error) => {
      this.ui.showError(`Face Mesh 恢復偵測失敗：${formatUnknownError(error)}`);
    });
  }

  /**
   * @returns {Promise<import('../ArSessionService.js').ArSessionService | null>}
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
