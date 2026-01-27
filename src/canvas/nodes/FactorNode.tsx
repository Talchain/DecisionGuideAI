import { memo, useMemo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import { useCanvasStore } from '../store'
import { deriveControllability, formatDisplayValue } from '../utils/graphDisplayCalculations'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'

/**
 * Brief v2.2: ObservedState type for factor nodes
 */
interface ObservedState {
  value: number
  baseline?: number
  unit?: string
  source?: string
}

/**
 * Factor node component with optional observed value display.
 * Brief v2.2: Displays value and baseline from observedState when available.
 */
export const FactorNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.factor
  const observedState = props.data?.observedState as ObservedState | undefined

  // Decision Graph Display v2 Task 11: Check if affected by hovered option
  const hoveredOptionId = useCanvasStore(state => state.hoveredOptionId)
  const nodes = useCanvasStore(state => state.nodes)
  const edges = useCanvasStore(state => state.edges)
  const ceeAnalysisReady = useCanvasStore(state => state.ceeAnalysisReady)
  const resultsStatus = useCanvasStore(state => state.results.status)

  // Task 2: Derive controllability from graph structure
  const controllability = useMemo(() => {
    // Only derive controllability when analysis is complete (Results mode)
    if (resultsStatus !== 'complete') return undefined
    return deriveControllability(props.id, ceeAnalysisReady?.options, edges)
  }, [props.id, ceeAnalysisReady?.options, edges, resultsStatus])

  // Task 3: Get influence and confidence from analysis results
  const displayMetadata = useNodeDisplayMetadata(props.id, 'factor')

  const interventionValue = useMemo(() => {
    if (!hoveredOptionId) return null
    const hoveredOption = nodes.find(n => n.id === hoveredOptionId)
    if (!hoveredOption?.data?.interventions) return null
    const interventions = hoveredOption.data.interventions as Record<string, number>
    return interventions[props.id] ?? null
  }, [hoveredOptionId, nodes, props.id])

  const isAffectedByHover = interventionValue !== null

  return (
    <div style={{ position: 'relative' }}>
      {isAffectedByHover && (
        <div
          className="absolute -inset-1 rounded-xl border-2 border-info-500 pointer-events-none -z-10"
          style={{ boxShadow: '0 0 12px var(--info-500)' }}
        />
      )}
      <BaseNode
        {...props}
        data={{ ...props.data, controllability }}
        nodeType="factor"
        icon={metadata.icon}
      >
      {/* Decision Graph Display v2 Task 11: Show intervention value when option hovered */}
      {isAffectedByHover && (
        <div className="text-xs font-semibold text-info-600 mb-1 bg-info-50 px-1.5 py-0.5 rounded border border-info-200">
          Intervention: {formatDisplayValue(interventionValue, observedState?.unit)}
        </div>
      )}
      {/* Task 3: Influence & Confidence bars (only in Results mode) */}
      {displayMetadata.isResultsMode && (displayMetadata.influence !== null || displayMetadata.confidence !== null) && (
        <div className="mt-1 mb-1 space-y-1">
          {/* Influence bar - teal/info color */}
          {displayMetadata.influence !== null && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 w-12 shrink-0">Influence</span>
              <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-info-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round(displayMetadata.influence * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-500 w-6 text-right">
                {Math.round(displayMetadata.influence * 100)}%
              </span>
            </div>
          )}
          {/* Confidence bar - slate/muted color */}
          {displayMetadata.confidence !== null && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 w-12 shrink-0">Confidence</span>
              <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-400 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round(displayMetadata.confidence * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-500 w-6 text-right">
                {Math.round(displayMetadata.confidence * 100)}%
              </span>
            </div>
          )}
        </div>
      )}
      {/* Brief v2.2: Display observed value if present */}
      {/* Task 4: Better value display formatting */}
      {observedState && typeof observedState.value === 'number' && (
        <div className="factor-node-value text-xs mt-1 flex items-baseline gap-1">
          <span className="font-semibold text-info-600">
            {observedState.unit ?? ''}{formatDisplayValue(observedState.value, observedState.unit)}
          </span>
          {observedState.baseline !== undefined && observedState.baseline !== observedState.value && (
            <span className="text-slate-400 text-[10px]">
              (was {observedState.unit ?? ''}{formatDisplayValue(observedState.baseline, observedState.unit)})
            </span>
          )}
        </div>
      )}
      {/* Description (existing) */}
      {props.data?.description && (
        <div className={`text-xs opacity-70 ${observedState ? 'mt-0.5' : ''}`}>
          {props.data.description}
        </div>
      )}
    </BaseNode>
    </div>
  )
})

FactorNode.displayName = 'FactorNode'
