import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import { typography } from '../../styles/typography'

export const OptionNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.option

  return (
    <BaseNode {...props} nodeType="option" icon={metadata.icon}>
      {props.data?.description && (
        <div className={`${typography.nodeLabel} opacity-70`}>
          {props.data.description}
        </div>
      )}
    </BaseNode>
  )
})

OptionNode.displayName = 'OptionNode'
