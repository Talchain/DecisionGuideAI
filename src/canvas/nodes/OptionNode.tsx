import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'

export const OptionNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.option
  
  return (
    <BaseNode {...props} nodeType="option" icon={metadata.icon}>
      {props.data?.description && (
        <div style={{ fontSize: '11px', opacity: 0.7 }}>
          {props.data.description}
        </div>
      )}
    </BaseNode>
  )
})

OptionNode.displayName = 'OptionNode'
