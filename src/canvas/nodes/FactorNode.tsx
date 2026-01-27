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
          style={{
            position: 'absolute',
            inset: '-4px',
            borderRadius: '12px',
            border: '2px solid #3b82f6',
            boxShadow: '0 0 12px rgba(59, 130, 246, 0.5)',
            pointerEvents: 'none',
            zIndex: -1,
          }}
        />
      )}
      <BaseNode {...props} nodeType="factor" icon={metadata.icon}>
      {/* Decision Graph Display v2 Task 11: Show intervention value when option hovered */}
      {isAffectedByHover && (
        <div
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#3b82f6',
            marginBottom: '4px',
            backgroundColor: '#eff6ff',
            padding: '2px 6px',
            borderRadius: '4px',
            border: '1px solid #bfdbfe',
          }}
        >
          Intervention: {interventionValue}
        </div>
      )}
      {/* Brief v2.2: Display observed value if present */}
      {observedState && typeof observedState.value === 'number' && (
        <div
          className="factor-node-value"
          style={{
            fontSize: '11px',
            marginTop: '4px',
            display: 'flex',
            alignItems: 'baseline',
            gap: '4px',
          }}
        >
          <span
            style={{
              fontWeight: 600,
              color: '#2563eb', // Blue for current value
            }}
          >
            {observedState.unit ?? ''}{observedState.value}
          </span>
          {observedState.baseline !== undefined && observedState.baseline !== observedState.value && (
            <span
              style={{
                color: '#9ca3af', // Gray for baseline
                fontSize: '10px',
              }}
            >
              (was {observedState.unit ?? ''}{observedState.baseline})
            </span>
          )}
        </div>
      )}
      {/* Description (existing) */}
      {props.data?.description && (
        <div style={{ fontSize: '11px', opacity: 0.7, marginTop: observedState ? '2px' : '0' }}>
          {props.data.description}
        </div>
      )}
    </BaseNode>
    </div>
  )
})

FactorNode.displayName = 'FactorNode'
