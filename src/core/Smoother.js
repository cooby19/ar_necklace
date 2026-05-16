// @ts-check

import { lerp } from '../utils/landmarks.js';

/** @typedef {Required<Pick<import('../types/domain').LandmarkPoint, 'x' | 'y' | 'z'>>} VectorPoint */

export class ScalarSmoother {
  /**
   * @param {number} alpha
   * @param {number} [initialValue]
   */
  constructor(alpha, initialValue = 0) {
    this.alpha = alpha;
    this.value = initialValue;
    this.hasValue = false;
  }

  /**
   * @param {number} target
   * @returns {number}
   */
  next(target) {
    if (!this.hasValue) {
      this.value = target;
      this.hasValue = true;
      return this.value;
    }

    this.value = lerp(this.value, target, this.alpha);
    return this.value;
  }

  /**
   * @returns {void}
   */
  reset() {
    this.hasValue = false;
  }
}

export class VectorSmoother {
  /**
   * @param {number} alpha
   * @param {VectorPoint} [initialValue]
   */
  constructor(alpha, initialValue = { x: 0, y: 0, z: 0 }) {
    this.alpha = alpha;
    this.value = { ...initialValue };
    this.hasValue = false;
  }

  /**
   * @param {VectorPoint} target
   * @returns {VectorPoint}
   */
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

  /**
   * @returns {void}
   */
  reset() {
    this.hasValue = false;
  }
}
