import { useState, useEffect } from 'react'
import { AlertCircle, Check } from 'lucide-react'
import type { GraphEdge } from '../../templates/mapper/graphToRunRequest'

interface NodeInspectorProps {
  nodeId: string
  nodeLabel: string
  outgoingEdges: GraphEdge[]
  onUpdateEdge: (edgeId: string, probability: number) => void
  onClose: () => void
}

export function NodeInspector({
  nodeId,
  nodeLabel,
  outgoingEdges,
  onUpdateEdge,
  onClose
}: NodeInspectorProps): JSX.Element {
  const [probabilities, setProbabilities] = useState<Record<string, string>>({})
  
  useEffect(() => {
    const initial: Record<string, string> = {}
    outgoingEdges.forEach(edge => {
      initial[edge.id] = String(edge.data?.probability ?? 0)
    })
    setProbabilities(initial)
  }, [outgoingEdges])
  
  const sum = Object.values(probabilities)
    .map(v => parseFloat(v) || 0)
    .reduce((a, b) => a + b, 0)
  
  const isValid = Math.abs(sum - 1.0) < 0.001
  
  const handleChange = (edgeId: string, value: string) => {
    setProbabilities(prev => ({ ...prev, [edgeId]: value }))
  }
  
  const handleBlur = (edgeId: string) => {
    const value = parseFloat(probabilities[edgeId])
    if (!isNaN(value) && value >= 0 && value <= 1) {
      onUpdateEdge(edgeId, value)
    }
  }
  
  return (
    <div className="border-t border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">
          Edit: {nodeLabel}
        </h3>
        <button
          onClick={onClose}
          className="text-xs text-gray-600 hover:text-gray-900"
        >
          Close
        </button>
      </div>
      
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Outgoing probabilities
          </label>
          {outgoingEdges.map(edge => {
            const targetNode = edge.target
            return (
              <div key={edge.id} className="flex items-center gap-2 mb-2">
                <label htmlFor={`prob-${edge.id}`} className="text-xs text-gray-600 flex-1">
                  → {targetNode}
                </label>
                <input
                  id={`prob-${edge.id}`}
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={probabilities[edge.id] || ''}
                  onChange={(e) => handleChange(edge.id, e.target.value)}
                  onBlur={() => handleBlur(edge.id)}
                  className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )
          })}
        </div>
        
        <div className={`flex items-center gap-2 text-xs p-2 rounded ${
          isValid ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'
        }`}>
          {isValid ? (
            <>
              <Check className="w-4 h-4" />
              <span>Sum: {sum.toFixed(3)} ✓</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4" />
              <span>Sum: {sum.toFixed(3)} (must equal 1.0)</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
