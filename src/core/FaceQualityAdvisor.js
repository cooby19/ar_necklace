// @ts-check

import { computeFaceMetrics } from '../utils/landmarks.js';

/** @typedef {import('../types/domain').FaceLandmarkList} FaceLandmarkList */
/** @typedef {import('../types/domain').FaceMetrics} FaceMetrics */
/** @typedef {import('../types/domain').FaceTrackingAdvice} FaceTrackingAdvice */
/** @typedef {import('../types/domain').NecklaceDebugData} NecklaceDebugData */

/** @satisfies {FaceTrackingAdvice} */
const DEFAULT_ADVICE = {
  id: 'ok',
  kind: 'tracking',
  label: '正在試戴',
  message: '貼合中，保持自然正面即可',
  priority: 0,
};

export class FaceQualityAdvisor {
  /**
   * @param {{ video?: HTMLVideoElement | null, sampleIntervalMs?: number }} [options]
   */
  constructor({ video, sampleIntervalMs = 850 } = {}) {
    this.video = video;
    this.sampleIntervalMs = sampleIntervalMs;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 32;
    this.canvas.height = 24;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.lastBrightness = null;
    this.lastBrightnessSampleAt = 0;
    /** @type {FaceTrackingAdvice} */
    this.currentAdvice = DEFAULT_ADVICE;
    this.currentAdviceSetAt = 0;
    this.minAdviceHoldMs = 950;
  }

  /**
   * @param {{
   *   landmarks?: FaceLandmarkList | null,
   *   debugData?: NecklaceDebugData | null,
   *   now?: number,
   * }} [input]
   * @returns {FaceTrackingAdvice}
   */
  getAdvice({ landmarks, debugData, now = performance.now() } = {}) {
    const brightness = this.sampleBrightness(now);
    /** @type {FaceTrackingAdvice | null} */
    const darkAdvice =
      brightness !== null && brightness < 48
        ? {
            id: 'too-dark',
            kind: 'idle',
            label: '光線偏暗',
            message: '光線再亮一點會更穩',
            priority: 90,
          }
        : null;

    if (darkAdvice && (!landmarks?.length || (brightness !== null && brightness < 42))) {
      return this.stabilize(darkAdvice, now);
    }

    if (!landmarks?.length) {
      return this.stabilize(
        {
          id: 'no-face',
          kind: 'idle',
          label: '請面向鏡頭',
          message: '請面向鏡頭，我正在尋找臉部',
          priority: 70,
        },
        now,
      );
    }

    const metrics = debugData ?? computeFaceMetrics(landmarks);
    if (!metrics) {
      return this.stabilize(
        {
          id: 'face-not-ready',
          kind: 'idle',
          label: '貼合準備中',
          message: '等待臉部資訊穩定',
          priority: 60,
        },
        now,
      );
    }

    const candidates = [
      darkAdvice,
      this.getDistanceAdvice(metrics),
      this.getAngleAdvice(metrics),
      this.getCenterAdvice(metrics),
    ].filter(isAdvice);

    if (!candidates.length) {
      return this.stabilize(DEFAULT_ADVICE, now);
    }

    candidates.sort((a, b) => b.priority - a.priority);
    return this.stabilize(candidates[0], now);
  }

  /**
   * @param {FaceMetrics | NecklaceDebugData} metrics
   * @returns {FaceTrackingAdvice | null}
   */
  getDistanceAdvice(metrics) {
    const faceWidth = metrics.faceWidth ?? 0;
    const faceHeight = metrics.faceHeight ?? 0;
    if (faceWidth >= 0.16 && faceHeight >= 0.2) return null;

    return {
      id: 'too-far',
      kind: 'idle',
      label: '靠近一點',
      message: '靠近一點，項鍊會更準',
      priority: 84,
    };
  }

  /**
   * @param {FaceMetrics | NecklaceDebugData} metrics
   * @returns {FaceTrackingAdvice | null}
   */
  getAngleAdvice(metrics) {
    const roll = Math.abs(metrics.roll ?? 0);
    const rotationY = 'rotationY' in metrics ? metrics.rotationY : 0;
    const yaw = Math.max(Math.abs(metrics.yawSignal ?? 0), Math.abs(rotationY) / 1.6);
    if (roll <= 0.28 && yaw <= 0.32) return null;

    return {
      id: 'too-angled',
      kind: 'idle',
      label: '臉部角度過大',
      message: '請把臉轉正一點',
      priority: 78,
    };
  }

  /**
   * @param {FaceMetrics | NecklaceDebugData} metrics
   * @returns {FaceTrackingAdvice | null}
   */
  getCenterAdvice(metrics) {
    const center = metrics.faceCenter ?? metrics.cheekCenter;
    if (!center) return null;

    const offsetX = Math.abs(center.x - 0.5);
    const offsetY = Math.abs(center.y - 0.48);
    if (offsetX <= 0.18 && offsetY <= 0.2) return null;

    return {
      id: 'off-center',
      kind: 'idle',
      label: '臉不在中央',
      message: '請把臉移到畫面中央',
      priority: 74,
    };
  }

  /**
   * @param {number} now
   * @returns {number | null}
   */
  sampleBrightness(now) {
    const video = this.video;
    const ctx = this.ctx;
    if (!video || !ctx || !this.canSampleVideo()) return this.lastBrightness;
    if (now - this.lastBrightnessSampleAt < this.sampleIntervalMs) return this.lastBrightness;

    this.lastBrightnessSampleAt = now;

    try {
      ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
      const data = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
      let total = 0;

      for (let index = 0; index < data.length; index += 4) {
        total += data[index] * 0.2126 + data[index + 1] * 0.7152 + data[index + 2] * 0.0722;
      }

      this.lastBrightness = total / (data.length / 4);
    } catch (error) {
      this.lastBrightness = null;
    }

    return this.lastBrightness;
  }

  /**
   * @returns {boolean}
   */
  canSampleVideo() {
    return Boolean(
      this.video &&
      this.ctx &&
      this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      this.video.videoWidth > 0 &&
      this.video.videoHeight > 0,
    );
  }

  /**
   * @param {FaceTrackingAdvice} nextAdvice
   * @param {number} now
   * @returns {FaceTrackingAdvice}
   */
  stabilize(nextAdvice, now) {
    const current = this.currentAdvice ?? DEFAULT_ADVICE;
    const canSwitch =
      nextAdvice.id === current.id ||
      now - this.currentAdviceSetAt >= this.minAdviceHoldMs ||
      nextAdvice.priority >= current.priority + 18;

    if (canSwitch) {
      this.currentAdvice = nextAdvice;
      this.currentAdviceSetAt = nextAdvice.id === current.id ? this.currentAdviceSetAt : now;
    }

    return this.currentAdvice;
  }
}

/**
 * @param {FaceTrackingAdvice | null} advice
 * @returns {advice is FaceTrackingAdvice}
 */
function isAdvice(advice) {
  return Boolean(advice);
}
