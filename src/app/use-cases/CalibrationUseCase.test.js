import { describe, expect, it, vi } from 'vitest';
import { CalibrationUseCase } from './CalibrationUseCase.js';
import { RealtimeTrackingStore } from '../RealtimeTrackingStore.js';
import { NECKLACES } from '../../config/necklaces.js';

describe('CalibrationUseCase', () => {
  it('starts, updates, and ends drag calibration through the calibration service', () => {
    const event = createPointerEvent();
    const result = {
      adjustments: { verticalOffset: 0.12 },
      hint: { message: 'dragging', options: { isDirty: true } },
    };
    const useCase = createCalibrationUseCase({
      calibrationService: {
        startDrag: vi.fn(() => true),
        updateDrag: vi.fn(() => result),
        endDrag: vi.fn(() => true),
        mergeAdjustments: vi.fn((current, next) => ({ ...current, ...next })),
      },
    });
    useCase.realtimeStore.updateFrame({ landmarks: [{ x: 0.4, y: 0.5 }], hasFace: true, debugData: null });

    useCase.handlePointerDown(event);
    useCase.handlePointerMove(event);
    useCase.handlePointerUp(event);

    expect(useCase.calibrationService.startDrag).toHaveBeenCalledWith(event, expect.objectContaining({ hasFace: true }));
    expect(useCase.ui.setCalibrationDragging).toHaveBeenNthCalledWith(1, true);
    expect(useCase.calibrationService.updateDrag).toHaveBeenCalledWith(
      event,
      expect.objectContaining({ verticalOffset: 0 }),
    );
    expect(useCase.appState.set).toHaveBeenCalledWith(
      { adjustments: expect.objectContaining({ verticalOffset: 0.12 }) },
      'calibration-drag',
    );
    expect(useCase.ui.syncTuningControlsFromAdjustments).toHaveBeenCalledWith(useCase.appState.get('adjustments'));
    expect(useCase.ui.setCalibrationHint).toHaveBeenCalledWith('dragging', { isDirty: true });
    expect(useCase.ui.setCalibrationDragging).toHaveBeenNthCalledWith(2, false);
  });

  it('applies tuning control input and marks the hint dirty', () => {
    const useCase = createCalibrationUseCase({
      ui: {
        readTuningControls: vi.fn(() => ({
          adjustments: { scaleMultiplier: 1.25 },
        })),
      },
      calibrationService: {
        mergeAdjustments: vi.fn((current, next) => ({ ...current, ...next })),
        getHint: vi.fn(() => ({ message: 'dirty', options: { isDirty: true } })),
      },
    });

    useCase.updateTuningFromControls();

    expect(useCase.appState.set).toHaveBeenCalledWith(
      { adjustments: expect.objectContaining({ scaleMultiplier: 1.25 }) },
      'calibration-input',
    );
    expect(useCase.necklaceController.setAdjustments).toHaveBeenCalledWith(
      expect.objectContaining({ scaleMultiplier: 1.25 }),
    );
    expect(useCase.rendererLoop.requestRender).toHaveBeenCalledTimes(1);
    expect(useCase.ui.setCalibrationHint).toHaveBeenCalledWith('dirty', { isDirty: true });
  });

  it('saves, resets, and loads calibration hints without changing their wording', () => {
    const resetAdjustments = {
      horizontalOffset: 0,
      verticalOffset: 0.08,
      scaleMultiplier: 1,
      rotationOffset: 0,
    };
    const useCase = createCalibrationUseCase({
      calibrationService: {
        save: vi.fn(() => ({ didSave: true, hint: { message: 'saved', options: { isSaved: true } } })),
        reset: vi.fn(() => ({ adjustments: resetAdjustments, hint: { message: 'reset' } })),
        load: vi.fn(() => ({ adjustments: resetAdjustments, hint: { message: 'loaded' } })),
        mergeAdjustments: vi.fn((current, next) => ({ ...current, ...next })),
      },
    });

    useCase.saveCalibration();
    useCase.resetCalibration();
    useCase.applyCalibrationForSelectedNecklace();

    expect(useCase.calibrationService.save).toHaveBeenCalledWith(
      NECKLACES[0].id,
      expect.objectContaining({ verticalOffset: 0 }),
    );
    expect(useCase.ui.setCalibrationHint).toHaveBeenCalledWith('saved', { isSaved: true });
    expect(useCase.calibrationService.reset).toHaveBeenCalledWith(NECKLACES[0].id);
    expect(useCase.calibrationService.load).toHaveBeenCalledWith(NECKLACES[0].id);
    expect(useCase.ui.syncTuningControlsFromAdjustments).toHaveBeenCalledWith(resetAdjustments);
    expect(useCase.ui.setCalibrationHint).toHaveBeenCalledWith('reset', {});
    expect(useCase.ui.setCalibrationHint).toHaveBeenCalledWith('loaded', {});
  });

  it('applies face-ready calibration hint when tracking becomes usable', () => {
    const useCase = createCalibrationUseCase({
      calibrationService: {
        markFaceReady: vi.fn(() => ({ message: 'ready' })),
      },
    });

    useCase.markFaceReady();

    expect(useCase.calibrationService.markFaceReady).toHaveBeenCalledWith(NECKLACES[0].id);
    expect(useCase.ui.setCalibrationHint).toHaveBeenCalledWith('ready', {});
  });
});

function createPointerEvent() {
  return {
    pointerId: 1,
    clientX: 100,
    clientY: 120,
    preventDefault: vi.fn(),
  };
}

function createCalibrationUseCase(overrides = {}) {
  const { ui: uiOverrides, calibrationService: calibrationServiceOverrides, ...optionOverrides } = overrides;
  let state = {
    cameraStarted: true,
    modelLoaded: true,
    necklaceVisible: true,
    selectedNecklace: NECKLACES[0],
    adjustments: {
      horizontalOffset: 0,
      verticalOffset: 0,
      scaleMultiplier: 1,
      rotationOffset: 0,
    },
  };
  const setState = (patch = {}) => {
    state = { ...state, ...patch };
    return state;
  };
  const ui = {
    setCalibrationDragging: vi.fn(),
    syncTuningControlsFromAdjustments: vi.fn(),
    readTuningControls: vi.fn(() => ({ adjustments: {} })),
    setCalibrationHint: vi.fn(),
    ...(uiOverrides ?? {}),
  };
  const calibrationService = {
    startDrag: vi.fn(() => false),
    updateDrag: vi.fn(() => null),
    endDrag: vi.fn(() => false),
    cancelDrag: vi.fn(),
    mergeAdjustments: vi.fn((current, next) => ({ ...current, ...next })),
    getHint: vi.fn(() => ({ message: 'hint' })),
    save: vi.fn(() => ({ didSave: true, hint: { message: 'saved' } })),
    reset: vi.fn(() => ({ adjustments: state.adjustments, hint: { message: 'reset' } })),
    load: vi.fn(() => ({ adjustments: state.adjustments, hint: { message: 'loaded' } })),
    markFaceReady: vi.fn(() => null),
    ...(calibrationServiceOverrides ?? {}),
  };

  const appState = {
    get: vi.fn((key) => state[key]),
    getSnapshot: vi.fn(() => state),
    set: vi.fn((patch) => setState(patch)),
  };

  return new CalibrationUseCase({
    appState,
    ui,
    realtimeStore: new RealtimeTrackingStore({ now: () => 100 }),
    calibrationService,
    necklaceController: {
      setAdjustments: vi.fn(),
    },
    rendererLoop: {
      requestRender: vi.fn(),
    },
    ...optionOverrides,
  });
}
