import { describe, expect, it, vi } from 'vitest';
import { APP_MODES, AR_SESSION_STATES } from '../AppState.js';
import { ModeUseCase } from './ModeUseCase.js';
import { NECKLACES } from '../../config/necklaces.js';

describe('ModeUseCase mode and panel intents', () => {
  it('transitions from showcase to AR idle and resets showcase effects', () => {
    const useCase = createModeUseCase({
      mode: APP_MODES.SHOWCASE,
      sessionStatus: AR_SESSION_STATES.SHOWCASE,
      cameraStarted: false,
    });

    useCase.selectMode(APP_MODES.AR);

    expect(useCase.appState.transitionSession).toHaveBeenCalledWith(
      AR_SESSION_STATES.AR_IDLE,
      { mode: APP_MODES.AR },
      'mode-select',
    );
    expect(useCase.scene.setShowcaseMode).toHaveBeenCalledWith(false);
    expect(useCase.necklaceController.reset).toHaveBeenCalledTimes(2);
    expect(useCase.rendererLoop.requestRender).toHaveBeenCalledTimes(2);
    expect(useCase.preloadSessionService).toHaveBeenCalledTimes(1);
    expect(useCase.getState()).toMatchObject({
      mode: APP_MODES.AR,
      sessionStatus: AR_SESSION_STATES.AR_IDLE,
    });
  });

  it('stops the active camera session before returning from AR to showcase', () => {
    const useCase = createModeUseCase({
      mode: APP_MODES.AR,
      sessionStatus: AR_SESSION_STATES.TRACKING,
      cameraStarted: true,
    });

    useCase.selectMode(APP_MODES.SHOWCASE);

    expect(useCase.cameraSessionUseCase.stopCameraSession).toHaveBeenCalledWith({
      nextStatus: AR_SESSION_STATES.SHOWCASE,
      eventName: 'mode-camera-stop',
    });
    expect(useCase.appState.transitionSession).toHaveBeenCalledWith(
      AR_SESSION_STATES.SHOWCASE,
      { mode: APP_MODES.SHOWCASE },
      'mode-select',
    );
    expect(useCase.getState()).toMatchObject({
      mode: APP_MODES.SHOWCASE,
      sessionStatus: AR_SESSION_STATES.SHOWCASE,
    });
  });

  it('ignores invalid or unchanged modes', () => {
    const useCase = createModeUseCase({
      mode: APP_MODES.AR,
      sessionStatus: AR_SESSION_STATES.AR_IDLE,
    });

    useCase.selectMode('unknown-mode');
    useCase.selectMode(APP_MODES.AR);

    expect(useCase.appState.transitionSession).not.toHaveBeenCalled();
    expect(useCase.scene.setShowcaseMode).not.toHaveBeenCalled();
    expect(useCase.necklaceController.reset).not.toHaveBeenCalled();
    expect(useCase.rendererLoop.requestRender).not.toHaveBeenCalled();
  });

  it('returns the fit panel to styles when switching to non-AR mode', () => {
    const useCase = createModeUseCase({
      mode: APP_MODES.AR,
      sessionStatus: AR_SESSION_STATES.AR_IDLE,
      activePanel: 'fit',
    });

    useCase.selectMode(APP_MODES.SHOWCASE);

    expect(useCase.appState.transitionSession).toHaveBeenCalledWith(
      AR_SESSION_STATES.SHOWCASE,
      {
        mode: APP_MODES.SHOWCASE,
        activePanel: 'styles',
      },
      'mode-select',
    );
    expect(useCase.getState().activePanel).toBe('styles');
  });

  it('ignores missing or unavailable control panels', () => {
    const useCase = createModeUseCase({ activePanel: 'styles' });
    useCase.ui.canSelectControlPanel.mockReturnValue(false);

    useCase.selectControlPanel();
    useCase.selectControlPanel('fit');

    expect(useCase.ui.canSelectControlPanel).toHaveBeenCalledTimes(1);
    expect(useCase.appState.set).not.toHaveBeenCalled();
    expect(useCase.getState().activePanel).toBe('styles');
  });

  it('writes valid control panel selection to app state', () => {
    const useCase = createModeUseCase({ activePanel: 'styles' });

    useCase.selectControlPanel('fit');

    expect(useCase.ui.canSelectControlPanel).toHaveBeenCalledWith('fit');
    expect(useCase.appState.set).toHaveBeenCalledWith({ activePanel: 'fit' }, 'panel-select');
    expect(useCase.getState().activePanel).toBe('fit');
  });

  it('toggles bottom sheet collapsed state through app state dispatch', () => {
    const useCase = createModeUseCase({ controlsCollapsed: true });

    useCase.toggleBottomSheet();
    useCase.toggleBottomSheet();

    expect(useCase.appState.set).toHaveBeenCalledTimes(2);
    expect(useCase.appState.set).toHaveBeenNthCalledWith(
      1,
      { controlsCollapsed: false },
      'bottom-sheet-toggle',
    );
    expect(useCase.appState.set).toHaveBeenNthCalledWith(
      2,
      { controlsCollapsed: true },
      'bottom-sheet-toggle',
    );
    expect(useCase.getState().controlsCollapsed).toBe(true);
  });
});

describe('ModeUseCase UI toggles', () => {
  it('syncs debug toggle to state, overlay, developer panel, and tracking status', () => {
    const useCase = createModeUseCase({
      mode: APP_MODES.AR,
      debugEnabled: false,
    });

    useCase.handleDebugToggle(true);

    expect(useCase.appState.set).toHaveBeenCalledWith({ debugEnabled: true }, 'debug-toggle');
    expect(useCase.debugOverlay.setEnabled).toHaveBeenCalledWith(true);
    expect(useCase.trackingUseCase.updateDeveloperPanel).toHaveBeenCalledTimes(1);
    expect(useCase.trackingUseCase.updateTrackingStatus).toHaveBeenCalledTimes(1);
    expect(useCase.getState().debugEnabled).toBe(true);
  });

  it('fades out the necklace and requests a render when necklace visibility is disabled', () => {
    const useCase = createModeUseCase({ necklaceVisible: true });

    useCase.handleNecklaceToggle(false);

    expect(useCase.appState.set).toHaveBeenCalledWith({ necklaceVisible: false }, 'necklace-toggle');
    expect(useCase.necklaceController.fadeOut).toHaveBeenCalledTimes(1);
    expect(useCase.rendererLoop.requestRender).toHaveBeenCalledTimes(1);
    expect(useCase.getState().necklaceVisible).toBe(false);
  });
});

function createModeUseCase(overrides = {}) {
  let state = {
    mode: APP_MODES.SHOWCASE,
    sessionStatus: AR_SESSION_STATES.SHOWCASE,
    cameraStarted: false,
    cameraFacingMode: 'user',
    isSwitchingCamera: false,
    modelLoaded: true,
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
  const setState = (patch = {}) => {
    state = { ...state, ...patch };
    return state;
  };

  return new ModeUseCase({
    appState: {
      transitionSession: vi.fn((nextStatus, patch = {}) => setState({ ...patch, sessionStatus: nextStatus })),
      set: vi.fn((patch) => setState(patch)),
      get: vi.fn((key) => state[key]),
      getSnapshot: vi.fn(() => state),
    },
    ui: {
      canSelectControlPanel: vi.fn(() => true),
      setStatus: vi.fn(),
    },
    scene: {
      setShowcaseMode: vi.fn(),
    },
    debugOverlay: {
      setEnabled: vi.fn(),
    },
    necklaceController: {
      fadeOut: vi.fn(),
      reset: vi.fn(),
    },
    rendererLoop: {
      requestRender: vi.fn(),
    },
    cameraSessionUseCase: {
      stopCameraSession: vi.fn((options = {}) => {
        setState({
          cameraStarted: false,
          isSwitchingCamera: false,
          sessionStatus: options.nextStatus ?? AR_SESSION_STATES.AR_IDLE,
        });
      }),
    },
    trackingUseCase: {
      updateDeveloperPanel: vi.fn(),
      updateTrackingStatus: vi.fn(),
    },
    preloadSessionService: vi.fn(() => Promise.resolve(null)),
  });
}
