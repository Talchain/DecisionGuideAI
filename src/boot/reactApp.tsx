// TEMP HOTFIX BOOT (no splitting)
import { createRoot } from 'react-dom/client';
import AppPoC from '../poc/AppPoC';

declare global { interface Window { __SAFE_DEBUG__?: { logs: any[] }, __APP_MOUNTED__?: (reason?: string)=>void } }
window.__SAFE_DEBUG__ ||= { logs: [] };
const push = (msg: string, extra?: any) => {
  const row = { t: Date.now(), msg, extra };
  window.__SAFE_DEBUG__!.logs.push(row);
  try { console.log(`[reactApp] ${msg}`, extra ?? ''); } catch {}
};

(function boot() {
  push('boot:start');
  const rootEl = document.getElementById('root');
  if (!rootEl) { push('boot:no-root'); return; }
  try {
    const root = createRoot(rootEl);
    root.render(<AppPoC />);
    push('boot:rendered');
    window.__APP_MOUNTED__?.('mounted');
  } catch (e) {
    push('boot:fatal', { error: String((e as any)?.stack || e) });
    // Visible error panel (never leave users with a blank screen)
    (rootEl as HTMLElement).innerHTML = `
      <div style="padding:12px;font:13px ui-monospace,monospace">
        <strong>Boot failed</strong>
        <pre>${String(e)}</pre>
      </div>`;
  }
})();
