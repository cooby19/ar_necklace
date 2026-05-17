import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiController } from './UiController.js';

class FakeElement {
  constructor(selector) {
    this.selector = selector;
    this.hidden = false;
    this.disabled = false;
    this.checked = false;
    this.dataset = {};
    this.listeners = new Map();
    this.tabIndex = 0;
    this.value = '';
  }

  addEventListener(eventName, handler) {
    const listeners = this.listeners.get(eventName) ?? new Set();
    listeners.add(handler);
    this.listeners.set(eventName, listeners);
  }

  removeEventListener(eventName, handler) {
    this.listeners.get(eventName)?.delete(handler);
  }

  dispatch(eventName, event = {}) {
    const normalizedEvent = {
      target: this,
      preventDefault: vi.fn(),
      ...event,
    };
    this.listeners.get(eventName)?.forEach((handler) => handler(normalizedEvent));
    return normalizedEvent;
  }

  contains(target) {
    return target === this;
  }
}

const REQUIRED_SELECTORS = [
  '#app',
  '.stage',
  '#cameraVideo',
  '#threeCanvas',
  '#debugCanvas',
  '#developerPanel',
  '#debugFps',
  '#debugInferenceMs',
  '#debugFaceWidth',
  '#debugYaw',
  '#debugScale',
  '#debugModelUrl',
  '#debugMaterialHits',
  '#debugReleaseVersion',
  '.live-pill',
  '.experience-column',
  '.controls',
  '#captureButton',
  '#bottomSheetToggle',
  '#startButton',
  '#switchCameraButton',
  '#stopCameraButton',
  '#necklaceToggle',
  '#debugToggle',
  '#necklaceCards',
  '#necklaceSelect',
  '#colorSwatches',
  '#colorHint',
  '#colorMeaning',
  '#meaningChip',
  '#meaningTitle',
  '#meaningSummary',
  '#meaningKeywords',
  '#verticalOffsetRange',
  '#verticalOffsetValue',
  '#scaleRange',
  '#scaleValue',
  '#rotationRange',
  '#rotationValue',
  '#calibrationHint',
  '#saveCalibrationButton',
  '#resetTuningButton',
  '#shareSheet',
  '.share-card',
  '#shareImage',
  '#downloadCaptureButton',
  '#shareCaptureButton',
  '#errorBox',
  '.status-panel',
  '#trackingDot',
  '#trackingLabel',
  '#trackingMetrics',
];

const REQUIRED_LIST_SELECTORS = [
  '[data-mode]',
  '[data-panel-tab]',
  '[data-control-panel]',
  '[data-ar-section]',
  '[data-close-share]',
];

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.document;
});

describe('UiController DOM guards', () => {
  it('throws a clear initialization error when a required element is missing', () => {
    installFakeDocument({ missingSelector: '#cameraVideo' });

    expect(() => new UiController({ necklaces: [] })).toThrow('Missing required UI element: #cameraVideo');
  });
});

describe('UiController listener lifecycle', () => {
  it('removes bind listeners through destroy', () => {
    const document = installFakeDocument();
    const ui = new UiController({ necklaces: [] });
    const onStartCamera = vi.fn();
    const onCloseShareSheet = vi.fn();
    const onShareFocusEscape = vi.fn();

    ui.elements.shareSheet.hidden = false;
    ui.focusFirstShareSheetControl = onShareFocusEscape;
    ui.bind({
      onStartCamera,
      onCloseShareSheet,
    });

    ui.elements.startButton.dispatch('click');
    document.dispatch('keydown', { key: 'Escape' });
    document.dispatch('focusin', { target: new FakeElement('outside-share-sheet') });

    expect(onStartCamera).toHaveBeenCalledTimes(1);
    expect(onCloseShareSheet).toHaveBeenCalledTimes(1);
    expect(onShareFocusEscape).toHaveBeenCalledTimes(1);

    ui.destroy();

    ui.elements.startButton.dispatch('click');
    document.dispatch('keydown', { key: 'Escape' });
    document.dispatch('focusin', { target: new FakeElement('outside-share-sheet') });

    expect(onStartCamera).toHaveBeenCalledTimes(1);
    expect(onCloseShareSheet).toHaveBeenCalledTimes(1);
    expect(onShareFocusEscape).toHaveBeenCalledTimes(1);
  });
});

function installFakeDocument({ missingSelector } = {}) {
  const selectorMap = new Map();
  const listSelectorMap = new Map();

  REQUIRED_SELECTORS.forEach((selector) => {
    if (selector === missingSelector) return;
    selectorMap.set(selector, new FakeElement(selector));
  });

  REQUIRED_LIST_SELECTORS.forEach((selector) => {
    listSelectorMap.set(selector, [new FakeElement(selector)]);
  });

  const fakeDocument = new FakeElement('document');
  fakeDocument.querySelector = vi.fn((selector) => selectorMap.get(selector) ?? null);
  fakeDocument.querySelectorAll = vi.fn((selector) => listSelectorMap.get(selector) ?? []);

  globalThis.document = fakeDocument;
  return fakeDocument;
}
