/**
 * Snapshot Panel Component
 *
 * UI for saving, listing, and restoring canvas snapshots.
 * Integrates with ResultsPanel or can be standalone.
 *
 * Features:
 * - Save current canvas state
 * - List snapshots with timestamps
 * - Restore snapshot to canvas
 * - Delete snapshots
 * - Shows max capacity (10 snapshots)
 *
 * Flag: VITE_FEATURE_SNAPSHOTS_V2=0|1 (default OFF)
 */

import { useState } from 'react'
import { useCanvasStore } from '../store'
import {
  saveSnapshot,
  listSnapshots,
  deleteSnapshot,
  restoreSnapshot,
  isAtMaxCapacity,
  type Snapshot,
} from './snapshots'

export interface SnapshotPanelProps {
  enabled?: boolean
}

export function SnapshotPanel({ enabled = false }: SnapshotPanelProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>(listSnapshots())
  const [snapshotName, setSnapshotName] = useState('')
  const [saving, setSaving] = useState(false)

  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const setNodes = useCanvasStore(s => s.setNodes)
  const setEdges = useCanvasStore(s => s.setEdges)
  const pushHistory = useCanvasStore(s => s.pushHistory)
  const results = useCanvasStore(s => s.results)

  if (!enabled) return null

  const handleSave = () => {
    if (!snapshotName.trim()) {
      alert('Please enter a snapshot name')
      return
    }

    setSaving(true)
    try {
      saveSnapshot(snapshotName, nodes, edges, {
        seed: results.seed,
        hash: results.hash,
      })

      setSnapshots(listSnapshots())
      setSnapshotName('')

      if (isAtMaxCapacity()) {
        alert('Snapshot saved! Note: You\'re at max capacity (10). Oldest will be rotated out.')
      }
    } catch (err) {
      alert('Failed to save snapshot')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleRestore = (id: string) => {
    const confirmed = confirm('Restore this snapshot? Current canvas will be replaced.')
    if (!confirmed) return

    const restored = restoreSnapshot(id)
    if (!restored) {
      alert('Failed to restore snapshot')
      return
    }

    // Update canvas
    setNodes(restored.nodes)
    setEdges(restored.edges)
    pushHistory()
  }

  const handleDelete = (id: string) => {
    const confirmed = confirm('Delete this snapshot?')
    if (!confirmed) return

    deleteSnapshot(id)
    setSnapshots(listSnapshots())
  }

  return (
    <div className="border-t border-gray-200 p-4 bg-gray-50">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Snapshots <span className="text-xs text-gray-500">({snapshots.length}/10)</span>
      </h3>

      {/* Save new snapshot */}
      <div className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={snapshotName}
            onChange={e => setSnapshotName(e.target.value)}
            placeholder="Snapshot name..."
            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
            maxLength={50}
          />
          <button
            onClick={handleSave}
            disabled={saving || !snapshotName.trim()}
            className="px-3 py-1 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
        {isAtMaxCapacity() && (
          <p className="text-xs text-amber-600 mt-1">
            At max capacity. Oldest snapshot will be rotated out.
          </p>
        )}
      </div>

      {/* Snapshot list */}
      {snapshots.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No snapshots yet</p>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {snapshots.map(snapshot => (
            <div
              key={snapshot.meta.id}
              className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded text-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">
                  {snapshot.meta.name}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(snapshot.meta.created_at).toLocaleString()}
                  {snapshot.meta.seed && ` • Seed: ${snapshot.meta.seed}`}
                </div>
              </div>
              <div className="flex gap-1 ml-2">
                <button
                  onClick={() => handleRestore(snapshot.meta.id)}
                  className="px-2 py-1 text-xs font-medium bg-green-50 text-green-700 rounded hover:bg-green-100"
                  title="Restore this snapshot"
                >
                  Restore
                </button>
                <button
                  onClick={() => handleDelete(snapshot.meta.id)}
                  className="px-2 py-1 text-xs font-medium bg-red-50 text-red-700 rounded hover:bg-red-100"
                  title="Delete this snapshot"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
