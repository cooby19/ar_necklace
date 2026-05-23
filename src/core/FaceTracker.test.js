import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FACE_MESH_INIT_TIMEOUT_CODE,
  FACE_MESH_INIT_TIMEOUT_MS,
  FaceTracker,
} from './FaceTracker.js';
import { runtimeErrorReporter } from '../telemetry/RuntimeErrorReporter.js';

describe('FaceTracker FaceMesh initialization timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(runtimeErrorReporter, 'captureError').mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete globalThis.window;
  });

  it('rejects with a timeout code and asset URLs when FaceMesh initialization hangs', async () => {
    installFakeFaceMeshConstructor({
      initialize: ({ locateFile }) => {
        locateFile('face_mesh_solution_packed_assets_loader.js');
        locateFile('face_mesh_solution_simd_wasm_bin.wasm');
        locateFile('face_mesh.binarypb');
        return new Promise(() => {});
      },
    });
    const tracker = new FaceTracker({ video: /** @type {HTMLVideoElement} */ ({}) });

    const initErrorPromise = tracker.init().then(
      () => null,
      (error) => error,
    );
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(FACE_MESH_INIT_TIMEOUT_MS);

    const error = await initErrorPromise;

    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name: 'FaceMeshAssetLoadTimeoutError',
      code: FACE_MESH_INIT_TIMEOUT_CODE,
      timeoutMs: FACE_MESH_INIT_TIMEOUT_MS,
    });
    expect(error.message).toContain('臉部追蹤資產載入逾時');
    expect(error.assetUrls).toEqual(
      expect.arrayContaining([
        expect.stringContaining('face_mesh.js'),
        expect.stringContaining('face_mesh_solution_packed_assets_loader.js'),
        expect.stringContaining('face_mesh_solution_packed_assets.data'),
        expect.stringContaining('face_mesh_solution_simd_wasm_bin.wasm'),
        expect.stringContaining('face_mesh.binarypb'),
      ]),
    );
    expect(error.resolvedAssetUrls).toEqual(
      expect.arrayContaining([
        expect.stringContaining('face_mesh_solution_packed_assets_loader.js'),
        expect.stringContaining('face_mesh_solution_simd_wasm_bin.wasm'),
        expect.stringContaining('face_mesh.binarypb'),
      ]),
    );
    expect(runtimeErrorReporter.captureError).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        eventType: 'mediapipe.init_timeout',
        feature: 'mediapipe',
        extra: expect.objectContaining({
          timeoutMs: FACE_MESH_INIT_TIMEOUT_MS,
          assetUrls: expect.arrayContaining([
            expect.stringContaining('face_mesh_solution_packed_assets_loader.js'),
            expect.stringContaining('face_mesh_solution_simd_wasm_bin.wasm'),
          ]),
        }),
      }),
    );
    expect(tracker.faceMesh).toBeNull();
  });

  it('creates a fresh FaceMesh instance when retrying after a timeout', async () => {
    const instances = installFakeFaceMeshConstructor({
      initialize: ({ locateFile, instance }) => {
        locateFile('face_mesh_solution_packed_assets_loader.js');
        if (instance.attempt === 1) {
          return new Promise(() => {});
        }

        return Promise.resolve();
      },
    });
    const tracker = new FaceTracker({ video: /** @type {HTMLVideoElement} */ ({}) });

    const firstErrorPromise = tracker.init().then(
      () => null,
      (error) => error,
    );
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(FACE_MESH_INIT_TIMEOUT_MS);
    const firstError = await firstErrorPromise;

    expect(firstError.code).toBe(FACE_MESH_INIT_TIMEOUT_CODE);
    expect(instances).toHaveLength(1);
    expect(tracker.faceMesh).toBeNull();

    await tracker.init();

    expect(instances).toHaveLength(2);
    expect(tracker.faceMesh).toBe(instances[1]);
  });
});

/**
 * @param {{
 *   initialize: (options: {
 *     locateFile: (file: string) => string,
 *     instance: {
 *       attempt: number,
 *       setOptions: ReturnType<typeof vi.fn>,
 *       onResults: ReturnType<typeof vi.fn>,
 *       send: ReturnType<typeof vi.fn>,
 *     },
 *   }) => Promise<void>,
 * }} options
 * @returns {unknown[]}
 */
function installFakeFaceMeshConstructor({ initialize }) {
  /** @type {unknown[]} */
  const instances = [];

  class FakeFaceMesh {
    /** @param {{ locateFile: (file: string) => string }} faceMeshOptions */
    constructor(faceMeshOptions) {
      this.options = faceMeshOptions;
      this.attempt = instances.length + 1;
      this.setOptions = vi.fn();
      this.onResults = vi.fn();
      this.send = vi.fn();
      this.initialize = vi.fn(() => initialize({
        locateFile: this.options.locateFile,
        instance: this,
      }));
      instances.push(this);
    }
  }

  globalThis.window = {
    FaceMesh: FakeFaceMesh,
  };

  return instances;
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}
