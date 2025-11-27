import { useState, useEffect } from 'react'
import { listSnapshots, loadSnapshot, deleteSnapshot, saveSnapshot } from '../persist'
import { useCanvasStore } from '../store'
import { useToast } from '../ToastContext'
import { BottomSheet } from './BottomSheet'
import { typography } from '../../styles/typography'

interface SnapshotManagerProps {
  isOpen: boolean
  onClose: () => void
}

interface SnapshotItem {
  key: string
  name: string
  timestamp: number
  nodeCount: number
  edgeCount: number
  size: number
}

export function SnapshotManager({ isOpen, onClose }: SnapshotManagerProps) {
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([])
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  // Performance: Use granular selectors to prevent unnecessary re-renders
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const { showToast } = useToast()

  const refreshSnapshots = () => {
    const rawSnapshots = listSnapshots()
    const items = rawSnapshots.map(s => {
      const data = loadSnapshot(s.key)
      const storedName = localStorage.getItem(`${s.key}-name`) || 'Untitled Snapshot'
      return {
        key: s.key,
        name: storedName,
        timestamp: s.timestamp,
        nodeCount: data?.nodes.length || 0,
        edgeCount: data?.edges.length || 0,
        size: s.size
      }
    })
    setSnapshots(items)
  }

  useEffect(() => {
    if (isOpen) {
      refreshSnapshots()
    }
  }, [isOpen])

  const handleSave = () => {
    const currentSize = JSON.stringify({ nodes, edges }).length
    
    if (currentSize > 5 * 1024 * 1024) {
      showToast('Canvas too large (>5MB). Please export to file instead.', 'error')
      return
    }

    const success = saveSnapshot({ nodes, edges })
    if (success) {
      refreshSnapshots()
    } else {
      showToast('Failed to save snapshot. Storage quota may be exceeded.', 'error')
    }
  }

  const handleRestore = (key: string) => {
    const data = loadSnapshot(key)
    if (data) {
      const importCanvas = useCanvasStore.getState().importCanvas
      const json = JSON.stringify(data)
      importCanvas(json)
      onClose()
    }
  }

  const handleDelete = (key: string) => {
    if (confirm('Delete this snapshot?')) {
      deleteSnapshot(key)
      localStorage.removeItem(`${key}-name`)
      refreshSnapshots()
    }
  }

  const handleRename = (key: string) => {
    setEditingKey(key)
    const current = snapshots.find(s => s.key === key)
    setEditName(current?.name || '')
  }

  const handleRenameCommit = (key: string) => {
    const trimmed = editName.trim()
    if (trimmed) {
      localStorage.setItem(`${key}-name`, trimmed.slice(0, 50))
      refreshSnapshots()
    }
    setEditingKey(null)
  }

  const handleRenameCancel = () => {
    setEditingKey(null)
    setEditName('')
  }

  const handleCopyJSON = (key: string) => {
    const data = loadSnapshot(key)
    if (data) {
      const json = JSON.stringify(data, null, 2)
      navigator.clipboard.writeText(json).then(() => {
        showToast('JSON copied to clipboard', 'success')
      })
    }
  }

  const handleDownloadJSON = (key: string) => {
    const data = loadSnapshot(key)
    if (data) {
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `canvas-snapshot-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Snapshot Manager">
      <div className="space-y-4">
          {/* Save New */}
          <div className="mb-6">
            <button
              onClick={handleSave}
              className="w-full px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium"
            >
              💾 Save Current Canvas
            </button>
            <p className={`${typography.caption} text-gray-500 mt-2`}>
              {snapshots.length}/10 snapshots • Auto-rotates oldest
            </p>
          </div>

          {/* Snapshot List */}
            {snapshots.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p>No snapshots yet</p>
              <p className={`${typography.body} mt-2`}>Save your current canvas to create a snapshot</p>
            </div>
          ) : (
            <div className="space-y-3">
              {snapshots.map((snapshot) => (
                <div
                  key={snapshot.key}
                  className="border border-gray-200 rounded-lg p-4 hover:border-primary transition-colors"
                >
                  {/* Name */}
                  {editingKey === snapshot.key ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleRenameCommit(snapshot.key)
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          handleRenameCancel()
                        }
                      }}
                      onBlur={handleRenameCancel}
                      maxLength={50}
                      autoFocus
                      className="font-medium text-gray-900 w-full border border-primary rounded px-2 py-1 outline-none"
                    />
                  ) : (
                    <h3 className="font-medium text-gray-900">{snapshot.name}</h3>
                  )}

                  {/* Metadata */}
                  <div className={`${typography.body} text-gray-500 mt-1 flex items-center gap-3`}>
                    <span>{formatDate(snapshot.timestamp)}</span>
                    <span>•</span>
                    <span>{snapshot.nodeCount} nodes, {snapshot.edgeCount} edges</span>
                    <span>•</span>
                    <span>{formatSize(snapshot.size)}</span>
                  </div>

                  {/* Actions */}
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => handleRestore(snapshot.key)}
                      className={`px-3 py-1.5 ${typography.body} bg-primary text-white rounded hover:bg-primary-hover transition-colors`}
                    >
                      Restore
                    </button>
                    <button
                      onClick={() => handleRename(snapshot.key)}
                      className={`px-3 py-1.5 ${typography.body} bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors`}
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => handleCopyJSON(snapshot.key)}
                      className={`px-3 py-1.5 ${typography.body} bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors`}
                    >
                      Copy JSON
                    </button>
                    <button
                      onClick={() => handleDownloadJSON(snapshot.key)}
                      className={`px-3 py-1.5 ${typography.body} bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors`}
                    >
                      Download
                    </button>
                    <button
                      onClick={() => handleDelete(snapshot.key)}
                      className={`ml-auto px-3 py-1.5 ${typography.body} bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors`}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </BottomSheet>
  )
}
