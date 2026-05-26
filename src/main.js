import './styles/index.css';
import { NECKLACES } from './config/necklaces.js';
import { RELEASE_METADATA } from './config/release.js';
import { AppState } from './app/AppState.js';
import { CaptureService } from './app/CaptureService.js';
import { serializeUrlState } from './app/router.js';
import { runtimeErrorReporter } from './telemetry/RuntimeErrorReporter.js';
import { UiRoot } from './ui/UiRoot.js';

runtimeErrorReporter.installGlobalHandlers();
bootstrap();

async function bootstrap() {
  const appState = new AppState({ necklaces: NECKLACES });
  const uiRoot = new UiRoot({ necklaces: NECKLACES });
  uiRoot.setReleaseMetadata(RELEASE_METADATA);
  exposeRuntimeMetadata(RELEASE_METADATA);

  const captureService = new CaptureService({
    stageElement: uiRoot.elements.stage,
    videoElement: uiRoot.elements.video,
    threeCanvas: uiRoot.elements.threeCanvas,
  });

  try {
    const [{ createAppRuntime }, { AppRuntimeController }] = await Promise.all([
      import('./app/createAppRuntime.js'),
      import('./app/AppRuntimeController.js'),
    ]);
    const runtime = createAppRuntime({
      appState,
      uiRoot,
      captureService,
      necklaces: NECKLACES,
      showcaseAnimationEnabled: !isLighthouseAuditRequest(),
    });
    const appRuntimeController = new AppRuntimeController({
      appState,
      uiRoot,
      runtime,
    });

    appState.subscribe((snapshot, meta) => {
      uiRoot.syncFromState(snapshot, meta);
      if (appRuntimeController.isApplyingUrlState()) return;
      if (!shouldSyncUrlState(meta.changes)) return;

      const hash = serializeUrlState({
        necklaceId: snapshot.selectedNecklace.id,
        colorByTarget: snapshot.selectedColorIdsByTarget,
        colorFallback: null,
      });
      const nextUrl = window.location.pathname + window.location.search + (hash ? `#${hash}` : '');

      if (nextUrl !== window.location.pathname + window.location.search + window.location.hash) {
        history.replaceState(null, '', nextUrl);
      }
    });

    uiRoot.bind({
      onModeSelect: (mode) => appRuntimeController.selectMode(mode),
      onPanelSelect: (panelName) => appRuntimeController.selectControlPanel(panelName),
      onBottomSheetToggle: () => appRuntimeController.toggleBottomSheet(),
      onShowcasePointerDown: (event) => appRuntimeController.handleShowcasePointerDown(event),
      onShowcasePointerMove: (event) => appRuntimeController.handleShowcasePointerMove(event),
      onShowcasePointerUp: (event) => appRuntimeController.handleShowcasePointerUp(event),
      onStartCamera: () => appRuntimeController.startExperience(),
      onSwitchCamera: () => appRuntimeController.switchCamera(),
      onStopCamera: () => appRuntimeController.stopExperience(),
      onCapture: () => appRuntimeController.handleCapture(),
      onDebugToggle: (isEnabled) => appRuntimeController.handleDebugToggle(isEnabled),
      onNecklaceToggle: (isVisible) => appRuntimeController.handleNecklaceToggle(isVisible),
      onNecklaceSelect: (necklaceId) => appRuntimeController.selectNecklace(necklaceId),
      onColorSelect: (colorId, targetId) => appRuntimeController.selectColor(colorId, targetId),
      onTuningInput: () => appRuntimeController.updateTuningFromControls(),
      onSaveCalibration: () => appRuntimeController.saveCalibration(),
      onResetCalibration: () => appRuntimeController.resetCalibration(),
      onDownloadCapture: () => appRuntimeController.downloadCapture(),
      onShareCapture: () => appRuntimeController.shareCapture(),
      onCloseShareSheet: () => appRuntimeController.closeShareSheet(),
    });

    appRuntimeController.init();
  } catch (error) {
    runtimeErrorReporter.captureError(error, {
      eventType: 'app.bootstrap_failed',
      feature: 'runtime',
    });
    uiRoot.showError(`應用程式初始化失敗：${error.message ?? error}`);
  }
}

function exposeRuntimeMetadata(metadata) {
  window.__AR_NECKLACE_RELEASE__ = metadata;
  window.__AR_NECKLACE_ERROR_REPORTING__ = runtimeErrorReporter.getPublicStatus();
  console.info('[release]', metadata);
}

function isLighthouseAuditRequest() {
  return new URLSearchParams(window.location.search).has('lighthouse');
}

function shouldSyncUrlState(changes) {
  return changes.includes('selectedNecklace') || changes.includes('selectedColorIdsByTarget');
}
