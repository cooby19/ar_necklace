import { describe, expect, it, vi } from 'vitest';
import { ShowcasePresenter } from './ShowcasePresenter';

function createPresenter({ hasModel = true } = {}) {
  const placement = {
    hasModel: vi.fn(() => hasModel),
    applyShowcaseTransform: vi.fn(),
  };
  const setOpacity = vi.fn();
  const presenter = new ShowcasePresenter({
    placement,
    setOpacity,
  });
  return { presenter, placement, setOpacity };
}

describe('ShowcasePresenter', () => {
  it('enables showcase mode by forcing opacity and applying the current rotation', () => {
    const { presenter, placement, setOpacity } = createPresenter();

    presenter.setShowcaseMode(true);

    expect(setOpacity).toHaveBeenCalledWith(1);
    expect(placement.applyShowcaseTransform).toHaveBeenCalledWith(0);
    expect(presenter.enabled).toBe(true);
    expect(presenter.isDragging).toBe(false);
  });

  it('updates rotation from drag deltas only while dragging', () => {
    const { presenter, placement } = createPresenter();

    presenter.setShowcaseMode(true);
    presenter.dragShowcase(140);
    presenter.beginShowcaseDrag(100);
    presenter.dragShowcase(125);
    presenter.endShowcaseDrag();
    presenter.dragShowcase(150);

    expect(presenter.rotationY).toBeCloseTo(0.3);
    expect(placement.applyShowcaseTransform).toHaveBeenLastCalledWith(0.3);
  });

  it('auto rotates after the first showcase frame and clamps long frame deltas', () => {
    const { presenter, placement } = createPresenter();

    presenter.setShowcaseMode(true);
    presenter.updateShowcase(1000);
    presenter.updateShowcase(1100);

    expect(presenter.rotationY).toBeCloseTo(48 * 0.00018);
    expect(placement.applyShowcaseTransform).toHaveBeenLastCalledWith(presenter.rotationY);
  });

  it('does not auto rotate without a current model', () => {
    const { presenter, placement } = createPresenter({ hasModel: false });

    presenter.setShowcaseMode(true);
    presenter.updateShowcase(1000);

    expect(presenter.rotationY).toBe(0);
    expect(placement.applyShowcaseTransform).toHaveBeenCalledTimes(1);
  });
});
