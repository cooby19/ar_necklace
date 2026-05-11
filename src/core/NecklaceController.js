import { TRACKING_TUNING } from '../config/tuning.js';
import { ScalarSmoother, VectorSmoother } from './Smoother.js';
import { clamp, computeFaceMetrics, lerp } from '../utils/landmarks.js';

export class NecklaceController {
  constructor(scene) {
    this.scene = scene;
    this.positionSmoother = new VectorSmoother(TRACKING_TUNING.smoothing.position);
    this.scaleSmoother = new ScalarSmoother(TRACKING_TUNING.smoothing.scale, 1);
    this.rotationSmoother = new ScalarSmoother(TRACKING_TUNING.smoothing.rotation, 0);
    this.yawSmoother = new ScalarSmoother(TRACKING_TUNING.smoothing.yaw, 0);
    this.opacitySmoother = new ScalarSmoother(TRACKING_TUNING.smoothing.opacity, 0);
    this.adjustments = {
      verticalOffset: 0,
      scaleMultiplier: 1,
      rotationOffset: 0,
    };
    this.lastDebugData = null;
  }

  setAdjustments(adjustments) {
    this.adjustments = {
      ...this.adjustments,
      ...adjustments,
    };
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
    const targetScale = clamp(
      worldFaceWidth * TRACKING_TUNING.necklaceWidthToFaceWidth * this.adjustments.scaleMultiplier,
      0.18,
      2.4,
    );
    const targetRotation = -metrics.roll + this.adjustments.rotationOffset;
    const targetYaw = this.estimateYaw(metrics);
    const targetOpacity = shouldShowNecklace ? 1 : 0;

    const position = this.positionSmoother.next(worldPosition);
    const scale = this.scaleSmoother.next(targetScale);
    const rotationZ = this.rotationSmoother.next(targetRotation);
    const rotationY = this.yawSmoother.next(targetYaw);
    const opacity = this.opacitySmoother.next(targetOpacity);

    this.scene.updateTransform({ position, scale, rotationY, rotationZ });
    this.scene.setOpacity(opacity);

    this.lastDebugData = {
      ...metrics,
      neckPoint,
      worldPosition: position,
      scale,
      rotationY,
      rotationZ,
      opacity,
    };

    return this.lastDebugData;
  }

  estimateNeckPoint(metrics) {
    const sideAmount = Math.min(1, Math.abs(metrics.yawSignal) / 0.42);
    const sideNeckX = lerp(metrics.chin.x, metrics.cheekCenter.x, TRACKING_TUNING.yawAnchorBlend);
    const yawShift =
      -metrics.yawSignal * TRACKING_TUNING.yawDirection * TRACKING_TUNING.yawPositionShift;
    const x = lerp(metrics.chin.x, sideNeckX + yawShift, sideAmount);
    const y =
      metrics.chin.y +
      metrics.faceHeight * TRACKING_TUNING.neckOffsetFromChin +
      TRACKING_TUNING.necklaceVerticalLift +
      sideAmount * TRACKING_TUNING.sideViewVerticalLift;

    return {
      x,
      y: y + this.adjustments.verticalOffset,
      z: metrics.chin.z ?? 0,
    };
  }

  estimateYaw(metrics) {
    return clamp(
      metrics.yawSignal * TRACKING_TUNING.yawDirection * TRACKING_TUNING.yawStrength,
      -TRACKING_TUNING.maxYawRadians,
      TRACKING_TUNING.maxYawRadians,
    );
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
    this.yawSmoother.reset();
    this.opacitySmoother.reset();
    this.scene.setOpacity(0);
    this.lastDebugData = null;
  }
}
