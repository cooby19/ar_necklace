import {
  ACESFilmicToneMapping,
  DirectionalLight,
  HemisphereLight,
  OrthographicCamera,
  PMREMGenerator,
  PointLight,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { observeStageSize } from '../utils/stageResize.js';
import { runtimeErrorReporter } from '../telemetry/RuntimeErrorReporter.js';

export class ThreeRendererHost {
  constructor({
    canvas,
    stageElement,
    scene = new Scene(),
    camera = new OrthographicCamera(-1, 1, 1, -1, -10, 10),
    rendererFactory = (rendererCanvas) =>
      new WebGLRenderer({
        canvas: rendererCanvas,
        alpha: true,
        antialias: true,
      }),
    pmremGeneratorFactory = (renderer) => new PMREMGenerator(renderer),
    roomEnvironmentFactory = (renderer) => new RoomEnvironment(renderer),
    observeStageSizeFn = observeStageSize,
  }) {
    this.canvas = canvas;
    this.stageElement = stageElement;
    this.scene = scene;
    this.camera = camera;
    this.roomEnvironmentFactory = roomEnvironmentFactory;
    this.renderer = null;
    this.pmremGenerator = null;
    this.environmentMap = null;
    this.stopObservingStageSize = null;

    try {
      this.renderer = rendererFactory(canvas);
      this.pmremGenerator = pmremGeneratorFactory(this.renderer);
      this.setupRenderer();
      this.setupEnvironment();
      this.setupLights();
      this.stopObservingStageSize = observeStageSizeFn(this.stageElement, this.resize);
    } catch (error) {
      runtimeErrorReporter.captureError(error, {
        eventType: 'webgl.init_failed',
        feature: 'webgl',
        extra: {
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
        },
      });
      this.dispose();
      throw error;
    }
  }

  setupRenderer() {
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setClearColor(0x000000, 0);
  }

  setupEnvironment() {
    const roomEnvironment = this.roomEnvironmentFactory(this.renderer);
    const environment = this.pmremGenerator.fromScene(roomEnvironment, 0.02);
    this.environmentMap = environment.texture;
    this.scene.environment = this.environmentMap;
    this.scene.environmentIntensity = 1.28;
    roomEnvironment.dispose();
  }

  setupLights() {
    const hemisphere = new HemisphereLight(0xffffff, 0x5d6680, 0.8);
    const key = new DirectionalLight(0xffffff, 2.25);
    key.position.set(0.25, 0.7, 1.8);
    const warmFill = new DirectionalLight(0xffd7a3, 0.62);
    warmFill.position.set(-1.2, -0.35, 0.85);
    const coolRim = new DirectionalLight(0xbfd5ff, 1.05);
    coolRim.position.set(1.45, 0.32, -1.15);
    const sparkle = new PointLight(0xffffff, 0.85, 3.2);
    sparkle.position.set(0.08, 0.26, 1.25);
    this.scene.add(hemisphere, key, warmFill, coolRim, sparkle);
  }

  getStageSize() {
    const rect = this.stageElement.getBoundingClientRect();
    return {
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height),
    };
  }

  resize = () => {
    if (!this.renderer || !this.camera) return;

    const { width, height } = this.getStageSize();
    const dpr = Math.min(globalThis.window?.devicePixelRatio || 1, 2);
    const aspect = width / height;

    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);

    this.camera.left = -aspect;
    this.camera.right = aspect;
    this.camera.top = 1;
    this.camera.bottom = -1;
    this.camera.updateProjectionMatrix();
  };

  render() {
    if (!this.renderer) return;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.stopObservingStageSize?.();
    this.stopObservingStageSize = null;

    if (this.scene) {
      this.scene.environment = null;
    }

    this.environmentMap?.dispose();
    this.environmentMap = null;
    this.pmremGenerator?.dispose();
    this.pmremGenerator = null;
    this.renderer?.dispose();
    this.renderer = null;
  }
}
