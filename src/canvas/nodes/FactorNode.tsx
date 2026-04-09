import { memo, useMemo, useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { EvidenceGapBadge } from './EvidenceGapBadge'
import type { EvidenceGapEscalation } from './EvidenceGapBadge'
import { ConstraintBadge } from './ConstraintBadge'
import { NODE_REGISTRY } from '../domain/nodes'
import { useCanvasStore } from '../store'
import { deriveControllability } from '../utils/graphDisplayCalculations'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { hasObservedData, isFactorNeedsInput } from '../utils/observedStateHelpers'
import { typography } from '../../styles/typography'
import { cleanFactorLabel, formatInterventionValue, isSuppressedUnit, unwrapInterventionValue } from '../utils/labelUtils'
import { formatFactorDisplayValue } from '../../utils/formatFactorDisplayValue'
import { isGraphBadgesEnabled } from '../../flags'
import { SlidersHorizontal, Eye, Cloud } from 'lucide-react'
import { DataBar } from '../ui/shared/DataBar'
import { CoachingCard } from '../components/CoachingCard'
import { useNodeConnections } from '../hooks/useNodeConnections'
import { usePopoverHover } from '../hooks/usePopoverHover'
import { useScienceIcons } from '../hooks/useScienceIcons'
import { ConnRow, Sep, NodeChip, ActionIcons, MetricPills, NodePopover, ScienceIcon, EdgePills } from './shared'
import { useGuidanceStore } from '../stores/guidanceStore'
import { computeSignedMean } from '../domain/edges'

interface ObservedState {
  value?: number
  raw_value?: string | number
  baseline?: number
  unit?: string
  source?: string
  extractionType?: 'explicit' | 'inferred'
  factor_type?: string
  cap?: number
  uncertainty_drivers?: string[]
  /** CEE-provided display text. When present, UI renders verbatim. */
  display_value?: string | null
}

export const FactorNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.factor
  const observedState = props.data?.observedState as ObservedState | undefined

  const cleanedLabel = cleanFactorLabel((props.data?.label as string | undefined) ?? '')
  const cleanedData = cleanedLabel ? { ...props.data, label: cleanedLabel } : props.data

  const hoveredOptionId = useCanvasStore(state => state.hoveredOptionId)
  const nodes = useCanvasStore(state => state.nodes)
  const edges = useCanvasStore(state => state.edges)
  const ceeAnalysisReady = useCanvasStore(state => state.ceeAnalysisReady)
  const resultsStatus = useCanvasStore(state => state.results.status)
  const resultsReport = useCanvasStore(state => state.results.report)
  const viewMode = useCanvasStore(state => state.viewMode)
  const isPostAnalysis = resultsStatus === 'complete'
  const isDetailed = viewMode === 'expert'

  const nodeCategory = props.data?.category as string | undefined
  const controllability = useMemo(() => {
    if (!isPostAnalysis) return undefined
    return deriveControllability(props.id, ceeAnalysisReady?.options, edges, nodeCategory)
  }, [props.id, ceeAnalysisReady?.options, edges, isPostAnalysis, nodeCategory])

  const displayMetadata = useNodeDisplayMetadata(props.id, 'factor')
  const scienceIcons = useScienceIcons(props.id, 'factor')

  // Graph v1.1 Task 2: priority ranking — top 3 stay full-fat, others get
  // visually quieted in Standard view. Post-analysis uses sensitivityRank
  // (already top-3 from displayMetadata); pre-analysis ranks by structural
  // centrality, mirroring EdgePills (sum of |signed mean| of outbound edges
  // whose target is an outcome or risk — those are the surfaces users care
  // about pre-analysis). Tiny graphs (≤3 factors) treat every factor as
  // high-priority since there's nothing to quieten.
  const preAnalysisFactorRank = useMemo<number | null>(() => {
    if (isPostAnalysis) return null
    const factorNodes = nodes.filter(n => n.type === 'factor' || n.data?.type === 'factor')
    if (factorNodes.length <= 3) return 1
    // Single O(N + E) pass: build a map of factor id → weight sum, then sort.
    const scores = new Map<string, number>()
    for (const f of factorNodes) scores.set(f.id, 0)
    for (const e of edges) {
      if (!scores.has(e.source)) continue
      const target = nodes.find(n => n.id === e.target)
      if (!target) continue
      const targetKind = target.type ?? target.data?.type
      if (targetKind !== 'outcome' && targetKind !== 'risk') continue
      const weight = Math.abs(computeSignedMean(e.data as Record<string, unknown> | undefined))
      scores.set(e.source, (scores.get(e.source) ?? 0) + weight)
    }
    const sorted = Array.from(scores.entries()).sort((a, b) => b[1] - a[1])
    const idx = sorted.findIndex(([id]) => id === props.id)
    return idx < 0 ? null : idx + 1
  }, [isPostAnalysis, nodes, edges, props.id])

  const priorityRank: number | null = isPostAnalysis
    ? displayMetadata.sensitivityRank
    : preAnalysisFactorRank
  const isHighPriority = priorityRank != null && priorityRank <= 3
  const isLowPriority = !isHighPriority

  const interventionValue = useMemo(() => {
    if (!hoveredOptionId) return null
    const hoveredOption = nodes.find(n => n.id === hoveredOptionId)
    if (!hoveredOption?.data?.interventions) return null
    const interventions = hoveredOption.data.interventions as Record<string, unknown>
    return unwrapInterventionValue(interventions[props.id])
  }, [hoveredOptionId, nodes, props.id])

  const isAffectedByHover = interventionValue !== null

  // Graph v2 Task 3: per-option comparison table for the popover.
  // Suppressed for external factors and rendered in both phases. Ordering:
  //   post: leader first → win prob desc → status quo last
  //   pre:  canvas order → status quo last
  // Status quo detection prefers an explicit `is_baseline` flag, falling back
  // to an epsilon delta against the factor's current value.
  //
  // Data source: ceeAnalysisReady.options[id].interventions is canonical
  // (CEE-normalised). Falls back to node.data.interventions when CEE has not
  // synthesised yet — mirrors OptionNode.interventionChips.
  const optionComparisonRows = useMemo(() => {
    if (nodeCategory === 'external') return null
    const optionNodes = nodes.filter(n => (n.type === 'option') || (n.data?.type === 'option'))
    if (optionNodes.length === 0) return null

    const recommendedId = isPostAnalysis
      ? ((resultsReport as any)?.robustness?.recommended_option_id as string | undefined)
      : undefined
    const winProbs = isPostAnalysis
      ? ((resultsReport as any)?.option_probabilities ?? {})
      : {}

    type Row = {
      id: string
      node: typeof optionNodes[number]
      hasIntervention: boolean
      value: number | null
      isStatusQuo: boolean
      winProb: number
    }

    const withMeta: Row[] = optionNodes.map(opt => {
      // Primary: ceeAnalysisReady (canonical post-CEE source)
      const ceeOption = ceeAnalysisReady?.options?.find(o => o.id === opt.id)
      let interventions: Record<string, unknown> | undefined
      if (ceeOption?.interventions && typeof ceeOption.interventions === 'object') {
        interventions = ceeOption.interventions as Record<string, unknown>
      } else {
        // Fallback: option node data.interventions (pre-CEE state)
        interventions = (opt.data as any)?.interventions as Record<string, unknown> | undefined
      }
      const raw = interventions?.[props.id]
      const hasIntervention = raw !== undefined
      const value = unwrapInterventionValue(raw)
      // Prefer explicit is_baseline; fall back to epsilon delta against factor value
      const explicitBaseline = (opt.data as any)?.is_baseline === true
      const epsilonStatusQuo =
        !explicitBaseline
        && hasIntervention
        && value != null
        && observedState?.value != null
        && Math.abs(value - observedState.value) < 1e-6
      const isStatusQuo = explicitBaseline || epsilonStatusQuo
      const winProb = (winProbs[opt.id] as any)?.win_probability ?? -1
      return { id: opt.id, node: opt, hasIntervention, value, isStatusQuo, winProb }
    })

    // Sort
    if (isPostAnalysis) {
      withMeta.sort((a, b) => {
        if (a.isStatusQuo && !b.isStatusQuo) return 1
        if (!a.isStatusQuo && b.isStatusQuo) return -1
        if (a.id === recommendedId) return -1
        if (b.id === recommendedId) return 1
        return b.winProb - a.winProb
      })
    } else {
      // Canvas order, status quo last
      withMeta.sort((a, b) => (a.isStatusQuo ? 1 : 0) - (b.isStatusQuo ? 1 : 0))
    }

    // Truncate: max 4 rows. If more, top 3 non-status-quo + status quo (if present).
    const statusQuo = withMeta.find(r => r.isStatusQuo)
    const nonSq = withMeta.filter(r => !r.isStatusQuo)
    let visibleRows = withMeta
    let overflow = 0
    if (withMeta.length > 4) {
      visibleRows = [...nonSq.slice(0, 3), ...(statusQuo ? [statusQuo] : [])]
      overflow = withMeta.length - visibleRows.length
    }

    const rows = visibleRows.map(r => {
      let displayValue: string
      if (r.isStatusQuo || !r.hasIntervention) {
        // Status quo rows always read "no change" — matches the brief example
        // ("○ No New Hire   no change") even when an explicit intervention
        // value is present that happens to equal the baseline.
        displayValue = 'no change'
      } else if (r.value != null) {
        const formatted = formatInterventionValue(
          r.value,
          observedState?.unit,
          observedState?.factor_type,
          observedState?.cap,
          observedState?.value,
          observedState?.raw_value,
          { preserveTierLabel: true },
        )
        displayValue = formatted || 'set'
      } else {
        displayValue = 'set'
      }
      const rawLabel = ((r.node.data as any)?.label as string | undefined) ?? r.id
      const label = rawLabel.length > 20 ? rawLabel.slice(0, 20) + '…' : rawLabel
      return { id: r.id, label, displayValue }
    })

    return { rows, overflow }
  }, [nodes, props.id, nodeCategory, isPostAnalysis, resultsReport, observedState, ceeAnalysisReady])

  // Contextual value display via formatFactorDisplayValue
  const valueDisplay = useMemo(() => {
    if (!observedState) return null
    return formatFactorDisplayValue({
      label: cleanedLabel,
      value: observedState.value ?? null,
      raw_value: observedState.raw_value ?? null,
      unit: isSuppressedUnit(observedState.unit) ? null : (observedState.unit ?? null),
      factor_type: observedState.factor_type ?? null,
      cap: observedState.cap ?? null,
      category: nodeCategory ?? null,
      display_value: observedState.display_value ?? null,
    })
  }, [observedState, cleanedLabel, nodeCategory])

  // Prior range for external factors (only the range values, no "Variable" prefix)
  const priorRangeDisplay = useMemo(() => {
    const prior = props.data?.prior as { range_min?: number; range_max?: number } | undefined
    if (nodeCategory !== 'external' || !prior?.range_min || !prior?.range_max) return null
    const unit = observedState?.unit && !isSuppressedUnit(observedState.unit) ? observedState.unit : null
    if (!unit) return null
    const cap = observedState?.cap
    const min = cap != null && cap > 1 ? prior.range_min * cap : prior.range_min
    const max = cap != null && cap > 1 ? prior.range_max * cap : prior.range_max
    // Format range values
    const fmt = (v: number) => {
      if (['£', '$', '€', '¥'].includes(unit)) return `${unit}${Math.round(v).toLocaleString('en-GB')}`
      if (unit === '%') return `${Math.round(v * 100)}%`
      return `${Math.round(v)} ${unit}`
    }
    return `Range: ${fmt(min)} to ${fmt(max)}`
  }, [nodeCategory, observedState?.unit, observedState?.cap, props.data?.prior])

  const isInferred = observedState?.extractionType === 'inferred'
  const isExplicit = observedState?.extractionType === 'explicit'
  // Single source of truth shared with BaseNode's StatusPill (wireframe v4
  // FactorNeedsPre): all of value/raw_value/display_value null AND non-external.
  const needsInput = isFactorNeedsInput(props.data)

  const externalWithPrior = nodeCategory === 'external' && props.data?.prior != null
  const showEvidenceGapBadge =
    isGraphBadgesEnabled() && !hasObservedData(props.data) && !externalWithPrior

  const gapEscalation: EvidenceGapEscalation = useMemo(() => {
    if (!displayMetadata.isResultsMode) return 'none'
    const voi = displayMetadata.valueOfInformation
    if (voi == null) return 'none'
    if (voi > 0.20 && displayMetadata.voiRank !== null && displayMetadata.voiRank <= 3) return 'critical'
    if (voi > 0.05) return 'warning'
    return 'none'
  }, [displayMetadata.isResultsMode, displayMetadata.valueOfInformation, displayMetadata.voiRank])

  const goalConstraints = useCanvasStore(state => state.goalConstraints)
  const constraintTooltip = useMemo(() => {
    if (!isGraphBadgesEnabled() || !goalConstraints?.length) return null
    const matching = goalConstraints.filter(c =>
      c.label.toLowerCase().trim() === cleanedLabel.toLowerCase().trim()
    )
    if (matching.length === 0) return null
    return matching.map(c => `Constrained: ${c.label} ${c.operator} ${c.value ?? '-'}`).join('; ')
  }, [goalConstraints, cleanedLabel])

  // Anchoring detection (Detailed, pre-analysis)
  const anchoringMessage = useMemo(() => {
    if (!isDetailed || isPostAnalysis) return null
    const options = ceeAnalysisReady?.options
    if (!options || options.length < 3) return null
    const vals: number[] = []
    for (const opt of options) {
      // unwrapInterventionValue handles plain numbers, V3 objects, and
      // returns null for malformed/missing entries (no Number() coercion).
      const v = unwrapInterventionValue((opt.interventions as Record<string, unknown> | undefined)?.[props.id])
      if (v != null) vals.push(v)
    }
    if (vals.length < 3) return null
    const baseline = observedState?.value ?? vals[0] ?? 0.01
    const spread = Math.max(...vals) - Math.min(...vals)
    if (spread / Math.max(Math.abs(baseline), 0.01) < 0.2) {
      return valueDisplay ?? String(baseline)
    }
    return null
  }, [isDetailed, isPostAnalysis, ceeAnalysisReady, props.id, observedState?.value, valueDisplay])

  const outboundConnections = useNodeConnections(props.id, 'outbound')

  const handleConfirm = useCallback(() => {
    if (!observedState) return
    const store = useCanvasStore.getState()
    const node = store.nodes.find(n => n.id === props.id)
    if (!node) return
    store.updateNode(props.id, {
      data: { ...node.data, observedState: { ...observedState, extractionType: 'explicit' as const } },
    })
  }, [props.id, observedState])

  const influencePct = displayMetadata.influence != null ? Math.round(displayMetadata.influence * 100) : null
  const confidencePct = displayMetadata.confidence != null ? Math.round(displayMetadata.confidence * 100) : null

  // Graph v1.1 Task 3: synthesised one-line coaching for Standard view post-analysis
  // top-ranked factors. This replaces standalone coaching text (BiasNote etc.) on
  // the same node so there's a single source of guidance.
  const synthesisedCoaching = useMemo<{ prefix: string } | null>(() => {
    if (!isPostAnalysis || !isHighPriority) return null
    if (influencePct == null || confidencePct == null) return null
    if (influencePct >= 70 && confidencePct <= 40) return { prefix: 'High influence, low confidence.' }
    if (influencePct >= 70 && confidencePct > 40 && isInferred) return { prefix: 'Key driver.' }
    if (influencePct < 70 && confidencePct <= 40) return { prefix: 'Low confidence.' }
    return null
  }, [isPostAnalysis, isHighPriority, influencePct, confidencePct, isInferred])

  const { showPopover, nodeHandlers, popoverHandlers, nodeElRef } = usePopoverHover()

  const handleViewParams = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const store = useCanvasStore.getState()
    store.onSelectionChange({ nodes: [{ id: props.id } as any], edges: [] })
    store.setShowInspectorPanel(true)
  }, [props.id])

  // Connected outcomes count for external popover text
  const outcomesAffected = useMemo(() => {
    return edges.filter(e => e.source === props.id).length
  }, [edges, props.id])

  // ----- Layer 2 content (popover in Standard, inline in Detailed) -----

  // Graph v2 Task 3: per-option comparison table block. Rendered ONLY inside
  // the Standard popover (never the inline Detailed body, never the node
  // body), gated by `nodeCategory !== 'external'` and `optionComparisonRows`.
  // The `withSep` flag controls whether a leading separator renders — true
  // when stacked beneath other layer-2 content, false when the table is the
  // popover's only content (low-priority controllable case).
  const renderOptionValuesBlock = (withSep: boolean) =>
    optionComparisonRows && optionComparisonRows.rows.length > 0 ? (
      <>
        {withSep && <Sep />}
        <p className={`${typography.edgeLabel} font-medium text-text-body m-0 mb-0.5`}>Option values:</p>
        <div className="space-y-0.5">
          {optionComparisonRows.rows.map(row => (
            <div key={row.id} className="flex items-center gap-1">
              <div className="w-[10px] h-[10px] rounded-sm bg-option flex-shrink-0" />
              <span className={`${typography.edgeLabel} text-text-body flex-1 truncate`}>
                {row.label}
              </span>
              <span className={`${typography.edgeLabel} font-semibold text-right ${
                row.displayValue === 'no change' ? 'text-text-light' : 'text-text-body'
              }`}>
                {row.displayValue}
              </span>
            </div>
          ))}
          {optionComparisonRows.overflow > 0 && (
            <div className={`${typography.edgeLabel} text-info mt-0.5`}>
              {optionComparisonRows.overflow} more in inspector
            </div>
          )}
        </div>
      </>
    ) : null

  const hasOptionValues = optionComparisonRows != null && optionComparisonRows.rows.length > 0

  const preAnalysisLayer2 = !isPostAnalysis ? (
    <>
      {/* Pre-analysis coaching line — Polish 4 Task 3: only on top-3 factors.
          Detailed view shows more evidence (ConnRows, bars, parameters), not
          coaching on every node. Standard view already gates the popover via
          isHighPriority. */}
      {isInferred && isHighPriority && (
        <p className={`${typography.edgeLabel} text-text-body m-0 mb-1`}>
          Olumi estimated this from your brief. High leverage, low evidence.
        </p>
      )}
      {isExplicit && isHighPriority && outboundConnections.length > 0 && (
        <p className={`${typography.edgeLabel} text-text-body m-0 mb-1`}>
          You provided this value. It strongly influences {outboundConnections[0]?.connectedNodeLabel ?? 'connected outcomes'}.
        </p>
      )}
      {nodeCategory === 'external' && outcomesAffected > 0 && (
        <p className={`${typography.edgeLabel} text-text-body m-0 mb-1`}>
          Uncertainty here affects {outcomesAffected} outcome{outcomesAffected !== 1 ? 's' : ''}.
        </p>
      )}
      {/* Connection list with strengths */}
      {outboundConnections.length > 0 && (
        <>
          <Sep />
          {outboundConnections.slice(0, isDetailed ? 5 : 3).map(conn => (
            <ConnRow
              key={conn.edgeId}
              edgeId={conn.edgeId}
              nodeKind={conn.connectedNodeKind}
              label={conn.connectedNodeLabel}
              confidencePct={conn.confidencePct}
            />
          ))}
        </>
      )}
      {/* Polish 4 review: pre-analysis coaching chips removed from the
          popover to honour the chip audit table — the body now carries the
          single canonical chip ("What evidence supports this?" for top-3
          inferred factors). Explicit factors get no chip per the audit. */}
      {/* "What if this changes?" chip is in the node body for external factors — not duplicated here */}
      {/* Detailed pre-analysis: uncertainty drivers */}
      {isDetailed && observedState?.uncertainty_drivers && observedState.uncertainty_drivers.length > 0 && (
        <>
          <Sep />
          <p className={`${typography.edgeLabel} font-medium text-text-body m-0 mb-0.5`}>Uncertainty drivers:</p>
          {observedState.uncertainty_drivers.map((d, i) => (
            <p key={i} className={`${typography.edgeLabel} text-text-light m-0`}>{d}</p>
          ))}
        </>
      )}
    </>
  ) : null

  const postAnalysisLayer2 = isPostAnalysis ? (
    <>
      {/* Influence & Confidence bars */}
      {(influencePct != null && influencePct > 0 || confidencePct != null && confidencePct > 0) && (
        <div className="space-y-1.5 mb-1">
          {influencePct != null && influencePct > 0 && (
            <div className="flex items-center gap-1.5">
              <span className={`${typography.edgeLabel} text-text-light w-14 shrink-0`}>Influence</span>
              <div className="flex-1 min-w-0">
                <DataBar value={influencePct / 100} label="Influence" colour="info" />
              </div>
              <span className={`${typography.edgeLabel} text-text-light w-7 text-right shrink-0`}>{influencePct}%</span>
            </div>
          )}
          {confidencePct != null && confidencePct > 0 && (
            <div className="flex items-center gap-1.5">
              <span className={`${typography.edgeLabel} text-text-light w-14 shrink-0`}>Confidence</span>
              <div className="flex-1 min-w-0">
                <DataBar value={confidencePct / 100} label="Confidence" colour="info" />
              </div>
              <span className={`${typography.edgeLabel} text-text-light w-7 text-right shrink-0`}>{confidencePct}%</span>
            </div>
          )}
        </div>
      )}
      {/* ConnRows (max 3 in popover, max 5 in Detailed) */}
      {outboundConnections.length > 0 && (
        <>
          <Sep />
          <p className={`${typography.edgeLabel} font-medium text-text-body m-0 mb-0.5`}>Influences:</p>
          {outboundConnections.slice(0, isDetailed ? 5 : 3).map(conn => (
            <ConnRow
              key={conn.edgeId}
              edgeId={conn.edgeId}
              nodeKind={conn.connectedNodeKind}
              label={conn.connectedNodeLabel}
              confidencePct={conn.confidencePct}
            />
          ))}
        </>
      )}
      {/* BiasNote (max 1) — suppressed when a synthesised coaching line is
          already shown on the node body (Graph v1.1 Task 3: no duplicate
          messaging within a single node). Detailed view keeps the BiasNote
          inline since the synthesised line is Standard-only. */}
      {!synthesisedCoaching && displayMetadata.sensitivityRank != null && displayMetadata.sensitivityRank <= 2 && isInferred && (
        <>
          <Sep />
          <div className="flex items-center gap-1 py-0.5 px-1.5 bg-warning/10 rounded">
            <span className={`${typography.edgeLabel} text-text-body`}>Key assumption unvalidated. Your result depends on this.</span>
          </div>
        </>
      )}
    </>
  ) : null

  const layer2Content = isPostAnalysis ? postAnalysisLayer2 : preAnalysisLayer2

  return (
    <div
      ref={nodeElRef as React.Ref<HTMLDivElement>}
      style={{ position: 'relative' }}
      onMouseEnter={nodeHandlers.onMouseEnter}
      onMouseLeave={nodeHandlers.onMouseLeave}
    >
      {showEvidenceGapBadge && <EvidenceGapBadge label={cleanedLabel} escalation={gapEscalation} />}
      {constraintTooltip && <ConstraintBadge tooltip={constraintTooltip} />}
      {isAffectedByHover && (
        <div
          className="absolute -inset-1 rounded-xl border-2 border-info pointer-events-none -z-10"
          style={{ boxShadow: '0 0 12px var(--info)' }}
        />
      )}
      <BaseNode
        {...props}
        data={{ ...cleanedData, controllability }}
        nodeType="factor"
        icon={metadata.icon}
        headerSlot={(() => {
          // Graph v1.1 Task 2: low-priority factors keep their identity cues
          // (sparkle for inferred, fileQuestion for needs-input) but lose extra
          // science icons in Standard view. Detailed view always shows the full
          // set. The needs-input fileQuestion icon is preserved regardless of
          // priority because the truth table mandates it.
          const KEEP_LOW_PRIORITY = new Set(['olumi-estimate', 'evidence-gap'])
          const visibleIcons = (!isDetailed && isLowPriority)
            ? scienceIcons.filter(si => KEEP_LOW_PRIORITY.has(si.id))
            : scienceIcons
          if (visibleIcons.length === 0) return undefined
          return (
            <span className="inline-flex items-center gap-1">
              {visibleIcons.map(si => (
                <ScienceIcon key={si.id} icon={si.icon} tooltip={si.tooltip} action={si.action} colour={si.colour} />
              ))}
            </span>
          )
        })()}
      >
        {/* Intervention highlight when option hovered. Polish 4 review fix:
            formatInterventionValue can return '' for scale-unit factors
            with no raw_value anchor (the meaningless-unit suppression
            path). When that happens we fall back to a directional cue
            ("Intervention: ↑" / "↓") instead of leaving a dangling label. */}
        {isAffectedByHover && (() => {
          const formatted = formatInterventionValue(
            interventionValue,
            observedState?.unit,
            observedState?.factor_type,
            observedState?.cap,
            observedState?.value,
            observedState?.raw_value,
          )
          if (formatted) {
            return (
              <div className={`${typography.nodeTitle} text-info mb-1 bg-panel px-1.5 py-0.5 rounded border border-info/30`}>
                Intervention: {formatted}
              </div>
            )
          }
          // Empty formatter result → fall back to a direction-only cue.
          const baseline = observedState?.value ?? 0
          const direction = interventionValue! > baseline ? '↑ Increase' : interventionValue! < baseline ? '↓ Decrease' : 'No change'
          return (
            <div className={`${typography.nodeTitle} text-info mb-1 bg-panel px-1.5 py-0.5 rounded border border-info/30`}>
              Intervention: {direction}
            </div>
          )
        })()}

        {/* ===== LAYER 1: Standard body ===== */}

        {/* Value display (contextual) — null for needs-input and empty externals */}
        {valueDisplay !== null && (
          <div className={`${typography.nodeLabel} mt-1 text-text-body`}>
            {valueDisplay}
          </div>
        )}

        {/* External factor: prior range (if available) */}
        {nodeCategory === 'external' && priorRangeDisplay && (
          <div className={`${typography.edgeLabel} mt-0.5 text-text-light`}>{priorRangeDisplay}</div>
        )}

        {/* Needs input: chip only (no body text per spec) */}
        {needsInput && !isPostAnalysis && (
          <div className="mt-1.5">
            <NodeChip label="Help me estimate this" message={`Help me estimate a reasonable value for ${cleanedLabel}`} />
          </div>
        )}

        {/* Pre-analysis: edge pills (entity shape + strength %) — shown for both
            high- and low-priority factors per wireframe v4 FactorLowPre. They are
            the structural cue that conveys relative influence pre-analysis. */}
        {!isPostAnalysis && !needsInput && (
          <EdgePills nodeId={props.id} />
        )}

        {/* Pre-analysis: external factor coaching chip — quieted on low-priority
            Standard view. */}
        {!isPostAnalysis && nodeCategory === 'external' && (isDetailed || isHighPriority) && (
          <div className="mt-1.5">
            <NodeChip label="What if this changes?" message={`What if ${cleanedLabel} changes? How should I plan for that?`} />
          </div>
        )}

        {/* Polish 4 Task 7 chip audit: top-3 inferred (non-external) factors
            get an evidence chip in the body in pre-analysis Standard. Detailed
            view leaves this to the inline Layer 2 content. Low-priority and
            explicit factors render no chip per the audit table. */}
        {!isPostAnalysis && !isDetailed && isHighPriority && isInferred && nodeCategory !== 'external' && !needsInput && (
          <div className="mt-1.5">
            <NodeChip label="What evidence supports this?" message={`What evidence supports my assumption about ${cleanedLabel}?`} />
          </div>
        )}

        {/* Post-analysis: synthesised coaching line (Graph v1.1 Task 3).
            Standard view only, top-ranked factors only. Detailed view keeps
            the full ConnRows + bars treatment in Layer 2. */}
        {!isDetailed && synthesisedCoaching && (
          <p className={`${typography.edgeLabel} text-text-body mt-1 m-0`}>
            {synthesisedCoaching.prefix}{' '}
            <button
              type="button"
              className={`${typography.edgeLabel} text-info underline cursor-pointer nodrag nopan`}
              onClick={(e) => {
                e.stopPropagation()
                useGuidanceStore.getState()._sendMessage?.(`How can I gather better evidence about ${cleanedLabel}?`)
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              Gather evidence
            </button>
          </p>
        )}

        {/* Post-analysis external: scenario link — high-priority only in
            Standard. Detailed always. */}
        {isPostAnalysis && nodeCategory === 'external' && (isDetailed || isHighPriority) && (
          <p className={`${typography.edgeLabel} text-text-body mt-1 m-0`}>
            <button
              type="button"
              className={`${typography.edgeLabel} text-info underline cursor-pointer nodrag nopan`}
              onClick={(e) => {
                e.stopPropagation()
                useGuidanceStore.getState()._sendMessage?.(`What if ${cleanedLabel} worsens? How should I plan for that scenario?`)
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              What if {cleanedLabel.toLowerCase()} worsens?
            </button>
          </p>
        )}

        {/* Post-analysis: MetricPills */}
        {isPostAnalysis && (
          <MetricPills
            influencePct={influencePct}
            confidencePct={confidencePct}
          />
        )}

        {/* ===== LAYER 2: Detailed inline ===== */}
        {isDetailed && layer2Content}

        {/* Anchoring coaching (Detailed, pre-analysis) */}
        {anchoringMessage && (
          <CoachingCard
            severity="warning"
            message={`All options within 20% of ${anchoringMessage}. Anchored?`}
            linkLabel="Explore a wider range"
            linkMessage={`My options seem anchored around ${anchoringMessage}. What wider range should I consider for ${cleanedLabel}?`}
          />
        )}

        {/* "View parameters" link (Detailed, post-analysis) */}
        {isDetailed && isPostAnalysis && (
          <button
            type="button"
            className={`${typography.edgeLabel} text-info underline cursor-pointer mt-1.5 nodrag nopan`}
            onClick={handleViewParams}
            onPointerDown={(e) => e.stopPropagation()}
          >
            View parameters
          </button>
        )}

        {/* Action icons — wireframe v4 Task 5: external factors get no footer
            actions (their data is outside the user's control). Low-priority
            factors in Standard view drop the confirm icon and show edit only
            (Task 2 quieting). */}
        {nodeCategory !== 'external' && (
          <ActionIcons
            nodeId={props.id}
            showConfirm={isInferred && valueDisplay !== null && (isDetailed || isHighPriority)}
            showEdit={valueDisplay !== null || needsInput}
            onConfirm={handleConfirm}
          />
        )}
      </BaseNode>

      {/* ===== LAYER 2: Popover (Standard view) =====
          Graph v1.1 Task 2: low-priority factors are visually quieted in
          Standard, so the popover (ConnRows, BiasNote, coaching chips) is
          suppressed too. The user can promote the node by switching to
          Detailed view or selecting it in the inspector. */}
      {!isDetailed && isHighPriority && (
        <NodePopover
          visible={showPopover}
          width={240}
          onMouseEnter={popoverHandlers.onMouseEnter}
          onMouseLeave={popoverHandlers.onMouseLeave}
          anchorRef={nodeElRef}
        >
          {layer2Content}
          {renderOptionValuesBlock(true)}
        </NodePopover>
      )}

      {/* Graph v2 Task 3: low-priority controllable factors get a table-only
          popover. The Graph v1.1 quietening rules suppress the full layer 2
          (bars / ConnRows / coaching) for low-priority factors, but the
          option-comparison table is genuinely useful regardless of rank — a
          low-leverage cost factor that all options change differently is
          exactly where comparison helps. External factors stay suppressed
          (gated by renderOptionValuesBlock’s nodeCategory check). */}
      {!isDetailed && isLowPriority && hasOptionValues && (
        <NodePopover
          visible={showPopover}
          width={240}
          onMouseEnter={popoverHandlers.onMouseEnter}
          onMouseLeave={popoverHandlers.onMouseLeave}
          anchorRef={nodeElRef}
        >
          {renderOptionValuesBlock(false)}
        </NodePopover>
      )}
    </div>
  )
})

FactorNode.displayName = 'FactorNode'
