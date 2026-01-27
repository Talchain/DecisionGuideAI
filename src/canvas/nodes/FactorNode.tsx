import { memo, useMemo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import { useCanvasStore } from '../store'

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
      <BaseNode {...props} nodeType="factor" icon={metadata.icon}>
      {/* Decision Graph Display v2 Task 11: Show intervention value when option hovered */}
      {isAffectedByHover && (
        <div className="text-xs font-semibold text-info-600 mb-1 bg-info-50 px-1.5 py-0.5 rounded border border-info-200">
          Intervention: {interventionValue}
        </div>
      )}
      {/* Brief v2.2: Display observed value if present */}
      {observedState && typeof observedState.value === 'number' && (
        <div className="factor-node-value text-xs mt-1 flex items-baseline gap-1">
          <span className="font-semibold text-info-600">
            {observedState.unit ?? ''}{observedState.value}
          </span>
          {observedState.baseline !== undefined && observedState.baseline !== observedState.value && (
            <span className="text-slate-400 text-[10px]">
              (was {observedState.unit ?? ''}{observedState.baseline})
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
