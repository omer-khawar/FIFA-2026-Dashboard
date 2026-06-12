import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  worker: {
    format: 'es',
  },
  build: {
    rollupOptions: {
      output: {
        // Split the heavy 3D stack (three + r3f + postprocessing) into its own
        // chunk so it downloads in parallel and caches independently of app code.
        manualChunks(id) {
          if (
            id.includes('node_modules/three') ||
            id.includes('node_modules/@react-three')
          ) {
            return 'three';
          }
        },
      },
    },
  },
});
