export class TrackingFeedbackService {
  constructor({ faceQualityAdvisor, getTrackerStats, getRenderStats, modelCatalog, calibrationService }) {
    this.faceQualityAdvisor = faceQualityAdvisor;
    this.getTrackerStats = getTrackerStats;
    this.getRenderStats = getRenderStats;
    this.modelCatalog = modelCatalog;
    this.calibrationService = calibrationService;
  }

  createDeveloperPanelModel(state) {
    return {
      debugData: state.lastDebugData,
      stats: {
        ...this.getTrackerStats(),
        renderFps: this.getRenderStats().fps,
      },
      modelUrl: state.selectedNecklace?.url,
      materialHitCount: this.modelCatalog.getColorableMaterialCount(),
    };
  }

  createTrackingStatus(state) {
    if (!state.cameraStarted) return null;

    const inferenceStats = this.formatInferenceStats();
    const advice = this.faceQualityAdvisor.getAdvice({
      landmarks: state.lastLandmarks,
      debugData: state.lastDebugData,
    });
    const message = this.formatAdviceMessage(advice, inferenceStats, state);

    if (!state.hasFace || !state.lastDebugData) {
      return {
        kind: advice.kind,
        label: advice.label,
        metrics: message,
      };
    }

    const data = state.lastDebugData;
    return {
      kind: advice.kind,
      label: advice.label,
      metrics: state.debugEnabled
        ? `neck x/y: ${data.neckPoint.x.toFixed(3)}, ${data.neckPoint.y.toFixed(3)} · scale ${data.scale.toFixed(2)} · yaw ${data.rotationY.toFixed(2)} · ${inferenceStats}`
        : message,
    };
  }

  formatAdviceMessage(advice, inferenceStats, state) {
    let message = advice.message;

    if (
      advice.id === 'ok' &&
      state.lastDebugData &&
      !this.calibrationService.hasCalibration(state.selectedNecklace.id)
    ) {
      message = '可拖曳項鍊微調，完成後按「儲存校準」';
    }

    return state.debugEnabled ? `${message} · ${inferenceStats}` : message;
  }

  formatInferenceStats() {
    const stats = this.getTrackerStats();
    const averageMs = stats.averageInferenceMs > 0 ? `${stats.averageInferenceMs.toFixed(0)}ms` : '--ms';
    const schedulerLabel = stats.schedulerType === 'video-frame' ? 'rVFC' : 'RAF';
    return `inference: ${stats.currentFps}fps · avg ${averageMs} · ${schedulerLabel}`;
  }
}
