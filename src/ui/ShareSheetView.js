import {
  getVisibleFocusableElements,
  queryRequired,
  queryRequiredAll,
  setBackgroundFocusableState,
} from './domHelpers.js';

export class ShareSheetView {
  constructor({ backgroundElements, getFocusReturnElement }) {
    this.backgroundElements = backgroundElements;
    this.getFocusReturnElement = getFocusReturnElement;
    this.shareFocusReturnElement = null;
    this.elements = {
      shareSheet: queryRequired('#shareSheet'),
      shareCard: queryRequired('.share-card'),
      shareImage: queryRequired('#shareImage'),
      downloadCaptureButton: queryRequired('#downloadCaptureButton'),
      shareCaptureButton: queryRequired('#shareCaptureButton'),
      closeShareButtons: queryRequiredAll('[data-close-share]'),
    };
  }

  bind(handlers, listen, callbacks = {}) {
    listen(this.elements.downloadCaptureButton, 'click', () => handlers.onDownloadCapture?.());
    listen(this.elements.shareCaptureButton, 'click', () => handlers.onShareCapture?.());

    this.elements.closeShareButtons.forEach((button) => {
      listen(button, 'click', () => handlers.onCloseShareSheet?.());
    });

    listen(document, 'keydown', (event) => {
      if (this.elements.shareSheet.hidden) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        handlers.onCloseShareSheet?.();
        return;
      }

      if (event.key === 'Tab') {
        this.trapFocus(event);
      }
    });

    listen(document, 'focusin', (event) => {
      if (this.elements.shareSheet.hidden || this.elements.shareCard.contains(event.target)) return;
      if (callbacks.focusFirstShareSheetControl) {
        callbacks.focusFirstShareSheetControl();
        return;
      }
      this.focusFirstControl();
    });
  }

  setImage(dataUrl) {
    this.elements.shareImage.src = dataUrl;
  }

  open() {
    this.shareFocusReturnElement = this.getFocusReturnElement();
    this.elements.shareSheet.hidden = false;
    this.focusFirstControl({ immediate: true });
    this.setBackgroundInert(true);
  }

  close() {
    this.elements.shareSheet.hidden = true;
    this.setBackgroundInert(false);
    this.restoreFocus();
  }

  focusFirstControl({ immediate = false } = {}) {
    const focusTarget = () => {
      const closeButton = this.elements.shareCard.querySelector('[data-close-share]');
      const firstElement = closeButton ?? this.getFocusableElements()[0] ?? this.elements.shareCard;
      firstElement.focus({ preventScroll: true });
    };

    if (immediate) {
      focusTarget();
      return;
    }

    requestAnimationFrame(focusTarget);
  }

  trapFocus(event) {
    const focusableElements = this.getFocusableElements();
    if (!focusableElements.length) {
      event.preventDefault();
      this.elements.shareCard.focus({ preventScroll: true });
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus({ preventScroll: true });
      return;
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus({ preventScroll: true });
    }
  }

  getFocusableElements() {
    return getVisibleFocusableElements(this.elements.shareCard);
  }

  setBackgroundInert(isInert) {
    this.backgroundElements.forEach((element) => {
      if (!element) return;
      element.inert = isInert;
      element.toggleAttribute('aria-hidden', isInert);
      setBackgroundFocusableState(element, isInert);
    });
  }

  restoreFocus() {
    requestAnimationFrame(() => {
      const fallbackElement = this.getFocusReturnElement();
      const target = this.shareFocusReturnElement ?? fallbackElement;
      if (target?.hidden || target?.disabled) return;
      target.focus({ preventScroll: true });
      this.shareFocusReturnElement = null;
    });
  }
}
