import { describe, expect, it, vi } from 'vitest';
import { AR_SESSION_STATES, CAMERA_FACING_MODES } from '../AppState.js';
import { RealtimeTrackingStore } from '../RealtimeTrackingStore.js';
import { CameraSessionUseCase } from './CameraSessionUseCase.js';
import { NECKLACES } from '../../config/necklaces.js';

const mocks = vi.hoisted(() => ({
  ArSessionService: vi.fn(function ArSessionService(options) {
    this.options = options;
    this.start = vi.fn(() => Promise.resolve({ cameraFacingMode: CAMERA_FACING_MODES.USER }));
    this.switchCamera = vi.fn(() =>
      Promise.resolve({ cameraFacingMode: CAMERA_FACING_MODES.ENVIRONMENT, status: 'switched' }),
    );
    this.stop = vi.fn();
    this.pauseTracking = vi.fn();
    this.resumeTracking = vi.fn(() => Promise.resolve());
  }),
}));

vi.mock('../ArSessionService.js', () => ({ ArSessionService: mocks.ArSessionService }));

describe('CameraSessionUseCase', () => {
  it('starts the camera session and updates camera UI/state', async () => {
    const sessionService = {
      start: vi.fn(() => Promise.resolve({ cameraFacingMode: CAMERA_FACING_MODES.USER })),
    };
    const useCase = createCameraSessionUseCase({ sessionService });

    await useCase.startExperience();

    expect(useCase.ui.elements.startButton.disabled).toBe(true);
    expect(useCase.ui.elements.switchCameraButton.disabled).toBe(true);
    expect(useCase.ui.elements.stopCameraButton.disabled).toBe(true);
    expect(useCase.necklaceController.fadeOut).toHaveBeenCalledTimes(1);
    expect(useCase.appState.transitionSession).toHaveBeenNthCalledWith(
      1,
      AR_SESSION_STATES.CAMERA_STARTING,
      {},
      'camera-start-request',
    );
    expect(sessionService.start).toHaveBeenCalledWith(CAMERA_FACING_MODES.USER);
    expect(useCase.appState.transitionSession).toHaveBeenNthCalledWith(
      2,
      AR_SESSION_STATES.NO_FACE,
      {
        cameraStarted: true,
        cameraFacingMode: CAMERA_FACING_MODES.USER,
      },
      'camera-start',
    );
    expect(useCase.rendererLoop.resume).toHaveBeenCalledTimes(1);
    expect(useCase.scene.resize).toHaveBeenCalledTimes(1);
    expect(useCase.debugOverlay.resize).toHaveBeenCalledTimes(1);
    expect(useCase.ui.setCameraOn).toHaveBeenCalledWith(true);
    expect(useCase.ui.setCaptureDisabled).toHaveBeenCalledWith(false);
    expect(useCase.ui.setStatus).toHaveBeenCalledWith('idle', '相機已啟動', '正在尋找臉部');
  });

  it('stops the active camera session and clears tracking state', () => {
    const sessionService = {
      stop: vi.fn(),
    };
    const useCase = createCameraSessionUseCase({
      state: {
        cameraStarted: true,
        sessionStatus: AR_SESSION_STATES.TRACKING,
      },
      sessionService,
    });
    useCase.realtimeStore.updateFrame({ landmarks: [{ x: 0.4, y: 0.5 }], hasFace: true, debugData: null });

    useCase.stopCameraSession({ nextStatus: AR_SESSION_STATES.SHOWCASE, eventName: 'mode-camera-stop' });

    expect(sessionService.stop).toHaveBeenCalledTimes(1);
    expect(useCase.realtimeStore.getSnapshot()).toMatchObject({
      hasFace: false,
      latestLandmarks: null,
    });
    expect(useCase.necklaceController.reset).toHaveBeenCalledTimes(1);
    expect(useCase.calibrationService.cancelDrag).toHaveBeenCalledTimes(1);
    expect(useCase.ui.setCalibrationDragging).toHaveBeenCalledWith(false);
    expect(useCase.appState.transitionSession).toHaveBeenCalledWith(
      AR_SESSION_STATES.SHOWCASE,
      {
        cameraStarted: false,
        isSwitchingCamera: false,
      },
      'mode-camera-stop',
    );
    expect(useCase.ui.setCameraOn).toHaveBeenCalledWith(false);
    expect(useCase.ui.setCaptureDisabled).toHaveBeenCalledWith(true);
    expect(useCase.ui.elements.startButton.disabled).toBe(false);
    expect(useCase.ui.setStartButtonLabel).toHaveBeenLastCalledWith('開始相機');
    expect(useCase.rendererLoop.requestRender).toHaveBeenCalledTimes(1);
  });

  it('switches to the next camera and clears switching state', async () => {
    const sessionService = {
      switchCamera: vi.fn(() =>
        Promise.resolve({ cameraFacingMode: CAMERA_FACING_MODES.ENVIRONMENT, status: 'switched' }),
      ),
    };
    const useCase = createCameraSessionUseCase({
      state: {
        cameraStarted: true,
        cameraFacingMode: CAMERA_FACING_MODES.USER,
      },
      sessionService,
    });

    await useCase.switchCamera();

    expect(useCase.appState.transitionSession).toHaveBeenNthCalledWith(
      1,
      AR_SESSION_STATES.CAMERA_STARTING,
      { isSwitchingCamera: true },
      'camera-switch-start',
    );
    expect(sessionService.switchCamera).toHaveBeenCalledWith(CAMERA_FACING_MODES.USER, {
      onRestoreStart: expect.any(Function),
    });
    expect(useCase.appState.transitionSession).toHaveBeenNthCalledWith(
      2,
      AR_SESSION_STATES.NO_FACE,
      {
        cameraStarted: true,
        cameraFacingMode: CAMERA_FACING_MODES.ENVIRONMENT,
        isSwitchingCamera: false,
      },
      'camera-switch-success',
    );
    expect(useCase.ui.setStatus).toHaveBeenLastCalledWith('idle', '鏡頭已切換', '目前使用後鏡頭');
    expect(useCase.ui.setCaptureDisabled).toHaveBeenLastCalledWith(false);
  });

  it('lazily creates ArSessionService with face tracker callbacks', async () => {
    const onFaceResults = vi.fn();
    const onFaceTrackerStats = vi.fn();
    const showError = vi.fn();
    const useCase = createCameraSessionUseCase({
      onFaceResults,
      onFaceTrackerStats,
      showError,
    });

    const service = await useCase.getSessionService();
    const results = { multiFaceLandmarks: [] };
    const stats = { currentFps: 12 };
    service.options.onResults(results);
    service.options.onStatsUpdate(stats);
    service.options.onError(new Error('mesh failed'));

    expect(mocks.ArSessionService).toHaveBeenCalledWith({
      videoElement: useCase.ui.elements.video,
      onResults: expect.any(Function),
      onError: expect.any(Function),
      onStatsUpdate: expect.any(Function),
    });
    expect(onFaceResults).toHaveBeenCalledWith(results);
    expect(onFaceTrackerStats).toHaveBeenCalledWith(stats);
    expect(showError).toHaveBeenCalledWith('Face Mesh 偵測發生錯誤：mesh failed');
  });
});

function createCameraSessionUseCase(overrides = {}) {
  const { state: stateOverrides, sessionService, ...optionOverrides } = overrides;
  let state = {
    mode: 'ar',
    sessionStatus: AR_SESSION_STATES.AR_IDLE,
    cameraStarted: false,
    cameraFacingMode: CAMERA_FACING_MODES.USER,
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
  const useCase = new CameraSessionUseCase({
    appState: {
      get: vi.fn((key) => state[key]),
      getSnapshot: vi.fn(() => state),
      set: vi.fn((patch) => setState(patch)),
      transitionSession: vi.fn((nextStatus, patch = {}) => setState({ ...patch, sessionStatus: nextStatus })),
    },
    ui: {
      clearError: vi.fn(),
      setStartButtonLabel: vi.fn(),
      setCameraOn: vi.fn(),
      setCaptureDisabled: vi.fn(),
      setCalibrationDragging: vi.fn(),
      setStatus: vi.fn(),
      elements: {
        video: {},
        startButton: { disabled: false },
        switchCameraButton: { disabled: false },
        stopCameraButton: { disabled: false },
      },
    },
    realtimeStore: new RealtimeTrackingStore({ now: () => 100 }),
    scene: {
      resize: vi.fn(),
    },
    debugOverlay: {
      resize: vi.fn(),
    },
    necklaceController: {
      fadeOut: vi.fn(),
      reset: vi.fn(),
    },
    calibrationService: {
      cancelDrag: vi.fn(),
    },
    rendererLoop: {
      resume: vi.fn(),
      requestRender: vi.fn(),
    },
    onFaceResults: vi.fn(),
    onFaceTrackerStats: vi.fn(),
    showError: vi.fn(),
    ...optionOverrides,
  });

  if (sessionService) {
    useCase.sessionService = sessionService;
  }

  return useCase;
}
