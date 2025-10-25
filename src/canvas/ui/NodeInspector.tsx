/**
 * Node property inspector - keyboard-first editing
 * Includes inline probability editor (single source of truth)
 */

import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Lock, Unlock, AlertTriangle } from 'lucide-react'
import { useCanvasStore } from '../store'
import { NODE_REGISTRY } from '../domain/nodes'
import type { NodeType } from '../domain/nodes'
import { renderIcon } from '../helpers/renderIcon'
import { validateOutgoingProbabilities } from '../utils/probabilityValidation'
import { autoBalance, equalSplit, type BalanceRow } from '../utils/probabilityBalancing'
import { Tooltip } from '../components/Tooltip'

interface NodeInspectorProps {
  nodeId: string
  onClose: () => void
}

interface ProbabilityRow {
  edgeId: string
  targetNodeId: string
  targetLabel: string
  percent: number  // 0-100
  locked: boolean  // ephemeral UI state
}

export const NodeInspector = memo(({ nodeId, onClose }: NodeInspectorProps) => {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const updateNode = useCanvasStore(s => s.updateNode)
  const pushHistory = useCanvasStore(s => s.pushHistory)

  const node = nodes.find(n => n.id === nodeId)
  const [label, setLabel] = useState<string>(String(node?.data?.label ?? ''))
  const [description, setDescription] = useState<string>(String(node?.data?.description ?? ''))

  // Get outgoing edges from this node
  const outgoingEdges = useMemo(() =>
    edges.filter(e => e.source === nodeId),
    [edges, nodeId]
  )

  // Initialize probability rows from current edge state
  const initialRows = useMemo<ProbabilityRow[]>(() => {
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

  const [rows, setRows] = useState<ProbabilityRow[]>(initialRows)
  const [originalRows, setOriginalRows] = useState<ProbabilityRow[]>(initialRows)
  const [balanceError, setBalanceError] = useState<string | undefined>()

  // Reset draft when node changes
  useEffect(() => {
    setRows(initialRows)
    setOriginalRows(initialRows)
    setBalanceError(undefined)
  }, [initialRows])

  // Validation
  const validation = useMemo(() => {
    if (rows.length === 0) return { valid: true, sum: 0 }

    const sum = rows.reduce((acc, r) => acc + r.percent, 0)
    const tolerance = 1 // ±1%
    const valid = Math.abs(sum - 100) <= tolerance

    return { valid, sum }
  }, [rows])

  // Check if changes have been made
  const hasChanges = useMemo(() => {
    if (rows.length !== originalRows.length) return true
    return rows.some((row, i) => row.percent !== originalRows[i].percent)
  }, [rows, originalRows])

  const labelRef = useRef<HTMLInputElement>(null)
  const probabilitiesRef = useRef<HTMLDivElement>(null)
  const firstSliderRef = useRef<HTMLInputElement>(null)

  // Expose ref for keyboard shortcut focusing
  useEffect(() => {
    // Store ref in a data attribute for P key handler
    if (probabilitiesRef.current) {
      probabilitiesRef.current.dataset.nodeId = nodeId
    }
  }, [nodeId])

  useEffect(() => {
    labelRef.current?.focus()
    labelRef.current?.select()
  }, [])

  const handleLabelBlur = useCallback(() => {
    const trimmed = label.trim().slice(0, 100)
    if (trimmed && trimmed !== node?.data?.label) {
      updateNode(nodeId, { data: { ...node?.data, label: trimmed } })
    }
  }, [nodeId, label, node?.data, updateNode])

  const handleDescriptionBlur = useCallback(() => {
    const trimmed = description.trim().slice(0, 500)
    if (trimmed !== node?.data?.description) {
      updateNode(nodeId, { data: { ...node?.data, description: trimmed || undefined } })
    }
  }, [nodeId, description, node?.data, updateNode])

  const handleTypeChange = useCallback((newType: NodeType) => {
    // Update node type in place (preserves id, position, label)
    updateNode(nodeId, { type: newType })
  }, [nodeId, updateNode])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [onClose])

  // Probability editing handlers
  const toggleLock = useCallback((edgeId: string) => {
    setRows(prev => prev.map(r =>
      r.edgeId === edgeId ? { ...r, locked: !r.locked } : r
    ))
  }, [])

  const updatePercent = useCallback((edgeId: string, percent: number) => {
    setBalanceError(undefined) // Clear error when user manually edits
    setRows(prev => prev.map(r =>
      r.edgeId === edgeId ? { ...r, percent } : r
    ))
  }, [])

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

  const handleReset = useCallback(() => {
    setRows(originalRows)
    setBalanceError(undefined)
  }, [originalRows])

  const handleApply = useCallback(() => {
    if (!validation.valid) {
      return
    }

    // Save current state to history before making changes
    pushHistory()

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
          kind: 'decision-probability',
          confidence: row.percent / 100,
          label: newLabel
        }
      }
    })

    // Batch update using setState with function to ensure we merge touched nodes correctly
    useCanvasStore.setState((state) => {
      const touchedNodeIds = new Set(state.touchedNodeIds)

      // Mark all nodes whose edges we're updating as touched
      rows.forEach(row => {
        const edge = edges.find(e => e.id === row.edgeId)
        if (edge) {
          touchedNodeIds.add(edge.source)
        }
      })

      return {
        edges: updatedEdges,
        touchedNodeIds
      }
    })

    // Update original rows to new state
    setOriginalRows(rows)
    setBalanceError(undefined)
  }, [rows, edges, validation.valid, pushHistory])

  const allLocked = rows.length > 0 && rows.every(r => r.locked)

  if (!node) return <div className="p-4 text-sm text-gray-500">Select a node to edit its details</div>

  const currentType = (node.type || 'decision') as NodeType
  const metadata = NODE_REGISTRY[currentType] || NODE_REGISTRY.decision

  return (
    <div className="p-4 border-t border-gray-200" onKeyDown={handleKeyDown} role="region" aria-label="Node properties">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {renderIcon(metadata.icon, 18) ?? <span aria-hidden="true">•</span>}
          <h3 className="text-sm font-semibold">{metadata.label}</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">×</button>
      </div>

      <div className="mb-4">
        <label htmlFor="node-type" className="block text-xs font-medium text-gray-700 mb-1">Type</label>
        <select
          id="node-type"
          value={currentType}
          onChange={(e) => handleTypeChange(e.target.value as NodeType)}
          className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 bg-white"
          data-testid="select-node-type"
        >
          {(Object.keys(NODE_REGISTRY) as NodeType[]).map((type) => (
            <option key={type} value={type}>
              {NODE_REGISTRY[type].label}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label htmlFor="node-title" className="block text-xs font-medium text-gray-700 mb-1">Title</label>
        <input
          ref={labelRef}
          id="node-title"
          type="text"
          maxLength={100}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={handleLabelBlur}
          className="w-full text-sm border border-gray-300 rounded px-2 py-1"
        />
      </div>

      <div className="mb-4">
        <label htmlFor="node-description" className="block text-xs font-medium text-gray-700 mb-1">
          Note <span className="text-gray-400">(optional)</span>
        </label>
        <textarea
          id="node-description"
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={handleDescriptionBlur}
          rows={3}
          className="w-full text-sm border border-gray-300 rounded px-2 py-1"
          placeholder="Add a note..."
        />
      </div>

      {/* Inline Probability Editor */}
      {outgoingEdges.length > 0 && (
        <section
          ref={probabilitiesRef}
          className="mb-4 pt-4 border-t border-gray-200"
          aria-labelledby="probabilities-heading"
        >
          <Tooltip content="% likelihood each connector is taken (must total 100%)" position="right">
            <h4 id="probabilities-heading" className="text-xs font-medium text-gray-700 mb-2">
              Probabilities
            </h4>
          </Tooltip>

          {/* Helper Text */}
          <p className="text-xs text-gray-600 mb-3" style={{ lineHeight: '1.4' }}>
            Auto-balance keeps your ratios, rounds to nice numbers, and totals 100%. Equal split divides the remaining (unlocked) options evenly.
          </p>

          {/* Probability Rows */}
          <div className="space-y-2 mb-3">
            {rows.map((row, index) => {
              const isFirstUnlocked = !row.locked && !rows.slice(0, index).some(r => !r.locked)

              return (
                <div key={row.edgeId} className="flex items-center gap-1.5">
                  {/* Lock toggle */}
                  <button
                    type="button"
                    onClick={() => toggleLock(row.edgeId)}
                    className="flex-shrink-0 p-1 rounded hover:bg-gray-100 transition-colors"
                    aria-label={row.locked ? `Unlock ${row.targetLabel}` : `Lock ${row.targetLabel}`}
                    aria-pressed={row.locked}
                    title={row.locked ? 'Locked' : 'Unlocked'}
                    style={{
                      color: row.locked ? 'var(--olumi-primary, #5B6CFF)' : '#9ca3af'
                    }}
                  >
                    {row.locked ? <Lock size={12} /> : <Unlock size={12} />}
                  </button>

                  {/* Target label */}
                  <span className="text-xs text-gray-700 w-14 flex-shrink-0 truncate" title={row.targetLabel}>
                    {row.targetLabel}
                  </span>

                  {/* Range slider - constrained width */}
                  <input
                    ref={isFirstUnlocked ? firstSliderRef : null}
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={row.percent}
                    disabled={row.locked}
                    onChange={(e) => updatePercent(row.edgeId, parseInt(e.target.value, 10))}
                    className="flex-1 min-w-0"
                    aria-label={`Probability to ${row.targetLabel}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={row.percent}
                    aria-valuetext={`${row.percent}%`}
                    style={{
                      opacity: row.locked ? 0.5 : 1,
                      maxWidth: '120px'
                    }}
                  />

                  {/* Numeric input */}
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={row.percent}
                    disabled={row.locked}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10)
                      if (!isNaN(val)) {
                        updatePercent(row.edgeId, Math.max(0, Math.min(100, val)))
                      }
                    }}
                    className="w-10 text-xs border border-gray-300 rounded px-1 py-0.5 text-right flex-shrink-0"
                    aria-label={`${row.targetLabel} percentage`}
                    style={{
                      opacity: row.locked ? 0.5 : 1
                    }}
                  />
                  <span className="text-xs text-gray-500 flex-shrink-0">%</span>
                </div>
              )
            })}
          </div>

          {/* Total Indicator */}
          <div className="mb-3 p-2 rounded text-xs" style={{
            backgroundColor: validation.valid ? 'rgba(76, 175, 80, 0.1)' : 'rgba(247, 201, 72, 0.1)',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: validation.valid ? 'var(--olumi-success, #4CAF50)' : 'var(--olumi-warning, #F7C948)'
          }}>
            <span className="font-medium">Total: {validation.sum}%</span>
            {!validation.valid && <span className="text-gray-600"> (must be 100% ±1%)</span>}
          </div>

          {/* Balance Error Banner */}
          {balanceError && (
            <div className="mb-3 p-2 rounded flex items-start gap-2" role="alert" style={{
              backgroundColor: 'rgba(247, 201, 72, 0.1)',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'var(--olumi-warning, #F7C948)'
            }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--olumi-warning, #F7C948)' }} />
              <p className="text-xs" style={{ color: '#9a6e00' }}>
                {balanceError}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 mb-3">
            <Tooltip content="Preserves your ratios, rounds to nice numbers, and totals 100%" position="top">
              <button
                type="button"
                onClick={handleAutoBalance}
                disabled={allLocked}
                className="px-3 py-1.5 text-xs font-medium rounded border transition-colors"
                style={{
                  backgroundColor: allLocked ? '#f3f4f6' : '#ffffff',
                  borderColor: '#d1d5db',
                  color: allLocked ? '#9ca3af' : '#374151',
                  cursor: allLocked ? 'not-allowed' : 'pointer'
                }}
                title={allLocked ? "Unlock at least one row" : undefined}
              >
                Auto-balance
              </button>
            </Tooltip>

            <Tooltip content="Divides the remaining (unlocked) amount evenly" position="top">
              <button
                type="button"
                onClick={handleEqualSplit}
                disabled={allLocked}
                className="px-3 py-1.5 text-xs font-medium rounded border transition-colors"
                style={{
                  backgroundColor: allLocked ? '#f3f4f6' : '#ffffff',
                  borderColor: '#d1d5db',
                  color: allLocked ? '#9ca3af' : '#374151',
                  cursor: allLocked ? 'not-allowed' : 'pointer'
                }}
                title={allLocked ? "Unlock at least one row" : undefined}
              >
                Equal split
              </button>
            </Tooltip>

            <button
              type="button"
              onClick={handleReset}
              disabled={!hasChanges}
              className="px-3 py-1.5 text-xs font-medium rounded border transition-colors"
              style={{
                backgroundColor: hasChanges ? '#ffffff' : '#f3f4f6',
                borderColor: '#d1d5db',
                color: hasChanges ? '#374151' : '#9ca3af',
                cursor: hasChanges ? 'pointer' : 'not-allowed'
              }}
            >
              Reset
            </button>

            <div className="flex-1" />

            <button
              type="button"
              onClick={handleApply}
              disabled={!validation.valid || !hasChanges || !!balanceError}
              className="px-4 py-1.5 text-xs font-medium rounded transition-colors"
              style={{
                backgroundColor: (!validation.valid || !hasChanges || !!balanceError)
                  ? '#d1d5db'
                  : 'var(--olumi-primary, #5B6CFF)',
                color: '#ffffff',
                cursor: (!validation.valid || !hasChanges || !!balanceError) ? 'not-allowed' : 'pointer'
              }}
              title={
                balanceError
                  ? "Unlock some rows to fix overflow"
                  : !validation.valid
                  ? "Fix probabilities to apply"
                  : !hasChanges
                  ? "No changes to apply"
                  : "Apply changes"
              }
            >
              Apply
            </button>
          </div>
        </section>
      )}

      {/* Empty state for probabilities */}
      {outgoingEdges.length === 0 && (
        <div className="mb-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 italic">
            Add connectors from this decision to set probabilities.
          </p>
        </div>
      )}
    </div>
  )
})

NodeInspector.displayName = 'NodeInspector'
