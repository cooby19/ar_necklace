// @ts-check

import { TRACKING_TUNING } from '../config/tuning.js';
import { versionedPublicAssetUrl } from '../config/assets.js';
import { runtimeErrorReporter } from '../telemetry/RuntimeErrorReporter.js';

/** @typedef {import('../types/domain').FaceMeshResults} FaceMeshResults */
/** @typedef {import('../types/domain').FaceTrackerResultsHandler} FaceTrackerResultsHandler */
/** @typedef {import('../types/domain').InferenceTuning} InferenceTuning */
/** @typedef {import('../types/domain').TrackerStats} TrackerStats */

/**
 * @typedef {{
 *   setOptions: (options: Record<string, unknown>) => void,
 *   onResults: (handler: FaceTrackerResultsHandler) => void,
 *   initialize: () => Promise<void>,
 *   send: (input: { image: HTMLVideoElement }) => Promise<void>,
 *   close?: () => Promise<void> | void,
 * }} FaceMeshInstance
 */

/** @typedef {new (options: { locateFile: (file: string) => string }) => FaceMeshInstance} FaceMeshConstructor */
/** @typedef {Window & { FaceMesh?: FaceMeshConstructor }} FaceMeshWindow */
/**
 * @typedef {{
 *   locateFile: (file: string) => string,
 *   getResolvedAssetUrls: () => string[],
 *   getExpectedAssetUrls: () => string[],
 *   getKnownAssetUrls: () => string[],
 * }} FaceMeshAssetTracker
 */

const FACE_MESH_SCRIPT_URL = versionedPublicAssetUrl('vendor/mediapipe/face_mesh/face_mesh.js');
export const FACE_MESH_INIT_TIMEOUT_MS = 18000;
export const FACE_MESH_INIT_TIMEOUT_CODE = 'FACE_MESH_INIT_TIMEOUT';

const FACE_MESH_EXPECTED_ASSET_FILES = [
  'face_mesh_solution_packed_assets_loader.js',
  'face_mesh_solution_packed_assets.data',
  'face_mesh_solution_simd_wasm_bin.js',
  'face_mesh_solution_simd_wasm_bin.wasm',
  'face_mesh_solution_simd_wasm_bin.data',
  'face_mesh_solution_wasm_bin.js',
  'face_mesh_solution_wasm_bin.wasm',
  'face_mesh.binarypb',
];

export class FaceMeshAssetLoadTimeoutError extends Error {
  /**
   * @param {{
   *   timeoutMs: number,
   *   assetUrls: readonly string[],
   *   resolvedAssetUrls: readonly string[],
   *   expectedAssetUrls: readonly string[],
   * }} options
   */
  constructor({ timeoutMs, assetUrls, resolvedAssetUrls, expectedAssetUrls }) {
    const seconds = Math.round(timeoutMs / 1000);
    const waitingList = assetUrls.length ? `可能仍在等待：${assetUrls.join(', ')}` : '尚未取得資產 URL。';
    super(`臉部追蹤資產載入逾時（超過 ${seconds} 秒）。${waitingList}`);
    this.name = 'FaceMeshAssetLoadTimeoutError';
    /** @type {typeof FACE_MESH_INIT_TIMEOUT_CODE} */
    this.code = FACE_MESH_INIT_TIMEOUT_CODE;
    this.timeoutMs = timeoutMs;
    this.assetUrls = [...assetUrls];
    this.resolvedAssetUrls = [...resolvedAssetUrls];
    this.expectedAssetUrls = [...expectedAssetUrls];
  }
}

/** @type {Promise<FaceMeshConstructor> | null} */
let faceMeshScriptPromise = null;

/**
 * @returns {Promise<FaceMeshConstructor>}
 */
async function loadFaceMeshConstructor() {
  const faceMeshWindow = getFaceMeshWindow();
  if (faceMeshWindow.FaceMesh) {
    return faceMeshWindow.FaceMesh;
  }

  if (!faceMeshScriptPromise) {
    const scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = FACE_MESH_SCRIPT_URL;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        const loadedWindow = getFaceMeshWindow();
        if (loadedWindow.FaceMesh) {
          resolve(loadedWindow.FaceMesh);
          return;
        }

        if (faceMeshScriptPromise === scriptPromise) {
          faceMeshScriptPromise = null;
        }
        reject(new Error('MediaPipe FaceMesh 載入後沒有提供 FaceMesh 建構子。'));
      };
      script.onerror = () => {
        if (faceMeshScriptPromise === scriptPromise) {
          faceMeshScriptPromise = null;
        }
        const error = new Error(`無法載入 MediaPipe Face Mesh：${FACE_MESH_SCRIPT_URL}`);
        runtimeErrorReporter.captureError(error, {
          eventType: 'mediapipe.script_load_failed',
          feature: 'mediapipe',
          extra: {
            assetUrl: FACE_MESH_SCRIPT_URL,
          },
        });
        reject(error);
      };
      document.head.appendChild(script);
    });
    faceMeshScriptPromise = scriptPromise;
  }

  return faceMeshScriptPromise;
}

export class FaceTracker {
  /**
   * @param {{
   *   video: HTMLVideoElement,
   *   onResults?: FaceTrackerResultsHandler,
   *   onError?: (error: unknown) => void,
   *   onStatsUpdate?: (stats: TrackerStats) => void,
   * }} options
   */
  constructor({ video, onResults, onError, onStatsUpdate }) {
    this.video = video;
    this.onResults = onResults;
    this.onError = onError;
    this.onStatsUpdate = onStatsUpdate;
    /** @type {FaceMeshInstance | null} */
    this.faceMesh = null;
    this.isRunning = false;
    /** @type {number | null} */
    this.frameHandle = null;
    /** @type {TrackerStats['schedulerType']} */
    this.schedulerType = 'raf';
    this.isSendingFrame = false;
    this.selfieMode = true;
    this.inferenceConfig = normalizeInferenceConfig(TRACKING_TUNING.inference);
    this.currentFps = this.inferenceConfig.targetFps;
    this.lastInferenceStartedAt = 0;
    this.lastInferenceCompletedAt = 0;
    this.lastAdjustmentAt = 0;
    /** @type {number[]} */
    this.inferenceSamples = [];
    /** @type {TrackerStats} */
    this.stats = {
      currentFps: this.currentFps,
      targetFps: this.inferenceConfig.targetFps,
      averageInferenceMs: 0,
      lastInferenceMs: 0,
      skippedFrameCount: 0,
      inferenceCount: 0,
      schedulerType: this.schedulerType,
    };
  }

  /**
   * @returns {Promise<void>}
   */
  async init() {
    const assetTracker = createFaceMeshAssetTracker();

    try {
      this.faceMesh = await withTimeout(
        this.createInitializedFaceMesh(assetTracker),
        FACE_MESH_INIT_TIMEOUT_MS,
        () => new FaceMeshAssetLoadTimeoutError({
          timeoutMs: FACE_MESH_INIT_TIMEOUT_MS,
          assetUrls: assetTracker.getKnownAssetUrls(),
          resolvedAssetUrls: assetTracker.getResolvedAssetUrls(),
          expectedAssetUrls: assetTracker.getExpectedAssetUrls(),
        }),
      );
    } catch (error) {
      this.faceMesh = null;
      if (isFaceMeshInitTimeoutError(error)) {
        faceMeshScriptPromise = null;
      }
      runtimeErrorReporter.captureError(error, {
        eventType: isFaceMeshInitTimeoutError(error) ? 'mediapipe.init_timeout' : 'mediapipe.init_failed',
        feature: 'mediapipe',
        tags: {
          error_code: getErrorCode(error),
        },
        extra: {
          scriptUrl: FACE_MESH_SCRIPT_URL,
          selfieMode: this.selfieMode,
          timeoutMs: getErrorTimeoutMs(error),
          assetUrls: getErrorAssetUrls(error, assetTracker.getKnownAssetUrls()),
          resolvedAssetUrls: getErrorResolvedAssetUrls(error, assetTracker.getResolvedAssetUrls()),
          expectedAssetUrls: getErrorExpectedAssetUrls(error, assetTracker.getExpectedAssetUrls()),
        },
      });
      throw error;
    }
  }

  /**
   * @param {FaceMeshAssetTracker} assetTracker
   * @returns {Promise<FaceMeshInstance>}
   */
  async createInitializedFaceMesh(assetTracker) {
    const FaceMeshConstructor = await loadFaceMeshConstructor();

    const faceMesh = new FaceMeshConstructor({
      // Assets are copied from node_modules into public/vendor so the MVP does
      // not need a third-party CDN at runtime.
      locateFile: assetTracker.locateFile,
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.58,
      minTrackingConfidence: 0.58,
      // Internally flips the camera input when using the front-facing mirrored preview.
      selfieMode: this.selfieMode,
    });

    faceMesh.onResults((results) => {
      this.onResults?.(results);
    });

    await faceMesh.initialize();
    return faceMesh;
  }

  /**
   * @returns {Promise<void>}
   */
  async start() {
    if (!this.faceMesh) {
      await this.init();
    }

    if (this.isRunning) return;

    this.schedulerType = this.supportsVideoFrameCallback() ? 'video-frame' : 'raf';
    this.resetRuntimeStats();
    this.isRunning = true;
    this.scheduleNextFrame();
  }

  /**
   * @returns {void}
   */
  stop() {
    this.isRunning = false;
    this.cancelScheduledFrame();
  }

  /**
   * @returns {void}
   */
  pause() {
    this.stop();
  }

  /**
   * @returns {Promise<void>}
   */
  async resume() {
    await this.start();
  }

  /**
   * @returns {void}
   */
  scheduleNextFrame() {
    if (!this.isRunning) return;

    if (this.schedulerType === 'video-frame') {
      this.frameHandle = this.video.requestVideoFrameCallback(this.tickVideoFrame);
      return;
    }

    this.frameHandle = requestAnimationFrame(this.tickAnimationFrame);
  }

  /**
   * @returns {void}
   */
  cancelScheduledFrame() {
    if (this.frameHandle === null) return;

    if (this.schedulerType === 'video-frame' && this.video.cancelVideoFrameCallback) {
      this.video.cancelVideoFrameCallback(this.frameHandle);
    } else {
      cancelAnimationFrame(this.frameHandle);
    }

    this.frameHandle = null;
  }

  /**
   * @returns {boolean}
   */
  supportsVideoFrameCallback() {
    return (
      typeof this.video.requestVideoFrameCallback === 'function' &&
      typeof this.video.cancelVideoFrameCallback === 'function'
    );
  }

  /** @param {number} now */
  tickVideoFrame = async (now) => {
    this.frameHandle = null;
    await this.processFrameCandidate(now);
    this.scheduleNextFrame();
  };

  /** @param {number} now */
  tickAnimationFrame = async (now) => {
    this.frameHandle = null;
    await this.processFrameCandidate(now);
    this.scheduleNextFrame();
  };

  /**
   * @param {number} now
   * @returns {Promise<void>}
   */
  async processFrameCandidate(now) {
    if (!this.isRunning) return;

    if (this.canSendFrame(now)) {
      await this.sendFrame(now);
    } else if (this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      this.stats.skippedFrameCount += 1;
    }
  }

  /**
   * @param {number} now
   * @returns {boolean}
   */
  canSendFrame(now) {
    if (this.isSendingFrame) return false;
    if (this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return false;

    const intervalMs = 1000 / this.currentFps;
    return now - this.lastInferenceStartedAt >= intervalMs;
  }

  /**
   * @param {number} startedAt
   * @returns {Promise<void>}
   */
  async sendFrame(startedAt) {
    if (!this.faceMesh) return;

    this.isSendingFrame = true;
    this.lastInferenceStartedAt = startedAt;

    try {
      await this.faceMesh.send({ image: this.video });
    } catch (error) {
      runtimeErrorReporter.captureError(error, {
        eventType: 'mediapipe.inference_failed',
        feature: 'mediapipe',
        extra: {
          currentFps: this.currentFps,
          schedulerType: this.schedulerType,
        },
      });
      this.onError?.(error);
    } finally {
      const completedAt = performance.now();
      const inferenceMs = completedAt - startedAt;
      this.isSendingFrame = false;
      this.lastInferenceCompletedAt = completedAt;
      this.recordInferenceTiming(inferenceMs, completedAt);
    }
  }

  /**
   * @param {number} inferenceMs
   * @param {number} completedAt
   * @returns {void}
   */
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
      schedulerType: this.schedulerType,
    };

    this.adjustAdaptiveFps(averageInferenceMs, completedAt);
    this.emitStats();
  }

  /**
   * @param {number} averageInferenceMs
   * @param {number} now
   * @returns {void}
   */
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

  /**
   * @returns {TrackerStats}
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * @returns {void}
   */
  emitStats() {
    this.onStatsUpdate?.(this.getStats());
  }

  /**
   * @returns {void}
   */
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
      schedulerType: this.schedulerType,
    };
    this.emitStats();
  }

  /**
   * @param {boolean} isSelfieMode
   * @returns {void}
   */
  setSelfieMode(isSelfieMode) {
    this.selfieMode = Boolean(isSelfieMode);
    this.faceMesh?.setOptions({
      selfieMode: this.selfieMode,
    });
  }
}

/**
 * @param {Partial<InferenceTuning>} [config]
 * @returns {InferenceTuning}
 */
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

/**
 * @param {number | undefined} value
 * @param {number} min
 * @param {number} max
 * @param {number} fallback
 * @returns {number}
 */
function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

/**
 * @returns {FaceMeshAssetTracker}
 */
function createFaceMeshAssetTracker() {
  const resolvedAssetUrls = new Set([FACE_MESH_SCRIPT_URL]);
  const expectedAssetUrls = new Set([
    FACE_MESH_SCRIPT_URL,
    ...FACE_MESH_EXPECTED_ASSET_FILES.map(createFaceMeshAssetUrl),
  ]);

  return {
    locateFile(file) {
      const assetUrl = createFaceMeshAssetUrl(file);
      resolvedAssetUrls.add(assetUrl);
      expectedAssetUrls.add(assetUrl);
      return assetUrl;
    },
    getResolvedAssetUrls() {
      return [...resolvedAssetUrls];
    },
    getExpectedAssetUrls() {
      return [...expectedAssetUrls];
    },
    getKnownAssetUrls() {
      return [...new Set([...resolvedAssetUrls, ...expectedAssetUrls])];
    },
  };
}

/**
 * @param {string} file
 * @returns {string}
 */
function createFaceMeshAssetUrl(file) {
  return versionedPublicAssetUrl(`vendor/mediapipe/face_mesh/${file}`);
}

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {number} timeoutMs
 * @param {() => Error} createTimeoutError
 * @returns {Promise<T>}
 */
function withTimeout(promise, timeoutMs, createTimeoutError) {
  return new Promise((resolve, reject) => {
    let isSettled = false;
    const timeoutHandle = setTimeout(() => {
      if (isSettled) return;
      isSettled = true;
      reject(createTimeoutError());
    }, timeoutMs);

    promise.then(
      (value) => {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(timeoutHandle);
        resolve(value);
      },
      (error) => {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(timeoutHandle);
        reject(error);
      },
    );
  });
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
function isFaceMeshInitTimeoutError(error) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === FACE_MESH_INIT_TIMEOUT_CODE
  );
}

/**
 * @param {unknown} error
 * @returns {string | undefined}
 */
function getErrorCode(error) {
  if (!error || typeof error !== 'object' || !('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
}

/**
 * @param {unknown} error
 * @returns {number | undefined}
 */
function getErrorTimeoutMs(error) {
  if (!error || typeof error !== 'object' || !('timeoutMs' in error)) return undefined;
  return typeof error.timeoutMs === 'number' ? error.timeoutMs : undefined;
}

/**
 * @param {unknown} error
 * @param {string[]} fallback
 * @returns {string[]}
 */
function getErrorAssetUrls(error, fallback) {
  if (!error || typeof error !== 'object' || !('assetUrls' in error) || !Array.isArray(error.assetUrls)) {
    return fallback;
  }

  return error.assetUrls.filter((url) => typeof url === 'string');
}

/**
 * @param {unknown} error
 * @param {string[]} fallback
 * @returns {string[]}
 */
function getErrorResolvedAssetUrls(error, fallback) {
  if (
    !error ||
    typeof error !== 'object' ||
    !('resolvedAssetUrls' in error) ||
    !Array.isArray(error.resolvedAssetUrls)
  ) {
    return fallback;
  }

  return error.resolvedAssetUrls.filter((url) => typeof url === 'string');
}

/**
 * @param {unknown} error
 * @param {string[]} fallback
 * @returns {string[]}
 */
function getErrorExpectedAssetUrls(error, fallback) {
  if (
    !error ||
    typeof error !== 'object' ||
    !('expectedAssetUrls' in error) ||
    !Array.isArray(error.expectedAssetUrls)
  ) {
    return fallback;
  }

  return error.expectedAssetUrls.filter((url) => typeof url === 'string');
}

/**
 * @returns {FaceMeshWindow}
 */
function getFaceMeshWindow() {
  return /** @type {FaceMeshWindow} */ (window);
}
