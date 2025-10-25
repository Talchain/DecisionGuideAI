/**
 * ProbabilityModal - Batch editor for outgoing edge probabilities
 *
 * Features:
 * - Lock/Unlock individual rows
 * - Auto-balance: Preserves ratios, rounds to nice numbers (Hamilton method)
 * - Equal split: Divides remaining % equally (ignores current ratios)
 * - Real-time validation with visual feedback
 * - Batch update (single undo/redo step)
 * - Keyboard support (Tab, Enter, Esc)
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Lock, Unlock, AlertTriangle } from 'lucide-react'
import { useCanvasStore } from '../store'
import type { Edge } from 'reactflow'
import type { EdgeData } from '../domain/edges'
import { autoBalance, equalSplit, type BalanceRow } from '../utils/probabilityBalancing'
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
  const [balanceError, setBalanceError] = useState<string | undefined>()

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

  // Auto-balance: Preserves relative proportions, rounds to nice numbers
  const handleAutoBalance = useCallback(() => {
    const balanceRows: BalanceRow[] = rows.map(r => ({
      value: r.percent,
      locked: r.locked
    }))

    const result = autoBalance(balanceRows, { step: 5 })

    if (result.error) {
      setBalanceError(result.error)
    } else {
      setBalanceError(undefined)
      setRows(prev => prev.map((r, i) => ({
        ...r,
        percent: result.values[i]
      })))
    }
  }, [rows])

  // Equal split: Divides remaining percentage equally (ignores current ratios)
  const handleEqualSplit = useCallback(() => {
    const balanceRows: BalanceRow[] = rows.map(r => ({
      value: r.percent,
      locked: r.locked
    }))

    const result = equalSplit(balanceRows, { step: 5 })

    if (result.error) {
      setBalanceError(result.error)
    } else {
      setBalanceError(undefined)
      setRows(prev => prev.map((r, i) => ({
        ...r,
        percent: result.values[i]
      })))
    }
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

      const currentLabel = edge.data?.label
      // Only update label if it's auto-generated (matches "X%" pattern) or undefined
      // Preserve custom labels like "High cost path"
      const isAutoLabel = !currentLabel || /^\d+%$/.test(currentLabel)
      const newLabel = isAutoLabel ? `${row.percent}%` : currentLabel

      return {
        ...edge,
        data: {
          ...edge.data,
          confidence: row.percent / 100,
          label: newLabel
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

          {/* Helper Text */}
          <p className={styles.helperText}>
            <strong>Auto-balance</strong> keeps your ratios, rounds to nice numbers, and totals 100%.
            <strong> Equal split</strong> divides the remaining (unlocked) options evenly.
          </p>

          {/* Balance Error Feedback */}
          {balanceError && (
            <div className={styles.validation} role="alert">
              <AlertTriangle className={styles.validationIcon} aria-hidden="true" />
              <p className={styles.validationText}>
                {balanceError}
              </p>
            </div>
          )}

          {/* Validation Feedback */}
          {!validation.valid && !balanceError && (
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
          <div className={styles.balanceButtons}>
            <button
              type="button"
              onClick={handleAutoBalance}
              disabled={allLocked}
              className={styles.secondaryButton}
              title={allLocked ? "Unlock at least one row" : "Keeps your ratios, rounds to nice numbers"}
            >
              Auto-balance
            </button>

            <button
              type="button"
              onClick={handleEqualSplit}
              disabled={allLocked}
              className={styles.secondaryButton}
              title={allLocked ? "Unlock at least one row" : "Divides remaining evenly"}
            >
              Equal split
            </button>
          </div>

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
