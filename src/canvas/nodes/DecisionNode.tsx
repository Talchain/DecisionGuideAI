/**
 * Decision node component
 * Uses BaseNode for consistent structure and schema types
 */
import { memo, useMemo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { Crosshair } from 'lucide-react'
import type { DecisionNodeData } from '../domain/nodes'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'

export const DecisionNode = memo(({ id, data, selected }: NodeProps<DecisionNodeData>) => {
  // T11: Count option nodes connected outward from this decision node
  const edges = useCanvasStore(state => state.edges)
  const nodes = useCanvasStore(state => state.nodes)

  const optionCount = useMemo(() => {
    const outgoingEdges = edges.filter(e => e.source === id)
    return outgoingEdges.filter(e => {
      const targetNode = nodes.find(n => n.id === e.target)
      return targetNode?.type === 'option' || targetNode?.data?.type === 'option'
    }).length
  }, [edges, nodes, id])

  return (
    <BaseNode
      nodeType="decision"
      icon={Crosshair}
      id={id}
      data={data}
      selected={selected}
    >
      {/* T11: Option count line */}
      {optionCount > 0 && (
        <div className={`${typography.nodeLabel} text-text-light mt-1`}>
          {optionCount} option{optionCount !== 1 ? 's' : ''} compared
        </div>
      )}
    </BaseNode>
  )
})

DecisionNode.displayName = 'DecisionNode'

export default DecisionNode
