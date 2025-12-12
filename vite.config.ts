import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// ⚠️  CRITICAL: DO NOT ADD use-sync-external-store shim aliases!
// The custom shim causes React #185 infinite loops because useCallback dependencies
// change every render when components use inline selectors (e.g., `s => s.nodes`).
// The real use-sync-external-store@1.2.0 package with dedupe works correctly.
// See: commit 0f3e914 (ROOT CAUSE fix)

export default defineConfig(({ mode }) => {
  // Load env vars from .env.local (including non-VITE_ prefixed vars)
  const env = loadEnv(mode, process.cwd(), '');

  // POC: Detect PoC mode from environment
  const isPoc =
    env.VITE_POC_ONLY === '1' ||
    env.VITE_AUTH_MODE === 'guest';

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
        target: env.ENGINE_SERVICE_URL || 'https://plot-lite-service.onrender.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/bff\/engine/, ''),
        configure: (proxy) => {
          console.log(`[PROXY] Engine target: ${env.ENGINE_SERVICE_URL || 'https://plot-lite-service.onrender.com'}`)

          proxy.on('error', (err) => {
            console.error('[PROXY ERROR] /bff/engine', err.message)
          })
        }
      },
      '/api/plot': {
        target: env.PLOT_API_URL || 'http://localhost:4311',
        changeOrigin: true,
        secure: false, // Allow self-signed certs and HTTPS targets
        rewrite: (path) => path.replace(/^\/api\/plot/, ''),
        configure: (proxy, options) => {
          console.log(`[PROXY] Configured target: ${env.PLOT_API_URL || 'http://localhost:4311'}`)

          // Debug logging
          proxy.on('error', (err, req, res) => {
            console.error('[PROXY ERROR]', err.message)
          })

          // Add auth header from server-side env (never expose to browser)
          const apiKey = env.PLOT_API_KEY
          if (apiKey) {
            console.log('[PROXY] Auth header configured')
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Authorization', `Bearer ${apiKey}`)
            })
          } else {
            console.log('[PROXY] No API key configured')
          }
        }
      },
      '/bff/assist': {
        // Dev-time proxy for Assistants BFF so Draft My Model does not 404
        // Configure ASSIST_BFF_URL to point at your assist-proxy function
        target: env.ASSIST_BFF_URL || 'http://127.0.0.1:54321/functions/v1/assist-proxy',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/bff\/assist/, ''),
        configure: (proxy) => {
          console.log(
            `[PROXY] Assist BFF target: ${env.ASSIST_BFF_URL || 'http://127.0.0.1:54321/functions/v1/assist-proxy'}`
          )

          proxy.on('error', (err) => {
            console.error('[PROXY ERROR] /bff/assist', err.message)
          })
        }
      },
      '/bff/cee': {
        target: env.CEE_SERVICE_URL || 'https://olumi-assistants-service.onrender.com',
        changeOrigin: true,
        secure: false,
        // Rewrite /bff/cee/* → /assist/v1/* (CEE service expects /assist/v1 prefix)
        rewrite: (path) => path.replace(/^\/bff\/cee/, '/assist/v1'),
        configure: (proxy) => {
          const ceeTarget = env.CEE_SERVICE_URL || 'https://olumi-assistants-service.onrender.com'
          const ceeApiKey = env.ASSIST_API_KEY
          console.log(`[PROXY] CEE target: ${ceeTarget}`)
          if (ceeApiKey) {
            console.log('[PROXY] CEE auth: X-Olumi-Assist-Key configured')
          } else {
            console.warn('[PROXY] CEE auth: ASSIST_API_KEY not set - requests may fail with 401')
          }

          // Inject API key header for authenticated requests
          proxy.on('proxyReq', (proxyReq, req) => {
            if (ceeApiKey) {
              proxyReq.setHeader('X-Olumi-Assist-Key', ceeApiKey)
            }
            // Brief 32: Debug logging for proxy requests
            console.log(`[PROXY] CEE ${req.method} ${req.url} → ${ceeTarget}${proxyReq.path}`)
          })

          // Brief 32: Log response status for debugging
          proxy.on('proxyRes', (proxyRes, req) => {
            if (proxyRes.statusCode && proxyRes.statusCode >= 400) {
              console.error(`[PROXY] CEE response: ${proxyRes.statusCode} for ${req.url}`)
            }
          })

          proxy.on('error', (err, req) => {
            console.error(`[PROXY ERROR] /bff/cee ${req?.url}:`, err.message)
          })
        }
      },
      '/bff/isl': {
        target: env.ISL_SERVICE_URL || 'https://isl-staging.onrender.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/bff\/isl/, ''),
        configure: (proxy) => {
          const islTarget = env.ISL_SERVICE_URL || 'https://isl-staging.onrender.com'
          const islApiKey = env.ISL_API_KEY
          console.log(`[PROXY] ISL target: ${islTarget}`)
          if (islApiKey) {
            console.log('[PROXY] ISL auth: Authorization Bearer configured')
          } else {
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
        target: env.ENGINE_SERVICE_URL || 'https://plot-lite-service.onrender.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/bff\/engine/, ''),
        configure: (proxy) => {
          console.log(`[PROXY] Engine target: ${env.ENGINE_SERVICE_URL || 'https://plot-lite-service.onrender.com'}`)

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
          console.log(
            `[PROXY] Assist BFF target: ${env.ASSIST_BFF_URL || 'http://127.0.0.1:54321/functions/v1/assist-proxy'}`
          )

          proxy.on('error', (err) => {
            console.error('[PROXY ERROR] /bff/assist', err.message)
          })
        }
      },
      '/bff/cee': {
        target: env.CEE_SERVICE_URL || 'https://olumi-assistants-service.onrender.com',
        changeOrigin: true,
        secure: false,
        // Rewrite /bff/cee/* → /assist/v1/* (CEE service expects /assist/v1 prefix)
        rewrite: (path) => path.replace(/^\/bff\/cee/, '/assist/v1'),
        configure: (proxy) => {
          const ceeTarget = env.CEE_SERVICE_URL || 'https://olumi-assistants-service.onrender.com'
          const ceeApiKey = env.ASSIST_API_KEY
          console.log(`[PROXY] CEE target: ${ceeTarget}`)
          if (ceeApiKey) {
            console.log('[PROXY] CEE auth: X-Olumi-Assist-Key configured')
          } else {
            console.warn('[PROXY] CEE auth: ASSIST_API_KEY not set - requests may fail with 401')
          }

          // Inject API key header for authenticated requests
          proxy.on('proxyReq', (proxyReq, req) => {
            if (ceeApiKey) {
              proxyReq.setHeader('X-Olumi-Assist-Key', ceeApiKey)
            }
            // Brief 32: Debug logging for proxy requests
            console.log(`[PROXY] CEE ${req.method} ${req.url} → ${ceeTarget}${proxyReq.path}`)
          })

          // Brief 32: Log response status for debugging
          proxy.on('proxyRes', (proxyRes, req) => {
            if (proxyRes.statusCode && proxyRes.statusCode >= 400) {
              console.error(`[PROXY] CEE response: ${proxyRes.statusCode} for ${req.url}`)
            }
          })

          proxy.on('error', (err, req) => {
            console.error(`[PROXY ERROR] /bff/cee ${req?.url}:`, err.message)
          })
        }
      },
      '/bff/isl': {
        target: env.ISL_SERVICE_URL || 'https://isl-staging.onrender.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/bff\/isl/, ''),
        configure: (proxy) => {
          const islTarget = env.ISL_SERVICE_URL || 'https://isl-staging.onrender.com'
          const islApiKey = env.ISL_API_KEY
          console.log(`[PROXY] ISL target: ${islTarget}`)
          if (islApiKey) {
            console.log('[PROXY] ISL auth: Authorization Bearer configured')
          } else {
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