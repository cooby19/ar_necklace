// @ts-check

import { MathUtils } from 'three';

const GEM_NAME_PATTERN = /(gem|gemstone|jewel|stone)/i;
const OPACITY_UPDATE_EPSILON = 0.003;

/**
 * @typedef {import('three').Material & {
 *   color?: { isColor?: boolean, set: (color: string) => unknown },
 *   envMapIntensity?: number,
 *   roughness?: number,
 *   normalScale?: unknown,
 *   reflectivity?: number,
 *   ior?: number,
 *   transmission?: number,
 *   opacity?: number,
 * }} MaterialLike
 */
/** @typedef {import('three').Mesh} Mesh */
/** @typedef {import('three').Object3D} Object3D */
/** @typedef {import('three').Vector2 & { isVector2?: boolean }} NormalScaleVector */
/** @typedef {import('../types/domain').ColorTarget} ColorTarget */
/** @typedef {MaterialLike & { color: { isColor?: boolean, set: (color: string) => unknown } }} ColorableMaterial */
/** @typedef {MaterialLike | MaterialLike[] | null | undefined} MaterialInput */

export class MaterialCustomizationEngine {
  /**
   * @param {{ opacityEpsilon?: number }} [options]
   */
  constructor({ opacityEpsilon = OPACITY_UPDATE_EPSILON } = {}) {
    this.opacityEpsilon = opacityEpsilon;
    /** @type {Map<string, ColorableMaterial[]>} */
    this.colorableMaterials = new Map();
    /** @type {MaterialLike[]} */
    this.opacityMaterials = [];
    this.opacity = 0;
    this.appliedOpacity = 0;
  }

  /**
   * @returns {void}
   */
  reset() {
    this.colorableMaterials.clear();
    this.opacityMaterials = [];
    this.opacity = 0;
    this.appliedOpacity = 0;
  }

  /**
   * @param {Object3D} model
   * @returns {void}
   */
  prepareGemMaterials(model) {
    const materialUseCounts = this.countMaterialUsage(model);

    model.traverse((child) => {
      const mesh = asMaybeMesh(child);
      if (!mesh || !this.isGemMesh(mesh) || mesh.userData.isDepthOccluder) return;

      const materials = this.normalizeMaterialList(/** @type {MaterialInput} */ (mesh.material));
      const tunedMaterials = materials.map((material) => {
        if (!material) return material;

        const gemMaterial =
          (materialUseCounts.get(material.uuid) ?? 0) > 1
            ? /** @type {MaterialLike} */ (material.clone())
            : material;
        this.applyGemMaterialTuning(gemMaterial);
        return gemMaterial;
      });

      mesh.material = Array.isArray(mesh.material) ? tunedMaterials : tunedMaterials[0];
      mesh.renderOrder = 2;
    });
  }

  /**
   * @param {Object3D} model
   * @returns {Map<string, number>}
   */
  countMaterialUsage(model) {
    /** @type {Map<string, number>} */
    const counts = new Map();

    model.traverse((child) => {
      const mesh = asMaybeMesh(child);
      if (!mesh || !mesh.material) return;
      const materials = this.normalizeMaterialList(/** @type {MaterialInput} */ (mesh.material));
      materials.forEach((material) => {
        if (!material) return;
        counts.set(material.uuid, (counts.get(material.uuid) ?? 0) + 1);
      });
    });

    return counts;
  }

  /**
   * @param {Mesh} mesh
   * @returns {boolean}
   */
  isGemMesh(mesh) {
    if (!mesh.isMesh || !mesh.material) return false;

    const materialNames = this.normalizeMaterialList(/** @type {MaterialInput} */ (mesh.material))
      .map((material) => material?.name)
      .filter(Boolean)
      .join(' ');
    const names = [mesh.name, mesh.geometry?.name, materialNames].filter(Boolean).join(' ');
    return GEM_NAME_PATTERN.test(names);
  }

  /**
   * @param {MaterialLike} material
   * @returns {void}
   */
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

    const normalScale = getNormalScale(material);
    if (normalScale?.isVector2) {
      if (!material.userData.gemBaseNormalScale) {
        material.userData.gemBaseNormalScale = normalScale.clone();
      }
      if (isNormalScaleVector(material.userData.gemBaseNormalScale)) {
        normalScale.copy(material.userData.gemBaseNormalScale).multiplyScalar(1.35);
      }
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

  /**
   * @param {Object3D} model
   * @param {readonly ColorTarget[]} [targets]
   * @returns {void}
   */
  collectColorableMaterials(model, targets = []) {
    this.colorableMaterials.clear();
    if (!targets.length) return;

    /** @type {Map<string, ColorableMaterial[]>} */
    const matchedMaterialsByTarget = new Map();
    /** @type {Set<string>} */
    const visited = new Set();

    model.traverse((child) => {
      const mesh = asMaybeMesh(child);
      if (!mesh || !mesh.material || mesh.userData.isDepthOccluder) return;
      const materials = this.normalizeMaterialList(/** @type {MaterialInput} */ (mesh.material));

      materials.forEach((material) => {
        if (!material?.color?.isColor || visited.has(material.uuid)) return;
        visited.add(material.uuid);

        targets.forEach((target) => {
          if (!this.materialMatchesTarget(material, target)) return;
          const targetMaterials = matchedMaterialsByTarget.get(target.id) ?? [];
          targetMaterials.push(/** @type {ColorableMaterial} */ (material));
          matchedMaterialsByTarget.set(target.id, targetMaterials);
        });
      });
    });

    matchedMaterialsByTarget.forEach((materials, targetId) => {
      this.colorableMaterials.set(targetId, materials);
    });
  }

  /**
   * @param {Object3D} model
   * @returns {void}
   */
  collectOpacityMaterials(model) {
    /** @type {Set<string>} */
    const visited = new Set();
    /** @type {MaterialLike[]} */
    const opacityMaterials = [];

    model.traverse((child) => {
      const mesh = asMaybeMesh(child);
      if (!mesh || !mesh.material || mesh.userData.isDepthOccluder) return;
      const materials = this.normalizeMaterialList(/** @type {MaterialInput} */ (mesh.material));

      materials.forEach((material) => {
        if (!material || visited.has(material.uuid)) return;
        visited.add(material.uuid);
        opacityMaterials.push(material);
      });
    });

    this.opacityMaterials = opacityMaterials;
  }

  /**
   * @param {MaterialLike} material
   * @param {ColorTarget} target
   * @returns {boolean}
   */
  materialMatchesTarget(material, target) {
    const materialName = (material.name ?? '').toLowerCase();
    return target.materialNameIncludes?.some((keyword) => materialName.includes(keyword.toLowerCase()));
  }

  /**
   * @returns {string[]}
   */
  getColorableTargets() {
    return [...this.colorableMaterials.keys()];
  }

  /**
   * @returns {boolean}
   */
  hasColorableMaterials() {
    return this.colorableMaterials.size > 0;
  }

  /**
   * @returns {number}
   */
  getColorableMaterialCount() {
    const materials = [...this.colorableMaterials.values()].flat();
    return new Set(materials.map((material) => material.uuid)).size;
  }

  /**
   * @param {string} target
   * @param {string} color
   * @returns {boolean}
   */
  applyColor(target, color) {
    const materials = this.resolveColorableMaterials(target);
    if (!materials.length) return false;

    materials.forEach((material) => {
      material.color.set(color);
      material.needsUpdate = true;
    });

    return true;
  }

  /**
   * @param {string} target
   * @returns {ColorableMaterial[]}
   */
  resolveColorableMaterials(target) {
    if (target === 'all') {
      const materials = [...this.colorableMaterials.values()].flat();
      return [...new Map(materials.map((material) => [material.uuid, material])).values()];
    }

    return this.colorableMaterials.get(target) ?? [];
  }

  /**
   * @param {number} opacity
   * @returns {number}
   */
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

  /**
   * @param {MaterialInput} materialOrMaterials
   * @returns {MaterialLike[]}
   */
  normalizeMaterialList(materialOrMaterials) {
    if (!materialOrMaterials) return [];
    return Array.isArray(materialOrMaterials) ? materialOrMaterials.filter(isPresent) : [materialOrMaterials];
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

/**
 * @template T
 * @param {T | null | undefined | false} value
 * @returns {value is T}
 */
function isPresent(value) {
  return Boolean(value);
}

/**
 * @param {MaterialLike} material
 * @returns {NormalScaleVector | null}
 */
function getNormalScale(material) {
  const normalScale = material.normalScale;
  return isNormalScaleVector(normalScale) ? normalScale : null;
}

/**
 * @param {unknown} value
 * @returns {value is NormalScaleVector}
 */
function isNormalScaleVector(value) {
  return Boolean(value && typeof value === 'object' && 'isVector2' in value);
}
