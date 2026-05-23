import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CAMERA_FACING_MODES } from './AppState.js';

const mocks = vi.hoisted(() => ({
  CameraStream: vi.fn(function CameraStream(videoElement) {
    this.videoElement = videoElement;
    this.start = vi.fn(() => Promise.resolve());
    this.stop = vi.fn();
    this.isActive = vi.fn(() => true);
    this.getFacingMode = vi.fn(() => 'user');
    this.getVideoSize = vi.fn(() => ({ width: 1280, height: 720 }));
  }),
  FaceTracker: vi.fn(function FaceTracker(options) {
    this.options = options;
    this.setSelfieMode = vi.fn();
    this.start = vi.fn(() => Promise.resolve());
    this.stop = vi.fn();
    this.pause = vi.fn();
    this.resume = vi.fn(() => Promise.resolve());
    this.getStats = vi.fn(() => ({ currentFps: 15 }));
  }),
}));

vi.mock('../core/CameraStream.js', () => ({ CameraStream: mocks.CameraStream }));
vi.mock('../core/FaceTracker.js', () => ({ FaceTracker: mocks.FaceTracker }));

const { ArSessionService } = await import('./ArSessionService.js');

beforeEach(() => {
  mocks.CameraStream.mockClear();
  mocks.FaceTracker.mockClear();
});

describe('ArSessionService lifecycle split', () => {
  it('starts the camera stream without initializing FaceMesh tracking', async () => {
    const service = new ArSessionService({ videoElement: {} });

    await service.startCamera(CAMERA_FACING_MODES.USER);

    const camera = mocks.CameraStream.mock.instances[0];
    const faceTracker = mocks.FaceTracker.mock.instances[0];
    expect(camera.start).toHaveBeenCalledWith({
      facingMode: CAMERA_FACING_MODES.USER,
      strictFacingMode: false,
    });
    expect(faceTracker.start).not.toHaveBeenCalled();
  });

  it('keeps the legacy start method as camera plus tracking startup', async () => {
    const service = new ArSessionService({ videoElement: {} });

    await service.start(CAMERA_FACING_MODES.USER);

    const camera = mocks.CameraStream.mock.instances[0];
    const faceTracker = mocks.FaceTracker.mock.instances[0];
    expect(camera.start).toHaveBeenCalledTimes(1);
    expect(faceTracker.start).toHaveBeenCalledTimes(1);
  });
});
