/**
 * Guide Bottom Toolbar
 *
 * Provides quick access to key actions:
 * - Chat interface toggle
 * - Quick actions (Clear, Help)
 * - Keyboard shortcuts hint
 *
 * The Run action was removed with the direct browser->PLoT run path
 * (useResultsRun): analysis is orchestrated by CEE, not by this surface.
 */

import { useState } from 'react'
import { useCanvasStore } from '@/canvas/store'
import { Button } from '../shared/Button'

export function GuideBottomToolbar(): JSX.Element {
  const [showChat, setShowChat] = useState(false)
  const nodes = useCanvasStore((state) => state.nodes)

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
