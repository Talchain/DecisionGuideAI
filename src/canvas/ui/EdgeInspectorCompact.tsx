/**
 * Compact edge inspector for contextual popover
 * Shows only essential fields: Weight, Belief, Label, Style
 * British English: visualisation, colour
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react'
import { Maximize2 } from 'lucide-react'
import { useCanvasStore } from '../store'
import { EDGE_CONSTRAINTS, type EdgeStyle, DEFAULT_EDGE_DATA } from '../domain/edges'

interface EdgeInspectorCompactProps {
  edgeId: string
  onClose: () => void
  onExpandToFull: () => void
}

export const EdgeInspectorCompact = memo(({ edgeId, onClose, onExpandToFull }: EdgeInspectorCompactProps) => {
  const edges = useCanvasStore(s => s.edges)
  const nodes = useCanvasStore(s => s.nodes)
  const updateEdge = useCanvasStore(s => s.updateEdge)

  const edge = edges.find(e => e.id === edgeId)

  // Local state for immediate UI updates
  const [weight, setWeight] = useState<number>(edge?.data?.weight ?? 0.5)
  const [belief, setBelief] = useState<number>(edge?.data?.belief ?? 0.5)
  const [label, setLabel] = useState<string>(edge?.data?.label ?? '')
  const [style, setStyle] = useState<EdgeStyle>(edge?.data?.style ?? 'solid')

  // Debounce timer refs
  const weightTimerRef = useRef<NodeJS.Timeout>()
  const beliefTimerRef = useRef<NodeJS.Timeout>()

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(weightTimerRef.current)
      clearTimeout(beliefTimerRef.current)
    }
  }, [])

  // Reset state when edge changes
  useEffect(() => {
    setWeight(edge?.data?.weight ?? 0.5)
    setBelief(edge?.data?.belief ?? 0.5)
    setLabel(edge?.data?.label ?? '')
    setStyle(edge?.data?.style ?? 'solid')
  }, [edge?.data])

  const handleWeightChange = useCallback((value: number) => {
    setWeight(value)
    clearTimeout(weightTimerRef.current)
    weightTimerRef.current = setTimeout(() => {
      const current = edge?.data ?? DEFAULT_EDGE_DATA
      updateEdge(edgeId, { data: { ...current, weight: value } })
    }, 100)
  }, [edgeId, edge?.data, updateEdge])

  const handleBeliefChange = useCallback((value: number) => {
    setBelief(value)
    clearTimeout(beliefTimerRef.current)
    beliefTimerRef.current = setTimeout(() => {
      const current = edge?.data ?? DEFAULT_EDGE_DATA
      updateEdge(edgeId, { data: { ...current, belief: value } })
    }, 100)
  }, [edgeId, edge?.data, updateEdge])

  const handleStyleChange = useCallback((value: EdgeStyle) => {
    setStyle(value)
    const current = edge?.data ?? DEFAULT_EDGE_DATA
    updateEdge(edgeId, { data: { ...current, style: value } })
  }, [edgeId, edge?.data, updateEdge])

  const handleLabelBlur = useCallback(() => {
    const current = edge?.data ?? DEFAULT_EDGE_DATA
    updateEdge(edgeId, { data: { ...current, label: label || undefined } })
  }, [edgeId, edge?.data, label, updateEdge])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [onClose])

  if (!edge) return null

  // Get node labels for display
  const sourceNode = nodes.find(n => n.id === edge.source)
  const targetNode = nodes.find(n => n.id === edge.target)
  const sourceLabel = sourceNode?.data?.label || edge.source
  const targetLabel = targetNode?.data?.label || edge.target

  return (
    <div
      className="p-3 bg-white rounded-lg shadow-lg border border-gray-200 w-64"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label="Edge properties"
      aria-labelledby="compact-edge-inspector-title"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
        <div
          id="compact-edge-inspector-title"
          className="flex items-center gap-1 text-xs text-gray-600 min-w-0"
        >
          <span className="truncate max-w-[80px]" title={String(sourceLabel)}>{sourceLabel}</span>
          <span className="text-gray-400">→</span>
          <span className="truncate max-w-[80px]" title={String(targetLabel)}>{targetLabel}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
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
            className="p-1 text-gray-400 hover:text-gray-600 rounded text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>

      {/* Weight */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="compact-edge-weight" className="text-xs font-medium text-gray-700">
            Weight
          </label>
          <span className="text-xs text-gray-500 tabular-nums">{weight.toFixed(2)}</span>
        </div>
        <input
          id="compact-edge-weight"
          type="range"
          min={EDGE_CONSTRAINTS.weight.min}
          max={EDGE_CONSTRAINTS.weight.max}
          step={EDGE_CONSTRAINTS.weight.step}
          value={weight}
          onChange={(e) => handleWeightChange(parseFloat(e.target.value))}
          className="w-full h-1.5"
        />
      </div>

      {/* Belief */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="compact-edge-belief" className="text-xs font-medium text-gray-700">
            Belief
          </label>
          <span className="text-xs text-gray-500 tabular-nums">{Math.round(belief * 100)}%</span>
        </div>
        <input
          id="compact-edge-belief"
          type="range"
          min={EDGE_CONSTRAINTS.belief.min}
          max={EDGE_CONSTRAINTS.belief.max}
          step={EDGE_CONSTRAINTS.belief.step}
          value={belief}
          onChange={(e) => handleBeliefChange(parseFloat(e.target.value))}
          className="w-full h-1.5"
        />
      </div>

      {/* Label */}
      <div className="mb-3">
        <label htmlFor="compact-edge-label" className="block text-xs font-medium text-gray-700 mb-1">
          Label
        </label>
        <input
          id="compact-edge-label"
          type="text"
          maxLength={50}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={handleLabelBlur}
          placeholder="Optional..."
          className="w-full text-sm border border-gray-300 rounded px-2 py-1"
        />
      </div>

      {/* Style */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Style</label>
        <div className="flex gap-1" role="radiogroup" aria-label="Edge style">
          {(['solid', 'dashed', 'dotted'] as const).map((s) => (
            <button
              key={s}
              onClick={() => handleStyleChange(s)}
              className={`flex-1 px-2 py-1 text-xs font-medium rounded border transition-colors ${
                style === s
                  ? 'bg-info-50 border-info-500 text-info-700'
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
              role="radio"
              aria-checked={style === s}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
})

EdgeInspectorCompact.displayName = 'EdgeInspectorCompact'
