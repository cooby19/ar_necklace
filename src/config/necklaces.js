export const NECKLACES = [
  {
    id: 'default-necklace',
    label: 'Default necklace',
    url: '/models/necklace.glb',
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
