/**
 * usePreAnalysisInbound — inbound edge strengths for the PRE-analysis node
 * popovers on `OutcomeNode` / `RiskNode`.
 *
 * WHY THIS EXISTS (two reasons, both of them defect classes we keep paying for)
 * ---------------------------------------------------------------------------
 * 1. HONESTY. The two nodes each computed this list with `computeSignedMean`
 *    and NO provenance gate at all, then spoke the result as prose —
 *    *"Strongest: Price at 30%."* — in the one phase where, by definition,
 *    nothing has been estimated. `USER_EDGE_DEFAULTS.weight` is `0.3`, so that
 *    sentence was a hardcoded constant delivered as a finding about the user's
 *    decision. Prose is a STRONGER claim than a bare number: a percentage in a
 *    pill can read as a placeholder, a sentence naming a winner cannot.
 *    Every value here now comes from `resolveEdgeSignedStrengthDisplay`, which
 *    cannot hand back a number without naming its source.
 *
 * 2. CONVERGENCE. `OutcomeNode` and `RiskNode` carried byte-identical copies of
 *    this `useMemo`. Two copies of a display rule is the hand-maintained mirror
 *    in miniature — the gate would have had to be added twice and removed twice
 *    forever. One derivation, two callers.
 *
 * RANKING IS ITSELF A CLAIM
 * -------------------------
 * "Strongest" is a comparative assertion, so it may only be made among values
 * that were actually set. Unset rows sort LAST (`-1`, the same rule
 * `EdgePills` and `useNodeConnections` already use) and never win the
 * comparison; when nothing is set, `topSetItem` is `null` and the caller must
 * drop the sentence rather than crown a default.
 */
import { useMemo } from 'react'
import { useCanvasStore } from '../store'
import { resolveEdgeSignedStrengthDisplay } from '../domain/edgeValueProvenance'

export interface PreAnalysisInboundItem {
  /** Stable per-edge key — the source node can repeat across parallel edges. */
  edgeId: string
  nodeLabel: string
  /**
   * Magnitude 0-100, or `null` when nothing set this edge's strength.
   * `null` means "we do not know", NEVER "zero" — render the unset
   * affordance, never the number.
   */
  strengthPct: number | null
}

export interface PreAnalysisInbound {
  /** All inbound edges with a resolvable source node, set values first. */
  items: PreAnalysisInboundItem[]
  /**
   * The highest SET strength, or `null` when no inbound edge has one.
   * Gate the "Strongest: …" sentence on this, not on `items[0]`.
   */
  topSetItem: (PreAnalysisInboundItem & { strengthPct: number }) | null
}

const EMPTY: PreAnalysisInbound = { items: [], topSetItem: null }

export function usePreAnalysisInbound(nodeId: string): PreAnalysisInbound {
  const edges = useCanvasStore(state => state.edges)
  const nodes = useCanvasStore(state => state.nodes)
  const resultsStatus = useCanvasStore(state => state.results.status)
  const isPostAnalysis = resultsStatus === 'complete'

  return useMemo(() => {
    if (isPostAnalysis) return EMPTY

    const items: PreAnalysisInboundItem[] = []
    for (const edge of edges) {
      if (edge.target !== nodeId) continue
      const sourceNode = nodes.find(n => n.id === edge.source)
      if (!sourceNode) continue
      const label = (sourceNode.data?.label as string) ?? 'Untitled'
      // ⛔ Provenance gate (canvas/domain/edgeValueProvenance.ts). `show: false`
      // covers both "no number here" and "a number nobody set" — neither is
      // speakable, and the union makes forgetting that a type error.
      const display = resolveEdgeSignedStrengthDisplay(edge.data as Record<string, unknown> | undefined)
      items.push({
        edgeId: edge.id,
        nodeLabel: label,
        strengthPct: display.show ? Math.round(Math.abs(display.value) * 100) : null,
      })
    }

    // Known strengths outrank "not set" (-1), matching EdgePills/useNodeConnections.
    items.sort((a, b) => (b.strengthPct ?? -1) - (a.strengthPct ?? -1))

    const first = items[0]
    const topSetItem =
      first && first.strengthPct !== null
        ? (first as PreAnalysisInboundItem & { strengthPct: number })
        : null

    return { items, topSetItem }
  }, [edges, nodes, nodeId, isPostAnalysis])
}
