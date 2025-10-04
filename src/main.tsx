// src/main.tsx
// POC: Import-free boot in PoC mode to prevent parse/bundle errors causing blank page
// POC: Force proxy via ?edge=/engine query param (read from location.search and override edge)

const isPoc =
  (import.meta as any)?.env?.VITE_POC_ONLY === '1' ||
  (import.meta as any)?.env?.VITE_AUTH_MODE === 'guest';

(function boot() {
  const root = document.getElementById('root');
  if (!root) { console.error('POC_MIN: #root not found'); return; }

  // POC: Read edge from query param or env (defaults to direct Render URL)
  const direct = 'https://plot-lite-service.onrender.com';
  const urlParams = new URLSearchParams(location.search);
  const qp = urlParams.get('edge');
  const edge = (qp && qp.trim()) || (import.meta as any)?.env?.VITE_EDGE_GATEWAY_URL || direct;
  const build = (document.querySelector('meta[name="x-build-id"]') as HTMLMetaElement)?.content || '(none)';

  if (isPoc) {
    // POC: inline panel – guaranteed visible, no imports
    root.innerHTML = `
      <div style="position:fixed;inset:0;background:#fff;z-index:2147483647;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial">
        <div style="background:#10b981;color:#fff;padding:10px 14px;font-weight:600">
          PoC Minimal SPA Panel · build: ${build}
        </div>
        <div style="padding:14px 16px">
          <div><b>edge:</b> <code>${edge}</code></div>
          <div style="margin:10px 0;">
            <button id="btn-edge" style="padding:8px 10px;border:1px solid #ccc;background:#f8f8f8;margin-right:8px;">Check Engine (edge)</button>
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

    document.getElementById('btn-edge')?.addEventListener('click', async () => {
      try {
        const r = await fetch(edge.replace(/\/$/, '') + '/health', { cache: 'no-store' });
        const j = await r.json();
        print('OK via edge', j);
      } catch (e) { 
        try {
          print('FAIL via edge', { error: String(e) });
        } catch {}
      }
    });
    document.getElementById('btn-direct')?.addEventListener('click', async () => {
      try {
        const r = await fetch(direct + '/health', { cache: 'no-store' });
        const j = await r.json();
        print('OK via direct', j);
      } catch (e) { 
        try {
          print('FAIL via direct', { error: String(e) });
        } catch {}
      }
    });
    document.getElementById('btn-sandbox')?.addEventListener('click', () => {
      location.hash = '#/sandbox?from=poc-minimal';
    });

    // POC: auto-run edge check on load
    try {
      (document.getElementById('btn-edge') as HTMLButtonElement)?.click();
    } catch {}
    
    // POC: signal HTML failsafe to stay hidden
    try { (window as any).__APP_MOUNTED__?.(); } catch {}
    
    // POC: loud acceptance log
    try { console.info('UI_POC_MIN:', { build, edge }); } catch {}
  } else {
    // Non-PoC: signal HTML failsafe
    try { (window as any).__APP_MOUNTED__?.(); } catch {}
    console.info('UI_NON_POC_MIN: placeholder loaded');
  }
})();