// @ts-check

import { APP_MODES } from './AppState.js';

/** @typedef {import('../types/domain').AppStateSnapshot} AppStateSnapshot */
/** @typedef {import('../types/domain').RealtimeTrackingSnapshot} RealtimeTrackingSnapshot */
/** @typedef {import('../types/domain').RenderStats} RenderStats */
/** @typedef {import('../types/domain').RenderSchedulerMode} RenderSchedulerMode */
/** @typedef {import('../types/scene-ports').RendererScenePort} RendererScenePort */
/** @typedef {import('../types/scene-ports').DebugOverlayPort} DebugOverlayPort */

/**
 * @typedef {{
 *   scene: RendererScenePort,
 *   debugOverlay: DebugOverlayPort,
 *   getState: () => AppStateSnapshot,
 *   getRealtimeSnapshot: () => RealtimeTrackingSnapshot,
 *   onStatsUpdate?: (stats: RenderStats) => void,
 *   showcaseAnimationEnabled?: boolean,
 * }} RendererLoopOptions
 */

export class RendererLoop {
  /**
   * @param {RendererLoopOptions} options
   */
  constructor({ scene, debugOverlay, getState, getRealtimeSnapshot, onStatsUpdate, showcaseAnimationEnabled = true }) {
    this.scene = scene;
    this.debugOverlay = debugOverlay;
    this.getState = getState;
    this.getRealtimeSnapshot = getRealtimeSnapshot;
    this.onStatsUpdate = onStatsUpdate;
    this.showcaseAnimationEnabled = showcaseAnimationEnabled;
    /** @type {number | null} */
    this.frameHandle = null;
    /** @type {RenderStats} */
    this.stats = {
      fps: 0,
      frameCount: 0,
      lastSampleAt: performance.now(),
      schedulerMode: 'idle',
      isRunning: false,
      isPaused: false,
    };
    this.renderRequested = true;
    this.isRunning = false;
    this.isPaused = false;
  }

  /**
   * @returns {void}
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.updateSchedulerStats();
    this.requestRender();
  }

  /**
   * @returns {void}
   */
  stop() {
    if (!this.isRunning && this.frameHandle === null) return;
    this.isRunning = false;
    this.cancelScheduledFrame();
    this.updateSchedulerStats();
  }

  /**
   * @returns {RenderStats}
   */
  getStats() {
    return {
      fps: this.stats.fps,
      frameCount: this.stats.frameCount,
      lastSampleAt: this.stats.lastSampleAt,
      schedulerMode: this.stats.schedulerMode,
      isRunning: this.stats.isRunning,
      isPaused: this.stats.isPaused,
    };
  }

  /**
   * @returns {void}
   */
  requestRender() {
    this.renderRequested = true;
    this.scheduleNextFrame();
  }

  /**
   * @returns {void}
   */
  pause() {
    if (this.isPaused) return;
    this.isPaused = true;
    this.cancelScheduledFrame();
    this.updateSchedulerStats();
  }

  /**
   * @returns {void}
   */
  resume() {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.updateSchedulerStats();
    this.requestRender();
  }

  /** @param {number} now */
  tick = (now) => {
    this.frameHandle = null;
    if (!this.isRunning || this.isPaused) {
      this.updateSchedulerStats();
      return;
    }

    const state = this.getState();
    this.updateRenderFps(now);

    const schedulerMode = this.resolveSchedulerMode(state);
    const shouldAnimateShowcase = schedulerMode === 'showcase' && this.showcaseAnimationEnabled;
    const shouldRenderLiveAr = schedulerMode === 'ar-live';

    if (shouldAnimateShowcase) {
      this.scene.updateShowcase(now);
    }

    if (this.renderRequested || shouldAnimateShowcase || shouldRenderLiveAr) {
      this.scene.render();
      this.renderRequested = false;
    }

    if (state.mode === APP_MODES.AR && state.debugEnabled) {
      const realtime = this.getRealtimeSnapshot();
      this.debugOverlay.render(realtime.latestLandmarks, realtime.debugData);
    }

    this.updateSchedulerStats(schedulerMode);

    if (shouldAnimateShowcase || shouldRenderLiveAr || this.renderRequested) {
      this.scheduleNextFrame();
    }
  };

  /**
   * @param {number} now
   * @returns {void}
   */
  updateRenderFps(now) {
    this.stats.frameCount += 1;
    const elapsed = now - this.stats.lastSampleAt;
    if (elapsed < 500) return;

    this.stats.fps = Math.round((this.stats.frameCount * 1000) / elapsed);
    this.stats.frameCount = 0;
    this.stats.lastSampleAt = now;
  }

  /**
   * @param {AppStateSnapshot} state
   * @returns {RenderSchedulerMode}
   */
  resolveSchedulerMode(state) {
    if (this.isPaused) return 'paused';
    if (state.mode === APP_MODES.SHOWCASE && state.modelLoaded) return 'showcase';
    if (state.mode === APP_MODES.AR && state.cameraStarted) return 'ar-live';
    return 'idle';
  }

  /**
   * @returns {void}
   */
  scheduleNextFrame() {
    if (!this.isRunning || this.isPaused || this.frameHandle !== null) return;

    const state = this.getState();
    const schedulerMode = this.resolveSchedulerMode(state);
    if (!this.renderRequested && schedulerMode === 'idle') {
      this.updateSchedulerStats(schedulerMode);
      return;
    }

    this.updateSchedulerStats(schedulerMode);
    this.frameHandle = requestAnimationFrame(this.tick);
  }

  /**
   * @returns {void}
   */
  cancelScheduledFrame() {
    if (this.frameHandle === null) return;

    cancelAnimationFrame(this.frameHandle);
    this.frameHandle = null;
  }

  /**
   * @param {RenderSchedulerMode} [schedulerMode]
   * @returns {void}
   */
  updateSchedulerStats(schedulerMode = this.resolveSchedulerMode(this.getState())) {
    this.stats = {
      ...this.stats,
      schedulerMode,
      isRunning: this.isRunning,
      isPaused: this.isPaused,
    };
    this.onStatsUpdate?.(this.getStats());
  }
}
