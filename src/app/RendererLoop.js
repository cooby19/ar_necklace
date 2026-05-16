import { APP_MODES } from './AppState.js';

export class RendererLoop {
  constructor({ scene, debugOverlay, getState, onDebugFrame }) {
    this.scene = scene;
    this.debugOverlay = debugOverlay;
    this.getState = getState;
    this.onDebugFrame = onDebugFrame;
    this.frameHandle = null;
    this.stats = {
      fps: 0,
      frameCount: 0,
      lastSampleAt: performance.now(),
    };
  }

  start() {
    if (this.frameHandle !== null) return;
    this.frameHandle = requestAnimationFrame(this.tick);
  }

  stop() {
    if (this.frameHandle === null) return;
    cancelAnimationFrame(this.frameHandle);
    this.frameHandle = null;
  }

  getStats() {
    return {
      fps: this.stats.fps,
      frameCount: this.stats.frameCount,
      lastSampleAt: this.stats.lastSampleAt,
    };
  }

  tick = (now) => {
    this.frameHandle = null;
    const state = this.getState();
    this.updateRenderFps(now);

    if (state.mode === APP_MODES.SHOWCASE && state.modelLoaded) {
      this.scene.updateShowcase(now);
    }

    this.scene.render();
    this.debugOverlay.render(state.lastLandmarks, state.lastDebugData);

    if (state.debugEnabled) {
      this.onDebugFrame?.(this.getStats());
    }

    this.frameHandle = requestAnimationFrame(this.tick);
  };

  updateRenderFps(now) {
    this.stats.frameCount += 1;
    const elapsed = now - this.stats.lastSampleAt;
    if (elapsed < 500) return;

    this.stats.fps = Math.round((this.stats.frameCount * 1000) / elapsed);
    this.stats.frameCount = 0;
    this.stats.lastSampleAt = now;
  }
}
