import { memo, useMemo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { EvidenceGapBadge } from './EvidenceGapBadge'
import { NODE_REGISTRY } from '../domain/nodes'
import { useCanvasStore } from '../store'
import { deriveControllability } from '../utils/graphDisplayCalculations'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { hasObservedData } from '../utils/observedStateHelpers'
import { typography } from '../../styles/typography'
import { cleanFactorLabel, sensitivityTierLabel, evidenceTierLabel, formatInterventionValue, isCurrencyUnit, formatFactorValue, QUALITATIVE_FACTOR_TYPES, isSuppressedUnit } from '../utils/labelUtils'
import { isGraphBadgesEnabled } from '../../flags'
import { SlidersHorizontal, Eye, Cloud } from 'lucide-react'
import { DataBar } from '../ui/shared/DataBar'

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

function formatPriorRangeValue(value: number, unit?: string): string {
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
  const resultsReport = useCanvasStore(state => state.results.report)

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
        if (value === 0) return 'Not used'
        if (value === 1) return 'Very high'
      }
    }

    return formatFactorValue(observedState)
  }, [observedState])

  const priorRangeDisplay = useMemo(() => {
    const prior = props.data?.prior as { range_min?: number; range_max?: number } | undefined
    const min = prior?.range_min
    const max = prior?.range_max
    if (nodeCategory !== 'external' || min == null || max == null) return null
    return `Variable: ${formatPriorRangeValue(min, observedState?.unit)}–${formatPriorRangeValue(max, observedState?.unit)}`
  }, [nodeCategory, observedState?.unit, props.data?.prior])

  const sensitivityBarWidth = useMemo(() => {
    const influence = displayMetadata.influence
    if (influence == null) return null
    const factorSensitivity = (resultsReport as any)?.enrichment?.sensitivity_analysis?.factors
      ?? (resultsReport as any)?.factor_sensitivity
      ?? []
    const rawValues = factorSensitivity
      .map((factor: any) => factor.elasticity ?? factor.sensitivity_score ?? factor.importance_score)
      .filter((value: unknown): value is number => typeof value === 'number' && Number.isFinite(value))
      .map((value: number) => Math.abs(value))
      .filter((value: number) => value > 0)
    if (rawValues.length < 2) return Math.round(influence * 100)

    const factorData = factorSensitivity.find((factor: any) =>
      (factor.factor_id || factor.factorId || factor.node_id || factor.nodeId) === props.id
    )
    const rawCurrent = factorData?.elasticity ?? factorData?.sensitivity_score ?? factorData?.importance_score
    if (typeof rawCurrent !== 'number' || !Number.isFinite(rawCurrent)) return Math.round(influence * 100)

    const min = Math.min(...rawValues)
    const max = Math.max(...rawValues)
    if (max <= min) return Math.round(influence * 100)

    const normalised = (Math.abs(rawCurrent) - min) / (max - min)
    return Math.round((0.25 + normalised * 0.75) * 100)
  }, [displayMetadata.influence, props.id, resultsReport])

  // T5: Show "estimated" pill only for inferred values
  const isInferred = observedState?.extractionType === 'inferred'

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

  return (
    <div style={{ position: 'relative' }}>
      {showEvidenceGapBadge && <EvidenceGapBadge label={cleanedLabel} />}
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
        headerSlot={categoryIcon ? (
          <span title={categoryIcon.tooltip} aria-label={categoryIcon.tooltip}>
            <categoryIcon.Icon
              className="w-3.5 h-3.5 text-text-light"
              aria-hidden="true"
            />
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
              {valueDisplay !== null ? (
                <span className="font-semibold text-text-body">{valueDisplay}</span>
              ) : priorRangeDisplay ? (
                <span className="text-text-light">{priorRangeDisplay}</span>
              ) : (
                <span className="italic text-text-light">No baseline</span>
              )}
            </div>
            {isInferred && (
              <div className="mt-1">
                <span
                  className={`${typography.nodeLabel} bg-panel border border-warning/30 text-text-body rounded-full px-1.5 py-0.5`}
                  title="Estimated by Olumi — verify or update"
                >
                  estimated
                </span>
              </div>
            )}
          </div>
        )}

        {/* T6: Sensitivity & Evidence bars (Results mode) — renamed from Influence/Confidence */}
        {displayMetadata.isResultsMode && (
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
                <span className={`${typography.nodeLabel} text-text-light w-14 shrink-0 truncate`} title="Confidence">Confidence</span>
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
