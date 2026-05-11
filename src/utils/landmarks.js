export const FACE_LANDMARKS = {
  forehead: 10,
  chin: 152,
  leftCheek: 234,
  rightCheek: 454,
  noseTip: 1,
  faceCenter: 168,
};

export function getLandmark(landmarks, index) {
  return landmarks?.[index] ?? null;
}

export function distance2D(a, b) {
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function midpoint2D(a, b) {
  return {
    x: (a.x + b.x) * 0.5,
    y: (a.y + b.y) * 0.5,
    z: ((a.z ?? 0) + (b.z ?? 0)) * 0.5,
  };
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a, b, alpha) {
  return a + (b - a) * alpha;
}

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
  const yawSignal =
    noseTip && faceWidth > 0 ? clamp((noseTip.x - cheekCenter.x) / faceWidth, -0.6, 0.6) : 0;

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
    yawSignal,
  };
}
