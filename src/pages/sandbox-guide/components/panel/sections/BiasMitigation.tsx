/**
 * Bias Mitigation Preview
 *
 * Shows AI-suggested fixes for structural biases in the model.
 * Answers: "How do I fix structural problems?"
 *
 * Features:
 * - Displays bias findings with mitigation patches
 * - Preview modal showing changes before applying
 * - One-click "Apply to My Model" action
 * - Shows summary of nodes/edges that will be added
 */

import { AlertTriangle, Eye, X } from 'lucide-react'
import { useState } from 'react'
import { useCanvasStore } from '../../../../../canvas/store'

interface BiasFindings {
  bias_code: string
  mechanism: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  mitigation_patches?: Array<{
    bias_code: string
    description: string
    patch: {
      nodes?: Array<{
        label: string
        type?: string
        [key: string]: any
      }>
      edges?: Array<{
        source: string
        target: string
        [key: string]: any
      }>
    }
  }>
}

interface BiasMitigationProps {
  findings: BiasFindings[]
}

interface SelectedPatch {
  finding: BiasFindings
  patch: BiasFindings['mitigation_patches'][0]
}

export function BiasMitigation({ findings }: BiasMitigationProps): JSX.Element | null {
  const [selectedPatch, setSelectedPatch] = useState<SelectedPatch | null>(null)
  const addNode = useCanvasStore((state) => state.addNode)
  const addEdge = useCanvasStore((state) => state.addEdge)
  const nodes = useCanvasStore((state) => state.nodes)
  const edges = useCanvasStore((state) => state.edges)

  const findingsWithPatches = findings.filter((f) => f.mitigation_patches?.length > 0)

  if (findingsWithPatches.length === 0) return null

  const handleApplyPatch = () => {
    if (!selectedPatch) return

    const { patch } = selectedPatch.patch

    // Add new nodes
    patch.nodes?.forEach((node) => {
      // Add node at a reasonable position (center of canvas)
      addNode({ x: 250, y: 250 })
    })

    // Add new edges
    patch.edges?.forEach((edge) => {
      addEdge({
        source: edge.source,
        target: edge.target,
        data: edge.data || {},
      })
    })

    setSelectedPatch(null)
  }

  return (
    <div className="space-y-3 font-sans p-6">
      <h3 className="text-sm font-semibold text-storm-900">Suggested Fixes</h3>

      {findingsWithPatches.map((finding, idx) => (
        <div key={idx} className="border border-amber-200 rounded-lg p-4 bg-amber-50">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="flex-1 space-y-2">
              <div>
                <p className="text-sm font-medium text-amber-900">
                  {finding.bias_code.replace(/_/g, ' ').toLowerCase()}
                </p>
                <p className="text-xs text-amber-700 mt-1">{finding.mechanism}</p>
              </div>

              {finding.mitigation_patches?.map((patch, patchIdx) => (
                <button
                  key={patchIdx}
                  onClick={() => setSelectedPatch({ finding, patch })}
                  className="
                    flex items-center gap-2 px-3 py-2
                    bg-white border border-amber-300 rounded
                    hover:bg-amber-50 transition text-sm
                  "
                >
                  <Eye className="w-4 h-4" aria-hidden="true" />
                  <span>Preview Suggested Fix</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}

      {selectedPatch && (
        <BiasPreviewModal
          finding={selectedPatch.finding}
          patch={selectedPatch.patch}
          currentNodesCount={nodes.length}
          currentEdgesCount={edges.length}
          onApply={handleApplyPatch}
          onCancel={() => setSelectedPatch(null)}
        />
      )}
    </div>
  )
}

function BiasPreviewModal({
  finding,
  patch,
  currentNodesCount,
  currentEdgesCount,
  onApply,
  onCancel,
}: {
  finding: BiasFindings
  patch: BiasFindings['mitigation_patches'][0]
  currentNodesCount: number
  currentEdgesCount: number
  onApply: () => void
  onCancel: () => void
}): JSX.Element {
  const nodesAdded = patch.patch.nodes?.length || 0
  const edgesAdded = patch.patch.edges?.length || 0

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onCancel}
      role="dialog"
      aria-labelledby="bias-modal-title"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h3 id="bias-modal-title" className="text-lg font-semibold text-storm-900">
                Suggested Fix: {finding.bias_code.replace(/_/g, ' ')}
              </h3>
              <p className="text-sm text-storm-600 mt-1">{patch.description}</p>
            </div>
            <button
              onClick={onCancel}
              className="text-storm-400 hover:text-storm-600 transition"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Current vs Improved */}
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-storm-200 rounded-lg p-4">
              <p className="text-xs font-medium text-storm-700 mb-2">Current Model</p>
              <div className="text-xs text-storm-600">
                {currentNodesCount} nodes, {currentEdgesCount} edges
              </div>
            </div>

            <div className="border border-green-200 rounded-lg p-4 bg-green-50">
              <p className="text-xs font-medium text-green-700 mb-2">Improved Model</p>
              <div className="text-xs text-green-600">
                +{nodesAdded} nodes, +{edgesAdded} edges
              </div>
            </div>
          </div>

          {/* Changes Summary */}
          {patch.patch.nodes && patch.patch.nodes.length > 0 && (
            <div className="bg-analytical-50 border border-analytical-200 rounded p-3">
              <p className="text-xs font-medium text-analytical-900">Changes Summary</p>
              <ul className="text-xs text-analytical-700 mt-1 space-y-1">
                {patch.patch.nodes.slice(0, 3).map((node, idx) => (
                  <li key={idx}>• Add &quot;{node.label}&quot; node</li>
                ))}
                {nodesAdded > 3 && <li>• ... and {nodesAdded - 3} more</li>}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm border border-storm-300 rounded hover:bg-storm-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={onApply}
              className="px-4 py-2 text-sm bg-analytical-600 text-white rounded hover:bg-analytical-700 transition"
            >
              Apply to My Model
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
