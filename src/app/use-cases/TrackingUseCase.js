// @ts-check

import { APP_MODES, AR_SESSION_STATES } from '../AppState.js';

const TRACKING_FEEDBACK_UPDATE_INTERVAL_MS = 350;

/** @typedef {import('../../types/domain').AppStateSnapshot} AppStateSnapshot */
/** @typedef {import('../../types/domain').ArSessionStatus} ArSessionStatus */
/** @typedef {import('../../types/domain').FaceMeshResults} FaceMeshResults */
/** @typedef {import('../../types/domain').NecklaceDebugData} NecklaceDebugData */
/** @typedef {import('../../types/domain').TrackerStats} TrackerStats */
/** @typedef {import('../../types/domain').WorkflowStatusView} WorkflowStatusView */
/** @typedef {import('../../types/app-ports').AppStatePort} AppStatePort */
/** @typedef {import('../../types/ui-ports').UiControllerPort} UiControllerPort */
/** @typedef {import('../RealtimeTrackingStore.js').RealtimeTrackingStore} RealtimeTrackingStore */

/**
 * @typedef {{
 *   appState: AppStatePort,
 *   ui: UiControllerPort,
 *   realtimeStore: RealtimeTrackingStore,
 *   necklaceController: import('../../core/NecklaceController.js').NecklaceController,
 *   rendererLoop: import('../RendererLoop.js').RendererLoop,
 *   feedbackService: import('../TrackingFeedbackService.js').TrackingFeedbackService,
 *   calibrationUseCase: import('./CalibrationUseCase.js').CalibrationUseCase,
 * }} TrackingUseCaseOptions
 */

export class TrackingUseCase {
  /**
   * @param {TrackingUseCaseOptions} options
   */
  constructor({ appState, ui, realtimeStore, necklaceController, rendererLoop, feedbackService, calibrationUseCase }) {
    this.appState = appState;
    this.ui = ui;
    this.realtimeStore = realtimeStore;
    this.necklaceController = necklaceController;
    this.rendererLoop = rendererLoop;
    this.feedbackService = feedbackService;
    this.calibrationUseCase = calibrationUseCase;
    /** @type {number | null} */
    this.trackingFeedbackTimer = null;
    this.lastTrackingFeedbackUpdateAt = 0;
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
      this.necklaceController.fadeOut();
    } else {
      debugData = this.necklaceController.updateFromLandmarks(landmarks, state.necklaceVisible);
      this.calibrationUseCase.markFaceReady();
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
    this.scheduleFeedbackUpdate({ force: didTransition });
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
   * @param {TrackerStats} stats
   * @returns {void}
   */
  handleFaceTrackerStats(stats) {
    this.realtimeStore.setTrackerStats(stats);
    const state = this.getState();
    if (!state.cameraStarted || !state.debugEnabled) return;

    this.scheduleFeedbackUpdate();
  }

  /**
   * @param {{ force?: boolean }} [options]
   * @returns {void}
   */
  scheduleFeedbackUpdate({ force = false } = {}) {
    const state = this.getState();
    if (!state.cameraStarted) return;

    const now = performance.now();
    const elapsed = now - this.lastTrackingFeedbackUpdateAt;

    if (force || elapsed >= TRACKING_FEEDBACK_UPDATE_INTERVAL_MS) {
      if (this.trackingFeedbackTimer !== null) {
        window.clearTimeout(this.trackingFeedbackTimer);
        this.trackingFeedbackTimer = null;
      }
      this.flushFeedback(now);
      return;
    }

    if (this.trackingFeedbackTimer !== null) return;

    this.trackingFeedbackTimer = window.setTimeout(() => {
      this.trackingFeedbackTimer = null;
      this.flushFeedback(performance.now());
    }, TRACKING_FEEDBACK_UPDATE_INTERVAL_MS - elapsed);
  }

  /**
   * @param {number} [now]
   * @returns {void}
   */
  flushFeedback(now = performance.now()) {
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
   * @param {WorkflowStatusView | null | undefined} statusView
   * @returns {void}
   */
  applyStatusView(statusView) {
    if (!statusView) return;

    this.ui.setStatus(statusView.kind, statusView.label, statusView.metrics);
  }

  /**
   * @returns {void}
   */
  dispose() {
    if (this.trackingFeedbackTimer === null) return;
    window.clearTimeout(this.trackingFeedbackTimer);
    this.trackingFeedbackTimer = null;
  }

  /**
   * @returns {AppStateSnapshot}
   */
  getState() {
    return this.appState.getSnapshot();
  }
}
