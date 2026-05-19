import { afterEach, describe, expect, it, vi } from 'vitest';
import { AR_SESSION_STATES } from '../AppState.js';
import { RealtimeTrackingStore } from '../RealtimeTrackingStore.js';
import { ShareUseCase } from './ShareUseCase.js';
import { NECKLACES } from '../../config/necklaces.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ShareUseCase', () => {
  it('captures, stores preview data, opens share sheet, and restores capture controls', async () => {
    const blob = new Blob(['image'], { type: 'image/png' });
    const useCase = createShareUseCase({
      shareWorkflow: {
        getCaptureBlocker: vi.fn(() => null),
        capture: vi.fn(() =>
          Promise.resolve({
            capture: { url: 'blob:next', blob },
            view: { kind: 'tracking', label: '美圖已產出', metrics: '可下載或分享給朋友' },
          }),
        ),
      },
    });
    useCase.realtimeStore.updateFrame({ landmarks: [{ x: 0.4, y: 0.5 }], hasFace: true, debugData: null });

    await useCase.handleCapture();

    expect(useCase.appState.transitionSession).toHaveBeenNthCalledWith(
      1,
      AR_SESSION_STATES.CAPTURING,
      {},
      'capture-start',
    );
    expect(useCase.appState.transitionSession).toHaveBeenNthCalledWith(
      2,
      AR_SESSION_STATES.SHARING,
      {
        captureDataUrl: 'blob:next',
        captureBlob: blob,
      },
      'capture-create',
    );
    expect(useCase.ui.setShareImage).toHaveBeenCalledWith('blob:next');
    expect(useCase.ui.openShareSheet).toHaveBeenCalledTimes(1);
    expect(useCase.ui.setStatus).toHaveBeenCalledWith('tracking', '美圖已產出', '可下載或分享給朋友');
    expect(useCase.ui.setCaptureBusy).toHaveBeenLastCalledWith(false);
  });

  it('applies capture blocker status without entering capture flow', async () => {
    const useCase = createShareUseCase({
      shareWorkflow: {
        getCaptureBlocker: vi.fn(() => ({
          status: 'blocked',
          view: { kind: 'idle', label: '尚未開啟相機', metrics: '請先啟動相機再拍照' },
        })),
      },
    });

    await useCase.handleCapture();

    expect(useCase.ui.setStatus).toHaveBeenCalledWith('idle', '尚未開啟相機', '請先啟動相機再拍照');
    expect(useCase.appState.transitionSession).not.toHaveBeenCalled();
  });

  it('downloads and shares existing captures through workflow status views', async () => {
    const blob = new Blob(['image'], { type: 'image/png' });
    const useCase = createShareUseCase({
      state: {
        captureBlob: blob,
        captureDataUrl: 'data:image/png;base64,abc',
      },
      shareWorkflow: {
        download: vi.fn(() => ({ kind: 'idle', label: '圖片已下載', metrics: '可以上傳 Instagram 或傳給朋友' })),
        share: vi.fn(() => Promise.resolve({ kind: 'idle', label: '分享面板已開啟', metrics: '選擇 Instagram、訊息或好友' })),
      },
    });

    useCase.downloadCapture();
    await useCase.shareCapture();

    expect(useCase.shareWorkflow.download).toHaveBeenCalledWith({
      blob,
      dataUrl: 'data:image/png;base64,abc',
    });
    expect(useCase.shareWorkflow.share).toHaveBeenCalledWith({
      blob,
      dataUrl: 'data:image/png;base64,abc',
    });
    expect(useCase.ui.setStatus).toHaveBeenCalledWith('idle', '圖片已下載', '可以上傳 Instagram 或傳給朋友');
    expect(useCase.ui.setStatus).toHaveBeenCalledWith('idle', '分享面板已開啟', '選擇 Instagram、訊息或好友');
  });

  it('closes sharing sessions to tracking or noFace based on realtime face state', () => {
    const withFace = createShareUseCase({
      state: {
        sessionStatus: AR_SESSION_STATES.SHARING,
        cameraStarted: true,
      },
    });
    const withoutFace = createShareUseCase({
      state: {
        sessionStatus: AR_SESSION_STATES.SHARING,
        cameraStarted: true,
      },
    });

    withFace.realtimeStore.updateFrame({ landmarks: [{ x: 0.4, y: 0.5 }], hasFace: true, debugData: null });
    withFace.closeShareSheet();
    withoutFace.closeShareSheet();

    expect(withFace.ui.closeShareSheet).toHaveBeenCalledTimes(1);
    expect(withFace.appState.transitionSession).toHaveBeenCalledWith(
      AR_SESSION_STATES.TRACKING,
      {},
      'share-close',
    );
    expect(withoutFace.ui.closeShareSheet).toHaveBeenCalledTimes(1);
    expect(withoutFace.appState.transitionSession).toHaveBeenCalledWith(
      AR_SESSION_STATES.NO_FACE,
      {},
      'share-close',
    );
  });

  it('revokes the previous blob preview URL when replacing it', () => {
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const useCase = createShareUseCase();

    useCase.rememberCapturePreviewUrl('blob:old');
    useCase.rememberCapturePreviewUrl('blob:new');

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:old');
    expect(useCase.capturePreviewUrl).toBe('blob:new');
  });
});

function createShareUseCase(overrides = {}) {
  const { state: stateOverrides, shareWorkflow: shareWorkflowOverrides, ...optionOverrides } = overrides;
  let state = {
    mode: 'ar',
    sessionStatus: AR_SESSION_STATES.TRACKING,
    cameraStarted: true,
    cameraFacingMode: 'user',
    isSwitchingCamera: false,
    modelLoaded: true,
    selectedNecklace: NECKLACES[0],
    selectedColorId: '',
    selectedColorIdsByTarget: {},
    necklaceVisible: true,
    debugEnabled: false,
    activePanel: 'styles',
    controlsCollapsed: true,
    captureDataUrl: '',
    captureBlob: null,
    adjustments: {
      horizontalOffset: 0,
      verticalOffset: 0,
      scaleMultiplier: 1,
      rotationOffset: 0,
    },
    ...(stateOverrides ?? {}),
  };
  const setState = (patch = {}) => {
    state = { ...state, ...patch };
    return state;
  };
  const shareWorkflow = {
    getCaptureBlocker: vi.fn(() => null),
    capture: vi.fn(() =>
      Promise.resolve({
        capture: { url: 'blob:capture', blob: null },
        view: { kind: 'tracking', label: '美圖已產出', metrics: '可下載或分享給朋友' },
      }),
    ),
    download: vi.fn(() => null),
    share: vi.fn(() => Promise.resolve(null)),
    ...(shareWorkflowOverrides ?? {}),
  };

  return new ShareUseCase({
    appState: {
      get: vi.fn((key) => state[key]),
      getSnapshot: vi.fn(() => state),
      set: vi.fn((patch) => setState(patch)),
      transitionSession: vi.fn((nextStatus, patch = {}) => setState({ ...patch, sessionStatus: nextStatus })),
    },
    ui: {
      clearError: vi.fn(),
      hasCurrentVideoFrame: vi.fn(() => true),
      setCaptureDisabled: vi.fn(),
      setCaptureBusy: vi.fn(),
      setShareImage: vi.fn(),
      openShareSheet: vi.fn(),
      closeShareSheet: vi.fn(),
      setStatus: vi.fn(),
    },
    realtimeStore: new RealtimeTrackingStore({ now: () => 100 }),
    shareWorkflow,
    showError: vi.fn(),
    ...optionOverrides,
  });
}
