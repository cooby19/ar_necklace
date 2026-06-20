import { describe, expect, it, vi } from 'vitest';
import { APP_MODES, APP_ROUTES, AR_SESSION_STATES } from '../AppState.js';
import { RouteUseCase } from './RouteUseCase.js';

function createHarness({
  necklaces = [{ id: 'a' }, { id: 'b' }],
  cameraStarted = false,
  route = APP_ROUTES.GALLERY,
} = {}) {
  const state = { route, cameraStarted };
  const appState = {
    get: vi.fn((key) => state[key]),
    set: vi.fn((patch) => Object.assign(state, patch)),
  };
  const modelCatalog = { getById: vi.fn((id) => necklaces.find((necklace) => necklace.id === id) ?? null) };
  const modelUseCase = { selectNecklace: vi.fn() };
  const modeUseCase = { syncModeEffects: vi.fn() };
  const cameraSessionUseCase = { stopCameraSession: vi.fn() };
  const useCase = new RouteUseCase({ appState, modelCatalog, modelUseCase, modeUseCase, cameraSessionUseCase });

  return { useCase, appState, modelUseCase, modeUseCase, cameraSessionUseCase };
}

describe('RouteUseCase', () => {
  it('enterExperience selects the necklace and switches to the experience route', () => {
    const { useCase, appState, modelUseCase, modeUseCase } = createHarness();

    useCase.enterExperience('b');

    expect(modelUseCase.selectNecklace).toHaveBeenCalledWith('b');
    expect(appState.set).toHaveBeenCalledWith(
      { route: APP_ROUTES.EXPERIENCE, mode: APP_MODES.SHOWCASE },
      'enter-experience',
    );
    expect(modeUseCase.syncModeEffects).toHaveBeenCalledTimes(1);
  });

  it('enterExperience ignores unknown necklace ids', () => {
    const { useCase, appState, modelUseCase } = createHarness();

    useCase.enterExperience('missing');

    expect(modelUseCase.selectNecklace).not.toHaveBeenCalled();
    expect(appState.set).not.toHaveBeenCalled();
  });

  it('showGallery stops a running camera and returns to the gallery route', () => {
    const { useCase, appState, cameraSessionUseCase } = createHarness({
      cameraStarted: true,
      route: APP_ROUTES.EXPERIENCE,
    });

    useCase.showGallery();

    expect(cameraSessionUseCase.stopCameraSession).toHaveBeenCalledWith({
      nextStatus: AR_SESSION_STATES.SHOWCASE,
      eventName: 'gallery-camera-stop',
    });
    expect(appState.set).toHaveBeenCalledWith(
      { route: APP_ROUTES.GALLERY, mode: APP_MODES.SHOWCASE },
      'show-gallery',
    );
  });

  it('showGallery leaves the camera untouched when it is not running', () => {
    const { useCase, cameraSessionUseCase } = createHarness({
      cameraStarted: false,
      route: APP_ROUTES.EXPERIENCE,
    });

    useCase.showGallery();

    expect(cameraSessionUseCase.stopCameraSession).not.toHaveBeenCalled();
  });
});
