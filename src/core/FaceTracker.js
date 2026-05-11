const FACE_MESH_SCRIPT_URL = `${import.meta.env.BASE_URL}vendor/mediapipe/face_mesh/face_mesh.js`;

let faceMeshScriptPromise = null;

async function loadFaceMeshConstructor() {
  if (window.FaceMesh) {
    return window.FaceMesh;
  }

  if (!faceMeshScriptPromise) {
    faceMeshScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = FACE_MESH_SCRIPT_URL;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        if (window.FaceMesh) {
          resolve(window.FaceMesh);
          return;
        }

        faceMeshScriptPromise = null;
        reject(new Error('MediaPipe FaceMesh 載入後沒有提供 FaceMesh 建構子。'));
      };
      script.onerror = () => {
        faceMeshScriptPromise = null;
        reject(new Error(`無法載入 MediaPipe Face Mesh：${FACE_MESH_SCRIPT_URL}`));
      };
      document.head.appendChild(script);
    });
  }

  return faceMeshScriptPromise;
}

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
    const FaceMeshConstructor = await loadFaceMeshConstructor();

    this.faceMesh = new FaceMeshConstructor({
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
