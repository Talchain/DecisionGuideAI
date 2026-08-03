/**
 * CONTESTED-EDGE SELECTION FOR THE PRE-ANALYSIS PANEL — eligibility + one-per-target cap.
 *
 * ⚠⚠ SUPERSESSION NOTE — THE CAP HERE IS A STAND-IN FOR A CEE FIELD THAT WAS SPECCED AND
 * NEVER BUILT. DELETE IT WHEN CEE SHIPS `surfaced`. ⚠⚠
 *
 * `ValidationMetadata.surfaced` is documented as "whether CEE selected this contested edge
 * for user review", under the note "CEE applies one-per-target-node cap". CEE's
 * `EdgeValidationMetadata` (olumi-assistants-service, `src/cee/validation-pipeline/types.ts`)
 * has **no `surfaced` key** — the cap was designed and never implemented. The UI nevertheless
 * declared the field REQUIRED and gated on it, so once CEE's validation pipeline went ON in
 * code (#808), every contested edge on the wire arrived with `surfaced` absent and was
 * dropped: the pre-analysis panel was dark over live metadata.
 *
 * Orchestrator ruling (4 Aug 2026, option (c)): deliver the differentiator now, keeping the
 * DESIGNED cap semantics, client-side.
 *   · `surfaced` becomes OPTIONAL on the UI type, and ABSENT means ELIGIBLE.
 *   · An explicit `surfaced === false` is still honoured — CEE can suppress an edge the day
 *     it starts emitting the field, without a UI change.
 *   · The cap is applied here, with a deterministic tie-break.
 *
 * WHEN CEE SHIPS `surfaced`: honour it and DROP the client cap — i.e. delete
 * `capOnePerTargetNode` and its comparator, and KEEP `isEligibleContested` (which is the
 * part that honours the field). Do not delete the whole module.
 *
 * ⚠ THE MODEL TAB DELIBERATELY HAS NO CAP. `RelationshipsSection.tsx::compareContestedPriority`
 * orders the full contested list there and every pending contested edge stays fully
 * actionable. That comparator is a DISPLAY ordering (it leads on `evoi_impact` and has no
 * total-order key); this one is a WINNER SELECTION and must be total. They are deliberately
 * separate and must not be unified — unifying would either put a cap on the Model tab or
 * make this selection non-deterministic.
 */

import type { Edge } from '@xyflow/react'
import type { ValidationMetadata } from '../../../domain/validation'

export interface SurfacedContestedEdge {
  edge: Edge
  validation: ValidationMetadata
}

/**
 * Is this edge a contested edge the user should be asked to adjudicate?
 *
 * `surfaced` is honoured when CEE sends it and treated as ELIGIBLE when absent. Note the
 * explicit `!== false` rather than a truthiness test: `!validation.surfaced` was the
 * original gate, and it is exactly what made the panel dark.
 */
export function isEligibleContested(validation: ValidationMetadata | undefined): boolean {
  if (!validation) return false
  if (validation.status !== 'contested') return false
  if (validation.surfaced === false) return false
  if (validation.user_action !== 'pending') return false
  return true
}

/**
 * Winner-selection order for the cap. TOTAL by construction:
 *   1. highest `max_divergence`   — the most disagreement is the most worth asking about
 *   2. lowest `distance_to_goal`  — nearer the goal matters more
 *   3. lowest edge id             — the TOTALITY key
 *
 * Key 3 is not decoration. Without it the winner of a full tie is whichever edge the input
 * array happened to present first, so the panel reorders between renders whenever the graph
 * is rebuilt in a different order. Returns <0 when `a` outranks `b`.
 */
export function compareContestedCapPriority(a: SurfacedContestedEdge, b: SurfacedContestedEdge): number {
  if (a.validation.max_divergence !== b.validation.max_divergence) {
    return b.validation.max_divergence - a.validation.max_divergence
  }
  if (a.validation.distance_to_goal !== b.validation.distance_to_goal) {
    return a.validation.distance_to_goal - b.validation.distance_to_goal
  }
  if (a.edge.id === b.edge.id) return 0
  return a.edge.id < b.edge.id ? -1 : 1
}

/**
 * Eligible contested edges, capped at ONE PER TARGET NODE.
 *
 * Survivors are returned in INPUT ORDER, not comparator order: the caller applies its own
 * display sort (the pre-analysis verify sort leads on `evoi_impact`), and imposing an order
 * here would silently compete with it.
 *
 * ⚠ SINGLE SOURCE OF TRUTH. Both pre-analysis consumers — the `verify` improvement items and
 * the `contestedEdges` calibration cards — call THIS function. They were two hand-written
 * filters with the same predicate spelled two different ways
 * (`if (!validation.surfaced) continue` and `v?.surfaced && ...`), which is the trap-12
 * hand-maintained mirror. Do not re-inline either one.
 */
export function selectSurfacedContestedEdges(edges: Edge[]): SurfacedContestedEdge[] {
  const eligible: SurfacedContestedEdge[] = []
  for (const edge of edges) {
    const validation = (edge.data as { validation?: ValidationMetadata } | undefined)?.validation
    if (!isEligibleContested(validation)) continue
    eligible.push({ edge, validation: validation as ValidationMetadata })
  }

  const winnerByTarget = new Map<string, SurfacedContestedEdge>()
  for (const candidate of eligible) {
    const incumbent = winnerByTarget.get(candidate.edge.target)
    if (!incumbent || compareContestedCapPriority(candidate, incumbent) < 0) {
      winnerByTarget.set(candidate.edge.target, candidate)
    }
  }

  return eligible.filter(c => winnerByTarget.get(c.edge.target) === c)
}
