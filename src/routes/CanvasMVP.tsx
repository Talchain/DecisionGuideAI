// src/routes/CanvasMVP.tsx
// Canvas MVP - React Flow graph editor with integrated Templates panel

import '../styles/plot.css'
import { useEffect, useState, lazy, Suspense, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import ReactFlowGraph from '../canvas/ReactFlowGraph'
import type { Blueprint } from '../templates/blueprints/types'
import { blueprintEventBus } from '../canvas/blueprints/eventBus'
import { useCanvasStore } from '../canvas/store'
import { useResultsRun } from '../canvas/hooks/useResultsRun'
import { useDebugShortcut } from '../canvas/hooks/useDebugShortcut'
import { trackCanvasOpened } from '../canvas/utils/sandboxTelemetry'
import { DebugTray } from '../components/DebugTray'
import { TopBar } from '../components/layout/TopBar'
import { getScenario } from '../canvas/store/scenarios'
import { buildShareLink } from '../canvas/utils/shareLink'
import { useScenario } from '../hooks/useScenario'

const TemplatesPanel = lazy(() => import('../canvas/panels/TemplatesPanel').then(m => ({ default: m.TemplatesPanel })))

export default function CanvasMVP() {
  // Brief 37 Task 3: Render counter to detect if parent is causing re-renders
  const renderCountRef = useRef(0)
  renderCountRef.current++
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console, no-restricted-syntax
    console.log(`[CanvasMVP] Render #${renderCountRef.current}`)
  }

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

  // C.1a: Supabase scenario persistence
  const { id: scenarioIdFromRoute } = useParams<{ id: string }>()
  const {
    loadScenario: loadSupabaseScenario,
    saveStatus: supabaseSaveStatus,
    lastSavedAt: supabaseLastSaved,
    saveError: supabaseSaveError,
    isPersistenceActive,
    createSharedBrief,
  } = useScenario()

  // C.1a: Hydrate from Supabase when navigating to /scenario/:id
  const hydratedRef = useRef<string | null>(null)
  useEffect(() => {
    if (scenarioIdFromRoute && isPersistenceActive && hydratedRef.current !== scenarioIdFromRoute) {
      hydratedRef.current = scenarioIdFromRoute
      loadSupabaseScenario(scenarioIdFromRoute).catch((err) => {
        if (import.meta.env.DEV) {
          console.error('[CanvasMVP] Failed to load scenario from Supabase:', err)
        }
      })
    }
  }, [scenarioIdFromRoute, isPersistenceActive, loadSupabaseScenario])

  // Track canvas opened event
  useEffect(() => {
    trackCanvasOpened()

    // Dev-only console log
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console, no-restricted-syntax
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
        // eslint-disable-next-line no-console, no-restricted-syntax
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
        // eslint-disable-next-line no-console, no-restricted-syntax
        console.log('[CanvasMVP] Auto-run started for template:', blueprint.name)
      }
    }
  }, [closeTemplatesPanel, run])

  const handlePinToCanvas = useCallback((data: { template_id: string; seed: number; response_hash: string; likely_value: number }) => {
    // TODO: Create result badge node
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console, no-restricted-syntax
      console.log('[Canvas] Pin to canvas:', data)
    }
  }, [])

  // Close Templates panel when user interacts with canvas
  // Brief 37: Use ref to avoid dependency on showTemplatesPanel, keeping callback stable
  const showTemplatesPanelRef = useRef(showTemplatesPanel)
  showTemplatesPanelRef.current = showTemplatesPanel

  const handleCanvasInteraction = useCallback(() => {
    if (showTemplatesPanelRef.current) {
      closeTemplatesPanel()
    }
  }, [closeTemplatesPanel])

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
    return framing?.title?.trim() || 'Untitled decision'
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
    const name = scenarioTitle || 'Untitled decision'
    if (currentScenarioId) {
      await saveCurrentScenario()
    } else {
      await saveCurrentScenario(name)
    }
  }, [currentScenarioId, saveCurrentScenario, scenarioTitle])

  const handleShare = useCallback(async () => {
    try {
      // C.1b: If Supabase persistence is active, create a shared brief via RPC
      if (isPersistenceActive) {
        const result = await createSharedBrief()
        if (result) {
          const url = `${window.location.origin}/#/brief/${result.slug}`
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(url).catch(() => {
              // eslint-disable-next-line no-alert
              window.prompt('Copy this link', url)
            })
          } else {
            // eslint-disable-next-line no-alert
            window.prompt('Copy this link', url)
          }
          return
        }
        // If createSharedBrief returned null (no scenarioId), fall through to local share
      }

      // Local share fallback (guest mode)
      const { results } = useCanvasStore.getState()
      const hash = results.hash
      if (!hash) {
        console.warn('[CanvasMVP] Cannot share scenario: no results hash available')
        return
      }
      const link = buildShareLink(hash)
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(link).catch(() => {
          // eslint-disable-next-line no-alert
          window.prompt('Copy this link', link)
        })
      } else {
        // eslint-disable-next-line no-alert
        window.prompt('Copy this link', link)
      }
    } catch (error) {
      console.error('[CanvasMVP] Failed to generate share link', error)
      // User-friendly: if brief creation fails, show a message
      // eslint-disable-next-line no-alert
      window.alert('Generate a decision brief first before sharing.')
    }
  }, [isPersistenceActive, createSharedBrief])

  return (
    <div style={{ height: '100vh', width: '100vw', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <TopBar
        scenarioTitle={scenarioTitle}
        onTitleChange={handleTitleChange}
        onSave={handleSave}
        onShare={handleShare}
        isDirty={isDirty}
        saveStatus={isPersistenceActive ? supabaseSaveStatus : undefined}
        saveError={isPersistenceActive ? supabaseSaveError : undefined}
        isPersisted={isPersistenceActive}
      />

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
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
