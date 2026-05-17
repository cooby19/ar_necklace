import { Box3, Group, Vector3 } from 'three';

export class NecklacePlacementAdapter {
  constructor({ scene, getStageSize }) {
    this.scene = scene;
    this.getStageSize = getStageSize;
    this.necklaceRoot = new Group();
    this.currentModel = null;

    this.scene.add(this.necklaceRoot);
  }

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
      if (!child.isMesh || !child.material) return;
      child.castShadow = false;
      child.frustumCulled = false;

      if (child.userData.isDepthOccluder) return;

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

  setModel(model) {
    this.currentModel = model;
    this.necklaceRoot.add(model);
  }

  getModel() {
    return this.currentModel;
  }

  hasModel() {
    return Boolean(this.currentModel);
  }

  removeModel(model) {
    this.necklaceRoot.remove(model);
    if (this.currentModel === model) {
      this.currentModel = null;
    }
  }

  clearModel() {
    this.necklaceRoot.clear();
    this.currentModel = null;
  }

  applyAssetTransform(config) {
    if (!this.currentModel || !config) return;

    const { transform } = config;
    this.currentModel.position.set(transform.offsetX, transform.offsetY, transform.offsetZ);
    this.currentModel.rotation.set(transform.rotationX, transform.rotationY, transform.rotationZ);
    this.currentModel.scale.multiplyScalar(transform.baseScale);
  }

  setVisible(isVisible) {
    this.necklaceRoot.visible = isVisible;
  }

  updateTransform({ position, scale, rotationY, rotationZ }) {
    this.necklaceRoot.position.set(position.x, position.y, position.z);
    this.necklaceRoot.scale.setScalar(scale);
    this.necklaceRoot.rotation.set(0, rotationY, rotationZ);
  }

  applyShowcaseTransform(rotationY) {
    if (!this.currentModel) return;

    const aspect = this.getStageAspect();
    const displayScale = aspect >= 1 ? 1.08 : 0.88;

    this.necklaceRoot.visible = true;
    this.necklaceRoot.position.set(0, -0.04, 0);
    this.necklaceRoot.scale.setScalar(displayScale);
    this.necklaceRoot.rotation.set(-0.1, rotationY, 0);
  }

  screenToWorld(normalizedPoint) {
    const aspect = this.getStageAspect();
    const worldX = (normalizedPoint.x - 0.5) * aspect * 2;
    const worldY = (0.5 - normalizedPoint.y) * 2;
    return { x: worldX, y: worldY, z: 0 };
  }

  normalizedLengthToWorldX(length) {
    return length * this.getStageAspect() * 2;
  }

  normalizedSegmentToWorldLength(start, end) {
    const aspect = this.getStageAspect();
    const dx = (end.x - start.x) * aspect * 2;
    const dy = (end.y - start.y) * 2;
    return Math.hypot(dx, dy);
  }

  getStageAspect() {
    const { width, height } = this.getStageSize();
    return width / height;
  }
}
