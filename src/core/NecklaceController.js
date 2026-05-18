// @ts-check

import { TRACKING_TUNING } from '../config/tuning.js';
import { ScalarSmoother, VectorSmoother } from './Smoother.js';
import { clamp, computeFaceMetrics, lerp } from '../utils/landmarks.js';

/** @typedef {import('../types/domain').FaceLandmarkList} FaceLandmarkList */
/** @typedef {import('../types/domain').FaceMetrics} FaceMetrics */
/** @typedef {import('../types/domain').LandmarkPoint} LandmarkPoint */
/** @typedef {import('../types/domain').NecklaceDebugData} NecklaceDebugData */
/** @typedef {import('../types/domain').WearAdjustmentPatch} WearAdjustmentPatch */
/** @typedef {import('../types/domain').WearAdjustments} WearAdjustments */
/** @typedef {import('../types/scene-ports').NecklaceSceneTrackingPort} NecklaceSceneTrackingPort */

export class NecklaceController {
  /**
   * @param {NecklaceSceneTrackingPort} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.positionSmoother = new VectorSmoother(TRACKING_TUNING.smoothing.position);
    this.scaleSmoother = new ScalarSmoother(TRACKING_TUNING.smoothing.scale, 1);
    this.rotationSmoother = new ScalarSmoother(TRACKING_TUNING.smoothing.rotation, 0);
    this.yawSmoother = new ScalarSmoother(TRACKING_TUNING.smoothing.yaw, 0);
    this.opacitySmoother = new ScalarSmoother(TRACKING_TUNING.smoothing.opacity, 0);
    this.adjustments = {
      horizontalOffset: 0,
      verticalOffset: 0,
      scaleMultiplier: 1,
      rotationOffset: 0,
    };
    /** @type {NecklaceDebugData | null} */
    this.lastDebugData = null;
  }

  /**
   * @param {WearAdjustmentPatch} adjustments
   * @returns {void}
   */
  setAdjustments(adjustments) {
    this.adjustments = {
      ...this.adjustments,
      ...adjustments,
    };
  }

  /**
   * @param {FaceLandmarkList} landmarks
   * @param {boolean} shouldShowNecklace
   * @returns {NecklaceDebugData | null}
   */
  updateFromLandmarks(landmarks, shouldShowNecklace) {
    const metrics = computeFaceMetrics(landmarks);
    if (!metrics || metrics.faceWidth <= 0 || metrics.faceHeight <= 0) {
      this.fadeOut();
      return null;
    }

    const yawSignal = this.estimateYawSignal(metrics);
    const sideAmount = this.getSideAmount(yawSignal);
    const neckPoint = this.estimateNeckPoint(metrics, yawSignal, sideAmount);
    const worldPosition = this.scene.screenToWorld(neckPoint);
    const worldFaceWidth = this.estimateFaceWidthForScale(metrics, sideAmount);
    const targetScale = clamp(
      worldFaceWidth * TRACKING_TUNING.necklaceWidthToFaceWidth * this.adjustments.scaleMultiplier,
      0.18,
      2.4,
    );
    const targetRotation = -metrics.roll + this.adjustments.rotationOffset;
    const targetYaw = this.estimateYaw(yawSignal);
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
      yawSignal,
      neckPoint,
      worldPosition: position,
      scale,
      rotationY,
      rotationZ,
      opacity,
    };

    return this.lastDebugData;
  }

  /**
   * @param {FaceMetrics} metrics
   * @param {number} yawSignal
   * @param {number} sideAmount
   * @returns {LandmarkPoint}
   */
  estimateNeckPoint(metrics, yawSignal, sideAmount) {
    const sideNeckX = lerp(metrics.chin.x, metrics.cheekCenter.x, TRACKING_TUNING.yawAnchorBlend);
    const yawShift = -yawSignal * TRACKING_TUNING.yawDirection * TRACKING_TUNING.yawPositionShift;
    const x = lerp(metrics.chin.x, sideNeckX + yawShift, sideAmount);
    const y =
      metrics.chin.y +
      metrics.faceHeight * TRACKING_TUNING.neckOffsetFromChin +
      TRACKING_TUNING.necklaceVerticalLift +
      sideAmount * TRACKING_TUNING.sideViewVerticalLift;

    return {
      x: x + this.adjustments.horizontalOffset,
      y: y + this.adjustments.verticalOffset,
      z: metrics.chin.z ?? 0,
    };
  }

  /**
   * @param {FaceMetrics} metrics
   * @param {number} sideAmount
   * @returns {number}
   */
  estimateFaceWidthForScale(metrics, sideAmount) {
    const measuredWidth = this.scene.normalizedSegmentToWorldLength(
      metrics.leftCheek,
      metrics.rightCheek,
    );
    const faceHeight = this.scene.normalizedSegmentToWorldLength(metrics.forehead, metrics.chin);
    const heightBasedWidth = faceHeight * TRACKING_TUNING.scaleWidthFromFaceHeight;

    if (heightBasedWidth <= 0) return measuredWidth;

    const cappedMeasuredWidth = clamp(
      measuredWidth,
      heightBasedWidth * TRACKING_TUNING.scaleWidthMinFromHeight,
      heightBasedWidth * TRACKING_TUNING.scaleWidthMaxFromHeight,
    );
    const heightBlend = sideAmount * TRACKING_TUNING.sideScaleHeightBlend;
    return lerp(cappedMeasuredWidth, heightBasedWidth, heightBlend);
  }

  /**
   * @param {FaceMetrics} metrics
   * @returns {number}
   */
  estimateYawSignal(metrics) {
    let depthYawSignal = metrics.cheekDepthYawSignal * TRACKING_TUNING.yawDepthStrength;
    const noseYawSignal = metrics.noseYawSignal;

    if (
      Math.abs(noseYawSignal) > 0.04 &&
      Math.abs(depthYawSignal) > 0.04 &&
      Math.sign(noseYawSignal) !== Math.sign(depthYawSignal)
    ) {
      depthYawSignal *= -1;
    }

    return clamp(
      noseYawSignal * TRACKING_TUNING.yawNoseWeight +
        depthYawSignal * TRACKING_TUNING.yawDepthWeight,
      -0.6,
      0.6,
    );
  }

  /**
   * @param {number} yawSignal
   * @returns {number}
   */
  getSideAmount(yawSignal) {
    return Math.min(1, Math.abs(yawSignal) / 0.42);
  }

  /**
   * @param {number} yawSignal
   * @returns {number}
   */
  estimateYaw(yawSignal) {
    return clamp(
      yawSignal * TRACKING_TUNING.yawDirection * TRACKING_TUNING.yawStrength,
      -TRACKING_TUNING.maxYawRadians,
      TRACKING_TUNING.maxYawRadians,
    );
  }

  /**
   * @returns {void}
   */
  fadeOut() {
    const opacity = this.opacitySmoother.next(0);
    this.scene.setOpacity(opacity);
    this.lastDebugData = null;
  }

  /**
   * @returns {void}
   */
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
