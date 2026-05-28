import { afterEach, describe, expect, it, vi } from 'vitest';
import { ColorPanelView } from './ColorPanelView.js';
import { cleanupFakeDocument, createChildElement, installFakeDocument } from './test/fakeDom.js';

afterEach(() => {
  cleanupFakeDocument();
});

describe('ColorPanelView', () => {
  it('syncs selected swatches and keyboard-selects the next enabled color', () => {
    installFakeDocument();
    const view = new ColorPanelView();
    const onColorSelect = vi.fn();
    view.bind({ onColorSelect }, listenDirectly);

    const group = createChildElement(view.elements.colorSwatches, 'div', {
      attributes: { role: 'radiogroup' },
    });
    const rose = createChildElement(group, 'button', {
      dataset: { colorId: 'rose-quartz', colorTargetId: 'gem' },
    });
    const amethyst = createChildElement(group, 'button', {
      dataset: { colorId: 'amethyst', colorTargetId: 'gem' },
    });

    view.syncSelection({
      selectedColorIdsByTarget: { gem: 'rose-quartz' },
      fallbackColorId: '',
    });

    expect(rose.classList.contains('is-selected')).toBe(true);
    expect(rose.tabIndex).toBe(0);
    expect(amethyst.tabIndex).toBe(-1);

    const event = view.elements.colorSwatches.dispatch('keydown', {
      key: 'ArrowRight',
      target: rose,
    });

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(amethyst);
    expect(onColorSelect).toHaveBeenCalledWith('amethyst', 'gem');
  });

  it('disables unavailable swatches and removes them from tab order', () => {
    installFakeDocument();
    const view = new ColorPanelView();
    const group = createChildElement(view.elements.colorSwatches, 'div', {
      attributes: { role: 'radiogroup' },
    });
    const rose = createChildElement(group, 'button', {
      dataset: { colorId: 'rose-quartz', colorTargetId: 'gem' },
    });

    view.syncSelection({
      selectedColorIdsByTarget: { gem: 'rose-quartz' },
      fallbackColorId: '',
    });
    view.updateAvailability({
      necklace: { colorCustomization: { palette: [{ id: 'rose-quartz' }] } },
      modelLoaded: true,
      hasColorableMaterials: false,
      targetLabels: [],
    });

    expect(rose.disabled).toBe(true);
    expect(rose.tabIndex).toBe(-1);
    expect(view.elements.colorHint.textContent).toBe('這個模型目前沒有找到可換色材質，仍可正常試戴。');
  });
});

function listenDirectly(target, eventName, handler, options) {
  target.addEventListener(eventName, handler, options);
  return () => target.removeEventListener(eventName, handler, options);
}
