import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    // Plugin to start backend server alongside Vite
    {
      name: 'backend-integration',
      configureServer() {
        // Start your backend server when Vite starts
        setTimeout(() => {
          const { startServer } = require('./src/integration/server.js');
          startServer().catch(err => {
            console.error('❌ Failed to start backend server:', err);
          });
        }, 1000); // Small delay to let Vite start first
      }
    }
  ],
  server: {
    host: '0.0.0.0',
    port: 8484, // Frontend port
    proxy: {
      '/api': {
        target: 'http://localhost:8485', // Backend port
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => path
      },
      '/ws': {
        target: 'ws://localhost:8485', // WebSocket port
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
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});