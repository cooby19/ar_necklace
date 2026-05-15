import { TRACKING_TUNING } from '../config/tuning.js';

const FACE_MESH_SCRIPT_URL = `${import.meta.env.BASE_URL}vendor/mediapipe/face_mesh/face_mesh.js`;

let faceMeshScriptPromise = null;

async function loadFaceMeshConstructor() {
  if (window.FaceMesh) {
    return window.FaceMesh;
  }

  if (!faceMeshScriptPromise) {
    faceMeshScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = FACE_MESH_SCRIPT_URL;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        if (window.FaceMesh) {
          resolve(window.FaceMesh);
          return;
        }

        faceMeshScriptPromise = null;
        reject(new Error('MediaPipe FaceMesh 載入後沒有提供 FaceMesh 建構子。'));
      };
      script.onerror = () => {
        faceMeshScriptPromise = null;
        reject(new Error(`無法載入 MediaPipe Face Mesh：${FACE_MESH_SCRIPT_URL}`));
      };
      document.head.appendChild(script);
    });
  }

  return faceMeshScriptPromise;
}

export class FaceTracker {
  constructor({ video, onResults, onError, onStatsUpdate }) {
    this.video = video;
    this.onResults = onResults;
    this.onError = onError;
    this.onStatsUpdate = onStatsUpdate;
    this.faceMesh = null;
    this.isRunning = false;
    this.frameHandle = null;
    this.isSendingFrame = false;
    this.selfieMode = true;
    this.inferenceConfig = normalizeInferenceConfig(TRACKING_TUNING.inference);
    this.currentFps = this.inferenceConfig.targetFps;
    this.lastInferenceStartedAt = 0;
    this.lastInferenceCompletedAt = 0;
    this.lastAdjustmentAt = 0;
    this.inferenceSamples = [];
    this.stats = {
      currentFps: this.currentFps,
      targetFps: this.inferenceConfig.targetFps,
      averageInferenceMs: 0,
      lastInferenceMs: 0,
      skippedFrameCount: 0,
      inferenceCount: 0,
    };
  }

  async init() {
    const FaceMeshConstructor = await loadFaceMeshConstructor();

    this.faceMesh = new FaceMeshConstructor({
      // Assets are copied from node_modules into public/vendor so the MVP does
      // not need a CDN at runtime.
      locateFile: (file) => `${import.meta.env.BASE_URL}vendor/mediapipe/face_mesh/${file}`,
    });

    this.faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.58,
      minTrackingConfidence: 0.58,
      // Internally flips the camera input when using the front-facing mirrored preview.
      selfieMode: this.selfieMode,
    });

    this.faceMesh.onResults((results) => {
      this.onResults?.(results);
    });

    await this.faceMesh.initialize();
  }

  async start() {
    if (!this.faceMesh) {
      await this.init();
    }

    if (this.isRunning) return;

    this.resetRuntimeStats();
    this.isRunning = true;
    this.tick();
  }

  stop() {
    this.isRunning = false;
    if (this.frameHandle) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = null;
    }
  }

  tick = async () => {
    if (!this.isRunning) return;

    const now = performance.now();
    if (this.canSendFrame(now)) {
      await this.sendFrame(now);
    } else if (this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      this.stats.skippedFrameCount += 1;
    }

    this.frameHandle = requestAnimationFrame(this.tick);
  };

  canSendFrame(now) {
    if (this.isSendingFrame) return false;
    if (this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return false;

    const intervalMs = 1000 / this.currentFps;
    return now - this.lastInferenceStartedAt >= intervalMs;
  }

  async sendFrame(startedAt) {
    this.isSendingFrame = true;
    this.lastInferenceStartedAt = startedAt;

    try {
      await this.faceMesh.send({ image: this.video });
    } catch (error) {
      this.onError?.(error);
    } finally {
      const completedAt = performance.now();
      const inferenceMs = completedAt - startedAt;
      this.isSendingFrame = false;
      this.lastInferenceCompletedAt = completedAt;
      this.recordInferenceTiming(inferenceMs, completedAt);
    }
  }

  recordInferenceTiming(inferenceMs, completedAt) {
    this.inferenceSamples.push(inferenceMs);
    if (this.inferenceSamples.length > this.inferenceConfig.averageWindowSize) {
      this.inferenceSamples.shift();
    }

    const totalMs = this.inferenceSamples.reduce((sum, sample) => sum + sample, 0);
    const averageInferenceMs = totalMs / this.inferenceSamples.length;

    this.stats = {
      ...this.stats,
      currentFps: this.currentFps,
      targetFps: this.inferenceConfig.targetFps,
      averageInferenceMs,
      lastInferenceMs: inferenceMs,
      inferenceCount: this.stats.inferenceCount + 1,
    };

    this.adjustAdaptiveFps(averageInferenceMs, completedAt);
    this.emitStats();
  }

  adjustAdaptiveFps(averageInferenceMs, now) {
    if (!this.inferenceConfig.adaptiveEnabled) return;
    if (this.inferenceSamples.length < this.inferenceConfig.averageWindowSize) return;
    if (now - this.lastAdjustmentAt < this.inferenceConfig.adjustCooldownMs) return;

    const frameBudgetMs = 1000 / this.currentFps;
    const targetCeiling = Math.min(this.inferenceConfig.targetFps, this.inferenceConfig.maxFps);
    const isTooSlow = averageInferenceMs > frameBudgetMs * this.inferenceConfig.slowFrameRatio;
    const hasHeadroom = averageInferenceMs < frameBudgetMs * this.inferenceConfig.fastFrameRatio;
    let nextFps = this.currentFps;

    if (isTooSlow) {
      nextFps = Math.max(this.inferenceConfig.minFps, this.currentFps - this.inferenceConfig.fpsStep);
    } else if (hasHeadroom) {
      nextFps = Math.min(targetCeiling, this.currentFps + this.inferenceConfig.fpsStep);
    }

    if (nextFps === this.currentFps) return;

    this.currentFps = nextFps;
    this.lastAdjustmentAt = now;
    this.stats = {
      ...this.stats,
      currentFps: this.currentFps,
    };
  }

  getStats() {
    return { ...this.stats };
  }

  emitStats() {
    this.onStatsUpdate?.(this.getStats());
  }

  resetRuntimeStats() {
    this.currentFps = this.inferenceConfig.targetFps;
    this.lastInferenceStartedAt = 0;
    this.lastInferenceCompletedAt = 0;
    this.lastAdjustmentAt = performance.now();
    this.inferenceSamples = [];
    this.stats = {
      currentFps: this.currentFps,
      targetFps: this.inferenceConfig.targetFps,
      averageInferenceMs: 0,
      lastInferenceMs: 0,
      skippedFrameCount: 0,
      inferenceCount: 0,
    };
    this.emitStats();
  }

  setSelfieMode(isSelfieMode) {
    this.selfieMode = Boolean(isSelfieMode);
    this.faceMesh?.setOptions({
      selfieMode: this.selfieMode,
    });
  }
}

function normalizeInferenceConfig(config = {}) {
  const minFps = clampNumber(config.minFps, 1, 60, 15);
  const maxFps = Math.max(minFps, clampNumber(config.maxFps, minFps, 60, 30));
  const targetFps = clampNumber(config.targetFps, minFps, maxFps, 24);

  return {
    targetFps,
    minFps,
    maxFps,
    adaptiveEnabled: config.adaptiveEnabled !== false,
    slowFrameRatio: clampNumber(config.slowFrameRatio, 1, 5, 1.25),
    fastFrameRatio: clampNumber(config.fastFrameRatio, 0.1, 0.95, 0.65),
    adjustCooldownMs: clampNumber(config.adjustCooldownMs, 0, 30000, 2500),
    fpsStep: clampNumber(config.fpsStep, 1, maxFps - minFps || 1, 6),
    averageWindowSize: Math.round(clampNumber(config.averageWindowSize, 1, 120, 12)),
  };
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}
