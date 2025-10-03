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
  if (isPoc) {
    console.info(`UI_POC: url=${window.location.href}, poc=${(import.meta as any)?.env?.VITE_POC_ONLY}, auth=${(import.meta as any)?.env?.VITE_AUTH_MODE}, edge=${(import.meta as any)?.env?.VITE_EDGE_GATEWAY_URL || '(unset)'}`)
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