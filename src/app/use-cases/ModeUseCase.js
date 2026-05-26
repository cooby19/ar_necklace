// @ts-check

import { APP_MODES, AR_SESSION_STATES } from '../AppState.js';
import { reduceAppIntent } from '../app-reducer';

/** @typedef {import('../../types/domain').AppMode} AppMode */
/** @typedef {import('../../types/domain').AppStateSnapshot} AppStateSnapshot */
/** @typedef {import('../../types/domain').ArSessionStatus} ArSessionStatus */
/** @typedef {import('../../types/domain').WorkflowStatusView} WorkflowStatusView */
/** @typedef {import('../../types/app-ports').AppStatePort} AppStatePort */
/** @typedef {import('../../types/scene-ports').NecklaceSceneModePort} NecklaceSceneModePort */
/** @typedef {import('../app-intents').AppIntent} AppIntent */
/** @typedef {import('../app-reducer').AppReducerResult} AppReducerResult */

/**
 * @typedef {{
 *   canSelectControlPanel: (panelName: string) => boolean,
 *   setStatus: (kind: WorkflowStatusView['kind'], label: string, metrics: string) => void,
 * }} ModeUiPort
 */

/**
 * @typedef {{
 *   stopCameraSession: (options?: { nextStatus?: ArSessionStatus, eventName?: string }) => void,
 * }} ModeCameraSessionPort
 */

/**
 * @typedef {{
 *   updateDeveloperPanel: () => void,
 *   updateTrackingStatus: () => void,
 * }} ModeTrackingPort
 */

/**
 * @typedef {{
 *   appState: AppStatePort,
 *   ui: ModeUiPort,
 *   scene: NecklaceSceneModePort,
 *   debugOverlay: import('../../core/DebugOverlay.js').DebugOverlay,
 *   necklaceController: import('../../core/NecklaceController.js').NecklaceController,
 *   rendererLoop: import('../RendererLoop.js').RendererLoop,
 *   cameraSessionUseCase: ModeCameraSessionPort,
 *   trackingUseCase: ModeTrackingPort,
 *   preloadSessionService: () => Promise<unknown>,
 * }} ModeUseCaseOptions
 */

export class ModeUseCase {
  /**
   * @param {ModeUseCaseOptions} options
   */
  constructor({
    appState,
    ui,
    scene,
    debugOverlay,
    necklaceController,
    rendererLoop,
    cameraSessionUseCase,
    trackingUseCase,
    preloadSessionService,
  }) {
    this.appState = appState;
    this.ui = ui;
    this.scene = scene;
    this.debugOverlay = debugOverlay;
    this.necklaceController = necklaceController;
    this.rendererLoop = rendererLoop;
    this.cameraSessionUseCase = cameraSessionUseCase;
    this.trackingUseCase = trackingUseCase;
    this.preloadSessionService = preloadSessionService;
  }

  /**
   * @param {AppMode | string | null | undefined} mode
   * @returns {void}
   */
  selectMode(mode) {
    const state = this.getState();
    const result = reduceAppIntent(state, { type: 'mode/select', mode });
    if (result.kind === 'none') return;

    if (mode === APP_MODES.SHOWCASE && state.cameraStarted) {
      this.cameraSessionUseCase.stopCameraSession({
        nextStatus: AR_SESSION_STATES.SHOWCASE,
        eventName: 'mode-camera-stop',
      });
    }

    this.applyAppReducerResult(result);

    if (mode === APP_MODES.AR) {
      this.scene.setShowcaseMode(false);
      this.necklaceController.reset();
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
   * @param {boolean} isEnabled
   * @returns {void}
   */
  handleDebugToggle(isEnabled) {
    this.dispatchAppIntent({ type: 'debug/toggle', isEnabled });
    this.debugOverlay.setEnabled(this.appState.get('mode') === APP_MODES.AR && isEnabled);
    this.trackingUseCase.updateDeveloperPanel();
    this.trackingUseCase.updateTrackingStatus();
  }

  /**
   * @param {boolean} isVisible
   * @returns {void}
   */
  handleNecklaceToggle(isVisible) {
    this.dispatchAppIntent({ type: 'necklace-visibility/toggle', isVisible });

    if (!isVisible) {
      this.necklaceController.fadeOut();
    }
    this.rendererLoop.requestRender();
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
      this.necklaceController.reset();
      this.rendererLoop.requestRender();
      this.ui.setStatus('idle', 'AR 試戴', '開啟相機後即可即時試戴');
    }
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
   * @returns {AppStateSnapshot}
   */
  getState() {
    return this.appState.getSnapshot();
  }
}
