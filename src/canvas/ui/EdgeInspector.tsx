/**
 * Edge property inspector
 * Debounced sliders (~120ms) with aria-live announcements
 * British English: visualisation, colour
 */

import { memo, useState, useCallback, useEffect, useRef } from 'react'
import { useCanvasStore } from '../store'
import { EDGE_CONSTRAINTS, type EdgeStyle, DEFAULT_EDGE_DATA } from '../domain/edges'
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
  // React 18 + Zustand v5: use individual selectors instead of object+shallow
  const edges = useCanvasStore(s => s.edges)
  const nodes = useCanvasStore(s => s.nodes)
  const updateEdge = useCanvasStore(s => s.updateEdge)
  const deleteEdge = useCanvasStore(s => s.deleteEdge)
  const beginReconnect = useCanvasStore(s => s.beginReconnect)
  const selectNodes = useCanvasStore(s => s.selectNodes)
  const { showToast } = useToast()

  const edge = edges.find(e => e.id === edgeId)

  // Local state for immediate UI updates with proper defaults
  const [weight, setWeight] = useState<number>(edge?.data?.weight ?? 0.5)
  const [style, setStyle] = useState<EdgeStyle>(edge?.data?.style ?? 'solid')
  const [curvature, setCurvature] = useState<number>(edge?.data?.curvature ?? 0.15)
  const [label, setLabel] = useState<string>(edge?.data?.label ?? '')
  const [belief, setBelief] = useState<number | undefined>(edge?.data?.belief) // v1.2
  const [provenance, setProvenance] = useState<string>(edge?.data?.provenance ?? '') // v1.2
  
  // Debounce timer refs
  const weightTimerRef = useRef<NodeJS.Timeout>()
  const curvatureTimerRef = useRef<NodeJS.Timeout>()
  const beliefTimerRef = useRef<NodeJS.Timeout>()

  // Live region for announcements
  const [announcement, setAnnouncement] = useState('')

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(weightTimerRef.current)
      clearTimeout(curvatureTimerRef.current)
      clearTimeout(beliefTimerRef.current)
    }
  }, [])
  
  // Debounced weight update (~120ms)
  const handleWeightChange = useCallback((value: number) => {
    setWeight(value)
    clearTimeout(weightTimerRef.current)
    weightTimerRef.current = setTimeout(() => {
      const current = edge?.data ?? DEFAULT_EDGE_DATA
      updateEdge(edgeId, { data: { ...current, weight: value } })
      setAnnouncement(`Weight set to ${value.toFixed(2)}`)
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

  // v1.2: Debounced belief update (~120ms)
  const handleBeliefChange = useCallback((value: number | undefined) => {
    setBelief(value)
    clearTimeout(beliefTimerRef.current)
    beliefTimerRef.current = setTimeout(() => {
      const current = edge?.data ?? DEFAULT_EDGE_DATA
      updateEdge(edgeId, { data: { ...current, belief: value } })
      if (value !== undefined) {
        setAnnouncement(`Belief set to ${(value * 100).toFixed(0)}%`)
      }
    }, 120)
  }, [edgeId, edge?.data, updateEdge])

  // v1.2: Immediate provenance update (on blur)
  const handleProvenanceBlur = useCallback(() => {
    const current = edge?.data ?? DEFAULT_EDGE_DATA
    updateEdge(edgeId, { data: { ...current, provenance: provenance || undefined } })
  }, [edgeId, edge?.data, provenance, updateEdge])
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

  // v1.2: Reset to defaults
  const handleReset = useCallback(() => {
    const current = edge?.data ?? DEFAULT_EDGE_DATA
    const resetData = {
      ...current,
      weight: EDGE_CONSTRAINTS.weight.default,
      belief: EDGE_CONSTRAINTS.belief.default,
      provenance: edge?.data?.templateId ? 'template' : undefined
    }
    updateEdge(edgeId, { data: resetData })
    setWeight(EDGE_CONSTRAINTS.weight.default)
    setBelief(EDGE_CONSTRAINTS.belief.default)
    setProvenance(edge?.data?.templateId ? 'template' : '')
    showToast('Edge properties reset to defaults.', 'success')
  }, [edgeId, edge?.data, updateEdge, showToast])
  
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
        <Tooltip content="Strength of this connection (0 = no influence, 1 = strong influence)" position="right">
          <label htmlFor="edge-weight" className="block text-xs font-medium text-gray-700 mb-1">
            Weight
          </label>
        </Tooltip>
        <p className="text-[10px] text-gray-500 mb-1.5">0 = no influence, 1 = strong influence</p>
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
            aria-valuetext={`${weight.toFixed(2)}`}
          />
          <input
            type="number"
            min={EDGE_CONSTRAINTS.weight.min}
            max={EDGE_CONSTRAINTS.weight.max}
            step={EDGE_CONSTRAINTS.weight.step}
            value={weight.toFixed(2)}
            onChange={(e) => handleWeightChange(Math.max(EDGE_CONSTRAINTS.weight.min, Math.min(EDGE_CONSTRAINTS.weight.max, parseFloat(e.target.value) || EDGE_CONSTRAINTS.weight.default)))}
            className="w-16 text-xs border border-gray-300 rounded px-2 py-1"
            aria-label="Weight value"
          />
        </div>
      </div>

      {/* v1.2: Belief × Weight readout (when belief present) */}
      {belief !== undefined && (
        <div className="mb-4 p-3 rounded bg-info-50 border border-info-200">
          <div className="flex items-center justify-between">
            <Tooltip content="Combined influence: belief (epistemic certainty) × weight (connection strength)" position="right">
              <label className="text-xs font-medium text-info-900">
                Belief × Weight
              </label>
            </Tooltip>
            <span className="text-sm font-semibold text-info-700 tabular-nums">
              {(belief * weight).toFixed(3)}
            </span>
          </div>
          <p className="text-[10px] text-info-600 mt-1">
            Belief: {belief.toFixed(2)} · Weight: {weight.toFixed(2)}
          </p>
        </div>
      )}

      {/* v1.2: Belief control (epistemic certainty) */}
      <div className="mb-4">
        <Tooltip content="Your certainty about this connection (0% = uncertain, 100% = certain)" position="right">
          <label htmlFor="edge-belief" className="block text-xs font-medium text-gray-700 mb-1">
            Belief (epistemic certainty)
          </label>
        </Tooltip>
        <p className="text-[10px] text-gray-500 mb-1.5">0% = uncertain, 100% = certain</p>
        <div className="flex items-center gap-2">
          <input
            id="edge-belief"
            type="range"
            min={EDGE_CONSTRAINTS.belief.min}
            max={EDGE_CONSTRAINTS.belief.max}
            step={EDGE_CONSTRAINTS.belief.step}
            value={belief ?? EDGE_CONSTRAINTS.belief.default}
            onChange={(e) => handleBeliefChange(parseFloat(e.target.value))}
            className="flex-1"
            aria-valuemin={EDGE_CONSTRAINTS.belief.min}
            aria-valuemax={EDGE_CONSTRAINTS.belief.max}
            aria-valuenow={belief ?? EDGE_CONSTRAINTS.belief.default}
            aria-valuetext={`${Math.round((belief ?? EDGE_CONSTRAINTS.belief.default) * 100)}%`}
          />
          <span className="w-14 text-xs font-medium text-gray-900 tabular-nums text-right">
            {Math.round((belief ?? EDGE_CONSTRAINTS.belief.default) * 100)}%
          </span>
        </div>
      </div>

      {/* v1.2: Provenance display (source tracking) */}
      {provenance && (
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Provenance
          </label>
          <div className="flex items-center gap-2">
            <span className={`
              inline-flex items-center px-2 py-1 rounded text-xs font-medium
              ${provenance === 'template' ? 'bg-info-100 text-info-700 border border-info-200' : ''}
              ${provenance === 'user' ? 'bg-carrot-100 text-carrot-700 border border-carrot-200' : ''}
              ${provenance === 'inferred' ? 'bg-gray-100 text-gray-700 border border-gray-200' : ''}
              ${!['template', 'user', 'inferred'].includes(provenance) ? 'bg-gray-100 text-gray-700 border border-gray-200' : ''}
            `}>
              {provenance}
            </span>
          </div>
          <p className="text-[10px] text-gray-500 mt-1">
            {provenance === 'template' && 'Inherited from template'}
            {provenance === 'user' && 'Manually edited'}
            {provenance === 'inferred' && 'System inferred'}
            {!['template', 'user', 'inferred'].includes(provenance) && `Source: ${provenance}`}
          </p>
        </div>
      )}

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
                flex-1 px-3 py-2 text-xs font-medium rounded border transition-colors
                ${style === s
                  ? 'bg-info-50 border-info-500 text-info-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }
              `}
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
      
      {/* Probability - CTA to parent decision */}
      <div className="mb-4">
        <Tooltip content="% likelihood this connector is taken (all from the same step must total 100%)" position="right">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Probability
          </label>
        </Tooltip>
        <div className="p-3 rounded bg-info-50 border border-info-200">
          <p className="text-xs text-gray-600 mb-2">
            Edit probabilities in this decision (or press <kbd className="px-1 py-0.5 text-xs font-semibold bg-gray-100 border border-gray-300 rounded">P</kbd> after selecting)
          </p>
          <button
            type="button"
            onClick={() => {
              // Select the source decision node
              if (edge?.source) {
                selectNodes([edge.source])
                onClose()
              }
            }}
            className="w-full px-3 py-1.5 text-xs font-medium rounded text-white bg-info-500 hover:bg-info-600 transition-colors"
          >
            Go to decision probabilities
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
                className="text-xs underline text-info-600 hover:text-info-700 transition-colors"
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
                className="text-xs underline text-info-600 hover:text-info-700 transition-colors"
                data-testid="btn-edge-reconnect-target"
              >
                Change…
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* v1.2: Reset button (show if edge has been modified or has template) */}
      {(edge?.data?.templateId || weight !== EDGE_CONSTRAINTS.weight.default || belief !== EDGE_CONSTRAINTS.belief.default) && (
        <div className="mb-2 pt-2 border-t border-gray-200">
          <button
            onClick={handleReset}
            className="w-full px-3 py-2 text-sm font-medium text-gray-700 rounded bg-gray-100 hover:bg-gray-200 transition-colors"
            data-testid="btn-edge-reset"
          >
            Reset to Defaults
          </button>
        </div>
      )}

      {/* Delete button */}
      <div className={edge?.data?.templateId || weight !== EDGE_CONSTRAINTS.weight.default || belief !== EDGE_CONSTRAINTS.belief.default ? 'pt-0' : 'pt-2 border-t border-gray-200'}>
        <button
          onClick={handleDelete}
          className="w-full px-3 py-2 text-sm font-medium text-white rounded bg-danger-500 hover:bg-danger-600 transition-colors"
          data-testid="btn-edge-delete"
        >
          Delete Connector
        </button>
      </div>
    </div>
  )
})

EdgeInspector.displayName = 'EdgeInspector'
