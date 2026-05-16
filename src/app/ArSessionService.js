// @ts-check

import {
  CAMERA_FACING_MODES,
  isSelfieCamera,
  normalizeFacingMode,
} from './AppState.js';
import { CameraStream } from '../core/CameraStream.js';
import { FaceTracker } from '../core/FaceTracker.js';

/** @typedef {import('../types/domain').CameraFacingMode} CameraFacingMode */
/** @typedef {import('../types/domain').TrackerStats} TrackerStats */

/**
 * @typedef {{
 *   cameraFacingMode: CameraFacingMode,
 *   videoSize: { width: number, height: number },
 * }} ArSessionStartResult
 */

/**
 * @typedef {{
 *   error: unknown,
 *   previousFacingMode: CameraFacingMode,
 *   requestedFacingMode: CameraFacingMode,
 * }} CameraRestoreEvent
 */

/**
 * @typedef {(event: CameraRestoreEvent) => void} CameraRestoreHandler
 */

/**
 * @typedef {{
 *   status: 'switched' | 'restored',
 *   previousFacingMode: CameraFacingMode,
 *   requestedFacingMode: CameraFacingMode,
 *   cameraFacingMode: CameraFacingMode,
 *   videoSize: { width: number, height: number },
 *   error?: unknown,
 * }} CameraSwitchResult
 */

export class ArSessionService {
  /**
   * @param {{
   *   videoElement: HTMLVideoElement,
   *   onResults?: (results: unknown) => void,
   *   onError?: (error: unknown) => void,
   *   onStatsUpdate?: (stats: TrackerStats) => void,
   * }} options
   */
  constructor({ videoElement, onResults, onError, onStatsUpdate }) {
    this.camera = new CameraStream(videoElement);
    this.faceTracker = new FaceTracker({
      video: videoElement,
      onResults,
      onError,
      onStatsUpdate,
    });
  }

  /**
   * @param {CameraFacingMode} facingMode
   * @param {{ strictFacingMode?: boolean }} [options]
   * @returns {Promise<ArSessionStartResult>}
   */
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

  /**
   * @param {CameraFacingMode} previousFacingMode
   * @param {{ onRestoreStart?: CameraRestoreHandler }} [options]
   * @returns {Promise<CameraSwitchResult>}
   */
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
        const error = /** @type {Error & {
          switchError?: unknown,
          restoreError?: unknown,
          previousFacingMode?: CameraFacingMode,
          requestedFacingMode?: CameraFacingMode,
        }} */ (new Error('鏡頭切換失敗，且無法恢復原鏡頭'));
        error.switchError = switchError;
        error.restoreError = restoreError;
        error.previousFacingMode = previousFacingMode;
        error.requestedFacingMode = nextFacingMode;
        throw error;
      }
    }
  }

  /**
   * @returns {void}
   */
  resetTracking() {
    this.faceTracker.stop();
  }

  /**
   * @returns {void}
   */
  stop() {
    this.camera.stop();
    this.faceTracker.stop();
  }

  /**
   * @returns {TrackerStats}
   */
  getStats() {
    return /** @type {TrackerStats} */ (this.faceTracker.getStats());
  }
}

/**
 * @param {CameraFacingMode} facingMode
 * @returns {CameraFacingMode}
 */
export function getNextFacingMode(facingMode) {
  return facingMode === CAMERA_FACING_MODES.USER
    ? CAMERA_FACING_MODES.ENVIRONMENT
    : CAMERA_FACING_MODES.USER;
}
