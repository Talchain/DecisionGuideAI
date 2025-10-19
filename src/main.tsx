// src/main.tsx
import './index.css'
import React, { Component, Suspense, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AppPoC from './poc/AppPoC' // STATIC import for unconditional boot

declare global {
  interface Window {
    __SAFE_DEBUG__?: { logs: any[], fatal?: string };
    __APP_MOUNTED__?: (reason?: string) => void;
    __APP_MOUNTED_FLAG__?: boolean;
  }
}

(function boot() {
  const push = (m: string, extra?: any) => {
    window.__SAFE_DEBUG__ ||= { logs: [] };
    window.__SAFE_DEBUG__!.logs.push({ t: Date.now(), m, extra });
    console.log('[main]', m, extra ?? '');
  };

  // ErrorBoundary to catch render crashes and make them visible
  class BootErrorBoundary extends Component<{ children: React.ReactNode }, { err?: any }> {
    state = { err: undefined as any };
    static getDerivedStateFromError(err: any) { return { err }; }
    componentDidCatch(err: any, info: any) {
      console.error('[BOOT ERROR]', err, info);
      window.__SAFE_DEBUG__!.fatal = String(err?.stack || err);
      push('error-boundary:caught', { error: String(err), componentStack: info.componentStack });
    }
    render() {
      if (this.state.err) {
        const msg = String(this.state.err?.stack || this.state.err);
        return (
          <div style={{padding:12, background:'#fee', color:'#900', fontFamily:'ui-monospace,monospace', fontSize:13}}>
            <strong>Render Error ❌</strong>
            <pre style={{whiteSpace:'pre-wrap', marginTop:8}}>{msg}</pre>
          </div>
        );
      }
      return this.props.children;
    }
  }

  try {
    push('entry:start', { hash: location.hash, search: location.search });
    
    const rootEl = document.getElementById('root');
    if (!rootEl) throw new Error('#root not found');

    // Check route for diagnostics
    const isCanvas = location.hash.startsWith('#/canvas');
    const isPlot = location.hash.startsWith('#/plot');
    const isSandbox = location.hash.startsWith('#/sandbox');
    push('entry:route', { isCanvas, isPlot, isSandbox, hash: location.hash });

    // Unconditional mount — no forceSafe/POC-only guards at entry
    const root = createRoot(rootEl);
    root.render(
      <StrictMode>
        <BootErrorBoundary>
          <Suspense fallback={<div style={{padding:12, fontFamily:'ui-monospace,monospace'}}>Loading…</div>}>
            <AppPoC />
          </Suspense>
        </BootErrorBoundary>
      </StrictMode>
    );
    push('entry:render-called');

    // Performance mark for debugging
    try { performance.mark('app:render-called'); } catch {}

    // Microtask: verify React actually attached nodes
    queueMicrotask(() => {
      const kids = rootEl.childElementCount;
      push('entry:post-render-check', { childElementCount: kids });
      
      // Call safe-screen callback
      if (typeof window.__APP_MOUNTED__ === 'function') {
        window.__APP_MOUNTED__('react-mounted');
        push('entry:mounted-callback-called');
      } else {
        push('entry:mounted-callback-missing');
      }
      
      if (kids === 0) {
        // Visible diagnostic if React unmounted immediately
        push('entry:warn-empty-root');
        rootEl.innerHTML =
          `<div style="padding:12px;background:#ffe;border:1px solid #cc0;font:13px ui-monospace,monospace;color:#664">
             <strong>Post-render empty ⚠️</strong>
             <div>No nodes mounted after render(). Likely an immediate runtime error or guard.</div>
             <div style="margin-top:8px">Check console for errors or __SAFE_DEBUG__.fatal</div>
           </div>`;
      } else {
        push('entry:success', { childElementCount: kids });
      }
    });
  } catch (e: any) {
    window.__SAFE_DEBUG__ ||= { logs: [] };
    window.__SAFE_DEBUG__!.fatal = String(e?.stack || e);
    push('entry:fatal', { error: String(e), stack: e?.stack });
    console.error('[main] boot fatal', e);
    
    const el = document.getElementById('root');
    if (el) {
      el.innerHTML =
        `<div style="padding:12px;background:#fee;color:#900;font:13px ui-monospace,monospace">
           <strong>Boot fatal ❌</strong>
           <pre style="white-space:pre-wrap;margin-top:8px">${String(e?.stack || e)}</pre>
         </div>`;
    }
  }
})();