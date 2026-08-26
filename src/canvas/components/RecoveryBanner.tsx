/**
 * P0-2: Autosave Recovery Banner
 *
 * Shows once on initial load if autosave is newer than current scenario.
 * Actions: Recover, Dismiss
 * Uses sessionStorage to show only once per session.
 */

import { useState, useEffect } from 'react'
import { AlertCircle, X } from 'lucide-react'
import { loadAutosave, clearAutosave, hasUnsavedWork } from '../store/scenarios'
import { useCanvasStore } from '../store'
import { validateCeeAnalysisReady } from '../utils/ceeAnalysisReadyValidation'
import type { CEEAnalysisReady } from '../../adapters/cee/types'
import { typography } from '../../styles/typography'

const DISMISSED_KEY = 'autosave-recovery-dismissed'

export function RecoveryBanner() {
  const [show, setShow] = useState(false)
  const [autosaveData, setAutosaveData] = useState<ReturnType<typeof loadAutosave>>(null)

  // Check for unsaved work on mount (only if not dismissed this session)
  useEffect(() => {
    // Check sessionStorage for dismissal
    const dismissed = sessionStorage.getItem(DISMISSED_KEY)
    if (dismissed) {
      return
    }

    if (hasUnsavedWork()) {
      const data = loadAutosave()
      if (data && (data.nodes.length > 0 || data.edges.length > 0)) {
        setAutosaveData(data)
        setShow(true)
      }
    }
  }, [])

  const handleRecover = () => {
    if (!autosaveData) return

    const store = useCanvasStore.getState()

    // Load the autosaved graph
    store.reseedIds(autosaveData.nodes, autosaveData.edges)

    // V3: Auto-select goal if not saved or missing
    // Check both type and data.kind for goal detection
    let goalNodeId = autosaveData.selectedGoalNode ?? null
    if (!goalNodeId) {
      const goalNodes = autosaveData.nodes.filter(
        (n: any) => n.type === 'goal' || n.data?.kind === 'goal'
      )
      if (goalNodes.length === 1) {
        goalNodeId = goalNodes[0].id
        if (import.meta.env.DEV) {
          console.warn('[RecoveryBanner] Auto-selected goal node:', goalNodeId)
        }
      }
    }

    // ⛔ THE RESTORE IS GATED, NOT PASSED THROUGH.
    //
    // `validateCeeAnalysisReady` is the one seam that decides whether a
    // persisted readiness verdict may re-enter a session. Its own header names
    // three sources it gates; this component was a FOURTH, and it wrote
    // `autosaveData.ceeAnalysisReady` straight into the store. The sharpest
    // thing that walked through was a BLOCKED REFUSAL: CEE now carries model
    // identity on refusals, so the payload has non-empty options and the old
    // `empty_options` check no longer rejects it by accident — a user would be
    // handed the evidence of a refusal with no account of it, in a session
    // where nothing was refused.
    //
    // ⚠ This component is currently UNMOUNTED (`ReactFlowGraph.tsx:2344`
    // `{/* RecoveryBanner removed */}`); boot auto-recovers instead and routes
    // readiness through `restoreCeeAnalysisReady`, which validates. The gate is
    // here so that REMOUNTING it cannot silently reopen the bypass — the
    // failure mode is a component coming back without its guard, and a comment
    // elsewhere asserting the guard runs is not one.
    //
    // Boundary cast at the call: AutosaveData's inline shape declares
    // `status?: string` where `CEEAnalysisReady` narrows it. Node ids are
    // derived from the recovered graph itself, at parity with
    // `ReactFlowGraph.restoreCeeAnalysisReady`'s `loadSource === 'autosave'`
    // branch, which snapshots `autosave.nodes.map(n => n.id)` the same way.
    const restoredReady = (autosaveData.ceeAnalysisReady ?? null) as CEEAnalysisReady | null
    const readyValidation = validateCeeAnalysisReady(
      restoredReady,
      autosaveData.nodes.map((n) => n.id),
      autosaveData.nodes
    )
    if (!readyValidation.isValid && import.meta.env.DEV) {
      console.warn(
        '[RecoveryBanner] Dropped ceeAnalysisReady on restore:',
        readyValidation.reason
      )
    }

    // ⚠ NOT A USER EDIT — RECOVERING THE USER'S OWN UNSAVED WORK. Without this
    // window `useGuidanceInvalidationOnEdit` reads the restore as the user
    // rebuilding their model from nothing and destroys the coaching that
    // belonged to exactly this recovered graph, on screen and on disk. Raised in
    // the SAME `set()` as the write; a later one arrives too late (MUT-ORDER).
    // Read-then-write rather than the updater form: this is one synchronous
    // click handler with no concurrent writer, and the object literal keeps the
    // precise typing the updater form widened away (the typecheck ratchet caught
    // that, which the named local gate alone would not have).
    const suppressed = useCanvasStore.getState()._externalMutationActive + 1
    useCanvasStore.setState({
      _externalMutationActive: suppressed,
      nodes: autosaveData.nodes,
      edges: autosaveData.edges,
      currentScenarioId: autosaveData.scenarioId || null,
      isDirty: true, // Mark as dirty since recovered work is unsaved
      history: { past: [], future: [] },
      selection: { nodeIds: new Set(), edgeIds: new Set() },
      // V3: Restore analysis_ready and goal selection from autosave — only when
      // the gate above admits it. An invalid verdict CLEARS rather than
      // inheriting: a stale or refused readiness left in place would be read as
      // belonging to the graph the user is being handed back.
      ceeAnalysisReady: readyValidation.isValid ? restoredReady : null,
      selectedGoalNode: goalNodeId,
    })
    useCanvasStore.setState({ _externalMutationActive: Math.max(0, suppressed - 1) })

    // Clear autosave after recovery and mark as dismissed
    clearAutosave()
    sessionStorage.setItem(DISMISSED_KEY, 'true')
    setShow(false)
  }

  const handleDismiss = () => {
    // Mark as dismissed for this session (don't clear autosave)
    sessionStorage.setItem(DISMISSED_KEY, 'true')
    setShow(false)
  }

  if (!show || !autosaveData) return null

  // P0-2: Calculate minutes ago for user-friendly display
  const timeDiff = Date.now() - autosaveData.timestamp
  const minutesAgo = Math.floor(timeDiff / (1000 * 60))
  const hoursAgo = Math.floor(minutesAgo / 60)

  let timeDisplay: string
  if (minutesAgo < 1) {
    timeDisplay = 'just now'
  } else if (minutesAgo < 60) {
    timeDisplay = `${minutesAgo} minute${minutesAgo !== 1 ? 's' : ''} ago`
  } else {
    timeDisplay = `${hoursAgo} hour${hoursAgo !== 1 ? 's' : ''} ago`
  }

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[2000] w-full max-w-2xl px-4"
      data-testid="autosave-recovery-banner"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3 p-4 bg-panel border-2 border-warning rounded-lg shadow-panel">
        <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className={`${typography.label} text-warning-900`}>
            Autosave recovery available
          </p>
          <p className={`${typography.body} text-warning-700 mt-1`}>
            We found a more recent autosave from {timeDisplay}. Would you like to recover it?
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleRecover}
              className={`px-3 py-1.5 ${typography.label} text-text-on-color bg-warning-600 hover:bg-warning-700 rounded-lg transition-colors`}
              data-testid="btn-recover-autosave"
              type="button"
            >
              Recover
            </button>
            <button
              onClick={handleDismiss}
              className={`px-3 py-1.5 ${typography.label} text-warning bg-white hover:bg-warning-light border border-warning/30 rounded-lg transition-colors`}
              data-testid="btn-dismiss-recovery"
              type="button"
            >
              Dismiss
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 text-warning-700 hover:bg-warning-100 rounded transition-colors"
          aria-label="Close recovery banner"
          type="button"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

