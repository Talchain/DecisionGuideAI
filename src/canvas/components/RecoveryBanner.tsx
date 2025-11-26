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
    useCanvasStore.setState({
      nodes: autosaveData.nodes,
      edges: autosaveData.edges,
      currentScenarioId: autosaveData.scenarioId || null,
      isDirty: true, // Mark as dirty since recovered work is unsaved
      history: { past: [], future: [] },
      selection: { nodeIds: new Set(), edgeIds: new Set() }
    })

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
      <div className="flex items-start gap-3 p-4 bg-warning-50 border-2 border-warning-500 rounded-lg shadow-panel">
        <AlertCircle className="w-5 h-5 text-warning-700 flex-shrink-0 mt-0.5" />
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
              className={`px-3 py-1.5 ${typography.label} text-white bg-warning-600 hover:bg-warning-700 rounded-lg transition-colors`}
              data-testid="btn-recover-autosave"
              type="button"
            >
              Recover
            </button>
            <button
              onClick={handleDismiss}
              className={`px-3 py-1.5 ${typography.label} text-warning-700 bg-white hover:bg-warning-100 border border-warning-300 rounded-lg transition-colors`}
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

