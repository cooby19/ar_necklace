import { lerp } from '../utils/landmarks.js';

export class ScalarSmoother {
  constructor(alpha, initialValue = 0) {
    this.alpha = alpha;
    this.value = initialValue;
    this.hasValue = false;
  }

  next(target) {
    if (!this.hasValue) {
      this.value = target;
      this.hasValue = true;
      return this.value;
    }

    this.value = lerp(this.value, target, this.alpha);
    return this.value;
  }

  reset() {
    this.hasValue = false;
  }
}

export class VectorSmoother {
  constructor(alpha, initialValue = { x: 0, y: 0, z: 0 }) {
    this.alpha = alpha;
    this.value = { ...initialValue };
    this.hasValue = false;
  }

  next(target) {
    if (!this.hasValue) {
      this.value = { ...target };
      this.hasValue = true;
      return { ...this.value };
    }

    this.value.x = lerp(this.value.x, target.x, this.alpha);
    this.value.y = lerp(this.value.y, target.y, this.alpha);
    this.value.z = lerp(this.value.z, target.z, this.alpha);
    return { ...this.value };
  }

  reset() {
    this.hasValue = false;
  }
}
