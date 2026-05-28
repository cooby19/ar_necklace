import { afterEach, describe, expect, it, vi } from 'vitest';
import { APP_MODES, AR_SESSION_STATES, CAMERA_FACING_MODES } from '../app/AppState.js';
import { NECKLACES } from '../config/necklaces.js';
import {
  cleanupFakeDocument,
  createChildElement,
  createState,
  FakeElement,
  installFakeDocument,
} from './test/fakeDom.js';
import { UiRoot } from './UiRoot.js';

afterEach(() => {
  cleanupFakeDocument();
});

describe('UiRoot DOM guards', () => {
  it('throws a clear initialization error when a required element is missing', () => {
    installFakeDocument({ missingSelector: '#cameraVideo' });

    expect(() => new UiRoot({ necklaces: [] })).toThrow('Missing required UI element: #cameraVideo');
  });

  it('throws a clear initialization error when a required element list is missing', () => {
    installFakeDocument({ missingListSelector: '[data-mode]' });

    expect(() => new UiRoot({ necklaces: [] })).toThrow('Missing required UI element: [data-mode]');
  });
});

describe('UiRoot catalog rendering', () => {
  it('renders every configured necklace in the select control and card list', () => {
    installFakeDocument();
    const ui = new UiRoot({ necklaces: NECKLACES });

    ui.populateNecklaceSelect(NECKLACES[1].id);

    expect(ui.elements.necklaceSelect.children).toHaveLength(NECKLACES.length);
    expect(ui.elements.necklaceCards.children).toHaveLength(NECKLACES.length);
    expect(ui.elements.necklaceSelect.children.map((option) => option.value)).toEqual(
      NECKLACES.map((necklace) => necklace.id),
    );
    expect(ui.elements.necklaceCards.children.map((card) => card.dataset.necklaceId)).toEqual(
      NECKLACES.map((necklace) => necklace.id),
    );
    expect(ui.elements.necklaceCards.children[1].getAttribute('aria-checked')).toBe('true');
  });

  it('renders color target swatch groups only for matched target ids', () => {
    installFakeDocument();
    const ui = new UiRoot({ necklaces: NECKLACES });

    ui.populateColorSwatches({
      necklace: NECKLACES[0],
      selectedColorIdsByTarget: {
        metal: 'citrine',
        gem: 'amethyst',
      },
      fallbackColorId: 'rose-quartz',
      targetIds: ['metal', 'gem'],
    });

    const groups = ui.elements.colorSwatches.children;
    const targetIds = [
      ...new Set(
        ui.elements.colorSwatches
          .querySelectorAll('[data-color-id]')
          .map((swatch) => swatch.dataset.colorTargetId),
      ),
    ];

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.children[0].textContent)).toEqual(['金屬', '寶石']);
    expect(targetIds).toEqual(['metal', 'gem']);
    expect(ui.elements.colorSwatches.hasAttribute('hidden')).toBe(false);
  });
});

describe('UiRoot listener lifecycle', () => {
  it('binds core controls to the supplied handlers', () => {
    installFakeDocument();
    const ui = new UiRoot({ necklaces: NECKLACES });
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
    const ui = new UiRoot({ necklaces: [] });
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
    const ui = new UiRoot({ necklaces: [] });
    const onCloseShareSheet = vi.fn();

    ui.elements.shareSheet.hidden = false;
    ui.bind({ onCloseShareSheet });

    const event = document.dispatch('keydown', { key: 'Escape' });

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(onCloseShareSheet).toHaveBeenCalledTimes(1);
  });

  it('keeps share sheet Tab focus trapping from crashing when open', () => {
    const document = installFakeDocument();
    const ui = new UiRoot({ necklaces: [] });

    ui.elements.shareSheet.hidden = false;
    ui.bind({});

    expect(() => document.dispatch('keydown', { key: 'Tab' })).not.toThrow();
  });
});

describe('UiRoot state synchronization', () => {
  it('syncs mode classes, selected mode button, AR sections, capture visibility, and panels', () => {
    installFakeDocument();
    const ui = new UiRoot({ necklaces: NECKLACES });

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
    const ui = new UiRoot({ necklaces: NECKLACES });

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

  it('keeps camera switching disabled while face tracking assets initialize', () => {
    installFakeDocument();
    const ui = new UiRoot({ necklaces: NECKLACES });

    ui.syncFromState(
      createState({
        cameraStarted: true,
        sessionStatus: AR_SESSION_STATES.TRACKING_STARTING,
      }),
      { changes: ['cameraStarted', 'sessionStatus'] },
    );

    expect(ui.elements.switchCameraButton.disabled).toBe(true);
    expect(ui.elements.stopCameraButton.disabled).toBe(false);
  });

  it('syncs selected necklace to the select control and cards', () => {
    installFakeDocument();
    const ui = new UiRoot({ necklaces: NECKLACES });
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
    const ui = new UiRoot({ necklaces: NECKLACES });
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
    const ui = new UiRoot({ necklaces: NECKLACES });

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
