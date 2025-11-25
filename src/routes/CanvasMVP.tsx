// src/routes/CanvasMVP.tsx
// Canvas MVP - React Flow graph editor with integrated Templates panel

import '../styles/plot.css'
import { useEffect, useState, lazy, Suspense, useCallback } from 'react'
import ReactFlowGraph from '../canvas/ReactFlowGraph'
import type { Blueprint } from '../templates/blueprints/types'
import { useCanvasStore } from '../canvas/store'
import { useResultsRun } from '../canvas/hooks/useResultsRun'
import { useDebugShortcut } from '../canvas/hooks/useDebugShortcut'
import { trackCanvasOpened } from '../canvas/utils/sandboxTelemetry'
import { DebugTray } from '../components/DebugTray'

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
  const [insertionError, setInsertionError] = useState<string | null>(null)
  const showTemplatesPanel = useCanvasStore(state => state.showTemplatesPanel)
  const closeTemplatesPanel = useCanvasStore(state => state.closeTemplatesPanel)
  const runMeta = useCanvasStore(state => state.runMeta)

  // Phase 1A.5: Debug controls visibility (Shift+D shortcut)
  const { showDebug } = useDebugShortcut()

  // v1.2: Auto-run analysis after template insertion
  const { run } = useResultsRun()

  // Fetch version from /version.json (runtime)
  useEffect(() => {
    trackCanvasOpened()
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

  const handleInsertBlueprint = useCallback(async (blueprint: Blueprint) => {
    const result = blueprintEventBus.emit(blueprint)
    if (result.error) {
      // Keep Templates panel open and show error
      setInsertionError(result.error)
    } else {
      // Success: close Templates panel, show docked Results view, clear error
      closeTemplatesPanel()
      useCanvasStore.getState().setShowResultsPanel(true)
      setInsertionError(null)

      if (import.meta.env.DEV) {
        console.log('[CanvasMVP] Template inserted:', blueprint.name)
      }

      // v1.2: Auto-run analysis after successful template insertion
      // Get current graph state (after insertion)
      const currentNodes = useCanvasStore.getState().nodes
      const currentEdges = useCanvasStore.getState().edges
      const currentOutcome = useCanvasStore.getState().outcomeNodeId

      // Construct graph for PLoT adapter
      const graph = {
        nodes: currentNodes.map(n => ({
          id: n.id,
          label: n.data.label || n.id,
          kind: n.type || 'decision',
          probability: n.data.probability
        })),
        edges: currentEdges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          weight: e.data?.weight ?? 1.0,
          belief: e.data?.belief
        }))
      }

      // Trigger analysis
      await run({
        template_id: blueprint.id,
        seed: 1337,
        graph,
        outcome_node: currentOutcome || undefined
      })

      if (import.meta.env.DEV) {
        console.log('[CanvasMVP] Auto-run started for template:', blueprint.name)
      }
    }
  }, [closeTemplatesPanel, run])

  const handlePinToCanvas = useCallback((data: { template_id: string; seed: number; response_hash: string; likely_value: number }) => {
    // TODO: Create result badge node
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[Canvas] Pin to canvas:', data)
    }
  }, [])

  // Close Templates panel when user interacts with canvas
  const handleCanvasInteraction = useCallback(() => {
    if (showTemplatesPanel) {
      closeTemplatesPanel()
    }
  }, [showTemplatesPanel, closeTemplatesPanel])

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
          isOpen={showTemplatesPanel}
          onClose={() => {
            closeTemplatesPanel()
            setInsertionError(null) // Clear error when panel closes
          }}
          onInsertBlueprint={handleInsertBlueprint}
          onPinToCanvas={handlePinToCanvas}
          insertionError={insertionError}
        />
      </Suspense>

      {/* Phase 1A.5: Debug Tray (hidden by default, Shift+D to toggle) */}
      {showDebug && (
        <DebugTray
          correlationId={runMeta?.correlationIdHeader}
          ceeDebugHeaders={runMeta?.ceeDebugHeaders}
        />
      )}
    </div>
  )
}

export { blueprintEventBus }
