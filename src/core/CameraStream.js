// @ts-check

/** @typedef {import('../types/domain').CameraFacingMode} CameraFacingMode */

/**
 * @typedef {{
 *   facingMode?: CameraFacingMode | string,
 *   strictFacingMode?: boolean,
 * }} CameraStreamStartOptions
 */

/** @typedef {{ width: number, height: number }} VideoSize */

export class CameraStream {
  /**
   * @param {HTMLVideoElement} videoElement
   */
  constructor(videoElement) {
    this.video = videoElement;
    /** @type {MediaStream | null} */
    this.stream = null;
    this.requestedFacingMode = 'user';
    this.resolvedFacingMode = 'user';
  }

  /**
   * @param {CameraStreamStartOptions} [options]
   * @returns {Promise<void>}
   */
  async start({ facingMode = 'user', strictFacingMode = false } = {}) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('此瀏覽器不支援 getUserMedia，請使用 Safari、Chrome 或 Edge 的新版瀏覽器。');
    }

    this.stop();
    this.requestedFacingMode = facingMode;

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: strictFacingMode ? { exact: facingMode } : { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });

    this.resolvedFacingMode = this.getActiveTrackFacingMode() ?? facingMode;
    this.video.srcObject = this.stream;
    await this.video.play();
    await this.waitForMetadata();
  }

  /**
   * @returns {Promise<void>}
   */
  waitForMetadata() {
    if (this.video.videoWidth && this.video.videoHeight) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.video.onloadedmetadata = () => resolve();
    });
  }

  /**
   * @returns {VideoSize}
   */
  getVideoSize() {
    return {
      width: this.video.videoWidth || 1280,
      height: this.video.videoHeight || 720,
    };
  }

  /**
   * @returns {string | null}
   */
  getFacingMode() {
    return this.getActiveTrackFacingMode() ?? this.resolvedFacingMode ?? this.requestedFacingMode;
  }

  /**
   * @returns {string | null}
   */
  getActiveTrackFacingMode() {
    return this.stream?.getVideoTracks()?.[0]?.getSettings?.().facingMode ?? null;
  }

  /**
   * @returns {void}
   */
  stop() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video.srcObject = null;
  }
}
