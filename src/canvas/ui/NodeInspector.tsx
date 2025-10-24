/**
 * Node property inspector - keyboard-first editing
 * Includes outgoing edges probability editor
 */

import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useCanvasStore } from '../store'
import { NODE_REGISTRY } from '../domain/nodes'
import type { NodeType } from '../domain/nodes'
import { renderIcon } from '../helpers/renderIcon'
import { validateOutgoingProbabilities } from '../utils/probabilityValidation'
import { formatConfidence } from '../domain/edges'

interface NodeInspectorProps {
  nodeId: string
  onClose: () => void
}

export const NodeInspector = memo(({ nodeId, onClose }: NodeInspectorProps) => {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const updateNode = useCanvasStore(s => s.updateNode)
  const updateEdge = useCanvasStore(s => s.updateEdge)
  
  const node = nodes.find(n => n.id === nodeId)
  const [label, setLabel] = useState<string>(String(node?.data?.label ?? ''))
  const [description, setDescription] = useState<string>(String(node?.data?.description ?? ''))
  
  // Get outgoing edges from this node
  const outgoingEdges = useMemo(() => 
    edges.filter(e => e.source === nodeId),
    [edges, nodeId]
  )
  
  // Validate outgoing probabilities
  const probabilityValidation = useMemo(() => 
    validateOutgoingProbabilities(nodeId, edges),
    [nodeId, edges]
  )
  
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
          data-testid="select-node-type"
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
      
      {/* Outgoing Edges Probability Editor */}
      {outgoingEdges.length > 0 && (
        <div className="mb-4 pt-4 border-t border-gray-200">
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Outgoing Edges ({outgoingEdges.length})
          </label>
          <div className="space-y-3">
            {outgoingEdges.map(edge => {
              const targetNode = nodes.find(n => n.id === edge.target)
              const probability = edge.data?.confidence ?? 0
              const pct = Math.round(probability * 100)
              
              return (
                <div key={edge.id} className="p-2 bg-gray-50 rounded border border-gray-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700">
                      → {targetNode?.data?.label || 'Unknown'}
                    </span>
                    <span className="text-xs text-gray-600">{pct}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={pct}
                    onChange={(e) => {
                      const newPct = parseInt(e.target.value, 10)
                      const newConfidence = newPct / 100
                      updateEdge(edge.id, {
                        data: {
                          ...edge.data,
                          confidence: newConfidence,
                          label: `${newPct}%`
                        }
                      })
                    }}
                    className="w-full"
                    aria-label={`Probability to ${targetNode?.data?.label || 'Unknown'}`}
                  />
                </div>
              )
            })}
          </div>
          
          {/* Validation Footer */}
          {probabilityValidation && !probabilityValidation.valid && (
            <div className="mt-3 p-2 rounded flex items-start gap-2" role="alert" style={{ backgroundColor: 'rgba(247,201,72,0.1)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--olumi-warning)' }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--olumi-warning)' }} />
              <p className="text-xs" style={{ color: '#9a6e00' }}>
                {probabilityValidation.message}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
})

NodeInspector.displayName = 'NodeInspector'
