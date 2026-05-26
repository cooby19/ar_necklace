import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_MODES, createDefaultColorSelection } from './AppState.js';
import { AppRuntimeController } from './AppRuntimeController.js';
import { RealtimeTrackingStore } from './RealtimeTrackingStore.js';
import { NECKLACES } from '../config/necklaces.js';

beforeEach(() => {
  vi.stubGlobal('document', {
    hidden: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal('window', {
    location: {
      hash: '',
      pathname: '/',
      search: '',
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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
      'applyUrlState',
      'applyPendingUrlColors',
      'isApplyingUrlState',
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

  it('initializes UI, model loading, page lifecycle, render loop, preload, and router', async () => {
    vi.useFakeTimers();
    const controller = createAppRuntimeController();
    vi.spyOn(controller.calibrationUseCase, 'applyCalibrationForSelectedNecklace');
    vi.spyOn(controller.modelUseCase, 'syncColorAvailability');
    vi.spyOn(controller.modeUseCase, 'syncModeEffects');
    vi.spyOn(controller.cameraSessionUseCase, 'preloadSessionService').mockResolvedValue(null);

    controller.init();
    await flushPromises();

    expect(controller.ui.populateNecklaceSelect).toHaveBeenCalledWith(NECKLACES[0].id);
    expect(controller.ui.populateColorSwatches).toHaveBeenCalledWith(
      expect.objectContaining({
        necklace: NECKLACES[0],
      }),
    );
    expect(controller.ui.syncFromState).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedNecklace: NECKLACES[0],
        modelLoaded: false,
      }),
    );
    expect(controller.calibrationUseCase.applyCalibrationForSelectedNecklace).toHaveBeenCalledTimes(1);
    expect(controller.modelUseCase.syncColorAvailability).toHaveBeenCalledTimes(3);
    expect(controller.modeUseCase.syncModeEffects).toHaveBeenCalledTimes(2);
    expect(controller.modelCatalog.load).toHaveBeenCalledTimes(1);
    expect(controller.rendererLoop.start).toHaveBeenCalledTimes(1);
    expect(window.addEventListener).toHaveBeenCalledWith('hashchange', expect.any(Function));

    await vi.runOnlyPendingTimersAsync();

    expect(controller.cameraSessionUseCase.preloadSessionService).toHaveBeenCalledTimes(1);
  });

  it('destroys through RuntimeLifecycleUseCase and clears render stats handler', () => {
    const controller = createAppRuntimeController();
    vi.spyOn(controller.lifecycleUseCase, 'destroy').mockImplementation(() => {});

    controller.destroy();

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

describe('AppRuntimeController URL hydration', () => {
  it('hydrates a valid initial hash once and loads the selected model once', async () => {
    const controller = createAppRuntimeController({
      hash: '#n=crystal-cone-necklace&c.metal=citrine&c.gem=amethyst',
      targetIds: ['metal', 'gem'],
    });

    controller.init();
    await flushPromises();

    const hydrateCalls = controller.appState.set.mock.calls.filter((call) => call[1] === 'url-hydrate');
    expect(hydrateCalls).toHaveLength(1);
    expect(hydrateCalls[0][0]).toMatchObject({
      selectedNecklace: NECKLACES[1],
      selectedColorIdsByTarget: {
        metal: 'citrine',
        gem: 'amethyst',
      },
    });
    expect(controller.modelCatalog.load).toHaveBeenCalledTimes(1);
    expect(controller.modelCatalog.load).toHaveBeenCalledWith(NECKLACES[1]);
  });

  it('applies pending URL colors to loaded colorable targets', () => {
    const controller = createAppRuntimeController({
      stateOverrides: {
        selectedNecklace: NECKLACES[1],
        modelLoaded: true,
      },
      targetIds: ['metal', 'gem'],
    });
    vi.spyOn(controller, 'selectColor').mockImplementation(() => {});
    controller._pendingUrlState = {
      necklaceId: 'crystal-cone-necklace',
      colorByTarget: {
        metal: 'citrine',
        gem: 'amethyst',
      },
      colorFallback: null,
    };

    controller.applyPendingUrlColors();

    expect(controller.selectColor).toHaveBeenCalledWith('citrine', 'metal');
    expect(controller.selectColor).toHaveBeenCalledWith('amethyst', 'gem');
    expect(controller._pendingUrlState).toBeNull();
  });

  it('uses fallback color for targets without an explicit URL color', () => {
    const controller = createAppRuntimeController({
      stateOverrides: {
        selectedNecklace: NECKLACES[1],
        modelLoaded: true,
      },
      targetIds: ['metal', 'gem'],
    });
    vi.spyOn(controller, 'selectColor').mockImplementation(() => {});
    controller._pendingUrlState = {
      necklaceId: 'crystal-cone-necklace',
      colorByTarget: {
        gem: 'amethyst',
      },
      colorFallback: 'citrine',
    };

    controller.applyPendingUrlColors();

    expect(controller.selectColor).toHaveBeenCalledWith('citrine', 'metal');
    expect(controller.selectColor).toHaveBeenCalledWith('amethyst', 'gem');
  });

  it('silently ignores unknown necklace ids and unknown color ids', async () => {
    expect(() => {
      createAppRuntimeController({ hash: '#n=missing-necklace&c.gem=not-real' }).init();
    }).not.toThrow();

    const controller = createAppRuntimeController({
      hash: '#n=crystal-cone-necklace&c.gem=not-real',
      targetIds: ['gem'],
    });

    controller.init();
    await flushPromises();

    const hydrateCall = controller.appState.set.mock.calls.find((call) => call[1] === 'url-hydrate');
    expect(hydrateCall[0].selectedColorIdsByTarget.gem).toBe('rose-quartz');
    expect(controller.modelCatalog.createColorSelection).not.toHaveBeenCalledWith(
      expect.anything(),
      'not-real',
      expect.anything(),
    );
  });

  it('does not reload the model when hash changes for the current necklace', async () => {
    const controller = createAppRuntimeController({
      stateOverrides: {
        selectedNecklace: NECKLACES[1],
        modelLoaded: true,
      },
      targetIds: ['gem'],
    });

    await controller.applyUrlState({
      necklaceId: 'crystal-cone-necklace',
      colorByTarget: {
        gem: 'amethyst',
      },
      colorFallback: null,
    });

    expect(controller.modelCatalog.load).not.toHaveBeenCalled();
    expect(controller.modelCatalog.createColorSelection).toHaveBeenCalledWith(
      expect.anything(),
      'amethyst',
      'gem',
    );
  });

  it('keeps state-to-URL sync suppressed while applying URL state', async () => {
    const replaceState = vi.fn();
    const controller = createAppRuntimeController({
      targetIds: ['gem'],
      onSet: (_snapshot, meta) => {
        if (shouldWriteUrl(meta.changes) && !controller.isApplyingUrlState()) {
          replaceState();
        }
      },
    });

    await controller.applyUrlState({
      necklaceId: 'crystal-cone-necklace',
      colorByTarget: {
        gem: 'amethyst',
      },
      colorFallback: null,
    });

    expect(replaceState).not.toHaveBeenCalled();
  });
});

function createAppRuntimeController({ hash = '', targetIds = ['gem'], stateOverrides = {}, onSet, runtimeOverrides = {} } = {}) {
  window.location.hash = hash;
  let state = {
    mode: APP_MODES.SHOWCASE,
    cameraStarted: false,
    modelLoaded: false,
    selectedNecklace: NECKLACES[0],
    selectedColorId: NECKLACES[0].colorCustomization.defaultColor,
    selectedColorIdsByTarget: createDefaultColorSelection(NECKLACES[0]),
    adjustments: {
      horizontalOffset: 0,
      verticalOffset: 0,
      scaleMultiplier: 1,
      rotationOffset: 0,
    },
    ...stateOverrides,
  };
  state = {
    ...state,
    selectedColorIdsByTarget:
      stateOverrides.selectedColorIdsByTarget ?? createDefaultColorSelection(state.selectedNecklace),
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
  const modelCatalog = createModelCatalogDouble({
    getState: () => state,
    targetIds,
  });
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
    modelCatalog,
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
    ...runtimeOverrides,
  };
  const appState = {
    transitionSession: vi.fn(),
    set: vi.fn((patch, eventName = 'set') => {
      const previous = state;
      state = {
        ...state,
        ...patch,
        selectedColorIdsByTarget: patch?.selectedColorIdsByTarget
          ? { ...patch.selectedColorIdsByTarget }
          : state.selectedColorIdsByTarget,
        adjustments: patch?.adjustments ? { ...state.adjustments, ...patch.adjustments } : state.adjustments,
      };
      const snapshot = createSnapshot(state);
      onSet?.(snapshot, {
        previous,
        changes: Object.keys(patch ?? {}),
        eventName,
      });
      return snapshot;
    }),
    get: vi.fn((key) => state[key]),
    getSnapshot: vi.fn(() => createSnapshot(state)),
  };

  return new AppRuntimeController({
    appState,
    uiRoot,
    runtime,
  });
}

function createModelCatalogDouble({ getState, targetIds }) {
  return {
    getById: vi.fn((necklaceId) => NECKLACES.find((necklace) => necklace.id === necklaceId) ?? null),
    createSelectionPatch: vi.fn((necklace) => ({
      selectedNecklace: necklace,
      selectedColorId: necklace.colorCustomization?.defaultColor ?? '',
      selectedColorIdsByTarget: createDefaultColorSelection(necklace),
    })),
    createColorSelection: vi.fn((state, colorId, targetId) => {
      const colorOption = state.selectedNecklace.colorCustomization?.palette?.find((color) => color.id === colorId);
      if (!colorOption || !targetId || !targetIds.includes(targetId)) return null;

      return {
        patch: {
          selectedColorId: colorOption.id,
          selectedColorIdsByTarget: {
            ...state.selectedColorIdsByTarget,
            [targetId]: colorOption.id,
          },
        },
        targetIds: [targetId],
      };
    }),
    load: vi.fn(async (necklace) => ({
      status: 'loaded',
      necklace,
      targetIds,
      hasColorableMaterials: targetIds.length > 0,
      materialHitCount: targetIds.length,
    })),
    ensureColorSelectionForMatchedTargets: vi.fn(() => null),
    applySelectedColors: vi.fn(),
    buildColorUiModel: vi.fn(() => {
      const state = getState();
      return {
        swatches: {
          necklace: state.selectedNecklace,
          selectedColorIdsByTarget: state.selectedColorIdsByTarget,
          fallbackColorId: state.selectedColorId,
          targetIds: state.modelLoaded ? targetIds : [],
        },
        availability: {
          necklace: state.selectedNecklace,
          modelLoaded: state.modelLoaded,
          hasColorableMaterials: targetIds.length > 0,
          targetLabels: [],
        },
      };
    }),
    getColorableTargets: vi.fn(() => targetIds),
    getColorableMaterialCount: vi.fn(() => targetIds.length),
    hasColorableMaterials: vi.fn(() => targetIds.length > 0),
  };
}

function createSnapshot(state) {
  return {
    ...state,
    selectedColorIdsByTarget: { ...state.selectedColorIdsByTarget },
    adjustments: { ...state.adjustments },
  };
}

function shouldWriteUrl(changes) {
  return changes.includes('selectedNecklace') || changes.includes('selectedColorIdsByTarget');
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
