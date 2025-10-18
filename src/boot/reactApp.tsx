// src/boot/reactApp.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';

function log(msg: string, data?: any) {
  try { console.log(`[reactApp] ${msg}`, data ?? ''); } catch {}
}

function signalMounted(tag: string) {
  try {
    const cb = (window as any).__APP_MOUNTED__;
    if (typeof cb === 'function') cb(tag);
    else {
      (window as any).__APP_MOUNTED_FLAG__ = true;
      console.warn('[reactApp] __APP_MOUNTED__ not a function; set flag instead');
    }
  } catch (e) {
    console.error('[reactApp] signalMounted error', e);
  }
}

(async function boot() {
  try {
    log('starting');

    const rootEl = document.getElementById('root');
    if (!rootEl) { console.error('[reactApp] #root not found — cannot render'); return; }
    log('#root exists');

    // Import the actual top-level app component
    const { default: AppPoC } = await import('../poc/AppPoC');
    log('AppPoC import resolved');

    const root = createRoot(rootEl);
    root.render(
      <React.StrictMode>
        <AppPoC />
      </React.StrictMode>
    );
    log('rendered');
    signalMounted('react-render-complete');
  } catch (e) {
    console.error('[reactApp] fatal error before/at render', e);
  }
})();
