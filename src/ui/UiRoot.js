import { APP_MODES, APP_ROUTES, AR_SESSION_STATES, isSelfieCamera } from '../app/AppState.js';
import { AppShellView } from './AppShellView.js';
import { CalibrationPanelView } from './CalibrationPanelView.js';
import { CameraToolbarView } from './CameraToolbarView.js';
import { ColorPanelView } from './ColorPanelView.js';
import { DeveloperPanelView } from './DeveloperPanelView.js';
import { createListenerRegistry, queryRequired } from './domHelpers.js';
import { GalleryView } from './GalleryView.js';
import { NecklacePanelView } from './NecklacePanelView.js';
import { ShareSheetView } from './ShareSheetView.js';
import { StatusPanelView } from './StatusPanelView.js';

export class UiRoot {
  constructor({ necklaces }) {
    this.necklaces = necklaces;
    this.listenerRegistry = createListenerRegistry();
    this.appShellView = new AppShellView();
    this.cameraToolbarView = new CameraToolbarView({ appShell: this.appShellView });
    this.necklacePanelView = new NecklacePanelView({ necklaces });
    this.galleryView = new GalleryView({ necklaces });
    this.colorPanelView = new ColorPanelView();
    this.calibrationPanelView = new CalibrationPanelView();
    this.shareSheetView = new ShareSheetView({
      backgroundElements: [this.appShellView.elements.experienceColumn, this.appShellView.elements.controls],
      getFocusReturnElement: () => this.cameraToolbarView.elements.captureButton,
    });
    this.developerPanelView = new DeveloperPanelView();
    this.statusPanelView = new StatusPanelView();
    this.errorElements = {
      errorBox: queryRequired('#errorBox'),
    };

    this.elements = {
      ...this.appShellView.elements,
      ...this.developerPanelView.elements,
      ...this.cameraToolbarView.elements,
      ...this.necklacePanelView.elements,
      ...this.galleryView.elements,
      ...this.colorPanelView.elements,
      ...this.calibrationPanelView.elements,
      ...this.shareSheetView.elements,
      ...this.statusPanelView.elements,
      ...this.errorElements,
    };
  }

  bind(handlers) {
    this.destroy();
    const listen = (...args) => this.listenerRegistry.listen(...args);

    this.appShellView.bind(handlers, listen);
    this.cameraToolbarView.bind(handlers, listen);
    this.necklacePanelView.bind(handlers, listen);
    this.galleryView.bind(handlers, listen);
    this.colorPanelView.bind(handlers, listen);
    this.calibrationPanelView.bind(handlers, listen);
    this.shareSheetView.bind(handlers, listen, {
      focusFirstShareSheetControl: (...args) => this.focusFirstShareSheetControl(...args),
    });
  }

  destroy() {
    this.listenerRegistry.clear();
  }

  populateNecklaceSelect(selectedNecklaceId) {
    this.necklacePanelView.populate(selectedNecklaceId);
  }

  populateGallery() {
    this.galleryView.populate();
  }

  populateColorSwatches(model) {
    this.colorPanelView.populate(model);
  }

  syncFromState(state, meta = {}) {
    const changes = meta.changes ?? [];
    const shouldSync = (keys) => !changes.length || keys.some((key) => changes.includes(key));

    if (shouldSync(['route'])) {
      this.syncRouteUi(state);
    }

    if (shouldSync(['mode', 'controlsCollapsed', 'activePanel', 'modelLoaded'])) {
      this.syncModeUi(state);
    }

    if (shouldSync(['cameraStarted', 'isSwitchingCamera', 'cameraFacingMode', 'sessionStatus'])) {
      this.syncCameraUi(state);
    }

    if (shouldSync(['selectedNecklace'])) {
      this.syncNecklaceSelection(state.selectedNecklace.id);
      this.updateColorMeaning(state.selectedNecklace, state.selectedColorId);
    } else if (shouldSync(['selectedColorId', 'selectedColorIdsByTarget'])) {
      this.syncColorSelection({
        selectedColorIdsByTarget: state.selectedColorIdsByTarget,
        fallbackColorId: state.selectedColorId,
      });
      this.updateColorMeaning(state.selectedNecklace, state.selectedColorId);
    }

    if (shouldSync(['necklaceVisible', 'debugEnabled'])) {
      this.cameraToolbarView.syncToggles({
        necklaceVisible: state.necklaceVisible,
        debugEnabled: state.debugEnabled,
      });
    }

    if (shouldSync(['mode', 'debugEnabled'])) {
      this.setDeveloperPanelVisible(state.mode === APP_MODES.AR && state.debugEnabled);
    }
  }

  syncRouteUi(state) {
    this.appShellView.setRoute(state.route);
    this.galleryView.setVisible(state.route === APP_ROUTES.GALLERY);
  }

  syncModeUi(state) {
    const isShowcase = state.mode === APP_MODES.SHOWCASE;

    this.appShellView.syncMode({
      mode: state.mode,
      isShowcase,
      controlsCollapsed: state.controlsCollapsed,
      activePanel: state.activePanel,
    });
    this.cameraToolbarView.setCaptureVisible(!isShowcase);
  }

  syncBottomSheetUi(state) {
    this.appShellView.syncBottomSheet({
      controlsCollapsed: state.controlsCollapsed,
    });
  }

  syncPanelUi(state) {
    this.appShellView.syncPanels({
      activePanel: state.activePanel,
    });
  }

  canSelectControlPanel(panelName) {
    return this.appShellView.canSelectControlPanel(panelName);
  }

  syncCameraUi(state) {
    this.cameraToolbarView.syncCameraControls({
      isSelfie: isSelfieCamera(state.cameraFacingMode),
      cameraStarted: state.cameraStarted,
      isSwitchingCamera: state.isSwitchingCamera,
      isTrackingStarting: state.sessionStatus === AR_SESSION_STATES.TRACKING_STARTING,
    });
  }

  syncNecklaceSelection(necklaceId) {
    this.necklacePanelView.syncSelection(necklaceId);
  }

  syncColorSelection(model) {
    this.colorPanelView.syncSelection(model);
  }

  updateColorMeaning(necklace, colorId) {
    this.colorPanelView.updateMeaning(necklace, colorId);
  }

  updateColorUiAvailability(model) {
    this.colorPanelView.updateAvailability(model);
  }

  syncColorSwatchTabIndex(isAvailable) {
    this.colorPanelView.syncSwatchTabIndex(isAvailable);
  }

  readTuningControls() {
    return this.calibrationPanelView.readControls();
  }

  resetTuningControls(defaults) {
    return this.calibrationPanelView.resetControls(defaults);
  }

  syncTuningControlsFromAdjustments(adjustments = {}) {
    return this.calibrationPanelView.syncControlsFromAdjustments(adjustments);
  }

  setCalibrationHint(message, options = {}) {
    this.calibrationPanelView.setHint(message, options);
  }

  setCalibrationDragging(isDragging) {
    this.appShellView.setCalibrationDragging(isDragging);
  }

  setStatus(kind, label, metrics) {
    this.statusPanelView.setStatus(kind, label, metrics, {
      debugEnabled: this.isDebugEnabled(),
    });
  }

  setStartButtonLabel(label) {
    this.cameraToolbarView.setStartButtonLabel(label);
  }

  setCameraOn(isCameraOn) {
    this.appShellView.setCameraOn(isCameraOn);
  }

  setCaptureDisabled(isDisabled) {
    this.cameraToolbarView.setCaptureDisabled(isDisabled);
  }

  setCaptureBusy(isBusy) {
    this.cameraToolbarView.setCaptureBusy(isBusy);
  }

  setShowcaseDragging(isDragging) {
    this.appShellView.setShowcaseDragging(isDragging);
  }

  setShareImage(dataUrl) {
    this.shareSheetView.setImage(dataUrl);
  }

  openShareSheet() {
    this.shareSheetView.open();
  }

  closeShareSheet() {
    this.shareSheetView.close();
  }

  setShareBackgroundInert(isInert) {
    this.shareSheetView.setBackgroundInert(isInert);
  }

  trapShareSheetFocus(event) {
    this.shareSheetView.trapFocus(event);
  }

  focusFirstShareSheetControl(options = {}) {
    this.shareSheetView.focusFirstControl(options);
  }

  restoreShareSheetFocus() {
    this.shareSheetView.restoreFocus();
  }

  getShareSheetFocusableElements() {
    return this.shareSheetView.getFocusableElements();
  }

  setDeveloperPanelVisible(isVisible) {
    this.developerPanelView.setVisible(isVisible);
  }

  updateDeveloperPanel(model) {
    this.developerPanelView.update(model);
  }

  setReleaseMetadata(metadata) {
    this.developerPanelView.setReleaseMetadata(metadata);
  }

  isDebugEnabled() {
    return this.cameraToolbarView.isDebugEnabled();
  }

  hasCurrentVideoFrame() {
    return this.elements.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
  }

  showError(message) {
    this.elements.errorBox.hidden = false;
    this.elements.errorBox.textContent = message;
    console.error(message);
  }

  clearError() {
    this.elements.errorBox.hidden = true;
    this.elements.errorBox.textContent = '';
  }
}
