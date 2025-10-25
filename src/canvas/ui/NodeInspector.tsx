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
import { ProbabilityModal } from '../components/ProbabilityModal'
import { Tooltip } from '../components/Tooltip'

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
  const [showProbabilityModal, setShowProbabilityModal] = useState(false)
  
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
      
      {/* Outgoing Edges - Probability Summary (Read-Only) */}
      {outgoingEdges.length > 0 && (
        <div className="mb-4 pt-4 border-t border-gray-200">
          <Tooltip content="% likelihood each connector is taken (must total 100%)" position="right">
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Outgoing Edges ({outgoingEdges.length})
            </label>
          </Tooltip>

          {/* Read-only summary of probabilities */}
          <div className="space-y-2 mb-3">
            {outgoingEdges.map(edge => {
              const targetNode = nodes.find(n => n.id === edge.target)
              const probability = edge.data?.confidence ?? 0
              const pct = Math.round(probability * 100)

              return (
                <div key={edge.id} className="flex items-center justify-between py-1 px-2 rounded" style={{ backgroundColor: 'rgba(91, 108, 255, 0.05)' }}>
                  <span className="text-xs text-gray-700">
                    → {targetNode?.data?.label || 'Unknown'}
                  </span>
                  <span className="text-xs font-medium" style={{ color: 'var(--olumi-primary, #5B6CFF)' }}>
                    {pct}%
                  </span>
                </div>
              )
            })}
          </div>

          {/* Validation Footer */}
          {probabilityValidation && !probabilityValidation.valid && (
            <div className="mb-3 p-2 rounded flex items-start gap-2" role="alert" style={{ backgroundColor: 'rgba(247,201,72,0.1)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--olumi-warning)' }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--olumi-warning)' }} />
              <p className="text-xs" style={{ color: '#9a6e00' }}>
                {probabilityValidation.message}
              </p>
            </div>
          )}

          {/* Edit Probabilities Button - Single Source of Truth */}
          {outgoingEdges.length >= 2 && (
            <button
              type="button"
              onClick={() => setShowProbabilityModal(true)}
              className="w-full px-3 py-2 text-sm font-medium rounded text-white transition-all"
              style={{ backgroundColor: 'var(--olumi-primary, #5B6CFF)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--olumi-primary-600, #4256F6)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--olumi-primary, #5B6CFF)'
              }}
            >
              Edit Probabilities…
            </button>
          )}
        </div>
      )}

      {/* Probability Modal */}
      {showProbabilityModal && (
        <ProbabilityModal
          nodeId={nodeId}
          onClose={() => setShowProbabilityModal(false)}
        />
      )}
    </div>
  )
})

NodeInspector.displayName = 'NodeInspector'
