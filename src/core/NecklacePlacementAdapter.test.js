import { describe, expect, it, vi } from 'vitest';
import { Group } from 'three';
import { NecklacePlacementAdapter } from './NecklacePlacementAdapter.js';

function createPlacement({ width = 400, height = 200 } = {}) {
  const scene = { add: vi.fn() };
  const placement = new NecklacePlacementAdapter({
    scene,
    getStageSize: () => ({ width, height }),
  });
  return { placement, scene };
}

describe('NecklacePlacementAdapter', () => {
  it('owns the necklace root and applies asset transforms to the current model', () => {
    const { placement, scene } = createPlacement();
    const model = new Group();

    placement.setModel(model);
    placement.applyAssetTransform({
      transform: {
        offsetX: 0.1,
        offsetY: -0.2,
        offsetZ: 0.3,
        rotationX: 0.4,
        rotationY: 0.5,
        rotationZ: 0.6,
        baseScale: 1.7,
      },
    });

    expect(scene.add).toHaveBeenCalledWith(placement.necklaceRoot);
    expect(placement.getModel()).toBe(model);
    expect(model.position.toArray()).toEqual([0.1, -0.2, 0.3]);
    expect(model.rotation.x).toBe(0.4);
    expect(model.rotation.y).toBe(0.5);
    expect(model.rotation.z).toBe(0.6);
    expect(model.scale.x).toBeCloseTo(1.7);
  });

  it('updates AR transforms on the root without changing projection behavior', () => {
    const { placement } = createPlacement();

    placement.updateTransform({
      position: { x: 0.2, y: -0.1, z: 0.4 },
      scale: 0.75,
      rotationY: 0.3,
      rotationZ: -0.2,
    });

    expect(placement.necklaceRoot.position.toArray()).toEqual([0.2, -0.1, 0.4]);
    expect(placement.necklaceRoot.scale.x).toBe(0.75);
    expect(placement.necklaceRoot.rotation.x).toBe(0);
    expect(placement.necklaceRoot.rotation.y).toBe(0.3);
    expect(placement.necklaceRoot.rotation.z).toBe(-0.2);
  });

  it('converts normalized screen measurements through stage aspect', () => {
    const { placement } = createPlacement({ width: 600, height: 300 });

    expect(placement.screenToWorld({ x: 0.75, y: 0.25 })).toEqual({ x: 1, y: 0.5, z: 0 });
    expect(placement.normalizedLengthToWorldX(0.25)).toBe(1);
    expect(placement.normalizedSegmentToWorldLength({ x: 0.25, y: 0.5 }, { x: 0.75, y: 0.5 })).toBe(2);
  });

  it('applies showcase framing based on the current stage aspect', () => {
    const { placement } = createPlacement({ width: 300, height: 600 });
    placement.setModel(new Group());

    placement.applyShowcaseTransform(0.7);

    expect(placement.necklaceRoot.visible).toBe(true);
    expect(placement.necklaceRoot.position.toArray()).toEqual([0, -0.04, 0]);
    expect(placement.necklaceRoot.scale.x).toBe(0.88);
    expect(placement.necklaceRoot.rotation.x).toBe(-0.1);
    expect(placement.necklaceRoot.rotation.y).toBe(0.7);
    expect(placement.necklaceRoot.rotation.z).toBe(0);
  });
});
