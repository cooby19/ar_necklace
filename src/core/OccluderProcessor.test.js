import { describe, expect, it, vi } from 'vitest';
import { ModelResourceDisposer } from './ModelResourceDisposer.js';
import { OccluderProcessor } from './OccluderProcessor.js';

let materialId = 0;

function createModel(children) {
  return {
    traverse(callback) {
      callback(this);
      children.forEach((child) => callback(child));
    },
  };
}

function createTexture() {
  return {
    isTexture: true,
    dispose: vi.fn(),
  };
}

function createMaterial(texture = createTexture()) {
  return {
    uuid: `material-${materialId += 1}`,
    name: 'Skin_Occluder',
    map: texture,
    dispose: vi.fn(),
  };
}

function createMesh({ name, geometry, material, userData = {} }) {
  return {
    isMesh: true,
    name,
    geometry,
    material,
    userData,
  };
}

describe('OccluderProcessor', () => {
  it('marks matched parts, preserves original materials, and lets disposal release both material sets', () => {
    const processor = new OccluderProcessor();
    const disposer = new ModelResourceDisposer();
    const originalTexture = createTexture();
    const originalMaterial = createMaterial(originalTexture);
    const mesh = createMesh({
      name: 'neck depth shell',
      geometry: { name: 'neck', dispose: vi.fn() },
      material: originalMaterial,
    });
    const model = createModel([mesh]);

    processor.process(model, { nameIncludes: ['depth shell'] });
    const occluderMaterialDispose = vi.spyOn(mesh.material, 'dispose');

    disposer.disposeObject3DResources(model);

    expect(mesh.userData.isDepthOccluder).toBe(true);
    expect(originalMaterial.dispose).toHaveBeenCalledOnce();
    expect(originalTexture.dispose).toHaveBeenCalledOnce();
    expect(occluderMaterialDispose).toHaveBeenCalledOnce();
    expect(mesh.userData.originalOccluderMaterials).toBeUndefined();
  });
});
