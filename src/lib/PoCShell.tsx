// src/lib/PoCShell.tsx
// PoC shell: immediate visible UI + lazy-loaded sandbox with error boundary

import React, { Suspense, useEffect } from 'react'
import ErrorBoundary from './ErrorBoundary'
import { BUILD_ID, logAcceptance } from './Build'

const Sandbox = React.lazy(() => import('../components/SandboxStreamPanel'))

export default function PoCShell() {
  useEffect(() => {
    logAcceptance()
  }, [])

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          background: '#0b5',
          color: '#fff',
          padding: '6px 10px',
          zIndex: 99999,
          fontSize: '14px',
        }}
      >
        PoC shell mounted · build: {BUILD_ID}
      </div>
      <div style={{ marginTop: 36 }}>
        <ErrorBoundary>
          <Suspense
            fallback={
              <div style={{ padding: 16, fontSize: 14, color: '#666' }}>
                Loading sandbox…
              </div>
            }
          >
            <Sandbox />
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  )
}
