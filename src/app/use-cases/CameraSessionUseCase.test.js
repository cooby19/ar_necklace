import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AR_SESSION_STATES, CAMERA_FACING_MODES } from '../AppState.js';
import { RealtimeTrackingStore } from '../RealtimeTrackingStore.js';
import { CameraSessionUseCase } from './CameraSessionUseCase.js';
import { NECKLACES } from '../../config/necklaces.js';
import { runtimeErrorReporter } from '../../telemetry/RuntimeErrorReporter.js';

const mocks = vi.hoisted(() => ({
  ArSessionService: vi.fn(function ArSessionService(options) {
    this.options = options;
    this.startCamera = vi.fn(() => Promise.resolve({ cameraFacingMode: CAMERA_FACING_MODES.USER }));
    this.startFaceTracking = vi.fn(() => Promise.resolve());
    this.start = vi.fn(async (facingMode) => {
      const session = await this.startCamera(facingMode);
      await this.startFaceTracking();
      return session;
    });
    this.switchCameraStream = vi.fn(() =>
      Promise.resolve({ cameraFacingMode: CAMERA_FACING_MODES.ENVIRONMENT, status: 'switched' }),
    );
    this.switchCamera = vi.fn(async (previousFacingMode) => {
      const session = await this.switchCameraStream(previousFacingMode);
      await this.startFaceTracking();
      return session;
    });
    this.isCameraActive = vi.fn(() => true);
    this.stop = vi.fn();
    this.pauseTracking = vi.fn();
    this.resumeTracking = vi.fn(() => Promise.resolve());
  }),
}));

vi.mock('../ArSessionService.js', () => ({ ArSessionService: mocks.ArSessionService }));

beforeEach(() => {
  mocks.ArSessionService.mockClear();
});

describe('CameraSessionUseCase', () => {
  it('starts the camera session and updates camera UI/state', async () => {
    const sessionService = {
      startCamera: vi.fn(() => Promise.resolve({ cameraFacingMode: CAMERA_FACING_MODES.USER })),
      startFaceTracking: vi.fn(() => Promise.resolve()),
    };
    const useCase = createCameraSessionUseCase({ sessionService });

    await useCase.startExperience();

    expect(useCase.ui.elements.startButton.disabled).toBe(true);
    expect(useCase.ui.elements.switchCameraButton.disabled).toBe(false);
    expect(useCase.ui.elements.stopCameraButton.disabled).toBe(false);
    expect(useCase.necklaceController.fadeOut).toHaveBeenCalledTimes(1);
    expect(useCase.appState.transitionSession).toHaveBeenNthCalledWith(
      1,
      AR_SESSION_STATES.CAMERA_STARTING,
      {},
      'camera-start-request',
    );
    expect(sessionService.startCamera).toHaveBeenCalledWith(CAMERA_FACING_MODES.USER);
    expect(sessionService.startFaceTracking).toHaveBeenCalledTimes(1);
    expect(useCase.appState.transitionSession).toHaveBeenNthCalledWith(
      2,
      AR_SESSION_STATES.TRACKING_STARTING,
      {
        cameraStarted: true,
        cameraFacingMode: CAMERA_FACING_MODES.USER,
        isSwitchingCamera: false,
      },
      'camera-start',
    );
    expect(useCase.appState.transitionSession).toHaveBeenNthCalledWith(
      3,
      AR_SESSION_STATES.NO_FACE,
      {},
      'face-tracking-ready',
    );
    expect(useCase.rendererLoop.resume).toHaveBeenCalledTimes(1);
    expect(useCase.scene.resize).toHaveBeenCalledTimes(1);
    expect(useCase.debugOverlay.resize).toHaveBeenCalledTimes(1);
    expect(useCase.ui.setCameraOn).toHaveBeenCalledWith(true);
    expect(useCase.ui.setCaptureDisabled).toHaveBeenCalledWith(false);
    expect(useCase.ui.setStatus).toHaveBeenLastCalledWith('idle', '臉部追蹤已啟動', '正在尋找臉部');
  });

  it('keeps the live camera preview when FaceMesh initialization fails', async () => {
    const trackingError = new Error('asset missing');
    const sessionService = {
      startCamera: vi.fn(() => Promise.resolve({ cameraFacingMode: CAMERA_FACING_MODES.USER })),
      startFaceTracking: vi.fn(() => Promise.reject(trackingError)),
      stop: vi.fn(),
    };
    const useCase = createCameraSessionUseCase({ sessionService });
    const captureError = vi.spyOn(runtimeErrorReporter, 'captureError').mockReturnValue(false);

    await useCase.startExperience();

    expect(sessionService.startCamera).toHaveBeenCalledTimes(1);
    expect(sessionService.startFaceTracking).toHaveBeenCalledTimes(1);
    expect(sessionService.stop).not.toHaveBeenCalled();
    expect(useCase.appState.transitionSession).toHaveBeenNthCalledWith(
      2,
      AR_SESSION_STATES.TRACKING_STARTING,
      {
        cameraStarted: true,
        cameraFacingMode: CAMERA_FACING_MODES.USER,
        isSwitchingCamera: false,
      },
      'camera-start',
    );
    expect(useCase.appState.transitionSession).toHaveBeenNthCalledWith(
      3,
      AR_SESSION_STATES.TRACKING_ERROR,
      {
        cameraStarted: true,
        isSwitchingCamera: false,
      },
      'face-tracking-error',
    );
    expect(useCase.ui.setCameraOn).toHaveBeenLastCalledWith(true);
    expect(useCase.ui.setCaptureDisabled).toHaveBeenLastCalledWith(true);
    expect(useCase.ui.elements.startButton.disabled).toBe(false);
    expect(useCase.ui.elements.stopCameraButton.disabled).toBe(false);
    expect(useCase.ui.setStartButtonLabel).toHaveBeenLastCalledWith('重試臉部追蹤');
    expect(useCase.showError).toHaveBeenCalledWith('臉部追蹤資產載入失敗：asset missing');
    expect(useCase.ui.setStatus).toHaveBeenLastCalledWith(
      'error',
      '臉部追蹤資產載入失敗',
      '相機仍在運作，可重試載入臉部追蹤',
    );
    expect(captureError).toHaveBeenCalledWith(
      trackingError,
      expect.objectContaining({
        eventType: 'face_tracking.init_failed',
        feature: 'face-tracking',
      }),
    );

    captureError.mockRestore();
  });

  it('labels FaceMesh asset timeouts and keeps the camera preview active', async () => {
    const timeoutError = Object.assign(new Error('臉部追蹤資產載入逾時（超過 18 秒）。可能仍在等待：/vendor/mediapipe/face_mesh/face_mesh.binarypb'), {
      code: 'FACE_MESH_INIT_TIMEOUT',
      timeoutMs: 18000,
      assetUrls: ['/vendor/mediapipe/face_mesh/face_mesh.binarypb'],
      resolvedAssetUrls: ['/vendor/mediapipe/face_mesh/face_mesh_solution_packed_assets_loader.js'],
      expectedAssetUrls: ['/vendor/mediapipe/face_mesh/face_mesh.binarypb'],
    });
    const sessionService = {
      startCamera: vi.fn(() => Promise.resolve({ cameraFacingMode: CAMERA_FACING_MODES.USER })),
      startFaceTracking: vi.fn(() => Promise.reject(timeoutError)),
      stop: vi.fn(),
    };
    const useCase = createCameraSessionUseCase({ sessionService });
    const captureError = vi.spyOn(runtimeErrorReporter, 'captureError').mockReturnValue(false);

    await useCase.startExperience();

    expect(sessionService.startCamera).toHaveBeenCalledTimes(1);
    expect(sessionService.startFaceTracking).toHaveBeenCalledTimes(1);
    expect(sessionService.stop).not.toHaveBeenCalled();
    expect(useCase.appState.transitionSession).toHaveBeenNthCalledWith(
      3,
      AR_SESSION_STATES.TRACKING_ERROR,
      {
        cameraStarted: true,
        isSwitchingCamera: false,
      },
      'face-tracking-error',
    );
    expect(useCase.ui.setCameraOn).toHaveBeenLastCalledWith(true);
    expect(useCase.ui.elements.stopCameraButton.disabled).toBe(false);
    expect(useCase.ui.setStartButtonLabel).toHaveBeenLastCalledWith('重試臉部追蹤');
    expect(useCase.showError).toHaveBeenCalledWith(timeoutError.message);
    expect(useCase.ui.setStatus).toHaveBeenLastCalledWith(
      'error',
      '臉部追蹤資產載入逾時',
      '相機仍在運作，可重試載入臉部追蹤',
    );
    expect(captureError).toHaveBeenCalledWith(
      timeoutError,
      expect.objectContaining({
        eventType: 'face_tracking.init_timeout',
        feature: 'face-tracking',
        extra: expect.objectContaining({
          timeoutMs: 18000,
          assetUrls: ['/vendor/mediapipe/face_mesh/face_mesh.binarypb'],
        }),
      }),
    );

    captureError.mockRestore();
  });

  it('retries FaceMesh initialization without restarting an active camera stream', async () => {
    const sessionService = {
      startCamera: vi.fn(() => Promise.resolve({ cameraFacingMode: CAMERA_FACING_MODES.USER })),
      startFaceTracking: vi.fn(() => Promise.resolve()),
      isCameraActive: vi.fn(() => true),
    };
    const useCase = createCameraSessionUseCase({
      state: {
        cameraStarted: true,
        sessionStatus: AR_SESSION_STATES.TRACKING_ERROR,
      },
      sessionService,
    });

    await useCase.startExperience();

    expect(sessionService.isCameraActive).toHaveBeenCalledTimes(1);
    expect(sessionService.startCamera).not.toHaveBeenCalled();
    expect(sessionService.startFaceTracking).toHaveBeenCalledTimes(1);
    expect(useCase.appState.transitionSession).toHaveBeenNthCalledWith(
      1,
      AR_SESSION_STATES.TRACKING_STARTING,
      {},
      'face-tracking-retry',
    );
    expect(useCase.appState.transitionSession).toHaveBeenNthCalledWith(
      2,
      AR_SESSION_STATES.NO_FACE,
      {},
      'face-tracking-ready',
    );
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
      switchCameraStream: vi.fn(() =>
        Promise.resolve({ cameraFacingMode: CAMERA_FACING_MODES.ENVIRONMENT, status: 'switched' }),
      ),
      startFaceTracking: vi.fn(() => Promise.resolve()),
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
    expect(sessionService.switchCameraStream).toHaveBeenCalledWith(CAMERA_FACING_MODES.USER, {
      onRestoreStart: expect.any(Function),
    });
    expect(useCase.appState.transitionSession).toHaveBeenNthCalledWith(
      2,
      AR_SESSION_STATES.TRACKING_STARTING,
      {
        cameraStarted: true,
        cameraFacingMode: CAMERA_FACING_MODES.ENVIRONMENT,
        isSwitchingCamera: false,
      },
      'camera-switch-success',
    );
    expect(useCase.appState.transitionSession).toHaveBeenNthCalledWith(
      3,
      AR_SESSION_STATES.NO_FACE,
      {},
      'face-tracking-ready',
    );
    expect(useCase.ui.setStatus).toHaveBeenLastCalledWith('idle', '臉部追蹤已啟動', '正在尋找臉部');
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

  it('preloads the session service with the shared lazy promise without starting camera work', async () => {
    const useCase = createCameraSessionUseCase();

    const preloadPromise = useCase.preloadSessionService();
    const servicePromise = useCase.getSessionService();
    const [preloadedService, sessionService] = await Promise.all([preloadPromise, servicePromise]);

    expect(preloadedService).toBe(sessionService);
    expect(mocks.ArSessionService).toHaveBeenCalledTimes(1);
    expect(sessionService.startCamera).not.toHaveBeenCalled();
    expect(sessionService.startFaceTracking).not.toHaveBeenCalled();
  });

  it('reports preload failures, clears the shared promise, and allows a later retry', async () => {
    const preloadError = new Error('preload failed');
    mocks.ArSessionService.mockImplementationOnce(function ArSessionService() {
      throw preloadError;
    });
    const captureError = vi.spyOn(runtimeErrorReporter, 'captureError').mockReturnValue(false);
    const useCase = createCameraSessionUseCase();

    await expect(useCase.preloadSessionService()).resolves.toBeNull();

    expect(captureError).toHaveBeenCalledWith(
      preloadError,
      expect.objectContaining({
        eventType: 'ar_session.preload_failed',
        feature: 'ar-session',
        level: 'warning',
      }),
    );
    expect(useCase.sessionServicePromise).toBeNull();

    const sessionService = await useCase.getSessionService();

    expect(sessionService).toBeTruthy();
    expect(mocks.ArSessionService).toHaveBeenCalledTimes(2);

    captureError.mockRestore();
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
