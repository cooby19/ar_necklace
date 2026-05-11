export const NECKLACES = [
  {
    id: 'default-necklace',
    label: '經典細鍊',
    description: '柔和日常款',
    url: '/models/necklace.glb',
    preserveAuthorOrigin: true,
    occluderParts: {
      // Mesh/object/material names containing these words become invisible depth occluders.
      // They do not draw color, but they still hide necklace parts behind the neck.
      nameIncludes: ['neck', 'body_neck', 'neck_helper', '脖', '頸', '圓柱', 'cylinder'],
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
