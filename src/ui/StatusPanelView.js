import { queryRequired } from './domHelpers.js';

export class StatusPanelView {
  constructor() {
    this.elements = {
      statusPanel: queryRequired('.status-panel'),
      trackingDot: queryRequired('#trackingDot'),
      trackingLabel: queryRequired('#trackingLabel'),
      trackingMetrics: queryRequired('#trackingMetrics'),
    };
  }

  setStatus(kind, label, metrics, { debugEnabled = false } = {}) {
    const isPassiveTracking = kind === 'tracking' && label === '正在試戴' && !debugEnabled;
    this.elements.statusPanel.dataset.status = kind;
    this.elements.statusPanel.classList.toggle('is-passive', isPassiveTracking);
    this.elements.trackingDot.classList.toggle('is-tracking', kind === 'tracking');
    this.elements.trackingDot.classList.toggle('is-error', kind === 'error');
    this.elements.trackingLabel.textContent = label;
    this.elements.trackingMetrics.textContent = metrics;
  }
}
