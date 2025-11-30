/**
 * Guide Canvas Wrapper
 *
 * Wraps the standard ReactFlowGraph with guide-specific enhancements:
 * - Visual encoding: edge thickness, colors, node badges
 * - Critical gap animations
 * - Top driver badges with rank
 * - Post-run highlighting: emphasize drivers, fade non-critical paths
 * - Integrates with guide state for node selection
 * - Shows contextual canvas information post-run
 */

import { useEffect, useRef, useMemo } from 'react'
import { ReactFlowGraph } from '@/canvas/ReactFlowGraph'
import { GuideCanvasOverlay } from './GuideCanvasOverlay'
import { NodeBadge } from './NodeBadge'
import { useResultsStore } from '@/canvas/stores/resultsStore'
import { useCanvasStore } from '@/canvas/store'
import { useGuideStore } from '../../hooks/useGuideStore'
import { enhanceEdges, getNodeBadge } from '../../utils/canvasEnhancement'
import { usePostRunHighlighting } from '../../hooks/usePostRunHighlighting'
import './canvas-animations.css'

export function GuideCanvas(): JSX.Element {
  const resultsStatus = useResultsStore((state) => state.status)
  const report = useResultsStore((state) => state.report)
  const hasResults = resultsStatus === 'complete'
  const selectElement = useGuideStore((state) => state.selectElement)
  const canvasRef = useRef<HTMLDivElement>(null)

  // Apply post-run highlighting automatically
  usePostRunHighlighting()

  // Get canvas data
  const nodes = useCanvasStore((state) => state.nodes)
  const edges = useCanvasStore((state) => state.edges)

  // Extract analysis data for visual encoding
  const topDrivers = useMemo(() => {
    if (!report?.drivers) return undefined
    return report.drivers.map((d: any) => ({
      node_id: d.node_id,
      contribution: d.contribution,
      node_label: d.label,
      explanation: d.explanation,
    }))
  }, [report?.drivers])

  const criticalGaps = useMemo(() => {
    if (!report?.critical_gaps) return undefined
    return report.critical_gaps.map((g: any) => ({
      edge_id: g.edge_id,
      impact_on_outcome: g.impact,
      recommendation: g.recommendation,
    }))
  }, [report?.critical_gaps])

  // For now, we don't have evidence coverage in the store
  // This would come from documents store in a real implementation
  const evidenceCoverage = useMemo(() => new Map<string, number>(), [])

  // Collect node badges for top 3 drivers
  const nodeBadges = useMemo(() => {
    if (!hasResults || !topDrivers) return []

    return topDrivers
      .slice(0, 3)
      .map((driver) => {
        const badge = getNodeBadge(driver.node_id, topDrivers)
        if (!badge) return null

        return {
          nodeId: driver.node_id,
          ...badge,
        }
      })
      .filter(Boolean)
  }, [hasResults, topDrivers])

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

      {/* Node badges for top drivers */}
      {hasResults &&
        nodeBadges.map((badge: any) => (
          <NodeBadge
            key={badge.nodeId}
            nodeId={badge.nodeId}
            percentage={badge.percentage}
            rank={badge.rank}
          />
        ))}

      {/* Guide enhancements overlay (only after run) */}
      {hasResults && <GuideCanvasOverlay enabled={true} />}
    </div>
  )
}
