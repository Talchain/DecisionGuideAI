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
import { cleanFactorLabel, formatInterventionValue, isCurrencyUnit, formatFactorValue, QUALITATIVE_FACTOR_TYPES, isSuppressedUnit } from '../utils/labelUtils'
import { isGraphBadgesEnabled } from '../../flags'
import { SlidersHorizontal, Eye, Cloud, Search } from 'lucide-react'
import { DataBar } from '../ui/shared/DataBar'
import { getProvenanceLabel } from '../ui/inspector-v2/inspectorStrings'
import { CoachingCard } from '../components/CoachingCard'
import { useNodeConnections } from '../hooks/useNodeConnections'
import { ConnRow, Sep, NodeChip, ActionIcons, BiasIcon, OlumiSparkle, BriefIcon, ExpertOverlay } from './shared'
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
}

function formatPriorRangeValue(value: number, rawUnit?: string): string {
  const unit = isSuppressedUnit(rawUnit) ? undefined : rawUnit
  if (unit && isCurrencyUnit(unit)) {
    return `${unit}${Math.round(value).toLocaleString('en-GB')}`
  }
  if (unit === '%') {
    const pct = Math.abs(value) <= 1 ? Math.round(value * 100) : Math.round(value)
    return `${pct}%`
  }
  const display = Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '')
  return unit ? `${display} ${unit}` : display
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

  const nodeCategory = props.data?.category as string | undefined
  const controllability = useMemo(() => {
    if (!isPostAnalysis) return undefined
    return deriveControllability(props.id, ceeAnalysisReady?.options, edges, nodeCategory)
  }, [props.id, ceeAnalysisReady?.options, edges, isPostAnalysis, nodeCategory])

  const displayMetadata = useNodeDisplayMetadata(props.id, 'factor')

  const interventionValue = useMemo(() => {
    if (!hoveredOptionId) return null
    const hoveredOption = nodes.find(n => n.id === hoveredOptionId)
    if (!hoveredOption?.data?.interventions) return null
    const interventions = hoveredOption.data.interventions as Record<string, number>
    return interventions[props.id] ?? null
  }, [hoveredOptionId, nodes, props.id])

  const isAffectedByHover = interventionValue !== null

  const categoryIcon: { Icon: typeof SlidersHorizontal; tooltip: string } | null = useMemo(() => {
    switch (nodeCategory) {
      case 'controllable': return { Icon: SlidersHorizontal, tooltip: 'You control this factor' }
      case 'observable':   return { Icon: Eye,               tooltip: 'You can measure this'    }
      case 'external':     return { Icon: Cloud,             tooltip: 'Outside your control'    }
      default:             return null
    }
  }, [nodeCategory])

  const isTrulyBinary = useMemo(() => {
    const options = ceeAnalysisReady?.options
    if (!options) return false
    const vals: number[] = []
    for (const opt of options) {
      if (!opt.interventions) continue
      const rv = opt.interventions[props.id]
      if (rv == null) continue
      const v = typeof rv === 'number' ? rv :
        (rv && typeof rv === 'object' && 'value' in rv) ? Number((rv as { value: unknown }).value) : null
      if (v != null) vals.push(v)
    }
    return vals.length > 0 && vals.every(v => v === 0 || v === 1)
  }, [ceeAnalysisReady, props.id])

  const valueDisplay = useMemo(() => {
    if (!observedState) return null
    const { value } = observedState
    if (value !== undefined && observedState.raw_value == null) {
      const ft = observedState.factor_type?.toLowerCase().trim()
      const effectiveUnit = isSuppressedUnit(observedState.unit) ? undefined : observedState.unit
      const isQualitative = !effectiveUnit && observedState.cap == null &&
        (!ft || QUALITATIVE_FACTOR_TYPES.has(ft))
      if (isQualitative) {
        if (isTrulyBinary) {
          if (value === 0) return 'Off'
          if (value === 1) return 'On'
        } else {
          if (value === 0) return 'Not used'
          if (value === 1) return 'Very high'
        }
      }
    }
    return formatFactorValue(observedState)
  }, [observedState, isTrulyBinary])

  const priorRangeDisplay = useMemo(() => {
    const prior = props.data?.prior as { range_min?: number; range_max?: number } | undefined
    const min = prior?.range_min
    const max = prior?.range_max
    if (nodeCategory !== 'external' || min == null || max == null) return null
    const hasUnit = observedState?.unit && !isSuppressedUnit(observedState.unit)
    if (!hasUnit) return 'Variable'
    const cap = observedState?.cap
    const denormMin = cap != null && cap > 1 ? min * cap : min
    const denormMax = cap != null && cap > 1 ? max * cap : max
    return `Variable: ${formatPriorRangeValue(denormMin, observedState?.unit)}–${formatPriorRangeValue(denormMax, observedState?.unit)}`
  }, [nodeCategory, observedState?.unit, observedState?.cap, props.data?.prior])

  const isInferred = observedState?.extractionType === 'inferred'

  const provenanceLabel = useMemo(() => {
    const source = observedState?.source
    if (!source || source === 'user' || source === 'user_calibration' || source === 'default' || source === 'inferred') return null
    const label = getProvenanceLabel(source)
    return label === 'No evidence yet' || label === `Source: ${source}` ? null : label
  }, [observedState?.source])

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

  const isAssumed = useMemo(() => {
    if (isInferred) return false
    if (provenanceLabel) return false
    if (!observedState) return false
    if (observedState.value === undefined) return false
    const source = observedState.source
    return source === 'default' || (!source && !observedState.extractionType)
  }, [isInferred, provenanceLabel, observedState])

  // Anchoring detection (expert, pre-analysis)
  const anchoringMessage = useMemo(() => {
    if (viewMode !== 'expert' || isPostAnalysis) return null
    const options = ceeAnalysisReady?.options
    if (!options || options.length < 3) return null
    const vals: number[] = []
    for (const opt of options) {
      const rv = opt.interventions?.[props.id]
      if (rv == null) continue
      const v = typeof rv === 'number' ? rv :
        (rv && typeof rv === 'object' && 'value' in rv) ? Number((rv as { value: unknown }).value) : null
      if (v != null) vals.push(v)
    }
    if (vals.length < 3) return null
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const baseline = observedState?.value ?? min
    const spread = max - min
    if (Math.max(Math.abs(baseline), 0.01) > 0 && spread / Math.max(Math.abs(baseline), 0.01) < 0.2) {
      return valueDisplay ?? String(baseline)
    }
    return null
  }, [viewMode, isPostAnalysis, ceeAnalysisReady, props.id, observedState?.value, valueDisplay])

  // ConnRow: "Influences:" — outbound edges to outcomes/risks
  const outboundConnections = useNodeConnections(props.id, 'outbound')

  // Needs input state
  const needsInput = !isPostAnalysis && observedState?.value === undefined && observedState?.raw_value == null && nodeCategory !== 'external'

  // Confirm action: mark extractionType as 'explicit'
  const handleConfirm = useCallback(() => {
    if (!observedState) return
    const store = useCanvasStore.getState()
    const node = store.nodes.find(n => n.id === props.id)
    if (!node) return
    store.updateNode(props.id, {
      data: { ...node.data, observedState: { ...observedState, extractionType: 'explicit' as const } },
    })
  }, [props.id, observedState])

  // Influence/confidence bar values
  const influencePct = displayMetadata.influence != null ? Math.round(displayMetadata.influence * 100) : null
  const confidencePct = displayMetadata.confidence != null ? Math.round(displayMetadata.confidence * 100) : null

  return (
    <div style={{ position: 'relative' }}>
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
        maxWidth={nodeCategory === 'external' || needsInput ? 200 : 220}
        headerSlot={(categoryIcon || (displayMetadata.isResultsMode && displayMetadata.voiRank !== null)) ? (
          <span className="inline-flex items-center gap-0.5">
            {categoryIcon && (
              <span title={categoryIcon.tooltip} aria-label={categoryIcon.tooltip}>
                <categoryIcon.Icon className="w-3.5 h-3.5 text-text-light" aria-hidden="true" />
              </span>
            )}
            {displayMetadata.isResultsMode && displayMetadata.voiRank !== null && (
              <Search
                size={14}
                className="text-info shrink-0"
                title={`Worth investigating (#${displayMetadata.voiRank})`}
              />
            )}
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

        {/* Needs input state */}
        {needsInput && (
          <>
            <p className={`${typography.edgeLabel} text-text-light mt-1 m-0`}>Missing value. Weakens analysis.</p>
            <div className="mt-1.5">
              <NodeChip label="Help me estimate this" message={`Help me estimate a reasonable value for ${cleanedLabel}`} />
            </div>
          </>
        )}

        {/* External factor: "Variable. Outside your control." */}
        {!needsInput && nodeCategory === 'external' && !isPostAnalysis && (
          <p className={`${typography.nodeLabel} text-text-body mt-1 m-0`}>Variable. Outside your control.</p>
        )}

        {/* Value display + provenance icon */}
        {!needsInput && valueDisplay !== null && (
          <div className={`${typography.nodeLabel} mt-1 flex items-center gap-1`}>
            <span className="font-semibold text-text-body">{valueDisplay}</span>
            {observedState?.source === 'brief_extraction' ? (
              <div><BriefIcon /></div>
            ) : (isInferred || observedState?.source === 'cee_inference') ? (
              <div><OlumiSparkle /></div>
            ) : null}
          </div>
        )}

        {/* Value display fallbacks: prior range with units (skip bare "Variable" — already in sentence above) */}
        {!needsInput && valueDisplay === null && nodeCategory === 'external' && priorRangeDisplay && priorRangeDisplay !== 'Variable' && (
          <div className={`${typography.nodeLabel} mt-1 text-text-light`}>{priorRangeDisplay}</div>
        )}

        {/* Influence & Confidence bars (both views, post-analysis) — numeric % only */}
        {displayMetadata.isResultsMode && (influencePct != null && influencePct > 0 || confidencePct != null && confidencePct > 0) && (
          <div className="mt-2 mb-1 space-y-1.5">
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

        {/* "Influences:" ConnRows (post-analysis, both views) */}
        {isPostAnalysis && outboundConnections.length > 0 && (
          <>
            <Sep />
            <p className={`${typography.edgeLabel} font-medium text-text-body m-0 mb-0.5`}>Influences:</p>
            {outboundConnections.map(conn => (
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

        {/* Actionable guidance (post-analysis, both views) */}
        {isPostAnalysis && influencePct != null && influencePct > 50 && confidencePct != null && confidencePct < 50 && (
          <>
            <Sep />
            <p className={`${typography.edgeLabel} text-text-body m-0`}>
              High influence, low confidence.{' '}
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
          </>
        )}

        {/* External factor guidance (post-analysis) */}
        {isPostAnalysis && nodeCategory === 'external' && (
          <>
            <Sep />
            <p className={`${typography.edgeLabel} text-text-body m-0`}>
              Can't control, but can plan.{' '}
              <button
                type="button"
                className={`${typography.edgeLabel} text-info underline cursor-pointer nodrag nopan`}
                onClick={(e) => {
                  e.stopPropagation()
                  useGuidanceStore.getState()._sendMessage?.(`How should I plan for different scenarios of ${cleanedLabel}?`)
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                Scenario planning
              </button>
            </p>
          </>
        )}

        {/* Bias icon: overconfidence (top factor unconfirmed) */}
        {isPostAnalysis && displayMetadata.sensitivityRank === 1 && isInferred && (
          <div className="mt-1">
            <BiasIcon bias="overconfidence" tip="Key assumption unvalidated. Your result depends on this." linkLabel="Gather evidence" linkMessage={`How can I gather better evidence about ${cleanedLabel}?`} />
          </div>
        )}

        {/* Expert overlay */}
        <ExpertOverlay>
          {isAssumed && (
            <p className={`${typography.edgeLabel} text-warning m-0`}>Assumed (default value)</p>
          )}
          {displayMetadata.valueOfInformation != null && displayMetadata.valueOfInformation > 0 && (
            <p className={`${typography.edgeLabel} text-text-body m-0`}>
              EVPI: {Math.round(displayMetadata.valueOfInformation * 100)}pp
            </p>
          )}
          {anchoringMessage && (
            <CoachingCard
              severity="warning"
              message={`All options within 20% of ${anchoringMessage}. Anchored?`}
              linkLabel="Explore a wider range"
              linkMessage={`My options seem anchored around ${anchoringMessage}. What wider range should I consider for ${cleanedLabel}?`}
            />
          )}
        </ExpertOverlay>

        {/* Action icons: confirm + edit (bottom-right) */}
        <ActionIcons
          nodeId={props.id}
          showConfirm={isInferred && valueDisplay !== null}
          showEdit={valueDisplay !== null || needsInput}
          onConfirm={handleConfirm}
        />
      </BaseNode>
    </div>
  )
})

FactorNode.displayName = 'FactorNode'
