// @ts-check

/** @typedef {import('../types/domain').FaceLandmarkList} FaceLandmarkList */
/** @typedef {import('../types/domain').FaceMetrics} FaceMetrics */
/** @typedef {import('../types/domain').LandmarkPoint} LandmarkPoint */

/** @satisfies {Record<string, number>} */
export const FACE_LANDMARKS = {
  forehead: 10,
  chin: 152,
  leftCheek: 234,
  rightCheek: 454,
  noseTip: 1,
  faceCenter: 168,
};

/**
 * @param {FaceLandmarkList | null | undefined} landmarks
 * @param {number} index
 * @returns {LandmarkPoint | null}
 */
export function getLandmark(landmarks, index) {
  return landmarks?.[index] ?? null;
}

/**
 * @param {LandmarkPoint | null | undefined} a
 * @param {LandmarkPoint | null | undefined} b
 * @returns {number}
 */
export function distance2D(a, b) {
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * @param {LandmarkPoint} a
 * @param {LandmarkPoint} b
 * @returns {Required<Pick<LandmarkPoint, 'x' | 'y' | 'z'>>}
 */
export function midpoint2D(a, b) {
  return {
    x: (a.x + b.x) * 0.5,
    y: (a.y + b.y) * 0.5,
    z: ((a.z ?? 0) + (b.z ?? 0)) * 0.5,
  };
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * @param {number} a
 * @param {number} b
 * @param {number} alpha
 * @returns {number}
 */
export function lerp(a, b, alpha) {
  return a + (b - a) * alpha;
}

/**
 * @param {FaceLandmarkList | null | undefined} landmarks
 * @returns {FaceMetrics | null}
 */
export function computeFaceMetrics(landmarks) {
  const chin = getLandmark(landmarks, FACE_LANDMARKS.chin);
  const forehead = getLandmark(landmarks, FACE_LANDMARKS.forehead);
  const leftCheek = getLandmark(landmarks, FACE_LANDMARKS.leftCheek);
  const rightCheek = getLandmark(landmarks, FACE_LANDMARKS.rightCheek);
  const noseTip = getLandmark(landmarks, FACE_LANDMARKS.noseTip);
  const centerFallback = getLandmark(landmarks, FACE_LANDMARKS.faceCenter);

  if (!chin || !forehead || !leftCheek || !rightCheek) {
    return null;
  }

  const cheekCenter = midpoint2D(leftCheek, rightCheek);
  const faceCenter = centerFallback ?? noseTip ?? cheekCenter;
  const faceWidth = distance2D(leftCheek, rightCheek);
  const faceHeight = distance2D(forehead, chin);
  const roll = Math.atan2(rightCheek.y - leftCheek.y, rightCheek.x - leftCheek.x);
  const noseYawSignal =
    noseTip && faceWidth > 0 ? clamp((noseTip.x - cheekCenter.x) / faceWidth, -0.6, 0.6) : 0;
  const cheekDepthYawSignal =
    faceWidth > 0
      ? clamp(((rightCheek.z ?? 0) - (leftCheek.z ?? 0)) / faceWidth, -0.6, 0.6)
      : 0;

  return {
    chin,
    forehead,
    leftCheek,
    rightCheek,
    faceCenter,
    cheekCenter,
    faceWidth,
    faceHeight,
    roll,
    yawSignal: noseYawSignal,
    noseYawSignal,
    cheekDepthYawSignal,
  };
}
