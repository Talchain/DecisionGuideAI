/**
 * Copilot Canvas Wrapper
 *
 * Wraps the standard ReactFlowGraph with copilot-specific enhancements:
 * - Adds visual overlay showing top drivers (Phase 4)
 * - Integrates with copilot state for node selection
 * - Shows contextual canvas information post-run
 */

import { useEffect } from 'react'
import { useOnNodesChange, useOnEdgesChange, type NodeChange, type EdgeChange } from '@xyflow/react'
import { ReactFlowGraph } from '@/canvas/ReactFlowGraph'
import { CopilotCanvasOverlay } from './CopilotCanvasOverlay'
import { useResultsStore } from '@/canvas/stores/resultsStore'
import { useCanvasStore } from '@/canvas/store'
import { useCopilotStore } from '../../hooks/useCopilotStore'

export function CopilotCanvas(): JSX.Element {
  const resultsStatus = useResultsStore((state) => state.status)
  const hasResults = resultsStatus === 'complete'
  const selectElement = useCopilotStore((state) => state.selectElement)

  // Listen for node selection changes in the canvas
  // When a node is selected, update copilot state to show inspector
  useEffect(() => {
    const handleNodeClick = (event: any) => {
      // Check if the click target is a node
      const nodeElement = event.target.closest('[data-id]')
      if (nodeElement) {
        const nodeId = nodeElement.getAttribute('data-id')
        if (nodeId) {
          selectElement(nodeId)
        }
      }
    }

    // Add global click listener
    document.addEventListener('click', handleNodeClick)

    return () => {
      document.removeEventListener('click', handleNodeClick)
    }
  }, [selectElement])

  return (
    <div className="relative w-full h-full">
      {/* Base canvas */}
      <ReactFlowGraph />

      {/* Copilot enhancements overlay (only after run) */}
      {hasResults && <CopilotCanvasOverlay enabled={true} />}
    </div>
  )
}
