import { describe, expect, it, vi } from 'vitest';
import { APP_MODES, AR_SESSION_STATES } from '../AppState.js';
import { RealtimeTrackingStore } from '../RealtimeTrackingStore.js';
import { TrackingUseCase } from './TrackingUseCase.js';
import { NECKLACES } from '../../config/necklaces.js';

describe('TrackingUseCase FaceMesh result boundary', () => {
  it('writes every frame to realtime store without transitioning when status is unchanged', () => {
    const useCase = createFaceResultUseCase({
      sessionStatus: AR_SESSION_STATES.TRACKING,
    });
    const landmarks = [{ x: 0.45, y: 0.5 }];

    useCase.handleFaceResults({ multiFaceLandmarks: [landmarks] });

    expect(useCase.necklaceController.updateFromLandmarks).toHaveBeenCalledWith(landmarks, true);
    expect(useCase.calibrationUseCase.markFaceReady).toHaveBeenCalledTimes(1);
    expect(useCase.appState.transitionSession).not.toHaveBeenCalled();
    expect(useCase.rendererLoop.requestRender).toHaveBeenCalledTimes(1);
    expect(useCase.realtimeStore.getSnapshot()).toMatchObject({
      hasFace: true,
      latestLandmarks: landmarks,
      debugData: useCase.debugData,
      frameSequence: 1,
    });
  });

  it('transitions from tracking to noFace only when live face status changes', () => {
    const useCase = createFaceResultUseCase({
      sessionStatus: AR_SESSION_STATES.TRACKING,
    });

    useCase.handleFaceResults({ multiFaceLandmarks: [] });
    useCase.handleFaceResults({ multiFaceLandmarks: [] });

    expect(useCase.necklaceController.fadeOut).toHaveBeenCalledTimes(2);
    expect(useCase.appState.transitionSession).toHaveBeenCalledTimes(1);
    expect(useCase.appState.transitionSession).toHaveBeenCalledWith(
      AR_SESSION_STATES.NO_FACE,
      {},
      'face-results',
    );
    expect(useCase.realtimeStore.getSnapshot()).toMatchObject({
      hasFace: false,
      latestLandmarks: null,
      debugData: null,
      frameSequence: 2,
    });
  });

  it.each([AR_SESSION_STATES.CAPTURING, AR_SESSION_STATES.SHARING])(
    'keeps %s workflow status while still sampling realtime frames',
    (sessionStatus) => {
      const useCase = createFaceResultUseCase({ sessionStatus });
      const landmarks = [{ x: 0.48, y: 0.52 }];

      useCase.handleFaceResults({ multiFaceLandmarks: [landmarks] });

      expect(useCase.appState.transitionSession).not.toHaveBeenCalled();
      expect(useCase.realtimeStore.getSnapshot()).toMatchObject({
        hasFace: true,
        latestLandmarks: landmarks,
        frameSequence: 1,
      });
    },
  );

  it('fades out without marking calibration when a face is missing', () => {
    const useCase = createFaceResultUseCase({
      sessionStatus: AR_SESSION_STATES.NO_FACE,
    });

    useCase.handleFaceResults({ multiFaceLandmarks: [] });

    expect(useCase.necklaceController.fadeOut).toHaveBeenCalledTimes(1);
    expect(useCase.necklaceController.updateFromLandmarks).not.toHaveBeenCalled();
    expect(useCase.calibrationUseCase.markFaceReady).not.toHaveBeenCalled();
    expect(useCase.realtimeStore.getSnapshot()).toMatchObject({
      hasFace: false,
      latestLandmarks: null,
      debugData: null,
      frameSequence: 1,
    });
  });

  it('fades out when a face exists but the model is not loaded', () => {
    const useCase = createFaceResultUseCase({
      modelLoaded: false,
    });
    const landmarks = [{ x: 0.48, y: 0.52 }];

    useCase.handleFaceResults({ multiFaceLandmarks: [landmarks] });

    expect(useCase.necklaceController.fadeOut).toHaveBeenCalledTimes(1);
    expect(useCase.necklaceController.updateFromLandmarks).not.toHaveBeenCalled();
    expect(useCase.calibrationUseCase.markFaceReady).not.toHaveBeenCalled();
    expect(useCase.realtimeStore.getSnapshot()).toMatchObject({
      hasFace: true,
      latestLandmarks: landmarks,
      debugData: null,
      frameSequence: 1,
    });
  });
});

describe('TrackingUseCase feedback', () => {
  it('stores tracker stats and schedules feedback when debug is visible', () => {
    const useCase = createTrackingUseCase({
      mode: APP_MODES.AR,
      cameraStarted: true,
      debugEnabled: true,
    });
    vi.spyOn(useCase, 'scheduleFeedbackUpdate').mockImplementation(() => {});
    const stats = {
      currentFps: 18,
      targetFps: 20,
      averageInferenceMs: 24,
      slowFrameRatio: 0,
      fastFrameRatio: 1,
      schedulerType: 'raf',
    };

    useCase.handleFaceTrackerStats(stats);

    expect(useCase.realtimeStore.getSnapshot().trackerStats).toMatchObject(stats);
    expect(useCase.scheduleFeedbackUpdate).toHaveBeenCalledTimes(1);
  });

  it('updates tracking status and developer panel during feedback flush', () => {
    const useCase = createTrackingUseCase({
      mode: APP_MODES.AR,
      cameraStarted: true,
      debugEnabled: true,
    });

    useCase.flushFeedback(500);

    expect(useCase.feedbackService.createTrackingStatus).toHaveBeenCalledWith(
      useCase.getState(),
      useCase.realtimeStore.getSnapshot(),
    );
    expect(useCase.ui.setStatus).toHaveBeenCalledWith('tracking', '追蹤中', 'ok');
    expect(useCase.feedbackService.createDeveloperPanelModel).toHaveBeenCalledWith(
      useCase.getState(),
      useCase.realtimeStore.getSnapshot(),
    );
    expect(useCase.ui.updateDeveloperPanel).toHaveBeenCalledWith({ stats: { fps: 60 } });
    expect(useCase.lastTrackingFeedbackUpdateAt).toBe(500);
  });
});

function createFaceResultUseCase(overrides = {}) {
  const useCase = createTrackingUseCase({
    mode: APP_MODES.AR,
    cameraStarted: true,
    modelLoaded: true,
    necklaceVisible: true,
    sessionStatus: AR_SESSION_STATES.NO_FACE,
    selectedNecklace: NECKLACES[0],
    includeDebugData: true,
    ...overrides,
  });
  vi.spyOn(useCase, 'scheduleFeedbackUpdate').mockImplementation(() => {});
  return useCase;
}

function createTrackingUseCase(overrides = {}) {
  const { includeDebugData = false, ...stateOverrides } = overrides;
  let state = {
    mode: APP_MODES.SHOWCASE,
    sessionStatus: AR_SESSION_STATES.SHOWCASE,
    cameraStarted: false,
    cameraFacingMode: 'user',
    isSwitchingCamera: false,
    modelLoaded: false,
    necklaceVisible: true,
    debugEnabled: false,
    activePanel: 'styles',
    controlsCollapsed: true,
    selectedNecklace: NECKLACES[0],
    selectedColorId: '',
    selectedColorIdsByTarget: {},
    captureDataUrl: '',
    captureBlob: null,
    adjustments: {
      horizontalOffset: 0,
      verticalOffset: 0,
      scaleMultiplier: 1,
      rotationOffset: 0,
    },
    ...stateOverrides,
  };
  const debugData = { scale: 1.2, rotationY: 0.1 };
  const setState = (patch = {}) => {
    state = { ...state, ...patch };
    return state;
  };
  const useCase = new TrackingUseCase({
    appState: {
      transitionSession: vi.fn((nextStatus, patch = {}) => setState({ ...patch, sessionStatus: nextStatus })),
      set: vi.fn((patch) => setState(patch)),
      get: vi.fn((key) => state[key]),
      getSnapshot: vi.fn(() => state),
    },
    ui: {
      setStatus: vi.fn(),
      updateDeveloperPanel: vi.fn(),
    },
    realtimeStore: new RealtimeTrackingStore({ now: () => 100 }),
    necklaceController: {
      fadeOut: vi.fn(),
      updateFromLandmarks: vi.fn(() => (includeDebugData ? debugData : null)),
    },
    rendererLoop: {
      requestRender: vi.fn(),
    },
    feedbackService: {
      createTrackingStatus: vi.fn(() => ({ kind: 'tracking', label: '追蹤中', metrics: 'ok' })),
      createDeveloperPanelModel: vi.fn(() => ({ stats: { fps: 60 } })),
    },
    calibrationUseCase: {
      markFaceReady: vi.fn(),
    },
  });
  useCase.debugData = debugData;
  return useCase;
}
