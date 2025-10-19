import React, { Component, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import AppPoC from './poc/AppPoC';

declare global {
  interface Window {
    __SAFE_DEBUG__?: { logs: any[], fatal?: string };
    __APP_MOUNTED__?: (reason?: string) => void;
  }
}

const ENTRY_PROOF_TOKEN = 'ENTRY_PROOF_TOKEN::MAIN_TSX';

(() => {
  try {
    window.__SAFE_DEBUG__ = window.__SAFE_DEBUG__ || { logs: [] };
    const push = (m: string, extra?: any) => {
      window.__SAFE_DEBUG__!.logs.push({ t: Date.now(), m, extra });
      console.log('[main]', m, extra ?? '');
    };

    const rootEl = document.getElementById('root');
    if (rootEl && !rootEl.firstChild) {
      rootEl.innerHTML =
        `<div style="padding:10px;font:13px ui-monospace,monospace;background:#eef;border:1px solid #99f;color:#225">
           main.tsx reached ✅
         </div>`;
      push('entry:stamp-painted', { token: ENTRY_PROOF_TOKEN });
    }

    // Global error hooks
    window.addEventListener('error', (e) => {
      window.__SAFE_DEBUG__!.fatal = String(e.error?.stack || e.message || e);
      push('entry:window-error', { msg: e.message });
    });
    window.addEventListener('unhandledrejection', (e: any) => {
      window.__SAFE_DEBUG__!.fatal = String(e?.reason?.stack || e?.reason || e);
      push('entry:unhandled-rejection', { reason: String(e?.reason || e) });
    });

    push('entry:start', { hash: location.hash });

    class BootErrorBoundary extends Component<{ children: React.ReactNode }, { err?: any }> {
      state = { err: undefined as any };
      static getDerivedStateFromError(err: any) { return { err }; }
      componentDidCatch(err: any, info: any) {
        window.__SAFE_DEBUG__!.fatal = String(err?.stack || err);
        push('entry:error-boundary', { error: String(err), componentStack: info?.componentStack });
      }
      render() {
        if (this.state.err) {
          const msg = String(this.state.err?.stack || this.state.err);
          return (
            <div style={{padding:12, background:'#fee', color:'#900',
                         fontFamily:'ui-monospace,monospace', fontSize:13}}>
              <strong>Render Error ❌</strong>
              <pre style={{whiteSpace:'pre-wrap', marginTop:8}}>{msg}</pre>
            </div>
          );
        }
        return this.props.children;
      }
    }

    // Create React root and mount
    if (!rootEl) throw new Error('#root not found');
    const root = createRoot(rootEl);

    root.render(
      <BootErrorBoundary>
        <Suspense fallback={<div style={{padding:12}}>Loading…</div>}>
          <AppPoC />
        </Suspense>
      </BootErrorBoundary>
    );
    push('entry:render-called');

    // Verify nodes appeared and call the safe-screen callback
    queueMicrotask(() => {
      const kids = rootEl.childElementCount;
      push('entry:post-render-check', { childElementCount: kids });
      if (typeof window.__APP_MOUNTED__ === 'function') {
        window.__APP_MOUNTED__('react-mounted');
        push('entry:mounted-callback-called');
      } else {
        push('entry:mounted-callback-missing');
      }

      if (kids === 0) {
        // If nothing mounted, show a visible diagnostic panel
        rootEl.innerHTML =
          `<div style="padding:12px;background:#ffe;border:1px solid #cc0;
                       font:13px ui-monospace,monospace;color:#664">
             <strong>Post-render empty ⚠️</strong>
             <div>No nodes present after render(). Likely an immediate runtime error or guard.</div>
           </div>`;
      }
    });
  } catch (e: any) {
    window.__SAFE_DEBUG__ = window.__SAFE_DEBUG__ || { logs: [] };
    window.__SAFE_DEBUG__!.fatal = String(e?.stack || e);
    console.error('[main] boot fatal', e);
    const el = document.getElementById('root');
    if (el) {
      el.innerHTML =
        `<div style="padding:12px;background:#fee;color:#900;
                     font:13px ui-monospace,monospace">
           <strong>Boot fatal ❌</strong>
           <pre style="white-space:pre-wrap;margin-top:8px">${String(e?.stack || e)}</pre>
         </div>`;
    }
  }
})();