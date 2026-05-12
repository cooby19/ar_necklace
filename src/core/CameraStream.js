export class CameraStream {
  constructor(videoElement) {
    this.video = videoElement;
    this.stream = null;
    this.requestedFacingMode = 'user';
    this.resolvedFacingMode = 'user';
  }

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
    return this.getVideoSize();
  }

  waitForMetadata() {
    if (this.video.videoWidth && this.video.videoHeight) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.video.onloadedmetadata = () => resolve();
    });
  }

  getVideoSize() {
    return {
      width: this.video.videoWidth || 1280,
      height: this.video.videoHeight || 720,
    };
  }

  getFacingMode() {
    return this.getActiveTrackFacingMode() ?? this.resolvedFacingMode ?? this.requestedFacingMode;
  }

  getActiveTrackFacingMode() {
    return this.stream?.getVideoTracks()?.[0]?.getSettings?.().facingMode;
  }

  stop() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video.srcObject = null;
  }
}
