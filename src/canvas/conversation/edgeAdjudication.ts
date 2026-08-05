/**
 * buildEdgeAdjudicationEvent — the contested-edge verdict, as a wire event.
 *
 * P4 transport (schemas 0.34.0; lane evidence
 * PHASE0-EVIDENCE-2026-07-28/lane-p4-transport-2026-08-05.md). Before this
 * module, `ModelTabBody.handleResolveContested` settled a CEE multi-pass
 * disagreement with a LOCAL `updateEdge` only — the human's verdict never
 * left the browser. This module decides WHICH fields go into the contract's
 * `edge_adjudication` member; the wire TYPE comes from `@talchain/schemas`
 * via `buildV5Payload` (see `adaptEdgeAdjudication` there). CEE persists the
 * event as a typed turn fact and writes NO graph — carry the judgement;
 * whether it feeds compute is a separate design decision.
 *
 * IDENTITY RULE: the event binds to its edge by from+to NODE ids
 * (`edge.source` / `edge.target`) — the canonical edge key CEE itself uses.
 * The client edge id rides along informatively only.
 *
 * FAIL-CLOSED: any shape the wire's cross-field rules would refuse builds
 * `null` (the caller then simply does not emit — never a production 422):
 *   · `pending` is the unresolved state, not a verdict;
 *   · `overridden` without a finite value asserts nothing actionable;
 *   · `dismissed` never carries a value (a dismissal asserts none).
 */
import type { Edge } from '@xyflow/react'

import type { UserAction } from '../domain/validation'
import type { WireSystemEvent } from './types'

export function buildEdgeAdjudicationEvent(
  edge: Edge,
  action: UserAction,
  /**
   * The SIGNED strength mean this adjudication commits: REQUIRED for
   * `overridden` (the user's own number); optional-informative for
   * `accepted_pass1` / `accepted_pass2` (the accepted pass's mean, so the
   * persisted fact is self-contained); ignored-by-contract for `dismissed`.
   */
  resolvedMean?: number,
): WireSystemEvent | null {
  if (action === 'pending') return null
  const from = edge.source
  const to = edge.target
  if (!from || !to) return null

  const mean =
    typeof resolvedMean === 'number' && Number.isFinite(resolvedMean) ? resolvedMean : undefined

  if (action === 'overridden' && mean === undefined) return null

  return {
    type: 'edge_adjudication',
    payload: {
      from,
      to,
      ...(edge.id ? { edge_id: edge.id } : {}),
      verdict: action,
      ...(action !== 'dismissed' && mean !== undefined
        ? { resolved_strength_mean: mean }
        : {}),
    },
  }
}
