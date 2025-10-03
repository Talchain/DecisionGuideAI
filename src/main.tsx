// src/main.tsx

// (Removed dev-only SW unregister block to ensure production bundle contains no console.*)

import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter as Router } from 'react-router-dom'
import { isE2EEnabled } from './flags'


// Note: Avoid importing App at module scope so E2E mode can bypass auth/supabase init
import SandboxStreamPanel from './components/SandboxStreamPanel'
import EngineAuditPanel from './components/EngineAuditPanel'
import './index.css'

// PoC acceptance logging
const isPoc = (import.meta as any)?.env?.VITE_POC_ONLY === '1'
if (isPoc) {
  console.info(`UI_POC: url=${window.location.href}, poc=ON, auth=guest, edge=${(import.meta as any)?.env?.VITE_EDGE_GATEWAY_URL || 'not-set'}`)
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
  createRoot(container).render(
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
} else {
  // Lazy-load heavy providers only for non-E2E path to avoid side effects in test mode
  Promise.all([
    import('./App'),
    import('./contexts/AuthContext'),
    import('./contexts/GuestContext'),
    import('./contexts/DecisionContext'),
    import('./contexts/TeamsContext'),
  ]).then(([{ default: App }, { AuthProvider }, { GuestProvider }, { DecisionProvider }, { TeamsProvider }]) => {
    createRoot(container).render(
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
  })
}