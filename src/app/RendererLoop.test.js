import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_MODES } from './AppState.js';
import { RendererLoop } from './RendererLoop.js';

let rafCallbacks;
let nextRafId;

beforeEach(() => {
  rafCallbacks = new Map();
  nextRafId = 1;
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback) => {
    const id = nextRafId;
    nextRafId += 1;
    rafCallbacks.set(id, callback);
    return id;
  }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id) => {
    rafCallbacks.delete(id);
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RendererLoop scheduling modes', () => {
  it('renders one dirty idle frame without keeping RAF alive', () => {
    const scene = createScene();
    const loop = createLoop({ scene });

    loop.start();
    runNextFrame(100);

    expect(scene.render).toHaveBeenCalledTimes(1);
    expect(rafCallbacks.size).toBe(0);
    expect(loop.getStats().schedulerMode).toBe('idle');
  });

  it('keeps RAF alive while AR camera is live', () => {
    const state = {
      mode: APP_MODES.AR,
      cameraStarted: true,
      debugEnabled: false,
      modelLoaded: true,
    };
    const scene = createScene();
    const loop = createLoop({ state, scene });

    loop.start();
    runNextFrame(100);

    expect(scene.render).toHaveBeenCalledTimes(1);
    expect(rafCallbacks.size).toBe(1);
    expect(loop.getStats().schedulerMode).toBe('ar-live');
  });

  it('pauses and resumes rendering without losing dirty render requests', () => {
    const scene = createScene();
    const loop = createLoop({ scene });

    loop.start();
    loop.pause();
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1);
    expect(loop.getStats()).toMatchObject({
      schedulerMode: 'paused',
      isPaused: true,
    });

    loop.resume();
    runNextFrame(100);

    expect(scene.render).toHaveBeenCalledTimes(1);
    expect(loop.getStats().isPaused).toBe(false);
  });
});

function createLoop({ state = {}, scene = createScene(), realtime = {} } = {}) {
  const snapshot = {
    mode: APP_MODES.AR,
    cameraStarted: false,
    debugEnabled: false,
    modelLoaded: false,
    ...state,
  };

  return new RendererLoop({
    scene,
    debugOverlay: { render: vi.fn() },
    getState: () => snapshot,
    getRealtimeSnapshot: () => ({
      latestLandmarks: null,
      debugData: null,
      ...realtime,
    }),
    onStatsUpdate: vi.fn(),
  });
}

function createScene() {
  return {
    updateShowcase: vi.fn(),
    render: vi.fn(),
  };
}

function runNextFrame(now) {
  const [[id, callback] = []] = rafCallbacks.entries();
  rafCallbacks.delete(id);
  expect(callback).toBeTypeOf('function');
  callback(now);
}
