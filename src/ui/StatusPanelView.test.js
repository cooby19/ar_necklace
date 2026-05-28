import { afterEach, describe, expect, it } from 'vitest';
import { StatusPanelView } from './StatusPanelView.js';
import { cleanupFakeDocument, installFakeDocument } from './test/fakeDom.js';

afterEach(() => {
  cleanupFakeDocument();
});

describe('StatusPanelView', () => {
  it('renders passive tracking status when debug overlay is off', () => {
    installFakeDocument();
    const view = new StatusPanelView();

    view.setStatus('tracking', '正在試戴', '追蹤穩定', { debugEnabled: false });

    expect(view.elements.statusPanel.dataset.status).toBe('tracking');
    expect(view.elements.statusPanel.classList.contains('is-passive')).toBe(true);
    expect(view.elements.trackingDot.classList.contains('is-tracking')).toBe(true);
    expect(view.elements.trackingLabel.textContent).toBe('正在試戴');
    expect(view.elements.trackingMetrics.textContent).toBe('追蹤穩定');
  });

  it('renders error status without passive tracking styling', () => {
    installFakeDocument();
    const view = new StatusPanelView();

    view.setStatus('error', '模型載入失敗', '請檢查檔案', { debugEnabled: false });

    expect(view.elements.statusPanel.dataset.status).toBe('error');
    expect(view.elements.statusPanel.classList.contains('is-passive')).toBe(false);
    expect(view.elements.trackingDot.classList.contains('is-error')).toBe(true);
    expect(view.elements.trackingLabel.textContent).toBe('模型載入失敗');
  });
});
