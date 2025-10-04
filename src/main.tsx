/* POC: minimal import-free main.tsx that always paints */
const root = document.getElementById('root')!;
const forceSandbox = location.hash.startsWith('#/sandbox'); // POC: route-first safety
const isPoc =
  forceSandbox ||
  (typeof import.meta !== 'undefined' &&
   (import.meta as any)?.env?.VITE_POC_ONLY === '1') ||
  (typeof import.meta !== 'undefined' &&
   (import.meta as any)?.env?.VITE_AUTH_MODE === 'guest');

(function boot() {
  try { (window as any).__APP_MOUNTED__?.(); } catch {}
  if (isPoc) {
    const build = document.querySelector('meta[name="x-build-id"]')?.getAttribute('content') || '(unknown)';
    const edge = (import.meta as any)?.env?.VITE_EDGE_GATEWAY_URL || '/engine';
    console.info(`UI_POC_MIN: build=${build}, edge=${edge}, route=${location.hash||'/'}` );

    root.innerHTML = `
      <div style="position:fixed;inset:0;z-index:2147483647;background:#fff">
        <div style="background:#10b981;color:#fff;padding:10px 14px;font-weight:600">
          PoC Minimal SPA Panel · build: ${build}
        </div>
        <div style="padding:14px 16px;font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial">
          <div><b>edge:</b> <span id="edge">${edge}</span></div>
          <div style="margin:10px 0;">
            <button id="proxy">Check Engine (proxy)</button>
            <button id="direct">Check Engine (direct)</button>
            <button id="sandbox">Try Sandbox</button>
          </div>
          <pre id="out">{ "status": "idle" }</pre>
        </div>
      </div>
    `;
    const out = document.getElementById('out')!;
    const print = (label: string, v: any) => { (out as any).textContent = label + "\n" + JSON.stringify(v, null, 2); };
    (document.getElementById('proxy') as any).onclick = async () => {
      try {
        const r = await fetch(String(edge).replace(/\/$/, '') + '/health', { cache: 'no-store' });
        print('OK via proxy', await r.json());
      } catch (e) { print('FAIL via proxy', String(e)); }
    };
    (document.getElementById('direct') as any).onclick = async () => {
      try {
        const r = await fetch('https://plot-lite-service.onrender.com/health', { cache: 'no-store' });
        print('OK via direct', await r.json());
      } catch (e) { print('FAIL via direct', String(e)); }
    };
    (document.getElementById('sandbox') as any).onclick = () => { location.hash = '#/sandbox?from=poc-minimal'; };

    // auto-run:
    (document.getElementById('proxy') as any).click();
    return;
  }

  // Non-PoC: tiny message with links (never blank)
  root.innerHTML = `
    <div style="padding:20px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial">
      <h2 style="margin:0 0 12px 0">DecisionGuide.AI</h2>
      <p>PoC surfaces:</p>
      <ul>
        <li><a href="/poc" style="color:#10b981">Static PoC</a> (zero dependencies)</li>
        <li><a href="/#/sandbox" style="color:#10b981">SPA Sandbox</a> (minimal panel)</li>
      </ul>
    </div>
  `;
})();