// src/routes/CanvasMVP.tsx
// Canvas MVP - React Flow graph editor with integrated Templates panel

import '../styles/plot.css'
import { useEffect, useState, lazy, Suspense, useCallback } from 'react'
import { FileText } from 'lucide-react'
import ReactFlowGraph from '../canvas/ReactFlowGraph'
import type { Blueprint } from '../templates/blueprints/types'

const TemplatesPanel = lazy(() => import('../canvas/panels/TemplatesPanel').then(m => ({ default: m.TemplatesPanel })))

// Event bus for blueprint insertion with result support
const blueprintEventBus = {
  listeners: [] as ((blueprint: Blueprint) => { error?: string })[],
  emit(blueprint: Blueprint): { error?: string } {
    // Call all listeners and collect results
    const results = this.listeners.map(fn => fn(blueprint))
    // Return first result (should only be one listener in practice)
    return results[0] || {}
  },
  subscribe(fn: (blueprint: Blueprint) => { error?: string }) {
    this.listeners.push(fn)
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn)
    }
  }
}

export default function CanvasMVP() {
  const [short, setShort] = useState('dev')
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [insertionError, setInsertionError] = useState<string | null>(null)

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

  const handleInsertBlueprint = useCallback((blueprint: Blueprint) => {
    const result = blueprintEventBus.emit(blueprint)
    if (result.error) {
      // Keep panel open and show error
      setInsertionError(result.error)
    } else {
      // Success: close panel and clear any previous error
      setIsPanelOpen(false)
      setInsertionError(null)
    }
  }, [])

  const handlePinToCanvas = useCallback((data: { template_id: string; seed: number; response_hash: string; likely_value: number }) => {
    // TODO: Create result badge node
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[Canvas] Pin to canvas:', data)
    }
  }, [])

  // Close Templates panel when user interacts with canvas
  const handleCanvasInteraction = useCallback(() => {
    if (isPanelOpen) {
      setIsPanelOpen(false)
    }
  }, [isPanelOpen])

  return (
    <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Badge - fixed top-left */}
      <div
        style={{
          position: 'fixed',
          top: 8,
          left: 8,
          zIndex: 50,
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
        className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
        aria-label="Open templates panel"
      >
        <FileText className="w-5 h-5" />
        <span className="hidden sm:inline">Templates</span>
      </button>

      {/* React Flow Container */}
      <div data-testid="rf-root" style={{ height: '100%', width: '100%' }}>
        <ReactFlowGraph
          blueprintEventBus={blueprintEventBus}
          onCanvasInteraction={handleCanvasInteraction}
        />
      </div>

      {/* Templates Panel */}
      <Suspense fallback={null}>
        <TemplatesPanel
          isOpen={isPanelOpen}
          onClose={() => {
            setIsPanelOpen(false)
            setInsertionError(null) // Clear error when panel closes
          }}
          onInsertBlueprint={handleInsertBlueprint}
          onPinToCanvas={handlePinToCanvas}
          insertionError={insertionError}
        />
      </Suspense>
    </div>
  )
}

export { blueprintEventBus }
