// @ts-check

const MATERIAL_TEXTURE_KEYS = [
  'alphaMap',
  'anisotropyMap',
  'aoMap',
  'bumpMap',
  'clearcoatMap',
  'clearcoatNormalMap',
  'clearcoatRoughnessMap',
  'displacementMap',
  'emissiveMap',
  'envMap',
  'gradientMap',
  'iridescenceMap',
  'iridescenceThicknessMap',
  'lightMap',
  'map',
  'matcap',
  'metalnessMap',
  'normalMap',
  'roughnessMap',
  'sheenColorMap',
  'sheenRoughnessMap',
  'specularColorMap',
  'specularIntensityMap',
  'specularMap',
  'thicknessMap',
  'transmissionMap',
];

/** @typedef {{ dispose: () => void }} DisposableResource */
/** @typedef {import('three').Material & Record<string, unknown>} DisposableMaterial */
/** @typedef {import('three').Texture & { isTexture?: boolean }} DisposableTexture */
/** @typedef {DisposableMaterial | DisposableMaterial[] | null | undefined} MaterialInput */
/** @typedef {import('three').Object3D & { isMesh?: boolean, geometry?: DisposableResource, material?: MaterialInput }} DisposableObject3D */

export class ModelResourceDisposer {
  /**
   * @param {{ getEnvironmentMap?: () => DisposableTexture | null }} [options]
   */
  constructor({ getEnvironmentMap = () => null } = {}) {
    this.getEnvironmentMap = getEnvironmentMap;
  }

  /**
   * @param {import('three').Object3D} root
   * @returns {void}
   */
  disposeObject3DResources(root) {
    /** @type {Set<DisposableResource>} */
    const disposedGeometries = new Set();
    /** @type {Set<DisposableMaterial>} */
    const disposedMaterials = new Set();
    /** @type {Set<DisposableTexture>} */
    const disposedTextures = new Set();

    root.traverse((child) => {
      if (!isDisposableMesh(child)) return;

      this.disposeGeometry(child.geometry, disposedGeometries);
      this.disposeMaterials(child.material, disposedMaterials, disposedTextures);
      this.disposeMaterials(
        /** @type {MaterialInput} */ (child.userData.originalOccluderMaterials),
        disposedMaterials,
        disposedTextures,
      );
      delete child.userData.originalOccluderMaterials;
    });
  }

  /**
   * @param {DisposableResource | null | undefined} geometry
   * @param {Set<DisposableResource>} disposedGeometries
   * @returns {void}
   */
  disposeGeometry(geometry, disposedGeometries) {
    if (!geometry || disposedGeometries.has(geometry)) return;
    disposedGeometries.add(geometry);
    geometry.dispose();
  }

  /**
   * @param {MaterialInput} materialOrMaterials
   * @param {Set<DisposableMaterial>} disposedMaterials
   * @param {Set<DisposableTexture>} disposedTextures
   * @returns {void}
   */
  disposeMaterials(materialOrMaterials, disposedMaterials, disposedTextures) {
    this.normalizeMaterialList(materialOrMaterials).forEach((material) => {
      if (disposedMaterials.has(material)) return;
      disposedMaterials.add(material);
      this.disposeMaterialTextures(material, disposedTextures);
      material.dispose();
    });
  }

  /**
   * @param {MaterialInput} materialOrMaterials
   * @returns {DisposableMaterial[]}
   */
  normalizeMaterialList(materialOrMaterials) {
    if (!materialOrMaterials) return [];
    return Array.isArray(materialOrMaterials) ? materialOrMaterials.filter(isPresent) : [materialOrMaterials];
  }

  /**
   * @param {DisposableMaterial} material
   * @param {Set<DisposableTexture>} disposedTextures
   * @returns {void}
   */
  disposeMaterialTextures(material, disposedTextures) {
    /** @type {Set<object>} */
    const visitedValues = new Set();
    MATERIAL_TEXTURE_KEYS.forEach((key) => {
      this.disposeTextureLike(material[key], disposedTextures, visitedValues);
    });
    Object.values(material).forEach((value) => {
      this.disposeTextureLike(value, disposedTextures, visitedValues);
    });
  }

  /**
   * @param {unknown} value
   * @param {Set<DisposableTexture>} disposedTextures
   * @param {Set<object>} visitedValues
   * @param {number} [depth]
   * @returns {void}
   */
  disposeTextureLike(value, disposedTextures, visitedValues, depth = 0) {
    if (!isRecord(value) || visitedValues.has(value)) return;
    visitedValues.add(value);

    if (isTextureLike(value)) {
      if (value === this.getEnvironmentMap() || disposedTextures.has(value)) return;
      disposedTextures.add(value);
      value.dispose();
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => this.disposeTextureLike(item, disposedTextures, visitedValues, depth + 1));
      return;
    }

    if ('value' in value) {
      this.disposeTextureLike(value.value, disposedTextures, visitedValues, depth + 1);
      return;
    }

    if (depth >= 1) return;
    Object.values(value).forEach((nestedValue) => {
      this.disposeTextureLike(nestedValue, disposedTextures, visitedValues, depth + 1);
    });
  }
}

/**
 * @param {import('three').Object3D} object
 * @returns {object is DisposableObject3D}
 */
function isDisposableMesh(object) {
  return Boolean(/** @type {DisposableObject3D} */ (object).isMesh);
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
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return Boolean(value && typeof value === 'object');
}

/**
 * @param {Record<string, unknown>} value
 * @returns {value is DisposableTexture}
 */
function isTextureLike(value) {
  return Boolean(value.isTexture && typeof value.dispose === 'function');
}
