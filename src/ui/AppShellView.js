import { queryRequired, queryRequiredAll } from './domHelpers.js';

export class AppShellView {
  constructor() {
    this.elements = {
      app: queryRequired('#app'),
      stage: queryRequired('.stage'),
      video: queryRequired('#cameraVideo'),
      threeCanvas: queryRequired('#threeCanvas'),
      debugCanvas: queryRequired('#debugCanvas'),
      livePill: queryRequired('.live-pill'),
      experienceColumn: queryRequired('.experience-column'),
      controls: queryRequired('.controls'),
      bottomSheetToggle: queryRequired('#bottomSheetToggle'),
      modeButtons: queryRequiredAll('[data-mode]'),
      panelTabs: queryRequiredAll('[data-panel-tab]'),
      controlPanels: queryRequiredAll('[data-control-panel]'),
      arSections: queryRequiredAll('[data-ar-section]'),
    };
  }

  bind(handlers, listen) {
    this.elements.modeButtons.forEach((button) => {
      listen(button, 'click', () => handlers.onModeSelect?.(button.dataset.mode));
    });

    this.elements.panelTabs.forEach((button) => {
      listen(button, 'click', () => handlers.onPanelSelect?.(button.dataset.panelTab));
    });

    listen(this.elements.bottomSheetToggle, 'click', () => handlers.onBottomSheetToggle?.());

    listen(this.elements.threeCanvas, 'pointerdown', (event) => handlers.onShowcasePointerDown?.(event));
    listen(this.elements.threeCanvas, 'pointermove', (event) => handlers.onShowcasePointerMove?.(event));
    listen(this.elements.threeCanvas, 'pointerup', (event) => handlers.onShowcasePointerUp?.(event));
    listen(this.elements.threeCanvas, 'pointercancel', (event) => handlers.onShowcasePointerUp?.(event));
    listen(this.elements.threeCanvas, 'pointerleave', (event) => handlers.onShowcasePointerUp?.(event));
  }

  syncMode({ mode, isShowcase, controlsCollapsed, activePanel }) {
    this.elements.app.classList.toggle('is-showcase-mode', isShowcase);
    this.elements.app.classList.toggle('is-ar-mode', !isShowcase);
    this.setControlsCollapsed(controlsCollapsed);

    this.elements.modeButtons.forEach((button) => {
      const isSelected = button.dataset.mode === mode;
      button.classList.toggle('is-selected', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
    });

    this.elements.arSections.forEach((section) => {
      section.hidden = isShowcase;
    });

    this.elements.stage.classList.toggle('is-showcase', isShowcase);
    this.elements.stage.classList.toggle('is-ar-mode', !isShowcase);
    this.elements.livePill.textContent = isShowcase ? '3D Model' : 'Live AR';
    this.syncBottomSheet({ controlsCollapsed });
    this.syncPanels({ activePanel });
  }

  syncBottomSheet({ controlsCollapsed }) {
    this.setControlsCollapsed(controlsCollapsed);
    this.elements.bottomSheetToggle.setAttribute('aria-expanded', String(!controlsCollapsed));
    this.elements.bottomSheetToggle.setAttribute('aria-label', controlsCollapsed ? '展開試戴選項' : '收起試戴選項');
  }

  syncPanels({ activePanel }) {
    this.elements.panelTabs.forEach((button) => {
      const isSelected = button.dataset.panelTab === activePanel;
      button.classList.toggle('is-selected', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
    });

    this.elements.controlPanels.forEach((panel) => {
      const isSelected = panel.dataset.controlPanel === activePanel;
      panel.classList.toggle('is-active', isSelected);
      if (isSelected) {
        panel.open = true;
      }
    });
  }

  canSelectControlPanel(panelName) {
    const panel = this.elements.controlPanels.find((item) => item.dataset.controlPanel === panelName);
    return Boolean(panel && !panel.hidden);
  }

  setCameraOn(isCameraOn) {
    this.elements.stage.classList.toggle('is-camera-on', isCameraOn);
  }

  setSelfieCamera(isSelfie) {
    this.elements.stage.classList.toggle('is-selfie-camera', isSelfie);
  }

  setCalibrationDragging(isDragging) {
    this.elements.stage.classList.toggle('is-dragging-calibration', isDragging);
  }

  setShowcaseDragging(isDragging) {
    this.elements.stage.classList.toggle('is-dragging-showcase', isDragging);
  }

  setControlsCollapsed(isCollapsed) {
    this.elements.app.classList.toggle('is-controls-collapsed', isCollapsed);
  }

  setRoute(route) {
    const isGallery = route === 'gallery';
    this.elements.app.classList.toggle('is-gallery-route', isGallery);
    this.elements.app.classList.toggle('is-experience-route', !isGallery);
  }
}
