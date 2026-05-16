import { afterEach, describe, expect, it, vi } from 'vitest';
import { NecklaceScene } from './NecklaceScene.js';

function createSceneDouble() {
  const scene = Object.create(NecklaceScene.prototype);
  scene.activeModelLoad = null;
  scene.colorableMaterials = new Map();
  scene.environmentMap = null;
  scene.glbBufferCache = new Map();
  scene.necklaceRoot = { clear: vi.fn() };
  scene.pmremGenerator = { dispose: vi.fn() };
  scene.renderer = { dispose: vi.fn() };
  scene.scene = { environment: null };
  scene.stopObservingStageSize = vi.fn();
  return scene;
}

function createBuffer(seed) {
  const buffer = new ArrayBuffer(1);
  new Uint8Array(buffer)[0] = seed;
  return buffer;
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

describe('NecklaceScene GLB buffer cache', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('evicts the oldest GLB buffer when the cache exceeds its limit', () => {
    const scene = createSceneDouble();

    for (let index = 0; index < 6; index += 1) {
      scene.setCachedGlbBuffer(`/model-${index}.glb`, createBuffer(index));
    }

    expect(scene.glbBufferCache.size).toBe(5);
    expect([...scene.glbBufferCache.keys()]).toEqual([
      '/model-1.glb',
      '/model-2.glb',
      '/model-3.glb',
      '/model-4.glb',
      '/model-5.glb',
    ]);
  });

  it('refreshes recently-used order on fetchGlbFile cache hits', async () => {
    const scene = createSceneDouble();
    const cachedBuffer = createBuffer(0);
    vi.stubGlobal('fetch', vi.fn());

    for (let index = 0; index < 5; index += 1) {
      scene.setCachedGlbBuffer(`/model-${index}.glb`, index === 0 ? cachedBuffer : createBuffer(index));
    }

    await expect(scene.fetchGlbFile('/model-0.glb', new AbortController().signal)).resolves.toBe(cachedBuffer);
    scene.setCachedGlbBuffer('/model-5.glb', createBuffer(5));

    expect(fetch).not.toHaveBeenCalled();
    expect([...scene.glbBufferCache.keys()]).toEqual([
      '/model-2.glb',
      '/model-3.glb',
      '/model-4.glb',
      '/model-0.glb',
      '/model-5.glb',
    ]);
  });
});

describe('NecklaceScene resource disposal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('disposes shared geometry, material, and texture only once', () => {
    const scene = createSceneDouble();
    const geometry = { dispose: vi.fn() };
    const texture = createTexture();
    const material = createMaterial(texture);
    const model = createModel([
      createMesh({ geometry, material: [material, material] }),
      createMesh({ geometry, material }),
    ]);

    scene.disposeObject3DResources(model);

    expect(geometry.dispose).toHaveBeenCalledOnce();
    expect(material.dispose).toHaveBeenCalledOnce();
    expect(texture.dispose).toHaveBeenCalledOnce();
  });

  it('disposes original depth occluder material after material replacement', () => {
    const scene = createSceneDouble();
    const originalTexture = createTexture();
    const originalMaterial = createMaterial(originalTexture);
    const mesh = createMesh({
      geometry: { dispose: vi.fn() },
      material: originalMaterial,
    });

    scene.prepareDepthOccluder(mesh);
    const occluderMaterialDispose = vi.spyOn(mesh.material, 'dispose');

    scene.disposeObject3DResources(createModel([mesh]));

    expect(originalMaterial.dispose).toHaveBeenCalledOnce();
    expect(originalTexture.dispose).toHaveBeenCalledOnce();
    expect(occluderMaterialDispose).toHaveBeenCalledOnce();
    expect(mesh.userData.originalOccluderMaterials).toBeUndefined();
  });

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
    scene.colorableMaterials.set('metal', [material]);
    scene.currentModel = createModel([createMesh({ geometry, material })]);
    scene.environmentMap = environmentMap;
    scene.glbBufferCache.set('/model.glb', createBuffer(1));
    scene.scene.environment = environmentMap;

    expect(() => scene.dispose()).not.toThrow();
    expect(() => scene.dispose()).not.toThrow();

    expect(abort).toHaveBeenCalledOnce();
    expect(geometry.dispose).toHaveBeenCalledOnce();
    expect(material.dispose).toHaveBeenCalledOnce();
    expect(texture.dispose).toHaveBeenCalledOnce();
    expect(scene.glbBufferCache.size).toBe(0);
    expect(scene.currentModel).toBeNull();
    expect(scene.colorableMaterials.size).toBe(0);
    expect(scene.scene.environment).toBeNull();
    expect(environmentMap.dispose).toHaveBeenCalledOnce();
    expect(scene.pmremGenerator).toBeNull();
    expect(scene.renderer).toBeNull();
  });
});
