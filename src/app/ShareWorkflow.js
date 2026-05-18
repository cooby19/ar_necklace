// @ts-check

import { isSelfieCamera } from './AppState.js';

/** @typedef {import('../types/domain').CameraFacingMode} CameraFacingMode */
/** @typedef {import('../types/domain').CaptureResult} CaptureResult */
/** @typedef {import('../types/domain').WorkflowStatusView} WorkflowStatusView */
/** @typedef {import('../types/app-ports').CaptureServicePort} CaptureServicePort */
/** @typedef {import('../types/scene-ports').CaptureScenePort} CaptureScenePort */

/**
 * @typedef {{
 *   cameraStarted: boolean,
 *   hasFace: boolean,
 *   necklaceVisible: boolean,
 * }} CaptureReadinessState
 */

/** @typedef {CaptureReadinessState & { cameraFacingMode: CameraFacingMode }} CaptureState */

export class ShareWorkflow {
  /**
   * @param {{ captureService: CaptureServicePort, scene: CaptureScenePort }} options
   */
  constructor({ captureService, scene }) {
    this.captureService = captureService;
    this.scene = scene;
  }

  /**
   * @param {CaptureReadinessState} state
   * @param {{ hasCurrentVideoFrame: boolean }} options
   * @returns {{ status: 'blocked', view: WorkflowStatusView } | null}
   */
  getCaptureBlocker(state, { hasCurrentVideoFrame }) {
    if (!state.cameraStarted || !hasCurrentVideoFrame) {
      return {
        status: 'blocked',
        view: {
          kind: 'idle',
          label: '尚未開啟相機',
          metrics: '請先啟動相機再拍照',
        },
      };
    }

    if (!state.hasFace) {
      return {
        status: 'blocked',
        view: {
          kind: 'idle',
          label: '尚未偵測到臉',
          metrics: '請將臉保持在畫面中央後再拍照',
        },
      };
    }

    if (!state.necklaceVisible) {
      return {
        status: 'blocked',
        view: {
          kind: 'idle',
          label: '項鍊目前隱藏',
          metrics: '請先開啟項鍊預覽再拍照',
        },
      };
    }

    return null;
  }

  /**
   * @param {CaptureState} state
   * @returns {Promise<{ capture: CaptureResult, view: WorkflowStatusView }>}
   */
  async capture(state) {
    this.scene.renderForCapture();
    const capture = await this.captureService.createCapture({
      mirrored: isSelfieCamera(state.cameraFacingMode),
    });

    return {
      capture,
      view: {
        kind: 'tracking',
        label: '美圖已產出',
        metrics: '可下載或分享給朋友',
      },
    };
  }

  /**
   * @param {{ blob?: Blob | null, url?: string, dataUrl?: string } | string} capture
   * @returns {WorkflowStatusView | null}
   */
  download(capture) {
    const hasCapture =
      typeof capture === 'string' ? Boolean(capture) : Boolean(capture?.blob || capture?.url || capture?.dataUrl);
    if (!hasCapture) return null;

    this.captureService.download(capture);
    return {
      kind: 'idle',
      label: '圖片已下載',
      metrics: '可以上傳 Instagram 或傳給朋友',
    };
  }

  /**
   * @param {{ blob: Blob | null, dataUrl: string }} capture
   * @returns {Promise<WorkflowStatusView | null>}
   */
  async share({ blob, dataUrl }) {
    if (!blob) return null;

    const result = await this.captureService.share(blob);

    if (result.status === 'shared') {
      return {
        kind: 'idle',
        label: '分享面板已開啟',
        metrics: '選擇 Instagram、訊息或好友',
      };
    }

    if (result.status === 'unsupported') {
      this.download({ blob, dataUrl });
      return {
        kind: 'idle',
        label: '此瀏覽器不支援直接分享',
        metrics: '已改為下載圖片',
      };
    }

    return null;
  }
}
