import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: path.resolve(__dirname, '../public'),
    emptyOutDir: false,
    assetsDir: 'assets/celestial',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, 'index.html'),
        explorer: path.resolve(__dirname, 'explorer.html'),
        signin: path.resolve(__dirname, 'signin.html'),
      },
      output: {
        entryFileNames: 'assets/celestial/[name]-[hash].js',
        chunkFileNames: 'assets/celestial/[name]-[hash].js',
        assetFileNames: 'assets/celestial/[name]-[hash][extname]',
        manualChunks(id) {
          if (id.includes('node_modules/three') || id.includes('@react-three')) {
            return 'celestial-3d';
          }
          if (id.includes('node_modules/gsap') || id.includes('node_modules/lenis')) {
            return 'celestial-motion';
          }
          if (id.includes('@rive-app')) {
            return 'celestial-rive';
          }
        },
      },
    },
  },
});
