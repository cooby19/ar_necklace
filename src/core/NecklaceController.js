import { TRACKING_TUNING } from '../config/tuning.js';
import { ScalarSmoother, VectorSmoother } from './Smoother.js';
import { clamp, computeFaceMetrics } from '../utils/landmarks.js';

export class NecklaceController {
  constructor(scene) {
    this.scene = scene;
    this.positionSmoother = new VectorSmoother(TRACKING_TUNING.smoothing.position);
    this.scaleSmoother = new ScalarSmoother(TRACKING_TUNING.smoothing.scale, 1);
    this.rotationSmoother = new ScalarSmoother(TRACKING_TUNING.smoothing.rotation, 0);
    this.opacitySmoother = new ScalarSmoother(TRACKING_TUNING.smoothing.opacity, 0);
    this.lastDebugData = null;
  }

  updateFromLandmarks(landmarks, shouldShowNecklace) {
    const metrics = computeFaceMetrics(landmarks);
    if (!metrics || metrics.faceWidth <= 0 || metrics.faceHeight <= 0) {
      this.fadeOut();
      return null;
    }

    const neckPoint = this.estimateNeckPoint(metrics);
    const worldPosition = this.scene.screenToWorld(neckPoint);
    const worldFaceWidth = this.scene.normalizedLengthToWorldX(metrics.faceWidth);
    const targetScale = clamp(worldFaceWidth * TRACKING_TUNING.necklaceWidthToFaceWidth, 0.18, 2.4);
    const targetRotation = -metrics.roll;
    const targetOpacity = shouldShowNecklace ? 1 : 0;

    const position = this.positionSmoother.next(worldPosition);
    const scale = this.scaleSmoother.next(targetScale);
    const rotationZ = this.rotationSmoother.next(targetRotation);
    const opacity = this.opacitySmoother.next(targetOpacity);

    this.scene.updateTransform({ position, scale, rotationZ });
    this.scene.setOpacity(opacity);

    this.lastDebugData = {
      ...metrics,
      neckPoint,
      worldPosition: position,
      scale,
      rotationZ,
      opacity,
    };

    return this.lastDebugData;
  }

  estimateNeckPoint(metrics) {
    return {
      x: metrics.chin.x,
      y:
        metrics.chin.y +
        metrics.faceHeight * TRACKING_TUNING.neckOffsetFromChin +
        TRACKING_TUNING.necklaceVerticalLift,
      z: metrics.chin.z ?? 0,
    };
  }

  fadeOut() {
    const opacity = this.opacitySmoother.next(0);
    this.scene.setOpacity(opacity);
    this.lastDebugData = null;
  }

  reset() {
    this.positionSmoother.reset();
    this.scaleSmoother.reset();
    this.rotationSmoother.reset();
    this.opacitySmoother.reset();
    this.scene.setOpacity(0);
    this.lastDebugData = null;
  }
}
