// Pre-React proof-of-life
declare global {
  interface Window {
    __SAFE_DEBUG__?: { logs: any[]; fatal?: any };
    __APP_MOUNTED__?: (reason?: string) => void;
  }
}
window.__SAFE_DEBUG__ ||= { logs: [] };
const plog = (msg: string, extra?: any) => {
  try { window.__SAFE_DEBUG__!.logs.push({ t: Date.now(), msg, extra }); } catch {}
  try { console.log(`[BOOT] ${msg}`, extra ?? ''); } catch {}
};

(() => {
  plog('preboot:start', { hash: location.hash });
  const safe = document.getElementById('poc-safe');
  const root = document.getElementById('root');

  if (root) {
    root.innerHTML = `<div style="padding:12px;font:13px ui-monospace,monospace"><div style="font-weight:600">Hello from Boot ✅</div><div>Script executed; loading app…</div></div>`;
    plog('preboot:painted-proof');
  }

  if (safe) {
    safe.setAttribute('data-hidden','true');
    (safe as HTMLElement).style.display = 'none';
    plog('preboot:safe-hidden');
    try { window.__APP_MOUNTED__?.('preboot'); } catch {}
  }
})();

import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';

const AppPoC = React.lazy(() => import('../poc/AppPoC'));

class BootErrorBoundary extends React.Component<{children: React.ReactNode}, {err?: any}> {
  constructor(p:any){ super(p); this.state = { err: undefined }; }
  static getDerivedStateFromError(err: any){ return { err }; }
  render() {
    if (this.state.err) {
      const msg = String(this.state.err?.stack || this.state.err);
      window.__SAFE_DEBUG__!.fatal = msg;
      return <div style={{padding:12,fontFamily:'ui-monospace,monospace',color:'#a00'}}><div style={{fontWeight:600}}>App render failed ❌</div><pre style={{whiteSpace:'pre-wrap',margin:0}}>{msg}</pre></div>;
    }
    return this.props.children;
  }
}

(function bootReact() {
  try {
    const rootEl = document.getElementById('root');
    if (!rootEl) { plog('react:no-root'); return; }

    const root = createRoot(rootEl);
    root.render(
      <BootErrorBoundary>
        <Suspense fallback={<div style={{padding:12,fontFamily:'ui-monospace,monospace'}}>Loading…</div>}>
          <AppPoC />
        </Suspense>
      </BootErrorBoundary>
    );
    plog('react:render-called');
    setTimeout(() => { try { window.__APP_MOUNTED__?.('react-mounted'); } catch {} plog('react:mounted-signal'); }, 0);
  } catch (e:any) {
    const msg = String(e?.stack || e);
    window.__SAFE_DEBUG__!.fatal = msg;
    plog('react:fatal', { error: msg });
    const root = document.getElementById('root');
    if (root) root.innerHTML = `<div style="padding:12px;color:#a00"><div style="font-weight:600">Boot fatal ❌</div><pre>${msg}</pre></div>`;
  }
})();
