/**
 * contestedVerdict — WHICH verdicts a contested connection can honestly offer.
 *
 * THE GAP THIS CLOSES. CEE tells the user, in its own words, that two drafting
 * passes disagreed about a link and that the disagreement "hasn't been settled"
 * — and until this module there was no way for the user to settle it. Measured
 * at UI staging `3b7e5d4c` / CEE staging `1d303b29`, with a contrast control:
 *
 *   · `buildEdgeAdjudicationEvent` (`canvas/conversation/edgeAdjudication.ts`)
 *     builds the wire event and had ZERO product callers. Its only non-test
 *     references were the transport adapter that RECEIVES it
 *     (`v5/buildPayload.ts:441` `adaptEdgeAdjudication`) and a docblock mention
 *     in a sibling module.
 *   · CONTRAST, same family, same sweep: `edgeStrengthEdit` reads TEN non-test
 *     consumer files including live surfaces (`ModelTabV2Panel`,
 *     `InspectorRouter`, `EdgePanel`, `ConnRow`). The probe is not blind — the
 *     target is genuinely unwired.
 *   · `edge_adjudication` is a member of `WIRE_SYSTEM_EVENT_TYPES`
 *     (`conversation/types.ts:985`), so `serializeSystemEvent` passes it rather
 *     than dropping it, and CEE classifies it `'fact_and_commit'`
 *     (`system-events/dispatch.ts:327`) and persists it with
 *     `provenance: 'user_set'` (`:477`).
 *   · The one surface that ever adjudicated — `ModelTabBody.handleResolveContested`
 *     → `RelationshipsSection` → `ContestedEdgeCard` — sits inside
 *     `{LEGACY_DETAILED_EDITOR_MOUNTED && (…)}` with that constant hardcoded
 *     `false`, so esbuild folds the whole stack away.
 *
 * So both ends of the seam were complete and nothing connected them. This is
 * CLAUDE.md chronic failure #1 in its purest form, and the consequence was
 * user-visible: `judgement-signals.ts` derives `contestedUnadjudicated` as
 * "contested edges with NO `edge_adjudication` fact for their (from,to)", so
 * with no emitter the set could never shrink and the product re-raised the same
 * disagreement forever, whatever the user did about it.
 *
 * ── WHY THIS IS A JUDGEMENT AND NOT A VALUE EDIT (trap 21) ───────────────────
 * "Which of these two readings do I trust?" and "what should this number be?"
 * are DIFFERENT QUESTIONS and this estate has a separate, already-live verb for
 * the second (`edge_strength_edit`, classified `'mutating'`, reachable from the
 * inspector). Folding them together here would either launder CEE's number as
 * the human's or advertise a value change this event cannot make —
 * `edge_adjudication` is `fact_and_commit`, which persists a typed turn fact and
 * writes NO graph. So NOTHING here writes an effect-strength value, and the copy
 * claims only what the fact does: the verdict is recorded as the user's.
 *
 * ── NO NUMBERS REACH THE SCREEN ─────────────────────────────────────────────
 * `computeContestedRows`'s standing rule ("NUMBERS ARE DELIBERATELY ABSENT …
 * effect-strength values stay gated on this panel until the value-scale work
 * lands") is in force. `pass1Mean`/`pass2Mean` are WIRE-AND-GATING ONLY: they
 * decide which verdicts are offerable and they ride in the fact's
 * `resolved_strength_mean`. They are never rendered, and
 * `contestedVerdict.spec.ts` pins that this module exposes no display string
 * built from them.
 *
 * ── FAIL-CLOSED ─────────────────────────────────────────────────────────────
 * A pass whose mean is absent or non-finite cannot be endorsed: the fact would
 * carry no self-contained value for a verdict whose whole content is "I trust
 * THIS reading". That verdict is simply not offered. `dismissed` is always
 * offerable because it asserts no value by contract.
 */

import type { UserAction } from '../../../domain/validation'

/** The verdicts this surface can offer. `overridden` needs a number input and is not here. */
export type ContestedVerdict = Extract<
  UserAction,
  'accepted_pass1' | 'accepted_pass2' | 'dismissed'
>

export interface ContestedVerdictOption {
  verdict: ContestedVerdict
  /**
   * The signed strength mean this verdict commits, or `null` when it asserts
   * none. Contract-informative for the two accepts (so the persisted fact is
   * self-contained); ignored-by-contract for `dismissed`.
   * ⚠ WIRE ONLY — never rendered.
   */
  resolvedMean: number | null
}

/** A finite number, or null. The one numeric predicate this module applies. */
function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * The verdicts offerable for one contested connection, in display order.
 *
 * Order is deliberate and is the order the two readings arrived in: the original
 * first, the review second, "not settled" last. An always-present escape hatch
 * placed last is the panel's existing idiom and keeps the destructive-looking
 * choice out of the primary position.
 */
export function contestedVerdictOptions(row: {
  pass1Mean: number | null
  pass2Mean: number | null
}): ContestedVerdictOption[] {
  const options: ContestedVerdictOption[] = []
  const pass1 = finiteOrNull(row.pass1Mean)
  const pass2 = finiteOrNull(row.pass2Mean)
  if (pass1 !== null) options.push({ verdict: 'accepted_pass1', resolvedMean: pass1 })
  if (pass2 !== null) options.push({ verdict: 'accepted_pass2', resolvedMean: pass2 })
  options.push({ verdict: 'dismissed', resolvedMean: null })
  return options
}
