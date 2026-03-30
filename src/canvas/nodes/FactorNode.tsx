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
import { hasObservedData } from '../utils/observedStateHelpers'
import { typography } from '../../styles/typography'
import { cleanFactorLabel, formatInterventionValue, isSuppressedUnit } from '../utils/labelUtils'
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

  const interventionValue = useMemo(() => {
    if (!hoveredOptionId) return null
    const hoveredOption = nodes.find(n => n.id === hoveredOptionId)
    if (!hoveredOption?.data?.interventions) return null
    const interventions = hoveredOption.data.interventions as Record<string, number>
    return interventions[props.id] ?? null
  }, [hoveredOptionId, nodes, props.id])

  const isAffectedByHover = interventionValue !== null

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
  const needsInput = observedState?.value == null && nodeCategory !== 'external'

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
      const rv = (opt.interventions as Record<string, unknown> | undefined)?.[props.id]
      if (rv == null) continue
      const v = typeof rv === 'number' ? rv :
        (rv && typeof rv === 'object' && 'value' in (rv as Record<string, unknown>)) ?
        Number((rv as Record<string, unknown>).value) : null
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
  const preAnalysisLayer2 = !isPostAnalysis ? (
    <>
      {/* Pre-analysis popover per spec Section 7.5 */}
      {isInferred && (
        <p className={`${typography.edgeLabel} text-text-body m-0 mb-1`}>
          Olumi estimated this from your brief. High leverage, low evidence.
        </p>
      )}
      {isExplicit && outboundConnections.length > 0 && (
        <p className={`${typography.edgeLabel} text-text-body m-0 mb-1`}>
          You provided this value. It strongly influences {outboundConnections[0]?.connectedNodeLabel ?? 'connected outcomes'}.
        </p>
      )}
      {nodeCategory === 'external' && (
        <p className={`${typography.edgeLabel} text-text-body m-0 mb-1`}>
          Outside your control. Uncertainty here affects {outcomesAffected} outcome{outcomesAffected !== 1 ? 's' : ''}.
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
      {/* Pre-analysis coaching chip */}
      {isInferred && (
        <>
          <Sep />
          <NodeChip label="What evidence supports this?" message={`What evidence supports my assumption about ${cleanedLabel}?`} />
        </>
      )}
      {isExplicit && (
        <>
          <Sep />
          <NodeChip label="Is this still accurate?" message={`Is my value for ${cleanedLabel} still accurate?`} />
        </>
      )}
      {nodeCategory === 'external' && (
        <>
          <Sep />
          <NodeChip label="What if this changes?" message={`What if ${cleanedLabel} changes? How should I plan for that?`} />
        </>
      )}
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
      {/* BiasNote (max 1) */}
      {displayMetadata.sensitivityRank != null && displayMetadata.sensitivityRank <= 2 && isInferred && (
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
        maxWidth={200}
        headerSlot={scienceIcons.length > 0 ? (
          <span className="inline-flex items-center gap-1">
            {scienceIcons.map(si => (
              <ScienceIcon key={si.id} icon={si.icon} tooltip={si.tooltip} action={si.action} colour={si.colour} />
            ))}
          </span>
        ) : undefined}
      >
        {/* Intervention highlight when option hovered */}
        {isAffectedByHover && (
          <div className={`${typography.nodeTitle} text-info mb-1 bg-panel px-1.5 py-0.5 rounded border border-info/30`}>
            Intervention: {formatInterventionValue(
              interventionValue,
              observedState?.unit,
              observedState?.factor_type,
              observedState?.cap,
              observedState?.value,
              observedState?.raw_value,
            )}
          </div>
        )}

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

        {/* Pre-analysis: edge pills (entity shape + strength %) */}
        {!isPostAnalysis && !needsInput && (
          <EdgePills nodeId={props.id} />
        )}

        {/* Post-analysis: actionable sentence */}
        {isPostAnalysis && influencePct != null && influencePct > 50 && confidencePct != null && confidencePct < 50 && (
          <p className={`${typography.edgeLabel} text-text-body mt-1 m-0`}>
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

        {/* Post-analysis external: scenario link */}
        {isPostAnalysis && nodeCategory === 'external' && (
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

        {/* Action icons */}
        <ActionIcons
          nodeId={props.id}
          showConfirm={isInferred && valueDisplay !== null}
          showEdit={valueDisplay !== null || needsInput}
          onConfirm={handleConfirm}
        />
      </BaseNode>

      {/* ===== LAYER 2: Popover (Standard view) ===== */}
      {!isDetailed && (
        <NodePopover
          visible={showPopover}
          width={240}
          onMouseEnter={popoverHandlers.onMouseEnter}
          onMouseLeave={popoverHandlers.onMouseLeave}
        >
          {layer2Content}
        </NodePopover>
      )}
    </div>
  )
})

FactorNode.displayName = 'FactorNode'
