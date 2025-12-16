import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'

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

  return (
    <BaseNode {...props} nodeType="factor" icon={metadata.icon}>
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
  )
})

FactorNode.displayName = 'FactorNode'
