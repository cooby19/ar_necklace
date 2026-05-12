import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class NecklaceScene {
  constructor({ canvas, stageElement, onError }) {
    this.canvas = canvas;
    this.stageElement = stageElement;
    this.onError = onError;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.loader = new GLTFLoader();
    this.necklaceRoot = new THREE.Group();
    this.currentModel = null;
    this.modelConfig = null;
    this.colorableMaterials = new Map();
    this.opacity = 0;

    this.scene.add(this.necklaceRoot);
    this.setupLights();
    this.resize();

    window.addEventListener('resize', this.resize);
  }

  setupLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 1.65);
    const key = new THREE.DirectionalLight(0xffffff, 1.7);
    key.position.set(0.2, 0.6, 1.6);
    const fill = new THREE.DirectionalLight(0xf3d18b, 0.85);
    fill.position.set(-1.2, -0.3, 0.8);
    this.scene.add(ambient, key, fill);
  }

  async loadNecklace(config) {
    this.modelConfig = config;
    this.necklaceRoot.clear();
    this.currentModel = null;
    this.colorableMaterials.clear();
    this.opacity = 0;

    const glbBuffer = await this.fetchGlbFile(config.url);
    const gltf = await this.parseGlbFile(glbBuffer, config.url);
    const model = gltf.scene;
    this.markOccluderParts(model);
    this.prepareModel(model);
    this.collectColorableMaterials(model);
    this.currentModel = model;
    this.necklaceRoot.add(model);
    this.applyAssetTransform();
    this.setVisible(false);
    return model;
  }

  async fetchGlbFile(url) {
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`模型檔無法讀取，HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    this.assertGlbFile(buffer, url, response.headers.get('content-type') ?? '');
    return buffer;
  }

  assertGlbFile(buffer, url, contentType) {
    if (buffer.byteLength < 20) {
      throw new Error(`模型檔太小，無法解析 GLB。請確認檔案位置是 ${url}`);
    }

    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer, 0, 4);
    const magic = String.fromCharCode(...bytes.slice(0, 4));

    if (magic !== 'glTF') {
      const looksLikeHtml = contentType.includes('text/html') || magic.startsWith('<');
      const reason = looksLikeHtml ? '目前路徑回傳 HTML，通常代表檔案不存在或 URL 錯誤' : '檔案標頭不是 GLB';
      throw new Error(`${reason}。請確認檔案位置是 ${url}`);
    }

    const version = view.getUint32(4, true);
    const declaredLength = view.getUint32(8, true);

    if (version !== 2) {
      throw new Error(`GLB 版本 ${version} 不支援，請使用 glTF 2.0 匯出的 .glb。`);
    }

    if (declaredLength !== buffer.byteLength) {
      throw new Error(
        `GLB 檔案長度不完整或已損毀，標頭宣告 ${declaredLength} bytes，實際讀到 ${buffer.byteLength} bytes。`,
      );
    }
  }

  parseGlbFile(buffer, url) {
    const assetBasePath = url.slice(0, url.lastIndexOf('/') + 1);
    return this.loader.parseAsync(buffer, assetBasePath);
  }

  prepareModel(model) {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());

    if (!this.modelConfig?.preserveAuthorOrigin) {
      const center = box.getCenter(new THREE.Vector3());
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
        this.prepareDepthOccluder(child);
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

  markOccluderParts(model) {
    const occluderParts = this.modelConfig?.occluderParts;
    if (!occluderParts?.nameIncludes?.length) return;

    model.traverse((child) => {
      if (child === model) return;
      if (this.shouldMatchPart(child, occluderParts)) {
        child.userData.isDepthOccluder = true;
      }
    });
  }

  shouldMatchPart(object, partConfig) {
    const names = [
      object.name,
      object.isMesh ? object.geometry?.name : '',
      object.isMesh && object.material
        ? (Array.isArray(object.material) ? object.material : [object.material])
            .map((material) => material.name)
            .join(' ')
        : '',
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return partConfig.nameIncludes.some((keyword) => names.includes(keyword.toLowerCase()));
  }

  prepareDepthOccluder(mesh) {
    mesh.renderOrder = 0;
    mesh.material = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: true,
      depthTest: true,
      transparent: false,
    });
    mesh.material.needsUpdate = true;
  }

  collectColorableMaterials(model) {
    const targets = this.modelConfig?.colorCustomization?.targets ?? [];
    if (!targets.length) return;

    const matchedMaterialsByTarget = new Map();
    const visited = new Set();

    model.traverse((child) => {
      if (!child.isMesh || !child.material || child.userData.isDepthOccluder) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];

      materials.forEach((material) => {
        if (!material?.color?.isColor || visited.has(material.uuid)) return;
        visited.add(material.uuid);

        targets.forEach((target) => {
          if (!this.materialMatchesTarget(material, target)) return;
          const targetMaterials = matchedMaterialsByTarget.get(target.id) ?? [];
          targetMaterials.push(material);
          matchedMaterialsByTarget.set(target.id, targetMaterials);
        });
      });
    });

    matchedMaterialsByTarget.forEach((materials, targetId) => {
      this.colorableMaterials.set(targetId, materials);
    });
  }

  materialMatchesTarget(material, target) {
    const materialName = (material.name ?? '').toLowerCase();
    return target.materialNameIncludes?.some((keyword) => materialName.includes(keyword.toLowerCase()));
  }

  getColorableTargets() {
    return [...this.colorableMaterials.keys()];
  }

  hasColorableMaterials() {
    return this.colorableMaterials.size > 0;
  }

  applyColor(target, color) {
    const materials = this.resolveColorableMaterials(target);
    if (!materials.length) return false;

    materials.forEach((material) => {
      material.color.set(color);
      material.needsUpdate = true;
    });

    return true;
  }

  resolveColorableMaterials(target) {
    if (target === 'all') {
      const materials = [...this.colorableMaterials.values()].flat();
      return [...new Map(materials.map((material) => [material.uuid, material])).values()];
    }

    return this.colorableMaterials.get(target) ?? [];
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

  setOpacity(opacity) {
    this.opacity = opacity;
    this.necklaceRoot.visible = opacity > 0.015;

    this.necklaceRoot.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      if (child.userData.isDepthOccluder) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        material.opacity = opacity;
        material.needsUpdate = true;
      });
    });
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

  dispose() {
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
  }
}
