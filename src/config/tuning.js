export const TRACKING_TUNING = {
  // Landmark assumptions:
  // - 234/454 approximate face side points for face width.
  // - 10/152 approximate forehead/chin points for face height.
  // - Necklace anchor sits below the chin by a fraction of face height.
  neckOffsetFromChin: 0.22,
  necklaceWidthToFaceWidth: 1.58,
  necklaceVerticalLift: -0.015,
  minVisibilityConfidence: 0.58,
  missingFaceFadeStep: 0.08,
  presentFaceFadeStep: 0.14,
  smoothing: {
    position: 0.28,
    scale: 0.22,
    rotation: 0.24,
    opacity: 0.2,
  },
  debug: {
    landmarkSampleStep: 6,
    pointRadius: 3,
  },
};
