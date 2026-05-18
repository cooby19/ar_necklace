// @ts-check

import { MeshBasicMaterial } from 'three';

/** @typedef {import('three').Material} Material */
/** @typedef {import('three').Mesh} Mesh */
/** @typedef {import('three').Object3D} Object3D */
/** @typedef {import('../types/domain').OccluderPartsConfig} OccluderPartsConfig */
/** @typedef {Material | Material[] | null | undefined} MaterialInput */

export class OccluderProcessor {
  /**
   * @param {Object3D} model
   * @param {OccluderPartsConfig | undefined} occluderParts
   * @returns {void}
   */
  process(model, occluderParts) {
    this.markOccluderParts(model, occluderParts);
    this.prepareDepthOccluders(model);
  }

  /**
   * @param {Object3D} model
   * @param {OccluderPartsConfig | undefined} occluderParts
   * @returns {void}
   */
  markOccluderParts(model, occluderParts) {
    if (!occluderParts?.nameIncludes?.length) return;

    model.traverse((child) => {
      if (child === model) return;
      if (this.shouldMatchPart(child, occluderParts)) {
        child.userData.isDepthOccluder = true;
      }
    });
  }

  /**
   * @param {Object3D} object
   * @param {OccluderPartsConfig} partConfig
   * @returns {boolean}
   */
  shouldMatchPart(object, partConfig) {
    const mesh = asMaybeMesh(object);
    const names = [
      object.name,
      mesh?.geometry?.name ?? '',
      mesh?.material
        ? this.normalizeMaterialList(mesh.material)
            .map((material) => material.name)
            .join(' ')
        : '',
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return partConfig.nameIncludes.some((keyword) => names.includes(keyword.toLowerCase()));
  }

  /**
   * @param {Object3D} model
   * @returns {void}
   */
  prepareDepthOccluders(model) {
    model.traverse((child) => {
      const mesh = asMaybeMesh(child);
      if (!mesh || !mesh.userData.isDepthOccluder) return;
      this.prepareDepthOccluder(mesh);
    });
  }

  /**
   * @param {Mesh} mesh
   * @returns {void}
   */
  prepareDepthOccluder(mesh) {
    if (!mesh.userData.originalOccluderMaterials) {
      mesh.userData.originalOccluderMaterials = this.normalizeMaterialList(mesh.material);
    }

    mesh.renderOrder = 0;
    mesh.material = new MeshBasicMaterial({
      colorWrite: false,
      depthWrite: true,
      depthTest: true,
      transparent: false,
    });
    mesh.material.needsUpdate = true;
  }

  /**
   * @param {MaterialInput} materialOrMaterials
   * @returns {Material[]}
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
