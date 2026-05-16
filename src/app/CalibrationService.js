import { WearCalibration } from '../core/WearCalibration.js';

export class CalibrationService {
  constructor({ stageElement, pointerElement }) {
    this.stageElement = stageElement;
    this.pointerElement = pointerElement;
    this.wearCalibration = new WearCalibration();
    this.drag = null;
    this.promptedIds = new Set();
  }

  startDrag(event, state) {
    if (!this.canStartDrag(state)) return false;

    this.pointerElement.setPointerCapture?.(event.pointerId);
    this.drag = {
      pointerId: event.pointerId,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
    };
    event.preventDefault();
    return true;
  }

  updateDrag(event, currentAdjustments = {}) {
    if (!this.drag || this.drag.pointerId !== event.pointerId) return null;

    const rect = this.stageElement.getBoundingClientRect();
    const deltaX = rect.width > 0 ? (event.clientX - this.drag.lastClientX) / rect.width : 0;
    const deltaY = rect.height > 0 ? (event.clientY - this.drag.lastClientY) / rect.height : 0;
    this.drag.lastClientX = event.clientX;
    this.drag.lastClientY = event.clientY;

    event.preventDefault();
    return {
      adjustments: this.normalizeAdjustments({
        ...currentAdjustments,
        horizontalOffset: (currentAdjustments.horizontalOffset ?? 0) + deltaX,
        verticalOffset: (currentAdjustments.verticalOffset ?? 0) + deltaY,
      }),
      hint: this.getHint({ dirty: true }),
    };
  }

  endDrag(event) {
    if (!this.drag || this.drag.pointerId !== event.pointerId) return false;

    this.pointerElement.releasePointerCapture?.(event.pointerId);
    this.drag = null;
    return true;
  }

  cancelDrag() {
    this.drag = null;
  }

  canStartDrag(state) {
    return Boolean(state.cameraStarted && state.modelLoaded && state.hasFace && state.necklaceVisible);
  }

  load(necklaceId) {
    const adjustments = this.wearCalibration.get(necklaceId);
    return {
      adjustments,
      hint: this.getHint({ necklaceId }),
    };
  }

  save(necklaceId, adjustments) {
    const didSave = this.wearCalibration.save(necklaceId, adjustments);

    return {
      didSave,
      hint: didSave
        ? {
            message: '已儲存此款式校準，下次開啟會自動套用。',
            options: { isSaved: true },
          }
        : {
            message: 'localStorage 目前不可用，校準會暫時套用但不會保存。',
          },
    };
  }

  reset(necklaceId) {
    const adjustments = this.wearCalibration.reset(necklaceId);
    return {
      adjustments,
      hint: {
        message: '已重設此款式校準，可重新拖曳或調整大小。',
      },
    };
  }

  mergeAdjustments(currentAdjustments = {}, nextAdjustments = {}) {
    return this.normalizeAdjustments({
      ...currentAdjustments,
      ...nextAdjustments,
    });
  }

  normalizeAdjustments(adjustments) {
    return this.wearCalibration.normalize(adjustments);
  }

  markFaceReady(necklaceId) {
    if (this.promptedIds.has(necklaceId)) return null;

    this.promptedIds.add(necklaceId);
    if (this.hasCalibration(necklaceId)) return null;

    return {
      message: '已偵測到臉，可以直接拖曳項鍊，或用滑桿調整上下與大小。',
    };
  }

  getHint({ necklaceId, dirty = false } = {}) {
    if (!this.wearCalibration.isAvailable) {
      return {
        message: 'localStorage 目前不可用，校準會暫時套用但不會保存。',
        options: { isDirty: dirty },
      };
    }

    if (dirty) {
      return {
        message: '已套用到預覽，記得按「儲存校準」保留此款式設定。',
        options: { isDirty: true },
      };
    }

    if (necklaceId && this.hasCalibration(necklaceId)) {
      return {
        message: '已套用此款式上次儲存的佩戴校準。',
        options: { isSaved: true },
      };
    }

    return {
      message: '偵測到臉後可拖曳項鍊微調，完成後儲存此款式校準。',
    };
  }

  hasCalibration(necklaceId) {
    return this.wearCalibration.has(necklaceId);
  }
}
