// @ts-check

/** @typedef {import('../types/domain').WearAdjustments} WearAdjustments */
/** @typedef {import('../types/domain').WearAdjustmentPatch} WearAdjustmentPatch */
/** @typedef {{ getItem: Storage['getItem'], setItem: Storage['setItem'], removeItem: Storage['removeItem'] }} StorageLike */
/** @typedef {Record<string, WearAdjustmentPatch>} CalibrationCache */

const STORAGE_KEY = 'web-ar-necklace:wear-calibration:v1';

/** @satisfies {WearAdjustments} */
export const DEFAULT_WEAR_CALIBRATION = {
  horizontalOffset: 0,
  verticalOffset: 0,
  scaleMultiplier: 1,
  rotationOffset: 0,
};

/** @type {Record<keyof WearAdjustments, readonly [number, number]>} */
const LIMITS = {
  horizontalOffset: [-0.28, 0.28],
  verticalOffset: [-0.28, 0.28],
  scaleMultiplier: [0.6, 1.6],
  rotationOffset: [(-35 * Math.PI) / 180, (35 * Math.PI) / 180],
};

export class WearCalibration {
  /**
   * @param {{ storage?: StorageLike | null }} [options]
   */
  constructor({ storage } = {}) {
    try {
      this.storage = storage ?? window.localStorage;
    } catch (error) {
      this.storage = null;
    }
    this.isAvailable = this.checkStorageAvailability();
    /** @type {CalibrationCache} */
    this.cache = this.readAll();
  }

  /**
   * @param {string} necklaceId
   * @returns {WearAdjustments}
   */
  get(necklaceId) {
    return this.normalize(this.cache[necklaceId]);
  }

  /**
   * @param {string} necklaceId
   * @returns {boolean}
   */
  has(necklaceId) {
    return Boolean(this.cache[necklaceId]);
  }

  /**
   * @param {string} necklaceId
   * @param {WearAdjustmentPatch} calibration
   * @returns {boolean}
   */
  save(necklaceId, calibration) {
    if (!necklaceId) return false;

    const normalized = this.normalize(calibration);
    this.cache = {
      ...this.cache,
      [necklaceId]: normalized,
    };

    return this.persist();
  }

  /**
   * @param {string} necklaceId
   * @returns {WearAdjustments}
   */
  reset(necklaceId) {
    if (!necklaceId) return this.getDefault();

    const nextCache = { ...this.cache };
    delete nextCache[necklaceId];
    this.cache = nextCache;
    this.persist();
    return this.getDefault();
  }

  /**
   * @returns {WearAdjustments}
   */
  getDefault() {
    return { ...DEFAULT_WEAR_CALIBRATION };
  }

  /**
   * @param {WearAdjustmentPatch} [calibration]
   * @returns {WearAdjustments}
   */
  normalize(calibration = {}) {
    return {
      horizontalOffset: clampNumber(
        calibration.horizontalOffset,
        LIMITS.horizontalOffset[0],
        LIMITS.horizontalOffset[1],
        DEFAULT_WEAR_CALIBRATION.horizontalOffset,
      ),
      verticalOffset: clampNumber(
        calibration.verticalOffset,
        LIMITS.verticalOffset[0],
        LIMITS.verticalOffset[1],
        DEFAULT_WEAR_CALIBRATION.verticalOffset,
      ),
      scaleMultiplier: clampNumber(
        calibration.scaleMultiplier,
        LIMITS.scaleMultiplier[0],
        LIMITS.scaleMultiplier[1],
        DEFAULT_WEAR_CALIBRATION.scaleMultiplier,
      ),
      rotationOffset: clampNumber(
        calibration.rotationOffset,
        LIMITS.rotationOffset[0],
        LIMITS.rotationOffset[1],
        DEFAULT_WEAR_CALIBRATION.rotationOffset,
      ),
    };
  }

  /**
   * @returns {CalibrationCache}
   */
  readAll() {
    const storage = this.storage;
    if (!this.isAvailable || !storage) return {};

    try {
      const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}');
      return parsed && typeof parsed === 'object' ? /** @type {CalibrationCache} */ (parsed) : {};
    } catch (error) {
      console.warn('[WearCalibration] 無法讀取 localStorage 校準資料', error);
      return {};
    }
  }

  /**
   * @returns {boolean}
   */
  persist() {
    const storage = this.storage;
    if (!this.isAvailable || !storage) return false;

    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(this.cache));
      return true;
    } catch (error) {
      console.warn('[WearCalibration] 無法儲存 localStorage 校準資料', error);
      return false;
    }
  }

  /**
   * @returns {boolean}
   */
  checkStorageAvailability() {
    if (!this.storage) return false;

    try {
      const testKey = `${STORAGE_KEY}:test`;
      this.storage.setItem(testKey, '1');
      this.storage.removeItem(testKey);
      return true;
    } catch (error) {
      console.warn('[WearCalibration] localStorage 不可用，校準只會保留在本次操作中', error);
      return false;
    }
  }
}

/**
 * @param {number | undefined} value
 * @param {number} min
 * @param {number} max
 * @param {number} fallback
 * @returns {number}
 */
function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}
