import { afterEach, describe, expect, it, vi } from 'vitest';
import { GlbAssetLoader } from './GlbAssetLoader.js';

function createLoaderDouble() {
  return new GlbAssetLoader({
    loader: { parseAsync: vi.fn() },
    isDev: false,
    logger: { debug: vi.fn() },
  });
}

function createBuffer(seed) {
  const buffer = new ArrayBuffer(1);
  new Uint8Array(buffer)[0] = seed;
  return buffer;
}

describe('GlbAssetLoader GLB buffer cache', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('evicts the oldest GLB buffer when the cache exceeds its limit', () => {
    const loader = createLoaderDouble();

    for (let index = 0; index < 6; index += 1) {
      loader.setCachedGlbBuffer(`/model-${index}.glb`, createBuffer(index));
    }

    expect(loader.glbBufferCache.size).toBe(5);
    expect([...loader.glbBufferCache.keys()]).toEqual([
      '/model-1.glb',
      '/model-2.glb',
      '/model-3.glb',
      '/model-4.glb',
      '/model-5.glb',
    ]);
  });

  it('refreshes recently-used order on fetchGlbFile cache hits', async () => {
    const loader = createLoaderDouble();
    const cachedBuffer = createBuffer(0);
    vi.stubGlobal('fetch', vi.fn());

    for (let index = 0; index < 5; index += 1) {
      loader.setCachedGlbBuffer(`/model-${index}.glb`, index === 0 ? cachedBuffer : createBuffer(index));
    }

    await expect(loader.fetchGlbFile('/model-0.glb', new AbortController().signal)).resolves.toBe(cachedBuffer);
    loader.setCachedGlbBuffer('/model-5.glb', createBuffer(5));

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect([...loader.glbBufferCache.keys()]).toEqual([
      '/model-2.glb',
      '/model-3.glb',
      '/model-4.glb',
      '/model-0.glb',
      '/model-5.glb',
    ]);
  });
});
