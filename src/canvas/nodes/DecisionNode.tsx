import { memo, useState, useRef, useEffect } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { useCanvasStore } from '../store'

export interface DecisionNodeData {
  label: string
  belief?: number
  weight?: number
  provenance?: string
}

function DecisionNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as DecisionNodeData
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(nodeData.label)
  const inputRef = useRef<HTMLInputElement>(null)
  const updateNodeLabel = useCanvasStore(s => s.updateNodeLabel)

  // Focus and select text when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleDoubleClick = () => {
    setEditValue(nodeData.label)
    setIsEditing(true)
  }

  const handleCommit = () => {
    const trimmed = editValue.trim()
    // Sanitize: enforce max length and escape HTML
    const sanitized = trimmed.slice(0, 100)
    if (sanitized && sanitized !== nodeData.label) {
      updateNodeLabel(id, sanitized)
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditValue(nodeData.label)
    setIsEditing(false)
  }

  const handleBlur = (e: React.FocusEvent) => {
    // Only commit if focus is leaving the node container entirely
    // This prevents premature commits during re-renders or internal focus moves
    const nodeContainer = (e.currentTarget as HTMLInputElement).closest('[data-testid="rf-node"]')
    if (nodeContainer && !nodeContainer.contains(e.relatedTarget as Node)) {
      handleCommit()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleCommit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  return (
    <div
      className={`
        px-4 py-3 rounded-2xl shadow-md bg-white border-2 min-w-[150px]
        transition-all duration-150 ease-out
        ${selected ? 'border-[#EA7B4B] shadow-lg scale-[1.02]' : 'border-gray-200'}
        hover:shadow-lg hover:scale-[1.02]
      `}
      style={{
        willChange: 'transform',
        transform: 'translateZ(0)', // GPU acceleration
      }}
      data-testid="rf-node"
      onDoubleClick={handleDoubleClick}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-[#67C89E] border-2 border-white"
      />
      
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          maxLength={100}
          className="text-sm font-medium text-gray-900 w-full bg-transparent border-none outline-none px-0"
          style={{ minWidth: '100px' }}
          aria-label="Node title"
        />
      ) : (
        <div className="text-sm font-medium text-gray-900 transition-opacity duration-150">
          {nodeData.label}
        </div>
      )}
      
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
