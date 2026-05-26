import { describe, expect, it, vi } from 'vitest';
import { APP_MODES } from './AppState.js';
import { AppRuntimeController } from './AppRuntimeController.js';
import { RealtimeTrackingStore } from './RealtimeTrackingStore.js';
import { NECKLACES } from '../config/necklaces.js';

describe('AppRuntimeController runtime routing', () => {
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

  it('routes UI handlers to their use-cases', () => {
    const controller = createAppRuntimeController();
    vi.spyOn(controller.modeUseCase, 'selectMode').mockImplementation(() => {});
    vi.spyOn(controller.modeUseCase, 'selectControlPanel').mockImplementation(() => {});
    vi.spyOn(controller.modeUseCase, 'toggleBottomSheet').mockImplementation(() => {});
    vi.spyOn(controller.stageInteractionUseCase, 'handlePointerDown').mockImplementation(() => {});
    vi.spyOn(controller.cameraSessionUseCase, 'startExperience').mockResolvedValue();
    vi.spyOn(controller.shareUseCase, 'handleCapture').mockResolvedValue();

    const pointerEvent = { pointerId: 1, clientX: 100 };
    controller.selectMode(APP_MODES.AR);
    controller.selectControlPanel('fit');
    controller.toggleBottomSheet();
    controller.handleShowcasePointerDown(pointerEvent);
    void controller.startExperience();
    void controller.handleCapture();

    expect(controller.modeUseCase.selectMode).toHaveBeenCalledWith(APP_MODES.AR);
    expect(controller.modeUseCase.selectControlPanel).toHaveBeenCalledWith('fit');
    expect(controller.modeUseCase.toggleBottomSheet).toHaveBeenCalledTimes(1);
    expect(controller.stageInteractionUseCase.handlePointerDown).toHaveBeenCalledWith(pointerEvent);
    expect(controller.cameraSessionUseCase.startExperience).toHaveBeenCalledTimes(1);
    expect(controller.shareUseCase.handleCapture).toHaveBeenCalledTimes(1);
  });

  it('routes lifecycle methods to RuntimeLifecycleUseCase', () => {
    const controller = createAppRuntimeController();
    vi.spyOn(controller.lifecycleUseCase, 'init').mockImplementation(() => {});
    vi.spyOn(controller.lifecycleUseCase, 'destroy').mockImplementation(() => {});

    controller.init();
    controller.destroy();

    expect(controller.lifecycleUseCase.init).toHaveBeenCalledTimes(1);
    expect(controller.lifecycleUseCase.destroy).toHaveBeenCalledTimes(1);
    expect(controller.runtime.setRenderStatsUpdateHandler).toHaveBeenLastCalledWith(null);
  });

  it('forwards render stats notifications to tracking feedback scheduling', () => {
    const controller = createAppRuntimeController();
    vi.spyOn(controller, 'scheduleTrackingFeedbackUpdate').mockImplementation(() => {});

    controller.runtime.renderStatsUpdateHandler();

    expect(controller.scheduleTrackingFeedbackUpdate).toHaveBeenCalledTimes(1);
  });
});

function createAppRuntimeController(overrides = {}) {
  const state = {
    mode: APP_MODES.SHOWCASE,
    selectedNecklace: NECKLACES[0],
    selectedColorId: '',
    selectedColorIdsByTarget: {},
    adjustments: {
      horizontalOffset: 0,
      verticalOffset: 0,
      scaleMultiplier: 1,
      rotationOffset: 0,
    },
    ...overrides,
  };
  const realtimeStore = new RealtimeTrackingStore({ now: () => 100 });
  const uiRoot = {
    populateNecklaceSelect: vi.fn(),
    populateColorSwatches: vi.fn(),
    syncFromState: vi.fn(),
    canSelectControlPanel: vi.fn(() => true),
    closeShareSheet: vi.fn(),
    clearError: vi.fn(),
    showError: vi.fn(),
    setShowcaseDragging: vi.fn(),
    setCalibrationDragging: vi.fn(),
    syncTuningControlsFromAdjustments: vi.fn(),
    setCalibrationHint: vi.fn(),
    readTuningControls: vi.fn(() => ({ adjustments: {} })),
    setCameraOn: vi.fn(),
    setCaptureDisabled: vi.fn(),
    setCaptureBusy: vi.fn(),
    setStartButtonLabel: vi.fn(),
    setStatus: vi.fn(),
    setShareImage: vi.fn(),
    openShareSheet: vi.fn(),
    updateDeveloperPanel: vi.fn(),
    updateColorUiAvailability: vi.fn(),
    syncNecklaceSelection: vi.fn(),
    hasCurrentVideoFrame: vi.fn(() => true),
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
      updateFromLandmarks: vi.fn(() => null),
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
      buildColorUiModel: vi.fn(() => ({
        swatches: {
          necklace: state.selectedNecklace,
          selectedColorIdsByTarget: state.selectedColorIdsByTarget,
          fallbackColorId: state.selectedColorId,
          targetIds: [],
        },
        availability: {
          necklace: state.selectedNecklace,
          modelLoaded: false,
          hasColorableMaterials: false,
          targetLabels: [],
        },
      })),
      getColorableMaterialCount: vi.fn(() => 0),
    },
    calibrationService: {
      cancelDrag: vi.fn(),
      mergeAdjustments: vi.fn((current, next) => ({ ...current, ...next })),
      markFaceReady: vi.fn(() => null),
      load: vi.fn(() => ({ adjustments: state.adjustments, hint: null })),
    },
    shareWorkflow: {},
    feedbackService: {},
    renderStatsUpdateHandler: null,
    setRenderStatsUpdateHandler: vi.fn((handler) => {
      runtime.renderStatsUpdateHandler = handler;
    }),
  };

  return new AppRuntimeController({
    appState: {
      transitionSession: vi.fn(),
      set: vi.fn(),
      get: vi.fn((key) => state[key]),
      getSnapshot: vi.fn(() => state),
    },
    uiRoot,
    runtime,
  });
}
