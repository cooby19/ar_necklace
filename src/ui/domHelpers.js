const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const PREVIOUS_TABINDEX_ATTRIBUTE = 'data-share-previous-tabindex';

export function queryRequired(selector, root = document) {
  const element = root.querySelector(selector);
  if (!element) {
    throw new Error(`Missing required UI element: ${selector}`);
  }
  return element;
}

export function queryRequiredAll(selector, root = document) {
  const elements = [...root.querySelectorAll(selector)];
  if (!elements.length) {
    throw new Error(`Missing required UI element: ${selector}`);
  }
  return elements;
}

export function createListenerRegistry() {
  const disposers = [];

  return {
    listen(target, eventName, handler, options) {
      target.addEventListener(eventName, handler, options);
      const dispose = () => target.removeEventListener(eventName, handler, options);
      disposers.push(dispose);
      return dispose;
    },
    clear() {
      disposers.splice(0).forEach((dispose) => dispose());
    },
  };
}

export function handleRadioKeydown(event, { currentItem, items, onSelect }) {
  if (!items.length) return;

  const currentIndex = items.indexOf(currentItem);
  if (currentIndex < 0) return;

  const movement = getRadioKeyMovement(event.key);
  if (movement !== null) {
    event.preventDefault();

    const nextIndex = wrapIndex(currentIndex + movement, items.length);
    selectRadioItem(items[nextIndex], onSelect);
    return;
  }

  if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault();
    selectRadioItem(event.key === 'Home' ? items[0] : items[items.length - 1], onSelect);
    return;
  }

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    selectRadioItem(currentItem, onSelect);
  }
}

export function getVisibleFocusableElements(root) {
  return [...root.querySelectorAll(FOCUSABLE_SELECTOR)].filter(isElementFocusable);
}

export function setBackgroundFocusableState(root, isInert) {
  root.querySelectorAll(`${FOCUSABLE_SELECTOR}, [${PREVIOUS_TABINDEX_ATTRIBUTE}]`).forEach((element) => {
    if (isInert) {
      if (!element.hasAttribute(PREVIOUS_TABINDEX_ATTRIBUTE)) {
        element.setAttribute(PREVIOUS_TABINDEX_ATTRIBUTE, element.getAttribute('tabindex') ?? '');
      }
      element.tabIndex = -1;
      return;
    }

    if (!element.hasAttribute(PREVIOUS_TABINDEX_ATTRIBUTE)) return;

    const previousTabIndex = element.getAttribute(PREVIOUS_TABINDEX_ATTRIBUTE);
    if (previousTabIndex) {
      element.setAttribute('tabindex', previousTabIndex);
    } else {
      element.removeAttribute('tabindex');
    }
    element.removeAttribute(PREVIOUS_TABINDEX_ATTRIBUTE);
  });
}

export function formatSignedNumber(value) {
  if (value > 0) return `+${value}`;
  return String(value);
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getRadioKeyMovement(key) {
  if (key === 'ArrowRight' || key === 'ArrowDown') return 1;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return -1;
  return null;
}

function selectRadioItem(item, onSelect) {
  item.focus({ preventScroll: true });
  item.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  onSelect(item);
}

function wrapIndex(index, length) {
  return (index + length) % length;
}

function isElementFocusable(element) {
  return !element.disabled && element.tabIndex !== -1 && isElementVisible(element);
}

function isElementVisible(element) {
  return Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
}
