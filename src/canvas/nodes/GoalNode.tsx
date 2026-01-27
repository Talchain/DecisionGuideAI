import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'

export const GoalNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.goal

  // Decision Graph Display v2 Task 10: Goal achievement probability
  const displayMetadata = useNodeDisplayMetadata(props.id, 'goal')

  return (
    <BaseNode {...props} nodeType="goal" icon={metadata.icon}>
      {/* Decision Graph Display v2 Task 10 + Task B: Achievement probability with fallback */}
      {displayMetadata.achievementProbability !== null && (
        <div className="text-xs font-semibold mb-1 text-success-600">
          {Math.round(displayMetadata.achievementProbability * 100)}% chance
        </div>
      )}
      {/* Task B + Fix 5: Fallback to recommendation stability when probability unavailable */}
      {displayMetadata.achievementProbability === null && displayMetadata.stabilityPercentage !== null && (
        <div className="text-xs font-semibold mb-1 text-info-500">
          Recommended in {Math.round(displayMetadata.stabilityPercentage * 100)}% of scenarios
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

GoalNode.displayName = 'GoalNode'
