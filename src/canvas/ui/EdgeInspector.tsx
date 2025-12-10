/**
 * Edge property inspector
 * Debounced sliders (~120ms) with aria-live announcements
 * British English: visualisation, colour
 */

import { memo, useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Lightbulb, Check } from 'lucide-react'
import { useCanvasStore } from '../store'
import { EDGE_CONSTRAINTS, type EdgeStyle, type EdgePathType, type EdgeFunctionType, type EdgeFunctionParams, DEFAULT_EDGE_DATA } from '../domain/edges'
import { useToast } from '../ToastContext'
import { Tooltip } from '../components/Tooltip'
import { BeliefInput } from '../components/BeliefInput'
import { EdgeFunctionTypeSelector } from '../components/EdgeFunctionTypeSelector'
import type { WeightSuggestion } from '../decisionReview/types'

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
  const ceeReview = useCanvasStore(s => s.runMeta.ceeReview)
  const { showToast } = useToast()

  const edge = edges.find(e => e.id === edgeId)

  // Find weight suggestion for this edge (if any)
  const weightSuggestion = useMemo((): WeightSuggestion | undefined => {
    if (!ceeReview?.weight_suggestions) return undefined
    return ceeReview.weight_suggestions.find(s => s.edge_id === edgeId)
  }, [ceeReview?.weight_suggestions, edgeId])

  // Check if this suggestion was already applied (via provenance marker or auto_applied flag)
  const suggestionAlreadyApplied = useMemo(() => {
    if (!weightSuggestion) return false
    if (weightSuggestion.auto_applied) return true
    // Check if user applied via "Apply suggestion" button (sets provenance to 'ai-suggested')
    if (edge?.data?.provenance === 'ai-suggested') return true
    return false
  }, [weightSuggestion, edge?.data?.provenance])

  // Local state for immediate UI updates with proper defaults
  const [weight, setWeight] = useState<number>(edge?.data?.weight ?? 0.5)
  const [style, setStyle] = useState<EdgeStyle>(edge?.data?.style ?? 'solid')
  const [curvature, setCurvature] = useState<number>(edge?.data?.curvature ?? 0.15)
  const [pathType, setPathType] = useState<EdgePathType>(edge?.data?.pathType ?? 'bezier')
  const [label, setLabel] = useState<string>(edge?.data?.label ?? '')
  const [belief, setBelief] = useState<number | undefined>(edge?.data?.belief) // v1.2
  const [provenance, setProvenance] = useState<string>(edge?.data?.provenance ?? '') // v1.2
  // Phase 3: Function type and params
  const [functionType, setFunctionType] = useState<EdgeFunctionType>(edge?.data?.functionType ?? 'linear')
  const [functionParams, setFunctionParams] = useState<EdgeFunctionParams | undefined>(edge?.data?.functionParams)
  
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

  // Immediate path type update (no debounce needed for discrete choice)
  const handlePathTypeChange = useCallback((value: EdgePathType) => {
    setPathType(value)
    const current = edge?.data ?? DEFAULT_EDGE_DATA
    updateEdge(edgeId, { data: { ...current, pathType: value } })
    const labels: Record<EdgePathType, string> = {
      bezier: 'Curved',
      smoothstep: 'Step',
      straight: 'Straight',
    }
    setAnnouncement(`Path type changed to ${labels[value]}`)
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

  // Phase 3: Handle function type and params change
  const handleFunctionTypeChange = useCallback((type: EdgeFunctionType, params?: EdgeFunctionParams) => {
    setFunctionType(type)
    setFunctionParams(params)
    const current = edge?.data ?? DEFAULT_EDGE_DATA
    updateEdge(edgeId, { data: { ...current, functionType: type, functionParams: params } })
    setAnnouncement(`Function type changed to ${type}`)
  }, [edgeId, edge?.data, updateEdge])

  // Phase 3: Handle function provenance change
  const handleFunctionProvenanceChange = useCallback((newProvenance: string) => {
    setProvenance(newProvenance)
    const current = edge?.data ?? DEFAULT_EDGE_DATA
    updateEdge(edgeId, { data: { ...current, provenance: newProvenance } })
  }, [edgeId, edge?.data, updateEdge])

  // Apply weight suggestion from CEE/ISL
  const handleApplySuggestion = useCallback(() => {
    if (!weightSuggestion) return
    const current = edge?.data ?? DEFAULT_EDGE_DATA
    const updates: Record<string, number | string | undefined> = {
      ...current,
      weight: weightSuggestion.suggested_weight,
      provenance: 'ai-suggested',
    }
    if (weightSuggestion.suggested_belief !== undefined) {
      updates.belief = weightSuggestion.suggested_belief
    }
    updateEdge(edgeId, { data: updates })
    setWeight(weightSuggestion.suggested_weight)
    if (weightSuggestion.suggested_belief !== undefined) {
      setBelief(weightSuggestion.suggested_belief)
    }
    setProvenance('ai-suggested')
    showToast('Applied AI-suggested weight', 'success')
    setAnnouncement(`Applied suggested weight: ${weightSuggestion.suggested_weight.toFixed(2)}`)
  }, [edgeId, edge?.data, weightSuggestion, updateEdge, showToast])
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

      {/* Weight Suggestion Banner (when ISL/CEE provides one) */}
      {weightSuggestion && !suggestionAlreadyApplied && (
        <div
          className="mb-4 p-3 rounded-lg bg-sky-50 border border-sky-200"
          role="region"
          aria-label="AI weight suggestion"
          data-testid="weight-suggestion-banner"
        >
          <div className="flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-sky-900">
                  Suggested weight: {weightSuggestion.suggested_weight.toFixed(2)}
                </span>
                <span className={`
                  text-[10px] px-1.5 py-0.5 rounded font-medium
                  ${weightSuggestion.confidence === 'high' ? 'bg-mint-100 text-mint-700' : ''}
                  ${weightSuggestion.confidence === 'medium' ? 'bg-sun-100 text-sun-700' : ''}
                  ${weightSuggestion.confidence === 'low' ? 'bg-gray-100 text-gray-600' : ''}
                `}>
                  {weightSuggestion.confidence} confidence
                </span>
              </div>
              <p className="text-[11px] text-sky-700 mb-2 line-clamp-2">
                {weightSuggestion.rationale}
              </p>
              <button
                onClick={handleApplySuggestion}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-sky-500 text-white hover:bg-sky-600 transition-colors"
                data-testid="btn-apply-weight-suggestion"
              >
                <Check className="w-3 h-3" aria-hidden="true" />
                Apply suggestion
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* v1.2: Belief control (epistemic certainty) with natural language input */}
      <div className="mb-4">
        <BeliefInput
          value={belief ?? EDGE_CONSTRAINTS.belief.default}
          onChange={handleBeliefChange}
          label="Belief (certainty)"
          factorContext={{
            label: edge?.data?.label || 'this connection',
            node_id: edge?.source,
          }}
          min={EDGE_CONSTRAINTS.belief.min}
          max={EDGE_CONSTRAINTS.belief.max}
          step={EDGE_CONSTRAINTS.belief.step}
          placeholder="e.g., 'fairly confident' or 'about 70-80%'"
        />
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

      {/* Path type control */}
      <div className="mb-4">
        <Tooltip content="Choose how the connector line is drawn between nodes" position="right">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Path Type
          </label>
        </Tooltip>
        <div className="flex gap-2" role="radiogroup" aria-label="Edge path type">
          {([
            { value: 'bezier' as const, label: 'Curved', icon: '⟿' },
            { value: 'smoothstep' as const, label: 'Step', icon: '⊢' },
            { value: 'straight' as const, label: 'Straight', icon: '╲' },
          ]).map(({ value, label: pathLabel, icon }) => (
            <button
              key={value}
              onClick={() => handlePathTypeChange(value)}
              className={`
                flex-1 px-3 py-2 text-xs font-medium rounded border transition-colors
                ${pathType === value
                  ? 'bg-info-50 border-info-500 text-info-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }
              `}
              role="radio"
              aria-checked={pathType === value}
              title={pathLabel}
            >
              <span className="mr-1">{icon}</span>
              {pathLabel}
            </button>
          ))}
        </div>
      </div>

      {/* Curvature control (only for smoothstep) */}
      {pathType === 'smoothstep' && (
        <div className="mb-4">
          <Tooltip content="Corner roundness for step paths (0 = sharp corners, max = rounded)" position="right">
            <label htmlFor="edge-curvature" className="block text-xs font-medium text-gray-700 mb-1">
              Corner Radius
            </label>
          </Tooltip>
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
      )}

      {/* Phase 3: Function Type Selector */}
      <div className="mb-4 pt-4 border-t border-gray-200">
        <EdgeFunctionTypeSelector
          edgeId={edgeId}
          value={functionType}
          params={functionParams}
          onChange={handleFunctionTypeChange}
          provenance={provenance}
          onProvenanceChange={handleFunctionProvenanceChange}
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
