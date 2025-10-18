import React from 'react';
import { createRoot } from 'react-dom/client';
import AppPoC from '../poc/AppPoC';

(() => {
  const dbg = (msg: string, extra?: any) => {
    (window as any).__SAFE_DEBUG__ ||= { logs: [] };
    (window as any).__SAFE_DEBUG__.logs.push({ t: Date.now(), msg, extra });
    console.log('[reactApp]', msg, extra ?? '');
  };

  try {
    dbg('boot:start');
    const rootEl = document.getElementById('root');
    if (!rootEl) throw new Error('#root not found');

    const root = createRoot(rootEl);
    root.render(<AppPoC />);
    dbg('boot:render-called');

    const cb = (window as any).__APP_MOUNTED__;
    if (typeof cb === 'function') {
      cb('react-mounted');
      dbg('boot:mounted-callback-called');
    } else {
      dbg('boot:mounted-callback-missing');
    }
  } catch (e: any) {
    (window as any).__SAFE_DEBUG__ ||= { logs: [] };
    (window as any).__SAFE_DEBUG__.fatal = String(e?.stack || e);
    console.error('[reactApp] boot fatal', e);
    const el = document.getElementById('root');
    if (el) {
      el.innerHTML =
        `<div style="padding:12px;background:#fee;color:#900;font:13px ui-monospace,monospace">
           <strong>Boot fatal ❌</strong>
           <pre style="white-space:pre-wrap;margin:8px 0 0">${String(e?.stack || e)}</pre>
         </div>`;
    }
  }
})();
