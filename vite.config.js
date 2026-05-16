import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: './',
  resolve: {
    alias: [
      {
        find: /^three$/,
        replacement: fileURLToPath(new URL('./node_modules/three/src/Three.js', import.meta.url)),
      },
    ],
  },
  build: {
    chunkSizeWarningLimit: 560,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.endsWith('/node_modules/three/src/Three.js')) return undefined;
          if (id.includes('/node_modules/three/src/')) return 'three-core';
          if (id.includes('/node_modules/three/examples/')) return 'three-extras';
          if (id.includes('/node_modules/')) return 'vendor';
          return undefined;
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});
