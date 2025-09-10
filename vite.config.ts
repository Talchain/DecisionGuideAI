import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const isTest = mode === 'test'
  const port = Number(process.env.PORT || process.env.VITE_PORT || 5173)
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        ...(isTest
          ? {
              '@/whiteboard/tldraw': path.resolve(__dirname, 'src/whiteboard/__tests__/mocks/tldraw.tsx'),
              '@tldraw/tldraw': path.resolve(__dirname, 'src/whiteboard/__tests__/mocks/tldraw.tsx'),
              '@tldraw/tldraw/tldraw.css': path.resolve(__dirname, 'src/whiteboard/__tests__/mocks/empty.css'),
            }
          : {}),
      }
    },
    test: {
      environment: 'jsdom',
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
        '@supabase/supabase-js'
      ],
      exclude: []
    },
    esbuild: {
      target: 'esnext'
    },
    server: {
      host: true,
      strictPort: false,
      port,
      hmr: {
        protocol: 'ws',
        timeout: 10000,
        overlay: false
      },
      middlewareMode: false,
      fs: {
        strict: true
      }
    },
    preview: {
      port,
      strictPort: false,
      host: true
    },
    css: {
      devSourcemap: true
    }
  }
});