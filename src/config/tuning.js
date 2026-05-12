export const TRACKING_TUNING = {
  // Landmark assumptions:
  // - 234/454 approximate face side points for face width.
  // - 10/152 approximate forehead/chin points for face height.
  // - Necklace anchor sits below the chin by a fraction of face height.
  neckOffsetFromChin: 0.22,
  necklaceWidthToFaceWidth: 1.58,
  necklaceVerticalLift: -0.015,
  scaleWidthFromFaceHeight: 0.78,
  scaleWidthMinFromHeight: 0.64,
  scaleWidthMaxFromHeight: 1.08,
  sideScaleHeightBlend: 0.72,
  yawStrength: 1.6,
  yawDirection: 1,
  yawNoseWeight: 0.45,
  yawDepthWeight: 0.55,
  yawDepthStrength: 1.35,
  maxYawRadians: 1.05,
  yawAnchorBlend: 0.72,
  yawPositionShift: 0.045,
  sideViewVerticalLift: -0.035,
  minVisibilityConfidence: 0.58,
  missingFaceFadeStep: 0.08,
  presentFaceFadeStep: 0.14,
  smoothing: {
    position: 0.28,
    scale: 0.22,
    rotation: 0.24,
    yaw: 0.18,
    opacity: 0.2,
  },
  debug: {
    landmarkSampleStep: 6,
    pointRadius: 3,
  },
};
