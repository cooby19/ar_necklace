// @ts-check

import { CalibrationService } from './CalibrationService.js';
import { ModelCatalogService } from './ModelCatalogService.js';
import { RealtimeTrackingStore } from './RealtimeTrackingStore.js';
import { RendererLoop } from './RendererLoop.js';
import { ShareWorkflow } from './ShareWorkflow.js';
import { TrackingFeedbackService } from './TrackingFeedbackService.js';
import { DebugOverlay } from '../core/DebugOverlay.js';
import { FaceQualityAdvisor } from '../core/FaceQualityAdvisor.js';
import { NecklaceController } from '../core/NecklaceController.js';
import { NecklaceScene } from '../core/NecklaceScene.js';

/** @typedef {import('../types/domain').NecklaceConfig} NecklaceConfig */
/** @typedef {import('../types/domain').RenderStats} RenderStats */
/** @typedef {import('../types/app-ports').AppStatePort} AppStatePort */
/** @typedef {import('../types/app-ports').CaptureServicePort} CaptureServicePort */
/** @typedef {import('../types/ui-ports').UiRuntimePort} UiRuntimePort */

/** @typedef {(stats: RenderStats) => void} RenderStatsUpdateHandler */

/**
 * @typedef {{
 *   appState: AppStatePort,
 *   uiRoot?: UiRuntimePort,
 *   uiController?: UiRuntimePort,
 *   captureService: CaptureServicePort,
 *   necklaces: readonly NecklaceConfig[],
 *   realtimeStore?: RealtimeTrackingStore,
 *   onError?: (message: string) => void,
 *   showcaseAnimationEnabled?: boolean,
 * }} CreateAppRuntimeOptions
 */

/**
 * @typedef {{
 *   realtimeStore: RealtimeTrackingStore,
 *   scene: NecklaceScene,
 *   necklaceController: NecklaceController,
 *   debugOverlay: DebugOverlay,
 *   rendererLoop: RendererLoop,
 *   modelCatalog: ModelCatalogService,
 *   calibrationService: CalibrationService,
 *   shareWorkflow: ShareWorkflow,
 *   feedbackService: TrackingFeedbackService,
 *   setRenderStatsUpdateHandler: (handler?: RenderStatsUpdateHandler | null) => void,
 * }} AppRuntime
 */

/**
 * Builds the runtime services used by AppRuntimeController without changing their lifecycle semantics.
 *
 * @param {CreateAppRuntimeOptions} options
 * @returns {AppRuntime}
 */
export function createAppRuntime(options) {
  const {
    appState,
    captureService,
    necklaces,
    realtimeStore = new RealtimeTrackingStore(),
  } = options;
  const uiRoot = options.uiRoot ?? options.uiController;
  if (!uiRoot) {
    throw new Error('createAppRuntime requires a uiRoot');
  }
  const onError = options.onError ?? ((message) => uiRoot.showError(message));
  const scene = new NecklaceScene({
    canvas: uiRoot.elements.threeCanvas,
    stageElement: uiRoot.elements.stage,
    onError,
  });
  const necklaceController = new NecklaceController(scene);
  const faceQualityAdvisor = new FaceQualityAdvisor({
    video: uiRoot.elements.video,
  });
  const debugOverlay = new DebugOverlay({
    canvas: uiRoot.elements.debugCanvas,
    stageElement: uiRoot.elements.stage,
  });
  const modelCatalog = new ModelCatalogService({
    scene,
    necklaces,
  });
  const calibrationService = new CalibrationService({
    stageElement: uiRoot.elements.stage,
    pointerElement: uiRoot.elements.threeCanvas,
  });
  const shareWorkflow = new ShareWorkflow({
    captureService,
    scene,
  });

  /** @type {RenderStatsUpdateHandler} */
  let onRenderStatsUpdate = () => {};
  const rendererLoop = new RendererLoop({
    scene,
    debugOverlay,
    getState: () => appState.getSnapshot(),
    getRealtimeSnapshot: () => realtimeStore.getSnapshot(),
    showcaseAnimationEnabled: options.showcaseAnimationEnabled ?? true,
    onStatsUpdate: (stats) => {
      realtimeStore.setRenderStats(stats);
      onRenderStatsUpdate(stats);
    },
  });
  const feedbackService = new TrackingFeedbackService({
    faceQualityAdvisor,
    getTrackerStats: () => realtimeStore.getSnapshot().trackerStats,
    getRenderStats: () => realtimeStore.getSnapshot().renderStats,
    modelCatalog,
    calibrationService,
  });

  return {
    realtimeStore,
    scene,
    necklaceController,
    debugOverlay,
    rendererLoop,
    modelCatalog,
    calibrationService,
    shareWorkflow,
    feedbackService,
    setRenderStatsUpdateHandler(handler) {
      onRenderStatsUpdate = handler ?? (() => {});
    },
  };
}
