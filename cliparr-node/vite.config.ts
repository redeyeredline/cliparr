import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  },
  server: {
    port: 8484,
    proxy: {
      '/api': {
        target: 'http://localhost:8484',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:8484',
        changeOrigin: true,
        ws: true
      }
    }
  },
  build: {
    outDir: 'dist/client',
    sourcemap: true
  }
}); 