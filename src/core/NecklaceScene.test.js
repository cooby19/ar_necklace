import { describe, expect, it, vi } from 'vitest';
import { ModelResourceDisposer } from './ModelResourceDisposer.js';
import { NecklaceScene } from './NecklaceScene.js';

let materialId = 0;

function createSceneDouble() {
  const scene = Object.create(NecklaceScene.prototype);
  scene.activeModelLoad = null;
  scene.assetLoader = { clearCache: vi.fn() };
  scene.environmentMap = null;
  scene.materialCustomization = { reset: vi.fn() };
  scene.necklaceRoot = { clear: vi.fn() };
  scene.pmremGenerator = { dispose: vi.fn() };
  scene.renderer = { dispose: vi.fn() };
  scene.resourceDisposer = new ModelResourceDisposer({
    getEnvironmentMap: () => scene.environmentMap,
  });
  scene.scene = { environment: null };
  scene.stopObservingStageSize = vi.fn();
  return scene;
}

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

describe('NecklaceScene teardown', () => {
  it('clears cache and releases the current model during teardown', () => {
    const scene = createSceneDouble();
    const abort = vi.fn();
    const environmentMap = createTexture();
    const geometry = { dispose: vi.fn() };
    const texture = createTexture();
    const material = createMaterial(texture);

    scene.activeModelLoad = {
      controller: { abort },
      signal: { aborted: false },
    };
    scene.currentModel = createModel([createMesh({ geometry, material })]);
    scene.environmentMap = environmentMap;
    scene.scene.environment = environmentMap;

    expect(() => scene.dispose()).not.toThrow();
    expect(() => scene.dispose()).not.toThrow();

    expect(abort).toHaveBeenCalledOnce();
    expect(geometry.dispose).toHaveBeenCalledOnce();
    expect(material.dispose).toHaveBeenCalledOnce();
    expect(texture.dispose).toHaveBeenCalledOnce();
    expect(scene.assetLoader.clearCache).toHaveBeenCalledTimes(2);
    expect(scene.currentModel).toBeNull();
    expect(scene.materialCustomization.reset).toHaveBeenCalledTimes(2);
    expect(scene.scene.environment).toBeNull();
    expect(environmentMap.dispose).toHaveBeenCalledOnce();
    expect(scene.pmremGenerator).toBeNull();
    expect(scene.renderer).toBeNull();
  });
});
