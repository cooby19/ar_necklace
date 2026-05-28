import { vi } from 'vitest';
import { APP_MODES, AR_SESSION_STATES, CAMERA_FACING_MODES } from '../../app/AppState.js';
import { NECKLACES } from '../../config/necklaces.js';

export class FakeClassList {
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

export class FakeElement {
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
    this._innerHTML = '';
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

  set innerHTML(value) {
    this._innerHTML = String(value);
    this.children.forEach((child) => {
      child.parentElement = null;
    });
    this.children = [];
  }

  get innerHTML() {
    return this._innerHTML;
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
    if (name === 'id') {
      this.id = normalizedValue;
    }
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

export class FakeTextNode {
  constructor(textContent, ownerDocument = null) {
    this.textContent = textContent;
    this.ownerDocument = ownerDocument;
    this.parentElement = null;
  }
}

export const REQUIRED_SELECTORS = [
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

export function installFakeDocument({ missingSelector, missingListSelector } = {}) {
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

export function cleanupFakeDocument() {
  vi.restoreAllMocks();
  delete globalThis.document;
  delete globalThis.requestAnimationFrame;
}

export function createChildElement(parent, tagName, { dataset = {}, attributes = {} } = {}) {
  const child = new FakeElement(tagName, { tagName, ownerDocument: parent.ownerDocument });
  Object.entries(attributes).forEach(([name, value]) => child.setAttribute(name, value));
  Object.assign(child.dataset, dataset);
  Object.entries(dataset).forEach(([key, value]) => child.setAttribute(`data-${toKebabCase(key)}`, value));
  parent.append(child);
  return child;
}

export function createState(overrides = {}) {
  return {
    mode: APP_MODES.SHOWCASE,
    controlsCollapsed: true,
    activePanel: 'styles',
    modelLoaded: true,
    sessionStatus: AR_SESSION_STATES.SHOWCASE,
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
