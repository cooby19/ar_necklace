import { clamp, formatSignedNumber, queryRequired } from './domHelpers.js';

export class CalibrationPanelView {
  constructor() {
    this.elements = {
      verticalOffsetRange: queryRequired('#verticalOffsetRange'),
      verticalOffsetValue: queryRequired('#verticalOffsetValue'),
      scaleRange: queryRequired('#scaleRange'),
      scaleValue: queryRequired('#scaleValue'),
      rotationRange: queryRequired('#rotationRange'),
      rotationValue: queryRequired('#rotationValue'),
      calibrationHint: queryRequired('#calibrationHint'),
      saveCalibrationButton: queryRequired('#saveCalibrationButton'),
      resetTuningButton: queryRequired('#resetTuningButton'),
    };
  }

  bind(handlers, listen) {
    listen(this.elements.verticalOffsetRange, 'input', () => handlers.onTuningInput?.());
    listen(this.elements.scaleRange, 'input', () => handlers.onTuningInput?.());
    listen(this.elements.rotationRange, 'input', () => handlers.onTuningInput?.());
    listen(this.elements.saveCalibrationButton, 'click', () => handlers.onSaveCalibration?.());
    listen(this.elements.resetTuningButton, 'click', () => handlers.onResetCalibration?.());
  }

  readControls() {
    const verticalOffset = Number(this.elements.verticalOffsetRange.value);
    const scale = Number(this.elements.scaleRange.value);
    const rotation = Number(this.elements.rotationRange.value);

    this.elements.verticalOffsetValue.textContent = formatSignedNumber(verticalOffset);
    this.elements.scaleValue.textContent = `${scale}%`;
    this.elements.rotationValue.textContent = `${formatSignedNumber(rotation)}°`;

    return {
      raw: {
        verticalOffset,
        scale,
        rotation,
      },
      adjustments: {
        verticalOffset: verticalOffset / 1000,
        scaleMultiplier: scale / 100,
        rotationOffset: (rotation * Math.PI) / 180,
      },
    };
  }

  resetControls(defaults) {
    this.elements.verticalOffsetRange.value = String(defaults.verticalOffset);
    this.elements.scaleRange.value = String(defaults.scale);
    this.elements.rotationRange.value = String(defaults.rotation);
    return this.readControls();
  }

  syncControlsFromAdjustments(adjustments = {}) {
    const verticalOffset = Math.round((adjustments.verticalOffset ?? 0) * 1000);
    const scale = Math.round((adjustments.scaleMultiplier ?? 1) * 100);
    const rotation = Math.round(((adjustments.rotationOffset ?? 0) * 180) / Math.PI);

    this.elements.verticalOffsetRange.value = String(clamp(verticalOffset, -200, 200));
    this.elements.scaleRange.value = String(clamp(scale, 80, 120));
    this.elements.rotationRange.value = String(clamp(rotation, -15, 15));
    return this.readControls();
  }

  setHint(message, { isDirty = false, isSaved = false } = {}) {
    this.elements.calibrationHint.textContent = message;
    this.elements.calibrationHint.classList.toggle('is-dirty', isDirty);
    this.elements.calibrationHint.classList.toggle('is-saved', isSaved);
  }
}
