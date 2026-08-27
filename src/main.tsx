// src/main.tsx
import './index.css';
import { captureParticipantTokenFromUrl } from './collab/participantToken';
import { Suspense, lazy, Component, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { initVersionCache } from './lib/version-cache';
import { preloadPrompts } from './lib/prompt-preloader';
import {
  attemptStaleBuildReload,
  isChunkLoadError,
  reloadForCurrentBuild,
  STALE_BUILD_ACTION_COPY,
  STALE_BUILD_NOTICE_COPY,
} from './lib/staleBuildRecovery';

declare global {
  interface Window {
    __SAFE_DEBUG__?: { logs: Array<{ t: number; m: string; data?: any }>; fatal?: string };
    __APP_MOUNTED__?: (reason?: string) => void;
  }
}

const DEBUG_LOG_STORAGE_KEY = 'olumi_safe_debug_logs_v1';

// SECURITY: Only persist debug logs in DEV mode or with explicit ?stateDebug=1
// This prevents potential PII from being stored on shared/public machines
const ENABLE_DEBUG_PERSISTENCE =
  import.meta.env.DEV ||
  (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('stateDebug') === '1');

window.__SAFE_DEBUG__ ||= { logs: [] };
const debug = window.__SAFE_DEBUG__!;

// Hydrate debug logs from previous session (useful after hard crashes, DEV only)
if (ENABLE_DEBUG_PERSISTENCE) {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(DEBUG_LOG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          debug.logs = parsed;
        }
      }
    }
  } catch {
    // Ignore hydration errors - debug logging must never break boot
  }
}

// Patch logs.push so every debug entry is persisted for post-mortem analysis
// SECURITY: Only persist in DEV mode or with explicit opt-in
if (ENABLE_DEBUG_PERSISTENCE) {
  try {
    const originalPush = debug.logs.push.bind(debug.logs);
    const MAX_PERSISTED = 500;
    (debug.logs as any).push = (...entries: any[]) => {
      const result = originalPush(...entries);
      try {
        const slice = debug.logs.slice(-MAX_PERSISTED);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(DEBUG_LOG_STORAGE_KEY, JSON.stringify(slice));
        }
      } catch {
        // Ignore persistence errors - debug logging must not impact UX
      }
      return result;
    };
  } catch {
    // Ignore instrumentation errors - app should still run without enhanced logging
  }
}

const log = (m: string, data?: any) => {
  debug.logs.push({ t: Date.now(), m, data });
  // Gate console logging behind DEV to avoid production noise
  if (import.meta.env.DEV) {
    console.log('[main]', m, data ?? '');
  }
};

// Capture unhandled promise rejections to SAFE_DEBUG
window.addEventListener('unhandledrejection', (event) => {
  try {
    const reason: any = (event as any).reason;
    debug.logs.push({
      t: Date.now(),
      m: 'unhandledrejection',
      data: {
        message: reason?.message ?? String(reason),
        stack: reason?.stack,
      },
    });
  } catch {
    // Never let debug logging crash the app
  }
});

const ENTRY_PROOF_TOKEN = 'ENTRY_PROOF_TOKEN::MAIN_TSX';

// Minimal, dependency-free shell so something always paints
function Shell() {
  return (
    <div style={{
      padding: 12, fontFamily: 'ui-monospace,monospace', fontSize: 13,
      background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8
    }}>
      <div style={{ fontWeight: 600 }}>Shell mounted ✅</div>
      <div style={{ opacity: .7, marginTop: 4 }}>Loading application…</div>
    </div>
  );
}

// Lazy-load the heavy app after Shell commits
const AppPoC = lazy(() => import('./poc/AppPoC'));

class BootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: any) {
    window.__SAFE_DEBUG__!.fatal = String(error?.stack || error);
    log('error-boundary:caught', {
      error: error.message,
      stack: error.stack,
      componentStack: info?.componentStack?.slice(0, 600),
      isChunkLoadError: isChunkLoadError(error)
    });

    // THIS boundary catches the FIRST chunk that can fail — the top-level
    // `AppPoC` lazy import — so a mid-session deploy lands here, not on the
    // canvas boundary. It used to render "Render Error ❌ / Something went
    // wrong. Please refresh the page or contact support.": untrue (nothing
    // failed to render, the build moved) and a dead end. One rate-limited
    // reload, from the same module the canvas boundary uses.
    if (isChunkLoadError(error)) {
      attemptStaleBuildReload();
    }
  }
  render() {
    if (this.state.error && isChunkLoadError(this.state.error)) {
      // Reached when the automatic reload was already spent (see the guard
      // window). The next reload is the user's decision — the product does not
      // silently retry forever.
      return (
        <div style={{ padding: 16, background: '#eff6ff', color: '#1e3a8a',
                      fontFamily: 'ui-sans-serif,system-ui,sans-serif', fontSize: 14,
                      borderRadius: 8, lineHeight: 1.6 }}>
          <strong style={{ display: 'block', marginBottom: 6 }}>Olumi was updated</strong>
          <p style={{ margin: '0 0 12px' }}>{STALE_BUILD_NOTICE_COPY}</p>
          <button
            type="button"
            onClick={reloadForCurrentBuild}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #1d4ed8',
                     background: '#1d4ed8', color: '#fff', fontSize: 14, cursor: 'pointer' }}
          >
            {STALE_BUILD_ACTION_COPY}
          </button>
        </div>
      );
    }
    if (this.state.error) {
      return (
        <div style={{ padding: 12, background: '#fee', color: '#900',
                      fontFamily: 'ui-monospace,monospace', fontSize: 13, borderRadius: 8 }}>
          <strong>Render Error ❌</strong>
          {/* Only show error details in DEV to avoid exposing stack traces in production */}
          {import.meta.env.DEV ? (
            <>
              <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8, fontSize: 12 }}>
                {this.state.error.message}
              </pre>
              {this.state.error.stack && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: 'pointer', opacity: 0.75 }}>Stack trace</summary>
                  <pre style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </>
          ) : (
            <p style={{ marginTop: 8 }}>
              Something went wrong. Please refresh the page or contact support.
            </p>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

(function boot() {
  try {
    // ⭐ FIRST STATEMENT OF BOOT, DELIBERATELY. A participant's bearer token
    // arrives in the URL, and the very next line captures `location.href` into
    // window.__SAFE_DEBUG__.logs — which is persisted to localStorage under
    // ENABLE_DEBUG_PERSISTENCE, and re-read by the error boundary, the
    // diagnostic bundle and the sandbox banner. Stripping the token anywhere
    // later (a React effect, a route component) is far too late: React has not
    // mounted yet. See src/collab/participantToken.ts for why the URL fragment
    // is not a hiding place in a HashRouter app.
    captureParticipantTokenFromUrl();

    log('boot:start', { href: location.href, token: ENTRY_PROOF_TOKEN });

    // ⚠ `bootAnalysisHeroCompareFromUrl()` used to run here, reading
    // ?analysisHeroCompare=1|0 into a localStorage flag. It is DELETED with
    // the analysis fork (PX-C consolidation): the flag selected between two
    // superseded analysis panels that no longer exist, and the Analysis tab
    // now has exactly one implementation to compare nothing against.

    const rootEl = document.getElementById('root');
    if (!rootEl) throw new Error('#root not found');

    const root = createRoot(rootEl);

    // Phase 1: render shell now so user never sees a blank screen
    root.render(<Shell />);
    log('boot:shell-rendered');

    // Initialize version cache for observability headers (fire and forget)
    initVersionCache().catch(() => {
      // Silently ignore - version header is optional
    });

    // Preload LLM prompts from Supabase to eliminate cold-start latency (fire and forget)
    preloadPrompts().catch(() => {
      // Silently ignore - server falls back to defaults
    });

    // ⚠ The idle-scheduled `analysisHeroV17` dev-console helper (which
    // installed `window.__analysisHeroV17` for staging reviewers to flip the
    // two dead analysis panels) is DELETED with the fork it diagnosed. The
    // `requestIdleCallback` scaffolding went with it — it had no other user.

    // Phase 2: upgrade to full app (next microtask is enough; avoids extra layout thrash)
    queueMicrotask(() => {
      root.render(
        <BootErrorBoundary>
          <Suspense fallback={<Shell />}>
            <AppPoC />
          </Suspense>
        </BootErrorBoundary>
      );
      log('boot:app-render-scheduled');

      if (typeof window.__APP_MOUNTED__ === 'function') {
        window.__APP_MOUNTED__('react-mounted');
        log('boot:mounted-callback-called');
      }
    });
  } catch (e: any) {
    window.__SAFE_DEBUG__!.fatal = String(e?.stack || e);
    // Gate console error behind DEV to avoid exposing stack traces in production
    if (import.meta.env.DEV) {
      console.error('[main] boot fatal', e);
    }
    const el = document.getElementById('root');
    if (el) {
      // Clear any existing content safely
      el.textContent = '';

      // Build error UI programmatically to prevent XSS from error messages
      const container = document.createElement('div');
      container.style.cssText = 'padding:12px;background:#fee;color:#900;font:13px ui-monospace,monospace;border-radius:8px';

      const title = document.createElement('strong');
      title.textContent = import.meta.env.DEV ? 'Boot Fatal ❌' : 'Boot Error';
      container.appendChild(title);

      if (import.meta.env.DEV) {
        // Only show stack trace in DEV mode
        const pre = document.createElement('pre');
        pre.style.cssText = 'white-space:pre-wrap;margin-top:8px;font-size:12px';
        pre.textContent = String(e?.stack || e); // textContent escapes HTML
        container.appendChild(pre);
      } else {
        const msg = document.createElement('p');
        msg.style.marginTop = '8px';
        msg.textContent = 'Something went wrong. Please refresh the page or contact support.';
        container.appendChild(msg);
      }

      el.appendChild(container);
    }
  }
})();