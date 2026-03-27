import { memo, useMemo } from 'react'
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
import { cleanFactorLabel, sensitivityTierLabel, evidenceTierLabel, formatInterventionValue, isCurrencyUnit, formatFactorValue, QUALITATIVE_FACTOR_TYPES, isSuppressedUnit } from '../utils/labelUtils'
import { isGraphBadgesEnabled } from '../../flags'
import { SlidersHorizontal, Eye, Cloud, Search, FileText, Cpu } from 'lucide-react'
import { DataBar } from '../ui/shared/DataBar'
import { getProvenanceLabel } from '../ui/inspector-v2/inspectorStrings'
import { CoachingCard } from '../components/CoachingCard'

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
  // Suppress internal factor_type descriptor strings (e.g. "binary", "normalized")
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

  // T2: Strip normalisation metadata from label (display-only)
  const cleanedLabel = cleanFactorLabel((props.data?.label as string | undefined) ?? '')
  const cleanedData = cleanedLabel ? { ...props.data, label: cleanedLabel } : props.data

  const hoveredOptionId = useCanvasStore(state => state.hoveredOptionId)
  const nodes = useCanvasStore(state => state.nodes)
  const edges = useCanvasStore(state => state.edges)
  const ceeAnalysisReady = useCanvasStore(state => state.ceeAnalysisReady)
  const resultsStatus = useCanvasStore(state => state.results.status)
  const viewMode = useCanvasStore(state => state.viewMode)

  // Derive controllability from graph structure or CEE category
  const nodeCategory = props.data?.category as string | undefined
  const controllability = useMemo(() => {
    if (resultsStatus !== 'complete') return undefined
    return deriveControllability(props.id, ceeAnalysisReady?.options, edges, nodeCategory)
  }, [props.id, ceeAnalysisReady?.options, edges, resultsStatus, nodeCategory])

  const displayMetadata = useNodeDisplayMetadata(props.id, 'factor')

  const interventionValue = useMemo(() => {
    if (!hoveredOptionId) return null
    const hoveredOption = nodes.find(n => n.id === hoveredOptionId)
    if (!hoveredOption?.data?.interventions) return null
    const interventions = hoveredOption.data.interventions as Record<string, number>
    return interventions[props.id] ?? null
  }, [hoveredOptionId, nodes, props.id])

  const isAffectedByHover = interventionValue !== null

  // F2: Category icon + tooltip (replaces text labels)
  const categoryIcon: { Icon: typeof SlidersHorizontal; tooltip: string } | null = useMemo(() => {
    switch (nodeCategory) {
      case 'controllable': return { Icon: SlidersHorizontal, tooltip: 'You control this factor' }
      case 'observable':   return { Icon: Eye,               tooltip: 'You can measure this'    }
      case 'external':     return { Icon: Cloud,             tooltip: 'Outside your control'    }
      default:             return null
    }
  }, [nodeCategory])

  // Binary factor detection: a factor is truly binary if ALL intervention values
  // across ALL options are exactly 0 or 1 (no intermediate values).
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

  // T4: Human-readable value (raw_value + unit preferred; cap-based denormalisation fallback)
  const valueDisplay = useMemo(() => {
    if (!observedState) return null
    const { value } = observedState

    // Binary/discrete special cases (shown before formatFactorValue).
    // 'Not used' and 'Very high' only apply to qualitative/categorical factors (no unit,
    // no cap, and either no factor_type or a known qualitative type).
    if (value !== undefined && observedState.raw_value == null) {
      const ft = observedState.factor_type?.toLowerCase().trim()
      // Treat suppressed/internal unit descriptors (e.g. "binary", "normalized") as "no unit"
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
    // When factor has a real-world unit, denormalise range to real units; otherwise just "Variable"
    const hasUnit = observedState?.unit && !isSuppressedUnit(observedState.unit)
    if (!hasUnit) return 'Variable'
    // Denormalise using cap (same scale logic as intervention formatting)
    const cap = observedState?.cap
    const denormMin = cap != null && cap > 1 ? min * cap : min
    const denormMax = cap != null && cap > 1 ? max * cap : max
    return `Variable: ${formatPriorRangeValue(denormMin, observedState?.unit)}–${formatPriorRangeValue(denormMax, observedState?.unit)}`
  }, [nodeCategory, observedState?.unit, observedState?.cap, props.data?.prior])

  // Use displayMetadata.influence directly — max-based proportional normalisation
  // consistent with computeNormalisedInfluences() in the driver list.
  const sensitivityBarWidth = useMemo(() => {
    const influence = displayMetadata.influence
    if (influence == null) return null
    return Math.round(influence * 100)
  }, [displayMetadata.influence])

  // T5: Show "estimated" pill only for inferred values
  const isInferred = observedState?.extractionType === 'inferred'

  // A14/A15: Provenance pill — show when source is meaningful (mirrors GoalNode)
  // 'user' and 'user_calibration' are silent (user set it themselves, no attribution needed).
  // 'inferred' source is already covered by the isInferred / "estimated" pill above — skip to avoid duplication.
  const provenanceLabel = useMemo(() => {
    const source = observedState?.source
    if (!source || source === 'user' || source === 'user_calibration' || source === 'default' || source === 'inferred') return null
    const label = getProvenanceLabel(source)
    return label === 'No evidence yet' || label === `Source: ${source}` ? null : label
  }, [observedState?.source])

  /**
   * Evidence gap badge semantics:
   * - Badge shows when factor has NO observed data (hasObservedData returns false).
   * - `observedState.value === 0` is valid data (binary "None") — badge hidden.
   * - External factors with a prior range set are excluded: prior.range_min/max
   *   is their form of evidence; they should not show the gap badge.
   * - Badge is never shown when VITE_FEATURE_GRAPH_BADGES is off.
   */
  const externalWithPrior = nodeCategory === 'external' && props.data?.prior != null
  const showEvidenceGapBadge =
    isGraphBadgesEnabled() && !hasObservedData(props.data) && !externalWithPrior

  // A.9: Post-analysis gap escalation based on VoI
  const gapEscalation: EvidenceGapEscalation = useMemo(() => {
    if (!displayMetadata.isResultsMode) return 'none'
    const voi = displayMetadata.valueOfInformation
    if (voi == null) return 'none'
    // Critical: top-3 VoI factor with high score
    if (voi > 0.20 && displayMetadata.voiRank !== null && displayMetadata.voiRank <= 3) return 'critical'
    // Warning: moderate VoI (matches UI-SEM-014 threshold)
    if (voi > 0.05) return 'warning'
    return 'none'
  }, [displayMetadata.isResultsMode, displayMetadata.valueOfInformation, displayMetadata.voiRank])

  // A.6: Constraint badge — match factor label against goal constraint labels
  const goalConstraints = useCanvasStore(state => state.goalConstraints)
  const constraintTooltip = useMemo(() => {
    if (!isGraphBadgesEnabled() || !goalConstraints?.length) return null
    const matching = goalConstraints.filter(c =>
      c.label.toLowerCase().trim() === cleanedLabel.toLowerCase().trim()
    )
    if (matching.length === 0) return null
    return matching.map(c => `Constrained: ${c.label} ${c.operator} ${c.value ?? '-'}`).join('; ')
  }, [goalConstraints, cleanedLabel])

  // B.1b: "Assumed" pill — for default/missing source values (mutually exclusive with "Estimated")
  const isAssumed = useMemo(() => {
    if (isInferred) return false // "Estimated" takes precedence
    if (provenanceLabel) return false // provenance pill shown instead
    if (!observedState) return false
    if (observedState.value === undefined) return false
    // Default source = assumed by the model
    const source = observedState.source
    return source === 'default' || (!source && !observedState.extractionType)
  }, [isInferred, provenanceLabel, observedState])

  // Phase 4: Anchoring detection — pre-analysis, if 3+ options and all intervention values
  // within 20% of baseline, the factor may be anchored
  const anchoringMessage = useMemo(() => {
    if (viewMode !== 'model' || resultsStatus === 'complete') return null
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
  }, [viewMode, resultsStatus, ceeAnalysisReady, props.id, observedState?.value, valueDisplay])

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
        headerSlot={(categoryIcon || (displayMetadata.isResultsMode && displayMetadata.voiRank !== null)) ? (
          <span className="inline-flex items-center gap-0.5">
            {categoryIcon && (
              <span title={categoryIcon.tooltip} aria-label={categoryIcon.tooltip}>
                <categoryIcon.Icon
                  className="w-3.5 h-3.5 text-text-light"
                  aria-hidden="true"
                />
              </span>
            )}
            {displayMetadata.isResultsMode && displayMetadata.voiRank !== null && (
              <Search
                size={14}
                className="text-info shrink-0"
                title={`Worth investigating (#${displayMetadata.voiRank} by investigation value${displayMetadata.valueOfInformation != null ? `, score ${Math.round(displayMetadata.valueOfInformation * 100)}%` : ''}) — gathering better evidence could improve decision confidence`}
                aria-label={`Worth investigating — rank ${displayMetadata.voiRank} by investigation value${displayMetadata.valueOfInformation != null ? `, score ${Math.round(displayMetadata.valueOfInformation * 100)}%` : ''}`}
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

        {/* T4: Human-readable value row + T5: estimated pill */}
        {(valueDisplay !== null || (observedState != null && observedState.value === undefined) || (!observedState && nodeCategory === 'external')) && (
          <div className={`${typography.nodeLabel} mt-1.5`}>
            <div>
              {viewMode === 'decision' && nodeCategory === 'external' ? (
                <span className="text-text-light">Variable</span>
              ) : valueDisplay !== null ? (
                <span className="font-semibold text-text-body">{valueDisplay}</span>
              ) : priorRangeDisplay ? (
                <span className="text-text-light">{priorRangeDisplay}</span>
              ) : observedState?.source === 'default' || observedState?.source === 'cee_inference' ? (
                <span className="inline-flex items-center gap-1 italic text-text-light">
                  <Cpu size={14} className="text-text-light shrink-0" aria-hidden="true" title="Estimated by Olumi" />
                  Estimated
                </span>
              ) : (
                <span className="italic text-text-light">No baseline</span>
              )}
            </div>
            {viewMode === 'model' && isInferred && !provenanceLabel && (
              <div className="mt-1 flex items-center gap-1 flex-wrap">
                <Cpu size={14} className="text-warning shrink-0" aria-hidden="true" />
                <span className={`${typography.nodeLabel} text-text-light`}>
                  Olumi estimated{valueDisplay ? `: ${valueDisplay}` : ''}
                </span>
                <button
                  type="button"
                  className={`${typography.nodeLabel} text-info underline cursor-pointer nodrag nopan`}
                  onClick={(e) => {
                    e.stopPropagation()
                    useCanvasStore.getState().setShowInspectorPanel(true)
                  }}
                >
                  Confirm or edit
                </button>
              </div>
            )}
            {viewMode === 'model' && !isInferred && observedState?.extractionType === 'explicit' && valueDisplay && (
              <div className={`${typography.nodeLabel} text-text-light mt-0.5`}>
                From your brief
              </div>
            )}
            {viewMode === 'model' && isAssumed && (
              <div className="mt-1">
                <span
                  className={`${typography.nodeLabel} bg-panel border border-warning/30 text-text-body rounded-full px-1.5 py-0.5`}
                  title="Default value assumed by the model. Verify or update with your own estimate."
                >
                  assumed
                </span>
              </div>
            )}
          </div>
        )}

        {/* A14/A15: Provenance icon — source attribution when meaningful (Model view only) */}
        {viewMode === 'model' && provenanceLabel && (
          <div className="flex justify-end mt-1">
            {provenanceLabel.includes('Olumi') ? (
              <Cpu size={14} className="text-text-light" aria-hidden="true" title={provenanceLabel} />
            ) : (
              <FileText size={14} className="text-text-light" aria-hidden="true" title={provenanceLabel} />
            )}
          </div>
        )}

        {/* T6: Sensitivity & Evidence bars (Results mode, Model view only) */}
        {viewMode === 'model' && displayMetadata.isResultsMode && (
          (displayMetadata.influence !== null && displayMetadata.influence > 0.001) ||
          (displayMetadata.confidence !== null && displayMetadata.confidence > 0.001)
        ) && (
          <div className="mt-2 mb-1 space-y-1.5">
            {/* Influence bar */}
            {displayMetadata.influence !== null && displayMetadata.influence > 0.001 && (
              <div className="flex items-center gap-1.5">
                <span className={`${typography.nodeLabel} text-text-light w-14 shrink-0 truncate`} title="Influence">Influence</span>
                <div className="flex-1 min-w-0">
                  <DataBar
                    value={(sensitivityBarWidth ?? Math.round(displayMetadata.influence * 100)) / 100}
                    label="Influence"
                    colour="info"
                    trailingLabel={sensitivityTierLabel(displayMetadata.influence)}
                  />
                </div>
              </div>
            )}
            {/* Confidence bar */}
            {displayMetadata.confidence !== null && displayMetadata.confidence > 0.001 && (
              <div className="flex items-center gap-1.5">
                <span className={`${typography.nodeLabel} text-text-light w-[72px] shrink-0 truncate`} title="Confidence">Confidence</span>
                <div className="flex-1 min-w-0">
                  <DataBar
                    value={displayMetadata.confidence}
                    label="Confidence"
                    colour="info"
                    trailingLabel={evidenceTierLabel(displayMetadata.confidence)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Coaching: top influence factor (Model view, post-analysis, rank 1 or 2) */}
        {viewMode === 'model' && displayMetadata.isResultsMode && typeof displayMetadata.sensitivityRank === 'number' && displayMetadata.sensitivityRank <= 2 && (
          <CoachingCard
            severity="info"
            message="Most influential assumption."
            linkLabel="What evidence supports this?"
            linkMessage={`What evidence supports my assumption about ${cleanedLabel}?`}
          />
        )}

        {/* Coaching: external factor with high influence (Model view, post-analysis, top 3) */}
        {viewMode === 'model' && displayMetadata.isResultsMode && nodeCategory === 'external' && typeof displayMetadata.sensitivityRank === 'number' && displayMetadata.sensitivityRank <= 3 && (
          <CoachingCard
            severity="info"
            message="High influence but outside your control."
            linkLabel="Consider scenario planning"
            linkMessage={`How should I plan for different scenarios of ${cleanedLabel}?`}
          />
        )}

        {/* Coaching: anchoring detection (Model view, pre-analysis) */}
        {anchoringMessage && (
          <CoachingCard
            severity="warning"
            message={`All options within 20% of ${anchoringMessage}. Anchored?`}
            linkLabel="Explore a wider range"
            linkMessage={`My options seem anchored around ${anchoringMessage}. What wider range should I consider for ${cleanedLabel}?`}
          />
        )}

        {/* Coaching: EVPI (Model view, post-analysis) */}
        {viewMode === 'model' && displayMetadata.isResultsMode && displayMetadata.valueOfInformation != null && displayMetadata.valueOfInformation > 0 && (
          <CoachingCard
            severity="info"
            message={`Worth investigating: resolving this could improve confidence by ${Math.round(displayMetadata.valueOfInformation * 100)}pp.`}
            linkLabel="How to gather evidence"
            linkMessage={`How can I gather better evidence about ${cleanedLabel}?`}
          />
        )}

        {typeof props.data?.description === 'string' && props.data.description && (
          <div className={`${typography.nodeLabel} opacity-70 mt-0.5`}>
            {props.data.description}
          </div>
        )}
      </BaseNode>
    </div>
  )
})

FactorNode.displayName = 'FactorNode'
