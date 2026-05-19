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
/** @typedef {import('../types/ui-ports').UiControllerPort} UiControllerPort */

/** @typedef {(stats: RenderStats) => void} RenderStatsUpdateHandler */

/**
 * @typedef {{
 *   appState: AppStatePort,
 *   uiController: UiControllerPort,
 *   captureService: CaptureServicePort,
 *   necklaces: readonly NecklaceConfig[],
 *   realtimeStore?: RealtimeTrackingStore,
 *   onError?: (message: string) => void,
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
 * Builds the runtime services used by ModeController without changing their lifecycle semantics.
 *
 * @param {CreateAppRuntimeOptions} options
 * @returns {AppRuntime}
 */
export function createAppRuntime({
  appState,
  uiController,
  captureService,
  necklaces,
  realtimeStore = new RealtimeTrackingStore(),
  onError = (message) => uiController.showError(message),
}) {
  const scene = new NecklaceScene({
    canvas: uiController.elements.threeCanvas,
    stageElement: uiController.elements.stage,
    onError,
  });
  const necklaceController = new NecklaceController(scene);
  const faceQualityAdvisor = new FaceQualityAdvisor({
    video: uiController.elements.video,
  });
  const debugOverlay = new DebugOverlay({
    canvas: uiController.elements.debugCanvas,
    stageElement: uiController.elements.stage,
  });
  const modelCatalog = new ModelCatalogService({
    scene,
    necklaces,
  });
  const calibrationService = new CalibrationService({
    stageElement: uiController.elements.stage,
    pointerElement: uiController.elements.threeCanvas,
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
