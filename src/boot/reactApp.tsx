// src/boot/reactApp.tsx
/* eslint-disable no-console */
(function bootReactApp() {
  (window as any).__SAFE_DEBUG__ ||= { logs: [] };
  const push = (msg: string, extra?: any) => {
    (window as any).__SAFE_DEBUG__.logs.push({ t: Date.now(), msg, extra });
    console.log(`[reactApp] ${msg}`, extra ?? '');
  };

  window.addEventListener('error', e => push('window.error', { message: e.message, stack: e.error?.stack }));
  window.addEventListener('unhandledrejection', e => push('unhandledrejection', { reason: String(e.reason) }));

  (async () => {
    push('boot:start');

    const rootEl = document.getElementById('root');
    if (!rootEl) { push('boot:missing-root'); return; }
    push('boot:found-root');

    // IMPORTANT: use dynamic imports so chunks load as separate files
    push('boot:importing-react-and-app');
    const [{ createRoot }, { default: AppPoC }] = await Promise.all([
      import('react-dom/client'),  // -> bundled into react-vendor-*.js
      import('../poc/AppPoC'),     // -> AppPoC-*.js
    ]);
    push('boot:imports-resolved', { AppPoC: typeof AppPoC });

    const root = createRoot(rootEl);
    root.render(<AppPoC />);
    push('boot:react-render-called');

    try {
      (window as any).__APP_MOUNTED__?.('react-mounted');
      push('boot:signal-mounted-called');
    } catch (e) {
      push('boot:signal-mounted-error', { error: String(e) });
    }
  })().catch(err => {
    (window as any).__SAFE_DEBUG__.fatal = String(err?.stack || err);
    push('boot:fatal', { error: String(err), stack: err?.stack });
  });

  // Watchdog: if AppPoC hasn't imported in 3s, log it loudly
  setTimeout(() => {
    const logs = (window as any).__SAFE_DEBUG__.logs.map((x:any)=>x.msg);
    if (!logs.includes('boot:imports-resolved')) {
      push('watchdog:app-import-timeout', { hint: 'Check import("../poc/AppPoC") path & build output for AppPoC-*.js' });
    }
  }, 3000);
})();
