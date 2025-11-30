/**
 * Compact node inspector for contextual popover
 * Shows only essential fields: Title, Type, and Probabilities
 * British English: visualisation, colour
 */

import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Lock, Unlock, Maximize2 } from 'lucide-react'
import { useCanvasStore } from '../store'
import { NODE_REGISTRY } from '../domain/nodes'
import type { NodeType } from '../domain/nodes'
import { renderIcon } from '../helpers/renderIcon'

interface NodeInspectorCompactProps {
  nodeId: string
  onClose: () => void
  onExpandToFull: () => void
}

interface ProbabilityRow {
  edgeId: string
  targetNodeId: string
  targetLabel: string
  percent: number
  locked: boolean
}

export const NodeInspectorCompact = memo(({ nodeId, onClose, onExpandToFull }: NodeInspectorCompactProps) => {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const updateNode = useCanvasStore(s => s.updateNode)
  const pushHistory = useCanvasStore(s => s.pushHistory)

  const node = nodes.find(n => n.id === nodeId)
  const [label, setLabel] = useState<string>(String(node?.data?.label ?? ''))

  // Get outgoing edges from this node
  const outgoingEdges = useMemo(() =>
    edges.filter(e => e.source === nodeId),
    [edges, nodeId]
  )

  // Check if edges are influence-weight edges (not probabilities)
  const isInfluenceNetwork = useMemo(() => {
    if (outgoingEdges.length === 0) return false
    return outgoingEdges.some(e => e.data?.kind === 'influence-weight')
  }, [outgoingEdges])

  // Initialize probability rows
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

  // Reset when node changes
  useEffect(() => {
    setRows(initialRows)
    setLabel(String(node?.data?.label ?? ''))
  }, [initialRows, node?.data?.label])

  // Validation
  const validation = useMemo(() => {
    if (rows.length === 0) return { valid: true, sum: 0 }
    const sum = rows.reduce((acc, r) => acc + r.percent, 0)
    const valid = Math.abs(sum - 100) <= 1
    return { valid, sum }
  }, [rows])

  const labelRef = useRef<HTMLInputElement>(null)

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

  const handleTypeChange = useCallback((newType: NodeType) => {
    updateNode(nodeId, { type: newType })
  }, [nodeId, updateNode])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [onClose])

  const toggleLock = useCallback((edgeId: string) => {
    setRows(prev => prev.map(r =>
      r.edgeId === edgeId ? { ...r, locked: !r.locked } : r
    ))
  }, [])

  const updatePercent = useCallback((edgeId: string, percent: number) => {
    setRows(prev => prev.map(r =>
      r.edgeId === edgeId ? { ...r, percent } : r
    ))
  }, [])

  const handleApply = useCallback(() => {
    if (!validation.valid) return

    pushHistory()

    const updatedEdges = edges.map(edge => {
      const row = rows.find(r => r.edgeId === edge.id)
      if (!row) return edge

      const currentLabel = edge.data?.label
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

    useCanvasStore.setState((state) => {
      const touchedNodeIds = new Set(state.touchedNodeIds)
      rows.forEach(row => {
        const edge = edges.find(e => e.id === row.edgeId)
        if (edge) touchedNodeIds.add(edge.source)
      })
      return { edges: updatedEdges, touchedNodeIds }
    })
  }, [rows, edges, validation.valid, pushHistory])

  if (!node) return null

  const currentType = (node.type || 'decision') as NodeType
  const metadata = NODE_REGISTRY[currentType] || NODE_REGISTRY.decision

  return (
    <div
      className="p-3 bg-white rounded-lg shadow-lg border border-gray-200"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label="Node properties"
      aria-labelledby="compact-node-inspector-title"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          {renderIcon(metadata.icon, 16) ?? <span aria-hidden="true">•</span>}
          <span
            id="compact-node-inspector-title"
            className="text-xs font-medium text-gray-700"
          >
            {metadata.label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onExpandToFull}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
            aria-label="Expand to full inspector"
            title="Expand"
          >
            <Maximize2 size={14} />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="mb-3">
        <label htmlFor="compact-node-title" className="block text-xs font-medium text-gray-700 mb-1">
          Title
        </label>
        <input
          ref={labelRef}
          id="compact-node-title"
          type="text"
          maxLength={100}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={handleLabelBlur}
          className="w-full text-sm border border-gray-300 rounded px-2 py-1"
        />
      </div>

      {/* Type */}
      <div className="mb-3">
        <label htmlFor="compact-node-type" className="block text-xs font-medium text-gray-700 mb-1">
          Type
        </label>
        <select
          id="compact-node-type"
          value={currentType}
          onChange={(e) => handleTypeChange(e.target.value as NodeType)}
          className="w-full text-sm border border-gray-300 rounded px-2 py-1 bg-white"
        >
          {(Object.keys(NODE_REGISTRY) as NodeType[]).map((type) => (
            <option key={type} value={type}>
              {NODE_REGISTRY[type].label}
            </option>
          ))}
        </select>
      </div>

      {/* Inline Probabilities (only for decision-probability edges) */}
      {outgoingEdges.length > 0 && !isInfluenceNetwork && (
        <div className="pt-2 border-t border-gray-100">
          <h4 className="text-xs font-medium text-gray-700 mb-2">Probabilities</h4>

          {/* Compact probability rows */}
          <div className="space-y-1.5 mb-2">
            {rows.map((row) => (
              <div key={row.edgeId} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleLock(row.edgeId)}
                  className={`flex-shrink-0 p-0.5 rounded ${
                    row.locked ? 'text-info-600' : 'text-gray-400'
                  }`}
                  aria-label={row.locked ? `Unlock ${row.targetLabel}` : `Lock ${row.targetLabel}`}
                >
                  {row.locked ? <Lock size={10} /> : <Unlock size={10} />}
                </button>
                <span className="text-xs text-gray-600 w-16 truncate" title={row.targetLabel}>
                  {row.targetLabel}
                </span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="5"
                  value={row.percent}
                  disabled={row.locked}
                  onChange={(e) => updatePercent(row.edgeId, parseInt(e.target.value, 10) || 0)}
                  className={`w-12 text-xs border border-gray-300 rounded px-1 py-0.5 text-right ${
                    row.locked ? 'opacity-50' : ''
                  }`}
                />
                <span className="text-xs text-gray-500">%</span>
              </div>
            ))}
          </div>

          {/* Total & Apply */}
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${
              validation.valid ? 'text-success-600' : 'text-warning-600'
            }`}>
              Total: {validation.sum}%
            </span>
            <button
              type="button"
              onClick={handleApply}
              disabled={!validation.valid}
              className={`px-2 py-1 text-xs font-medium rounded ${
                validation.valid
                  ? 'bg-info-500 text-white hover:bg-info-600'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
})

NodeInspectorCompact.displayName = 'NodeInspectorCompact'
