/**
 * Inspector State
 *
 * Shown when the user has selected a node or edge for inspection.
 * Displays element details and provides context-specific actions.
 */

import { useCanvasStore } from '@/canvas/store'
import { useCopilotStore } from '../../../hooks/useCopilotStore'
import { Button } from '../../shared/Button'
import { Card } from '../../shared/Card'
import { Badge } from '../../shared/Badge'

export function InspectorState(): JSX.Element {
  const selectedElement = useCopilotStore((state) => state.selectedElement)
  const nodes = useCanvasStore((state) => state.nodes)
  const edges = useCanvasStore((state) => state.edges)
  const selectElement = useCopilotStore((state) => state.selectElement)

  // Find the selected element
  const selectedNode = selectedElement
    ? nodes.find((n) => n.id === selectedElement)
    : undefined

  const selectedEdge = selectedElement
    ? edges.find((e) => e.id === selectedElement)
    : undefined

  const handleClose = () => {
    selectElement(null)
  }

  // If nothing selected, show message
  if (!selectedNode && !selectedEdge) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔍</span>
          <h2 className="text-xl font-semibold text-charcoal-900">Inspector</h2>
        </div>
        <div className="text-storm-700 text-sm">
          <p>Select a node or connection on the canvas to inspect its details.</p>
        </div>
      </div>
    )
  }

  // Node inspector
  if (selectedNode) {
    const nodeType = selectedNode.data?.type || selectedNode.type || 'unknown'
    const label = selectedNode.data?.label || 'Untitled'
    const description = selectedNode.data?.description || ''
    const prior = selectedNode.data?.prior
    const utility = selectedNode.data?.utility

    return (
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔍</span>
            <h2 className="text-xl font-semibold text-charcoal-900">Node Details</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-storm-600 hover:text-charcoal-900 transition-colors"
            aria-label="Close inspector"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Node type badge */}
        <div>
          <Badge variant={nodeType === 'outcome' ? 'success' : nodeType === 'decision' ? 'info' : 'neutral'}>
            {nodeType}
          </Badge>
        </div>

        {/* Node details */}
        <Card>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-storm-600 mb-1">Label</div>
              <div className="text-sm font-medium text-charcoal-900">{label}</div>
            </div>
            {description && (
              <div>
                <div className="text-xs text-storm-600 mb-1">Description</div>
                <div className="text-sm text-charcoal-900">{description}</div>
              </div>
            )}
            {prior !== undefined && (
              <div>
                <div className="text-xs text-storm-600 mb-1">Prior Probability</div>
                <div className="text-sm font-medium text-charcoal-900">
                  {Math.round(prior * 100)}%
                </div>
              </div>
            )}
            {utility !== undefined && (
              <div>
                <div className="text-xs text-storm-600 mb-1">Utility</div>
                <div className="text-sm font-medium text-charcoal-900">{utility.toFixed(2)}</div>
              </div>
            )}
          </div>
        </Card>

        {/* Actions */}
        <div className="space-y-2">
          <Button variant="outline" fullWidth>
            Edit properties
          </Button>
          <Button variant="outline" fullWidth>
            View connections
          </Button>
        </div>
      </div>
    )
  }

  // Edge inspector
  if (selectedEdge) {
    const sourceNode = nodes.find((n) => n.id === selectedEdge.source)
    const targetNode = nodes.find((n) => n.id === selectedEdge.target)
    const weight = selectedEdge.data?.weight
    const confidence = selectedEdge.data?.confidence
    const documents = selectedEdge.data?.documents || []

    return (
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔍</span>
            <h2 className="text-xl font-semibold text-charcoal-900">Connection Details</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-storm-600 hover:text-charcoal-900 transition-colors"
            aria-label="Close inspector"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Connection path */}
        <Card>
          <div className="space-y-2">
            <div className="text-xs text-storm-600">Connection</div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-charcoal-900">
                {sourceNode?.data?.label || 'Unknown'}
              </span>
              <span className="text-storm-600">→</span>
              <span className="text-sm font-medium text-charcoal-900">
                {targetNode?.data?.label || 'Unknown'}
              </span>
            </div>
          </div>
        </Card>

        {/* Connection details */}
        <Card>
          <div className="space-y-3">
            {weight !== undefined && (
              <div>
                <div className="text-xs text-storm-600 mb-1">Weight</div>
                <div className="text-sm font-medium text-charcoal-900">{weight.toFixed(2)}</div>
              </div>
            )}
            {confidence !== undefined && (
              <div>
                <div className="text-xs text-storm-600 mb-1">Confidence</div>
                <div className="text-sm font-medium text-charcoal-900">
                  {Math.round(confidence * 100)}%
                </div>
              </div>
            )}
            <div>
              <div className="text-xs text-storm-600 mb-1">Evidence</div>
              <div className="text-sm font-medium text-charcoal-900">
                {documents.length} document{documents.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="space-y-2">
          <Button variant="outline" fullWidth>
            Add evidence
          </Button>
          <Button variant="outline" fullWidth>
            Edit strength
          </Button>
        </div>
      </div>
    )
  }

  return null
}
