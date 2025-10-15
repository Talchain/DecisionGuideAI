import { memo } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'

export interface DecisionNodeData {
  label: string
  belief?: number
  weight?: number
  provenance?: string
}

function DecisionNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as DecisionNodeData
  return (
    <div
      className={`
        px-4 py-3 rounded-2xl shadow-md bg-white border-2 transition-all
        ${selected ? 'border-[#EA7B4B] shadow-lg' : 'border-gray-200'}
        hover:shadow-lg min-w-[150px]
      `}
      data-testid="rf-node"
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-[#67C89E] border-2 border-white"
      />
      
      <div className="text-sm font-medium text-gray-900">
        {nodeData.label}
      </div>
      
      {nodeData.belief !== undefined && (
        <div className="text-xs text-gray-500 mt-1">
          Belief: {(nodeData.belief * 100).toFixed(0)}%
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-[#63ADCF] border-2 border-white"
      />
    </div>
  )
}

export default memo(DecisionNode)
