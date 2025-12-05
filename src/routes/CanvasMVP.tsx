// src/routes/CanvasMVP.tsx
// Canvas MVP - React Flow graph editor with integrated Templates panel

import '../styles/plot.css'
import { useEffect, useState, lazy, Suspense, useCallback } from 'react'
import ReactFlowGraph, { type BlueprintEventBus, type BlueprintInsertResult } from '../canvas/ReactFlowGraph'
import type { Blueprint } from '../templates/blueprints/types'
import { useCanvasStore } from '../canvas/store'
import { useResultsRun } from '../canvas/hooks/useResultsRun'
import { useDebugShortcut } from '../canvas/hooks/useDebugShortcut'
import { trackCanvasOpened } from '../canvas/utils/sandboxTelemetry'
import { DebugTray } from '../components/DebugTray'
import { TopBar } from '../components/layout/TopBar'
import { getScenario } from '../canvas/store/scenarios'
import { buildShareLink } from '../canvas/utils/shareLink'

const TemplatesPanel = lazy(() => import('../canvas/panels/TemplatesPanel').then(m => ({ default: m.TemplatesPanel })))

interface LocalBlueprintEventBus extends BlueprintEventBus {
  listeners: ((blueprint: Blueprint) => BlueprintInsertResult)[]
  emit: (blueprint: Blueprint) => BlueprintInsertResult
}

// Event bus for blueprint insertion with result support
const blueprintEventBus: LocalBlueprintEventBus = {
  listeners: [] as ((blueprint: Blueprint) => BlueprintInsertResult)[],
  emit(blueprint: Blueprint): BlueprintInsertResult {
    // Call all listeners and collect results
    const results = this.listeners.map(fn => fn(blueprint))
    // Return first result (should only be one listener in practice)
    return results[0] || {}
  },
  subscribe(fn: (blueprint: Blueprint) => BlueprintInsertResult) {
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
  // React #185 FIX: runMeta is an object - use shallow comparison to prevent infinite re-renders
  const correlationIdHeader = useCanvasStore(state => state.runMeta.correlationIdHeader)
  const ceeDebugHeaders = useCanvasStore(state => state.runMeta.ceeDebugHeaders)
  const latestErrorRequestId = useCanvasStore(state => state.results.error?.request_id)

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

  // Scenario + save state for TopBar
  const currentScenarioId = useCanvasStore(state => state.currentScenarioId)
  const framing = useCanvasStore(state => state.currentScenarioFraming)
  const isDirty = useCanvasStore(state => state.isDirty)
  const lastSavedAt = useCanvasStore(state => state.lastSavedAt)
  const saveCurrentScenario = useCanvasStore(state => state.saveCurrentScenario)
  const renameCurrentScenario = useCanvasStore(state => state.renameCurrentScenario)
  const updateScenarioFraming = useCanvasStore(state => state.updateScenarioFraming)

  const scenarioTitle = (() => {
    if (currentScenarioId) {
      const scenario = getScenario(currentScenarioId)
      if (scenario?.name) return scenario.name
    }
    return framing?.title?.trim() || 'Untitled scenario'
  })()

  const lastSaved = lastSavedAt ? new Date(lastSavedAt) : null

  const handleTitleChange = useCallback(
    (title: string) => {
      updateScenarioFraming({ title })
      if (currentScenarioId) {
        renameCurrentScenario(title)
      }
    },
    [currentScenarioId, renameCurrentScenario, updateScenarioFraming],
  )

  const handleSave = useCallback(async () => {
    const name = scenarioTitle || 'Untitled scenario'
    if (currentScenarioId) {
      await saveCurrentScenario()
    } else {
      await saveCurrentScenario(name)
    }
  }, [currentScenarioId, saveCurrentScenario, scenarioTitle])

  const handleShare = useCallback(() => {
    try {
      const { results } = useCanvasStore.getState()
      const hash = results.hash
      if (!hash) {
        // eslint-disable-next-line no-console
        console.warn('[CanvasMVP] Cannot share scenario: no results hash available')
        return
      }
      const link = buildShareLink(hash)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).catch(() => {
          // eslint-disable-next-line no-alert
          window.prompt('Copy this link', link)
        })
      } else {
        // eslint-disable-next-line no-alert
        window.prompt('Copy this link', link)
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[CanvasMVP] Failed to generate share link', error)
    }
  }, [])

  return (
    <div style={{ height: '100vh', width: '100vw', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <TopBar
        scenarioTitle={scenarioTitle}
        onTitleChange={handleTitleChange}
        onSave={handleSave}
        onShare={handleShare}
        isDirty={isDirty}
        lastSaved={lastSaved}
      />

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
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
        <main role="main" data-testid="rf-root" style={{ height: '100%', width: '100%' }}>
          <ReactFlowGraph
            blueprintEventBus={blueprintEventBus}
            onCanvasInteraction={handleCanvasInteraction}
          />
        </main>

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
            requestId={latestErrorRequestId}
            correlationId={correlationIdHeader}
            ceeDebugHeaders={ceeDebugHeaders}
          />
        )}
      </div>
    </div>
  )
}

export { blueprintEventBus }
