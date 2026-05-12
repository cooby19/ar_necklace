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
      defaultColor: 'gold',
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
        { id: 'gold', label: '金色', color: '#d4af37' },
        { id: 'silver', label: '銀色', color: '#d8dde1' },
        { id: 'rose-gold', label: '玫瑰金', color: '#c98f7a' },
        { id: 'black-steel', label: '黑鋼', color: '#1f2226' },
        { id: 'pearl-white', label: '珍珠白', color: '#f4efe6' },
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
