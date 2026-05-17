import { describe, expect, it } from 'vitest';
import { RealtimeTrackingStore } from './RealtimeTrackingStore.js';

describe('RealtimeTrackingStore', () => {
  it('keeps latest frame data outside AppState and increments frame sequence', () => {
    let now = 100;
    const store = new RealtimeTrackingStore({ now: () => now });
    const landmarks = [{ x: 0.4, y: 0.5 }];
    const debugData = { scale: 1.1, rotationY: 0.2 };

    const first = store.updateFrame({ landmarks, debugData, hasFace: true });
    expect(first).toMatchObject({
      hasFace: true,
      latestLandmarks: landmarks,
      debugData,
      frameSequence: 1,
      updatedAt: 100,
    });

    now = 120;
    const cleared = store.clearTracking();
    expect(cleared).toMatchObject({
      hasFace: false,
      latestLandmarks: null,
      debugData: null,
      frameSequence: 2,
      updatedAt: 120,
    });
  });

  it('stores tracker and render stats as sampled realtime metadata', () => {
    const store = new RealtimeTrackingStore({ now: () => 42 });

    store.setTrackerStats({
      currentFps: 24,
      targetFps: 30,
      averageInferenceMs: 12,
      lastInferenceMs: 14,
      skippedFrameCount: 2,
      inferenceCount: 9,
      schedulerType: 'video-frame',
    });
    store.setRenderStats({
      fps: 58,
      frameCount: 4,
      lastSampleAt: 40,
      schedulerMode: 'ar-live',
      isRunning: true,
      isPaused: false,
    });

    expect(store.getSnapshot()).toMatchObject({
      trackerStats: {
        currentFps: 24,
        schedulerType: 'video-frame',
      },
      renderStats: {
        fps: 58,
        schedulerMode: 'ar-live',
        isRunning: true,
      },
    });
  });
});
