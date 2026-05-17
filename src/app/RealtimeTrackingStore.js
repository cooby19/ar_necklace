// @ts-check

/** @typedef {import('../types/domain').FaceLandmarkList} FaceLandmarkList */
/** @typedef {import('../types/domain').NecklaceDebugData} NecklaceDebugData */
/** @typedef {import('../types/domain').RealtimeTrackingFramePatch} RealtimeTrackingFramePatch */
/** @typedef {import('../types/domain').RealtimeTrackingSnapshot} RealtimeTrackingSnapshot */
/** @typedef {import('../types/domain').RenderStats} RenderStats */
/** @typedef {import('../types/domain').TrackerStats} TrackerStats */

export class RealtimeTrackingStore {
  /**
   * @param {{ now?: () => number }} [options]
   */
  constructor({ now = () => performance.now() } = {}) {
    this.now = now;
    /** @type {RealtimeTrackingSnapshot} */
    this.snapshot = {
      hasFace: false,
      latestLandmarks: null,
      debugData: null,
      frameSequence: 0,
      trackerStats: createIdleTrackerStats(),
      renderStats: createIdleRenderStats(this.now()),
      updatedAt: this.now(),
    };
  }

  /**
   * @param {RealtimeTrackingFramePatch} frame
   * @returns {RealtimeTrackingSnapshot}
   */
  updateFrame({ landmarks = null, debugData = null, hasFace = Boolean(landmarks) }) {
    this.snapshot = {
      ...this.snapshot,
      hasFace,
      latestLandmarks: landmarks,
      debugData,
      frameSequence: this.snapshot.frameSequence + 1,
      updatedAt: this.now(),
    };
    return this.getSnapshot();
  }

  /**
   * @returns {RealtimeTrackingSnapshot}
   */
  clearTracking() {
    return this.updateFrame({
      hasFace: false,
      landmarks: null,
      debugData: null,
    });
  }

  /**
   * @param {TrackerStats} stats
   * @returns {RealtimeTrackingSnapshot}
   */
  setTrackerStats(stats) {
    this.snapshot = {
      ...this.snapshot,
      trackerStats: { ...stats },
      updatedAt: this.now(),
    };
    return this.getSnapshot();
  }

  /**
   * @param {RenderStats} stats
   * @returns {RealtimeTrackingSnapshot}
   */
  setRenderStats(stats) {
    this.snapshot = {
      ...this.snapshot,
      renderStats: { ...stats },
      updatedAt: this.now(),
    };
    return this.getSnapshot();
  }

  /**
   * @returns {RealtimeTrackingSnapshot}
   */
  getSnapshot() {
    return {
      ...this.snapshot,
      trackerStats: { ...this.snapshot.trackerStats },
      renderStats: { ...this.snapshot.renderStats },
    };
  }
}

/**
 * @returns {TrackerStats}
 */
export function createIdleTrackerStats() {
  return {
    currentFps: 0,
    targetFps: 0,
    averageInferenceMs: 0,
    lastInferenceMs: 0,
    skippedFrameCount: 0,
    inferenceCount: 0,
    schedulerType: 'raf',
  };
}

/**
 * @param {number} now
 * @returns {RenderStats}
 */
export function createIdleRenderStats(now = 0) {
  return {
    fps: 0,
    frameCount: 0,
    lastSampleAt: now,
    schedulerMode: 'idle',
    isRunning: false,
    isPaused: false,
  };
}
