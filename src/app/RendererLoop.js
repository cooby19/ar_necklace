// @ts-check

import { APP_MODES } from './AppState.js';

/** @typedef {import('../types/domain').AppStateSnapshot} AppStateSnapshot */
/** @typedef {import('../types/domain').NecklaceDebugData} NecklaceDebugData */
/** @typedef {import('../types/domain').FaceLandmarkList} FaceLandmarkList */
/** @typedef {import('../types/domain').RenderStats} RenderStats */

/**
 * @typedef {{
 *   updateShowcase: (now: number) => void,
 *   render: () => void,
 * }} RendererScenePort
 */

/**
 * @typedef {{
 *   render: (landmarks: FaceLandmarkList | null, debugData: NecklaceDebugData | null) => void,
 * }} DebugOverlayPort
 */

/**
 * @typedef {{
 *   scene: RendererScenePort,
 *   debugOverlay: DebugOverlayPort,
 *   getState: () => AppStateSnapshot,
 *   onDebugFrame?: (stats: RenderStats) => void,
 * }} RendererLoopOptions
 */

export class RendererLoop {
  /**
   * @param {RendererLoopOptions} options
   */
  constructor({ scene, debugOverlay, getState, onDebugFrame }) {
    this.scene = scene;
    this.debugOverlay = debugOverlay;
    this.getState = getState;
    this.onDebugFrame = onDebugFrame;
    /** @type {number | null} */
    this.frameHandle = null;
    /** @type {RenderStats} */
    this.stats = {
      fps: 0,
      frameCount: 0,
      lastSampleAt: performance.now(),
    };
    this.renderRequested = true;
  }

  /**
   * @returns {void}
   */
  start() {
    if (this.frameHandle !== null) return;
    this.requestRender();
    this.frameHandle = requestAnimationFrame(this.tick);
  }

  /**
   * @returns {void}
   */
  stop() {
    if (this.frameHandle === null) return;
    cancelAnimationFrame(this.frameHandle);
    this.frameHandle = null;
  }

  /**
   * @returns {RenderStats}
   */
  getStats() {
    return {
      fps: this.stats.fps,
      frameCount: this.stats.frameCount,
      lastSampleAt: this.stats.lastSampleAt,
    };
  }

  /**
   * @returns {void}
   */
  requestRender() {
    this.renderRequested = true;
  }

  /** @param {number} now */
  tick = (now) => {
    this.frameHandle = null;
    const state = this.getState();
    this.updateRenderFps(now);

    const shouldAnimateShowcase = state.mode === APP_MODES.SHOWCASE && state.modelLoaded;
    const shouldRenderLiveAr = state.mode === APP_MODES.AR && state.cameraStarted;

    if (shouldAnimateShowcase) {
      this.scene.updateShowcase(now);
    }

    if (this.renderRequested || shouldAnimateShowcase || shouldRenderLiveAr) {
      this.scene.render();
      this.renderRequested = false;
    }

    if (state.mode === APP_MODES.AR && state.debugEnabled) {
      this.debugOverlay.render(state.lastLandmarks, state.lastDebugData);
      this.onDebugFrame?.(this.getStats());
    }

    this.frameHandle = requestAnimationFrame(this.tick);
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
}
