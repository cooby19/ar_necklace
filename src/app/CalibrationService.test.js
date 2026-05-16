import { afterEach, describe, expect, it, vi } from 'vitest';
import { CalibrationService } from './CalibrationService.js';
import { DEFAULT_WEAR_CALIBRATION } from '../core/WearCalibration.js';

function createMemoryStorage({ available = true } = {}) {
  const data = new Map();

  return {
    getItem: vi.fn((key) => data.get(key) ?? null),
    setItem: vi.fn((key, value) => {
      if (!available) throw new Error('storage unavailable');
      data.set(key, String(value));
    }),
    removeItem: vi.fn((key) => {
      if (!available) throw new Error('storage unavailable');
      data.delete(key);
    }),
  };
}

function createService(storage) {
  globalThis.window = { localStorage: storage };

  return new CalibrationService({
    stageElement: {
      getBoundingClientRect: () => ({ width: 1000, height: 500 }),
    },
    pointerElement: {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.window;
});

describe('CalibrationService', () => {
  it('normalizes adjustments to safe limits', () => {
    const service = createService(createMemoryStorage());

    expect(
      service.normalizeAdjustments({
        horizontalOffset: 2,
        verticalOffset: -2,
        scaleMultiplier: 3,
        rotationOffset: Math.PI,
      }),
    ).toMatchObject({
      horizontalOffset: 0.28,
      verticalOffset: -0.28,
      scaleMultiplier: 1.6,
      rotationOffset: (35 * Math.PI) / 180,
    });
  });

  it('saves, loads, resets and hints when localStorage is available', () => {
    const service = createService(createMemoryStorage());
    const adjustments = {
      horizontalOffset: 0.02,
      verticalOffset: -0.04,
      scaleMultiplier: 1.12,
      rotationOffset: 0.08,
    };

    expect(service.getHint({ necklaceId: 'default-necklace' }).message).toBe(
      '偵測到臉後可拖曳項鍊微調，完成後儲存此款式校準。',
    );

    expect(service.save('default-necklace', adjustments)).toMatchObject({
      didSave: true,
      hint: {
        message: '已儲存此款式校準，下次開啟會自動套用。',
        options: { isSaved: true },
      },
    });
    expect(service.load('default-necklace')).toMatchObject({
      adjustments,
      hint: {
        message: '已套用此款式上次儲存的佩戴校準。',
        options: { isSaved: true },
      },
    });

    expect(service.markFaceReady('default-necklace')).toBeNull();
    expect(service.reset('default-necklace')).toEqual({
      adjustments: DEFAULT_WEAR_CALIBRATION,
      hint: {
        message: '已重設此款式校準，可重新拖曳或調整大小。',
      },
    });
  });

  it('keeps temporary calibration behavior when localStorage is unavailable', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const service = createService(createMemoryStorage({ available: false }));

    expect(service.save('default-necklace', { verticalOffset: 0.03 })).toMatchObject({
      didSave: false,
      hint: {
        message: 'localStorage 目前不可用，校準會暫時套用但不會保存。',
      },
    });
    expect(service.getHint({ dirty: true })).toEqual({
      message: 'localStorage 目前不可用，校準會暫時套用但不會保存。',
      options: { isDirty: true },
    });
  });

  it('prompts once after face tracking becomes ready without saved calibration', () => {
    const service = createService(createMemoryStorage());

    expect(service.markFaceReady('new-necklace')).toEqual({
      message: '已偵測到臉，可以直接拖曳項鍊，或用滑桿調整上下與大小。',
    });
    expect(service.markFaceReady('new-necklace')).toBeNull();
  });
});
