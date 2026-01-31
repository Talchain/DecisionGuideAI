/**
 * Compact node inspector for contextual popover
 * Shows only essential fields: Title, Type, Probabilities (for decisions), and Interventions (for options)
 * British English: visualisation, colour
 */

import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Lock, Unlock, Maximize2, AlertTriangle, ArrowRight } from 'lucide-react'
import { useCanvasStore } from '../store'
import { NODE_REGISTRY } from '../domain/nodes'
import type { NodeType } from '../domain/nodes'
import { renderIcon } from '../helpers/renderIcon'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'

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

interface InterventionRow {
  factorId: string
  factorLabel: string
  value: number
  unit: string
}

export const NodeInspectorCompact = memo(({ nodeId, onClose, onExpandToFull }: NodeInspectorCompactProps) => {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const updateNode = useCanvasStore(s => s.updateNode)
  const pushHistory = useCanvasStore(s => s.pushHistory)
  const setHighlightedNodes = useCanvasStore(s => s.setHighlightedNodes)

  const node = nodes.find(n => n.id === nodeId)
  const currentType = (node?.type || 'decision') as NodeType
  const isOptionNode = currentType === 'option'

  // Get display metadata for insights section (only meaningful for factors in Results mode)
  const displayMetadata = useNodeDisplayMetadata(nodeId, currentType)

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

  // Get interventions for option nodes
  // Unit precedence: intervention_unit → observed_state.unit → null
  const interventionRows = useMemo<InterventionRow[]>(() => {
    if (!isOptionNode) return []
    const interventions = node?.data?.interventions as Record<string, number> | undefined
    if (!interventions) return []

    return Object.entries(interventions).map(([factorId, value]) => {
      const factorNode = nodes.find(n => n.id === factorId)
      const factorLabel = factorNode?.data?.label || factorId
      // Task 4: Unit precedence - intervention_unit → observed_state.unit → ''
      const factorData = factorNode?.data as any
      const observedState = factorData?.observedState ?? factorData?.observed_state
      const unit = factorData?.intervention_unit ?? observedState?.unit ?? ''
      return { factorId, factorLabel, value, unit }
    })
  }, [isOptionNode, node?.data?.interventions, nodes])

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

  // Task 6: Debounced hover highlight for intervention rows (50ms delay)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleInterventionHover = useCallback((factorId: string | null) => {
    // Clear any pending timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }

    if (factorId) {
      // Debounce highlight on enter
      hoverTimeoutRef.current = setTimeout(() => {
        setHighlightedNodes([factorId])
      }, 50)
    } else {
      // Clear immediately on leave
      setHighlightedNodes([])
    }
  }, [setHighlightedNodes])

  // Cleanup hover timeout on unmount to prevent stale highlights
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

  // Format intervention value with unit
  // Task 4: "sets to [value]" format when no unit
  const formatInterventionValue = useCallback((value: number, unit: string): string => {
    if (!unit) {
      return `sets to ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    }

    switch (unit.toLowerCase()) {
      case 'gbp':
      case '£':
        return `£${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      case 'usd':
      case '$':
        return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      case 'eur':
      case '€':
        return `€${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      case 'percent':
      case '%':
        return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`
      default:
        return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`
    }
  }, [])

  if (!node) return null

  const metadata = NODE_REGISTRY[currentType] || NODE_REGISTRY.decision

  return (
    <div
      className="p-3 bg-white rounded-lg shadow-lg border border-slate-200"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label="Node properties"
      aria-labelledby="compact-node-inspector-title"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          {renderIcon(metadata.icon, 16) ?? <span aria-hidden="true">•</span>}
          <span
            id="compact-node-inspector-title"
            className="text-xs font-medium text-slate-700"
          >
            {metadata.label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onExpandToFull}
            className="p-1 text-slate-400 hover:text-slate-600 rounded"
            aria-label="Expand to full inspector"
            title="Expand"
          >
            <Maximize2 size={14} />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="mb-3">
        <label htmlFor="compact-node-title" className="block text-xs font-medium text-slate-700 mb-1">
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
          className="w-full text-sm border border-slate-300 rounded px-2 py-1"
        />
      </div>

      {/* Type */}
      <div className="mb-3">
        <label htmlFor="compact-node-type" className="block text-xs font-medium text-slate-700 mb-1">
          Type
        </label>
        <select
          id="compact-node-type"
          value={currentType}
          onChange={(e) => handleTypeChange(e.target.value as NodeType)}
          className="w-full text-sm border border-slate-300 rounded px-2 py-1 bg-white"
        >
          {(Object.keys(NODE_REGISTRY) as NodeType[]).map((type) => (
            <option key={type} value={type}>
              {NODE_REGISTRY[type].label}
            </option>
          ))}
        </select>
      </div>

      {/* Factor Insights (only for factors in Results mode) */}
      {currentType === 'factor' && displayMetadata.isResultsMode && (
        <div className="mb-3 pt-2 border-t border-slate-100">
          <h4 className="text-xs font-medium text-slate-700 mb-2 flex items-center gap-2">
            Insights
            {displayMetadata.sensitivityRank !== null && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">
                #{displayMetadata.sensitivityRank}
              </span>
            )}
          </h4>

          {/* Not in sensitivity analysis (e.g., root "Value" node) */}
          {!displayMetadata.inSensitivityAnalysis && (
            <p className="text-[10px] text-slate-400 italic">
              Insights not available for this factor
            </p>
          )}

          {/* In sensitivity analysis - show actual values */}
          {displayMetadata.inSensitivityAnalysis && (
            <>
              {/* Influence bar */}
              {displayMetadata.influence !== null && (
                <div className="mb-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-slate-500">Influence</span>
                    <span className="text-[10px] font-medium text-slate-700">
                      {Math.round(displayMetadata.influence * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-info-500 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(displayMetadata.influence * 100, 2)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Confidence bar */}
              {displayMetadata.confidence !== null && (
                <div className="mb-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-slate-500">Confidence</span>
                    <span className="text-[10px] font-medium text-slate-700">
                      {Math.round(displayMetadata.confidence * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        displayMetadata.confidence < 0.5 ? 'bg-warning-500' : 'bg-success-500'
                      }`}
                      style={{ width: `${Math.max(displayMetadata.confidence * 100, 2)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Coaching hint for high-influence low-confidence factors */}
              {displayMetadata.influence !== null &&
               displayMetadata.confidence !== null &&
               displayMetadata.influence >= 0.7 &&
               displayMetadata.confidence < 0.5 && (
                <div className="flex items-start gap-1.5 p-2 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-700">
                  <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                  <span>High influence but low confidence. Consider gathering more data to reduce uncertainty.</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Interventions section for Option nodes */}
      {isOptionNode && (
        <div className="pt-2 border-t border-slate-100">
          <h4 className="text-xs font-medium text-slate-700 mb-2">Interventions</h4>

          {/* Task 5: Mode-aware empty state for baseline options */}
          {interventionRows.length === 0 ? (
            <p className="text-[10px] text-slate-400 italic">
              {displayMetadata.isResultsMode
                ? 'No interventions — this option represents the baseline'
                : 'No interventions — this option maintains current values'}
            </p>
          ) : (
            <div className="space-y-1.5">
              {interventionRows.map((row) => (
                <div
                  key={row.factorId}
                  className="flex items-center gap-2 hover:bg-slate-50 rounded px-1 py-0.5 -mx-1 transition-colors cursor-default"
                  onMouseEnter={() => handleInterventionHover(row.factorId)}
                  onMouseLeave={() => handleInterventionHover(null)}
                >
                  <ArrowRight size={10} className="flex-shrink-0 text-slate-400" aria-hidden="true" />
                  <span className="text-xs text-slate-600 flex-1 min-w-0 truncate" title={row.factorLabel}>
                    {row.factorLabel}
                  </span>
                  <span className="text-xs font-medium text-slate-700 flex-shrink-0">
                    {formatInterventionValue(row.value, row.unit)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Inline Probabilities (only for decision-probability edges, not for option nodes) */}
      {!isOptionNode && outgoingEdges.length > 0 && !isInfluenceNetwork && (
        <div className="pt-2 border-t border-slate-100">
          <h4 className="text-xs font-medium text-slate-700 mb-2">Probabilities</h4>

          {/* Compact probability rows */}
          <div className="space-y-1.5 mb-2">
            {rows.map((row) => (
              <div key={row.edgeId} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleLock(row.edgeId)}
                  className={`flex-shrink-0 p-0.5 rounded ${
                    row.locked ? 'text-info-600' : 'text-slate-400'
                  }`}
                  aria-label={row.locked ? `Unlock ${row.targetLabel}` : `Lock ${row.targetLabel}`}
                >
                  {row.locked ? <Lock size={10} /> : <Unlock size={10} />}
                </button>
                <span className="text-xs text-slate-600 flex-1 min-w-0 truncate" title={row.targetLabel}>
                  {row.targetLabel}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="5"
                    value={row.percent}
                    disabled={row.locked}
                    onChange={(e) => updatePercent(row.edgeId, parseInt(e.target.value, 10) || 0)}
                    className={`w-12 text-xs border border-slate-300 rounded px-1 py-0.5 text-right ${
                      row.locked ? 'opacity-50' : ''
                    }`}
                  />
                  <span className="text-xs text-slate-500">%</span>
                </div>
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
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
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
