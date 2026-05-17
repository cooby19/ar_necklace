import { GlbAssetLoader } from './GlbAssetLoader.js';
import { MaterialCustomizationEngine } from './MaterialCustomizationEngine.js';
import { ModelResourceDisposer } from './ModelResourceDisposer.js';
import { NecklacePlacementAdapter } from './NecklacePlacementAdapter.js';
import { OccluderProcessor } from './OccluderProcessor.js';
import { ShowcasePresenter } from './ShowcasePresenter.js';
import { ThreeRendererHost } from './ThreeRendererHost.js';

export class NecklaceScene {
  constructor({ canvas, stageElement, onError }) {
    this.canvas = canvas;
    this.stageElement = stageElement;
    this.onError = onError;
    this.rendererHost = new ThreeRendererHost({
      canvas,
      stageElement,
    });
    this.placement = new NecklacePlacementAdapter({
      scene: this.rendererHost.scene,
      getStageSize: () => this.rendererHost.getStageSize(),
    });
    this.modelConfig = null;
    this.assetLoader = new GlbAssetLoader();
    this.resourceDisposer = new ModelResourceDisposer({
      getEnvironmentMap: () => this.rendererHost.environmentMap,
    });
    this.occluderProcessor = new OccluderProcessor();
    this.materialCustomization = new MaterialCustomizationEngine();
    this.showcasePresenter = new ShowcasePresenter({
      placement: this.placement,
      setOpacity: (opacity) => this.setOpacity(opacity),
    });
    this.activeModelLoad = null;
    this.modelLoadSequence = 0;
  }

  async loadNecklace(config) {
    const loadId = this.beginModelLoad(config);
    let nextModel = null;

    try {
      this.modelConfig = config;
      this.disposeCurrentModel();
      this.placement.clearModel();
      this.materialCustomization.reset();
      this.showcasePresenter.resetTiming();

      const { gltf, timings } = await this.assetLoader.loadGlb(config.url, this.activeModelLoad.signal, {
        onFetchComplete: () => this.assertModelLoadCurrent(loadId),
      });
      nextModel = gltf.scene;
      this.assertModelLoadCurrent(loadId);
      const prepareStartedAt = performance.now();
      const model = nextModel;
      this.occluderProcessor.process(model, config.occluderParts);
      this.placement.prepareModel(model, config);
      this.materialCustomization.prepareGemMaterials(model);
      this.materialCustomization.collectOpacityMaterials(model);
      this.materialCustomization.collectColorableMaterials(model, config.colorCustomization?.targets ?? []);
      const prepareCompletedAt = performance.now();
      this.placement.setModel(model);
      this.placement.applyAssetTransform(config);
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
        this.placement.removeModel(nextModel);
        this.resourceDisposer.disposeObject3DResources(nextModel);
      }
      this.finishModelLoad(loadId);
      throw error;
    }
  }

  disposeCurrentModel() {
    const currentModel = this.placement.getModel();
    if (!currentModel) return;
    this.resourceDisposer.disposeObject3DResources(currentModel);
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

  setVisible(isVisible) {
    this.placement.setVisible(isVisible);
  }

  setShowcaseMode(isEnabled) {
    this.showcasePresenter.setShowcaseMode(isEnabled);
  }

  beginShowcaseDrag(clientX) {
    this.showcasePresenter.beginShowcaseDrag(clientX);
  }

  dragShowcase(clientX) {
    this.showcasePresenter.dragShowcase(clientX);
  }

  endShowcaseDrag() {
    this.showcasePresenter.endShowcaseDrag();
  }

  updateShowcase(time = 0) {
    this.showcasePresenter.updateShowcase(time);
  }

  setOpacity(opacity) {
    const nextOpacity = this.materialCustomization.setOpacity(opacity);
    this.placement.setVisible(nextOpacity > 0.015);
  }

  updateTransform({ position, scale, rotationY, rotationZ }) {
    this.placement.updateTransform({ position, scale, rotationY, rotationZ });
  }

  screenToWorld(normalizedPoint) {
    return this.placement.screenToWorld(normalizedPoint);
  }

  normalizedLengthToWorldX(length) {
    return this.placement.normalizedLengthToWorldX(length);
  }

  normalizedSegmentToWorldLength(start, end) {
    return this.placement.normalizedSegmentToWorldLength(start, end);
  }

  render() {
    this.rendererHost.render();
  }

  renderForCapture() {
    this.render();
  }

  resize() {
    this.rendererHost.resize();
  }

  dispose() {
    this.abortActiveModelLoad();
    this.activeModelLoad = null;
    this.disposeCurrentModel();
    this.placement.clearModel();
    this.materialCustomization.reset();
    this.assetLoader.clearCache();
    this.rendererHost.dispose();
  }
}
