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

// POC: Boot sequence wrapped in async IIFE
;(async () => {
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
    ;(window as any).__APP_MOUNTED__?.() // let the overlay know we mounted
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
  })
})()