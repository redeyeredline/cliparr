import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8484,
    proxy: {
      '/api': {
        target: 'http://localhost:8484',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8484',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
}); 