/**
 * M6: Scenario Comparison
 * Side-by-side comparison of graph snapshots
 */

import { useState } from 'react'
import { GitCompare, ChevronLeft, Download } from 'lucide-react'
import type { Snapshot, ComparisonResult } from '../snapshots/types'

interface ScenarioComparisonProps {
  snapshotA: Snapshot
  snapshotB: Snapshot
  comparison: ComparisonResult
  onExport?: () => void
  onClose: () => void
}

export function ScenarioComparison({
  snapshotA,
  snapshotB,
  comparison,
  onExport,
  onClose,
}: ScenarioComparisonProps) {
  const [selectedView, setSelectedView] = useState<'split' | 'changes'>('split')

  const stats = {
    added: comparison.added.nodes.length + comparison.added.edges.length,
    removed: comparison.removed.nodes.length + comparison.removed.edges.length,
    modified: comparison.modified.nodes.length + comparison.modified.edges.length,
    unchanged: comparison.unchanged.nodes.length + comparison.unchanged.edges.length,
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
            title="Close comparison"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <GitCompare className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="font-semibold text-gray-900">Compare Scenarios</h3>
            <p className="text-xs text-gray-600">
              {snapshotA.name} vs {snapshotB.name}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex bg-gray-100 rounded-md p-0.5">
            <button
              onClick={() => setSelectedView('split')}
              className={`px-3 py-1 text-xs font-medium rounded ${
                selectedView === 'split'
                  ? 'bg-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Side-by-Side
            </button>
            <button
              onClick={() => setSelectedView('changes')}
              className={`px-3 py-1 text-xs font-medium rounded ${
                selectedView === 'changes'
                  ? 'bg-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Changes Only
            </button>
          </div>

          {onExport && (
            <button
              onClick={onExport}
              className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="font-medium">{stats.added} added</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="font-medium">{stats.removed} removed</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span className="font-medium">{stats.modified} modified</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-gray-400" />
          <span>{stats.unchanged} unchanged</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {selectedView === 'split' ? (
          <SplitView snapshotA={snapshotA} snapshotB={snapshotB} />
        ) : (
          <ChangesView comparison={comparison} />
        )}
      </div>
    </div>
  )
}

function SplitView({ snapshotA, snapshotB }: { snapshotA: Snapshot; snapshotB: Snapshot }) {
  return (
    <div className="h-full grid grid-cols-2 divide-x divide-gray-200">
      {/* Left: Snapshot A */}
      <div className="flex flex-col">
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-200">
          <h4 className="font-medium text-blue-900">{snapshotA.name}</h4>
          <p className="text-xs text-blue-700 mt-0.5">
            {snapshotA.nodes.length} nodes, {snapshotA.edges.length} edges
          </p>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="text-sm text-gray-600">
            Graph visualization placeholder
            <br />
            <span className="text-xs">
              {new Date(snapshotA.createdAt).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Snapshot B */}
      <div className="flex flex-col">
        <div className="px-4 py-2 bg-green-50 border-b border-green-200">
          <h4 className="font-medium text-green-900">{snapshotB.name}</h4>
          <p className="text-xs text-green-700 mt-0.5">
            {snapshotB.nodes.length} nodes, {snapshotB.edges.length} edges
          </p>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="text-sm text-gray-600">
            Graph visualization placeholder
            <br />
            <span className="text-xs">
              {new Date(snapshotB.createdAt).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChangesView({ comparison }: { comparison: ComparisonResult }) {
  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      {/* Added items */}
      {(comparison.added.nodes.length > 0 || comparison.added.edges.length > 0) && (
        <div className="border border-green-200 rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-green-50 border-b border-green-200">
            <h4 className="font-medium text-green-900 text-sm">
              Added ({comparison.added.nodes.length + comparison.added.edges.length})
            </h4>
          </div>
          <div className="p-3 space-y-1">
            {comparison.added.nodes.map((node) => (
              <div key={node.id} className="text-sm text-gray-700">
                + Node: {node.data.label || node.id}
              </div>
            ))}
            {comparison.added.edges.map((edge) => (
              <div key={edge.id} className="text-sm text-gray-700">
                + Edge: {edge.source} → {edge.target}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Removed items */}
      {(comparison.removed.nodes.length > 0 || comparison.removed.edges.length > 0) && (
        <div className="border border-red-200 rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-red-50 border-b border-red-200">
            <h4 className="font-medium text-red-900 text-sm">
              Removed ({comparison.removed.nodes.length + comparison.removed.edges.length})
            </h4>
          </div>
          <div className="p-3 space-y-1">
            {comparison.removed.nodes.map((node) => (
              <div key={node.id} className="text-sm text-gray-700">
                - Node: {node.data.label || node.id}
              </div>
            ))}
            {comparison.removed.edges.map((edge) => (
              <div key={edge.id} className="text-sm text-gray-700">
                - Edge: {edge.source} → {edge.target}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modified items */}
      {(comparison.modified.nodes.length > 0 || comparison.modified.edges.length > 0) && (
        <div className="border border-yellow-200 rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-yellow-50 border-b border-yellow-200">
            <h4 className="font-medium text-yellow-900 text-sm">
              Modified ({comparison.modified.nodes.length + comparison.modified.edges.length})
            </h4>
          </div>
          <div className="p-3 space-y-1">
            {comparison.modified.nodes.map((node) => (
              <div key={node.id} className="text-sm text-gray-700">
                ~ Node: {node.data.label || node.id}
              </div>
            ))}
            {comparison.modified.edges.map((edge) => (
              <div key={edge.id} className="text-sm text-gray-700">
                ~ Edge: {edge.source} → {edge.target}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
