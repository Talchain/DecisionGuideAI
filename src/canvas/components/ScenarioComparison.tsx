/**
 * @deprecated LEGACY COMPONENT - Use ComparisonCanvasLayout instead
 *
 * M6: Scenario Comparison (LEGACY)
 * Side-by-side comparison of graph snapshots
 * Phase 2: Synced pan/zoom between canvases
 *
 * This component has been superseded by ComparisonCanvasLayout which provides:
 * - Better integration with the unified Results tab
 * - Improved outcomes comparison bar
 * - Modern UI patterns consistent with the rest of the app
 *
 * Migration: Replace ScenarioComparison usage with ComparisonCanvasLayout
 * See: src/canvas/components/ComparisonCanvasLayout.tsx
 *
 * TODO: Remove after Q1 2025 if no longer used
 */

import { useState } from 'react'
import { GitCompare, ChevronLeft, Download, Link2, Link2Off, Maximize2 } from 'lucide-react'
import { ReactFlowProvider } from '@xyflow/react'
import type { Snapshot, ComparisonResult } from '../snapshots/types'
import { typography } from '../../styles/typography'
import { MiniCanvas } from './MiniCanvas'
import { useSyncedViewports } from '../hooks/useSyncedViewports'

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
            <p className={`${typography.caption} text-gray-600`}>
              {snapshotA.name} vs {snapshotB.name}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex bg-gray-100 rounded-md p-0.5">
            <button
              onClick={() => setSelectedView('split')}
              className={`px-3 py-1 ${typography.caption} font-medium rounded ${
                selectedView === 'split'
                  ? 'bg-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Side-by-Side
            </button>
            <button
              onClick={() => setSelectedView('changes')}
              className={`px-3 py-1 ${typography.caption} font-medium rounded ${
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
              className={`flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded ${typography.button} hover:bg-blue-700`}
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className={`px-4 py-2 bg-gray-50 border-b border-gray-200 flex gap-4 ${typography.caption}`}>
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

interface SplitViewProps {
  snapshotA: Snapshot
  snapshotB: Snapshot
}

function SplitView({ snapshotA, snapshotB }: SplitViewProps) {
  const [syncEnabled, setSyncEnabled] = useState(true)
  const {
    setInstanceA,
    setInstanceB,
    onMoveEndA,
    onMoveEndB,
    fitBoth,
  } = useSyncedViewports({ enabled: syncEnabled })

  return (
    <div className="h-full flex flex-col">
      {/* Sync controls */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSyncEnabled(!syncEnabled)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-sm ${
              syncEnabled
                ? 'bg-info-100 text-info-700'
                : 'bg-gray-100 text-gray-600'
            }`}
            title={syncEnabled ? 'Disable synced pan/zoom' : 'Enable synced pan/zoom'}
          >
            {syncEnabled ? (
              <Link2 className="w-4 h-4" />
            ) : (
              <Link2Off className="w-4 h-4" />
            )}
            <span>{syncEnabled ? 'Synced' : 'Independent'}</span>
          </button>
          <button
            onClick={fitBoth}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 text-sm"
            title="Fit both canvases to view"
          >
            <Maximize2 className="w-4 h-4" />
            <span>Fit Both</span>
          </button>
        </div>
        <p className={`${typography.caption} text-gray-500`}>
          Pan and zoom to explore • {syncEnabled ? 'Both views synced' : 'Views independent'}
        </p>
      </div>

      {/* Side-by-side canvases */}
      <div className="flex-1 grid grid-cols-2 divide-x divide-gray-200">
        {/* Left: Snapshot A */}
        <div className="flex flex-col min-h-0">
          <div className="px-4 py-2 bg-info-50 border-b border-info-200 flex items-center justify-between">
            <div>
              <h4 className="font-medium text-info-900">{snapshotA.name}</h4>
              <p className={`${typography.caption} text-info-700 mt-0.5`}>
                {snapshotA.nodes.length} nodes, {snapshotA.edges.length} edges
              </p>
            </div>
            <span className={`${typography.caption} text-info-600`}>
              {new Date(snapshotA.createdAt).toLocaleString()}
            </span>
          </div>
          <div className="flex-1 min-h-0">
            <ReactFlowProvider>
              <MiniCanvas
                nodes={snapshotA.nodes}
                edges={snapshotA.edges}
                onInit={setInstanceA}
                onMoveEnd={onMoveEndA}
                ariaLabel={`Snapshot A: ${snapshotA.name}`}
              />
            </ReactFlowProvider>
          </div>
        </div>

        {/* Right: Snapshot B */}
        <div className="flex flex-col min-h-0">
          <div className="px-4 py-2 bg-mint-50 border-b border-mint-200 flex items-center justify-between">
            <div>
              <h4 className="font-medium text-mint-900">{snapshotB.name}</h4>
              <p className={`${typography.caption} text-mint-700 mt-0.5`}>
                {snapshotB.nodes.length} nodes, {snapshotB.edges.length} edges
              </p>
            </div>
            <span className={`${typography.caption} text-mint-600`}>
              {new Date(snapshotB.createdAt).toLocaleString()}
            </span>
          </div>
          <div className="flex-1 min-h-0">
            <ReactFlowProvider>
              <MiniCanvas
                nodes={snapshotB.nodes}
                edges={snapshotB.edges}
                onInit={setInstanceB}
                onMoveEnd={onMoveEndB}
                ariaLabel={`Snapshot B: ${snapshotB.name}`}
              />
            </ReactFlowProvider>
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
            <h4 className={`font-medium text-green-900 ${typography.body}`}>
              Added ({comparison.added.nodes.length + comparison.added.edges.length})
            </h4>
          </div>
          <div className="p-3 space-y-1">
            {comparison.added.nodes.map((node) => (
              <div key={node.id} className={`${typography.body} text-gray-700`}>
                + Node: {node.data.label || node.id}
              </div>
            ))}
            {comparison.added.edges.map((edge) => (
              <div key={edge.id} className={`${typography.body} text-gray-700`}>
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
            <h4 className={`font-medium text-red-900 ${typography.body}`}>
              Removed ({comparison.removed.nodes.length + comparison.removed.edges.length})
            </h4>
          </div>
          <div className="p-3 space-y-1">
            {comparison.removed.nodes.map((node) => (
              <div key={node.id} className={`${typography.body} text-gray-700`}>
                - Node: {node.data.label || node.id}
              </div>
            ))}
            {comparison.removed.edges.map((edge) => (
              <div key={edge.id} className={`${typography.body} text-gray-700`}>
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
            <h4 className={`font-medium text-yellow-900 ${typography.body}`}>
              Modified ({comparison.modified.nodes.length + comparison.modified.edges.length})
            </h4>
          </div>
          <div className="p-3 space-y-1">
            {comparison.modified.nodes.map((node) => (
              <div key={node.id} className={`${typography.body} text-gray-700`}>
                ~ Node: {node.data.label || node.id}
              </div>
            ))}
            {comparison.modified.edges.map((edge) => (
              <div key={edge.id} className={`${typography.body} text-gray-700`}>
                ~ Edge: {edge.source} → {edge.target}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
