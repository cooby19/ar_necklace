import { afterEach, describe, expect, it, vi } from 'vitest';
import { APP_MODES, CAMERA_FACING_MODES } from './AppState.js';
import { UiController } from './UiController.js';
import { NECKLACES } from '../config/necklaces.js';

class FakeClassList {
  constructor(element) {
    this.element = element;
    this.classes = new Set();
  }

  add(...classNames) {
    classNames.forEach((className) => this.classes.add(className));
    this.sync();
  }

  remove(...classNames) {
    classNames.forEach((className) => this.classes.delete(className));
    this.sync();
  }

  toggle(className, force) {
    const shouldAdd = force ?? !this.classes.has(className);
    if (shouldAdd) {
      this.classes.add(className);
    } else {
      this.classes.delete(className);
    }
    this.sync();
    return shouldAdd;
  }

  contains(className) {
    return this.classes.has(className);
  }

  sync() {
    this.element.className = [...this.classes].join(' ');
  }
}

class FakeElement {
  constructor(selector, { tagName = 'div', ownerDocument = null } = {}) {
    this.selector = selector;
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.hidden = false;
    this.disabled = false;
    this.checked = false;
    this.dataset = {};
    this.listeners = new Map();
    this.tabIndex = 0;
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.className = '';
    this.title = '';
    this.type = '';
    this.src = '';
    this.alt = '';
    this.loading = '';
    this.decoding = '';
    this.open = false;
    this.inert = false;
    this.children = [];
    this.parentElement = null;
    this.attributes = new Map();
    this.classList = new FakeClassList(this);
    this.style = {
      values: new Map(),
      setProperty: vi.fn((name, value) => {
        this.style.values.set(name, value);
      }),
    };
    this.offsetWidth = 1;
    this.offsetHeight = 1;
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

  append(...nodes) {
    nodes.flat().forEach((node) => {
      const child = typeof node === 'string' ? new FakeTextNode(node, this.ownerDocument) : node;
      child.parentElement = this;
      child.ownerDocument = this.ownerDocument;
      this.children.push(child);
    });
  }

  replaceChildren(...nodes) {
    this.children.forEach((child) => {
      child.parentElement = null;
    });
    this.children = [];
    this.append(...nodes);
  }

  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
  }

  setAttribute(name, value) {
    const normalizedValue = String(value);
    this.attributes.set(name, normalizedValue);
    if (name === 'tabindex') {
      this.tabIndex = Number(normalizedValue);
    }
    if (name.startsWith('data-')) {
      this.dataset[toDatasetKey(name.slice(5))] = normalizedValue;
    }
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  toggleAttribute(name, force) {
    const shouldSet = force ?? !this.attributes.has(name);
    if (shouldSet) {
      this.setAttribute(name, '');
    } else {
      this.removeAttribute(name);
    }
    return shouldSet;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector) {
    const matches = [];
    this.children.forEach((child) => {
      if (!(child instanceof FakeElement)) return;
      if (child.matches(selector)) matches.push(child);
      matches.push(...child.querySelectorAll(selector));
    });
    return matches;
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (current.matches?.(selector)) return current;
      current = current.parentElement;
    }
    return null;
  }

  matches(selector) {
    return selector
      .split(',')
      .map((part) => part.trim())
      .some((part) => matchesSimpleSelector(this, part));
  }

  contains(target) {
    if (target === this) return true;
    return this.children.some((child) => child instanceof FakeElement && child.contains(target));
  }

  focus() {
    if (this.ownerDocument) {
      this.ownerDocument.activeElement = this;
    }
  }

  scrollIntoView() {
    return undefined;
  }

  getClientRects() {
    return [{ width: this.offsetWidth, height: this.offsetHeight }];
  }
}

class FakeTextNode {
  constructor(textContent, ownerDocument = null) {
    this.textContent = textContent;
    this.ownerDocument = ownerDocument;
    this.parentElement = null;
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

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.document;
  delete globalThis.requestAnimationFrame;
});

describe('UiController DOM guards', () => {
  it('throws a clear initialization error when a required element is missing', () => {
    installFakeDocument({ missingSelector: '#cameraVideo' });

    expect(() => new UiController({ necklaces: [] })).toThrow('Missing required UI element: #cameraVideo');
  });

  it('throws a clear initialization error when a required element list is missing', () => {
    installFakeDocument({ missingListSelector: '[data-mode]' });

    expect(() => new UiController({ necklaces: [] })).toThrow('Missing required UI element: [data-mode]');
  });
});

describe('UiController listener lifecycle', () => {
  it('binds core controls to the supplied handlers', () => {
    installFakeDocument();
    const ui = new UiController({ necklaces: NECKLACES });
    const handlers = {
      onModeSelect: vi.fn(),
      onPanelSelect: vi.fn(),
      onBottomSheetToggle: vi.fn(),
      onStartCamera: vi.fn(),
      onSwitchCamera: vi.fn(),
      onStopCamera: vi.fn(),
      onCapture: vi.fn(),
      onDebugToggle: vi.fn(),
      onNecklaceToggle: vi.fn(),
      onCloseShareSheet: vi.fn(),
    };

    ui.bind(handlers);
    ui.elements.modeButtons[1].dispatch('click');
    ui.elements.panelTabs[1].dispatch('click');
    ui.elements.bottomSheetToggle.dispatch('click');
    ui.elements.startButton.dispatch('click');
    ui.elements.switchCameraButton.dispatch('click');
    ui.elements.stopCameraButton.dispatch('click');
    ui.elements.captureButton.dispatch('click');
    ui.elements.debugToggle.checked = true;
    ui.elements.debugToggle.dispatch('change');
    ui.elements.necklaceToggle.checked = false;
    ui.elements.necklaceToggle.dispatch('change');
    ui.elements.closeShareButtons[0].dispatch('click');

    expect(handlers.onModeSelect).toHaveBeenCalledWith(APP_MODES.AR);
    expect(handlers.onPanelSelect).toHaveBeenCalledWith('fit');
    expect(handlers.onBottomSheetToggle).toHaveBeenCalledTimes(1);
    expect(handlers.onStartCamera).toHaveBeenCalledTimes(1);
    expect(handlers.onSwitchCamera).toHaveBeenCalledTimes(1);
    expect(handlers.onStopCamera).toHaveBeenCalledTimes(1);
    expect(handlers.onCapture).toHaveBeenCalledTimes(1);
    expect(handlers.onDebugToggle).toHaveBeenCalledWith(true);
    expect(handlers.onNecklaceToggle).toHaveBeenCalledWith(false);
    expect(handlers.onCloseShareSheet).toHaveBeenCalledTimes(1);
  });

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

  it('closes the share sheet on Escape when it is open', () => {
    const document = installFakeDocument();
    const ui = new UiController({ necklaces: [] });
    const onCloseShareSheet = vi.fn();

    ui.elements.shareSheet.hidden = false;
    ui.bind({ onCloseShareSheet });

    const event = document.dispatch('keydown', { key: 'Escape' });

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(onCloseShareSheet).toHaveBeenCalledTimes(1);
  });

  it('keeps share sheet Tab focus trapping from crashing when open', () => {
    const document = installFakeDocument();
    const ui = new UiController({ necklaces: [] });

    ui.elements.shareSheet.hidden = false;
    ui.bind({});

    expect(() => document.dispatch('keydown', { key: 'Tab' })).not.toThrow();
  });
});

describe('UiController state synchronization', () => {
  it('syncs mode classes, selected mode button, AR sections, capture visibility, and panels', () => {
    installFakeDocument();
    const ui = new UiController({ necklaces: NECKLACES });

    ui.syncFromState(createState({ mode: APP_MODES.AR, controlsCollapsed: false, activePanel: 'fit' }), {
      changes: ['mode', 'controlsCollapsed', 'activePanel', 'modelLoaded'],
    });

    expect(ui.elements.app.classList.contains('is-ar-mode')).toBe(true);
    expect(ui.elements.app.classList.contains('is-showcase-mode')).toBe(false);
    expect(ui.elements.modeButtons[0].classList.contains('is-selected')).toBe(false);
    expect(ui.elements.modeButtons[1].classList.contains('is-selected')).toBe(true);
    expect(ui.elements.modeButtons[1].getAttribute('aria-pressed')).toBe('true');
    expect(ui.elements.arSections.every((section) => section.hidden === false)).toBe(true);
    expect(ui.elements.captureButton.hidden).toBe(false);
    expect(ui.elements.bottomSheetToggle.getAttribute('aria-expanded')).toBe('true');
    expect(ui.elements.panelTabs[1].classList.contains('is-selected')).toBe(true);
    expect(ui.elements.controlPanels[1].classList.contains('is-active')).toBe(true);
    expect(ui.elements.controlPanels[1].open).toBe(true);
  });

  it('syncs camera button disabled states, title, aria-label, and selfie class', () => {
    installFakeDocument();
    const ui = new UiController({ necklaces: NECKLACES });

    ui.syncFromState(
      createState({
        cameraStarted: true,
        isSwitchingCamera: true,
        cameraFacingMode: CAMERA_FACING_MODES.ENVIRONMENT,
      }),
      { changes: ['cameraStarted', 'isSwitchingCamera', 'cameraFacingMode'] },
    );

    expect(ui.elements.stage.classList.contains('is-selfie-camera')).toBe(false);
    expect(ui.elements.switchCameraButton.disabled).toBe(true);
    expect(ui.elements.stopCameraButton.disabled).toBe(true);
    expect(ui.elements.switchCameraButton.getAttribute('aria-label')).toBe('鏡頭切換中');
    expect(ui.elements.switchCameraButton.title).toBe('鏡頭切換中');
  });

  it('syncs selected necklace to the select control and cards', () => {
    installFakeDocument();
    const ui = new UiController({ necklaces: NECKLACES });
    const selectedCard = createChildElement(ui.elements.necklaceCards, 'button', {
      dataset: { necklaceId: NECKLACES[0].id },
    });
    const otherCard = createChildElement(ui.elements.necklaceCards, 'button', {
      dataset: { necklaceId: 'other-necklace' },
    });

    ui.syncFromState(createState({ selectedNecklace: NECKLACES[0] }), {
      changes: ['selectedNecklace'],
    });

    expect(ui.elements.necklaceSelect.value).toBe(NECKLACES[0].id);
    expect(selectedCard.classList.contains('is-selected')).toBe(true);
    expect(selectedCard.getAttribute('aria-checked')).toBe('true');
    expect(selectedCard.tabIndex).toBe(0);
    expect(otherCard.classList.contains('is-selected')).toBe(false);
    expect(otherCard.getAttribute('aria-checked')).toBe('false');
    expect(otherCard.tabIndex).toBe(-1);
  });

  it('syncs selected colors to swatch selected state and tab order', () => {
    installFakeDocument();
    const ui = new UiController({ necklaces: NECKLACES });
    const gemGroup = createChildElement(ui.elements.colorSwatches, 'div', {
      attributes: { role: 'radiogroup' },
    });
    const roseGem = createChildElement(gemGroup, 'button', {
      dataset: { colorId: 'rose-quartz', colorTargetId: 'gem' },
    });
    const amethystGem = createChildElement(gemGroup, 'button', {
      dataset: { colorId: 'amethyst', colorTargetId: 'gem' },
    });
    const metalGroup = createChildElement(ui.elements.colorSwatches, 'div', {
      attributes: { role: 'radiogroup' },
    });
    const roseMetal = createChildElement(metalGroup, 'button', {
      dataset: { colorId: 'rose-quartz', colorTargetId: 'metal' },
    });
    const citrineMetal = createChildElement(metalGroup, 'button', {
      dataset: { colorId: 'citrine', colorTargetId: 'metal' },
    });

    ui.syncFromState(
      createState({
        selectedColorId: 'rose-quartz',
        selectedColorIdsByTarget: {
          gem: 'amethyst',
          metal: 'citrine',
        },
      }),
      { changes: ['selectedColorId', 'selectedColorIdsByTarget'] },
    );

    expect(roseGem.classList.contains('is-selected')).toBe(false);
    expect(roseGem.tabIndex).toBe(-1);
    expect(amethystGem.classList.contains('is-selected')).toBe(true);
    expect(amethystGem.getAttribute('aria-checked')).toBe('true');
    expect(amethystGem.tabIndex).toBe(0);
    expect(roseMetal.classList.contains('is-selected')).toBe(false);
    expect(citrineMetal.classList.contains('is-selected')).toBe(true);
    expect(citrineMetal.tabIndex).toBe(0);
  });

  it('shows the developer panel only when debug is enabled in AR mode', () => {
    installFakeDocument();
    const ui = new UiController({ necklaces: NECKLACES });

    ui.syncFromState(createState({ mode: APP_MODES.AR, debugEnabled: true }), {
      changes: ['mode', 'debugEnabled'],
    });

    expect(ui.elements.developerPanel.hidden).toBe(false);

    ui.syncFromState(createState({ mode: APP_MODES.SHOWCASE, debugEnabled: true }), {
      changes: ['mode', 'debugEnabled'],
    });

    expect(ui.elements.developerPanel.hidden).toBe(true);
  });
});

function installFakeDocument({ missingSelector, missingListSelector } = {}) {
  const selectorMap = new Map();
  const listSelectorMap = new Map();

  const fakeDocument = new FakeElement('document', { tagName: 'document' });
  fakeDocument.activeElement = null;
  fakeDocument.createElement = vi.fn((tagName) => new FakeElement(tagName, { tagName, ownerDocument: fakeDocument }));
  fakeDocument.createTextNode = vi.fn((textContent) => new FakeTextNode(textContent, fakeDocument));

  REQUIRED_SELECTORS.forEach((selector) => {
    if (selector === missingSelector) return;
    selectorMap.set(selector, createRequiredElement(selector, fakeDocument));
  });

  listSelectorMap.set(
    '[data-mode]',
    [
      createListElement('[data-mode="showcase"]', fakeDocument, { mode: APP_MODES.SHOWCASE }),
      createListElement('[data-mode="ar"]', fakeDocument, { mode: APP_MODES.AR }),
    ],
  );
  listSelectorMap.set(
    '[data-panel-tab]',
    [
      createListElement('[data-panel-tab="styles"]', fakeDocument, { panelTab: 'styles' }),
      createListElement('[data-panel-tab="fit"]', fakeDocument, { panelTab: 'fit' }),
    ],
  );
  listSelectorMap.set(
    '[data-control-panel]',
    [
      createListElement('[data-control-panel="styles"]', fakeDocument, { controlPanel: 'styles' }),
      createListElement('[data-control-panel="fit"]', fakeDocument, { controlPanel: 'fit' }),
    ],
  );
  listSelectorMap.set('[data-ar-section]', [
    createListElement('[data-ar-section="camera"]', fakeDocument, { arSection: 'camera' }),
    createListElement('[data-ar-section="fit"]', fakeDocument, { arSection: 'fit' }),
  ]);
  const closeShareButton = createListElement('[data-close-share]', fakeDocument, { closeShare: '' });
  selectorMap.get('.share-card')?.append(closeShareButton);
  listSelectorMap.set('[data-close-share]', [closeShareButton]);

  if (missingListSelector) {
    listSelectorMap.set(missingListSelector, []);
  }

  fakeDocument.querySelector = vi.fn((selector) => selectorMap.get(selector) ?? null);
  fakeDocument.querySelectorAll = vi.fn((selector) => listSelectorMap.get(selector) ?? []);

  globalThis.document = fakeDocument;
  globalThis.requestAnimationFrame = (callback) => {
    callback();
    return 1;
  };
  return fakeDocument;
}

function createRequiredElement(selector, ownerDocument) {
  const tagName = selector.toLowerCase().includes('button') || selector === '#captureButton' ? 'button' : 'div';
  const element = new FakeElement(selector, { tagName, ownerDocument });
  if (selector.startsWith('#')) element.setAttribute('id', selector.slice(1));
  if (selector.startsWith('.')) element.classList.add(selector.slice(1));
  return element;
}

function createListElement(selector, ownerDocument, dataset) {
  const element = new FakeElement(selector, { tagName: 'button', ownerDocument });
  Object.assign(element.dataset, dataset);
  Object.entries(dataset).forEach(([key, value]) => {
    element.setAttribute(`data-${toKebabCase(key)}`, value);
  });
  return element;
}

function createChildElement(parent, tagName, { dataset = {}, attributes = {} } = {}) {
  const child = new FakeElement(tagName, { tagName, ownerDocument: parent.ownerDocument });
  Object.entries(attributes).forEach(([name, value]) => child.setAttribute(name, value));
  Object.assign(child.dataset, dataset);
  Object.entries(dataset).forEach(([key, value]) => child.setAttribute(`data-${toKebabCase(key)}`, value));
  parent.append(child);
  return child;
}

function createState(overrides = {}) {
  return {
    mode: APP_MODES.SHOWCASE,
    controlsCollapsed: true,
    activePanel: 'styles',
    modelLoaded: true,
    cameraStarted: false,
    isSwitchingCamera: false,
    cameraFacingMode: CAMERA_FACING_MODES.USER,
    selectedNecklace: NECKLACES[0],
    selectedColorId: 'rose-quartz',
    selectedColorIdsByTarget: {
      metal: 'rose-quartz',
      pendant: 'rose-quartz',
      gem: 'rose-quartz',
    },
    necklaceVisible: true,
    debugEnabled: false,
    ...overrides,
  };
}

function matchesSimpleSelector(element, selector) {
  if (!selector) return false;
  if (selector.includes(':not([disabled])') && element.disabled) return false;
  const withoutDisabledNot = selector.replace(':not([disabled])', '');
  const tabindexNot = withoutDisabledNot.match(/^\[tabindex\]:not\(\[tabindex="(-?\d+)"\]\)$/);
  if (tabindexNot) {
    return element.hasAttribute('tabindex') && element.getAttribute('tabindex') !== tabindexNot[1];
  }
  if (withoutDisabledNot.startsWith('#')) {
    return element.getAttribute('id') === withoutDisabledNot.slice(1);
  }
  if (withoutDisabledNot.startsWith('.')) {
    return element.classList.contains(withoutDisabledNot.slice(1));
  }
  const attrMatch = withoutDisabledNot.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
  if (attrMatch) {
    const [, name, value] = attrMatch;
    if (value === undefined) return element.hasAttribute(name);
    return element.getAttribute(name) === value;
  }
  const tagWithAttrMatch = withoutDisabledNot.match(/^([a-z]+)\[([^=\]]+)(?:="([^"]*)")?\]$/i);
  if (tagWithAttrMatch) {
    const [, tagName, name, value] = tagWithAttrMatch;
    if (element.tagName.toLowerCase() !== tagName.toLowerCase()) return false;
    if (value === undefined) return element.hasAttribute(name);
    return element.getAttribute(name) === value;
  }
  return element.tagName.toLowerCase() === withoutDisabledNot.toLowerCase();
}

function toDatasetKey(kebabName) {
  return kebabName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function toKebabCase(camelName) {
  return camelName.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
