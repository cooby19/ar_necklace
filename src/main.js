import './styles/index.css';
import { NECKLACES } from './config/necklaces.js';
import { RELEASE_METADATA } from './config/release.js';
import { AppState } from './app/AppState.js';
import { CaptureService } from './app/CaptureService.js';
import { runtimeErrorReporter } from './telemetry/RuntimeErrorReporter.js';
import { UiController } from './app/UiController.js';

runtimeErrorReporter.installGlobalHandlers();
bootstrap();

async function bootstrap() {
  const appState = new AppState({ necklaces: NECKLACES });
  const uiController = new UiController({ necklaces: NECKLACES });
  uiController.setReleaseMetadata(RELEASE_METADATA);
  exposeRuntimeMetadata(RELEASE_METADATA);

  const captureService = new CaptureService({
    stageElement: uiController.elements.stage,
    videoElement: uiController.elements.video,
    threeCanvas: uiController.elements.threeCanvas,
  });

  try {
    const [{ createAppRuntime }, { ModeController }] = await Promise.all([
      import('./app/createAppRuntime.js'),
      import('./app/ModeController.js'),
    ]);
    const runtime = createAppRuntime({
      appState,
      uiController,
      captureService,
      necklaces: NECKLACES,
    });
    const modeController = new ModeController({
      appState,
      uiController,
      runtime,
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
      onColorSelect: (colorId, targetId) => modeController.selectColor(colorId, targetId),
      onTuningInput: () => modeController.updateTuningFromControls(),
      onSaveCalibration: () => modeController.saveCalibration(),
      onResetCalibration: () => modeController.resetCalibration(),
      onDownloadCapture: () => modeController.downloadCapture(),
      onShareCapture: () => modeController.shareCapture(),
      onCloseShareSheet: () => modeController.closeShareSheet(),
    });

    modeController.init();
  } catch (error) {
    runtimeErrorReporter.captureError(error, {
      eventType: 'app.bootstrap_failed',
      feature: 'runtime',
    });
    uiController.showError(`應用程式初始化失敗：${error.message ?? error}`);
  }
}

function exposeRuntimeMetadata(metadata) {
  window.__AR_NECKLACE_RELEASE__ = metadata;
  window.__AR_NECKLACE_ERROR_REPORTING__ = runtimeErrorReporter.getPublicStatus();
  console.info('[release]', metadata);
}
