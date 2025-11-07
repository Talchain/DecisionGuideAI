/**
 * RecoveryBanner - Offers to recover unsaved work from previous session
 *
 * Shows on mount if hasUnsavedWork() returns true.
 * Actions: Recover, Discard
 */

import { useState, useEffect } from 'react'
import { AlertCircle, X } from 'lucide-react'
import { loadAutosave, clearAutosave, hasUnsavedWork } from '../store/scenarios'
import { useCanvasStore } from '../store'

export function RecoveryBanner() {
  const [show, setShow] = useState(false)
  const [autosaveData, setAutosaveData] = useState<ReturnType<typeof loadAutosave>>(null)

  // Check for unsaved work on mount
  useEffect(() => {
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

    // Clear autosave after recovery
    clearAutosave()
    setShow(false)
  }

  const handleDiscard = () => {
    clearAutosave()
    setShow(false)
  }

  if (!show || !autosaveData) return null

  const formattedTime = formatTimestamp(autosaveData.timestamp)
  const nodeCount = autosaveData.nodes.length
  const edgeCount = autosaveData.edges.length

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[2000] max-w-xl w-full mx-4"
      role="alert"
      aria-live="polite"
    >
      <div className="bg-warning-50 border-l-4 border-warning-500 rounded-lg shadow-lg overflow-hidden">
        <div className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-warning-900 mb-1">
                Recover unsaved work?
              </h3>
              <p className="text-sm text-warning-800 mb-3">
                Found autosaved graph from {formattedTime} ({nodeCount} node{nodeCount !== 1 ? 's' : ''}, {edgeCount} edge{edgeCount !== 1 ? 's' : ''})
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleRecover}
                  className="px-4 py-2 text-sm font-medium text-white bg-warning-600 hover:bg-warning-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-warning-500 focus:ring-offset-2"
                  type="button"
                >
                  Recover
                </button>
                <button
                  onClick={handleDiscard}
                  className="px-4 py-2 text-sm font-medium text-warning-700 bg-warning-100 hover:bg-warning-200 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-warning-500 focus:ring-offset-2"
                  type="button"
                >
                  Discard
                </button>
              </div>
            </div>
            <button
              onClick={handleDiscard}
              className="text-warning-600 hover:text-warning-800 transition-colors flex-shrink-0"
              type="button"
              aria-label="Close recovery banner"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Format timestamp as relative time
 */
function formatTimestamp(ts: number): string {
  const now = Date.now()
  const diff = now - ts
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}
