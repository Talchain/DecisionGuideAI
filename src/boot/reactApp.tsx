// src/boot/reactApp.tsx
/* eslint-disable no-console */
(function bootReactApp() {
  (window as any).__SAFE_DEBUG__ ||= { logs: [] };
  const log = (msg: string, extra: any = undefined) => {
    const row = { t: Date.now(), msg, extra };
    (window as any).__SAFE_DEBUG__.logs.push(row);
    console.log(`[reactApp] ${msg}`, extra ?? '');
  };

  window.addEventListener('error', e => console.log('[reactApp][error]', e.message));
  window.addEventListener('unhandledrejection', e => console.log('[reactApp][unhandled]', e.reason));

  (async () => {
    log('boot:start');

    const rootEl = document.getElementById('root');
    if (!rootEl) {
      log('boot:missing-root');
      return;
    }
    log('boot:found-root');

    log('boot:importing-react-and-app');
    const [{ createRoot }, React, { default: AppPoC }] = await Promise.all([
      import('react-dom/client'),
      import('react'),
      import('../poc/AppPoC'),
    ]);
    log('boot:imports-resolved');

    const root = createRoot(rootEl);
    root.render(
      <React.StrictMode>
        <AppPoC />
      </React.StrictMode>
    );
    log('boot:react-render-called');

    try {
      (window as any).__APP_MOUNTED__?.('react-mounted');
      log('boot:signal-mounted-called');
    } catch (e) {
      log('boot:signal-mounted-error', e);
    }
  })().catch(err => {
    console.log('[reactApp] boot:fatal', err);
    (window as any).__SAFE_DEBUG__.fatal = String(err?.stack || err);
  });
})();
