import {
  CAMERA_FACING_MODES,
  isSelfieCamera,
  normalizeFacingMode,
} from './AppState.js';
import { CameraStream } from '../core/CameraStream.js';
import { FaceTracker } from '../core/FaceTracker.js';

export class ArSessionService {
  constructor({ videoElement, onResults, onError, onStatsUpdate }) {
    this.camera = new CameraStream(videoElement);
    this.faceTracker = new FaceTracker({
      video: videoElement,
      onResults,
      onError,
      onStatsUpdate,
    });
  }

  async start(facingMode, { strictFacingMode = false } = {}) {
    this.resetTracking();
    this.faceTracker.setSelfieMode(isSelfieCamera(facingMode));

    await this.camera.start({ facingMode, strictFacingMode });

    const cameraFacingMode = normalizeFacingMode(this.camera.getFacingMode(), facingMode);
    this.faceTracker.setSelfieMode(isSelfieCamera(cameraFacingMode));
    await this.faceTracker.start();

    return {
      cameraFacingMode,
      videoSize: this.camera.getVideoSize(),
    };
  }

  async switchCamera(previousFacingMode, { onRestoreStart } = {}) {
    const nextFacingMode = getNextFacingMode(previousFacingMode);

    try {
      const session = await this.start(nextFacingMode, { strictFacingMode: true });
      return {
        status: 'switched',
        previousFacingMode,
        requestedFacingMode: nextFacingMode,
        ...session,
      };
    } catch (switchError) {
      onRestoreStart?.({
        error: switchError,
        previousFacingMode,
        requestedFacingMode: nextFacingMode,
      });

      try {
        const restoredSession = await this.start(previousFacingMode);
        return {
          status: 'restored',
          previousFacingMode,
          requestedFacingMode: nextFacingMode,
          error: switchError,
          ...restoredSession,
        };
      } catch (restoreError) {
        this.stop();
        const error = new Error('鏡頭切換失敗，且無法恢復原鏡頭');
        error.switchError = switchError;
        error.restoreError = restoreError;
        error.previousFacingMode = previousFacingMode;
        error.requestedFacingMode = nextFacingMode;
        throw error;
      }
    }
  }

  resetTracking() {
    this.faceTracker.stop();
  }

  stop() {
    this.camera.stop();
    this.faceTracker.stop();
  }

  getStats() {
    return this.faceTracker.getStats();
  }
}

export function getNextFacingMode(facingMode) {
  return facingMode === CAMERA_FACING_MODES.USER
    ? CAMERA_FACING_MODES.ENVIRONMENT
    : CAMERA_FACING_MODES.USER;
}
