import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RuntimeLifecycleUseCase } from './RuntimeLifecycleUseCase.js';
import { RealtimeTrackingStore } from '../RealtimeTrackingStore.js';
import { NECKLACES } from '../../config/necklaces.js';

beforeEach(() => {
  vi.stubGlobal('document', {
    hidden: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal('window', {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RuntimeLifecycleUseCase', () => {
  it('initializes UI, model, mode effects, render loop, and idle preload', async () => {
    vi.useFakeTimers();
    try {
      const useCase = createRuntimeLifecycleUseCase();

      useCase.init();

      expect(useCase.ui.populateNecklaceSelect).toHaveBeenCalledWith(NECKLACES[0].id);
      expect(useCase.ui.populateColorSwatches).toHaveBeenCalledWith(expect.objectContaining({
        necklace: NECKLACES[0],
      }));
      expect(useCase.ui.syncFromState).toHaveBeenCalledWith(useCase.getState());
      expect(useCase.calibrationUseCase.applyCalibrationForSelectedNecklace).toHaveBeenCalledTimes(1);
      expect(useCase.modelUseCase.syncColorAvailability).toHaveBeenCalledTimes(1);
      expect(useCase.modeUseCase.syncModeEffects).toHaveBeenCalledTimes(1);
      expect(useCase.modelUseCase.loadSelectedNecklace).toHaveBeenCalledTimes(1);
      expect(useCase.rendererLoop.start).toHaveBeenCalledTimes(1);
      expect(useCase.cameraSessionUseCase.preloadSessionService).not.toHaveBeenCalled();

      await vi.runOnlyPendingTimersAsync();

      expect(useCase.cameraSessionUseCase.preloadSessionService).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('pauses and resumes runtime work around page visibility', () => {
    const useCase = createRuntimeLifecycleUseCase({
      cameraStarted: true,
    });
    useCase.realtimeStore.updateFrame({ landmarks: [{ x: 0.4, y: 0.5 }], hasFace: true, debugData: null });

    useCase.handlePageHidden();
    useCase.handlePageVisible();

    expect(useCase.rendererLoop.pause).toHaveBeenCalledTimes(1);
    expect(useCase.cameraSessionUseCase.pauseTracking).toHaveBeenCalledTimes(1);
    expect(useCase.realtimeStore.getSnapshot()).toMatchObject({
      hasFace: false,
      latestLandmarks: null,
    });
    expect(useCase.necklaceController.fadeOut).toHaveBeenCalledTimes(1);
    expect(useCase.rendererLoop.resume).toHaveBeenCalledTimes(1);
    expect(useCase.rendererLoop.requestRender).toHaveBeenCalledTimes(1);
    expect(useCase.cameraSessionUseCase.resumeTracking).toHaveBeenCalledTimes(1);
  });

  it('destroys page lifecycle hooks and tracking timers', () => {
    const useCase = createRuntimeLifecycleUseCase();
    const dispose = vi.fn();
    useCase.lifecycleDisposers.push(dispose);
    useCase.cancelSessionServicePreload = vi.fn();

    useCase.destroy();

    expect(useCase.cancelSessionServicePreload).toBeNull();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(useCase.trackingUseCase.dispose).toHaveBeenCalledTimes(1);
  });
});

function createRuntimeLifecycleUseCase(overrides = {}) {
  const state = {
    cameraStarted: false,
    selectedNecklace: NECKLACES[0],
    selectedColorId: 'rose-quartz',
    selectedColorIdsByTarget: {},
    ...overrides,
  };

  return new RuntimeLifecycleUseCase({
    appState: {
      get: vi.fn((key) => state[key]),
      getSnapshot: vi.fn(() => state),
    },
    ui: {
      populateNecklaceSelect: vi.fn(),
      populateColorSwatches: vi.fn(),
      syncFromState: vi.fn(),
      showError: vi.fn(),
    },
    realtimeStore: new RealtimeTrackingStore({ now: () => 100 }),
    rendererLoop: {
      start: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      requestRender: vi.fn(),
    },
    necklaceController: {
      fadeOut: vi.fn(),
    },
    calibrationUseCase: {
      applyCalibrationForSelectedNecklace: vi.fn(),
    },
    cameraSessionUseCase: {
      pauseTracking: vi.fn(),
      resumeTracking: vi.fn(() => Promise.resolve()),
      preloadSessionService: vi.fn(() => Promise.resolve(null)),
    },
    modelUseCase: {
      syncColorAvailability: vi.fn(),
      loadSelectedNecklace: vi.fn(() => Promise.resolve()),
    },
    modeUseCase: {
      syncModeEffects: vi.fn(),
    },
    trackingUseCase: {
      dispose: vi.fn(),
    },
  });
}
