// @ts-check

import { GlbAssetLoader } from './GlbAssetLoader';
import { MaterialCustomizationEngine } from './MaterialCustomizationEngine.js';
import { ModelResourceDisposer } from './ModelResourceDisposer.js';
import { NecklacePlacementAdapter } from './NecklacePlacementAdapter.js';
import { OccluderProcessor } from './OccluderProcessor.js';
import { ShowcasePresenter } from './ShowcasePresenter';
import { ThreeRendererHost } from './ThreeRendererHost.js';

/** @typedef {import('three').Object3D} Object3D */
/** @typedef {import('../types/domain').LandmarkPoint} LandmarkPoint */
/** @typedef {import('../types/domain').NecklaceConfig} NecklaceConfig */
/** @typedef {import('../types/scene-ports').GlbAssetLoaderPort} GlbAssetLoaderPort */
/** @typedef {import('../types/scene-ports').MaterialCustomizationPort} MaterialCustomizationPort */
/** @typedef {import('../types/scene-ports').ModelResourceDisposerPort} ModelResourceDisposerPort */
/** @typedef {import('../types/scene-ports').NecklaceSceneTransform} NecklaceSceneTransform */
/** @typedef {import('../types/scene-ports').OccluderProcessorPort} OccluderProcessorPort */
/** @typedef {import('../types/scene-ports').PlacementAdapterPort} PlacementAdapterPort */
/** @typedef {import('../types/scene-ports').RendererHostPort} RendererHostPort */
/** @typedef {import('../types/scene-ports').ShowcasePresenterPort} ShowcasePresenterPort */
/** @typedef {import('../types/scene-ports').WorldPoint} WorldPoint */

/**
 * @typedef {{
 *   canvas: HTMLCanvasElement,
 *   stageElement: HTMLElement,
 *   onError?: (message: string) => void,
 * }} NecklaceSceneOptions
 */

/**
 * @typedef {{
 *   id: number,
 *   url: string,
 *   controller: AbortController,
 *   signal: AbortSignal,
 * }} ActiveModelLoad
 */

export class NecklaceScene {
  /**
   * @param {NecklaceSceneOptions} options
   */
  constructor({ canvas, stageElement, onError }) {
    this.canvas = canvas;
    this.stageElement = stageElement;
    this.onError = onError;
    /** @type {RendererHostPort} */
    this.rendererHost = new ThreeRendererHost({
      canvas,
      stageElement,
    });
    /** @type {PlacementAdapterPort} */
    this.placement = new NecklacePlacementAdapter({
      scene: this.rendererHost.scene,
      getStageSize: () => this.rendererHost.getStageSize(),
    });
    /** @type {NecklaceConfig | null} */
    this.modelConfig = null;
    /** @type {GlbAssetLoaderPort} */
    this.assetLoader = new GlbAssetLoader();
    /** @type {ModelResourceDisposerPort} */
    this.resourceDisposer = new ModelResourceDisposer({
      getEnvironmentMap: () => this.rendererHost.environmentMap,
    });
    /** @type {OccluderProcessorPort} */
    this.occluderProcessor = new OccluderProcessor();
    /** @type {MaterialCustomizationPort} */
    this.materialCustomization = new MaterialCustomizationEngine();
    /** @type {ShowcasePresenterPort} */
    this.showcasePresenter = new ShowcasePresenter({
      placement: this.placement,
      setOpacity: (opacity) => this.setOpacity(opacity),
    });
    /** @type {ActiveModelLoad | null} */
    this.activeModelLoad = null;
    this.modelLoadSequence = 0;
  }

  /**
   * @param {NecklaceConfig} config
   * @returns {Promise<Object3D>}
   */
  async loadNecklace(config) {
    const loadId = this.beginModelLoad(config);
    const activeLoad = this.activeModelLoad;
    if (!activeLoad) {
      throw new Error('模型載入流程尚未初始化');
    }
    /** @type {Object3D | null} */
    let nextModel = null;

    try {
      this.modelConfig = config;
      this.disposeCurrentModel();
      this.placement.clearModel();
      this.materialCustomization.reset();
      this.showcasePresenter.resetTiming();

      const { gltf, timings } = await this.assetLoader.loadGlb(config.url, activeLoad.signal, {
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

  /**
   * @returns {void}
   */
  disposeCurrentModel() {
    const currentModel = this.placement.getModel();
    if (!currentModel) return;
    this.resourceDisposer.disposeObject3DResources(currentModel);
  }

  /**
   * @param {NecklaceConfig} config
   * @returns {number}
   */
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

  /**
   * @returns {void}
   */
  abortActiveModelLoad() {
    if (!this.activeModelLoad || this.activeModelLoad.signal.aborted) return;
    this.activeModelLoad.controller.abort();
  }

  /**
   * @param {number} loadId
   * @returns {void}
   */
  assertModelLoadCurrent(loadId) {
    if (this.activeModelLoad?.id === loadId && !this.activeModelLoad.signal.aborted) return;

    const error = new Error('模型載入已被新的款式選擇取代');
    error.name = 'AbortError';
    throw error;
  }

  /**
   * @param {number} loadId
   * @returns {void}
   */
  finishModelLoad(loadId) {
    if (this.activeModelLoad?.id === loadId) {
      this.activeModelLoad = null;
    }
  }

  /**
   * @returns {string[]}
   */
  getColorableTargets() {
    return this.materialCustomization.getColorableTargets();
  }

  /**
   * @returns {boolean}
   */
  hasColorableMaterials() {
    return this.materialCustomization.hasColorableMaterials();
  }

  /**
   * @returns {number}
   */
  getColorableMaterialCount() {
    return this.materialCustomization.getColorableMaterialCount();
  }

  /**
   * @param {string} target
   * @param {string} color
   * @returns {boolean}
   */
  applyColor(target, color) {
    return this.materialCustomization.applyColor(target, color);
  }

  /**
   * @param {boolean} isVisible
   * @returns {void}
   */
  setVisible(isVisible) {
    this.placement.setVisible(isVisible);
  }

  /**
   * @param {boolean} isEnabled
   * @returns {void}
   */
  setShowcaseMode(isEnabled) {
    this.showcasePresenter.setShowcaseMode(isEnabled);
  }

  /**
   * @param {number} clientX
   * @returns {void}
   */
  beginShowcaseDrag(clientX) {
    this.showcasePresenter.beginShowcaseDrag(clientX);
  }

  /**
   * @param {number} clientX
   * @returns {void}
   */
  dragShowcase(clientX) {
    this.showcasePresenter.dragShowcase(clientX);
  }

  /**
   * @returns {void}
   */
  endShowcaseDrag() {
    this.showcasePresenter.endShowcaseDrag();
  }

  /**
   * @param {number} [time]
   * @returns {void}
   */
  updateShowcase(time = 0) {
    this.showcasePresenter.updateShowcase(time);
  }

  /**
   * @param {number} opacity
   * @returns {void}
   */
  setOpacity(opacity) {
    const nextOpacity = this.materialCustomization.setOpacity(opacity);
    this.placement.setVisible(nextOpacity > 0.015);
  }

  /**
   * @param {NecklaceSceneTransform} transform
   * @returns {void}
   */
  updateTransform({ position, scale, rotationY, rotationZ }) {
    this.placement.updateTransform({ position, scale, rotationY, rotationZ });
  }

  /**
   * @param {LandmarkPoint} normalizedPoint
   * @returns {WorldPoint}
   */
  screenToWorld(normalizedPoint) {
    return this.placement.screenToWorld(normalizedPoint);
  }

  /**
   * @param {number} length
   * @returns {number}
   */
  normalizedLengthToWorldX(length) {
    return this.placement.normalizedLengthToWorldX(length);
  }

  /**
   * @param {LandmarkPoint} start
   * @param {LandmarkPoint} end
   * @returns {number}
   */
  normalizedSegmentToWorldLength(start, end) {
    return this.placement.normalizedSegmentToWorldLength(start, end);
  }

  /**
   * @returns {void}
   */
  render() {
    this.rendererHost.render();
  }

  /**
   * @returns {void}
   */
  renderForCapture() {
    this.render();
  }

  /**
   * @returns {void}
   */
  resize() {
    this.rendererHost.resize();
  }

  /**
   * @returns {void}
   */
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
