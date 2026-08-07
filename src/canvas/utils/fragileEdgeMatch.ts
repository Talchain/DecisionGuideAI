/**
 * Shared fragile edge matching utility.
 *
 * Used by StyledEdge (per-edge memo), useMenuItems (context menu), and useLensFilter.
 * Centralises the dual-format matching logic (edge_id vs from_id/to_id) and the
 * canonical switch_probability threshold from THRESHOLDS.FRAGILE_EDGE_FILTER. See UI-SEM-013.
 */

import { THRESHOLDS } from '../../lib/mappers/constants'

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
    if (typeof switchProb !== 'number' || switchProb <= THRESHOLDS.FRAGILE_EDGE_FILTER) return false

    // Try matching by edge_id first
    const feEdgeId = fe.edge_id ?? fe.edgeId
    if (feEdgeId === edgeId) return true

    // Fallback: match by source/target pair
    const from = fe.from_id ?? fe.fromId ?? fe.source
    const to = fe.to_id ?? fe.toId ?? fe.target
    return from === edgeSource && to === edgeTarget
  })
}

/** The switch probability an entry reports (above the visibility floor), else null. */
function entrySwitchProb(fe: FragileEdgeCandidate): number | null {
  const p = fe.switch_probability ?? fe.switchProbability ??
            fe.marginal_switch_probability ?? fe.marginalSwitchProbability
  return typeof p === 'number' && p > THRESHOLDS.FRAGILE_EDGE_FILTER ? p : null
}

/**
 * Whether this edge is THE single top fragile relationship — the one with the
 * highest switch probability above the visibility floor. Used to surface one
 * fragility badge in the default (standard) view (E4 graph-visuals) without
 * cluttering the map with every fragile edge. On a tie, the first entry wins
 * (deterministic — a >, not >=, comparison). Returns false when nothing is
 * fragile above the floor.
 */
export function isTopFragileEdge(
  edgeId: string,
  edgeSource: string,
  edgeTarget: string,
  fragileEdges: FragileEdgeCandidate[],
): boolean {
  let top: FragileEdgeCandidate | null = null
  let topProb = -Infinity
  for (const fe of fragileEdges) {
    const p = entrySwitchProb(fe)
    if (p != null && p > topProb) { topProb = p; top = fe }
  }
  if (!top) return false
  return isEdgeFragile(edgeId, edgeSource, edgeTarget, [top])
}

/**
 * Return the MEASURED switch_probability for a matching fragile edge, or null.
 * Used to display the numeric sensitivity detail (Task 7): "NN% flip risk" in
 * EdgePanel (context + tech disclosure) and "Sensitive · NN%" on the
 * StyledEdge badge/hover popover — every caller renders this value.
 *
 * Presence branch (schemas 0.30.0; same class as #543): `switch_probability`
 * ABSENT means NOT COMPUTED — never zero — and `marginal_switch_probability`
 * is a DIFFERENT Monte Carlo (P(flip | only this edge varies)), never a
 * fallback for a rendered number. The coalesce here previously fed a
 * marginal-only value to every one of those surfaces under flip-risk wording;
 * each already presence-branches on `!== null` with honest-absence copy, so
 * returning null degrades every render honestly. A measured value — including
 * a measured 0, which the display floor then filters as a MEASUREMENT — is
 * never displaced by, or resurrected from, the marginal quantity. The
 * MATCHING tier (isEdgeFragile / isTopFragileEdge above) deliberately keeps
 * marginal eligibility — visibility, not a displayed number.
 */
export function getFragileEdgeSwitchProbability(
  edgeId: string,
  edgeSource: string,
  edgeTarget: string,
  fragileEdges: FragileEdgeCandidate[],
): number | null {
  for (const fe of fragileEdges) {
    const measured = fe.switch_probability ?? fe.switchProbability
    if (typeof measured !== 'number' || measured <= THRESHOLDS.FRAGILE_EDGE_FILTER) continue

    const feEdgeId = fe.edge_id ?? fe.edgeId
    if (feEdgeId === edgeId) return measured

    const from = fe.from_id ?? fe.fromId ?? fe.source
    const to = fe.to_id ?? fe.toId ?? fe.target
    if (from === edgeSource && to === edgeTarget) return measured
  }
  return null
}
