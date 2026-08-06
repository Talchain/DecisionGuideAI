/**
 * isReviewedByUser — canonical "user has confirmed this factor" predicate.
 *
 * Extracted from usePreAnalysisData.ts so multiple counters (the
 * `reviewedFactorsCount` derivation in the hook and the
 * `buildPriorityProgress` helper used by `T1ContributionRow`) share a
 * single source of truth. Drift between counters is the trust-leak the
 * pre-analysis-power-v1 brief is fixing — duplicating this predicate
 * inline would reintroduce the same risk.
 *
 * `REVIEWED_SOURCES` is the union of every observed_state.source value
 * the broader app currently writes or recognises as user-owned. This
 * predicate was originally narrower (three values) but that conflicted
 * with neighbouring predicates and produced false negatives on the new
 * primary progress indicator. Sources included:
 *
 * - `user_confirmed`   — Pre-analysis "Confirm" handler in `PreAnalysisPanel`
 *                        and the OutputsDock "Set as Confirmed" Model-tab action.
 * - `user_assumption`  — Reserved for "mark as assumption" action; no UI
 *                        writes it yet but the predicate recognises it for
 *                        forward-compat parity with `buildContributionBreakdown`.
 * - `user_override`    — Inline value-edit handlers in `PreAnalysisPanel`
 *                        and OutputsDock's Model-tab "Edit Value" path.
 * - `user`             — Model-tab `FactorsSection` factor-value edits.
 *                        The "verified" bucket in `buildContributionBreakdown`
 *                        already accepts this value; the priority counter
 *                        must match or genuinely user-edited factors regress
 *                        to "unconfirmed".
 * - `user_edited`      — Recognised by the OutputsDock transition-bridge
 *                        as user-owned. No write site exists today but the
 *                        value is part of the recognised set and leaving it
 *                        out would mean any future writer creates a silent
 *                        false negative here.
 *
 * Resolution is field-level (not object-level): a node that carries
 * `observed_state` without a `source` field must NOT short-circuit the
 * fallback chain — the camelCase `observedState.source` and top-level
 * `data.source` still need a chance to resolve.
 *
 * Two surfaces are exported:
 * - `isReviewedSource(source)` — string-level membership check, useful
 *   when a caller has already resolved the source value.
 * - `isReviewedByUser(node)`   — node-level convenience that resolves
 *   the source via the field-level fallback chain and delegates to
 *   `isReviewedSource`. Use this when you only have a node in hand.
 */

import type { Edge, Node } from '@xyflow/react'

/**
 * The ordered list, exported so consumers can ITERATE it rather than re-type
 * it. ROADMAP 2.638 S2: `valueProvenance`'s completeness guard asserts every
 * member of this list carries a user-owned provenance class — a derived union
 * assertion, so a source added here can never silently lose its label.
 */
export const REVIEWED_SOURCES_LIST: readonly string[] = Object.freeze([
  'user_confirmed',
  'user_assumption',
  'user_override',
  'user',
  'user_edited',
])

const REVIEWED_SOURCES = new Set<string>(REVIEWED_SOURCES_LIST)

/**
 * String-level "is this source value user-owned?" check. Single source
 * of truth for the REVIEWED_SOURCES contract.
 */
export function isReviewedSource(source: string | undefined | null): boolean {
  return source != null && REVIEWED_SOURCES.has(source)
}

/**
 * The `observed_state.source` value this predicate WOULD consult, resolved
 * through the field-level fallback chain below.
 *
 * Exported for ROADMAP 2.638 S2 so the provenance pill classifies the SAME
 * string the badge was painted from. Re-implementing the chain at the render
 * site is how a pill ends up naming an act the predicate never saw — the
 * hand-maintained-mirror class (trap 12), one layer down from the label maps.
 * Returns null when no source resolves at any rung.
 */
export function resolveReviewSource(node: Node): string | null {
  const data = node.data as {
    observed_state?: { source?: string }
    observedState?: { source?: string }
    source?: string
  }
  return (
    data?.observed_state?.source ?? data?.observedState?.source ?? data?.source ?? null
  )
}

export function isReviewedByUser(node: Node): boolean {
  const data = node.data as {
    observed_state?: { source?: string }
    observedState?: { source?: string }
    source?: string
    provenance?: string
    userConfirmationWithdrawn?: boolean
  }

  // ROADMAP 2.638 S2 — the WITHDRAWAL rung, and it comes FIRST.
  //
  // The user un-confirmed this value. That is a claim only the client holds,
  // and it has to outrank every stamp below: CEE writes
  // `observed_state.source = 'user_override'` on every applied
  // `set_factor_value` (canonicalise-value-ops.ts:280) including the
  // confirm-as-is being withdrawn, so on the next boot merge the server's own
  // stamp would otherwise resurrect a claim the user explicitly retracted —
  // silently, and in the OVER-claim direction this file exists to prevent.
  // See `withdrawUserConfirmation` in `canvas/utils/hydrateProvenance.ts`.
  if (data?.userConfirmationWithdrawn === true) return false
  // Field-level fallback chain: snake_case → camelCase → top-level. An
  // empty `observed_state: {}` at the snake-case key no longer hides a
  // valid camelCase or top-level source.
  const source =
    data?.observed_state?.source ?? data?.observedState?.source ?? data?.source
  if (isReviewedSource(source)) return true

  // Final rung — the WIRE-CARRIED claim (L66, final-walk defect 0, P1).
  //
  // ⚠ CORRECTED 6 Aug 2026 (2.638 S2, read at CEE staging `d5b64246`): the
  // premise below — "set_factor_value never writes the field" — was true when
  // written and is now FALSE. 2.396(b) SHIPPED: the handler merges
  // `source: USER_EDIT_SOURCE` (= the single literal `'user_override'`,
  // canonicalise-value-ops.ts:280) into the persisted observed_state. What the
  // server still cannot carry is WHICH ACT it was — confirm and edit collapse
  // into that one literal — so the rung below remains necessary and the
  // client-vs-server precedence above remains right; only the reason changed.
  //
  // The `source` stamps above are CLIENT-side: CEE's `ObservedStateV3` types
  // `observed_state.source` as z.enum(['brief_extraction','cee_inference']) —
  // no user-owned member exists in the CONTRACT. So after a reload that hydrates from the server graph,
  // every source stamp reads as the producer's and the badge lied in the
  // under-claim direction: a value the USER set (witnessed: runE
  // fac_pricing_level, 0.7 byte-identical across reload) regressed to
  // "Olumi estimate / check first", re-prompting a check already made. The
  // 3 Aug rewalk filed the same inversion as N1.
  //
  // What the server graph DOES carry is node-level `provenance: 'user_set'`,
  // written by CEE when it APPLIES the user's edit — a receipt-backed claim,
  // exactly the evidence class the receipt-gated stamp demands in-session.
  // Only 'user_set' counts: 'from_brief' is an AI extraction of the user's
  // text (may err — same reason brief_extraction is not a reviewed source)
  // and 'ai_inferred' is the producer's own guess. The UI never writes
  // `data.provenance`; it arrives from the wire, so it cannot be forged by a
  // local path that skipped the receipt.
  return data?.provenance === 'user_set'
}

/**
 * isReviewedEdge — edge-level "user has judged this relationship" predicate.
 *
 * Returns true when the edge's `data.userReviewedStrength === true`. This
 * marker is set by the pre-analysis Weak / Moderate / Strong quick-select
 * (`handleUpdateEdgeStrength` in `PreAnalysisPanel.tsx`). The field is
 * UI-only — preserved through the EdgeData schema's `passthrough()`
 * parser, not forwarded to PLoT/CEE wire formats.
 *
 * Symmetric counterpart to `isReviewedByUser` for the
 * `buildPriorityProgress` counter — so an edge in the top-3 can now
 * count toward `confirmed` once the user picks a strength, instead of
 * being permanently denominator-only.
 */
export function isReviewedEdge(edge: Edge): boolean {
  const data = edge.data as { userReviewedStrength?: boolean } | undefined
  return data?.userReviewedStrength === true
}
