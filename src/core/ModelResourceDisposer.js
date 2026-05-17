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

export class ModelResourceDisposer {
  constructor({ getEnvironmentMap = () => null } = {}) {
    this.getEnvironmentMap = getEnvironmentMap;
  }

  disposeObject3DResources(root) {
    const disposedGeometries = new Set();
    const disposedMaterials = new Set();
    const disposedTextures = new Set();

    root.traverse((child) => {
      if (!child.isMesh) return;

      this.disposeGeometry(child.geometry, disposedGeometries);
      this.disposeMaterials(child.material, disposedMaterials, disposedTextures);
      this.disposeMaterials(child.userData.originalOccluderMaterials, disposedMaterials, disposedTextures);
      delete child.userData.originalOccluderMaterials;
    });
  }

  disposeGeometry(geometry, disposedGeometries) {
    if (!geometry || disposedGeometries.has(geometry)) return;
    disposedGeometries.add(geometry);
    geometry.dispose();
  }

  disposeMaterials(materialOrMaterials, disposedMaterials, disposedTextures) {
    this.normalizeMaterialList(materialOrMaterials).forEach((material) => {
      if (disposedMaterials.has(material)) return;
      disposedMaterials.add(material);
      this.disposeMaterialTextures(material, disposedTextures);
      material.dispose();
    });
  }

  normalizeMaterialList(materialOrMaterials) {
    if (!materialOrMaterials) return [];
    return Array.isArray(materialOrMaterials) ? materialOrMaterials.filter(Boolean) : [materialOrMaterials];
  }

  disposeMaterialTextures(material, disposedTextures) {
    const visitedValues = new Set();
    MATERIAL_TEXTURE_KEYS.forEach((key) => {
      this.disposeTextureLike(material[key], disposedTextures, visitedValues);
    });
    Object.values(material).forEach((value) => {
      this.disposeTextureLike(value, disposedTextures, visitedValues);
    });
  }

  disposeTextureLike(value, disposedTextures, visitedValues, depth = 0) {
    if (!value || typeof value !== 'object' || visitedValues.has(value)) return;
    visitedValues.add(value);

    if (value.isTexture && typeof value.dispose === 'function') {
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
