import { describe, expect, it, vi } from 'vitest';
import { MaterialCustomizationEngine } from './MaterialCustomizationEngine.js';

function createModel(children) {
  return {
    traverse(callback) {
      callback(this);
      children.forEach((child) => callback(child));
    },
  };
}

function createMesh({ geometry, material, userData = {} }) {
  return {
    isMesh: true,
    geometry,
    material,
    userData,
  };
}

describe('MaterialCustomizationEngine opacity updates', () => {
  it('uses cached opacity materials and skips depth occluders', () => {
    const engine = new MaterialCustomizationEngine();
    const material = {
      uuid: 'material-1',
      opacity: 0,
      needsUpdate: false,
    };
    const occluderMaterial = {
      uuid: 'material-2',
      opacity: 0,
      needsUpdate: false,
    };
    const model = createModel([
      createMesh({ geometry: {}, material }),
      createMesh({ geometry: {}, material: occluderMaterial, userData: { isDepthOccluder: true } }),
    ]);
    const traverse = vi.spyOn(model, 'traverse');

    engine.collectOpacityMaterials(model);
    engine.setOpacity(0.5);
    engine.setOpacity(0.501);

    expect(traverse).toHaveBeenCalledOnce();
    expect(engine.opacityMaterials).toEqual([material]);
    expect(material.opacity).toBe(0.5);
    expect(material.needsUpdate).toBe(false);
    expect(occluderMaterial.opacity).toBe(0);
  });
});
