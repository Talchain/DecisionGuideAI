/**
 * Guide Canvas Wrapper
 *
 * Wraps the standard ReactFlowGraph with guide-specific enhancements:
 * - Adds visual overlay showing top drivers (Phase 4)
 * - Integrates with guide state for node selection
 * - Shows contextual canvas information post-run
 */

import { useEffect, useRef } from 'react'
import { useOnNodesChange, useOnEdgesChange, type NodeChange, type EdgeChange } from '@xyflow/react'
import { ReactFlowGraph } from '@/canvas/ReactFlowGraph'
import { GuideCanvasOverlay } from './GuideCanvasOverlay'
import { useResultsStore } from '@/canvas/stores/resultsStore'
import { useCanvasStore } from '@/canvas/store'
import { useGuideStore } from '../../hooks/useGuideStore'

export function GuideCanvas(): JSX.Element {
  const resultsStatus = useResultsStore((state) => state.status)
  const hasResults = resultsStatus === 'complete'
  const selectElement = useGuideStore((state) => state.selectElement)
  const canvasRef = useRef<HTMLDivElement>(null)

  // Listen for node selection changes in the canvas
  // When a node is selected, update guide state to show inspector
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

      {/* Guide enhancements overlay (only after run) */}
      {hasResults && <GuideCanvasOverlay enabled={true} />}
    </div>
  )
}
