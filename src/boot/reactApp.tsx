// src/boot/reactApp.tsx
(function bootReactApp() {
  (window as any).__SAFE_DEBUG__ ||= { logs: [] };
  const push = (msg: string, extra?: any) => {
    const row = { t: Date.now(), msg, extra };
    (window as any).__SAFE_DEBUG__.logs.push(row);
    console.log(`[reactApp] ${msg}`, extra ?? '');
  };

  import('react-dom/client')
    .then(({ createRoot }) => {
      push('boot:react-dom-ready');

      const rootEl = document.getElementById('root');
      if (!rootEl) { push('boot:missing-root'); return; }
      const root = createRoot(rootEl);

      push('boot:importing-app');
      import('./AppEntry')
        .then(({ AppEntry }) => {
          push('boot:app-imported', { typeofApp: typeof AppEntry });
          try {
            root.render(<AppEntry />);
            push('boot:render-called');
            (window as any).__APP_MOUNTED__?.('react-mounted');
            push('boot:mounted-signalled');
          } catch (err) {
            push('boot:render-error', { error: String(err) });
            root.render(
              <div style={{padding:12,fontFamily:'ui-monospace'}}>
                <strong>Render Error</strong>
                <pre style={{whiteSpace:'pre-wrap'}}>{String(err)}</pre>
              </div>
            );
          }
        })
        .catch((err) => {
          (window as any).__SAFE_DEBUG__.fatal = String(err?.stack || err);
          push('boot:app-import-failed', { error: String(err) });
          root.render(
            <div style={{padding:12,fontFamily:'ui-monospace'}}>
              <strong>App Import Failed</strong>
              <pre style={{whiteSpace:'pre-wrap'}}>{String(err)}</pre>
            </div>
          );
        });

      setTimeout(() => {
        const msgs = ((window as any).__SAFE_DEBUG__.logs||[]).map((x:any)=>x.msg);
        if (!msgs.includes('boot:app-imported')) {
          const sawReactVendor = performance.getEntriesByType('resource')
            .some((e:any)=>/react-vendor-/.test(e.name));
          push('watchdog:app-import-timeout', { sawReactVendor });
        }
      }, 3000);
    })
    .catch((err) => {
      (window as any).__SAFE_DEBUG__.fatal = String(err?.stack || err);
      push('boot:react-dom-failed', { error: String(err) });
    });
})();
