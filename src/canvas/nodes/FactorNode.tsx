import { memo, useMemo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import { useCanvasStore } from '../store'
import { deriveControllability, formatDisplayValue } from '../utils/graphDisplayCalculations'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { typography } from '../../styles/typography'
import { cleanFactorLabel, sensitivityTierLabel, evidenceTierLabel, formatInterventionValue, qualitativeTierLabel, CURRENCY_SYMBOLS } from '../utils/labelUtils'
import { SlidersHorizontal, Eye, Cloud } from 'lucide-react'

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

  // T4: Human-readable value (raw_value + unit preferred, fallback to normalised)
  const valueDisplay = useMemo(() => {
    if (!observedState) return null
    const { raw_value, unit, value } = observedState

    if (raw_value !== undefined && raw_value !== null && String(raw_value).trim() !== '') {
      const rawStr = String(raw_value).trim()
      if (!unit) return rawStr
      // J2: Currency symbols prefix the number.
      // When raw_value is numeric, delegate to formatInterventionValue to get proper
      // thousands separators (e.g. £1,200 not £1200). Non-numeric strings fall back
      // to simple concatenation so text like "approx 50" renders unchanged.
      const numericRaw = Number(rawStr)
      if (CURRENCY_SYMBOLS.has(unit[0])) {
        if (!isNaN(numericRaw) && rawStr !== '') {
          return formatInterventionValue(numericRaw, unit, observedState?.factor_type)
        }
        return `${unit}${rawStr}`
      }
      return `${rawStr} ${unit}`
    }

    if (value === undefined) return null

    // Binary/discrete fallback
    if (value === 0) return 'None'
    if (value === 1) return 'Full'

    // P2: When no raw_value and no unit, show qualitative tier label instead of raw float
    if (!unit) return qualitativeTierLabel(value)

    return formatDisplayValue(value, unit)
  }, [observedState])

  // T5: Show "estimated" pill only for inferred values
  const isInferred = observedState?.extractionType === 'inferred'

  return (
    <div style={{ position: 'relative' }}>
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
          <categoryIcon.Icon
            className="w-3.5 h-3.5 text-text-light"
            aria-hidden="false"
            aria-label={categoryIcon.tooltip}
            title={categoryIcon.tooltip}
          />
        ) : undefined}
      >

        {/* Intervention highlight when option hovered */}
        {isAffectedByHover && (
          <div className={`${typography.nodeTitle} text-info mb-1 bg-info-light px-1.5 py-0.5 rounded border border-info/30`}>
            Intervention: {formatInterventionValue(interventionValue, observedState?.unit, observedState?.factor_type, observedState?.cap)}
          </div>
        )}

        {/* T4: Human-readable value row + T5: estimated pill */}
        {(valueDisplay !== null || (observedState && observedState.value === undefined) || (!observedState && nodeCategory === 'external')) && (
          <div className={`${typography.nodeLabel} mt-1.5 flex items-center gap-1.5 flex-wrap`}>
            {valueDisplay !== null ? (
              <span className="font-semibold text-text-body">{valueDisplay}</span>
            ) : (
              <span className="italic text-text-light">No baseline</span>
            )}
            {isInferred && (
              <span
                className={`${typography.nodeLabel} bg-panel-hover text-text-light rounded-full px-1.5 py-0.5`}
                title="Estimated by Olumi — verify or update"
              >
                estimated
              </span>
            )}
          </div>
        )}

        {/* T6: Sensitivity & Evidence bars (Results mode) — renamed from Influence/Confidence */}
        {displayMetadata.isResultsMode && (
          (displayMetadata.influence !== null && displayMetadata.influence > 0.001) ||
          (displayMetadata.confidence !== null && displayMetadata.confidence > 0.001)
        ) && (
          <div className="mt-2 mb-1 space-y-1.5">
            {/* Sensitivity bar (was Influence) */}
            {displayMetadata.influence !== null && displayMetadata.influence > 0.001 && (
              <div className="flex items-center gap-1.5">
                <span className={`${typography.nodeLabel} text-text-light w-14 shrink-0 truncate`} title="Sensitivity">Sensitivity</span>
                <div className="flex-1 h-1.5 bg-panel-border rounded-full overflow-hidden max-w-[60px]">
                  <div
                    className="h-full bg-info rounded-full transition-all duration-300"
                    style={{ width: `${Math.round(displayMetadata.influence * 100)}%` }}
                  />
                </div>
                <span className={`${typography.nodeLabel} text-text-light w-8 text-right shrink-0`}>
                  {sensitivityTierLabel(displayMetadata.influence)}
                </span>
              </div>
            )}
            {/* Evidence bar (was Confidence) */}
            {displayMetadata.confidence !== null && displayMetadata.confidence > 0.001 && (
              <div className="flex items-center gap-1.5">
                <span className={`${typography.nodeLabel} text-text-light w-14 shrink-0 truncate`} title="Evidence">Evidence</span>
                <div className="flex-1 h-1.5 bg-panel-border rounded-full overflow-hidden max-w-[60px]">
                  <div
                    className="h-full bg-info rounded-full transition-all duration-300"
                    style={{ width: `${Math.round(displayMetadata.confidence * 100)}%` }}
                  />
                </div>
                <span className={`${typography.nodeLabel} text-text-light w-8 text-right shrink-0`}>
                  {evidenceTierLabel(displayMetadata.confidence)}
                </span>
              </div>
            )}
          </div>
        )}

        {props.data?.description && (
          <div className={`${typography.nodeLabel} opacity-70 mt-0.5`}>
            {props.data.description}
          </div>
        )}
      </BaseNode>
    </div>
  )
})

FactorNode.displayName = 'FactorNode'
