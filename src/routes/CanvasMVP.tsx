// src/routes/CanvasMVP.tsx
// Canvas MVP - React Flow graph editor with integrated Templates panel

import '../styles/plot.css'
import { useEffect, useState, lazy, Suspense, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import ReactFlowGraph from '../canvas/ReactFlowGraph'
import type { Blueprint } from '../templates/blueprints/types'
import { blueprintEventBus } from '../canvas/blueprints/eventBus'
import { ToastProvider } from '../canvas/ToastContext'
import { useCanvasStore } from '../canvas/store'
import { setPersistenceSessionActive } from '../lib/persistenceSession'
import { useDebugShortcut } from '../canvas/hooks/useDebugShortcut'
import { trackCanvasOpened } from '../canvas/utils/sandboxTelemetry'
import { DebugTray } from '../components/DebugTray'
import { TopBar } from '../components/layout/TopBar'
import { getScenario } from '../canvas/store/scenarios'
import { useScenario } from '../hooks/useScenario'
import { useServerGraphHydration } from '../canvas/hooks/useServerGraphHydration'
import { useModelEditCanonicalConfirm } from '../canvas/hooks/useModelEditCanonicalConfirm'
import { ServerGraphRetryNotice } from '../canvas/components/ServerGraphRetryNotice'
// ROADMAP 2.1271 — deliver the auto-run's provisional analysis without another
// turn. Mounted HERE, beside boot hydration, deliberately: the trigger is the
// draft turn's own `running` verdict in the store, so the hook needs no
// conversation context, and keeping it out of `useConversation` decouples a
// server-driven delivery from the message loop entirely.
import { useProvisionalAnalysisDelivery } from '../canvas/hooks/useProvisionalAnalysisDelivery'
import { useImportRegistration } from '../canvas/registration/useImportRegistration'
import { CANONICAL_EDIT_AUTHORITY, hasServerGraphAuthority } from '../canvas/mutations/mutationAuthority'

const TEMPLATE_GRAPH_MUTATIONS_CONNECTED = hasServerGraphAuthority(
  CANONICAL_EDIT_AUTHORITY.canvasSemanticMutations,
)

const TemplatesPanel = lazy(() => import('../canvas/panels/TemplatesPanel').then(m => ({ default: m.TemplatesPanel })))
const VersionsPanelHost = lazy(() => import('../canvas/versions/VersionsPanelHost').then(m => ({ default: m.VersionsPanelHost })))

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

  // ⭐ THE SINGLE WRITER of `lib/persistenceSession`.
  //
  // `useConversation` needs this predicate to refuse minting a fresh scenario
  // UUID for a signed-in user (which CEE then legitimately creates, handing the
  // tester a phantom second decision). It cannot call `useAuth()` itself — ~150
  // specs render that hook without an AuthProvider. So the value is derived
  // HERE, from the canonical `lib/persistenceActive` predicate `useScenario`
  // already computed, and published from exactly one place. If a second writer
  // ever appears, that is the drift (trap 12).
  useEffect(() => {
    setPersistenceSessionActive(isPersistenceActive)
  }, [isPersistenceActive])

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

  // ROADMAP 2.312 piece 3: merge the SERVER's copy of this scenario's graph
  // over the locally-restored canvas — values from CEE, layout from local.
  //
  // ⚠ NOT gated on `isPersistenceActive`. That flag is false for every guest
  // session by construction (`lib/persistenceActive.ts`), and guest is the tier
  // that ships — gating on it would leave this doing nothing for every real
  // user. It does not apply here in any case: that flag governs the UI's own
  // Supabase writes, whereas this read goes through CEE, which holds the
  // service credential the browser deliberately does not have.
  useServerGraphHydration(scenarioIdFromRoute)
  // ⭐ THE EDIT'S OWN COLD READ. Boot hydration fires once per scenario, BEFORE
  // any edit exists, so without this a committed edit has no success path at
  // all and the panel would show a permanent in-flight state on every
  // successful edit. Demand-driven and bounded — costs nothing when no attempt
  // is outstanding. See the hook header for what else was considered.
  useModelEditCanonicalConfirm(scenarioIdFromRoute)
  // Inert until CEE reports a provisional run in flight for this scenario.
  useProvisionalAnalysisDelivery(scenarioIdFromRoute)

  // ROADMAP 2.467: register a locally-imported graph with CEE so the analysis
  // describes the model on screen. Mounted BESIDE the hydration hook on
  // purpose — the two are the same seam read in both directions, and the
  // hydration merge refuses while this one still has the hold armed.
  useImportRegistration()

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

      // ⚠ AUTO-RUN RETIRED. Inserting a template used to fire an UNGATED
      // browser→PLoT `/v1/run` immediately — a legacy direct-analysis caller that
      // spent an analysis the user had not asked for, on a graph they had not yet
      // seen. Canonical analysis is UI→CEE→PLoT→ISL, reached from the Run
      // affordance the user drives; template insertion now only inserts.
      //
      // Do not reintroduce an auto-run here. If insertion should trigger analysis,
      // that decision belongs to CEE (the rowed CEE-side auto-analysis direction),
      // so the run carries the assistant's context rather than bypassing it.
    }
  }, [closeTemplatesPanel])

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
    return framing?.title?.trim() || 'Untitled model'
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
    const name = scenarioTitle || 'Untitled model'
    if (currentScenarioId) {
      await saveCurrentScenario()
    } else {
      await saveCurrentScenario(name)
    }
  }, [currentScenarioId, saveCurrentScenario, scenarioTitle])

  /**
   * ⭐ 29 Aug 2026 — THE LOCAL-DEVICE FALLBACK IS GONE.
   *
   * This handler used to have three outcomes and only one of them was true:
   *
   *   1. persisted  → `createSharedBrief()` mints a row and returns a slug
   *                   served by `/brief/:slug`. REAL. Kept.
   *   2. guest      → `buildShareLink(hash)` → `#/canvas?run=<hash>`, which
   *                   resolves only against the SENDER's device history
   *                   (`shareLink.ts`: "local-device only"). The clipboard
   *                   write succeeded, so it looked like a share — and the
   *                   recipient opened an EMPTY canvas. The failure landed on
   *                   a second person who had no way to understand it.
   *   3. no results → `console.warn` and return. A silently dead click.
   *
   * (2) and (3) are removed rather than reworded: there is no link that can
   * carry a guest canvas to another machine, so there was nothing honest to
   * say. The button itself is now gated on the persisted case in `TopBar`
   * (`shareScenarioId`), so (3) is unreachable from the UI; the guard below is
   * the belt-and-braces for any other caller.
   */
  const handleShare = useCallback(async () => {
    if (!isPersistenceActive || !currentScenarioId) {
      // Not reachable from the bar (the control is hidden), so this is a
      // programming error rather than a user-facing state — say so loudly in
      // the console and do nothing, rather than inventing a link.
      console.warn('[CanvasMVP] Share invoked without a persisted scenario — no link exists to copy')
      return
    }
    try {
      const result = await createSharedBrief()
      if (!result) {
        // eslint-disable-next-line no-alert
        window.alert("We couldn't create a share link for this decision. Please try again shortly.")
        return
      }
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
    } catch (error) {
      console.error('[CanvasMVP] Failed to generate share link', error)
      // eslint-disable-next-line no-alert
      window.alert("We couldn't create a share link for this decision. Please try again shortly.")
    }
  }, [isPersistenceActive, currentScenarioId, createSharedBrief])

  return (
    // ToastProvider at route level so surfaces OUTSIDE ReactFlowGraph
    // (TemplatesPanel above all) share the one toast system. RFG keeps its
    // own inner provider — nested providers simply scope to their subtree,
    // so RFG-originated toasts render exactly as before.
    <ToastProvider>
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
        // COLLAB: the blind-panel entry needs a PERSISTED scenario — CEE's
        // mint refuses guest scenarios (no immutable model version to pin),
        // and the owner route sits behind AuthGuard.
        panelScenarioId={isPersistenceActive && currentScenarioId ? currentScenarioId : null}
        // SHARE: same condition — a shared brief needs a persisted scenario to
        // point at. Guest/unsaved hides the control rather than copying a link
        // that opens empty on the recipient's machine.
        shareScenarioId={isPersistenceActive && currentScenarioId ? currentScenarioId : null}
      />

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* React Flow Container */}
        <main role="main" data-testid="rf-root" style={{ height: '100%', width: '100%' }}>
          <ReactFlowGraph
            blueprintEventBus={blueprintEventBus}
            onCanvasInteraction={handleCanvasInteraction}
            /* ⭐ THE ONLY MOUNT THAT MAY OFFER STARTERS. This route is the
               primary canvas and the one surface with a real first-run
               journey: an empty graph, the welcome hero, and a teammate who
               has never seen the product. PlotWorkspace, CanvasIsolationTest
               and the sandbox canvas deliberately say nothing here and get no
               strip by default — pinned by
               canvas/components/__tests__/starterStripMountPath.spec.ts. */
            showStarters
          />
        </main>

        {/*
          The boot re-ask's honest interim state. Mounted at the ROUTE, beside
          the hook that drives it, and NOT inside the first-use hero: the hero
          mounts only under `isAiPanelV2Enabled()`, and binding a notice to a
          surface the deployed flags can switch off is how row 2.466's badge
          shipped dark twice (CLAUDE.md trap 3b). Self-gating and prop-less —
          it renders only while a re-ask is live or exhausted, only for the
          scenario on screen, and only while the canvas is empty.
        */}
        <ServerGraphRetryNotice />

        {/* Templates Panel */}
        <Suspense fallback={null}>
          <TemplatesPanel
            isOpen={TEMPLATE_GRAPH_MUTATIONS_CONNECTED && showTemplatesPanel}
            onClose={() => {
              closeTemplatesPanel()
              setInsertionError(null) // Clear error when panel closes
            }}
            onInsertBlueprint={handleInsertBlueprint}
            insertionError={insertionError}
          />
        </Suspense>

        {/* Versioned workspace: the version-history PANEL only.
            R4 (Paul, 16 Aug 2026): the floating "Versions" pill that used to
            render here is retired — the trigger now lives in the TopBar above
            (and, for the cockpit lane, in the analysis panel header). Both
            triggers and this panel share `versionsPanelStore`, so this mount
            stays the feature's entire integration surface on the route and
            still touches no canvas store. */}
        <Suspense fallback={null}>
          <VersionsPanelHost />
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
    </ToastProvider>
  )
}
