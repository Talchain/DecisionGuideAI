/**
 * Shared fragile edge matching utility.
 *
 * Used by StyledEdge (per-edge memo), useMenuItems (context menu), and useLensFilter.
 * Centralises the dual-format matching logic (edge_id vs from_id/to_id) and the
 * 0.3 switch_probability threshold. See UI-SEM-013.
 */

export interface FragileEdgeCandidate {
  edge_id?: string
  edgeId?: string
  from_id?: string
  fromId?: string
  source?: string
  to_id?: string
  toId?: string
  target?: string
  switch_probability?: number
  switchProbability?: number
  marginal_switch_probability?: number
  marginalSwitchProbability?: number
}

/**
 * Check whether a single edge matches any fragile edge entry with switch_probability > 0.3.
 * Matches by edge_id first, then falls back to from_id/to_id (source/target) pair.
 */
export function isEdgeFragile(
  edgeId: string,
  edgeSource: string,
  edgeTarget: string,
  fragileEdges: FragileEdgeCandidate[],
): boolean {
  return fragileEdges.some(fe => {
    const switchProb = fe.switch_probability ?? fe.switchProbability ??
                       fe.marginal_switch_probability ?? fe.marginalSwitchProbability
    if (typeof switchProb !== 'number' || switchProb <= 0.3) return false

    // Try matching by edge_id first
    const feEdgeId = fe.edge_id ?? fe.edgeId
    if (feEdgeId === edgeId) return true

    // Fallback: match by source/target pair
    const from = fe.from_id ?? fe.fromId ?? fe.source
    const to = fe.to_id ?? fe.toId ?? fe.target
    return from === edgeSource && to === edgeTarget
  })
}
