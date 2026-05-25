// @ts-check

import { versionedPublicAssetUrl } from './assets.js';

/** @type {import('../types/domain').OccluderPartsConfig} */
const DEFAULT_OCCLUDER_PARTS = {
  // Mesh/object/material names containing these words become invisible depth occluders.
  // They do not draw color, but they still hide necklace parts behind the neck.
  nameIncludes: ['neck', 'body_neck', 'neck_helper', '脖', '頸', '圓柱', 'cylinder'],
};

/** @type {import('../types/domain').ColorCustomization} */
const DEFAULT_COLOR_CUSTOMIZATION = {
  defaultColor: 'rose-quartz',
  defaultTarget: 'all',
  targets: [
    {
      id: 'metal',
      label: '金屬',
      materialNameIncludes: ['Colorable_Metal'],
    },
    {
      id: 'pendant',
      label: '墜飾',
      materialNameIncludes: ['Colorable_Pendant'],
    },
    {
      id: 'gem',
      label: '寶石',
      materialNameIncludes: ['Colorable_Gem'],
    },
  ],
  palette: [
    {
      id: 'rose-quartz',
      label: '粉晶',
      color: '#F6C6D3',
      meaning: {
        keywords: ['愛', '溫柔', '安全感', '療癒', '柔和'],
        summary: '柔軟、被照顧與安定的感覺',
      },
      material: {
        roughness: 0.34,
        metalness: 0,
        envMapIntensity: 1.7,
        emissive: '#FBE4EC',
        emissiveIntensity: 0.08,
      },
    },
    {
      id: 'moonstone',
      label: '月光石',
      color: '#AFC8FF',
      meaning: {
        keywords: ['月亮', '夢境', '靈性', '柔光', '安靜'],
        summary: '像月光一樣安靜，帶一點夢境與靈性的柔光',
      },
      material: {
        roughness: 0.22,
        metalness: 0,
        envMapIntensity: 2.05,
        emissive: '#F2F4F8',
        emissiveIntensity: 0.1,
      },
    },
    {
      id: 'citrine',
      label: '黃水晶',
      color: '#E4B343',
      meaning: {
        keywords: ['財富', '陽光', '自信', '溫暖', '開朗'],
        summary: '明亮、積極，帶著陽光感與自信能量',
      },
      material: {
        roughness: 0.2,
        metalness: 0,
        envMapIntensity: 1.9,
        emissive: '#F3D27A',
        emissiveIntensity: 0.07,
      },
    },
    {
      id: 'amethyst',
      label: '紫水晶',
      color: '#8E5DB7',
      meaning: {
        keywords: ['高貴', '智慧', '神秘', '靜心'],
        summary: '沉穩而帶神秘感，適合安定思緒與靜心',
      },
      material: {
        roughness: 0.26,
        metalness: 0,
        envMapIntensity: 1.8,
        emissive: '#C7A4E0',
        emissiveIntensity: 0.08,
      },
    },
  ],
};

/** @type {import('../types/domain').OccluderPartsConfig} */
const CRYSTAL_CONE_OCCLUDER_PARTS = {
  nameIncludes: ['neck_helper'],
};

/** @type {import('../types/domain').ColorCustomization} */
const CRYSTAL_CONE_COLOR_CUSTOMIZATION = {
  ...DEFAULT_COLOR_CUSTOMIZATION,
  targets: DEFAULT_COLOR_CUSTOMIZATION.targets.filter((target) => target.id === 'metal' || target.id === 'gem'),
};

/** @type {import('../types/domain').NecklaceTransform} */
const DEFAULT_TRANSFORM = {
  // Applied after tracking scale. Use this if the asset is authored too large/small.
  baseScale: 1,
  // Fine tune the anchor after the neck position is estimated.
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0,
  // GLB orientation correction in radians. Many jewelry assets face +Z or -Z differently.
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
};

/**
 * @param {Partial<import('../types/domain').NecklaceTransform>} [overrides]
 * @returns {import('../types/domain').NecklaceTransform}
 */
function createTransform(overrides = {}) {
  return {
    ...DEFAULT_TRANSFORM,
    ...overrides,
  };
}

/** @satisfies {readonly import('../types/domain').NecklaceConfig[]} */
export const NECKLACES = [
  {
    id: 'default-necklace',
    label: '經典細鍊',
    description: '柔和日常款',
    url: versionedPublicAssetUrl('models/necklace.draco.glb'),
    thumbnailUrl: versionedPublicAssetUrl('thumbnails/default-necklace.svg'),
    preserveAuthorOrigin: true,
    occluderParts: DEFAULT_OCCLUDER_PARTS,
    colorCustomization: DEFAULT_COLOR_CUSTOMIZATION,
    transform: createTransform(),
  },
  {
    id: 'crystal-cone-necklace',
    label: '晶錐墜鍊',
    description: '幾何水晶墜飾款',
    url: versionedPublicAssetUrl('models/necklace_2.draco.glb'),
    preserveAuthorOrigin: true,
    occluderParts: CRYSTAL_CONE_OCCLUDER_PARTS,
    colorCustomization: CRYSTAL_CONE_COLOR_CUSTOMIZATION,
    transform: createTransform(),
  },
];
