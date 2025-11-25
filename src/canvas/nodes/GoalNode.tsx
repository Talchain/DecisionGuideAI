import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import { typography } from '../../styles/typography'

export const GoalNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.goal

  return (
    <BaseNode {...props} nodeType="goal" icon={metadata.icon}>
      {props.data?.description && (
        <div className={`${typography.nodeLabel} opacity-70`}>
          {props.data.description}
        </div>
      )}
    </BaseNode>
  )
})

GoalNode.displayName = 'GoalNode'
