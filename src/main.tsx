// src/main.tsx
import './index.css';
import { Suspense, lazy, Component, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

declare global {
  interface Window {
    __SAFE_DEBUG__?: { logs: Array<{ t: number; m: string; data?: any }>; fatal?: string };
    __APP_MOUNTED__?: (reason?: string) => void;
  }
}

window.__SAFE_DEBUG__ ||= { logs: [] };
const log = (m: string, data?: any) => {
  window.__SAFE_DEBUG__!.logs.push({ t: Date.now(), m, data });
  console.log('[main]', m, data ?? '');
};

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
      componentStack: info?.componentStack?.slice(0, 600)
    });
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 12, background: '#fee', color: '#900',
                      fontFamily: 'ui-monospace,monospace', fontSize: 13, borderRadius: 8 }}>
          <strong>Render Error ❌</strong>
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
        </div>
      );
    }
    return this.props.children;
  }
}

(function boot() {
  try {
    log('boot:start', { href: location.href, token: ENTRY_PROOF_TOKEN });

    const rootEl = document.getElementById('root');
    if (!rootEl) throw new Error('#root not found');

    const root = createRoot(rootEl);

    // Phase 1: render shell now so user never sees a blank screen
    root.render(<Shell />);
    log('boot:shell-rendered');

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
    console.error('[main] boot fatal', e);
    const el = document.getElementById('root');
    if (el) {
      el.innerHTML =
        `<div style="padding:12px;background:#fee;color:#900;font:13px ui-monospace,monospace">
           <strong>Boot Fatal ❌</strong>
           <pre style="white-space:pre-wrap;margin-top:8px">${String(e?.stack || e)}</pre>
         </div>`;
    }
  }
})();