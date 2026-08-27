/**
 * projectAuthoredEntities — ONE projection for every named-entity slice of the
 * panel (options, risks, and any slice added after this one).
 *
 * ⭐ WHY THIS EXISTS, AND WHY IT IS ONE FUNCTION RATHER THAN TWO.
 *
 * Options and risks were built by two ADJACENT `useMemo`s over the same node
 * array in `usePreAnalysisModel`. The risks memo read `provenance` and produced
 * an `Attribution`; the options memo mapped to `{nodeId, label}` and never read
 * it. The panel therefore rendered an option Olumi invented and an option the
 * user named as the same row — while doing the opposite for risks one group
 * below, and while `EstimateRowModel` had carried `attribution` all along.
 *
 * That was measured, not assumed: across 18 drafts on 7 frozen briefs, 12 (67%)
 * contained at least one option the brief never mentions. The PRODUCER is
 * correct and perfectly discriminating — 15/15 invented options carry
 * `provenance: 'ai_inferred'` with no `source_quote`, 36/36 user-stated options
 * carry `provenance: 'from_brief'` WITH one. Only the consumer was silent.
 *
 * The fix is DISCLOSURE, never suppression: those inventions are 10 syntheses,
 * 3 status-quo baselines and 2 novel moves — textbook decision analysis, and
 * real value. Marking them is what keeps the user the author of the set.
 *
 * So the shape of the fix matters as much as the fix. A second attribution
 * expression next to the first would be the same hand-maintained mirror one
 * slice wider. Instead BOTH slices now come out of this function, and
 * `AuthoredEntity` makes `attribution` NON-OPTIONAL.
 *
 * ⚠ BE PRECISE ABOUT WHAT THAT BUYS, because the obvious stronger claim is
 * false and was measured: anything TYPED `AuthoredEntity` cannot omit the
 * field (dropping it is a compile error, +1 diagnostic against a 1923
 * baseline). But a future slice that declines the type — say
 * `assumptions: Array<{nodeId, label}>` — compiles perfectly clean (measured:
 * delta 0). So this is a strong CONVENTION with a type that enforces it once
 * adopted, plus one shared row component, NOT a structural guarantee that a
 * new slice must disclose. Anyone adding a named-entity slice should reach for
 * `AuthoredEntity`; nothing in the compiler will make them.
 *
 * ⚠ ONE DELIBERATE BEHAVIOURAL CONVERGENCE. The two memos this replaces asked
 * `(n.data)?.kind ?? n.type`, which differs from `kindOf` — the predicate
 * `computeGraphFacts` already uses to produce `optionCount` / `riskCount` — on
 * a node whose `data.kind` is present but not a non-empty string (`''`, or a
 * non-string). `null` is NOT in that class: it is nullish, so `??` falls
 * through and both predicates already agree.
 *
 * The two answers reach the user as near-identical sentences on ONE panel:
 * the Options group header renders "N included" from this projection, while
 * the HealthBars tooltip renders "N options included" from
 * `computeGraphFacts.optionCount` (`computeBars.ts`), and the option-breadth
 * signal (`signals/registry.ts`) reads that same count. This function asks
 * `kindOf`, so those numbers cannot disagree — pinned by
 * `__tests__/projectAuthoredEntities.spec.ts`, because reverting the
 * convergence turned nothing red across all 41 specs in this directory.
 */

import type { Node } from '@xyflow/react'
import { kindOf } from './graphFacts'
import type { Attribution } from '../types'

/**
 * A named entity in the model, with WHO PUT IT THERE.
 *
 * `attribution` is required on purpose. It is the whole point of this type:
 * the field is what a new slice cannot forget.
 */
export interface AuthoredEntity {
  nodeId: string
  label: string
  attribution: Attribution
}

/** The kinds this projection serves. Widen it here, never by re-deriving. */
export type AuthoredEntityKind = 'option' | 'risk'

/**
 * The ONE reading of CEE's authorship stamp for a named entity.
 *
 * `ai_inferred` is Olumi's own; everything else — `from_brief`, a user-created
 * node with no stamp at all — is the person's, and renders unmarked. The
 * asymmetry is the design: we mark what Olumi authored, we do not badge the
 * user's own words back at them.
 */
export function attributionOfNode(data: unknown): Attribution {
  const provenance = (data as Record<string, unknown> | undefined)?.provenance
  return provenance === 'ai_inferred'
    ? { kind: 'olumi' }
    : { kind: 'person', displayName: 'You' }
}

export function projectAuthoredEntities(
  nodes: ReadonlyArray<Node>,
  kind: AuthoredEntityKind,
): AuthoredEntity[] {
  const out: AuthoredEntity[] = []
  for (const node of nodes) {
    if (kindOf(node) !== kind) continue
    const data = node.data as Record<string, unknown> | undefined
    out.push({
      nodeId: node.id,
      label: typeof data?.label === 'string' ? data.label : node.id,
      attribution: attributionOfNode(data),
    })
  }
  return out
}
