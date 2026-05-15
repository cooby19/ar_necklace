import { computeFaceMetrics } from '../utils/landmarks.js';

const DEFAULT_ADVICE = {
  id: 'ok',
  kind: 'tracking',
  label: '正在試戴',
  message: '貼合中，保持自然正面即可',
  priority: 0,
};

export class FaceQualityAdvisor {
  constructor({ video, sampleIntervalMs = 850 } = {}) {
    this.video = video;
    this.sampleIntervalMs = sampleIntervalMs;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 32;
    this.canvas.height = 24;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.lastBrightness = null;
    this.lastBrightnessSampleAt = 0;
    this.currentAdvice = DEFAULT_ADVICE;
    this.currentAdviceSetAt = 0;
    this.minAdviceHoldMs = 950;
  }

  getAdvice({ landmarks, debugData, now = performance.now() } = {}) {
    const brightness = this.sampleBrightness(now);
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

    if (darkAdvice && (!landmarks?.length || brightness < 42)) {
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
    ].filter(Boolean);

    if (!candidates.length) {
      return this.stabilize(DEFAULT_ADVICE, now);
    }

    candidates.sort((a, b) => b.priority - a.priority);
    return this.stabilize(candidates[0], now);
  }

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

  getAngleAdvice(metrics) {
    const roll = Math.abs(metrics.roll ?? 0);
    const yaw = Math.max(Math.abs(metrics.yawSignal ?? 0), Math.abs(metrics.rotationY ?? 0) / 1.6);
    if (roll <= 0.28 && yaw <= 0.32) return null;

    return {
      id: 'too-angled',
      kind: 'idle',
      label: '臉部角度過大',
      message: '請把臉轉正一點',
      priority: 78,
    };
  }

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

  sampleBrightness(now) {
    if (!this.canSampleVideo()) return this.lastBrightness;
    if (now - this.lastBrightnessSampleAt < this.sampleIntervalMs) return this.lastBrightness;

    this.lastBrightnessSampleAt = now;

    try {
      this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      const data = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
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

  canSampleVideo() {
    return (
      this.video &&
      this.ctx &&
      this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      this.video.videoWidth > 0 &&
      this.video.videoHeight > 0
    );
  }

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
