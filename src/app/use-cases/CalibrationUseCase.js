// @ts-check

/** @typedef {import('../../types/domain').WearAdjustmentPatch} WearAdjustmentPatch */
/** @typedef {import('../../types/app-ports').AppStatePort} AppStatePort */
/** @typedef {import('../../types/ui-ports').UiControllerPort} UiControllerPort */
/** @typedef {import('../RealtimeTrackingStore.js').RealtimeTrackingStore} RealtimeTrackingStore */

/**
 * @typedef {{
 *   message: string,
 *   options?: { isDirty?: boolean, isSaved?: boolean },
 * }} CalibrationHint
 */

/**
 * @typedef {{
 *   appState: AppStatePort,
 *   ui: UiControllerPort,
 *   realtimeStore: RealtimeTrackingStore,
 *   calibrationService: import('../CalibrationService.js').CalibrationService,
 *   necklaceController: import('../../core/NecklaceController.js').NecklaceController,
 *   rendererLoop: import('../RendererLoop.js').RendererLoop,
 * }} CalibrationUseCaseOptions
 */

export class CalibrationUseCase {
  /**
   * @param {CalibrationUseCaseOptions} options
   */
  constructor({ appState, ui, realtimeStore, calibrationService, necklaceController, rendererLoop }) {
    this.appState = appState;
    this.ui = ui;
    this.realtimeStore = realtimeStore;
    this.calibrationService = calibrationService;
    this.necklaceController = necklaceController;
    this.rendererLoop = rendererLoop;
  }

  /**
   * @param {PointerEvent} event
   * @returns {void}
   */
  handlePointerDown(event) {
    const state = this.getState();
    const realtime = this.realtimeStore.getSnapshot();
    if (!this.calibrationService.startDrag(event, { ...state, hasFace: realtime.hasFace })) return;

    this.ui.setCalibrationDragging(true);
  }

  /**
   * @param {PointerEvent} event
   * @returns {void}
   */
  handlePointerMove(event) {
    const state = this.getState();
    const result = this.calibrationService.updateDrag(event, state.adjustments);
    if (!result) return;

    this.applyTuning(result.adjustments, 'calibration-drag');
    this.ui.syncTuningControlsFromAdjustments(this.appState.get('adjustments'));
    this.applyHint(result.hint);
  }

  /**
   * @param {PointerEvent} event
   * @returns {void}
   */
  handlePointerUp(event) {
    if (!this.calibrationService.endDrag(event)) return;

    this.ui.setCalibrationDragging(false);
  }

  /**
   * @returns {void}
   */
  updateTuningFromControls() {
    const tuning = this.ui.readTuningControls();
    this.applyTuning(tuning.adjustments, 'calibration-input');
    this.updateHint({ dirty: true });
  }

  /**
   * @returns {void}
   */
  saveCalibration() {
    const state = this.getState();
    const result = this.calibrationService.save(state.selectedNecklace.id, state.adjustments);
    this.applyHint(result.hint);
  }

  /**
   * @returns {void}
   */
  resetCalibration() {
    const state = this.getState();
    const result = this.calibrationService.reset(state.selectedNecklace.id);
    this.ui.syncTuningControlsFromAdjustments(result.adjustments);
    this.applyTuning(result.adjustments, 'calibration-reset');
    this.applyHint(result.hint);
  }

  /**
   * @returns {void}
   */
  applyCalibrationForSelectedNecklace() {
    const state = this.getState();
    const result = this.calibrationService.load(state.selectedNecklace.id);
    this.ui.syncTuningControlsFromAdjustments(result.adjustments);
    this.applyTuning(result.adjustments, 'calibration-load');
    this.applyHint(result.hint);
  }

  /**
   * @param {{ dirty?: boolean }} [options]
   * @returns {void}
   */
  updateHint({ dirty = false } = {}) {
    const state = this.getState();
    this.applyHint(
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
    this.necklaceController.setAdjustments(normalizedAdjustments);
    this.rendererLoop.requestRender();
  }

  /**
   * @returns {void}
   */
  markFaceReady() {
    const necklaceId = this.appState.get('selectedNecklace').id;
    const hint = this.calibrationService.markFaceReady(necklaceId);
    this.applyHint(hint);
  }

  /**
   * @param {CalibrationHint | null} hint
   * @returns {void}
   */
  applyHint(hint) {
    if (!hint) return;

    this.ui.setCalibrationHint(hint.message, hint.options ?? {});
  }

  getState() {
    return this.appState.getSnapshot();
  }
}
