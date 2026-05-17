import { MeshBasicMaterial } from 'three';

export class OccluderProcessor {
  process(model, occluderParts) {
    this.markOccluderParts(model, occluderParts);
    this.prepareDepthOccluders(model);
  }

  markOccluderParts(model, occluderParts) {
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
        ? this.normalizeMaterialList(object.material)
            .map((material) => material.name)
            .join(' ')
        : '',
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return partConfig.nameIncludes.some((keyword) => names.includes(keyword.toLowerCase()));
  }

  prepareDepthOccluders(model) {
    model.traverse((child) => {
      if (!child.isMesh || !child.userData.isDepthOccluder) return;
      this.prepareDepthOccluder(child);
    });
  }

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

  normalizeMaterialList(materialOrMaterials) {
    if (!materialOrMaterials) return [];
    return Array.isArray(materialOrMaterials) ? materialOrMaterials.filter(Boolean) : [materialOrMaterials];
  }
}
