// src/routes/CanvasMVP.tsx
// Canvas MVP - React Flow graph editor with integrated Templates panel

import '../styles/plot.css'
import { useEffect, useState, lazy, Suspense } from 'react'
import { FileText } from 'lucide-react'
import ReactFlowGraph from '../canvas/ReactFlowGraph'

const TemplatesPanel = lazy(() => import('../canvas/panels/TemplatesPanel').then(m => ({ default: m.TemplatesPanel })))

export default function CanvasMVP() {
  const [short, setShort] = useState('dev')
  const [isPanelOpen, setIsPanelOpen] = useState(false)

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
      console.log('[CANVAS]', { route: '/canvas', mode: 'RF+Templates' })
    }
  }, [])

  const handlePinToCanvas = (data: { template_id: string; seed: number; response_hash: string; likely_value: number }) => {
    // TODO: Implement pinning summary node to canvas
    console.log('[Canvas] Pin to canvas:', data)
  }

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

      {/* Templates Button - fixed top-right */}
      <button
        onClick={() => setIsPanelOpen(true)}
        className="fixed top-4 right-4 z-[2147483646] flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
        aria-label="Open templates panel"
      >
        <FileText className="w-5 h-5" />
        <span className="hidden sm:inline">Templates</span>
      </button>

      {/* React Flow Container */}
      <div data-testid="rf-root" style={{ height: '100%', width: '100%' }}>
        <ReactFlowGraph />
      </div>

      {/* Templates Panel */}
      <Suspense fallback={null}>
        <TemplatesPanel 
          isOpen={isPanelOpen} 
          onClose={() => setIsPanelOpen(false)}
          onPinToCanvas={handlePinToCanvas}
        />
      </Suspense>
    </div>
  )
}
