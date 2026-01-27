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
        <div className="text-xs font-semibold mb-1 text-success-600">
          {Math.round(displayMetadata.achievementProbability * 100)}% chance
        </div>
      )}

      {props.data?.description && (
        <div className="text-xs opacity-70">
          {props.data.description}
        </div>
      )}
    </BaseNode>
  )
})

OutcomeNode.displayName = 'OutcomeNode'
