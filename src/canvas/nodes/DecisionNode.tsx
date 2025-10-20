/**
 * Decision node component
 * Uses BaseNode for consistent structure and schema types
 */
import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { Crosshair } from 'lucide-react'
import type { DecisionNodeData } from '../domain/nodes'

export const DecisionNode = memo(({ data, selected }: NodeProps<DecisionNodeData>) => {
  return (
    <BaseNode
      nodeType="decision"
      icon={Crosshair}
      data={data}
      selected={selected}
    />
  )
})

DecisionNode.displayName = 'DecisionNode'

export default DecisionNode
