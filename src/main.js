import './styles.css';
import { NECKLACES } from './config/necklaces.js';
import { AppState } from './app/AppState.js';
import { CaptureService } from './app/CaptureService.js';
import { ModeController } from './app/ModeController.js';
import { UiController } from './app/UiController.js';

const appState = new AppState({ necklaces: NECKLACES });
const uiController = new UiController({ necklaces: NECKLACES });
const captureService = new CaptureService({
  stageElement: uiController.elements.stage,
  videoElement: uiController.elements.video,
  threeCanvas: uiController.elements.threeCanvas,
});
const modeController = new ModeController({
  appState,
  uiController,
  captureService,
  necklaces: NECKLACES,
});

appState.subscribe((snapshot, meta) => {
  uiController.syncFromState(snapshot, meta);
});

uiController.bind({
  onModeSelect: (mode) => modeController.selectMode(mode),
  onPanelSelect: (panelName) => modeController.selectControlPanel(panelName),
  onBottomSheetToggle: () => modeController.toggleBottomSheet(),
  onShowcasePointerDown: (event) => modeController.handleShowcasePointerDown(event),
  onShowcasePointerMove: (event) => modeController.handleShowcasePointerMove(event),
  onShowcasePointerUp: (event) => modeController.handleShowcasePointerUp(event),
  onStartCamera: () => modeController.startExperience(),
  onSwitchCamera: () => modeController.switchCamera(),
  onStopCamera: () => modeController.stopExperience(),
  onCapture: () => modeController.handleCapture(),
  onDebugToggle: (isEnabled) => modeController.handleDebugToggle(isEnabled),
  onNecklaceToggle: (isVisible) => modeController.handleNecklaceToggle(isVisible),
  onNecklaceSelect: (necklaceId) => modeController.selectNecklace(necklaceId),
  onColorSelect: (colorId) => modeController.selectColor(colorId),
  onTuningInput: () => modeController.updateTuningFromControls(),
  onResetTuning: () => modeController.resetTuningControls(),
  onDownloadCapture: () => modeController.downloadCapture(),
  onShareCapture: () => modeController.shareCapture(),
  onCloseShareSheet: () => modeController.closeShareSheet(),
});

modeController.init();
