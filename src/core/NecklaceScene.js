import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const GEM_NAME_PATTERN = /(gem|gemstone|jewel|stone)/i;

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
      // TODO: Validate removing this after renderForCapture() on iOS Safari, Android Chrome, and desktop Chrome.
      preserveDrawingBuffer: true,
    });
    this.loader = new GLTFLoader();
    this.necklaceRoot = new THREE.Group();
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.environmentMap = null;
    this.currentModel = null;
    this.modelConfig = null;
    this.colorableMaterials = new Map();
    this.opacity = 0;
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
    this.resize();

    window.addEventListener('resize', this.resize);
  }

  setupRenderer() {
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
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
    const hemisphere = new THREE.HemisphereLight(0xffffff, 0x5d6680, 0.8);
    const key = new THREE.DirectionalLight(0xffffff, 2.25);
    key.position.set(0.25, 0.7, 1.8);
    const warmFill = new THREE.DirectionalLight(0xffd7a3, 0.62);
    warmFill.position.set(-1.2, -0.35, 0.85);
    const coolRim = new THREE.DirectionalLight(0xbfd5ff, 1.05);
    coolRim.position.set(1.45, 0.32, -1.15);
    const sparkle = new THREE.PointLight(0xffffff, 0.85, 3.2);
    sparkle.position.set(0.08, 0.26, 1.25);
    this.scene.add(hemisphere, key, warmFill, coolRim, sparkle);
  }

  async loadNecklace(config) {
    this.modelConfig = config;
    this.necklaceRoot.clear();
    this.currentModel = null;
    this.colorableMaterials.clear();
    this.opacity = 0;
    this.showcase.lastTime = 0;

    const glbBuffer = await this.fetchGlbFile(config.url);
    const gltf = await this.parseGlbFile(glbBuffer, config.url);
    const model = gltf.scene;
    this.markOccluderParts(model);
    this.prepareModel(model);
    this.prepareGemMaterials(model);
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

  prepareGemMaterials(model) {
    const materialUseCounts = this.countMaterialUsage(model);

    model.traverse((child) => {
      if (!this.isGemMesh(child) || child.userData.isDepthOccluder) return;

      const materials = Array.isArray(child.material) ? child.material : [child.material];
      const tunedMaterials = materials.map((material) => {
        if (!material) return material;

        const gemMaterial = materialUseCounts.get(material.uuid) > 1 ? material.clone() : material;
        this.applyGemMaterialTuning(gemMaterial);
        return gemMaterial;
      });

      child.material = Array.isArray(child.material) ? tunedMaterials : tunedMaterials[0];
      child.renderOrder = 2;
    });
  }

  countMaterialUsage(model) {
    const counts = new Map();

    model.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (!material) return;
        counts.set(material.uuid, (counts.get(material.uuid) ?? 0) + 1);
      });
    });

    return counts;
  }

  isGemMesh(mesh) {
    if (!mesh.isMesh || !mesh.material) return false;

    const materialNames = (Array.isArray(mesh.material) ? mesh.material : [mesh.material])
      .map((material) => material?.name)
      .filter(Boolean)
      .join(' ');
    const names = [mesh.name, mesh.geometry?.name, materialNames].filter(Boolean).join(' ');
    return GEM_NAME_PATTERN.test(names);
  }

  applyGemMaterialTuning(material) {
    material.userData = {
      ...material.userData,
      isGemMaterial: true,
    };

    if ('envMapIntensity' in material) {
      material.envMapIntensity = Math.max(material.envMapIntensity ?? 1, 2.4);
    }

    if ('roughness' in material) {
      material.roughness = THREE.MathUtils.clamp(material.roughness ?? 0.16, 0.08, 0.24);
    }

    if (material.normalScale?.isVector2) {
      if (!material.userData.gemBaseNormalScale) {
        material.userData.gemBaseNormalScale = material.normalScale.clone();
      }
      material.normalScale.copy(material.userData.gemBaseNormalScale).multiplyScalar(1.35);
    }

    if ('reflectivity' in material) {
      material.reflectivity = Math.max(material.reflectivity ?? 0.5, 0.72);
    }

    if ('ior' in material) {
      material.ior = THREE.MathUtils.clamp(material.ior ?? 1.5, 1.5, 1.72);
    }

    if ('transmission' in material) {
      material.transmission = Math.min(material.transmission ?? 0, 0.08);
    }

    material.needsUpdate = true;
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

  applyColor(target, color, materialPreset = {}) {
    const materials = this.resolveColorableMaterials(target);
    if (!materials.length) return false;

    materials.forEach((material) => {
      material.color.set(color);
      this.applyMaterialPreset(material, materialPreset);
      material.needsUpdate = true;
    });

    return true;
  }

  applyMaterialPreset(material, preset) {
    if (!preset) return;

    if (Number.isFinite(preset.roughness) && 'roughness' in material) {
      material.roughness = preset.roughness;
    }

    if (Number.isFinite(preset.metalness) && 'metalness' in material) {
      material.metalness = preset.metalness;
    }

    if (Number.isFinite(preset.envMapIntensity) && 'envMapIntensity' in material) {
      material.envMapIntensity = preset.envMapIntensity;
    }

    if (preset.emissive && material.emissive?.isColor) {
      material.emissive.set(preset.emissive);
    }

    if (Number.isFinite(preset.emissiveIntensity) && 'emissiveIntensity' in material) {
      material.emissiveIntensity = preset.emissiveIntensity;
    }

    if (material.userData?.isGemMaterial) {
      this.applyGemMaterialTuning(material);
    }
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
    window.removeEventListener('resize', this.resize);
    this.environmentMap?.dispose();
    this.pmremGenerator.dispose();
    this.renderer.dispose();
  }
}
