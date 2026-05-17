import { describe, expect, it, vi } from 'vitest';
import { ThreeRendererHost } from './ThreeRendererHost.js';

function createHostDouble() {
  const environmentMap = {
    dispose: vi.fn(),
  };
  const renderer = {
    setClearColor: vi.fn(),
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
  };
  const pmremGenerator = {
    fromScene: vi.fn(() => ({ texture: environmentMap })),
    dispose: vi.fn(),
  };
  const roomEnvironment = {
    dispose: vi.fn(),
  };
  const scene = {
    add: vi.fn(),
    environment: null,
  };
  const camera = {
    updateProjectionMatrix: vi.fn(),
  };
  const stageElement = {
    getBoundingClientRect: vi.fn(() => ({ width: 640, height: 320 })),
  };
  const stopObservingStageSize = vi.fn();
  let resizeCallback = null;
  const observeStageSizeFn = vi.fn((element, callback) => {
    resizeCallback = callback;
    return stopObservingStageSize;
  });

  const host = new ThreeRendererHost({
    canvas: {},
    stageElement,
    scene,
    camera,
    rendererFactory: () => renderer,
    pmremGeneratorFactory: () => pmremGenerator,
    roomEnvironmentFactory: () => roomEnvironment,
    observeStageSizeFn,
  });

  return {
    camera,
    environmentMap,
    host,
    observeStageSizeFn,
    pmremGenerator,
    renderer,
    resizeCallback,
    roomEnvironment,
    scene,
    stageElement,
    stopObservingStageSize,
  };
}

describe('ThreeRendererHost', () => {
  it('sets up renderer, environment, lights, resize observation, and rendering', () => {
    const { camera, environmentMap, host, observeStageSizeFn, pmremGenerator, renderer, resizeCallback, scene } =
      createHostDouble();

    expect(renderer.outputColorSpace).toBeDefined();
    expect(renderer.toneMapping).toBeDefined();
    expect(renderer.toneMappingExposure).toBe(1.08);
    expect(renderer.setClearColor).toHaveBeenCalledWith(0x000000, 0);
    expect(pmremGenerator.fromScene).toHaveBeenCalledWith(expect.any(Object), 0.02);
    expect(scene.environment).toBe(environmentMap);
    expect(scene.environmentIntensity).toBe(1.28);
    expect(scene.add).toHaveBeenCalled();
    expect(observeStageSizeFn).toHaveBeenCalled();

    resizeCallback();
    expect(renderer.setPixelRatio).toHaveBeenCalledWith(1);
    expect(renderer.setSize).toHaveBeenCalledWith(640, 320, false);
    expect(camera.left).toBe(-2);
    expect(camera.right).toBe(2);
    expect(camera.top).toBe(1);
    expect(camera.bottom).toBe(-1);
    expect(camera.updateProjectionMatrix).toHaveBeenCalledOnce();

    host.render();
    expect(renderer.render).toHaveBeenCalledWith(scene, camera);
  });

  it('tears down renderer resources idempotently', () => {
    const { environmentMap, host, pmremGenerator, renderer, scene, stopObservingStageSize } = createHostDouble();

    host.dispose();
    host.dispose();

    expect(stopObservingStageSize).toHaveBeenCalledOnce();
    expect(scene.environment).toBeNull();
    expect(environmentMap.dispose).toHaveBeenCalledOnce();
    expect(pmremGenerator.dispose).toHaveBeenCalledOnce();
    expect(renderer.dispose).toHaveBeenCalledOnce();
    expect(host.environmentMap).toBeNull();
    expect(host.pmremGenerator).toBeNull();
    expect(host.renderer).toBeNull();
  });
});
