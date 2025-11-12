/**
 * M2.4: Patch-First Diff Viewer
 * Shows added nodes/edges with Apply/Undo actions
 */

import { useState } from 'react'
import { Plus, Check, X, ChevronDown, ChevronRight } from 'lucide-react'
import type { DraftResponse } from '../../adapters/assistants/types'

interface DiffViewerProps {
  draft: DraftResponse
  onApply: (nodeIds: string[], edgeIds: string[]) => void
  onReject: () => void
}

interface DiffItem {
  type: 'node' | 'edge'
  id: string
  label: string
  selected: boolean
  data: any
}

export function DiffViewer({ draft, onApply, onReject }: DiffViewerProps) {
  const [items, setItems] = useState<DiffItem[]>(() => {
    const nodeItems: DiffItem[] = draft.graph.nodes.map((node) => ({
      type: 'node',
      id: node.id,
      label: node.label,
      selected: true, // Default: all selected
      data: node,
    }))

    const edgeItems: DiffItem[] = draft.graph.edges.map((edge) => ({
      type: 'edge',
      id: edge.id,
      label: edge.label || `${edge.from} → ${edge.to}`,
      selected: true,
      data: edge,
    }))

    return [...nodeItems, ...edgeItems]
  })

  const [showNodes, setShowNodes] = useState(true)
  const [showEdges, setShowEdges] = useState(true)

  const toggleItem = (id: string) => {
    setItems(items.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)))
  }

  const toggleAll = (type: 'node' | 'edge', selected: boolean) => {
    setItems(items.map((item) => (item.type === type ? { ...item, selected } : item)))
  }

  const handleApply = () => {
    const selectedNodes = items.filter((item) => item.type === 'node' && item.selected).map((item) => item.id)
    const selectedEdges = items.filter((item) => item.type === 'edge' && item.selected).map((item) => item.id)
    onApply(selectedNodes, selectedEdges)
  }

  const nodeItems = items.filter((item) => item.type === 'node')
  const edgeItems = items.filter((item) => item.type === 'edge')
  const selectedNodeCount = nodeItems.filter((item) => item.selected).length
  const selectedEdgeCount = edgeItems.filter((item) => item.selected).length

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Review Draft Changes</h3>
        <p className="text-sm text-gray-600 mt-1">
          Select which nodes and edges to add to your canvas
        </p>
      </div>

      {/* Nodes section */}
      <div className="border-b border-gray-200">
        <button
          onClick={() => setShowNodes(!showNodes)}
          className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50"
        >
          <div className="flex items-center gap-2">
            {showNodes ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <Plus className="w-4 h-4 text-green-600" />
            <span className="font-medium">
              {nodeItems.length} nodes ({selectedNodeCount} selected)
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleAll('node', true)
              }}
              className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded"
            >
              Select all
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleAll('node', false)
              }}
              className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-100 rounded"
            >
              Deselect all
            </button>
          </div>
        </button>

        {showNodes && (
          <div className="divide-y divide-gray-100">
            {nodeItems.map((item) => (
              <label
                key={item.id}
                className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={item.selected}
                  onChange={() => toggleItem(item.id)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <Plus className="w-3 h-3 text-green-600" />
                <span className="flex-1 text-sm">{item.label}</span>
                {item.data.type && (
                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                    {item.data.type}
                  </span>
                )}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Edges section */}
      <div>
        <button
          onClick={() => setShowEdges(!showEdges)}
          className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50"
        >
          <div className="flex items-center gap-2">
            {showEdges ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <Plus className="w-4 h-4 text-green-600" />
            <span className="font-medium">
              {edgeItems.length} edges ({selectedEdgeCount} selected)
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleAll('edge', true)
              }}
              className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded"
            >
              Select all
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleAll('edge', false)
              }}
              className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-100 rounded"
            >
              Deselect all
            </button>
          </div>
        </button>

        {showEdges && (
          <div className="divide-y divide-gray-100">
            {edgeItems.map((item) => (
              <label
                key={item.id}
                className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={item.selected}
                  onChange={() => toggleItem(item.id)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <Plus className="w-3 h-3 text-green-600" />
                <span className="flex-1 text-sm font-mono text-xs">{item.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex gap-2">
        <button
          onClick={handleApply}
          disabled={selectedNodeCount === 0 && selectedEdgeCount === 0}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
        >
          <Check className="w-4 h-4" />
          Apply Changes ({selectedNodeCount + selectedEdgeCount})
        </button>
        <button
          onClick={onReject}
          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 font-medium flex items-center gap-2"
        >
          <X className="w-4 h-4" />
          Reject
        </button>
      </div>
    </div>
  )
}
