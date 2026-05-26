// @ts-check

import { APP_MODES } from '../AppState.js';

/** @typedef {import('../../types/domain').AppStateSnapshot} AppStateSnapshot */
/** @typedef {import('../../types/app-ports').AppStatePort} AppStatePort */
/** @typedef {import('../../types/scene-ports').NecklaceSceneModePort} NecklaceSceneModePort */

/**
 * @typedef {{
 *   elements: {
 *     threeCanvas: HTMLCanvasElement,
 *   },
 *   setShowcaseDragging: (isDragging: boolean) => void,
 * }} StageInteractionUiPort
 */

/**
 * @typedef {{
 *   appState: AppStatePort,
 *   ui: StageInteractionUiPort,
 *   scene: NecklaceSceneModePort,
 *   calibrationUseCase: import('./CalibrationUseCase.js').CalibrationUseCase,
 * }} StageInteractionUseCaseOptions
 */

export class StageInteractionUseCase {
  /**
   * @param {StageInteractionUseCaseOptions} options
   */
  constructor({ appState, ui, scene, calibrationUseCase }) {
    this.appState = appState;
    this.ui = ui;
    this.scene = scene;
    this.calibrationUseCase = calibrationUseCase;
  }

  /**
   * @param {PointerEvent} event
   * @returns {void}
   */
  handlePointerDown(event) {
    const state = this.getState();
    if (state.mode === APP_MODES.AR) {
      this.calibrationUseCase.handlePointerDown(event);
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
  handlePointerMove(event) {
    const state = this.getState();
    if (state.mode === APP_MODES.AR) {
      this.calibrationUseCase.handlePointerMove(event);
      return;
    }

    if (state.mode !== APP_MODES.SHOWCASE || !state.modelLoaded) return;

    this.scene.dragShowcase(event.clientX);
  }

  /**
   * @param {PointerEvent} event
   * @returns {void}
   */
  handlePointerUp(event) {
    const state = this.getState();
    if (state.mode === APP_MODES.AR) {
      this.calibrationUseCase.handlePointerUp(event);
      return;
    }

    if (state.mode !== APP_MODES.SHOWCASE) return;

    this.ui.elements.threeCanvas.releasePointerCapture?.(event.pointerId);
    this.ui.setShowcaseDragging(false);
    this.scene.endShowcaseDrag();
  }

  /**
   * @returns {AppStateSnapshot}
   */
  getState() {
    return this.appState.getSnapshot();
  }
}
