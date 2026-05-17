import {
  ACESFilmicToneMapping,
  Box3,
  DirectionalLight,
  Group,
  HemisphereLight,
  OrthographicCamera,
  PMREMGenerator,
  PointLight,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GlbAssetLoader } from './GlbAssetLoader.js';
import { MaterialCustomizationEngine } from './MaterialCustomizationEngine.js';
import { ModelResourceDisposer } from './ModelResourceDisposer.js';
import { OccluderProcessor } from './OccluderProcessor.js';
import { observeStageSize } from '../utils/stageResize.js';

export class NecklaceScene {
  constructor({ canvas, stageElement, onError }) {
    this.canvas = canvas;
    this.stageElement = stageElement;
    this.onError = onError;
    this.scene = new Scene();
    this.camera = new OrthographicCamera(-1, 1, 1, -1, -10, 10);
    this.renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    this.necklaceRoot = new Group();
    this.pmremGenerator = new PMREMGenerator(this.renderer);
    this.environmentMap = null;
    this.currentModel = null;
    this.modelConfig = null;
    this.assetLoader = new GlbAssetLoader();
    this.resourceDisposer = new ModelResourceDisposer({
      getEnvironmentMap: () => this.environmentMap,
    });
    this.occluderProcessor = new OccluderProcessor();
    this.materialCustomization = new MaterialCustomizationEngine();
    this.activeModelLoad = null;
    this.modelLoadSequence = 0;
    this.showcase = {
      enabled: false,
      isDragging: false,
      rotationY: 0,
      lastClientX: 0,
      lastTime: 0,
      autoRotateSpeed: 0.00018,
    };

    this.scene.add(this.necklaceRoot);
    this.setupRenderer();
    this.setupEnvironment();
    this.setupLights();
    this.stopObservingStageSize = observeStageSize(this.stageElement, this.resize);
  }

  setupRenderer() {
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setClearColor(0x000000, 0);
  }

  setupEnvironment() {
    const roomEnvironment = new RoomEnvironment(this.renderer);
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

  async loadNecklace(config) {
    const loadId = this.beginModelLoad(config);
    let nextModel = null;

    try {
      this.modelConfig = config;
      this.disposeCurrentModel();
      this.necklaceRoot.clear();
      this.currentModel = null;
      this.materialCustomization.reset();
      this.showcase.lastTime = 0;

      const { gltf, timings } = await this.assetLoader.loadGlb(config.url, this.activeModelLoad.signal, {
        onFetchComplete: () => this.assertModelLoadCurrent(loadId),
      });
      nextModel = gltf.scene;
      this.assertModelLoadCurrent(loadId);
      const prepareStartedAt = performance.now();
      const model = nextModel;
      this.occluderProcessor.process(model, config.occluderParts);
      this.prepareModel(model);
      this.materialCustomization.prepareGemMaterials(model);
      this.materialCustomization.collectOpacityMaterials(model);
      this.materialCustomization.collectColorableMaterials(model, config.colorCustomization?.targets ?? []);
      const prepareCompletedAt = performance.now();
      this.currentModel = model;
      this.necklaceRoot.add(model);
      this.applyAssetTransform();
      this.setVisible(false);
      this.finishModelLoad(loadId);
      nextModel = null;
      this.assetLoader.logLoadTimings(config, {
        fetchMs: timings.fetchMs,
        parseMs: timings.parseMs,
        prepareMs: prepareCompletedAt - prepareStartedAt,
        totalMs: timings.totalAssetMs + (prepareCompletedAt - prepareStartedAt),
      });
      return model;
    } catch (error) {
      if (nextModel) {
        this.necklaceRoot.remove(nextModel);
        if (this.currentModel === nextModel) {
          this.currentModel = null;
        }
        this.resourceDisposer.disposeObject3DResources(nextModel);
      }
      this.finishModelLoad(loadId);
      throw error;
    }
  }

  disposeCurrentModel() {
    if (!this.currentModel) return;
    this.resourceDisposer.disposeObject3DResources(this.currentModel);
  }

  beginModelLoad(config) {
    this.abortActiveModelLoad();

    const id = ++this.modelLoadSequence;
    const abortController = new AbortController();
    this.activeModelLoad = {
      id,
      url: config.url,
      controller: abortController,
      signal: abortController.signal,
    };

    return id;
  }

  abortActiveModelLoad() {
    if (!this.activeModelLoad || this.activeModelLoad.signal.aborted) return;
    this.activeModelLoad.controller.abort();
  }

  assertModelLoadCurrent(loadId) {
    if (this.activeModelLoad?.id === loadId && !this.activeModelLoad.signal.aborted) return;

    const error = new Error('模型載入已被新的款式選擇取代');
    error.name = 'AbortError';
    throw error;
  }

  finishModelLoad(loadId) {
    if (this.activeModelLoad?.id === loadId) {
      this.activeModelLoad = null;
    }
  }

  prepareModel(model) {
    const box = new Box3().setFromObject(model);
    const size = box.getSize(new Vector3());

    if (!this.modelConfig?.preserveAuthorOrigin) {
      const center = box.getCenter(new Vector3());
      // Legacy assets may be authored away from origin, so center them unless the GLB origin is the anchor.
      model.position.sub(center);
    }

    const maxDimension = Math.max(size.x, size.y, size.z);
    if (maxDimension > 0) {
      model.scale.setScalar(1 / maxDimension);
    }

    model.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      child.castShadow = false;
      child.frustumCulled = false;

      if (child.userData.isDepthOccluder) {
        return;
      }

      child.renderOrder = 1;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        material.transparent = true;
        material.depthTest = true;
        material.depthWrite = true;
        material.needsUpdate = true;
      });
    });
  }

  getColorableTargets() {
    return this.materialCustomization.getColorableTargets();
  }

  hasColorableMaterials() {
    return this.materialCustomization.hasColorableMaterials();
  }

  getColorableMaterialCount() {
    return this.materialCustomization.getColorableMaterialCount();
  }

  applyColor(target, color) {
    return this.materialCustomization.applyColor(target, color);
  }

  applyAssetTransform() {
    if (!this.currentModel || !this.modelConfig) return;

    const { transform } = this.modelConfig;
    this.currentModel.position.set(transform.offsetX, transform.offsetY, transform.offsetZ);
    this.currentModel.rotation.set(transform.rotationX, transform.rotationY, transform.rotationZ);
    this.currentModel.scale.multiplyScalar(transform.baseScale);
  }

  setVisible(isVisible) {
    this.necklaceRoot.visible = isVisible;
  }

  setShowcaseMode(isEnabled) {
    this.showcase.enabled = isEnabled;
    this.showcase.isDragging = false;
    this.showcase.lastTime = 0;

    if (!isEnabled) return;

    this.setOpacity(1);
    this.updateShowcaseTransform();
  }

  beginShowcaseDrag(clientX) {
    if (!this.showcase.enabled) return;

    this.showcase.isDragging = true;
    this.showcase.lastClientX = clientX;
  }

  dragShowcase(clientX) {
    if (!this.showcase.enabled || !this.showcase.isDragging) return;

    const deltaX = clientX - this.showcase.lastClientX;
    this.showcase.lastClientX = clientX;
    this.showcase.rotationY += deltaX * 0.012;
    this.updateShowcaseTransform();
  }

  endShowcaseDrag() {
    this.showcase.isDragging = false;
  }

  updateShowcase(time = 0) {
    if (!this.showcase.enabled || !this.currentModel) return;

    if (!this.showcase.isDragging) {
      const previousTime = this.showcase.lastTime || time;
      const delta = Math.min(48, Math.max(0, time - previousTime));
      this.showcase.rotationY += delta * this.showcase.autoRotateSpeed;
    }

    this.showcase.lastTime = time;
    this.updateShowcaseTransform();
  }

  updateShowcaseTransform() {
    if (!this.currentModel) return;

    const { width, height } = this.getStageSize();
    const aspect = width / height;
    const displayScale = aspect >= 1 ? 1.08 : 0.88;

    this.necklaceRoot.visible = true;
    this.necklaceRoot.position.set(0, -0.04, 0);
    this.necklaceRoot.scale.setScalar(displayScale);
    this.necklaceRoot.rotation.set(-0.1, this.showcase.rotationY, 0);
  }

  setOpacity(opacity) {
    const nextOpacity = this.materialCustomization.setOpacity(opacity);
    this.necklaceRoot.visible = nextOpacity > 0.015;
  }

  updateTransform({ position, scale, rotationY, rotationZ }) {
    this.necklaceRoot.position.set(position.x, position.y, position.z);
    this.necklaceRoot.scale.setScalar(scale);
    this.necklaceRoot.rotation.set(0, rotationY, rotationZ);
  }

  screenToWorld(normalizedPoint) {
    const { width, height } = this.getStageSize();
    const aspect = width / height;
    const worldX = (normalizedPoint.x - 0.5) * aspect * 2;
    const worldY = (0.5 - normalizedPoint.y) * 2;
    return { x: worldX, y: worldY, z: 0 };
  }

  normalizedLengthToWorldX(length) {
    const { width, height } = this.getStageSize();
    return length * (width / height) * 2;
  }

  normalizedSegmentToWorldLength(start, end) {
    const { width, height } = this.getStageSize();
    const aspect = width / height;
    const dx = (end.x - start.x) * aspect * 2;
    const dy = (end.y - start.y) * 2;
    return Math.hypot(dx, dy);
  }

  getStageSize() {
    const rect = this.stageElement.getBoundingClientRect();
    return {
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height),
    };
  }

  resize = () => {
    const { width, height } = this.getStageSize();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
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
    this.renderer.render(this.scene, this.camera);
  }

  renderForCapture() {
    this.render();
  }

  dispose() {
    this.abortActiveModelLoad();
    this.activeModelLoad = null;
    this.stopObservingStageSize?.();
    this.stopObservingStageSize = null;
    this.disposeCurrentModel();
    this.necklaceRoot.clear();
    this.currentModel = null;
    this.materialCustomization.reset();
    this.assetLoader.clearCache();
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
