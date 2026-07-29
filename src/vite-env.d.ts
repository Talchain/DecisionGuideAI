/// <reference types="vite/client" />

// Build ID and git SHA injected by Vite define
declare const __BUILD_ID__: string
declare const __GIT_SHA__: string

/**
 * Type-safe environment variables.
 * All VITE_* variables are exposed to the browser via import.meta.env.
 * Non-VITE_ prefixed variables are server-side only (vite proxy config).
 *
 * Feature flags (VITE_FEATURE_*, VITE_ENABLE_*) are covered by the index
 * signature — only service URLs, auth, and config keys are listed explicitly
 * to catch typos at compile time.
 */
interface ImportMetaEnv {
  // --- Core ---
  readonly VITE_APP_ENV?: string
  readonly VITE_BUILD_ID?: string
  readonly VITE_POC_ONLY?: string
  readonly VITE_AUTH_MODE?: string
  /**
   * Build-time only. "0" keeps the REAL @supabase/supabase-js in the bundle
   * on a PoC/guest build (see vite.config.ts `stubSupabase`). Unset/any other
   * value preserves the historical behaviour: stub whenever PoC/guest.
   * Not read at runtime — the alias decision happens in vite.config.ts.
   */
  readonly VITE_STUB_SUPABASE?: string
  readonly VITE_STORAGE_KEY?: string
  readonly VITE_RELEASE_VERSION?: string
  readonly VITE_SESSION_ID?: string
  readonly VITE_ORG?: string

  // --- Service URLs ---
  readonly VITE_BFF_BASE?: string
  readonly VITE_CEE_BFF_BASE?: string
  readonly VITE_CEE_DRAFT_BASE?: string
  readonly VITE_ISL_BFF_BASE?: string
  readonly VITE_PLOT_API_BASE_URL?: string
  readonly VITE_PLOT_API_TOKEN?: string
  readonly VITE_PLOT_ENGINE_URL?: string
  readonly VITE_PLOT_PROXY_BASE?: string
  readonly VITE_ORCHESTRATOR_BASE?: string
  readonly VITE_ORCHESTRATOR_STREAM_BASE?: string
  readonly VITE_EDGE_GATEWAY_URL?: string

  // --- Supabase ---
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string

  // --- PLoT / Adapter config ---
  readonly VITE_COPILOT_ENABLED?: string
  readonly VITE_PLOT_ADAPTER?: string
  readonly VITE_PLOT_STREAM_EVENTSOURCE_FALLBACK?: string
  readonly VITE_PLOT_STREAM_RECONNECT?: string
  readonly VITE_PLOT_STREAM_TIMEOUT_MS?: string
  readonly VITE_PLOT_SYNC_TIMEOUT_MS?: string
  readonly VITE_PLOT_DEBUG_OVERLAYS?: string
  readonly VITE_PLC_LAB?: string
  readonly VITE_STREAM_BUFFER?: string
  readonly VITE_USE_PLOT_ENRICHMENT?: string
  readonly VITE_UI_STREAM_CANARY?: string
  readonly VITE_USE_EDGE_INVITES?: string
  readonly VITE_SHOW_VERDICT_CARD?: string
  readonly VITE_SHOW_DEBUG?: string

  // --- Debug ---
  readonly VITE_DEBUG_API?: string
  readonly VITE_DEBUG_AUTH?: string
  readonly VITE_DEBUG_NAV?: string
  readonly VITE_DEBUG_SUPABASE?: string
  readonly VITE_DEBUG_PAYLOADS?: string
  readonly VITE_DEBUG_HTTPV?: string
  readonly VITE_DEBUG_BUNDLE_V?: string
  readonly VITE_DEBUG_LLM_RAW_MAX_CHARS?: string
  readonly VITE_LOG_LEVEL?: string
  readonly VITE_VERBOSE_LOG?: string

  // --- Observability ---
  readonly VITE_SENTRY_DSN?: string
  // ROADMAP 2.111 — ONE PostHog key name. `VITE_POSTHOG_API_KEY` was deleted
  // from this declaration deliberately: with `strict` env typing, re-introducing
  // the divergent read becomes a compile error rather than a silent split-brain.
  readonly VITE_POSTHOG_HOST?: string
  readonly VITE_POSTHOG_KEY?: string
  readonly VITE_HOTJAR_ID?: string
  readonly VITE_ENABLE_WEB_VITALS?: string

  // --- Auth ---
  readonly VITE_ACCESS_CODES?: string
  readonly VITE_ACCESS_SALT?: string

  // --- Feature flags (VITE_FEATURE_*, VITE_ENABLE_*) ---
  // Covered by index signature below to avoid maintaining 80+ explicit entries.
  // Add explicit entries above when compile-time typo checking is important.
  readonly [key: `VITE_FEATURE_${string}`]: string | undefined
  readonly [key: `VITE_ENABLE_${string}`]: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
