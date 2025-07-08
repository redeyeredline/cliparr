// Vite configuration for React development with integrated backend server startup.
// Configures development server, HMR, build settings, and backend integration plugin.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    // Plugin to start backend server alongside Vite
    {
      name: 'backend-integration',
      configureServer() {
        // Start your backend server when Vite starts
        setTimeout(async () => {
          try {
            const { startServer } = await import('./src/integration/server.js');
            await startServer();
            console.info('✅ Backend server started successfully');
          } catch (err) {
            console.error('❌ Failed to start backend server:', err);
          }
        }, 1000); // Small delay to let Vite start first
      }
    }
  ],
  // Suppress Node.js module externalization warnings
  optimizeDeps: {
    exclude: ['better-sqlite3', 'ioredis', 'bullmq', 'pino', 'pino-pretty', 'redis-semaphore'],
  },
  server: {
    host: '0.0.0.0',
    port: 8484, // Frontend port
    watch: {
      ignored: ['**/src/database/data/**', '**/src/integration/**', '**/src/services/**'], // Ignore backend files
    },
    hmr: {
      // Customize HMR behavior
      timeout: 5000,
      overlay: true,
      // Don't reload the page for these files
      path: '@vite/client',
      clientPort: 8484,
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor libraries into separate chunks
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-tabs', '@radix-ui/react-progress', '@radix-ui/react-checkbox', '@radix-ui/react-label', '@radix-ui/react-slot'],
          'icons-vendor': ['lucide-react', 'react-icons'],
          'utils-vendor': ['lodash', 'date-fns', 'clsx', 'class-variance-authority', 'tailwind-merge'],
          'animation-vendor': ['framer-motion'],
          'router-vendor': ['react-router-dom'],
          'data-vendor': ['better-sqlite3', 'bullmq', 'ioredis', 'redis-semaphore'],
          'network-vendor': ['axios', 'ws'],
          'logging-vendor': ['pino', 'pino-pretty'],
        },
        // Optimize chunk naming
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Increase chunk size warning limit slightly
    chunkSizeWarningLimit: 600,
    // Enable minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});