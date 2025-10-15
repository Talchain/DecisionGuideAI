// src/routes/CanvasMVP.tsx
// Canvas MVP - React Flow graph editor on dedicated route

import '../styles/plot.css'
import { useEffect, useState } from 'react'
import ReactFlowGraph from '../canvas/ReactFlowGraph'

export default function CanvasMVP() {
  const [short, setShort] = useState('dev')

  // Fetch version from /version.json (runtime)
  useEffect(() => {
    fetch('/version.json')
      .then(r => r.json())
      .then(v => {
        if (v?.short) setShort(v.short)
      })
      .catch(() => {
        // Fallback to env var for local dev
        const envShort = import.meta.env?.VITE_GIT_SHORT
        if (envShort) setShort(envShort)
      })

    // Dev-only console log
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[CANVAS]', { route: '/canvas', mode: 'RF' })
    }
  }, [])

  return (
    <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Badge - fixed top-left */}
      <div 
        style={{
          position: 'fixed',
          top: 8,
          left: 8,
          zIndex: 2147483647,
          padding: '6px 8px',
          background: '#111',
          color: '#0ff',
          fontFamily: 'monospace',
          fontSize: 12,
          borderRadius: 6,
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
        }}
        data-testid="build-badge"
      >
        ROUTE=/canvas • COMMIT={short} • MODE=RF
      </div>

      {/* React Flow Container */}
      <div data-testid="rf-root" style={{ height: '100%', width: '100%' }}>
        <ReactFlowGraph />
      </div>
    </div>
  )
}
