import { describe, expect, it, vi } from 'vitest';
import { APP_MODES, AR_SESSION_STATES } from './AppState.js';
import { AppRuntimeController } from './AppRuntimeController.js';
import { RealtimeTrackingStore } from './RealtimeTrackingStore.js';
import { NECKLACES } from '../config/necklaces.js';

describe('AppRuntimeController runtime injection', () => {
  it('keeps public handlers available while using injected runtime ports', () => {
    const controller = createAppRuntimeController();

    [
      'init',
      'destroy',
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

describe('AppRuntimeController mode and panel intents', () => {
  it('transitions from showcase to AR idle and resets showcase effects', () => {
    const controller = createAppRuntimeController({
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
    const controller = createAppRuntimeController({
      mode: APP_MODES.AR,
      sessionStatus: AR_SESSION_STATES.TRACKING,
      cameraStarted: true,
    });

    controller.selectMode(APP_MODES.SHOWCASE);

    expect(controller.cameraSessionUseCase.sessionService.stop).toHaveBeenCalledTimes(1);
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
    const controller = createAppRuntimeController({
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
    const controller = createAppRuntimeController({
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
    const controller = createAppRuntimeController({ activePanel: 'styles' });
    controller.ui.canSelectControlPanel.mockReturnValue(false);

    controller.selectControlPanel();
    controller.selectControlPanel('fit');

    expect(controller.ui.canSelectControlPanel).toHaveBeenCalledTimes(1);
    expect(controller.appState.set).not.toHaveBeenCalled();
    expect(controller.getState().activePanel).toBe('styles');
  });

  it('writes valid control panel selection to app state', () => {
    const controller = createAppRuntimeController({ activePanel: 'styles' });

    controller.selectControlPanel('fit');

    expect(controller.ui.canSelectControlPanel).toHaveBeenCalledWith('fit');
    expect(controller.appState.set).toHaveBeenCalledWith({ activePanel: 'fit' }, 'panel-select');
    expect(controller.getState().activePanel).toBe('fit');
  });

  it('toggles bottom sheet collapsed state through app state dispatch', () => {
    const controller = createAppRuntimeController({ controlsCollapsed: true });

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

describe('AppRuntimeController UI toggles', () => {
  it('syncs debug toggle to state, overlay, developer panel, and tracking status', () => {
    const controller = createAppRuntimeController({
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
    const controller = createAppRuntimeController({ necklaceVisible: true });

    controller.handleNecklaceToggle(false);

    expect(controller.appState.set).toHaveBeenCalledWith({ necklaceVisible: false }, 'necklace-toggle');
    expect(controller.controller.fadeOut).toHaveBeenCalledTimes(1);
    expect(controller.rendererLoop.requestRender).toHaveBeenCalledTimes(1);
    expect(controller.getState().necklaceVisible).toBe(false);
  });

});

function createAppRuntimeController(overrides = {}, options = {}) {
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
  const uiRoot = {
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

  const controller = new AppRuntimeController({
    appState: {
      transitionSession: vi.fn((nextStatus, patch = {}) => setState({ ...patch, sessionStatus: nextStatus })),
      set: vi.fn((patch) => setState(patch)),
      update: vi.fn((updater) => setState(updater({ ...state }))),
      get: vi.fn((key) => state[key]),
      getSnapshot: vi.fn(() => state),
    },
    uiRoot,
    runtime,
  });

  controller.debugData = debugData;
  controller.runtime = runtime;
  controller.cameraSessionUseCase.sessionService = {
    stop: vi.fn(),
  };
  vi.spyOn(controller, 'updateDeveloperPanel').mockImplementation(() => {});
  vi.spyOn(controller, 'updateTrackingStatus').mockImplementation(() => {});
  vi.spyOn(controller, 'syncModeEffects').mockImplementation(() => {});
  vi.spyOn(controller, 'scheduleTrackingFeedbackUpdate').mockImplementation(() => {});
  vi.spyOn(controller, 'markCalibrationReady').mockImplementation(() => {});

  return controller;
}
