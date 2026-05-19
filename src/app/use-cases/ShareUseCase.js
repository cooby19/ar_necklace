// @ts-check

import { AR_SESSION_STATES } from '../AppState.js';

/** @typedef {import('../../types/domain').AppStateSnapshot} AppStateSnapshot */
/** @typedef {import('../../types/domain').ArSessionStatus} ArSessionStatus */
/** @typedef {import('../../types/domain').RealtimeTrackingSnapshot} RealtimeTrackingSnapshot */
/** @typedef {import('../../types/domain').WorkflowStatusView} WorkflowStatusView */
/** @typedef {import('../../types/app-ports').AppStatePort} AppStatePort */
/** @typedef {import('../../types/ui-ports').UiControllerPort} UiControllerPort */
/** @typedef {import('../RealtimeTrackingStore.js').RealtimeTrackingStore} RealtimeTrackingStore */

/**
 * @typedef {{
 *   appState: AppStatePort,
 *   ui: UiControllerPort,
 *   realtimeStore: RealtimeTrackingStore,
 *   shareWorkflow: import('../ShareWorkflow.js').ShareWorkflow,
 *   showError: (message: string) => void,
 * }} ShareUseCaseOptions
 */

export class ShareUseCase {
  /**
   * @param {ShareUseCaseOptions} options
   */
  constructor({ appState, ui, realtimeStore, shareWorkflow, showError }) {
    this.appState = appState;
    this.ui = ui;
    this.realtimeStore = realtimeStore;
    this.shareWorkflow = shareWorkflow;
    this.showError = showError;
    this.capturePreviewUrl = '';
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
