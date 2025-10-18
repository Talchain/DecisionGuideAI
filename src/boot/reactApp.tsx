/* eslint-disable */
import { createRoot } from 'react-dom/client';
import * as React from 'react';

// --- global diag ---
declare global {
  interface Window {
    __SAFE_DEBUG__?: { logs: any[]; fatal?: any };
    __APP_MOUNTED__?: (reason?: string) => void;
  }
}
window.__SAFE_DEBUG__ ||= { logs: [] };
const log = (msg: string, extra?: any) => {
  const row = { t: Date.now(), msg, extra };
  try { window.__SAFE_DEBUG__!.logs.push(row); } catch {}
  try { console.log(`[BOOT] ${msg}`, extra ?? ''); } catch {}
};

// --- helpers ---
const rootEl = document.getElementById('root') as HTMLElement | null;
const safeEl = document.getElementById('poc-safe') as HTMLElement | null;
const hideSafe = (reason: string) => {
  if (!safeEl) return;
  safeEl.setAttribute('data-hidden', 'true');
  safeEl.style.display = 'none';
  log('safe:hidden', { reason });
  try { window.__APP_MOUNTED__?.(reason); } catch {}
};
const renderFallback = (title: string, body: string, tone: 'warn'|'error'='warn') => {
  if (!rootEl) return;
  const color = tone === 'error' ? '#a00' : '#665200';
  rootEl.innerHTML = `
    <div style="padding:16px;font:13px ui-monospace,monospace;line-height:1.4">
      <div style="font-weight:600;color:${color};margin-bottom:8px">${title}</div>
      <pre style="white-space:pre-wrap;margin:0">${body}</pre>
    </div>`;
};

// --- Phase A: Unconditional proof-of-life render ---
(function boot() {
  log('boot:start', {
    userAgent: navigator.userAgent,
    hash: location.hash,
  });

  if (!rootEl) {
    log('boot:no-root');
    return;
  }

  try {
    const root = createRoot(rootEl);

    // Immediately render a proof-of-life panel so we KNOW React mounted.
    root.render(
      React.createElement('div', { style: { padding: 12, fontFamily: 'ui-monospace,monospace' } }, [
        React.createElement('div', { key: 'h', style: { fontWeight: 600 }}, 'Hello from Boot ✅'),
        React.createElement('div', { key: 'p' }, 'If you see this, React mounted and the boot file executed.'),
      ])
    );
    log('boot:proof-render');
    hideSafe('proof-render');

    // Phase B: Try to import the real app and replace the panel.
    import('../poc/AppPoC')
      .then(mod => {
        const App = (mod as any).default || (mod as any).AppPoC || (mod as any).AppEntry;
        log('boot:app-imported', { typeofApp: typeof App });
        if (typeof App !== 'function') {
          log('boot:bad-app', { keys: Object.keys(mod || {}) });
          renderFallback('App module invalid ⚠️',
            `typeof App was ${typeof App}. Export default a React component.`);
          return;
        }

        root.render(React.createElement(App, {}));
        log('boot:render-app');
        hideSafe('render-app');
      })
      .catch(err => {
        const msg = String(err?.stack || err);
        log('boot:app-import-failed', { error: msg });
        renderFallback('App import failed ❌', msg, 'error');
      });

    // Watchdog: if app import hangs, we still have the hello panel
    setTimeout(() => {
      const msgs = (window.__SAFE_DEBUG__!.logs || []).map((x: any) => x.msg);
      if (!msgs.includes('boot:render-app') && !msgs.includes('boot:app-import-failed')) {
        log('boot:watchdog:app-still-not-rendered', {
          sawReactVendor: performance.getEntriesByType('resource')
            .some(e => /react-vendor-.*\.js/.test(e.name))
        });
      }
    }, 4000);

  } catch (e: any) {
    const msg = String(e?.stack || e);
    window.__SAFE_DEBUG__!.fatal = msg;
    log('boot:fatal', { error: msg });
    renderFallback('Boot fatal ❌', msg, 'error');
  }
})();
