import { isSelfieCamera } from './AppState.js';

export class ShareWorkflow {
  constructor({ captureService, scene }) {
    this.captureService = captureService;
    this.scene = scene;
  }

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

  download(dataUrl) {
    if (!dataUrl) return null;

    this.captureService.download(dataUrl);
    return {
      kind: 'idle',
      label: '圖片已下載',
      metrics: '可以上傳 Instagram 或傳給朋友',
    };
  }

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
      this.download(dataUrl);
      return {
        kind: 'idle',
        label: '此瀏覽器不支援直接分享',
        metrics: '已改為下載圖片',
      };
    }

    return null;
  }
}
