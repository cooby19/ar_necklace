import { afterEach, describe, expect, it, vi } from 'vitest';
import { CameraToolbarView } from './CameraToolbarView.js';
import { cleanupFakeDocument, installFakeDocument } from './test/fakeDom.js';

afterEach(() => {
  cleanupFakeDocument();
});

describe('CameraToolbarView', () => {
  it('syncs switch and stop disabled states for camera switching', () => {
    installFakeDocument();
    const appShell = { setSelfieCamera: vi.fn() };
    const view = new CameraToolbarView({ appShell });

    view.syncCameraControls({
      isSelfie: false,
      cameraStarted: true,
      isSwitchingCamera: true,
      isTrackingStarting: false,
    });

    expect(appShell.setSelfieCamera).toHaveBeenCalledWith(false);
    expect(view.elements.switchCameraButton.disabled).toBe(true);
    expect(view.elements.stopCameraButton.disabled).toBe(true);
    expect(view.elements.switchCameraButton.getAttribute('aria-label')).toBe('鏡頭切換中');
    expect(view.elements.switchCameraButton.title).toBe('鏡頭切換中');
  });

  it('keeps switching disabled while tracking starts but allows stopping', () => {
    installFakeDocument();
    const view = new CameraToolbarView({ appShell: { setSelfieCamera: vi.fn() } });

    view.syncCameraControls({
      isSelfie: true,
      cameraStarted: true,
      isSwitchingCamera: false,
      isTrackingStarting: true,
    });

    expect(view.elements.switchCameraButton.disabled).toBe(true);
    expect(view.elements.stopCameraButton.disabled).toBe(false);
    expect(view.elements.switchCameraButton.getAttribute('aria-label')).toBe('切換後鏡頭');
  });
});
