// @ts-check

import { Box3, Group, Vector3 } from 'three';

/** @typedef {import('three').Material} Material */
/** @typedef {import('three').Mesh} Mesh */
/** @typedef {import('three').Object3D} Object3D */
/** @typedef {import('three').Scene} Scene */
/** @typedef {import('../types/domain').LandmarkPoint} LandmarkPoint */
/** @typedef {import('../types/domain').NecklaceConfig} NecklaceConfig */
/** @typedef {import('../types/domain').NecklaceTransform} NecklaceTransform */
/** @typedef {import('../types/scene-ports').NecklaceSceneTransform} NecklaceSceneTransform */
/** @typedef {import('../types/scene-ports').StageSize} StageSize */
/** @typedef {import('../types/scene-ports').WorldPoint} WorldPoint */

export class NecklacePlacementAdapter {
  /**
   * @param {{ scene: Scene, getStageSize: () => StageSize }} options
   */
  constructor({ scene, getStageSize }) {
    this.scene = scene;
    this.getStageSize = getStageSize;
    /** @type {Group} */
    this.necklaceRoot = new Group();
    /** @type {Object3D | null} */
    this.currentModel = null;

    this.scene.add(this.necklaceRoot);
  }

  /**
   * @param {Object3D} model
   * @param {Pick<NecklaceConfig, 'preserveAuthorOrigin'>} config
   * @returns {void}
   */
  prepareModel(model, config) {
    const box = new Box3().setFromObject(model);
    const size = box.getSize(new Vector3());

    if (!config?.preserveAuthorOrigin) {
      const center = box.getCenter(new Vector3());
      // Legacy assets may be authored away from origin, so center them unless the GLB origin is the anchor.
      model.position.sub(center);
    }

    const maxDimension = Math.max(size.x, size.y, size.z);
    if (maxDimension > 0) {
      model.scale.setScalar(1 / maxDimension);
    }

    model.traverse((child) => {
      const mesh = asMaybeMesh(child);
      if (!mesh || !mesh.material) return;
      mesh.castShadow = false;
      mesh.frustumCulled = false;

      if (mesh.userData.isDepthOccluder) return;

      mesh.renderOrder = 1;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => {
        material.transparent = true;
        material.depthTest = true;
        material.depthWrite = true;
        material.needsUpdate = true;
      });
    });
  }

  /**
   * @param {Object3D} model
   * @returns {void}
   */
  setModel(model) {
    this.currentModel = model;
    this.necklaceRoot.add(model);
  }

  /**
   * @returns {Object3D | null}
   */
  getModel() {
    return this.currentModel;
  }

  /**
   * @returns {boolean}
   */
  hasModel() {
    return Boolean(this.currentModel);
  }

  /**
   * @param {Object3D} model
   * @returns {void}
   */
  removeModel(model) {
    this.necklaceRoot.remove(model);
    if (this.currentModel === model) {
      this.currentModel = null;
    }
  }

  /**
   * @returns {void}
   */
  clearModel() {
    this.necklaceRoot.clear();
    this.currentModel = null;
  }

  /**
   * @param {{ transform: NecklaceTransform } | null | undefined} config
   * @returns {void}
   */
  applyAssetTransform(config) {
    if (!this.currentModel || !config) return;

    const { transform } = config;
    this.currentModel.position.set(transform.offsetX, transform.offsetY, transform.offsetZ);
    this.currentModel.rotation.set(transform.rotationX, transform.rotationY, transform.rotationZ);
    this.currentModel.scale.multiplyScalar(transform.baseScale);
  }

  /**
   * @param {boolean} isVisible
   * @returns {void}
   */
  setVisible(isVisible) {
    this.necklaceRoot.visible = isVisible;
  }

  /**
   * @param {NecklaceSceneTransform} transform
   * @returns {void}
   */
  updateTransform({ position, scale, rotationY, rotationZ }) {
    this.necklaceRoot.position.set(position.x, position.y, position.z);
    this.necklaceRoot.scale.setScalar(scale);
    this.necklaceRoot.rotation.set(0, rotationY, rotationZ);
  }

  /**
   * @param {number} rotationY
   * @returns {void}
   */
  applyShowcaseTransform(rotationY) {
    if (!this.currentModel) return;

    const aspect = this.getStageAspect();
    const displayScale = aspect >= 1 ? 1.08 : 0.88;

    this.necklaceRoot.visible = true;
    this.necklaceRoot.position.set(0, -0.04, 0);
    this.necklaceRoot.scale.setScalar(displayScale);
    this.necklaceRoot.rotation.set(-0.1, rotationY, 0);
  }

  /**
   * @param {LandmarkPoint} normalizedPoint
   * @returns {WorldPoint}
   */
  screenToWorld(normalizedPoint) {
    const aspect = this.getStageAspect();
    const worldX = (normalizedPoint.x - 0.5) * aspect * 2;
    const worldY = (0.5 - normalizedPoint.y) * 2;
    return { x: worldX, y: worldY, z: 0 };
  }

  /**
   * @param {number} length
   * @returns {number}
   */
  normalizedLengthToWorldX(length) {
    return length * this.getStageAspect() * 2;
  }

  /**
   * @param {LandmarkPoint} start
   * @param {LandmarkPoint} end
   * @returns {number}
   */
  normalizedSegmentToWorldLength(start, end) {
    const aspect = this.getStageAspect();
    const dx = (end.x - start.x) * aspect * 2;
    const dy = (end.y - start.y) * 2;
    return Math.hypot(dx, dy);
  }

  /**
   * @returns {number}
   */
  getStageAspect() {
    const { width, height } = this.getStageSize();
    return width / height;
  }
}

/**
 * @param {Object3D} object
 * @returns {Mesh | null}
 */
function asMaybeMesh(object) {
  const maybeMesh = /** @type {Mesh & { isMesh?: boolean }} */ (object);
  return maybeMesh.isMesh ? maybeMesh : null;
}
