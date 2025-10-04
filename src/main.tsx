// src/main.tsx

import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter as Router } from 'react-router-dom'
import { isE2EEnabled, dumpFlags } from './flags'
import { logAcceptance } from './lib/Build'
import './index.css'

// Expose flags for inspection
try {
  ;(window as any).__DBG__ = (window as any).__DBG__ || {}
  ;(window as any).__DBG__.flags = dumpFlags()
} catch (e) {
  console.error('Failed to expose flags:', e)
}

const container = document.getElementById('root')
if (!container) throw new Error('Failed to find root element')

// POC: Detect PoC mode
const isPoc =
  (import.meta as any)?.env?.VITE_POC_ONLY === '1' ||
  (import.meta as any)?.env?.VITE_AUTH_MODE === 'guest'

// POC: If PoC mode, render inline React Safe Panel (no imports, cannot fail)
if (isPoc) {
  const buildId =
    document.querySelector('meta[name="x-build-id"]')?.getAttribute('content') || '(unknown)'
  const edge = (import.meta as any)?.env?.VITE_EDGE_GATEWAY_URL || '/engine'

  function renderSafePanel() {
    // POC: ultra-simple inline panel (no imports, cannot be hidden)
    const hat = document.createElement('div')
    hat.setAttribute('id', 'poc-react-safe-panel')
    hat.setAttribute(
      'style',
      [
        'position:fixed',
        'inset:0',
        'z-index:2147483647',
        'background:#fff',
        'color:#111',
        'font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji',
        'display:flex',
        'flex-direction:column',
      ].join(';')
    )
    hat.innerHTML = `
      <div style="background:#10b981;color:white;padding:10px 14px;font-weight:600">
        PoC React Safe Panel · build: ${buildId}
      </div>
      <div style="padding:14px 16px; line-height:1.5">
        <div><b>edge:</b> ${edge}</div>
        <div id="status" style="margin-top:10px; font-family:monospace; white-space:pre-wrap;"></div>
        <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap">
          <button id="btn-proxy" style="padding:8px 10px; border:1px solid #ccc; background:#f8f8f8;">Check Engine (proxy)</button>
          <button id="btn-direct" style="padding:8px 10px; border:1px solid #ccc; background:#f8f8f8;">Check Engine (direct)</button>
          <button id="btn-sandbox" style="padding:8px 10px; border:1px solid #ccc; background:#eef6ff;">Open Sandbox attempt</button>
        </div>
        <div style="margin-top:14px; color:#6b7280">If you see this panel, React is mounted. The app tree may be rendering empty or be hidden by styles. This panel proves the runtime is alive.</div>
      </div>
    `

    const statusEl = hat.querySelector('#status') as HTMLDivElement

    function pretty(label: string, obj: any) {
      statusEl.textContent = `${label}\n${JSON.stringify(obj, null, 2)}`
    }

    ;(hat.querySelector('#btn-proxy') as HTMLButtonElement)?.addEventListener('click', async () => {
      try {
        const r = await fetch(edge.replace(/\/$/, '') + '/health', { cache: 'no-store' })
        const j = await r.json()
        console.info('POC_SAFE_REACT: proxy health OK', j)
        pretty('OK via proxy', j)
      } catch (e) {
        console.error('POC_SAFE_REACT: proxy health FAIL', e)
        pretty('FAIL via proxy', String(e))
      }
    })

    ;(hat.querySelector('#btn-direct') as HTMLButtonElement)?.addEventListener('click', async () => {
      try {
        const r = await fetch('https://plot-lite-service.onrender.com/health', { cache: 'no-store' })
        const j = await r.json()
        console.info('POC_SAFE_REACT: direct health OK', j)
        pretty('OK via direct', j)
      } catch (e) {
        console.error('POC_SAFE_REACT: direct health FAIL', e)
        pretty('FAIL via direct', String(e))
      }
    })

    ;(hat.querySelector('#btn-sandbox') as HTMLButtonElement)?.addEventListener('click', () => {
      try {
        location.hash = '#/sandbox'
      } catch {}
    })

    container.innerHTML = ''
    container.appendChild(hat)
  }

  // POC: render the safe panel immediately
  renderSafePanel()

  // POC: loud acceptance
  try {
    console.info(`UI_POC_REACT_SAFE: build=${buildId}, poc=1, edge=${edge}`)
  } catch {}

  // POC: signal HTML failsafe to stay hidden
  try {
    ;(window as any).__APP_MOUNTED__?.()
  } catch {}
} else {
  // Non-PoC: existing boot path
  const urlParams = new URLSearchParams(window.location.search)
  const forceSafe = urlParams.get('pocsafe') === '1'
  const isPocSafe = forceSafe
  const __e2e = isE2EEnabled()

  // POC: Boot sequence wrapped in async IIFE with error handling
  ;(async () => {
    try {
      // eslint-disable-next-line no-console
      console.info(
        `UI_POC: build=${(window as any).__BUILD_ID__ || 'n/a'}, url=${location.href}, poc=0, auth=${
          (import.meta as any)?.env?.VITE_AUTH_MODE || 'n/a'
        }, edge=${(import.meta as any)?.env?.VITE_EDGE_GATEWAY_URL || '/engine'}, safe=${
          isPocSafe ? '1' : '0'
        }`
      )

      if (isPocSafe) {
        // POC: Safe mode - minimal UI that always renders
        const { default: SafeMode } = await import('./poc/SafeMode')
        const root = createRoot(container)
        root.render(<SafeMode />)
        // POC: Signal HTML safe screen that React mounted
        try {
          window.__APP_MOUNTED__ && window.__APP_MOUNTED__()
        } catch {}
        return
      }
  } catch (err) {
    // POC: If Safe Mode fails, show readable error box
    console.error('Failed to render Safe Mode:', err)
    container.innerHTML = `
      <div style="font-family:system-ui;padding:20px;background:#fee;color:#900;border-radius:8px;margin:20px;">
        <h2 style="margin:0 0 12px 0;">Boot Error</h2>
        <p><strong>Message:</strong> ${err instanceof Error ? err.message : String(err)}</p>
        <pre style="background:#fff;padding:12px;border-radius:4px;overflow:auto;font-size:12px;">${
          err instanceof Error ? err.stack : 'No stack trace'
        }</pre>
        <p style="opacity:0.7;margin-top:12px;">Open DevTools → Console for more details</p>
      </div>
    `
    // POC: Signal HTML safe screen even on error
    try {
      window.__APP_MOUNTED__ && window.__APP_MOUNTED__()
    } catch {}
    return
  }

  if (__e2e) {
    // E2E mode: minimal surface for testing
    const { default: SandboxStreamPanel } = await import('./components/SandboxStreamPanel')
    const { default: EngineAuditPanel } = await import('./components/EngineAuditPanel')

    function E2EMountProbe() {
      useEffect(() => {
        try {
          ;(window as any).__PANEL_RENDERED = true
        } catch {}
        try {
          if (document?.body) {
            ;(document.body as any).dataset.e2eReady = '1'
          }
        } catch {}
      }, [])
      return null
    }
    const root = createRoot(container)
    root.render(
      <StrictMode>
        <Router>
          <div data-testid="e2e-surface">
            <E2EMountProbe />
            <SandboxStreamPanel />
            <EngineAuditPanel />
          </div>
        </Router>
      </StrictMode>
    )
    logAcceptance()
    // POC: Signal HTML safe screen that React mounted
    try {
      ;(window as any).__APP_MOUNTED__ && (window as any).__APP_MOUNTED__()
    } catch {}
    return
  }

  // Normal mode: lazy-load auth and providers
  Promise.all([
    import('./App'),
    import('./contexts/AuthContext'),
    import('./contexts/GuestContext'),
    import('./contexts/DecisionContext'),
    import('./contexts/TeamsContext'),
  ]).then(([{ default: App }, { AuthProvider }, { GuestProvider }, { DecisionProvider }, { TeamsProvider }]) => {
    const root = createRoot(container)
    root.render(
      <StrictMode>
        <Router>
          <AuthProvider>
            <GuestProvider>
              <TeamsProvider>
                <DecisionProvider>
                  <App />
                </DecisionProvider>
              </TeamsProvider>
            </GuestProvider>
          </AuthProvider>
        </Router>
      </StrictMode>
    )
    logAcceptance()
    // POC: Signal HTML safe screen that React mounted
    try {
      ;(window as any).__APP_MOUNTED__ && (window as any).__APP_MOUNTED__()
    } catch {}
  })
})()