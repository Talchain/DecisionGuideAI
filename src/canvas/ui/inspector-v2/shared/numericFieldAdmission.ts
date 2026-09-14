/**
 * ⭐⭐ ONE OWNER FOR "MAY THIS TYPED NUMBER BE COMMITTED, AND IF NOT, WHY".
 *
 * ⚠ THIS IS AN EXTRACTION, NOT A NEW RULE. Every line below was
 * `AdvancedField`'s `validate` (`shared/AdvancedField.tsx:82-89` at
 * `3b2df4ce`), including the exact messages. It moves here so the inspector's
 * OTHER numeric editor can ask the same question instead of asking a weaker one
 * — which is what it was doing.
 *
 * ── WHY IT HAD TO MOVE ────────────────────────────────────────────────────
 *
 * The two shared numeric editors sat in this directory answering the same
 * question differently:
 *
 *   · `AdvancedField` (behind "Advanced") validated on blur — finite, then
 *     `min`, then `max` — and rendered the reason.
 *   · `InlineNumberEditor` (the PRIMARY control card, the field an ordinary
 *     person reaches) accepted `min`/`max` props, PAINTED THEM ON THE DOM
 *     ELEMENT, and ignored them on commit. Its whole guard was
 *     `if (isNaN(parsed)) return`.
 *
 * HTML `min`/`max` on a number input constrain the STEPPER and set `:invalid`.
 * They do not stop a typed value, and nothing called `checkValidity()`. So
 * `RiskPanel`'s `min={0} max={100}` likelihood field
 * (`panels/RiskPanel.tsx:139-140`) accepted a typed `150`, and
 * `setProbability` then silently CLAMPED it to `1`
 * (`useInspectorMutations.ts:459-460`): the model held 100% while the person
 * believed they had said 150%.
 *
 * ⭐ THE BOUND IS THE CALLER'S DECLARATION, NEVER THIS MODULE'S OPINION. This
 * function invents no range for any field. It enforces what the call site
 * already states, and where a call site states nothing it admits everything —
 * `FactorObservablePanel` passes no bounds because no bound is known for an
 * arbitrary observed magnitude (`panels/FactorObservablePanel.tsx:317-326`),
 * and inventing one there would refuse legal values. A false positive that
 * DROPS a legal number and one that ADMITS an illegal one are opposite harms;
 * this module closes only the second, and only where someone with the
 * knowledge has written the bound down.
 *
 * ⛔⛔ WHAT THIS MODULE DELIBERATELY DOES NOT DO, AND WHY — READ BEFORE
 * WIDENING IT.
 *
 * `@talchain/schemas` 0.54.0 exports `DECLARED_SCALE_BOUNDS`
 * (`dist/graph.js:79-83`), a frozen table mapping a factor's own
 * `observed_state.declared_scale` (`dist/graph.js:157`) to an admissible
 * range, and its header names the UI as a designated consumer: *"a min/max
 * input hint derived from `DECLARED_SCALE_BOUNDS` below, never re-implemented
 * client-side"*. Deriving this module's bound from that table is the obvious
 * next move and it is NOT taken here, because the field is not produced.
 *
 * Measured at CEE `staging` `79613876` (9 Sep 2026), fresh clone, contrast
 * controls in the same sweep (`raw_value` 3354 hits, `observed_state` 2394,
 * `elicited_from` 79 — so the zeros are real):
 *   · `observed_state.declared_scale` is assigned NOWHERE in CEE. The single
 *     write in the repo is NODE-level (`node.declared_scale`, via an `as any`
 *     cast) at `src/cee/unified-pipeline/stages/repair/unreachable-factors.ts:582`;
 *   · that write is gated on a factor being transitively UNREACHABLE from
 *     options, so a normal freshly-drafted factor never enters the block;
 *   · and the V3 transform reads the node-level property for display
 *     formatting (`src/cee/transforms/schema-v3.ts:522-528`) without writing
 *     it onto the emitted node, so it does not survive the rebuild;
 *   · no prompt or grammar asks the model for it — `SCALE_DISCIPLINE`
 *     (`Prompts/canonical/draft_graph.txt:400-419`) teaches the CONCEPT and
 *     never names the field;
 *   · `DECLARED_SCALE_BOUNDS` has zero production importers in CEE.
 *
 * A guard keyed on that field therefore CANNOT FIRE on any graph a user has
 * today. Shipping it would be a validator nobody can reach wearing a
 * contract's authority — this estate's most-repeated failure. The route is
 * real and worth taking; it needs the PRODUCER first. Recorded here so the
 * next reader finds the derivation rather than re-running it.
 */

/**
 * The bounds a call site declares for its own field. Both ends optional and
 * INDEPENDENT: a field may have a floor and no ceiling.
 *
 * ⚠ INCLUSIVE, both ends — `0` and `100` are admissible under `{min: 0,
 * max: 100}`. A likelihood of exactly 0% or exactly 100% is a thing people
 * mean, and an exclusive bound would make it unsayable while passing every
 * out-of-range test.
 */
export interface NumericFieldBounds {
  min?: number
  max?: number
}

export type NumericFieldAdmission =
  | { ok: true; value: number }
  /**
   * `reason` is user-facing copy, and it is the SAME STRING the advanced field
   * has always shown for the same condition. It is not an error code: a caller
   * renders it verbatim.
   */
  | { ok: false; reason: string }

/**
 * The refusal messages, named so a spec can bind to the STRING rather than
 * re-typing it, and so the two editors cannot drift into saying different
 * things about one condition.
 *
 * ⚠ `NOT_FINITE`'s wording is load-bearing and was chosen against a specific
 * alternative. `Infinity` IS a number, so "Must be a number" would refuse the
 * value while denying the reason — see the header of
 * `__tests__/AdvancedField.finiteGuard.spec.tsx`, which records the execution
 * that settled it.
 */
export const NUMERIC_FIELD_REFUSAL = {
  NOT_FINITE: 'Must be a finite number',
  min: (min: number) => `Min: ${min}`,
  max: (max: number) => `Max: ${max}`,
} as const

/**
 * Parse and admit a typed numeric entry.
 *
 * ⚠ ORDER IS PART OF THE CONTRACT: finiteness first, then `min`, then `max` —
 * `AdvancedField`'s order, preserved, because a `NaN` compared against a bound
 * is `false` in BOTH directions and would slip through a range-first check
 * reporting nothing wrong.
 *
 * ⚠ `parseFloat` PREFIX-PARSES (`'11abc'` → `11`). That is inherited
 * deliberately and unchanged: it is a separate question about every numeric
 * field in the inspector, it is already rowed, and changing it inside an
 * extraction would hide a behaviour change in a move.
 */
export function admitNumericField(
  raw: string,
  bounds: NumericFieldBounds = {},
): NumericFieldAdmission {
  const value = parseFloat(raw)
  if (!Number.isFinite(value)) return { ok: false, reason: NUMERIC_FIELD_REFUSAL.NOT_FINITE }
  const { min, max } = bounds
  if (min != null && value < min) return { ok: false, reason: NUMERIC_FIELD_REFUSAL.min(min) }
  if (max != null && value > max) return { ok: false, reason: NUMERIC_FIELD_REFUSAL.max(max) }
  return { ok: true, value }
}
