/**
 * Post-Run Highlighting Hook
 *
 * Automatically applies visual highlighting when entering post-run stage:
 * - Emphasizes top 3 driver nodes and their paths
 * - Fades non-critical elements
 * - Clears highlighting when leaving post-run stage
 */

import { useEffect } from 'react'
import { useCanvasStore } from '@/canvas/store'
import { useResultsStore } from '@/canvas/stores/resultsStore'
import { useGuideStore } from './useGuideStore'
import { applyPostRunHighlighting, clearHighlighting } from '../utils/canvasHighlighting'

export function usePostRunHighlighting() {
  const journeyStage = useGuideStore((state) => state.journeyStage)
  const report = useResultsStore((state) => state.report)
  const setNodes = useCanvasStore((state) => state.setNodes)
  const setEdges = useCanvasStore((state) => state.setEdges)
  const nodes = useCanvasStore((state) => state.nodes)
  const edges = useCanvasStore((state) => state.edges)

  useEffect(() => {
    // Only apply highlighting in post-run stage with valid results
    if (journeyStage === 'post-run' && report?.drivers) {
      const topDrivers = report.drivers.map((d: any) => ({
        node_id: d.node_id,
        contribution: d.contribution,
        node_label: d.label,
        explanation: d.explanation,
      }))

      const { nodes: highlightedNodes, edges: highlightedEdges } =
        applyPostRunHighlighting(nodes, edges, topDrivers)

      setNodes(highlightedNodes)
      setEdges(highlightedEdges)
    } else if (journeyStage !== 'post-run') {
      // Clear highlighting when leaving post-run stage
      const { nodes: clearedNodes, edges: clearedEdges } = clearHighlighting(nodes, edges)

      setNodes(clearedNodes)
      setEdges(clearedEdges)
    }
  }, [journeyStage, report?.drivers]) // Intentionally omitting nodes/edges to avoid loops

  return null
}
