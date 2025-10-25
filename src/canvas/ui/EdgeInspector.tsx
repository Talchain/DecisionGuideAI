/**
 * Edge property inspector
 * Debounced sliders (~120ms) with aria-live announcements
 * British English: visualisation, colour
 */

import { memo, useState, useCallback, useEffect, useRef } from 'react'
import { useCanvasStore } from '../store'
import { EDGE_CONSTRAINTS, type EdgeStyle, DEFAULT_EDGE_DATA } from '../domain/edges'
import { formatConfidence } from '../domain/edges'
import { useToast } from '../ToastContext'
import { Tooltip } from '../components/Tooltip'

interface EdgeInspectorProps {
  edgeId: string
  onClose: () => void
}

/**
 * Debounced edge property inspector
 * INP target: ≤100ms p75 for slider interactions
 */
export const EdgeInspector = memo(({ edgeId, onClose }: EdgeInspectorProps) => {
  const edges = useCanvasStore(s => s.edges)
  const nodes = useCanvasStore(s => s.nodes)
  const updateEdge = useCanvasStore(s => s.updateEdge)
  const deleteEdge = useCanvasStore(s => s.deleteEdge)
  const beginReconnect = useCanvasStore(s => s.beginReconnect)
  const { showToast } = useToast()
  
  const edge = edges.find(e => e.id === edgeId)
  
  // Local state for immediate UI updates with proper defaults
  const [weight, setWeight] = useState<number>(edge?.data?.weight ?? 1.0)
  const [style, setStyle] = useState<EdgeStyle>(edge?.data?.style ?? 'solid')
  const [curvature, setCurvature] = useState<number>(edge?.data?.curvature ?? 0.15)
  const [label, setLabel] = useState<string>(edge?.data?.label ?? '')
  const [confidence, setConfidence] = useState<number>(edge?.data?.confidence ?? 0.5)
  
  // Debounce timer refs
  const weightTimerRef = useRef<NodeJS.Timeout>()
  const curvatureTimerRef = useRef<NodeJS.Timeout>()
  const confidenceTimerRef = useRef<NodeJS.Timeout>()
  
  // Live region for announcements
  const [announcement, setAnnouncement] = useState('')
  
  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(weightTimerRef.current)
      clearTimeout(curvatureTimerRef.current)
      clearTimeout(confidenceTimerRef.current)
    }
  }, [])
  
  // Debounced weight update (~120ms)
  const handleWeightChange = useCallback((value: number) => {
    setWeight(value)
    clearTimeout(weightTimerRef.current)
    weightTimerRef.current = setTimeout(() => {
      const current = edge?.data ?? DEFAULT_EDGE_DATA
      updateEdge(edgeId, { data: { ...current, weight: value } })
      setAnnouncement(`Weight set to ${value.toFixed(1)}`)
    }, 120)
  }, [edgeId, edge?.data, updateEdge])
  
  // Immediate style update (no debounce needed for discrete choice)
  const handleStyleChange = useCallback((value: EdgeStyle) => {
    setStyle(value)
    const current = edge?.data ?? DEFAULT_EDGE_DATA
    updateEdge(edgeId, { data: { ...current, style: value } })
    setAnnouncement(`Style changed to ${value}`)
  }, [edgeId, edge?.data, updateEdge])
  
  // Debounced curvature update (~120ms)
  const handleCurvatureChange = useCallback((value: number) => {
    setCurvature(value)
    clearTimeout(curvatureTimerRef.current)
    curvatureTimerRef.current = setTimeout(() => {
      const current = edge?.data ?? DEFAULT_EDGE_DATA
      updateEdge(edgeId, { data: { ...current, curvature: value } })
      setAnnouncement(`Curvature set to ${(value * 100).toFixed(0)}%`)
    }, 120)
  }, [edgeId, edge?.data, updateEdge])
  
  // Immediate label update (on blur)
  const handleLabelBlur = useCallback(() => {
    const current = edge?.data ?? DEFAULT_EDGE_DATA
    updateEdge(edgeId, { data: { ...current, label: label || undefined } })
  }, [edgeId, edge?.data, label, updateEdge])
  // Delete edge
  const handleDelete = useCallback(() => {
    deleteEdge(edgeId)
    showToast('Connector deleted — press ⌘Z to undo.', 'success')
    onClose()
  }, [edgeId, deleteEdge, showToast, onClose])
  
  // Begin reconnect mode
  const handleReconnectSource = useCallback(() => {
    beginReconnect(edgeId, 'source')
    showToast('Reconnect source: click a node or press Esc to cancel.', 'info')
  }, [edgeId, beginReconnect, showToast])
  
  const handleReconnectTarget = useCallback(() => {
    beginReconnect(edgeId, 'target')
    showToast('Reconnect target: click a node or press Esc to cancel.', 'info')
  }, [edgeId, beginReconnect, showToast])
  
  // Keyboard: Esc closes and returns focus
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [onClose])
  
  if (!edge) {
    return (
      <div className="p-4 text-sm text-gray-500">
        No edge selected
      </div>
    )
  }
  
  return (
    <div 
      className="p-4 border-t border-gray-200" 
      role="region" 
      aria-label="Edge properties"
      data-testid="panel-edge-properties"
      onKeyDown={handleKeyDown}
    >
      {/* Live region for announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
      
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Edge Properties</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          aria-label="Close inspector"
        >
          ×
        </button>
      </div>
      
      {/* Weight control */}
      <div className="mb-4">
        <Tooltip content="Influences layout positioning and visual thickness" position="right">
          <label htmlFor="edge-weight" className="block text-xs font-medium text-gray-700 mb-1">
            Weight
          </label>
        </Tooltip>
        <div className="flex items-center gap-2">
          <input
            id="edge-weight"
            type="range"
            min={EDGE_CONSTRAINTS.weight.min}
            max={EDGE_CONSTRAINTS.weight.max}
            step={EDGE_CONSTRAINTS.weight.step}
            value={weight}
            onChange={(e) => handleWeightChange(parseFloat(e.target.value))}
            className="flex-1"
            aria-valuemin={EDGE_CONSTRAINTS.weight.min}
            aria-valuemax={EDGE_CONSTRAINTS.weight.max}
            aria-valuenow={weight}
            aria-valuetext={`${weight.toFixed(1)}`}
          />
          <input
            type="number"
            min={EDGE_CONSTRAINTS.weight.min}
            max={EDGE_CONSTRAINTS.weight.max}
            step={EDGE_CONSTRAINTS.weight.step}
            value={weight}
            onChange={(e) => handleWeightChange(Math.max(EDGE_CONSTRAINTS.weight.min, Math.min(EDGE_CONSTRAINTS.weight.max, parseFloat(e.target.value) || EDGE_CONSTRAINTS.weight.min)))}
            className="w-16 text-xs border border-gray-300 rounded px-2 py-1"
            aria-label="Weight value"
          />
        </div>
      </div>
      
      {/* Style control */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Style
        </label>
        <div className="flex gap-2" role="radiogroup" aria-label="Edge style">
          {(['solid', 'dashed', 'dotted'] as const).map((s) => (
            <button
              key={s}
              onClick={() => handleStyleChange(s)}
              className={`
                flex-1 px-3 py-2 text-xs font-medium rounded border
                ${style === s
                  ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }
              `}
              style={style === s ? { backgroundColor: 'rgba(91,108,255,0.1)', borderColor: 'var(--olumi-primary)', color: 'var(--olumi-primary)' } : {}}
              role="radio"
              aria-checked={style === s}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>
      
      {/* Curvature control */}
      <div className="mb-4">
        <label htmlFor="edge-curvature" className="block text-xs font-medium text-gray-700 mb-1">
          Curvature
        </label>
        <input
          id="edge-curvature"
          type="range"
          min={EDGE_CONSTRAINTS.curvature.min}
          max={EDGE_CONSTRAINTS.curvature.max}
          step={0.01}
          value={curvature}
          onChange={(e) => handleCurvatureChange(parseFloat(e.target.value))}
          className="w-full"
          aria-valuemin={EDGE_CONSTRAINTS.curvature.min}
          aria-valuemax={EDGE_CONSTRAINTS.curvature.max}
          aria-valuenow={curvature}
          aria-valuetext={`${(curvature * 100).toFixed(0)}%`}
        />
      </div>
      
      {/* Label control */}
      <div className="mb-4">
        <label htmlFor="edge-label" className="block text-xs font-medium text-gray-700 mb-1">
          Label (optional)
        </label>
        <input
          id="edge-label"
          type="text"
          maxLength={50}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={handleLabelBlur}
          placeholder="Add a label..."
          className="w-full text-xs border border-gray-300 rounded px-2 py-1"
        />
      </div>
      
      {/* Probability - Edit in Decision */}
      <div className="mb-4">
        <Tooltip content="Probabilities are managed at the decision (node) level to ensure they sum to 100%" position="right">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Probability
          </label>
        </Tooltip>
        <div className="flex items-center justify-between gap-3 p-3 rounded" style={{ backgroundColor: 'rgba(91, 108, 255, 0.05)', border: '1px solid rgba(91, 108, 255, 0.2)' }}>
          <div className="flex-1">
            <p className="text-xs font-medium" style={{ color: 'var(--olumi-text, #E8ECF5)' }}>
              {formatConfidence(confidence)}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(232, 236, 245, 0.6)' }}>
              Edit in decision node →
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              // Select the source node to open its inspector
              const sourceNode = nodes.find(n => n.id === edge?.source)
              if (sourceNode) {
                useCanvasStore.setState({
                  selection: {
                    nodeIds: new Set([edge.source]),
                    edgeIds: new Set()
                  }
                })
              }
            }}
            className="px-3 py-1 text-xs font-medium rounded border"
            style={{
              backgroundColor: 'var(--olumi-primary, #5B6CFF)',
              color: '#ffffff',
              border: 'none'
            }}
          >
            Edit
          </button>
        </div>
      </div>
      
      {/* Connection endpoints */}
      <div className="mb-4 pb-4 border-t border-gray-200 pt-4">
        <label className="block text-xs font-medium text-gray-700 mb-2">
          Connection
        </label>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">Source:</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">
                {nodes.find(n => n.id === edge.source)?.data?.label || edge.source}
              </span>
              <button
                onClick={handleReconnectSource}
                className="text-xs underline"
                style={{ color: 'var(--olumi-primary)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--olumi-primary-700)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--olumi-primary)'}
                data-testid="btn-edge-reconnect-source"
              >
                Change…
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">Target:</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">
                {nodes.find(n => n.id === edge.target)?.data?.label || edge.target}
              </span>
              <button
                onClick={handleReconnectTarget}
                className="text-xs underline"
                style={{ color: 'var(--olumi-primary)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--olumi-primary-700)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--olumi-primary)'}
                data-testid="btn-edge-reconnect-target"
              >
                Change…
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Delete button */}
      <div className="pt-2 border-t border-gray-200">
        <button
          onClick={handleDelete}
          className="w-full px-3 py-2 text-sm font-medium text-white rounded transition-colors"
          style={{ backgroundColor: 'var(--olumi-danger)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e63946'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--olumi-danger)'}
          data-testid="btn-edge-delete"
        >
          Delete Connector
        </button>
      </div>
    </div>
  )
})

EdgeInspector.displayName = 'EdgeInspector'
