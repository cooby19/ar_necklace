import { describe, expect, it, vi } from 'vitest';
import { NECKLACES } from '../config/necklaces.js';

const mocks = vi.hoisted(() => ({
  CalibrationService: vi.fn(function CalibrationService(options) {
    this.options = options;
  }),
  DebugOverlay: vi.fn(function DebugOverlay(options) {
    this.options = options;
  }),
  FaceQualityAdvisor: vi.fn(function FaceQualityAdvisor(options) {
    this.options = options;
  }),
  ModelCatalogService: vi.fn(function ModelCatalogService(options) {
    this.options = options;
  }),
  NecklaceController: vi.fn(function NecklaceController(scene) {
    this.scene = scene;
  }),
  NecklaceScene: vi.fn(function NecklaceScene(options) {
    this.options = options;
  }),
  RendererLoop: vi.fn(function RendererLoop(options) {
    this.options = options;
  }),
  ShareWorkflow: vi.fn(function ShareWorkflow(options) {
    this.options = options;
  }),
  TrackingFeedbackService: vi.fn(function TrackingFeedbackService(options) {
    this.options = options;
  }),
}));

vi.mock('./CalibrationService.js', () => ({ CalibrationService: mocks.CalibrationService }));
vi.mock('./ModelCatalogService.js', () => ({ ModelCatalogService: mocks.ModelCatalogService }));
vi.mock('./RendererLoop.js', () => ({ RendererLoop: mocks.RendererLoop }));
vi.mock('./ShareWorkflow.js', () => ({ ShareWorkflow: mocks.ShareWorkflow }));
vi.mock('./TrackingFeedbackService.js', () => ({ TrackingFeedbackService: mocks.TrackingFeedbackService }));
vi.mock('../core/DebugOverlay.js', () => ({ DebugOverlay: mocks.DebugOverlay }));
vi.mock('../core/FaceQualityAdvisor.js', () => ({ FaceQualityAdvisor: mocks.FaceQualityAdvisor }));
vi.mock('../core/NecklaceController.js', () => ({ NecklaceController: mocks.NecklaceController }));
vi.mock('../core/NecklaceScene.js', () => ({ NecklaceScene: mocks.NecklaceScene }));

const { createAppRuntime } = await import('./createAppRuntime.js');

describe('createAppRuntime', () => {
  it('wires runtime services with shared scene, elements, store, and render stats hook', () => {
    const elements = {
      stage: { id: 'stage' },
      video: { id: 'video' },
      threeCanvas: { id: 'three-canvas' },
      debugCanvas: { id: 'debug-canvas' },
    };
    const appState = {
      getSnapshot: vi.fn(() => ({ mode: 'showcase' })),
    };
    const realtimeSnapshot = {
      trackerStats: { currentFps: 0 },
      renderStats: { fps: 0 },
    };
    const realtimeStore = {
      getSnapshot: vi.fn(() => realtimeSnapshot),
      setRenderStats: vi.fn(),
    };
    const uiController = {
      elements,
      showError: vi.fn(),
    };
    const captureService = {};

    const runtime = createAppRuntime({
      appState,
      uiController,
      captureService,
      necklaces: NECKLACES,
      realtimeStore,
    });

    expect(runtime.realtimeStore).toBe(realtimeStore);
    expect(mocks.NecklaceScene).toHaveBeenCalledWith({
      canvas: elements.threeCanvas,
      stageElement: elements.stage,
      onError: expect.any(Function),
    });
    expect(mocks.NecklaceController).toHaveBeenCalledWith(runtime.scene);
    expect(mocks.DebugOverlay).toHaveBeenCalledWith({
      canvas: elements.debugCanvas,
      stageElement: elements.stage,
    });
    expect(mocks.ModelCatalogService).toHaveBeenCalledWith({
      scene: runtime.scene,
      necklaces: NECKLACES,
    });
    expect(mocks.CalibrationService).toHaveBeenCalledWith({
      stageElement: elements.stage,
      pointerElement: elements.threeCanvas,
    });
    expect(mocks.ShareWorkflow).toHaveBeenCalledWith({
      captureService,
      scene: runtime.scene,
    });
    expect(mocks.TrackingFeedbackService).toHaveBeenCalledWith({
      faceQualityAdvisor: expect.any(mocks.FaceQualityAdvisor),
      getTrackerStats: expect.any(Function),
      getRenderStats: expect.any(Function),
      modelCatalog: runtime.modelCatalog,
      calibrationService: runtime.calibrationService,
    });

    runtime.scene.options.onError('broken model');
    expect(uiController.showError).toHaveBeenCalledWith('broken model');

    const renderStatsHandler = vi.fn();
    const stats = { fps: 60 };
    runtime.setRenderStatsUpdateHandler(renderStatsHandler);
    runtime.rendererLoop.options.onStatsUpdate(stats);

    expect(realtimeStore.setRenderStats).toHaveBeenCalledWith(stats);
    expect(renderStatsHandler).toHaveBeenCalledWith(stats);
  });
});
