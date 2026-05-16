// @ts-check

import { TRACKING_TUNING } from '../config/tuning.js';
import { observeStageSize } from '../utils/stageResize.js';

/** @typedef {import('../types/domain').FaceLandmarkList} FaceLandmarkList */
/** @typedef {import('../types/domain').LandmarkPoint} LandmarkPoint */
/** @typedef {import('../types/domain').NecklaceDebugData} NecklaceDebugData */

export class DebugOverlay {
  /**
   * @param {{ canvas: HTMLCanvasElement, stageElement: HTMLElement }} options
   */
  constructor({ canvas, stageElement }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.stageElement = stageElement;
    this.isEnabled = false;
    this.dpr = 1;
    this.stopObservingStageSize = observeStageSize(this.stageElement, this.resize);
  }

  /**
   * @param {boolean} isEnabled
   * @returns {void}
   */
  setEnabled(isEnabled) {
    this.isEnabled = isEnabled;
    this.canvas.classList.toggle('is-visible', isEnabled);
    if (!isEnabled) this.clear();
  }

  /**
   * @param {FaceLandmarkList | null} landmarks
   * @param {NecklaceDebugData | null} debugData
   * @returns {void}
   */
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

  /**
   * @param {FaceLandmarkList} landmarks
   * @returns {void}
   */
  drawLandmarks(landmarks) {
    const { landmarkSampleStep, pointRadius } = TRACKING_TUNING.debug;
    for (let index = 0; index < landmarks.length; index += landmarkSampleStep) {
      this.drawPoint(landmarks[index], 'rgba(112, 201, 255, 0.62)', pointRadius);
    }
  }

  /**
   * @param {LandmarkPoint | null | undefined} point
   * @param {string} color
   * @param {number} radius
   * @returns {void}
   */
  drawPoint(point, color, radius) {
    const ctx = this.ctx;
    if (!point || !ctx) return;

    const { x, y } = this.toCanvas(point);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  /**
   * @param {LandmarkPoint} start
   * @param {LandmarkPoint} end
   * @param {string} color
   * @param {number} width
   * @returns {void}
   */
  drawLine(start, end, color, width) {
    const ctx = this.ctx;
    if (!ctx) return;

    const a = this.toCanvas(start);
    const b = this.toCanvas(end);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  /**
   * @param {LandmarkPoint} point
   * @returns {{ x: number, y: number }}
   */
  toCanvas(point) {
    const width = this.canvas.width / this.dpr;
    const height = this.canvas.height / this.dpr;
    return {
      // FaceTracker keeps Face Mesh coordinates aligned with the active camera preview.
      x: point.x * width,
      y: point.y * height,
    };
  }

  /** @returns {void} */
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
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  /**
   * @returns {void}
   */
  clear() {
    const ctx = this.ctx;
    if (!ctx) return;

    const width = this.canvas.width / this.dpr;
    const height = this.canvas.height / this.dpr;
    ctx.clearRect(0, 0, width, height);
  }

  /**
   * @returns {void}
   */
  dispose() {
    this.stopObservingStageSize?.();
  }
}
