import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import { typography } from '../../styles/typography'

export const RiskNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.risk

  return (
    <BaseNode {...props} nodeType="risk" icon={metadata.icon}>
      {props.data?.description && (
        <div className={`${typography.nodeLabel} opacity-70`}>
          {props.data.description}
        </div>
      )}
    </BaseNode>
  )
})

RiskNode.displayName = 'RiskNode'
