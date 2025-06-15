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
    watch: {
      ignored: ['**/src/database/data/**'], // Ignore DB changes
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