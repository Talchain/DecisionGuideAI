/**
 * ProbabilityModal - Batch editor for outgoing edge probabilities
 *
 * Features:
 * - Lock/Unlock individual rows
 * - Equalize remaining % across unlocked rows
 * - Real-time validation with visual feedback
 * - Batch update (single undo/redo step)
 * - Keyboard support (Tab, Enter, Esc)
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Lock, Unlock, AlertTriangle } from 'lucide-react'
import { useCanvasStore } from '../store'
import type { Edge } from 'reactflow'
import type { EdgeData } from '../domain/edges'
import styles from './ProbabilityModal.module.css'

interface ModalRow {
  edgeId: string
  targetNodeId: string
  targetLabel: string
  percent: number  // 0-100
  locked: boolean  // ephemeral UI state
}

interface ProbabilityModalProps {
  nodeId: string
  onClose: () => void
}

export function ProbabilityModal({ nodeId, onClose }: ProbabilityModalProps) {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const updateEdge = useCanvasStore(s => s.updateEdge)
  const pushHistory = useCanvasStore(s => s.pushHistory)

  const node = nodes.find(n => n.id === nodeId)
  const outgoingEdges = useMemo(
    () => edges.filter(e => e.source === nodeId),
    [edges, nodeId]
  )

  // Initialize modal rows from current edge state
  const initialRows = useMemo<ModalRow[]>(() => {
    return outgoingEdges.map(edge => {
      const targetNode = nodes.find(n => n.id === edge.target)
      const confidence = edge.data?.confidence ?? 0

      return {
        edgeId: edge.id,
        targetNodeId: edge.target,
        targetLabel: targetNode?.data?.label || 'Unknown',
        percent: Math.round(confidence * 100),
        locked: false
      }
    })
  }, [outgoingEdges, nodes])

  const [rows, setRows] = useState<ModalRow[]>(initialRows)
  const [originalRows] = useState<ModalRow[]>(initialRows)

  const firstUnlockedInputRef = useRef<HTMLInputElement>(null)

  // Focus first unlocked input on mount
  useEffect(() => {
    firstUnlockedInputRef.current?.focus()
  }, [])

  // Validation
  const validation = useMemo(() => {
    const sum = rows.reduce((acc, r) => acc + r.percent, 0)
    const tolerance = 1 // ±1%
    const valid = Math.abs(sum - 100) <= tolerance

    return { valid, sum }
  }, [rows])

  // Toggle lock for a specific row
  const toggleLock = useCallback((edgeId: string) => {
    setRows(prev => prev.map(r =>
      r.edgeId === edgeId ? { ...r, locked: !r.locked } : r
    ))
  }, [])

  // Update percent for a specific row
  const updatePercent = useCallback((edgeId: string, percent: number) => {
    setRows(prev => prev.map(r =>
      r.edgeId === edgeId ? { ...r, percent } : r
    ))
  }, [])

  // Equalize: distribute remaining % across unlocked rows
  const handleEqualize = useCallback(() => {
    const lockedRows = rows.filter(r => r.locked)
    const unlockedRows = rows.filter(r => !r.locked)

    // Can't equalize if all rows are locked
    if (unlockedRows.length === 0) return

    // Calculate remaining percentage after locked rows
    const lockedTotal = lockedRows.reduce((sum, r) => sum + r.percent, 0)
    const remaining = 100 - lockedTotal

    // Distribute equally with rounding
    const perRow = Math.floor(remaining / unlockedRows.length)
    const remainder = remaining - (perRow * unlockedRows.length)

    // Track which unlocked row is last to assign remainder
    let unlockedIndex = 0
    const totalUnlocked = unlockedRows.length

    setRows(prev => prev.map(r => {
      if (r.locked) return r

      const isLastUnlocked = unlockedIndex === totalUnlocked - 1
      unlockedIndex++

      return {
        ...r,
        percent: perRow + (isLastUnlocked ? remainder : 0)
      }
    }))
  }, [rows])

  // Reset to original values
  const handleReset = useCallback(() => {
    setRows(originalRows)
  }, [originalRows])

  // Apply changes (batch update all edges)
  const handleApply = useCallback(() => {
    if (!validation.valid) {
      return
    }

    // Push to history once before batch update
    pushHistory()

    // Build touched nodes set (mark all source nodes as touched)
    const store = useCanvasStore.getState()
    const touchedNodeIds = new Set(store.touchedNodeIds)

    // Mark all nodes whose edges we're updating as touched
    rows.forEach(row => {
      const edge = edges.find(e => e.id === row.edgeId)
      if (edge) {
        touchedNodeIds.add(edge.source)
      }
    })

    // Batch update all edges WITHOUT pushing to history each time
    // Build the new edges array with all updates applied
    const updatedEdges = edges.map(edge => {
      const row = rows.find(r => r.edgeId === edge.id)
      if (!row) return edge

      return {
        ...edge,
        data: {
          ...edge.data,
          confidence: row.percent / 100,
          label: `${row.percent}%`
        }
      }
    })

    // Single state update with all changes AND updated touchedNodeIds
    useCanvasStore.setState({
      edges: updatedEdges,
      touchedNodeIds
    })

    onClose()
  }, [rows, edges, validation.valid, onClose, pushHistory])

  // Keyboard handling
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }

    if (e.key === 'Enter' && validation.valid) {
      e.preventDefault()
      handleApply()
    }
  }, [onClose, validation.valid, handleApply])

  const allLocked = rows.every(r => r.locked)

  return (
    <div
      className={styles.backdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="probability-modal-title"
    >
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.header}>
          <h2 id="probability-modal-title" className={styles.title}>
            Edit Probabilities
          </h2>
          <p className={styles.subtitle}>
            {node?.data?.label || 'Node'}
          </p>
        </div>

        <div className={styles.content}>
          <div className={styles.rows}>
            {rows.map((row, index) => {
              const isFirstUnlocked = !row.locked && !rows.slice(0, index).some(r => !r.locked)

              return (
                <div key={row.edgeId} className={styles.row}>
                  <button
                    type="button"
                    onClick={() => toggleLock(row.edgeId)}
                    className={styles.lockButton}
                    aria-label={row.locked ? 'Unlock' : 'Lock'}
                    title={row.locked ? 'Unlock' : 'Lock'}
                  >
                    {row.locked ? <Lock size={14} /> : <Unlock size={14} />}
                  </button>

                  <span className={styles.label}>
                    {row.targetLabel}
                  </span>

                  <input
                    ref={isFirstUnlocked ? firstUnlockedInputRef : null}
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={row.percent}
                    disabled={row.locked}
                    onChange={(e) => updatePercent(row.edgeId, parseInt(e.target.value, 10))}
                    className={styles.slider}
                    aria-label={`Probability to ${row.targetLabel}`}
                  />

                  <span className={styles.percent}>
                    {row.percent}%
                  </span>
                </div>
              )
            })}
          </div>

          {/* Validation Feedback */}
          {!validation.valid && (
            <div className={styles.validation} role="alert">
              <AlertTriangle className={styles.validationIcon} aria-hidden="true" />
              <p className={styles.validationText}>
                Total: {validation.sum}% (must be 100% ±1%)
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button
            type="button"
            onClick={handleEqualize}
            disabled={allLocked}
            className={styles.secondaryButton}
            title={allLocked ? "Unlock at least one row to equalize" : "Distribute remaining % equally"}
          >
            Equalize
          </button>

          <button
            type="button"
            onClick={handleReset}
            className={styles.secondaryButton}
          >
            Reset
          </button>

          <div className={styles.spacer} />

          <button
            type="button"
            onClick={onClose}
            className={styles.cancelButton}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleApply}
            disabled={!validation.valid}
            className={styles.primaryButton}
            title={!validation.valid ? "Fix probabilities to apply" : "Apply changes"}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
