import { TRACKING_TUNING } from '../config/tuning.js';
import { observeStageSize } from '../utils/stageResize.js';

export class DebugOverlay {
  constructor({ canvas, stageElement }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.stageElement = stageElement;
    this.isEnabled = false;
    this.dpr = 1;
    this.stopObservingStageSize = observeStageSize(this.stageElement, this.resize);
  }

  setEnabled(isEnabled) {
    this.isEnabled = isEnabled;
    this.canvas.classList.toggle('is-visible', isEnabled);
    if (!isEnabled) this.clear();
  }

  render(landmarks, debugData) {
    if (!this.isEnabled) return;
    this.resize();
    this.clear();

    if (!landmarks?.length) {
      return;
    }

    this.drawLandmarks(landmarks);

    if (debugData) {
      this.drawPoint(debugData.chin, '#ffda7b', 7);
      this.drawPoint(debugData.neckPoint, '#64d491', 8);
      this.drawLine(debugData.leftCheek, debugData.rightCheek, 'rgba(255, 218, 123, 0.85)', 2);
      this.drawLine(debugData.chin, debugData.neckPoint, 'rgba(100, 212, 145, 0.85)', 2);
    }
  }

  drawLandmarks(landmarks) {
    const { landmarkSampleStep, pointRadius } = TRACKING_TUNING.debug;
    for (let index = 0; index < landmarks.length; index += landmarkSampleStep) {
      this.drawPoint(landmarks[index], 'rgba(112, 201, 255, 0.62)', pointRadius);
    }
  }

  drawPoint(point, color, radius) {
    if (!point) return;
    const { x, y } = this.toCanvas(point);
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  drawLine(start, end, color, width) {
    const a = this.toCanvas(start);
    const b = this.toCanvas(end);
    this.ctx.beginPath();
    this.ctx.moveTo(a.x, a.y);
    this.ctx.lineTo(b.x, b.y);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.stroke();
  }

  toCanvas(point) {
    const width = this.canvas.width / this.dpr;
    const height = this.canvas.height / this.dpr;
    return {
      // FaceTracker keeps Face Mesh coordinates aligned with the active camera preview.
      x: point.x * width,
      y: point.y * height,
    };
  }

  resize = () => {
    const rect = this.stageElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const targetWidth = Math.round(width * dpr);
    const targetHeight = Math.round(height * dpr);

    if (this.canvas.width === targetWidth && this.canvas.height === targetHeight && this.dpr === dpr) return;

    this.dpr = dpr;
    this.canvas.width = targetWidth;
    this.canvas.height = targetHeight;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  clear() {
    const width = this.canvas.width / this.dpr;
    const height = this.canvas.height / this.dpr;
    this.ctx.clearRect(0, 0, width, height);
  }

  dispose() {
    this.stopObservingStageSize?.();
  }
}
