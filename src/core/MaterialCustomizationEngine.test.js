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

  it('applies color without replacing existing material maps or opacity', () => {
    const engine = new MaterialCustomizationEngine();
    const normalMap = {};
    const roughnessMap = {};
    const metalnessMap = {};
    const aoMap = {};
    const material = {
      uuid: 'material-colorable',
      name: 'Colorable_Metal.001',
      color: {
        isColor: true,
        set: vi.fn(),
      },
      normalMap,
      roughnessMap,
      metalnessMap,
      aoMap,
      opacity: 0.68,
      needsUpdate: false,
    };
    const model = createModel([createMesh({ geometry: {}, material })]);

    engine.collectColorableMaterials(model, [
      {
        id: 'metal',
        label: '金屬',
        materialNameIncludes: ['Colorable_Metal'],
      },
    ]);

    expect(engine.applyColor('metal', '#F6C6D3')).toBe(true);
    expect(material.color.set).toHaveBeenCalledWith('#F6C6D3');
    expect(material.normalMap).toBe(normalMap);
    expect(material.roughnessMap).toBe(roughnessMap);
    expect(material.metalnessMap).toBe(metalnessMap);
    expect(material.aoMap).toBe(aoMap);
    expect(material.opacity).toBe(0.68);
    expect(material.needsUpdate).toBe(true);
  });
});
