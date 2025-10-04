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

// POC: safe boot routing
const urlParams = new URLSearchParams(window.location.search)
const forceSafe = urlParams.get('pocsafe') === '1'
const isPoc =
  (import.meta as any)?.env?.VITE_POC_ONLY === '1' ||
  (import.meta as any)?.env?.VITE_AUTH_MODE === 'guest'
const isPocSafe = isPoc || forceSafe
const __e2e = isE2EEnabled()

// POC: Boot sequence wrapped in async IIFE with error handling
;(async () => {
  try {
    // eslint-disable-next-line no-console
    console.info(
      `UI_POC: build=${(window as any).__BUILD_ID__ || 'n/a'}, url=${location.href}, poc=${
        isPoc ? '1' : '0'
      }, auth=${(import.meta as any)?.env?.VITE_AUTH_MODE || 'n/a'}, edge=${
        (import.meta as any)?.env?.VITE_EDGE_GATEWAY_URL || '/engine'
      }, safe=${isPocSafe ? '1' : '0'}`
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