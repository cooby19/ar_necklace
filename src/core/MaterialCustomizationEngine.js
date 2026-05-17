import { MathUtils } from 'three';

const GEM_NAME_PATTERN = /(gem|gemstone|jewel|stone)/i;
const OPACITY_UPDATE_EPSILON = 0.003;

export class MaterialCustomizationEngine {
  constructor({ opacityEpsilon = OPACITY_UPDATE_EPSILON } = {}) {
    this.opacityEpsilon = opacityEpsilon;
    this.colorableMaterials = new Map();
    this.opacityMaterials = [];
    this.opacity = 0;
    this.appliedOpacity = 0;
  }

  reset() {
    this.colorableMaterials.clear();
    this.opacityMaterials = [];
    this.opacity = 0;
    this.appliedOpacity = 0;
  }

  prepareGemMaterials(model) {
    const materialUseCounts = this.countMaterialUsage(model);

    model.traverse((child) => {
      if (!this.isGemMesh(child) || child.userData.isDepthOccluder) return;

      const materials = this.normalizeMaterialList(child.material);
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
      const materials = this.normalizeMaterialList(child.material);
      materials.forEach((material) => {
        if (!material) return;
        counts.set(material.uuid, (counts.get(material.uuid) ?? 0) + 1);
      });
    });

    return counts;
  }

  isGemMesh(mesh) {
    if (!mesh.isMesh || !mesh.material) return false;

    const materialNames = this.normalizeMaterialList(mesh.material)
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
      material.roughness = MathUtils.clamp(material.roughness ?? 0.16, 0.08, 0.24);
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
      material.ior = MathUtils.clamp(material.ior ?? 1.5, 1.5, 1.72);
    }

    if ('transmission' in material) {
      material.transmission = Math.min(material.transmission ?? 0, 0.08);
    }

    material.needsUpdate = true;
  }

  collectColorableMaterials(model, targets = []) {
    this.colorableMaterials.clear();
    if (!targets.length) return;

    const matchedMaterialsByTarget = new Map();
    const visited = new Set();

    model.traverse((child) => {
      if (!child.isMesh || !child.material || child.userData.isDepthOccluder) return;
      const materials = this.normalizeMaterialList(child.material);

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

  collectOpacityMaterials(model) {
    const visited = new Set();
    const opacityMaterials = [];

    model.traverse((child) => {
      if (!child.isMesh || !child.material || child.userData.isDepthOccluder) return;
      const materials = this.normalizeMaterialList(child.material);

      materials.forEach((material) => {
        if (!material || visited.has(material.uuid)) return;
        visited.add(material.uuid);
        opacityMaterials.push(material);
      });
    });

    this.opacityMaterials = opacityMaterials;
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

  getColorableMaterialCount() {
    const materials = [...this.colorableMaterials.values()].flat();
    return new Set(materials.map((material) => material.uuid)).size;
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

  setOpacity(opacity) {
    const nextOpacity = MathUtils.clamp(opacity, 0, 1);
    this.opacity = nextOpacity;

    if (Math.abs(nextOpacity - this.appliedOpacity) < this.opacityEpsilon) return nextOpacity;

    this.opacityMaterials.forEach((material) => {
      material.opacity = nextOpacity;
    });
    this.appliedOpacity = nextOpacity;
    return nextOpacity;
  }

  normalizeMaterialList(materialOrMaterials) {
    if (!materialOrMaterials) return [];
    return Array.isArray(materialOrMaterials) ? materialOrMaterials.filter(Boolean) : [materialOrMaterials];
  }
}
