const STORAGE_KEY = 'web-ar-necklace:wear-calibration:v1';

export const DEFAULT_WEAR_CALIBRATION = {
  horizontalOffset: 0,
  verticalOffset: 0,
  scaleMultiplier: 1,
  rotationOffset: 0,
};

const LIMITS = {
  horizontalOffset: [-0.28, 0.28],
  verticalOffset: [-0.28, 0.28],
  scaleMultiplier: [0.6, 1.6],
  rotationOffset: [(-35 * Math.PI) / 180, (35 * Math.PI) / 180],
};

export class WearCalibration {
  constructor({ storage } = {}) {
    try {
      this.storage = storage ?? window.localStorage;
    } catch (error) {
      this.storage = null;
    }
    this.isAvailable = this.checkStorageAvailability();
    this.cache = this.readAll();
  }

  get(necklaceId) {
    return this.normalize(this.cache[necklaceId]);
  }

  has(necklaceId) {
    return Boolean(this.cache[necklaceId]);
  }

  save(necklaceId, calibration) {
    if (!necklaceId) return false;

    const normalized = this.normalize(calibration);
    this.cache = {
      ...this.cache,
      [necklaceId]: normalized,
    };

    return this.persist();
  }

  reset(necklaceId) {
    if (!necklaceId) return this.getDefault();

    const nextCache = { ...this.cache };
    delete nextCache[necklaceId];
    this.cache = nextCache;
    this.persist();
    return this.getDefault();
  }

  getDefault() {
    return { ...DEFAULT_WEAR_CALIBRATION };
  }

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

  readAll() {
    if (!this.isAvailable) return {};

    try {
      const parsed = JSON.parse(this.storage.getItem(STORAGE_KEY) ?? '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      console.warn('[WearCalibration] 無法讀取 localStorage 校準資料', error);
      return {};
    }
  }

  persist() {
    if (!this.isAvailable) return false;

    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.cache));
      return true;
    } catch (error) {
      console.warn('[WearCalibration] 無法儲存 localStorage 校準資料', error);
      return false;
    }
  }

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

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}
