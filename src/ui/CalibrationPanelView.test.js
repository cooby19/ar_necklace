import { afterEach, describe, expect, it } from 'vitest';
import { CalibrationPanelView } from './CalibrationPanelView.js';
import { cleanupFakeDocument, installFakeDocument } from './test/fakeDom.js';

afterEach(() => {
  cleanupFakeDocument();
});

describe('CalibrationPanelView', () => {
  it('reads slider values into raw values and wear adjustments', () => {
    installFakeDocument();
    const view = new CalibrationPanelView();

    view.elements.verticalOffsetRange.value = '25';
    view.elements.scaleRange.value = '110';
    view.elements.rotationRange.value = '-6';

    const result = view.readControls();

    expect(result.raw).toEqual({
      verticalOffset: 25,
      scale: 110,
      rotation: -6,
    });
    expect(result.adjustments.verticalOffset).toBe(0.025);
    expect(result.adjustments.scaleMultiplier).toBe(1.1);
    expect(result.adjustments.rotationOffset).toBeCloseTo((-6 * Math.PI) / 180);
    expect(view.elements.verticalOffsetValue.textContent).toBe('+25');
    expect(view.elements.scaleValue.textContent).toBe('110%');
    expect(view.elements.rotationValue.textContent).toBe('-6°');
  });

  it('converts adjustments back into clamped slider values', () => {
    installFakeDocument();
    const view = new CalibrationPanelView();

    const result = view.syncControlsFromAdjustments({
      verticalOffset: 0.5,
      scaleMultiplier: 0.5,
      rotationOffset: Math.PI,
    });

    expect(result.raw).toEqual({
      verticalOffset: 200,
      scale: 80,
      rotation: 15,
    });
    expect(view.elements.verticalOffsetValue.textContent).toBe('+200');
    expect(view.elements.scaleValue.textContent).toBe('80%');
    expect(view.elements.rotationValue.textContent).toBe('+15°');
  });
});
