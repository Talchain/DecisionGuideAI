import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom'],
          'auth': ['@supabase/supabase-js'],
          'decisions': [
            './src/components/decisions/DecisionList',
            './src/components/decisions/DecisionForm'
          ]
        }
      }
    }
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      'date-fns'
    ],
    exclude: []
  },
  esbuild: {
    target: 'esnext'
  },
  server: {
    host: true,
    strictPort: true,
    port: 5173,
    hmr: {
      clientPort: 443,
      timeout: 10000,
      overlay: true
    },
    middlewareMode: false,
    fs: {
      strict: true
    }
  },
  preview: {
    port: 5173,
    strictPort: true,
    host: true
  },
  css: {
    devSourcemap: true
  }
});