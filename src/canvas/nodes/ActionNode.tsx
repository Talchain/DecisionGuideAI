import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import { typography } from '../../styles/typography'

export const ActionNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.action

  return (
    <BaseNode {...props} nodeType="action" icon={metadata.icon} maxWidth={200}>
      {props.data?.description && (
        <div className={`${typography.nodeLabel} opacity-70`}>
          {props.data.description}
        </div>
      )}
    </BaseNode>
  )
})

ActionNode.displayName = 'ActionNode'
