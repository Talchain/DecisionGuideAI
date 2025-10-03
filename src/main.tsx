// src/main.tsx

// (Removed dev-only SW unregister block to ensure production bundle contains no console.*)

import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter as Router } from 'react-router-dom'
import { isE2EEnabled, dumpFlags } from './flags'


// Note: Avoid importing App at module scope so E2E mode can bypass auth/supabase init
import SandboxStreamPanel from './components/SandboxStreamPanel'
import EngineAuditPanel from './components/EngineAuditPanel'
import './index.css'

// PoC acceptance logging
const isPoc = (import.meta as any)?.env?.VITE_POC_ONLY === '1'
try {
  const poc = (import.meta as any)?.env?.VITE_POC_ONLY
  const auth = (import.meta as any)?.env?.VITE_AUTH_MODE
  const edge = (import.meta as any)?.env?.VITE_EDGE_GATEWAY_URL || '(unset)'
  // eslint-disable-next-line no-undef
  const buildId = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'unknown'
  ;(window as any).__BUILD_ID__ = buildId
  if (isPoc) {
    console.info(`UI_POC: build=${buildId}, url=${window.location.href}, poc=${poc}, auth=${auth}, edge=${edge}`)
  }
  // Expose flags for inspection
  (window as any).__DBG__ = (window as any).__DBG__ || {};
  (window as any).__DBG__.flags = dumpFlags();
} catch (e) {
  console.error('Failed to log PoC acceptance:', e)
}

const container = document.getElementById('root')
if (!container) throw new Error('Failed to find root element')

const __e2e = isE2EEnabled()
if (__e2e) {
  function E2EMountProbe() {
    useEffect(() => {
      try { (window as any).__PANEL_RENDERED = true } catch {}
      try { if (document?.body) { (document.body as any).dataset.e2eReady = '1' } } catch {}
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
  setTimeout(() => { (window as any).__APP_MOUNTED__?.() }, 0)
} else if (isPoc) {
  // PoC-only mode: render Sandbox directly, bypass all providers/auth/landing
  const root = createRoot(container)
  root.render(
    <StrictMode>
      <Router>
        <SandboxStreamPanel />
      </Router>
    </StrictMode>
  )
  setTimeout(() => { (window as any).__APP_MOUNTED__?.() }, 0)
} else {
  // Lazy-load heavy providers only for non-E2E path to avoid side effects in test mode
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
    setTimeout(() => { (window as any).__APP_MOUNTED__?.() }, 0)
  })
}