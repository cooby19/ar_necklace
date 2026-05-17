import { describe, expect, it, vi } from 'vitest';
import { ModelResourceDisposer } from './ModelResourceDisposer.js';

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
    map: texture,
    customTextureSlot: { value: texture },
    dispose: vi.fn(),
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

describe('ModelResourceDisposer', () => {
  it('disposes shared geometry, material, and texture only once', () => {
    const disposer = new ModelResourceDisposer();
    const geometry = { dispose: vi.fn() };
    const texture = createTexture();
    const material = createMaterial(texture);
    const model = createModel([
      createMesh({ geometry, material: [material, material] }),
      createMesh({ geometry, material }),
    ]);

    disposer.disposeObject3DResources(model);

    expect(geometry.dispose).toHaveBeenCalledOnce();
    expect(material.dispose).toHaveBeenCalledOnce();
    expect(texture.dispose).toHaveBeenCalledOnce();
  });

  it('does not dispose the scene-level environment map while releasing model textures', () => {
    const environmentMap = createTexture();
    const modelTexture = createTexture();
    const disposer = new ModelResourceDisposer({ getEnvironmentMap: () => environmentMap });
    const material = createMaterial(modelTexture);
    material.envMap = environmentMap;
    const model = createModel([
      createMesh({
        geometry: { dispose: vi.fn() },
        material,
      }),
    ]);

    disposer.disposeObject3DResources(model);

    expect(modelTexture.dispose).toHaveBeenCalledOnce();
    expect(environmentMap.dispose).not.toHaveBeenCalled();
  });
});
