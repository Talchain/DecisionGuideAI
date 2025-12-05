/**
 * Guide Bottom Toolbar
 *
 * Provides quick access to key actions:
 * - Chat interface toggle
 * - Quick actions (Run, Clear, Help)
 * - Keyboard shortcuts hint
 */

import { useState } from 'react'
import { useGuideStore } from '../../hooks/useGuideStore'
import { useResultsRun } from '@/canvas/hooks/useResultsRun'
import { useCanvasStore } from '@/canvas/store'
import { useResultsStore } from '@/canvas/stores/resultsStore'
import { Button } from '../shared/Button'
import { findBlockers } from '../../utils/journeyDetection'

export function GuideBottomToolbar(): JSX.Element {
  const [showChat, setShowChat] = useState(false)
  const journeyStage = useGuideStore((state) => state.journeyStage)
  const nodes = useCanvasStore((state) => state.nodes)
  const edges = useCanvasStore((state) => state.edges)
  const outcomeNodeId = useCanvasStore((state) => state.outcomeNodeId)
  const resultsStatus = useResultsStore((state) => state.status)
  const { run } = useResultsRun()

  const blockers = findBlockers({ nodes, edges })
  const canRun = blockers.length === 0 && nodes.length > 0

  const handleRun = () => {
    if (!canRun) return

    run({
      graph: {
        nodes: nodes.map((n) => ({ id: n.id, data: n.data })),
        edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, data: e.data })),
      },
      outcome_node: outcomeNodeId || undefined,
      seed: 1337,
    })
  }

  const handleClear = () => {
    if (confirm('Clear all nodes and edges? This cannot be undone.')) {
      useCanvasStore.getState().clearCanvas()
    }
  }

  const handleHelp = () => {
    // Help is triggered by keyboard shortcut '?' - this button is redundant
    // Kept for discoverability but could trigger same help modal in future
  }

  return (
    <div className="h-12 border-t border-storm-200 bg-white flex items-center px-4 gap-3">
      {/* Left: Chat toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant={showChat ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setShowChat(!showChat)}
        >
          💬 Chat
        </Button>
        {showChat && (
          <div className="text-xs text-storm-600 italic">
            Chat interface coming soon...
          </div>
        )}
      </div>

      {/* Center: Spacer */}
      <div className="flex-1" />

      {/* Right: Quick actions */}
      <div className="flex items-center gap-2">
        {/* Run button - only show when ready */}
        {(journeyStage === 'pre-run-ready' || journeyStage === 'building') && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleRun}
            disabled={!canRun || resultsStatus === 'loading'}
          >
            {resultsStatus === 'loading' ? '⏳ Running...' : '▶ Run Analysis'}
          </Button>
        )}

        {/* Clear button */}
        {nodes.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleClear}>
            Clear
          </Button>
        )}

        {/* Help button */}
        <Button variant="ghost" size="sm" onClick={handleHelp}>
          ?
        </Button>

        {/* Keyboard hint */}
        <div className="text-xs text-storm-600 ml-2">
          Press <kbd className="px-1.5 py-0.5 bg-storm-100 rounded border border-storm-200 font-mono">?</kbd> for shortcuts
        </div>
      </div>
    </div>
  )
}
