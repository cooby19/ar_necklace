import { FaceMesh } from '@mediapipe/face_mesh';

export class FaceTracker {
  constructor({ video, onResults, onError }) {
    this.video = video;
    this.onResults = onResults;
    this.onError = onError;
    this.faceMesh = null;
    this.isRunning = false;
    this.frameHandle = null;
    this.isSendingFrame = false;
  }

  async init() {
    this.faceMesh = new FaceMesh({
      // Assets are copied from node_modules into public/vendor so the MVP does
      // not need a CDN at runtime.
      locateFile: (file) => `${import.meta.env.BASE_URL}vendor/mediapipe/face_mesh/${file}`,
    });

    this.faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.58,
      minTrackingConfidence: 0.58,
      // Internally flips the camera input. This matches the CSS-mirrored video.
      selfieMode: true,
    });

    this.faceMesh.onResults((results) => {
      this.onResults?.(results);
    });

    await this.faceMesh.initialize();
  }

  async start() {
    if (!this.faceMesh) {
      await this.init();
    }

    this.isRunning = true;
    this.tick();
  }

  stop() {
    this.isRunning = false;
    if (this.frameHandle) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = null;
    }
  }

  tick = async () => {
    if (!this.isRunning) return;

    if (!this.isSendingFrame && this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      this.isSendingFrame = true;
      try {
        await this.faceMesh.send({ image: this.video });
      } catch (error) {
        this.onError?.(error);
      } finally {
        this.isSendingFrame = false;
      }
    }

    this.frameHandle = requestAnimationFrame(this.tick);
  };
}
