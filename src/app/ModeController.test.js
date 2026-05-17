import { describe, expect, it, vi } from 'vitest';
import { APP_MODES, AR_SESSION_STATES } from './AppState.js';
import { ModeController } from './ModeController.js';
import { RealtimeTrackingStore } from './RealtimeTrackingStore.js';
import { NECKLACES } from '../config/necklaces.js';

describe('ModeController FaceMesh result boundary', () => {
  it('writes every frame to realtime store without transitioning when status is unchanged', () => {
    const controller = createFaceResultController({
      sessionStatus: AR_SESSION_STATES.TRACKING,
    });
    const landmarks = [{ x: 0.45, y: 0.5 }];

    controller.handleFaceResults({ multiFaceLandmarks: [landmarks] });

    expect(controller.controller.updateFromLandmarks).toHaveBeenCalledWith(landmarks, true);
    expect(controller.appState.transitionSession).not.toHaveBeenCalled();
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

  it('keeps capture/share workflow status while still sampling realtime frames', () => {
    const controller = createFaceResultController({
      sessionStatus: AR_SESSION_STATES.SHARING,
    });
    const landmarks = [{ x: 0.48, y: 0.52 }];

    controller.handleFaceResults({ multiFaceLandmarks: [landmarks] });

    expect(controller.appState.transitionSession).not.toHaveBeenCalled();
    expect(controller.realtimeStore.getSnapshot()).toMatchObject({
      hasFace: true,
      latestLandmarks: landmarks,
      frameSequence: 1,
    });
  });
});

function createFaceResultController(overrides = {}) {
  let state = {
    mode: APP_MODES.AR,
    cameraStarted: true,
    modelLoaded: true,
    necklaceVisible: true,
    sessionStatus: AR_SESSION_STATES.NO_FACE,
    selectedNecklace: NECKLACES[0],
    ...overrides,
  };
  const debugData = { scale: 1.2, rotationY: 0.1 };
  const controller = Object.create(ModeController.prototype);

  Object.assign(controller, {
    debugData,
    realtimeStore: new RealtimeTrackingStore({ now: () => 100 }),
    appState: {
      transitionSession: vi.fn((nextStatus) => {
        state = { ...state, sessionStatus: nextStatus };
        return state;
      }),
      get: vi.fn((key) => state[key]),
    },
    controller: {
      fadeOut: vi.fn(),
      updateFromLandmarks: vi.fn(() => debugData),
    },
    rendererLoop: {
      requestRender: vi.fn(),
    },
    scheduleTrackingFeedbackUpdate: vi.fn(),
    markCalibrationReady: vi.fn(),
    getState: () => state,
  });

  return controller;
}
