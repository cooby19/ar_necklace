import { queryRequired } from './domHelpers.js';

export class DeveloperPanelView {
  constructor() {
    this.elements = {
      developerPanel: queryRequired('#developerPanel'),
      debugFps: queryRequired('#debugFps'),
      debugInferenceMs: queryRequired('#debugInferenceMs'),
      debugFaceWidth: queryRequired('#debugFaceWidth'),
      debugYaw: queryRequired('#debugYaw'),
      debugScale: queryRequired('#debugScale'),
      debugModelUrl: queryRequired('#debugModelUrl'),
      debugMaterialHits: queryRequired('#debugMaterialHits'),
      debugReleaseVersion: queryRequired('#debugReleaseVersion'),
    };
  }

  setVisible(isVisible) {
    this.elements.developerPanel.hidden = !isVisible;
  }

  update({ debugData, stats, modelUrl, materialHitCount }) {
    this.elements.debugFps.textContent = stats?.renderFps ? `${stats.renderFps}` : '--';
    this.elements.debugInferenceMs.textContent =
      stats?.lastInferenceMs > 0 ? `${stats.lastInferenceMs.toFixed(1)} ms` : '-- ms';
    this.elements.debugFaceWidth.textContent = Number.isFinite(debugData?.faceWidth)
      ? debugData.faceWidth.toFixed(3)
      : '--';
    this.elements.debugYaw.textContent = debugData ? `${(debugData.rotationY * 57.2958).toFixed(1)} deg` : '-- deg';
    this.elements.debugScale.textContent = Number.isFinite(debugData?.scale) ? debugData.scale.toFixed(3) : '--';
    this.elements.debugModelUrl.textContent = modelUrl || '--';
    this.elements.debugModelUrl.title = modelUrl || '';
    this.elements.debugMaterialHits.textContent = String(materialHitCount ?? 0);
  }

  setReleaseMetadata(metadata) {
    const shortSha = metadata.commitSha ? metadata.commitSha.slice(0, 12) : 'unknown';
    const releaseLabel = `v${metadata.version ?? '0.0.0'} · ${shortSha}`;
    const releaseTitle = [
      `version: ${metadata.version ?? 'unknown'}`,
      `commit: ${metadata.commitSha ?? 'unknown'}`,
      `buildTime: ${metadata.buildTime ?? 'unknown'}`,
      `environment: ${metadata.environment ?? 'unknown'}`,
    ].join('\n');

    this.elements.debugReleaseVersion.textContent = releaseLabel;
    this.elements.debugReleaseVersion.title = releaseTitle;
  }
}
