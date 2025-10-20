/**
 * Node property inspector - keyboard-first editing
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react'
import { useCanvasStore } from '../store'
import { NODE_REGISTRY } from '../domain/nodes'
import type { NodeType } from '../domain/nodes'
import { renderIcon } from '../helpers/renderIcon'

interface NodeInspectorProps {
  nodeId: string
  onClose: () => void
}

export const NodeInspector = memo(({ nodeId, onClose }: NodeInspectorProps) => {
  const nodes = useCanvasStore(s => s.nodes)
  const updateNode = useCanvasStore(s => s.updateNode)
  
  const node = nodes.find(n => n.id === nodeId)
  const [label, setLabel] = useState<string>(String(node?.data?.label ?? ''))
  const [description, setDescription] = useState<string>(String(node?.data?.description ?? ''))
  
  const labelRef = useRef<HTMLInputElement>(null)
  
  useEffect(() => {
    labelRef.current?.focus()
    labelRef.current?.select()
  }, [])
  
  const handleLabelBlur = useCallback(() => {
    const trimmed = label.trim().slice(0, 100)
    if (trimmed && trimmed !== node?.data?.label) {
      updateNode(nodeId, { data: { ...node?.data, label: trimmed } })
    }
  }, [nodeId, label, node?.data, updateNode])
  
  const handleDescriptionBlur = useCallback(() => {
    const trimmed = description.trim().slice(0, 500)
    if (trimmed !== node?.data?.description) {
      updateNode(nodeId, { data: { ...node?.data, description: trimmed || undefined } })
    }
  }, [nodeId, description, node?.data, updateNode])
  
  const handleTypeChange = useCallback((newType: NodeType) => {
    // Update node type in place (preserves id, position, label)
    updateNode(nodeId, { type: newType })
  }, [nodeId, updateNode])
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [onClose])
  
  if (!node) return <div className="p-4 text-sm text-gray-500">Select a node to edit its details</div>
  
  const currentType = (node.type || 'decision') as NodeType
  const metadata = NODE_REGISTRY[currentType] || NODE_REGISTRY.decision
  
  return (
    <div className="p-4 border-t border-gray-200" onKeyDown={handleKeyDown} role="region" aria-label="Node properties">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {renderIcon(metadata.icon, 18) ?? <span aria-hidden="true">•</span>}
          <h3 className="text-sm font-semibold">{metadata.label}</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">×</button>
      </div>
      
      <div className="mb-4">
        <label htmlFor="node-type" className="block text-xs font-medium text-gray-700 mb-1">Type</label>
        <select
          id="node-type"
          value={currentType}
          onChange={(e) => handleTypeChange(e.target.value as NodeType)}
          className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 bg-white"
        >
          {(Object.keys(NODE_REGISTRY) as NodeType[]).map((type) => (
            <option key={type} value={type}>
              {NODE_REGISTRY[type].label}
            </option>
          ))}
        </select>
      </div>
      
      <div className="mb-4">
        <label htmlFor="node-title" className="block text-xs font-medium text-gray-700 mb-1">Title</label>
        <input
          ref={labelRef}
          id="node-title"
          type="text"
          maxLength={100}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={handleLabelBlur}
          className="w-full text-sm border border-gray-300 rounded px-2 py-1"
        />
      </div>
      
      <div className="mb-4">
        <label htmlFor="node-description" className="block text-xs font-medium text-gray-700 mb-1">
          Note <span className="text-gray-400">(optional)</span>
        </label>
        <textarea
          id="node-description"
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={handleDescriptionBlur}
          rows={3}
          className="w-full text-sm border border-gray-300 rounded px-2 py-1"
          placeholder="Add a note..."
        />
      </div>
    </div>
  )
})

NodeInspector.displayName = 'NodeInspector'
