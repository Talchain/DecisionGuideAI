/**
 * EdgeSummarySection — "What shapes your decision" panel section.
 *
 * Graph Editing Experience Task 9d: Positioned before the edge assumptions table
 * in the pre-analysis panel. Shows strongest influence and most uncertain edge.
 * Each item is clickable to select the edge on canvas.
 *
 * Post-analysis: replaces "most uncertain" with "most fragile" if fragile edges exist,
 * adds "most influential" factor linking to the factor node.
 * Only considers causal edges (excludes decision→option structural edges).
 */

import { useMemo } from 'react'
import { Link2 } from 'lucide-react'
import { useCanvasStore } from '../../store'
import { computeSignedMean } from '../../domain/edges'
import { isStructuralEdge } from '../../domain/edgeUtils'
import { typography } from '@/styles/typography'
import { getStrengthLabel } from '../../ui/inspector-v2/inspectorStrings'

interface EdgeSummarySectionProps {
  onSelectEdge: (edgeId: string) => void
  onFocusNode?: (nodeId: string) => void
}

export function EdgeSummarySection({ onSelectEdge, onFocusNode }: EdgeSummarySectionProps) {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const resultsStatus = useCanvasStore(s => s.results?.status)
  const report = useCanvasStore(s => s.results?.report)
  const isPostAnalysis = resultsStatus === 'complete'

  const summary = useMemo(() => {
    if (!edges || edges.length === 0) return null

    // Filter to causal edges only (exclude decision→option structural edges)
    const getNodeKind = (id: string) => (nodeMap.get(id)?.type ?? (nodeMap.get(id)?.data as Record<string, unknown>)?.kind) as string | undefined
    const causalEdges = edges.filter(e => !isStructuralEdge(e as any, getNodeKind))
    if (causalEdges.length === 0) return null

    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    const getLabel = (id: string) =>
      (nodeMap.get(id)?.data as Record<string, unknown>)?.label as string ?? id

    // Find strongest edge by |mean|
    let strongest: { id: string; source: string; target: string; strength: number; direction: string } | null = null
    let mostUncertain: { id: string; source: string; target: string; confidence: number } | null = null

    for (const e of causalEdges) {
      const data = e.data as Record<string, unknown> | undefined
      const signedMean = computeSignedMean(data)
      const mean = Math.abs(signedMean)
      const ep = (data?.beliefExists ?? data?.belief_exists ?? data?.exists_probability) as number | undefined
      // P1-1 Fix: Read direction from edge data, not node data
      const edgeDirection = (data?.direction as string) ?? (signedMean < 0 ? 'negative' : 'positive')

      if (!strongest || mean > strongest.strength) {
        strongest = { id: e.id, source: e.source, target: e.target, strength: mean, direction: edgeDirection }
      }
      if (ep !== undefined && (!mostUncertain || ep < mostUncertain.confidence)) {
        mostUncertain = { id: e.id, source: e.source, target: e.target, confidence: ep }
      }
    }

    const strengthBand = strongest
      ? getStrengthLabel(strongest.strength).toLowerCase()
      : null

    // Post-analysis: find most fragile edge
    let mostFragile: { id: string; source: string; target: string; switchProb: number } | null = null
    let topInfluentialFactor: { nodeId: string; label: string } | null = null
    if (isPostAnalysis && report) {
      const reportAny = report as Record<string, unknown>
      const robustness = reportAny.robustness as Record<string, unknown> | undefined
      const fragileEdges = (robustness?.fragile_edges ?? []) as Array<Record<string, unknown>>
      if (fragileEdges.length > 0) {
        // Sort by switch_probability descending
        const sorted = [...fragileEdges].sort((a, b) =>
          ((b.switch_probability ?? b.switchProbability ?? 0) as number) -
          ((a.switch_probability ?? a.switchProbability ?? 0) as number)
        )
        const top = sorted[0]
        const feSource = (top.from_id ?? top.fromId ?? top.source) as string
        const feTarget = (top.to_id ?? top.toId ?? top.target) as string
        const feId = (top.edge_id ?? top.edgeId) as string | undefined
        mostFragile = {
          id: feId ?? `${feSource}-${feTarget}`,
          source: feSource,
          target: feTarget,
          switchProb: (top.switch_probability ?? top.switchProbability ?? 0) as number,
        }
      }

      // Find most influential factor from sensitivity analysis
      const sensitivity = (reportAny.enrichment as Record<string, unknown> | undefined)?.sensitivity_analysis as Record<string, unknown> | undefined
      const factors = (sensitivity?.factors ?? reportAny.factor_sensitivity ?? []) as Array<Record<string, unknown>>
      if (factors.length > 0) {
        const sorted = [...factors].sort((a, b) =>
          Math.abs((b.elasticity ?? b.sensitivity_score ?? 0) as number) -
          Math.abs((a.elasticity ?? a.sensitivity_score ?? 0) as number)
        )
        const topFactor = sorted[0]
        const factorId = (topFactor.factor_id ?? topFactor.factorId ?? topFactor.node_id ?? topFactor.nodeId) as string
        topInfluentialFactor = { nodeId: factorId, label: getLabel(factorId) }
      }
    }

    return {
      edgeCount: causalEdges.length,
      strongest: strongest ? {
        ...strongest,
        sourceLabel: getLabel(strongest.source),
        targetLabel: getLabel(strongest.target),
        band: strengthBand,
      } : null,
      mostUncertain: mostUncertain ? {
        ...mostUncertain,
        sourceLabel: getLabel(mostUncertain.source),
        targetLabel: getLabel(mostUncertain.target),
        confidencePct: Math.round(mostUncertain.confidence * 100),
      } : null,
      mostFragile: mostFragile ? {
        ...mostFragile,
        sourceLabel: getLabel(mostFragile.source),
        targetLabel: getLabel(mostFragile.target),
      } : null,
      topInfluentialFactor,
      isPostAnalysis,
    }
  }, [nodes, edges, isPostAnalysis, report])

  if (!summary || summary.edgeCount === 0) return null

  return (
    <div className="rounded-lg border border-panel-border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Link2 className="w-4 h-4 text-info" />
        <span className={`${typography.panelHeader} text-text-header`}>What shapes your decision</span>
      </div>

      <p className={`${typography.caption} text-text-muted`}>
        Your decision is shaped by {summary.edgeCount} causal relationship{summary.edgeCount !== 1 ? 's' : ''}.
      </p>

      {summary.strongest && (
        <button
          type="button"
          onClick={() => onSelectEdge(summary.strongest!.id)}
          className={`w-full text-left px-2 py-1.5 rounded hover:bg-panel-hover transition-colors cursor-pointer ${typography.caption} text-text-body`}
        >
          <span className="font-medium">Strongest influence:</span>{' '}
          {summary.strongest.sourceLabel} → {summary.strongest.targetLabel}{' '}
          <span className="text-text-muted">({summary.strongest.band} {summary.strongest.direction})</span>
        </button>
      )}

      {/* Post-analysis: show most fragile instead of most uncertain */}
      {summary.isPostAnalysis && summary.mostFragile ? (
        <button
          type="button"
          onClick={() => onSelectEdge(summary.mostFragile!.id)}
          className={`w-full text-left px-2 py-1.5 rounded hover:bg-panel-hover transition-colors cursor-pointer ${typography.caption} text-text-body`}
        >
          <span className="font-medium">Most fragile:</span>{' '}
          {summary.mostFragile.sourceLabel} → {summary.mostFragile.targetLabel}{' '}
          <span className="text-text-muted">({Math.round(summary.mostFragile.switchProb * 100)}% switch probability)</span>
        </button>
      ) : summary.mostUncertain && summary.mostUncertain.confidence < 0.8 ? (
        <button
          type="button"
          onClick={() => onSelectEdge(summary.mostUncertain!.id)}
          className={`w-full text-left px-2 py-1.5 rounded hover:bg-panel-hover transition-colors cursor-pointer ${typography.caption} text-text-body`}
        >
          <span className="font-medium">Most uncertain:</span>{' '}
          {summary.mostUncertain.sourceLabel} → {summary.mostUncertain.targetLabel}{' '}
          <span className="text-text-muted">({summary.mostUncertain.confidencePct}% confidence)</span>
        </button>
      ) : null}

      {/* Post-analysis: most influential factor */}
      {summary.isPostAnalysis && summary.topInfluentialFactor && onFocusNode && (
        <button
          type="button"
          onClick={() => onFocusNode(summary.topInfluentialFactor!.nodeId)}
          className={`w-full text-left px-2 py-1.5 rounded hover:bg-panel-hover transition-colors cursor-pointer ${typography.caption} text-text-body`}
        >
          <span className="font-medium">Most influential:</span>{' '}
          {summary.topInfluentialFactor.label}
        </button>
      )}

      <p className={`${typography.caption} text-text-muted italic`}>
        Adjusting these will most change your results.
      </p>
    </div>
  )
}
