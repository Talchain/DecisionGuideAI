/**
 * Copilot Canvas Wrapper
 *
 * Wraps the standard ReactFlowGraph with copilot-specific enhancements:
 * - Adds visual overlay showing top drivers (Phase 4)
 * - Integrates with copilot state for node selection
 * - Shows contextual canvas information post-run
 */

import { useEffect, useRef } from 'react'
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
  const canvasRef = useRef<HTMLDivElement>(null)

  // Listen for node selection changes in the canvas
  // When a node is selected, update copilot state to show inspector
  // NOTE: Scoped to canvas container to avoid interfering with other components
  useEffect(() => {
    const handleNodeClick = (event: MouseEvent) => {
      // Only handle clicks within the canvas container
      if (!canvasRef.current?.contains(event.target as Node)) {
        return
      }

      // Check if the click target is a node
      const target = event.target as HTMLElement
      const nodeElement = target.closest('[data-id]')
      if (nodeElement) {
        const nodeId = nodeElement.getAttribute('data-id')
        if (nodeId) {
          selectElement(nodeId)
        }
      }
    }

    // Add click listener to document but scope checking to canvas
    document.addEventListener('click', handleNodeClick)

    return () => {
      document.removeEventListener('click', handleNodeClick)
    }
  }, [selectElement])

  return (
    <div ref={canvasRef} className="relative w-full h-full">
      {/* Base canvas */}
      <ReactFlowGraph />

      {/* Copilot enhancements overlay (only after run) */}
      {hasResults && <CopilotCanvasOverlay enabled={true} />}
    </div>
  )
}
