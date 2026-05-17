// @ts-check

/** @typedef {import('../types/domain').AppStateSnapshot} AppStateSnapshot */
/** @typedef {import('../types/domain').DeveloperPanelModel} DeveloperPanelModel */
/** @typedef {import('../types/domain').FaceLandmarkList} FaceLandmarkList */
/** @typedef {import('../types/domain').FaceTrackingAdvice} FaceTrackingAdvice */
/** @typedef {import('../types/domain').NecklaceDebugData} NecklaceDebugData */
/** @typedef {import('../types/domain').RealtimeTrackingSnapshot} RealtimeTrackingSnapshot */
/** @typedef {import('../types/domain').RenderStats} RenderStats */
/** @typedef {import('../types/domain').TrackerStats} TrackerStats */
/** @typedef {import('../types/domain').WorkflowStatusView} WorkflowStatusView */

/**
 * @typedef {{
 *   getAdvice: (input: {
 *     landmarks?: FaceLandmarkList | null,
 *     debugData?: NecklaceDebugData | null,
 *     now?: number,
 *   }) => FaceTrackingAdvice,
 * }} FaceQualityAdvisorPort
 */

/** @typedef {{ getColorableMaterialCount: () => number }} TrackingModelCatalogPort */
/** @typedef {{ hasCalibration: (necklaceId: string) => boolean }} TrackingCalibrationPort */

/**
 * @typedef {{
 *   faceQualityAdvisor: FaceQualityAdvisorPort,
 *   getTrackerStats: () => TrackerStats,
 *   getRenderStats: () => RenderStats,
 *   modelCatalog: TrackingModelCatalogPort,
 *   calibrationService: TrackingCalibrationPort,
 * }} TrackingFeedbackOptions
 */

export class TrackingFeedbackService {
  /**
   * @param {TrackingFeedbackOptions} options
   */
  constructor({ faceQualityAdvisor, getTrackerStats, getRenderStats, modelCatalog, calibrationService }) {
    this.faceQualityAdvisor = faceQualityAdvisor;
    this.getTrackerStats = getTrackerStats;
    this.getRenderStats = getRenderStats;
    this.modelCatalog = modelCatalog;
    this.calibrationService = calibrationService;
  }

  /**
   * @param {AppStateSnapshot} state
   * @param {RealtimeTrackingSnapshot} realtime
   * @returns {DeveloperPanelModel}
   */
  createDeveloperPanelModel(state, realtime) {
    return {
      debugData: realtime.debugData,
      stats: {
        ...this.getTrackerStats(),
        renderFps: this.getRenderStats().fps,
      },
      modelUrl: state.selectedNecklace?.url,
      materialHitCount: this.modelCatalog.getColorableMaterialCount(),
    };
  }

  /**
   * @param {AppStateSnapshot} state
   * @param {RealtimeTrackingSnapshot} realtime
   * @returns {WorkflowStatusView | null}
   */
  createTrackingStatus(state, realtime) {
    if (!state.cameraStarted) return null;

    const inferenceStats = this.formatInferenceStats();
    const advice = this.faceQualityAdvisor.getAdvice({
      landmarks: realtime.latestLandmarks,
      debugData: realtime.debugData,
    });
    const message = this.formatAdviceMessage(advice, inferenceStats, state, realtime);

    if (!realtime.hasFace || !realtime.debugData) {
      return {
        kind: advice.kind,
        label: advice.label,
        metrics: message,
      };
    }

    const data = realtime.debugData;
    return {
      kind: advice.kind,
      label: advice.label,
      metrics: state.debugEnabled
        ? `neck x/y: ${data.neckPoint.x.toFixed(3)}, ${data.neckPoint.y.toFixed(3)} · scale ${data.scale.toFixed(2)} · yaw ${data.rotationY.toFixed(2)} · ${inferenceStats}`
        : message,
    };
  }

  /**
   * @param {FaceTrackingAdvice} advice
   * @param {string} inferenceStats
   * @param {AppStateSnapshot} state
   * @param {RealtimeTrackingSnapshot} realtime
   * @returns {string}
   */
  formatAdviceMessage(advice, inferenceStats, state, realtime) {
    let message = advice.message;

    if (
      advice.id === 'ok' &&
      realtime.debugData &&
      !this.calibrationService.hasCalibration(state.selectedNecklace.id)
    ) {
      message = '可拖曳項鍊微調，完成後按「儲存校準」';
    }

    return state.debugEnabled ? `${message} · ${inferenceStats}` : message;
  }

  /**
   * @returns {string}
   */
  formatInferenceStats() {
    const stats = this.getTrackerStats();
    const averageMs = stats.averageInferenceMs > 0 ? `${stats.averageInferenceMs.toFixed(0)}ms` : '--ms';
    const schedulerLabel = stats.schedulerType === 'video-frame' ? 'rVFC' : 'RAF';
    return `inference: ${stats.currentFps}fps · avg ${averageMs} · ${schedulerLabel}`;
  }
}
