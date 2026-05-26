import { describe, expect, it, vi } from 'vitest';
import { APP_MODES } from '../AppState.js';
import { StageInteractionUseCase } from './StageInteractionUseCase.js';

describe('StageInteractionUseCase', () => {
  it('routes AR pointer events to calibration drag handlers', () => {
    const useCase = createStageInteractionUseCase({ mode: APP_MODES.AR });
    const event = createPointerEvent();

    useCase.handlePointerDown(event);
    useCase.handlePointerMove(event);
    useCase.handlePointerUp(event);

    expect(useCase.calibrationUseCase.handlePointerDown).toHaveBeenCalledWith(event);
    expect(useCase.calibrationUseCase.handlePointerMove).toHaveBeenCalledWith(event);
    expect(useCase.calibrationUseCase.handlePointerUp).toHaveBeenCalledWith(event);
    expect(useCase.scene.beginShowcaseDrag).not.toHaveBeenCalled();
  });

  it('handles showcase drag side effects when the model is loaded', () => {
    const useCase = createStageInteractionUseCase({
      mode: APP_MODES.SHOWCASE,
      modelLoaded: true,
    });
    const event = createPointerEvent();

    useCase.handlePointerDown(event);
    useCase.handlePointerMove(event);
    useCase.handlePointerUp(event);

    expect(useCase.ui.elements.threeCanvas.setPointerCapture).toHaveBeenCalledWith(event.pointerId);
    expect(useCase.ui.setShowcaseDragging).toHaveBeenNthCalledWith(1, true);
    expect(useCase.scene.beginShowcaseDrag).toHaveBeenCalledWith(event.clientX);
    expect(useCase.scene.dragShowcase).toHaveBeenCalledWith(event.clientX);
    expect(useCase.ui.elements.threeCanvas.releasePointerCapture).toHaveBeenCalledWith(event.pointerId);
    expect(useCase.ui.setShowcaseDragging).toHaveBeenNthCalledWith(2, false);
    expect(useCase.scene.endShowcaseDrag).toHaveBeenCalledTimes(1);
  });
});

function createPointerEvent() {
  return {
    pointerId: 7,
    clientX: 120,
  };
}

function createStageInteractionUseCase(overrides = {}) {
  const state = {
    mode: APP_MODES.SHOWCASE,
    modelLoaded: false,
    ...overrides,
  };

  return new StageInteractionUseCase({
    appState: {
      getSnapshot: vi.fn(() => state),
    },
    ui: {
      setShowcaseDragging: vi.fn(),
      elements: {
        threeCanvas: {
          setPointerCapture: vi.fn(),
          releasePointerCapture: vi.fn(),
        },
      },
    },
    scene: {
      beginShowcaseDrag: vi.fn(),
      dragShowcase: vi.fn(),
      endShowcaseDrag: vi.fn(),
    },
    calibrationUseCase: {
      handlePointerDown: vi.fn(),
      handlePointerMove: vi.fn(),
      handlePointerUp: vi.fn(),
    },
  });
}
