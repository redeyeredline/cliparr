import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 8484,
    proxy: {
      '/api': {
        target: 'http://localhost:8484',
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => path
      },
      '/ws': {
        target: 'ws://localhost:8484',
        ws: true,
        changeOrigin: true,
        secure: false
      }
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
}); 