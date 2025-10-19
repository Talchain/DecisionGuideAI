import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'

export const RiskNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.risk
  
  return (
    <BaseNode {...props} nodeType="risk" icon={metadata.icon}>
      {props.data?.description && (
        <div style={{ fontSize: '11px', opacity: 0.7 }}>
          {props.data.description}
        </div>
      )}
    </BaseNode>
  )
})

RiskNode.displayName = 'RiskNode'
