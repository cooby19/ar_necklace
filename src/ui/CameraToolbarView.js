import { queryRequired } from './domHelpers.js';

export class CameraToolbarView {
  constructor({ appShell }) {
    this.appShell = appShell;
    this.elements = {
      captureButton: queryRequired('#captureButton'),
      startButton: queryRequired('#startButton'),
      switchCameraButton: queryRequired('#switchCameraButton'),
      stopCameraButton: queryRequired('#stopCameraButton'),
      necklaceToggle: queryRequired('#necklaceToggle'),
      debugToggle: queryRequired('#debugToggle'),
    };
  }

  bind(handlers, listen) {
    listen(this.elements.startButton, 'click', () => handlers.onStartCamera?.());
    listen(this.elements.switchCameraButton, 'click', () => handlers.onSwitchCamera?.());
    listen(this.elements.stopCameraButton, 'click', () => handlers.onStopCamera?.());
    listen(this.elements.captureButton, 'click', () => handlers.onCapture?.());

    listen(this.elements.debugToggle, 'change', () => {
      handlers.onDebugToggle?.(this.elements.debugToggle.checked);
    });

    listen(this.elements.necklaceToggle, 'change', () => {
      handlers.onNecklaceToggle?.(this.elements.necklaceToggle.checked);
    });
  }

  syncCameraControls({ isSelfie, cameraStarted, isSwitchingCamera, isTrackingStarting }) {
    const nextLabel = isSelfie ? '切換後鏡頭' : '切換前鏡頭';
    const switchLabel = isSwitchingCamera ? '鏡頭切換中' : nextLabel;

    this.appShell.setSelfieCamera(isSelfie);
    this.elements.switchCameraButton.disabled = !cameraStarted || isSwitchingCamera || isTrackingStarting;
    this.elements.stopCameraButton.disabled = !cameraStarted || isSwitchingCamera;
    this.elements.switchCameraButton.setAttribute('aria-label', switchLabel);
    this.elements.switchCameraButton.title = switchLabel;
  }

  syncToggles({ necklaceVisible, debugEnabled }) {
    this.elements.necklaceToggle.checked = necklaceVisible;
    this.elements.debugToggle.checked = debugEnabled;
  }

  setStartButtonLabel(label) {
    this.elements.startButton.replaceChildren();

    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    this.elements.startButton.append(icon, document.createTextNode(label));
  }

  setCaptureVisible(isVisible) {
    this.elements.captureButton.hidden = !isVisible;
  }

  setCaptureDisabled(isDisabled) {
    this.elements.captureButton.disabled = isDisabled;
  }

  setCaptureBusy(isBusy) {
    this.elements.captureButton.classList.toggle('is-capturing', isBusy);
  }

  isDebugEnabled() {
    return this.elements.debugToggle.checked;
  }
}
