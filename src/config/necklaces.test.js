import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { NECKLACES } from './necklaces.js';

const GLB_JSON_CHUNK_TYPE = 0x4e4f534a;

describe('NECKLACES catalog', () => {
  it('keeps stable unique kebab-case ids for all configured styles', () => {
    const ids = NECKLACES.map((necklace) => necklace.id);

    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => {
      expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    });
  });

  it('registers the crystal cone GLB with complete transform tuning fields', () => {
    const necklace = NECKLACES.find((item) => item.id === 'crystal-cone-necklace');

    expect(necklace).toMatchObject({
      id: 'crystal-cone-necklace',
      label: '晶錐墜鍊',
      description: '幾何水晶墜飾款',
      preserveAuthorOrigin: true,
      transform: {
        baseScale: 1,
        offsetX: 0,
        offsetY: 0,
        offsetZ: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
      },
    });
    expect(necklace?.url).toContain('models/necklace_2.glb');
    expect(necklace?.thumbnailUrl).toBeUndefined();
  });

  it('sets the crystal cone occluder to only match the GLB neck helper mesh', () => {
    const necklace = NECKLACES.find((item) => item.id === 'crystal-cone-necklace');
    const glb = readGlbJson('public/models/necklace_2.glb');
    const matchedMeshes = getMeshRecords(glb).filter((record) =>
      matchesOccluderParts(record, necklace?.occluderParts),
    );

    expect(necklace?.occluderParts?.nameIncludes).toEqual(['neck_helper']);
    expect(matchedMeshes).toEqual([
      {
        nodeName: 'neck_helper',
        meshName: '圓柱體',
        materialNames: [],
      },
    ]);
  });

  it('registers only the crystal cone color targets that have GLB material hits', () => {
    const necklace = NECKLACES.find((item) => item.id === 'crystal-cone-necklace');
    const materialNames = getMaterialNames(readGlbJson('public/models/necklace_2.glb'));

    expect(materialNames).toEqual(['Colorable_Gem', 'Colorable_Metal.001']);
    expect(necklace?.colorCustomization?.targets.map((target) => target.id)).toEqual(['metal', 'gem']);
    expect(getTargetIdsWithMaterialHits(necklace, materialNames)).toEqual(['metal', 'gem']);
    expect(necklace?.colorCustomization?.defaultColor).toBe('rose-quartz');
  });

  it('keeps the default necklace color target matching intact', () => {
    const necklace = NECKLACES.find((item) => item.id === 'default-necklace');
    const materialNames = getMaterialNames(readGlbJson('public/models/necklace.glb'));

    expect(necklace?.colorCustomization?.targets.map((target) => target.id)).toEqual([
      'metal',
      'pendant',
      'gem',
    ]);
    expect(getTargetIdsWithMaterialHits(necklace, materialNames)).toEqual(['gem']);
  });
});

function readGlbJson(relativePath) {
  const buffer = readFileSync(new URL(`../../${relativePath}`, import.meta.url));
  let offset = 12;

  while (offset < buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    offset += 8;

    if (chunkType === GLB_JSON_CHUNK_TYPE) {
      return JSON.parse(buffer.toString('utf8', offset, offset + chunkLength));
    }

    offset += chunkLength;
  }

  throw new Error(`GLB JSON chunk not found: ${relativePath}`);
}

function getMeshRecords(glb) {
  return (glb.nodes ?? [])
    .map((node) => {
      if (node.mesh == null) return null;

      const mesh = glb.meshes?.[node.mesh] ?? {};
      const materialNames = [
        ...new Set(
          (mesh.primitives ?? [])
            .map((primitive) => glb.materials?.[primitive.material]?.name ?? '')
            .filter(Boolean),
        ),
      ];

      return {
        nodeName: node.name ?? '',
        meshName: mesh.name ?? '',
        materialNames,
      };
    })
    .filter(Boolean);
}

function getMaterialNames(glb) {
  return (glb.materials ?? []).map((material) => material.name ?? '');
}

function matchesOccluderParts(record, occluderParts) {
  if (!occluderParts?.nameIncludes?.length) return false;
  const names = [record.nodeName, record.meshName, ...record.materialNames].filter(Boolean).join(' ').toLowerCase();

  return occluderParts.nameIncludes.some((keyword) => names.includes(keyword.toLowerCase()));
}

function getTargetIdsWithMaterialHits(necklace, materialNames) {
  return (necklace?.colorCustomization?.targets ?? [])
    .filter((target) =>
      materialNames.some((materialName) =>
        target.materialNameIncludes.some((keyword) => materialName.toLowerCase().includes(keyword.toLowerCase())),
      ),
    )
    .map((target) => target.id);
}
