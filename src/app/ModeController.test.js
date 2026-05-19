import { describe, expect, it, vi } from 'vitest';
import { APP_MODES, AR_SESSION_STATES } from './AppState.js';
import { ModeController } from './ModeController.js';
import { RealtimeTrackingStore } from './RealtimeTrackingStore.js';
import { NECKLACES } from '../config/necklaces.js';

describe('ModeController runtime injection', () => {
  it('keeps public handlers available while using injected runtime ports', () => {
    const controller = createModeController();

    [
      'init',
      'selectMode',
      'selectControlPanel',
      'toggleBottomSheet',
      'startExperience',
      'switchCamera',
      'stopExperience',
      'handleCapture',
      'selectNecklace',
      'selectColor',
      'handleDebugToggle',
      'handleNecklaceToggle',
      'updateTuningFromControls',
      'saveCalibration',
      'resetCalibration',
      'downloadCapture',
      'shareCapture',
      'closeShareSheet',
    ].forEach((methodName) => {
      expect(controller[methodName]).toBeTypeOf('function');
    });

    expect(controller.runtime.setRenderStatsUpdateHandler).toHaveBeenCalledTimes(1);
  });
});

describe('ModeController mode and panel intents', () => {
  it('transitions from showcase to AR idle and resets showcase effects', () => {
    const controller = createModeController({
      mode: APP_MODES.SHOWCASE,
      sessionStatus: AR_SESSION_STATES.SHOWCASE,
      cameraStarted: false,
    });

    controller.selectMode(APP_MODES.AR);

    expect(controller.appState.transitionSession).toHaveBeenCalledWith(
      AR_SESSION_STATES.AR_IDLE,
      { mode: APP_MODES.AR },
      'mode-select',
    );
    expect(controller.scene.setShowcaseMode).toHaveBeenCalledWith(false);
    expect(controller.controller.reset).toHaveBeenCalledTimes(1);
    expect(controller.rendererLoop.requestRender).toHaveBeenCalledTimes(1);
    expect(controller.syncModeEffects).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toMatchObject({
      mode: APP_MODES.AR,
      sessionStatus: AR_SESSION_STATES.AR_IDLE,
    });
  });

  it('stops the active camera session before returning from AR to showcase', () => {
    const controller = createModeController({
      mode: APP_MODES.AR,
      sessionStatus: AR_SESSION_STATES.TRACKING,
      cameraStarted: true,
    });

    controller.selectMode(APP_MODES.SHOWCASE);

    expect(controller.sessionService.stop).toHaveBeenCalledTimes(1);
    expect(controller.realtimeStore.getSnapshot()).toMatchObject({
      hasFace: false,
      latestLandmarks: null,
    });
    expect(controller.ui.setCameraOn).toHaveBeenCalledWith(false);
    expect(controller.ui.setCaptureDisabled).toHaveBeenCalledWith(true);
    expect(controller.appState.transitionSession).toHaveBeenNthCalledWith(
      1,
      AR_SESSION_STATES.SHOWCASE,
      {
        cameraStarted: false,
        isSwitchingCamera: false,
      },
      'mode-camera-stop',
    );
    expect(controller.appState.transitionSession).toHaveBeenNthCalledWith(
      2,
      AR_SESSION_STATES.SHOWCASE,
      { mode: APP_MODES.SHOWCASE },
      'mode-select',
    );
    expect(controller.getState()).toMatchObject({
      mode: APP_MODES.SHOWCASE,
      sessionStatus: AR_SESSION_STATES.SHOWCASE,
      cameraStarted: false,
    });
  });

  it('ignores invalid or unchanged modes', () => {
    const controller = createModeController({
      mode: APP_MODES.AR,
      sessionStatus: AR_SESSION_STATES.AR_IDLE,
    });

    controller.selectMode('unknown-mode');
    controller.selectMode(APP_MODES.AR);

    expect(controller.appState.transitionSession).not.toHaveBeenCalled();
    expect(controller.scene.setShowcaseMode).not.toHaveBeenCalled();
    expect(controller.controller.reset).not.toHaveBeenCalled();
    expect(controller.rendererLoop.requestRender).not.toHaveBeenCalled();
    expect(controller.syncModeEffects).not.toHaveBeenCalled();
  });

  it('returns the fit panel to styles when switching to non-AR mode', () => {
    const controller = createModeController({
      mode: APP_MODES.AR,
      sessionStatus: AR_SESSION_STATES.AR_IDLE,
      activePanel: 'fit',
    });

    controller.selectMode(APP_MODES.SHOWCASE);

    expect(controller.appState.transitionSession).toHaveBeenCalledWith(
      AR_SESSION_STATES.SHOWCASE,
      {
        mode: APP_MODES.SHOWCASE,
        activePanel: 'styles',
      },
      'mode-select',
    );
    expect(controller.getState().activePanel).toBe('styles');
  });

  it('ignores missing or unavailable control panels', () => {
    const controller = createModeController({ activePanel: 'styles' });
    controller.ui.canSelectControlPanel.mockReturnValue(false);

    controller.selectControlPanel();
    controller.selectControlPanel('fit');

    expect(controller.ui.canSelectControlPanel).toHaveBeenCalledTimes(1);
    expect(controller.appState.set).not.toHaveBeenCalled();
    expect(controller.getState().activePanel).toBe('styles');
  });

  it('writes valid control panel selection to app state', () => {
    const controller = createModeController({ activePanel: 'styles' });

    controller.selectControlPanel('fit');

    expect(controller.ui.canSelectControlPanel).toHaveBeenCalledWith('fit');
    expect(controller.appState.set).toHaveBeenCalledWith({ activePanel: 'fit' }, 'panel-select');
    expect(controller.getState().activePanel).toBe('fit');
  });

  it('toggles bottom sheet collapsed state through app state dispatch', () => {
    const controller = createModeController({ controlsCollapsed: true });

    controller.toggleBottomSheet();
    controller.toggleBottomSheet();

    expect(controller.appState.set).toHaveBeenCalledTimes(2);
    expect(controller.appState.set).toHaveBeenNthCalledWith(
      1,
      { controlsCollapsed: false },
      'bottom-sheet-toggle',
    );
    expect(controller.appState.set).toHaveBeenNthCalledWith(
      2,
      { controlsCollapsed: true },
      'bottom-sheet-toggle',
    );
    expect(controller.getState().controlsCollapsed).toBe(true);
  });
});

describe('ModeController UI toggles and share sheet', () => {
  it('syncs debug toggle to state, overlay, developer panel, and tracking status', () => {
    const controller = createModeController({
      mode: APP_MODES.AR,
      debugEnabled: false,
    });

    controller.handleDebugToggle(true);

    expect(controller.appState.set).toHaveBeenCalledWith({ debugEnabled: true }, 'debug-toggle');
    expect(controller.debugOverlay.setEnabled).toHaveBeenCalledWith(true);
    expect(controller.updateDeveloperPanel).toHaveBeenCalledTimes(1);
    expect(controller.updateTrackingStatus).toHaveBeenCalledTimes(1);
    expect(controller.getState().debugEnabled).toBe(true);
  });

  it('fades out the necklace and requests a render when necklace visibility is disabled', () => {
    const controller = createModeController({ necklaceVisible: true });

    controller.handleNecklaceToggle(false);

    expect(controller.appState.set).toHaveBeenCalledWith({ necklaceVisible: false }, 'necklace-toggle');
    expect(controller.controller.fadeOut).toHaveBeenCalledTimes(1);
    expect(controller.rendererLoop.requestRender).toHaveBeenCalledTimes(1);
    expect(controller.getState().necklaceVisible).toBe(false);
  });

  it('closes share UI and returns sharing sessions to tracking when a live face exists', () => {
    const controller = createModeController({
      sessionStatus: AR_SESSION_STATES.SHARING,
      cameraStarted: true,
    });
    const landmarks = [{ x: 0.4, y: 0.5 }];
    controller.realtimeStore.updateFrame({ landmarks, hasFace: true, debugData: null });

    controller.closeShareSheet();

    expect(controller.ui.closeShareSheet).toHaveBeenCalledTimes(1);
    expect(controller.appState.transitionSession).toHaveBeenCalledWith(
      AR_SESSION_STATES.TRACKING,
      {},
      'share-close',
    );
  });

  it('closes share UI and returns sharing sessions to noFace when live face is absent', () => {
    const controller = createModeController({
      sessionStatus: AR_SESSION_STATES.SHARING,
      cameraStarted: true,
    });

    controller.closeShareSheet();

    expect(controller.ui.closeShareSheet).toHaveBeenCalledTimes(1);
    expect(controller.appState.transitionSession).toHaveBeenCalledWith(
      AR_SESSION_STATES.NO_FACE,
      {},
      'share-close',
    );
  });

  it('does not transition session status when closing a non-sharing share sheet', () => {
    const controller = createModeController({
      sessionStatus: AR_SESSION_STATES.TRACKING,
      cameraStarted: true,
    });

    controller.closeShareSheet();

    expect(controller.ui.closeShareSheet).toHaveBeenCalledTimes(1);
    expect(controller.appState.transitionSession).not.toHaveBeenCalled();
  });
});

describe('ModeController FaceMesh result boundary', () => {
  it('writes every frame to realtime store without transitioning when status is unchanged', () => {
    const controller = createFaceResultController({
      sessionStatus: AR_SESSION_STATES.TRACKING,
    });
    const landmarks = [{ x: 0.45, y: 0.5 }];

    controller.handleFaceResults({ multiFaceLandmarks: [landmarks] });

    expect(controller.controller.updateFromLandmarks).toHaveBeenCalledWith(landmarks, true);
    expect(controller.markCalibrationReady).toHaveBeenCalledTimes(1);
    expect(controller.appState.transitionSession).not.toHaveBeenCalled();
    expect(controller.rendererLoop.requestRender).toHaveBeenCalledTimes(1);
    expect(controller.realtimeStore.getSnapshot()).toMatchObject({
      hasFace: true,
      latestLandmarks: landmarks,
      debugData: controller.debugData,
      frameSequence: 1,
    });
  });

  it('transitions from tracking to noFace only when live face status changes', () => {
    const controller = createFaceResultController({
      sessionStatus: AR_SESSION_STATES.TRACKING,
    });

    controller.handleFaceResults({ multiFaceLandmarks: [] });
    controller.handleFaceResults({ multiFaceLandmarks: [] });

    expect(controller.controller.fadeOut).toHaveBeenCalledTimes(2);
    expect(controller.appState.transitionSession).toHaveBeenCalledTimes(1);
    expect(controller.appState.transitionSession).toHaveBeenCalledWith(
      AR_SESSION_STATES.NO_FACE,
      {},
      'face-results',
    );
    expect(controller.realtimeStore.getSnapshot()).toMatchObject({
      hasFace: false,
      latestLandmarks: null,
      debugData: null,
      frameSequence: 2,
    });
  });

  it.each([AR_SESSION_STATES.CAPTURING, AR_SESSION_STATES.SHARING])(
    'keeps %s workflow status while still sampling realtime frames',
    (sessionStatus) => {
      const controller = createFaceResultController({ sessionStatus });
      const landmarks = [{ x: 0.48, y: 0.52 }];

      controller.handleFaceResults({ multiFaceLandmarks: [landmarks] });

      expect(controller.appState.transitionSession).not.toHaveBeenCalled();
      expect(controller.realtimeStore.getSnapshot()).toMatchObject({
        hasFace: true,
        latestLandmarks: landmarks,
        frameSequence: 1,
      });
    },
  );

  it('fades out without marking calibration when a face is missing', () => {
    const controller = createFaceResultController({
      sessionStatus: AR_SESSION_STATES.NO_FACE,
    });

    controller.handleFaceResults({ multiFaceLandmarks: [] });

    expect(controller.controller.fadeOut).toHaveBeenCalledTimes(1);
    expect(controller.controller.updateFromLandmarks).not.toHaveBeenCalled();
    expect(controller.markCalibrationReady).not.toHaveBeenCalled();
    expect(controller.realtimeStore.getSnapshot()).toMatchObject({
      hasFace: false,
      latestLandmarks: null,
      debugData: null,
      frameSequence: 1,
    });
  });

  it('fades out when a face exists but the model is not loaded', () => {
    const controller = createFaceResultController({
      modelLoaded: false,
    });
    const landmarks = [{ x: 0.48, y: 0.52 }];

    controller.handleFaceResults({ multiFaceLandmarks: [landmarks] });

    expect(controller.controller.fadeOut).toHaveBeenCalledTimes(1);
    expect(controller.controller.updateFromLandmarks).not.toHaveBeenCalled();
    expect(controller.markCalibrationReady).not.toHaveBeenCalled();
    expect(controller.realtimeStore.getSnapshot()).toMatchObject({
      hasFace: true,
      latestLandmarks: landmarks,
      debugData: null,
      frameSequence: 1,
    });
  });
});

function createFaceResultController(overrides = {}) {
  return createModeController(
    {
      mode: APP_MODES.AR,
      cameraStarted: true,
      modelLoaded: true,
      necklaceVisible: true,
      sessionStatus: AR_SESSION_STATES.NO_FACE,
      selectedNecklace: NECKLACES[0],
      ...overrides,
    },
    { includeDebugData: true },
  );
}

function createModeController(overrides = {}, options = {}) {
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
    ...overrides,
  };
  const debugData = { scale: 1.2, rotationY: 0.1 };
  const setState = (patch = {}) => {
    if (!patch) return state;
    state = { ...state, ...patch };
    return state;
  };
  const realtimeStore = new RealtimeTrackingStore({ now: () => 100 });
  const uiController = {
    canSelectControlPanel: vi.fn(() => true),
    closeShareSheet: vi.fn(),
    setCalibrationDragging: vi.fn(),
    setCameraOn: vi.fn(),
    setCaptureDisabled: vi.fn(),
    setStartButtonLabel: vi.fn(),
    elements: {
      stage: {},
      video: {},
      threeCanvas: {
        setPointerCapture: vi.fn(),
        releasePointerCapture: vi.fn(),
      },
      debugCanvas: {},
      startButton: { disabled: false },
      switchCameraButton: { disabled: false },
      stopCameraButton: { disabled: false },
    },
  };
  const runtime = {
    debugData,
    realtimeStore,
    scene: {
      setShowcaseMode: vi.fn(),
      beginShowcaseDrag: vi.fn(),
      dragShowcase: vi.fn(),
      endShowcaseDrag: vi.fn(),
      resize: vi.fn(),
    },
    necklaceController: {
      fadeOut: vi.fn(),
      reset: vi.fn(),
      updateFromLandmarks: vi.fn(() => (options.includeDebugData ? debugData : null)),
      setAdjustments: vi.fn(),
    },
    debugOverlay: {
      setEnabled: vi.fn(),
      resize: vi.fn(),
    },
    rendererLoop: {
      start: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      requestRender: vi.fn(),
    },
    modelCatalog: {
      getById: vi.fn(() => null),
      buildColorUiModel: vi.fn(),
      getColorableMaterialCount: vi.fn(() => 0),
    },
    calibrationService: {
      cancelDrag: vi.fn(),
      markFaceReady: vi.fn(() => null),
    },
    shareWorkflow: {},
    feedbackService: {},
    renderStatsUpdateHandler: null,
    setRenderStatsUpdateHandler: vi.fn((handler) => {
      runtime.renderStatsUpdateHandler = handler;
    }),
  };

  const controller = new ModeController({
    appState: {
      transitionSession: vi.fn((nextStatus, patch = {}) => setState({ ...patch, sessionStatus: nextStatus })),
      set: vi.fn((patch) => setState(patch)),
      update: vi.fn((updater) => setState(updater({ ...state }))),
      get: vi.fn((key) => state[key]),
      getSnapshot: vi.fn(() => state),
    },
    uiController,
    runtime,
  });

  controller.debugData = debugData;
  controller.runtime = runtime;
  controller.sessionService = {
    stop: vi.fn(),
  };
  vi.spyOn(controller, 'updateDeveloperPanel').mockImplementation(() => {});
  vi.spyOn(controller, 'updateTrackingStatus').mockImplementation(() => {});
  vi.spyOn(controller, 'syncModeEffects').mockImplementation(() => {});
  vi.spyOn(controller, 'scheduleTrackingFeedbackUpdate').mockImplementation(() => {});
  vi.spyOn(controller, 'markCalibrationReady').mockImplementation(() => {});

  return controller;
}
