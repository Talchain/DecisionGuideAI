/**
 * computeContestedRows — the v3 panel's view model for contested connections (ROADMAP 2.376).
 *
 * ⚠ THIS MODULE OWNS NO ELIGIBILITY LOGIC, BY DESIGN. Which connections are surfaced is
 * `selectSurfacedContestedEdges` (#571, orchestrator ruling of 4 Aug 2026) and nothing here
 * may re-decide it. That module is the SINGLE source of truth for the `surfaced`/pending
 * predicate and the one-per-target-node cap, and it carries the supersession note for the day
 * CEE starts emitting `surfaced`. Re-spelling its predicate here — even "just the obvious
 * half" — is exactly the trap-12 hand-maintained mirror it was created to abolish: the legacy
 * panel had that predicate written two different ways and one of them made the panel dark.
 * This module only turns its output into words.
 *
 * ORDER. `selectSurfacedContestedEdges` deliberately returns survivors in INPUT order and
 * tells the caller to apply its own display sort, so this is where the order is chosen. We
 * sort with the selector's own exported `compareContestedCapPriority`, which is TOTAL (its
 * third key is the edge id) and therefore renders identically across graph rebuilds.
 *
 * ⚠ That is a REUSE for ordering, NOT a unification of the two comparators. The Model tab
 * keeps its own private `compareContestedPriority`, which leads on `evoi_impact` — a
 * post-analysis field that is null on every edge on this pre-run surface, so its leading key
 * is inert here anyway and it is not a total order. Do not replace either with the other.
 *
 * COPY. The per-reason and per-basis sentences come from `model-tab/strengthBands.ts` — the
 * same functions the Model tab's contested cards render — so the two surfaces can never drift
 * into describing the same disagreement differently. `pass2.reasoning` is CEE-authored text
 * and goes through the v3 runtime glossary guard like every other CEE string in this panel;
 * unsafe wording with no safe substitution is dropped rather than shown.
 *
 * NUMBERS ARE DELIBERATELY ABSENT. No `max_divergence`, no `strength_mean`, no probability.
 * Effect-strength values stay gated on this panel until the value-scale work lands
 * (`YourDecisionSection`'s standing rule); a raw model-scale number here would be the same
 * defect class in a new place.
 */

import type { Edge, Node } from '@xyflow/react'
import {
  selectSurfacedContestedEdges,
  compareContestedCapPriority,
} from '../../pre-analysis/utils/selectSurfacedContestedEdges'
import { getBasisLabel, getContestedReasonLabel } from '../../model-tab/strengthBands'
import { guardCeeTextOrNull } from '../signals/ceeTextGuard'
import { CONTESTED_COPY } from '../constants'

export interface ContestedRowModel {
  /** ReactFlow edge id. The identity every pin binds to. */
  edgeId: string
  /** Verbatim node labels. v3 never rewrites shared graph labels (labelSafetyAndMutation). */
  sourceLabel: string
  targetLabel: string
  /** Plain-language reasons the two looks disagreed. Never a reason enum value. */
  reasons: string[]
  /** What the second look based its estimate on, in plain language. */
  basis: string
  /** The second look's own sentence, glossary-guarded. Null when it cannot be made safe. */
  reasoning: string | null
}

export function computeContestedRows(
  nodes: ReadonlyArray<Node>,
  edges: ReadonlyArray<Edge>,
): ContestedRowModel[] {
  const surfaced = selectSurfacedContestedEdges(edges as Edge[])
  if (surfaced.length === 0) return []

  const labelById = new Map<string, string>()
  for (const node of nodes) {
    const label = (node.data as Record<string, unknown> | undefined)?.label
    labelById.set(node.id, typeof label === 'string' && label !== '' ? label : node.id)
  }

  return [...surfaced].sort(compareContestedCapPriority).map(({ edge, validation }) => {
    const reasons = validation.contested_reasons.map(getContestedReasonLabel)
    const rawReasoning = validation.pass2.reasoning?.trim()
    return {
      edgeId: edge.id,
      sourceLabel: labelById.get(edge.source) ?? edge.source,
      targetLabel: labelById.get(edge.target) ?? edge.target,
      reasons: reasons.length > 0 ? reasons : [CONTESTED_COPY.reasonFallback],
      basis: getBasisLabel(validation.pass2.basis),
      reasoning: rawReasoning ? guardCeeTextOrNull(rawReasoning) : null,
    }
  })
}
