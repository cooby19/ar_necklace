export const NECKLACES = [
  {
    id: 'default-necklace',
    label: '經典細鍊',
    description: '柔和日常款',
    url: `${import.meta.env.BASE_URL}models/necklace.glb`,
    preserveAuthorOrigin: true,
    occluderParts: {
      // Mesh/object/material names containing these words become invisible depth occluders.
      // They do not draw color, but they still hide necklace parts behind the neck.
      nameIncludes: ['neck', 'body_neck', 'neck_helper', '脖', '頸', '圓柱', 'cylinder'],
    },
    colorCustomization: {
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
          material: {
            roughness: 0.26,
            metalness: 0,
            envMapIntensity: 1.8,
            emissive: '#C7A4E0',
            emissiveIntensity: 0.08,
          },
        },
      ],
    },
    transform: {
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
    },
  },
];
