import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const shimPath = path.resolve(__dirname, 'src/shims/useSyncExternalStoreShim.ts');

// POC: Detect PoC mode from environment
const isPoc =
  process.env.VITE_POC_ONLY === '1' ||
  process.env.VITE_AUTH_MODE === 'guest';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: {
    __BUILD_ID__: JSON.stringify(process.env.BUILD_ID || new Date().toISOString()),
  },
  resolve: {
    alias: [
      // 🔒 Regex aliases to prevent subpath concatenation issues.
      // Order matters: specific patterns first, then catch-all, then base.
      { find: /^use-sync-external-store\/shim\/with-selector(\.js)?$/, replacement: shimPath },
      { find: /^use-sync-external-store\/with-selector(\.js)?$/,       replacement: shimPath },
      { find: /^use-sync-external-store\/shim(\/index(\.js)?)?$/,      replacement: shimPath },
      // Catch-all for any other subpaths (must come after specific ones)
      { find: /^use-sync-external-store\/.*$/,                         replacement: shimPath },
      // Base package
      { find: /^use-sync-external-store$/,                             replacement: shimPath },

      // Preserve existing POC/test stubs (merge; do not overwrite)
      ...(isPoc ? [
        { find: '@supabase/supabase-js', replacement: path.resolve(__dirname, 'src/stubs/supabase-stub.mjs') },
        { find: '@supabase/gotrue-js',   replacement: path.resolve(__dirname, 'src/stubs/gotrue-stub.mjs') },
        { find: '@tanstack/react-query', replacement: path.resolve(__dirname, 'src/stubs/react-query-stub.mjs') },
      ] : []),
    ],
    // Dedupe React to avoid multi-React edge cases (shim is local, no need to dedupe it)
    dedupe: ['react', 'react-dom'],
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    sourcemap: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      external: [], // do NOT externalize react/react-dom
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          
          // Core React libraries
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
            return 'react-vendor'
          }
          // ReactFlow (large, used only in Canvas)
          if (id.includes('reactflow') || id.includes('@xyflow')) {
            return 'rf-vendor'
          }
          // Sentry monitoring
          if (id.includes('@sentry')) {
            return 'sentry-vendor'
          }
          // Lucide icons
          if (id.includes('lucide-react')) {
            return 'icons-vendor'
          }
          // Supabase auth
          if (id.includes('@supabase') || id.includes('openid') || id.includes('@auth')) {
            return 'auth-vendor'
          }
          
          // 🔥 Heavy lazy-loaded libraries - separate chunks
          if (id.includes('tldraw') || id.includes('@tldraw')) {
            return 'tldraw-vendor'
          }
          if (id.includes('html2canvas')) {
            return 'html2canvas-vendor'
          }
          if (id.includes('elkjs') || id.includes('elk')) {
            return 'elk-vendor'
          }
          
          // Everything else
          return 'vendor'
        }
      }
    }
  },
optimizeDeps: {
    // Prebundle core deps; shim is aliased to local file
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
    target: 'esnext',
    drop: mode === 'production' ? ['console', 'debugger'] : undefined
  },
  server: {
    host: true,
    strictPort: true,
    port: 5173,
    hmr: {
      // Use default port for local dev (remove clientPort: 443)
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
}));