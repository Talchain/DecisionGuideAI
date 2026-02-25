/**
 * Edge property inspector — 4-section accordion layout
 * B.I.4: Summary (always open), Assumptions, Appearance, Advanced
 * Debounced sliders (~120ms) with aria-live announcements
 */

import { memo, useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Lightbulb, Check } from 'lucide-react'
import { useCanvasStore } from '../store'
import { EDGE_CONSTRAINTS, type EdgeStyle, type EdgePathType, DEFAULT_EDGE_DATA, getEdgeConfidence } from '../domain/edges'
import { useToast } from '../ToastContext'
import { Tooltip } from '../components/Tooltip'
import { typography } from '../../styles/typography'
import { InspectorAccordion } from './inspector'
import { SignedStrengthSlider } from './inspector/SignedStrengthSlider'
import { StrengthBar } from './inspector/StrengthBar'
import type { WeightSuggestion } from '../decisionReview/types'

interface EdgeInspectorProps {
  edgeId: string
  onClose: () => void
}

export const EdgeInspector = memo(({ edgeId, onClose }: EdgeInspectorProps) => {
  const edges = useCanvasStore(s => s.edges)
  const nodes = useCanvasStore(s => s.nodes)
  const updateEdge = useCanvasStore(s => s.updateEdge)
  const deleteEdge = useCanvasStore(s => s.deleteEdge)
  const beginReconnect = useCanvasStore(s => s.beginReconnect)
  const ceeReview = useCanvasStore(s => s.runMeta.ceeReview)
  // S.3: Post-analysis robustness data for fragile edge detection
  const resultsStatus = useCanvasStore(s => s.results?.status)
  const isResultsMode = resultsStatus === 'complete'
  const robustness = useCanvasStore(s => s.results?.report?.robustness)
  const { showToast } = useToast()

  const edge = edges.find(e => e.id === edgeId)

  // Weight suggestion from CEE/ISL
  const weightSuggestion = useMemo((): WeightSuggestion | undefined => {
    if (!ceeReview?.weight_suggestions) return undefined
    return ceeReview.weight_suggestions.find(s => s.edge_id === edgeId)
  }, [ceeReview?.weight_suggestions, edgeId])

  const suggestionAlreadyApplied = useMemo(() => {
    if (!weightSuggestion) return false
    if (weightSuggestion.auto_applied) return true
    if (edge?.data?.provenance === 'ai-suggested') return true
    return false
  }, [weightSuggestion, edge?.data?.provenance])

  // B.I.6: Compute initial signed value from weight + direction
  const initialSignedValue = useMemo(() => {
    const w = edge?.data?.weight ?? 0.5
    return edge?.data?.direction === 'negative' ? -w : w
  }, [edge?.data?.weight, edge?.data?.direction])

  // S.3: Check if this edge is fragile (in robustness.fragile_edges)
  const isFragileEdge = useMemo(() => {
    if (!robustness?.fragile_edges) return false
    return (robustness.fragile_edges as any[]).some((fe: any) => {
      const feId = fe.edge_id || fe.edgeId || fe
      if (feId === edgeId) return true
      const fromId = fe.from_id ?? fe.fromId ?? fe.source
      const toId = fe.to_id ?? fe.toId ?? fe.target
      return fromId === edge?.source && toId === edge?.target
    })
  }, [robustness, edgeId, edge?.source, edge?.target])

  // S.3: Edge confidence from beliefExists (preferred) or belief (legacy)
  const edgeConfidence = getEdgeConfidence(edge?.data as Record<string, unknown> | undefined)

  // Local state for immediate UI updates
  const [signedValue, setSignedValue] = useState<number>(initialSignedValue)
  const [style, setStyle] = useState<EdgeStyle>(edge?.data?.style ?? 'solid')
  const [curvature, setCurvature] = useState<number>(edge?.data?.curvature ?? 0.15)
  const [pathType, setPathType] = useState<EdgePathType>(edge?.data?.pathType ?? 'bezier')
  const [label, setLabel] = useState<string>(edge?.data?.label ?? '')
  const [belief, setBelief] = useState<number | undefined>(edge?.data?.belief)
  const [provenance, setProvenance] = useState<string>(edge?.data?.provenance ?? '')

  // Debounce timers
  const curvatureTimerRef = useRef<NodeJS.Timeout>()
  const beliefTimerRef = useRef<NodeJS.Timeout>()

  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    return () => {
      clearTimeout(curvatureTimerRef.current)
      clearTimeout(beliefTimerRef.current)
    }
  }, [])

  // B.I.6: Signed slider writes weight + direction separately
  const handleSignedStrengthChange = useCallback((newSignedValue: number) => {
    setSignedValue(newSignedValue)
    const current = edge?.data ?? DEFAULT_EDGE_DATA
    const absWeight = Math.abs(newSignedValue)
    const direction = newSignedValue >= 0 ? 'positive' : 'negative'
    updateEdge(edgeId, { data: { ...current, weight: absWeight, direction } })
    setAnnouncement(`Effect on target set to ${newSignedValue.toFixed(2)}`)
  }, [edgeId, edge?.data, updateEdge])

  const handleStyleChange = useCallback((value: EdgeStyle) => {
    setStyle(value)
    const current = edge?.data ?? DEFAULT_EDGE_DATA
    updateEdge(edgeId, { data: { ...current, style: value } })
    setAnnouncement(`Style changed to ${value}`)
  }, [edgeId, edge?.data, updateEdge])

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

  const handleCurvatureChange = useCallback((value: number) => {
    setCurvature(value)
    clearTimeout(curvatureTimerRef.current)
    curvatureTimerRef.current = setTimeout(() => {
      const current = edge?.data ?? DEFAULT_EDGE_DATA
      updateEdge(edgeId, { data: { ...current, curvature: value } })
      setAnnouncement(`Curvature set to ${(value * 100).toFixed(0)}%`)
    }, 120)
  }, [edgeId, edge?.data, updateEdge])

  const handleLabelBlur = useCallback(() => {
    const current = edge?.data ?? DEFAULT_EDGE_DATA
    updateEdge(edgeId, { data: { ...current, label: label || undefined } })
  }, [edgeId, edge?.data, label, updateEdge])

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
    setSignedValue(weightSuggestion.suggested_weight)
    if (weightSuggestion.suggested_belief !== undefined) {
      setBelief(weightSuggestion.suggested_belief)
    }
    setProvenance('ai-suggested')
    showToast('Applied AI-suggested weight', 'success')
    setAnnouncement(`Applied suggested weight: ${weightSuggestion.suggested_weight.toFixed(2)}`)
  }, [edgeId, edge?.data, weightSuggestion, updateEdge, showToast])

  const handleDelete = useCallback(() => {
    deleteEdge(edgeId)
    showToast('Connector deleted — press ⌘Z to undo.', 'success')
    onClose()
  }, [edgeId, deleteEdge, showToast, onClose])

  const handleReconnectSource = useCallback(() => {
    beginReconnect(edgeId, 'source')
    showToast('Reconnect source: click a node or press Esc to cancel.', 'info')
  }, [edgeId, beginReconnect, showToast])

  const handleReconnectTarget = useCallback(() => {
    beginReconnect(edgeId, 'target')
    showToast('Reconnect target: click a node or press Esc to cancel.', 'info')
  }, [edgeId, beginReconnect, showToast])

  const handleReset = useCallback(() => {
    const current = edge?.data ?? DEFAULT_EDGE_DATA
    const resetData = {
      ...current,
      weight: EDGE_CONSTRAINTS.weight.default,
      belief: EDGE_CONSTRAINTS.belief.default,
      provenance: edge?.data?.templateId ? 'template' : undefined
    }
    updateEdge(edgeId, { data: resetData })
    setSignedValue(EDGE_CONSTRAINTS.weight.default)
    setBelief(EDGE_CONSTRAINTS.belief.default)
    setProvenance(edge?.data?.templateId ? 'template' : '')
    showToast('Edge properties reset to defaults.', 'success')
  }, [edgeId, edge?.data, updateEdge, showToast])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [onClose])

  if (!edge) {
    return (
      <div className={`p-4 ${typography.panelBody} text-text-light`}>
        No edge selected
      </div>
    )
  }

  const sourceLabel = nodes.find(n => n.id === edge.source)?.data?.label || edge.source
  const targetLabel = nodes.find(n => n.id === edge.target)?.data?.label || edge.target

  // Determine direction label for summary based on signed value
  const directionLabel = signedValue < 0 ? 'Hurts' : signedValue > 0 ? 'Helps' : 'Neutral'
  const directionColor = signedValue < 0 ? 'text-danger' : signedValue > 0 ? 'text-success' : 'text-text-light'

  // ─── SUMMARY ───────────────────────────────────────────────────────
  const summaryContent = (
    <div className="pb-2">
      {/* Header with close button */}
      <div className="flex items-center justify-between mb-3">
        <h3 className={`${typography.panelHeader} text-text-header`}>Connection</h3>
        <button
          onClick={onClose}
          className="text-text-light hover:text-text-body text-xl leading-none"
          aria-label="Close inspector"
        >
          ×
        </button>
      </div>

      {/* Source → Target */}
      <div className={`${typography.panelBody} text-text-body mb-2`}>
        <span className="font-medium">{sourceLabel}</span>
        <span className="text-text-light mx-1">→</span>
        <span className="font-medium">{targetLabel}</span>
      </div>

      {/* S.5: Visual strength bar */}
      <div className="mt-2">
        <StrengthBar
          weight={Math.abs(signedValue)}
          direction={signedValue >= 0 ? 'positive' : 'negative'}
        />
      </div>

      {/* S.3: Confidence KPI (read-only) */}
      {edgeConfidence !== null && (
        <div className="flex items-center justify-between mt-2 px-2 py-1 bg-panel rounded border border-panel-border">
          <span className={`${typography.panelMeta} text-text-light`}>Confidence</span>
          <span className={`${typography.panelBody} font-medium text-text-body tabular-nums`}>
            {Math.round(edgeConfidence * 100)}%
          </span>
        </div>
      )}

      {/* S.3: Fragile edge warning pill (post-analysis) */}
      {isFragileEdge && (
        <span className={`inline-flex items-center mt-2 px-2 py-0.5 rounded-full ${typography.panelMeta} bg-danger-light text-danger`}>
          Fragile
        </span>
      )}

      {/* Live region for announcements */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </div>
  )

  // ─── ASSUMPTIONS ───────────────────────────────────────────────────
  const assumptionsContent = (
    <div className="space-y-4">
      {/* Weight Suggestion Banner */}
      {weightSuggestion && !suggestionAlreadyApplied && (
        <div
          className="p-3 rounded-lg bg-info-light border border-info/30"
          role="region"
          aria-label="AI weight suggestion"
          data-testid="weight-suggestion-banner"
        >
          <div className="flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-info flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className={`${typography.panelHeader} text-text-header`}>
                  Suggested weight: {weightSuggestion.suggested_weight.toFixed(2)}
                </span>
                <span className={`
                  ${typography.panelMeta} px-1.5 py-0.5 rounded
                  ${weightSuggestion.confidence === 'high' ? 'bg-success-light text-success' : ''}
                  ${weightSuggestion.confidence === 'medium' ? 'bg-warning-light text-warning' : ''}
                  ${weightSuggestion.confidence === 'low' ? 'bg-panel text-text-light' : ''}
                `}>
                  {weightSuggestion.confidence} confidence
                </span>
              </div>
              <p className={`${typography.panelMeta} text-text-light mb-2 line-clamp-2`}>
                {weightSuggestion.rationale}
              </p>
              <button
                onClick={handleApplySuggestion}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${typography.panelBody} rounded bg-info text-white hover:opacity-90 transition-opacity`}
                data-testid="btn-apply-weight-suggestion"
              >
                <Check className="w-3 h-3" aria-hidden="true" />
                Apply suggestion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* B.I.6: Signed strength slider — writes weight + direction */}
      <div>
        <Tooltip content="How strongly this connection affects the target (-1 = strong negative, +1 = strong positive)" position="right">
          <label className={`block ${typography.panelMeta} font-medium text-text-body mb-1`}>
            Effect on target
          </label>
        </Tooltip>
        <SignedStrengthSlider
          value={signedValue}
          onChange={handleSignedStrengthChange}
        />
      </div>

      {/* B.I.7: Confidence slider with coloured bar */}
      <div>
        <Tooltip content="Your certainty about this connection (0% = uncertain, 100% = certain)" position="right">
          <label htmlFor="edge-belief" className={`block ${typography.panelMeta} font-medium text-text-body mb-1`}>
            Confidence
          </label>
        </Tooltip>
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
          <span className={`w-14 ${typography.panelMeta} text-text-body tabular-nums text-right`}>
            {Math.round((belief ?? EDGE_CONSTRAINTS.belief.default) * 100)}%
          </span>
        </div>
        {/* Confidence bar: green >=50%, red <50% */}
        <div className="h-1.5 bg-panel-border rounded-full overflow-hidden mt-1">
          <div
            className={`h-full rounded-full transition-all duration-200 ${
              (belief ?? EDGE_CONSTRAINTS.belief.default) >= 0.5 ? 'bg-success' : 'bg-danger'
            }`}
            style={{ width: `${Math.max((belief ?? EDGE_CONSTRAINTS.belief.default) * 100, 2)}%` }}
          />
        </div>
      </div>

      {/* Label */}
      <div>
        <label htmlFor="edge-label" className={`block ${typography.panelMeta} font-medium text-text-body mb-1`}>
          Label <span className="text-text-light">(optional)</span>
        </label>
        <textarea
          id="edge-label"
          maxLength={120}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={handleLabelBlur}
          placeholder="Add a label..."
          rows={2}
          className={`w-full ${typography.panelBody} border border-panel-border rounded px-2 py-1`}
        />
        <p className={`${typography.panelMeta} text-text-light mt-1`}>
          Short label for this connection.
        </p>
      </div>
    </div>
  )

  // ─── APPEARANCE ────────────────────────────────────────────────────
  const appearanceContent = (
    <div className="space-y-4">
      {/* Style control */}
      <div>
        <label className={`block ${typography.panelMeta} font-medium text-text-body mb-1`}>
          Style
        </label>
        <div className="flex gap-2" role="radiogroup" aria-label="Edge style">
          {(['solid', 'dashed', 'dotted'] as const).map((s) => (
            <button
              key={s}
              onClick={() => handleStyleChange(s)}
              className={`
                flex-1 px-3 py-2 ${typography.panelBody} rounded border transition-colors
                ${style === s
                  ? 'bg-info-light border-info/30 text-info'
                  : 'bg-panel border-panel-border text-text-body hover:bg-panel-hover'
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

      {/* Path type */}
      <div>
        <Tooltip content="Choose how the connector line is drawn between nodes" position="right">
          <label className={`block ${typography.panelMeta} font-medium text-text-body mb-1`}>
            Path type
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
                flex-1 px-3 py-2 ${typography.panelBody} rounded border transition-colors
                ${pathType === value
                  ? 'bg-info-light border-info/30 text-info'
                  : 'bg-panel border-panel-border text-text-body hover:bg-panel-hover'
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

      {/* Curvature (smoothstep only) */}
      {pathType === 'smoothstep' && (
        <div>
          <Tooltip content="Corner roundness for step paths (0 = sharp corners, max = rounded)" position="right">
            <label htmlFor="edge-curvature" className={`block ${typography.panelMeta} font-medium text-text-body mb-1`}>
              Corner radius
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

      <p className={`${typography.panelMeta} text-text-light italic`}>
        These settings affect how the connection looks on the canvas. They do not affect analysis.
      </p>
    </div>
  )

  // ─── ADVANCED ──────────────────────────────────────────────────────
  const advancedContent = (
    <div className="space-y-4">
      {/* Provenance */}
      {provenance && (
        <div>
          <label className={`block ${typography.panelMeta} font-medium text-text-body mb-1.5`}>
            Provenance
          </label>
          <div className="flex items-center gap-2">
            <span className={`
              inline-flex items-center px-2 py-1 rounded ${typography.panelBody}
              ${provenance === 'template' ? 'bg-info-light text-info border border-info/30' : ''}
              ${provenance === 'user' ? 'bg-danger-light text-danger border border-danger/30' : ''}
              ${provenance === 'inferred' || provenance === 'ai-suggested' ? 'bg-panel text-text-body border border-panel-border' : ''}
              ${!['template', 'user', 'inferred', 'ai-suggested'].includes(provenance) ? 'bg-panel text-text-body border border-panel-border' : ''}
            `}>
              {provenance}
            </span>
          </div>
          <p className={`${typography.panelMeta} text-text-light mt-1`}>
            {provenance === 'template' && 'Inherited from template'}
            {provenance === 'user' && 'Manually edited'}
            {provenance === 'inferred' && 'System inferred'}
            {provenance === 'ai-suggested' && 'Applied from AI suggestion'}
            {!['template', 'user', 'inferred', 'ai-suggested'].includes(provenance) && `Source: ${provenance}`}
          </p>
        </div>
      )}

      {/* Strength std (read-only) */}
      {edge.data?.strengthStd !== undefined && (
        <div className="flex items-center justify-between">
          <span className={`${typography.panelMeta} text-text-light`}>Uncertainty in effect size</span>
          <span className={`${typography.panelMeta} text-text-body tabular-nums`}>
            ±{edge.data.strengthStd.toFixed(3)}
          </span>
        </div>
      )}

      {/* Connection endpoints */}
      <div className="pt-2 border-t border-panel-border">
        <label className={`block ${typography.panelMeta} font-medium text-text-body mb-2`}>
          Connection
        </label>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className={`${typography.panelBody} text-text-light`}>Source:</span>
            <div className="flex items-center gap-2">
              <span className={typography.panelBody}>{sourceLabel}</span>
              <button
                onClick={handleReconnectSource}
                className={`${typography.panelBody} underline text-info hover:opacity-80 transition-opacity`}
                data-testid="btn-edge-reconnect-source"
              >
                Change…
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className={`${typography.panelBody} text-text-light`}>Target:</span>
            <div className="flex items-center gap-2">
              <span className={typography.panelBody}>{targetLabel}</span>
              <button
                onClick={handleReconnectTarget}
                className={`${typography.panelBody} underline text-info hover:opacity-80 transition-opacity`}
                data-testid="btn-edge-reconnect-target"
              >
                Change…
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Reset button */}
      {(edge?.data?.templateId || Math.abs(signedValue) !== EDGE_CONSTRAINTS.weight.default || belief !== EDGE_CONSTRAINTS.belief.default) && (
        <div className="pt-2 border-t border-panel-border">
          <button
            onClick={handleReset}
            className={`w-full px-3 py-2 ${typography.panelHeader} text-text-body rounded bg-panel hover:bg-panel-hover border border-panel-border transition-colors`}
            data-testid="btn-edge-reset"
          >
            Reset to defaults
          </button>
        </div>
      )}

      {/* Delete button */}
      <div>
        <button
          onClick={handleDelete}
          className={`w-full px-3 py-2 ${typography.panelHeader} text-white rounded bg-danger hover:opacity-90 transition-opacity`}
          data-testid="btn-edge-delete"
        >
          Delete connector
        </button>
      </div>
    </div>
  )

  return (
    <div
      className="p-4 border-t border-panel-border"
      role="region"
      aria-label="Edge properties"
      data-testid="panel-edge-properties"
      onKeyDown={handleKeyDown}
    >
      <InspectorAccordion
        summary={summaryContent}
        assumptions={assumptionsContent}
        appearance={appearanceContent}
        advanced={advancedContent}
        defaultOpen="assumptions"
        testId="edge-inspector"
      />
    </div>
  )
})

EdgeInspector.displayName = 'EdgeInspector'
