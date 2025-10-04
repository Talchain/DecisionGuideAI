// src/main.tsx
// POC: minimal import-free boot to guarantee paint in PoC mode

const isPoc =
  (import.meta as any)?.env?.VITE_POC_ONLY === '1' ||
  (import.meta as any)?.env?.VITE_AUTH_MODE === 'guest';

(function boot() {
  const root = document.getElementById('root');
  if (!root) { console.error('POC_MIN: #root not found'); return; }

  const edge = ((import.meta as any)?.env?.VITE_EDGE_GATEWAY_URL || '/engine') as string;
  const build = (document.querySelector('meta[name="x-build-id"]') as HTMLMetaElement)?.content || '(unknown)';

  if (isPoc) {
    // POC: inline panel – guaranteed visible
    root.innerHTML = `
      <div style="position:fixed;inset:0;background:#fff;z-index:2147483647;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial">
        <div style="background:#10b981;color:#fff;padding:10px 14px;font-weight:600">
          PoC Minimal SPA Panel · build: ${build}
        </div>
        <div style="padding:14px 16px">
          <div><b>edge:</b> <code>${edge}</code></div>
          <div style="margin:10px 0;">
            <button id="btn-proxy" style="padding:8px 10px;border:1px solid #ccc;background:#f8f8f8;margin-right:8px;">Check Engine (proxy)</button>
            <button id="btn-direct" style="padding:8px 10px;border:1px solid #ccc;background:#f8f8f8;margin-right:8px;">Check Engine (direct)</button>
            <button id="btn-sandbox" style="padding:8px 10px;border:1px solid #ccc;background:#f8f8f8;">Try Sandbox</button>
          </div>
          <pre id="out" style="background:#f6f8fa;padding:10px;overflow:auto;margin:0">{ "status": "idle" }</pre>
        </div>
      </div>
    `;
    const out = document.getElementById('out')!;
    const print = (label: string, v: unknown) =>
      (out as HTMLElement).textContent = label + "\n" + JSON.stringify(v, null, 2);

    document.getElementById('btn-proxy')?.addEventListener('click', async () => {
      try {
        const r = await fetch(edge.replace(/\/$/, '') + '/health', { cache: 'no-store' });
        print('OK via proxy', await r.json());
      } catch (e) { print('FAIL via proxy', String(e)); }
    });
    document.getElementById('btn-direct')?.addEventListener('click', async () => {
      try {
        const r = await fetch('https://plot-lite-service.onrender.com/health', { cache: 'no-store' });
        print('OK via direct', await r.json());
      } catch (e) { print('FAIL via direct', String(e)); }
    });
    document.getElementById('btn-sandbox')?.addEventListener('click', () => {
      location.hash = '#/sandbox?from=poc-minimal';
    });

    (document.getElementById('btn-proxy') as HTMLButtonElement)?.click();
    try { (window as any).__APP_MOUNTED__?.(); } catch {}
    try { console.info(`UI_POC_MIN: build=${build}, edge=${edge}` ); } catch {}
  } else {
    try { (window as any).__APP_MOUNTED__?.(); } catch {}
    console.info('UI_NON_POC_MIN: placeholder loaded');
  }
})();