import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'

export const OutcomeNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.outcome

  // Decision Graph Display v2 Task 8: Goal-hit probability display
  const displayMetadata = useNodeDisplayMetadata(props.id, 'outcome')

  return (
    <BaseNode {...props} nodeType="outcome" icon={metadata.icon}>
      {/* Decision Graph Display v2 Task 8: Achievement probability */}
      {displayMetadata.achievementProbability !== null && (
        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#059669' }}>
          {Math.round(displayMetadata.achievementProbability * 100)}% chance
        </div>
      )}

      {props.data?.description && (
        <div style={{ fontSize: '11px', opacity: 0.7 }}>
          {props.data.description}
        </div>
      )}
    </BaseNode>
  )
})

OutcomeNode.displayName = 'OutcomeNode'
