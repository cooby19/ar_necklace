import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShareSheetView } from './ShareSheetView.js';
import { cleanupFakeDocument, createChildElement, installFakeDocument } from './test/fakeDom.js';

afterEach(() => {
  cleanupFakeDocument();
});

describe('ShareSheetView', () => {
  it('opens with background content inert and restores focus on close', () => {
    installFakeDocument();
    const captureButton = document.querySelector('#captureButton');
    const experienceColumn = document.querySelector('.experience-column');
    const controls = document.querySelector('.controls');
    const view = new ShareSheetView({
      backgroundElements: [experienceColumn, controls],
      getFocusReturnElement: () => captureButton,
    });

    view.open();

    expect(view.elements.shareSheet.hidden).toBe(false);
    expect(experienceColumn.inert).toBe(true);
    expect(controls.getAttribute('aria-hidden')).toBe('');
    expect(document.activeElement).toBe(view.elements.closeShareButtons[0]);

    view.close();

    expect(view.elements.shareSheet.hidden).toBe(true);
    expect(experienceColumn.inert).toBe(false);
    expect(controls.hasAttribute('aria-hidden')).toBe(false);
    expect(document.activeElement).toBe(captureButton);
  });

  it('traps Tab focus from the last share control back to the first', () => {
    installFakeDocument();
    const view = new ShareSheetView({
      backgroundElements: [],
      getFocusReturnElement: () => document.querySelector('#captureButton'),
    });
    const lastButton = createChildElement(view.elements.shareCard, 'button');
    document.activeElement = lastButton;

    const event = {
      key: 'Tab',
      shiftKey: false,
      preventDefault: vi.fn(),
    };

    view.trapFocus(event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(view.elements.closeShareButtons[0]);
  });
});
