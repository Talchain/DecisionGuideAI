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

const __e2e = isE2EEnabled()
const isPoc = (import.meta as any)?.env?.VITE_POC_ONLY === '1'

if (__e2e) {
  // E2E mode: minimal surface for testing
  const { default: SandboxStreamPanel } = await import('./components/SandboxStreamPanel')
  const { default: EngineAuditPanel } = await import('./components/EngineAuditPanel')
  
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
  logAcceptance()
} else if (isPoc) {
  // PoC-only mode: render PoC shell with NO auth imports
  const { default: PoCShell } = await import('./lib/PoCShell')
  const root = createRoot(container)
  root.render(
    <StrictMode>
      <PoCShell />
    </StrictMode>
  )
} else {
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
}