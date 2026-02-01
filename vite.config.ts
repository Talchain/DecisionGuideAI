import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// ⚠️  CRITICAL: DO NOT ADD use-sync-external-store shim aliases!
// The custom shim causes React #185 infinite loops because useCallback dependencies
// change every render when components use inline selectors (e.g., `s => s.nodes`).
// The real use-sync-external-store@1.2.0 package with dedupe works correctly.
// See: commit 0f3e914 (ROOT CAUSE fix)

export default defineConfig(({ mode, command }) => {
  // Load env vars from .env.local (including non-VITE_ prefixed vars)
  const env = loadEnv(mode, process.cwd(), '');

  // POC: Detect PoC mode from environment
  const isPoc =
    env.VITE_POC_ONLY === '1' ||
    env.VITE_AUTH_MODE === 'guest';

  // Proxy config only applies to serve/preview, not build
  const isServing = command === 'serve';

  /**
   * Require an environment variable for proxy targets.
   * Only enforced during `vite dev` / `vite preview` - not during builds or tests.
   * This prevents accidentally hitting production services during development.
   */
  const requireProxyEnv = (name: string, fallbackForLocalhost?: string): string => {
    const value = env[name];
    if (value) return value;
    // Allow localhost fallback for purely local services (e.g., PLOT_API_URL, ASSIST_BFF_URL)
    if (fallbackForLocalhost) return fallbackForLocalhost;
    // Only fail fast when actually serving - builds/tests don't use proxies
    if (!isServing) {
      // Return a placeholder URL during build/test - proxy config is ignored anyway
      return 'http://localhost:0';
    }
    // Fail fast during dev: missing env var for external service
    throw new Error(
      `[vite.config] Missing required env var: ${name}\n` +
      `Set ${name} in .env.local or environment to configure the dev proxy target.\n` +
      `This prevents accidentally hitting production services during development.`
    );
  };

  /**
   * Sanitize sensitive values for debug logging.
   * Shows first 4 chars + *** to confirm key is set without exposing full value.
   */
  const sanitizeKey = (key: string | undefined): string => {
    if (!key) return '(not set)';
    if (key.length <= 8) return '***';
    return `${key.slice(0, 4)}***`;
  };

  return {
  plugins: [react()],
  define: {
    __BUILD_ID__: JSON.stringify(process.env.BUILD_ID || new Date().toISOString()),
  },
  resolve: {
    alias: [
      // POC/test stubs for guest mode
      ...(isPoc ? [
        { find: '@supabase/supabase-js', replacement: path.resolve(__dirname, 'src/stubs/supabase-stub.mjs') },
        { find: '@supabase/gotrue-js',   replacement: path.resolve(__dirname, 'src/stubs/gotrue-stub.mjs') },
        { find: '@tanstack/react-query', replacement: path.resolve(__dirname, 'src/stubs/react-query-stub.mjs') },
      ] : []),
      // ⚠️  NO use-sync-external-store aliases - use real package with dedupe only!
    ],
    // Dedupe to avoid multi-instance edge cases
    // - react/react-dom: Prevent multiple React instances
    // - zustand: @xyflow/react bundles v4, app uses v5 - must dedupe to prevent conflicts
    // - use-sync-external-store: Ensure single instance for Zustand's useSyncExternalStore
    dedupe: ['react', 'react-dom', 'zustand', 'use-sync-external-store'],
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
      // ⚠️ NO manualChunks - causes initialization order bugs!
      // When React is in a separate chunk from use-sync-external-store,
      // the shim executes before React loads, causing:
      // "Cannot read properties of undefined (reading 'useState')"
      // Let Vite/Rollup handle chunk ordering automatically.
    }
  },
optimizeDeps: {
    // Prebundle core deps to ensure correct initialization order
    // Order matters: React first, then its dependents
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'use-sync-external-store',
      'use-sync-external-store/shim',
      'use-sync-external-store/shim/with-selector',
      'zustand',
      'zustand/vanilla',
      'zustand/traditional',
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
    },
    proxy: {
      '/bff/engine': {
        target: requireProxyEnv('ENGINE_SERVICE_URL'),
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/bff\/engine/, ''),
        configure: (proxy) => {
          // Only log targets when debug proxy enabled
          if (env.VITE_DEBUG_PROXY === '1') {
            console.log(`[PROXY] Engine target: ${env.ENGINE_SERVICE_URL}`)
          }

          proxy.on('error', (err) => {
            console.error('[PROXY ERROR] /bff/engine', err.message)
          })
        }
      },
      '/api/plot': {
        target: requireProxyEnv('PLOT_API_URL', 'http://localhost:4311'),
        changeOrigin: true,
        secure: false, // Allow self-signed certs and HTTPS targets
        rewrite: (path) => path.replace(/^\/api\/plot/, ''),
        configure: (proxy, options) => {
          // Only log targets when debug proxy enabled
          if (env.VITE_DEBUG_PROXY === '1') {
            console.log(`[PROXY] Configured target: ${env.PLOT_API_URL || 'http://localhost:4311'}`)
          }

          proxy.on('error', (err, req, res) => {
            console.error('[PROXY ERROR]', err.message)
          })

          // Add auth header from server-side env (never expose to browser)
          const apiKey = env.PLOT_API_KEY
          if (env.VITE_DEBUG_PROXY === '1') {
            console.log(`[PROXY] Auth: PLOT_API_KEY = ${sanitizeKey(apiKey)}`)
          }
          if (apiKey) {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Authorization', `Bearer ${apiKey}`)
            })
          }
        }
      },
      '/bff/assist': {
        // Dev-time proxy for Assistants BFF so Draft My Model does not 404
        // Configure ASSIST_BFF_URL to point at your assist-proxy function
        target: requireProxyEnv('ASSIST_BFF_URL', 'http://127.0.0.1:54321/functions/v1/assist-proxy'),
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/bff\/assist/, ''),
        configure: (proxy) => {
          // Only log targets when debug proxy enabled
          if (env.VITE_DEBUG_PROXY === '1') {
            console.log(
              `[PROXY] Assist BFF target: ${env.ASSIST_BFF_URL || 'http://127.0.0.1:54321/functions/v1/assist-proxy'}`
            )
          }

          proxy.on('error', (err) => {
            console.error('[PROXY ERROR] /bff/assist', err.message)
          })
        }
      },
      '/bff/cee': {
        target: requireProxyEnv('CEE_SERVICE_URL'),
        changeOrigin: true,
        secure: false,
        // Rewrite /bff/cee/* → /assist/v1/* (CEE service expects /assist/v1 prefix)
        rewrite: (path) => path.replace(/^\/bff\/cee/, '/assist/v1'),
        configure: (proxy) => {
          const ceeTarget = env.CEE_SERVICE_URL
          const ceeApiKey = env.ASSIST_API_KEY
          // P0-A Security: Only log targets when debug proxy enabled, with sanitized keys
          if (env.VITE_DEBUG_PROXY === '1') {
            console.log(`[PROXY] CEE target: ${ceeTarget}`)
            console.log(`[PROXY] CEE auth: X-Olumi-Assist-Key = ${sanitizeKey(ceeApiKey)}`)
          }
          if (!ceeApiKey) {
            console.warn('[PROXY] CEE auth: ASSIST_API_KEY not set - requests may fail with 401')
          }

          // Inject API key header for authenticated requests
          proxy.on('proxyReq', (proxyReq, req) => {
            if (ceeApiKey) {
              proxyReq.setHeader('X-Olumi-Assist-Key', ceeApiKey)
            }
            // P0-A Security: Only log request URLs when explicitly enabled (may contain user content)
            if (env.VITE_DEBUG_PROXY === '1') {
              console.log(`[PROXY] CEE ${req.method} ${req.url} → ${ceeTarget}${proxyReq.path}`)
            }
          })

          // Keep error logging (sanitized - no query params)
          proxy.on('proxyRes', (proxyRes, req) => {
            if (proxyRes.statusCode && proxyRes.statusCode >= 400) {
              console.error(`[PROXY] CEE response: ${proxyRes.statusCode} for ${req.method} ${req.url?.split('?')[0] || 'unknown'}`)
            }
          })

          proxy.on('error', (err, req) => {
            console.error(`[PROXY ERROR] /bff/cee ${req.method}:`, err.message)
          })
        }
      },
      '/bff/isl': {
        target: requireProxyEnv('ISL_SERVICE_URL'),
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/bff\/isl/, ''),
        configure: (proxy) => {
          const islTarget = env.ISL_SERVICE_URL
          const islApiKey = env.ISL_API_KEY
          // P0-A Security: Only log targets when debug proxy enabled, with sanitized keys
          if (env.VITE_DEBUG_PROXY === '1') {
            console.log(`[PROXY] ISL target: ${islTarget}`)
            console.log(`[PROXY] ISL auth: Authorization Bearer = ${sanitizeKey(islApiKey)}`)
          }
          if (!islApiKey) {
            console.warn('[PROXY] ISL auth: ISL_API_KEY not set - requests may fail with 401')
          }

          // Inject API key headers for authenticated requests
          // ISL may expect x-api-key, Authorization Bearer, or both
          proxy.on('proxyReq', (proxyReq) => {
            if (islApiKey) {
              proxyReq.setHeader('Authorization', `Bearer ${islApiKey}`)
              proxyReq.setHeader('x-api-key', islApiKey)
            }
          })

          proxy.on('error', (err) => {
            console.error('[PROXY ERROR] /bff/isl', err.message)
          })
        }
      }
    }
  },
  preview: {
    port: 5173,
    strictPort: true,
    host: true,
    proxy: {
      '/bff/engine': {
        target: requireProxyEnv('ENGINE_SERVICE_URL'),
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/bff\/engine/, ''),
        configure: (proxy) => {
          // Only log targets when debug proxy enabled
          if (env.VITE_DEBUG_PROXY === '1') {
            console.log(`[PROXY] Engine target: ${env.ENGINE_SERVICE_URL}`)
          }

          proxy.on('error', (err) => {
            console.error('[PROXY ERROR] /bff/engine', err.message)
          })
        }
      },
      '/bff/assist': {
        // Preview-time proxy for Assistants BFF so Draft My Model does not 404 under `pnpm preview`
        target: env.ASSIST_BFF_URL || 'http://127.0.0.1:54321/functions/v1/assist-proxy',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/bff\/assist/, ''),
        configure: (proxy) => {
          // Only log targets when debug proxy enabled
          if (env.VITE_DEBUG_PROXY === '1') {
            console.log(
              `[PROXY] Assist BFF target: ${env.ASSIST_BFF_URL || 'http://127.0.0.1:54321/functions/v1/assist-proxy'}`
            )
          }

          proxy.on('error', (err) => {
            console.error('[PROXY ERROR] /bff/assist', err.message)
          })
        }
      },
      '/bff/cee': {
        target: requireProxyEnv('CEE_SERVICE_URL'),
        changeOrigin: true,
        secure: false,
        // Rewrite /bff/cee/* → /assist/v1/* (CEE service expects /assist/v1 prefix)
        rewrite: (path) => path.replace(/^\/bff\/cee/, '/assist/v1'),
        configure: (proxy) => {
          const ceeTarget = env.CEE_SERVICE_URL
          const ceeApiKey = env.ASSIST_API_KEY
          // P0-A Security: Only log targets when debug proxy enabled, with sanitized keys
          if (env.VITE_DEBUG_PROXY === '1') {
            console.log(`[PROXY] CEE target: ${ceeTarget}`)
            console.log(`[PROXY] CEE auth: X-Olumi-Assist-Key = ${sanitizeKey(ceeApiKey)}`)
          }
          if (!ceeApiKey) {
            console.warn('[PROXY] CEE auth: ASSIST_API_KEY not set - requests may fail with 401')
          }

          // Inject API key header for authenticated requests
          proxy.on('proxyReq', (proxyReq, req) => {
            if (ceeApiKey) {
              proxyReq.setHeader('X-Olumi-Assist-Key', ceeApiKey)
            }
            // P0-A Security: Only log request URLs when explicitly enabled (may contain user content)
            if (env.VITE_DEBUG_PROXY === '1') {
              console.log(`[PROXY] CEE ${req.method} ${req.url} → ${ceeTarget}${proxyReq.path}`)
            }
          })

          // Keep error logging (sanitized - no query params)
          proxy.on('proxyRes', (proxyRes, req) => {
            if (proxyRes.statusCode && proxyRes.statusCode >= 400) {
              console.error(`[PROXY] CEE response: ${proxyRes.statusCode} for ${req.method} ${req.url?.split('?')[0] || 'unknown'}`)
            }
          })

          proxy.on('error', (err, req) => {
            console.error(`[PROXY ERROR] /bff/cee ${req.method}:`, err.message)
          })
        }
      },
      '/bff/isl': {
        target: requireProxyEnv('ISL_SERVICE_URL'),
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/bff\/isl/, ''),
        configure: (proxy) => {
          const islTarget = env.ISL_SERVICE_URL
          const islApiKey = env.ISL_API_KEY
          // P0-A Security: Only log targets when debug proxy enabled, with sanitized keys
          if (env.VITE_DEBUG_PROXY === '1') {
            console.log(`[PROXY] ISL target: ${islTarget}`)
            console.log(`[PROXY] ISL auth: Authorization Bearer = ${sanitizeKey(islApiKey)}`)
          }
          if (!islApiKey) {
            console.warn('[PROXY] ISL auth: ISL_API_KEY not set - requests may fail with 401')
          }

          // Inject API key headers for authenticated requests
          // ISL may expect x-api-key, Authorization Bearer, or both
          proxy.on('proxyReq', (proxyReq) => {
            if (islApiKey) {
              proxyReq.setHeader('Authorization', `Bearer ${islApiKey}`)
              proxyReq.setHeader('x-api-key', islApiKey)
            }
          })

          proxy.on('error', (err) => {
            console.error('[PROXY ERROR] /bff/isl', err.message)
          })
        }
      }
    }
  },
  css: {
    devSourcemap: true
  }
}});