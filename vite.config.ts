import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { execSync } from 'node:child_process';
// Single source of truth for the Supabase-stub decision (unit-tested in
// tests/ci-guards/vite.supabase-stub-decoupling.spec.ts).
import { shouldStubSupabase } from './scripts/supabase-stub-decision.mjs';

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

  // Front-door fix: the Supabase SDK stub is DECOUPLED from PoC mode.
  //
  // Historically `isPoc` did three jobs at once: mint a guest user
  // (src/lib/poc.ts `isGuestAuth`), stub `@tanstack/react-query`, AND alias
  // the real Supabase SDK out of the bundle. That last one made real sign-in
  // impossible on any guest build — the stub in src/stubs/supabase-stub.mjs
  // does not even implement `signInWithOtp` / `signInWithOAuth`, which are
  // the only two methods src/contexts/AuthContext.tsx actually calls.
  //
  // `VITE_STUB_SUPABASE=0` keeps the REAL client in the bundle while leaving
  // guest mode as the default, so:
  //   • unauthenticated visitors still get the guest canvas (no regression),
  //   • anyone opting in via `localStorage feature.requireLogin = 1` gets a
  //     working magic-link sign-in instead of a silent no-op.
  //
  // Default (unset) preserves today's behaviour exactly: stub whenever isPoc.
  // The two Supabase aliases move TOGETHER — aliasing `@supabase/gotrue-js`
  // to `export default {}` while leaving the real supabase-js in place would
  // break the real client, which imports GoTrueClient from it.
  const stubSupabase = shouldStubSupabase(env);

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
    __GIT_SHA__: JSON.stringify(
      (() => { try { return execSync('git rev-parse --short=7 HEAD', { encoding: 'utf-8' }).trim() } catch { return 'unknown' } })()
    ),
  },
  resolve: {
    alias: [
      // @ → src/ path alias (used by 60+ files)
      { find: /^@\//, replacement: path.resolve(__dirname, 'src') + '/' },
      // POC/test stubs for guest mode.
      // Supabase pair is gated on `stubSupabase` (see above) so real sign-in
      // can be restored without un-stubbing anything else; react-query stays
      // on `isPoc` and is unaffected by the front-door fix.
      ...(stubSupabase ? [
        { find: '@supabase/supabase-js', replacement: path.resolve(__dirname, 'src/stubs/supabase-stub.mjs') },
        { find: '@supabase/gotrue-js',   replacement: path.resolve(__dirname, 'src/stubs/gotrue-stub.mjs') },
      ] : []),
      ...(isPoc ? [
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
    // Source maps are NOT published. `sourcemap: true` emitted 77 `.js.map`
    // files (~21 MB) into `dist/`, and Netlify serves `dist/` verbatim — so
    // the full unminified source of the app was publicly downloadable from
    // the deployed site.
    //
    // Nothing consumed them. Verified before flipping this:
    //   * no `@sentry/vite-plugin`, no `sentry-cli`, no `SENTRY_AUTH_TOKEN`
    //     / `SENTRY_ORG` / `SENTRY_PROJECT`, no `sourcemaps upload` step
    //     anywhere in the repo (workflows, netlify.toml, scripts, package.json);
    //   * every bundle script that walks `dist/` filters `.map` OUT
    //     (measure-bundle, report-chunks, ci-bundle-budget, verify-bundle-budget);
    //   * `netlify/edge-functions/csp-nonce.ts` lists `/*.map` only as an
    //     excludedPath, i.e. it declines to touch them;
    //   * `src/lib/monitoring.ts` only calls `Sentry.init` when
    //     `VITE_SENTRY_DSN` is set, and it is not set for the staging build.
    //
    // If a monitoring consumer is ever added, use `'hidden'` (emit maps for
    // upload, omit the `//# sourceMappingURL=` comment) rather than `true`,
    // and add the upload step in the same change.
    sourcemap: false,
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
            console.warn(`[PROXY] Engine target: ${env.ENGINE_SERVICE_URL}`)
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
            console.warn(`[PROXY] Configured target: ${env.PLOT_API_URL || 'http://localhost:4311'}`)
          }

          proxy.on('error', (err, req, res) => {
            console.error('[PROXY ERROR]', err.message)
          })

          // Add auth header from server-side env (never expose to browser)
          const apiKey = env.PLOT_API_KEY
          if (env.VITE_DEBUG_PROXY === '1') {
            console.warn(`[PROXY] Auth: PLOT_API_KEY = ${sanitizeKey(apiKey)}`)
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
            console.warn(
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
            console.warn(`[PROXY] CEE target: ${ceeTarget}`)
            console.warn(`[PROXY] CEE auth: X-Olumi-Assist-Key = ${sanitizeKey(ceeApiKey)}`)
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
              console.warn(`[PROXY] CEE ${req.method} ${req.url} → ${ceeTarget}${proxyReq.path}`)
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
            console.warn(`[PROXY] ISL target: ${islTarget}`)
            console.warn(`[PROXY] ISL auth: Authorization Bearer = ${sanitizeKey(islApiKey)}`)
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
      },
      '/bff/orchestrate': {
        target: requireProxyEnv('CEE_SERVICE_URL'),
        changeOrigin: true,
        secure: false,
        // Rewrite /bff/orchestrate/* → /orchestrate/* (CEE backend path)
        rewrite: (path) => path.replace(/^\/bff\/orchestrate/, '/orchestrate'),
        configure: (proxy) => {
          const ceeApiKey = env.ASSIST_API_KEY
          if (env.VITE_DEBUG_PROXY === '1') {
            console.warn(`[PROXY] Orchestrator target: ${env.CEE_SERVICE_URL}`)
            console.warn(`[PROXY] Orchestrator auth: X-Olumi-Assist-Key = ${sanitizeKey(ceeApiKey)}`)
          }
          if (!ceeApiKey) {
            console.warn('[PROXY] Orchestrator auth: ASSIST_API_KEY not set - requests may fail with 401')
          }

          // Inject same auth header as /bff/cee proxy
          proxy.on('proxyReq', (proxyReq) => {
            if (ceeApiKey) {
              proxyReq.setHeader('X-Olumi-Assist-Key', ceeApiKey)
            }
          })

          proxy.on('error', (err) => {
            console.error('[PROXY ERROR] /bff/orchestrate', err.message)
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
            console.warn(`[PROXY] Engine target: ${env.ENGINE_SERVICE_URL}`)
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
            console.warn(
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
            console.warn(`[PROXY] CEE target: ${ceeTarget}`)
            console.warn(`[PROXY] CEE auth: X-Olumi-Assist-Key = ${sanitizeKey(ceeApiKey)}`)
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
              console.warn(`[PROXY] CEE ${req.method} ${req.url} → ${ceeTarget}${proxyReq.path}`)
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
            console.warn(`[PROXY] ISL target: ${islTarget}`)
            console.warn(`[PROXY] ISL auth: Authorization Bearer = ${sanitizeKey(islApiKey)}`)
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
      },
      '/bff/orchestrate': {
        target: requireProxyEnv('CEE_SERVICE_URL'),
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/bff\/orchestrate/, '/orchestrate'),
        configure: (proxy) => {
          const ceeApiKey = env.ASSIST_API_KEY
          if (env.VITE_DEBUG_PROXY === '1') {
            console.warn(`[PROXY] Orchestrator target: ${env.CEE_SERVICE_URL}`)
            console.warn(`[PROXY] Orchestrator auth: X-Olumi-Assist-Key = ${sanitizeKey(ceeApiKey)}`)
          }
          if (!ceeApiKey) {
            console.warn('[PROXY] Orchestrator auth: ASSIST_API_KEY not set - requests may fail with 401')
          }

          proxy.on('proxyReq', (proxyReq) => {
            if (ceeApiKey) {
              proxyReq.setHeader('X-Olumi-Assist-Key', ceeApiKey)
            }
          })

          proxy.on('error', (err) => {
            console.error('[PROXY ERROR] /bff/orchestrate', err.message)
          })
        }
      }
    }
  },
  css: {
    devSourcemap: true
  }
}});