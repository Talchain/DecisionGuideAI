/**
 * optionCoverage — how much of the model each option actually specifies.
 *
 * ROADMAP 2.1326. Paul's ruling (26 Aug 2026): when one alternative has only
 * 1/3 effects configured and another 2/3, THE USER MUST SEE THAT alongside the
 * comparative result. The comparison is never auto-suppressed; the ranking is
 * stated in provisional language while values are missing.
 *
 * WHAT THIS ANSWERS, AND WHAT IT DOES NOT
 * ---------------------------------------
 * It answers ONE question: for each option, which of the model's factors does
 * it set an effect on? That is arithmetic over `analysis_ready.options[]
 * .interventions`, which the producer publishes and which nothing in this repo
 * read before this module (measured at `f287c012`: `repair_proposal` 0 readers,
 * `unresolved_inputs` 0, against contrast controls `confidence_tier` 7 and
 * `win_probabilities` 6).
 *
 * ⛔ IT ASSERTS NO DIRECTION. It never says which way the result would move if
 * a missing value were supplied — the compute has not evaluated that, and an
 * unset effect is not sampled, so nothing on the wire could support the claim.
 *
 * ⛔ IT ASSERTS NO CAUSE. It reports which cells are empty and never why.
 * Derived at the drafting seam across 117 captures (sibling lane, 26 Aug): an
 * option's intervention set is whatever the model emitted for it, CEE only
 * labels it and never widens it, and there is NO `is_baseline` term in the
 * blocker predicate at all — 101 of 105 runs come out equal. The asymmetry is
 * EMERGENT, NOT DESIGNED. So "the challenger is under-specified because it is
 * the challenger" is exactly as unearned as "it would win if you set these",
 * and this module is the wrong place to explain anything.
 *
 * ⚠ IT IS NOT A CONFIDENCE SIGNAL, AND MUST NOT BE WORDED AS ONE.
 * `uncertaintyCalibration` already renders beside the same sentence and keys on
 * `robustness.level` — a DIFFERENT AXIS. Robustness measures how the result
 * holds up as the values that ARE set are varied; it cannot speak to values
 * that were never set, because an unset effect is never sampled. The two can
 * therefore disagree on one screen — "This result looks fairly confident."
 * beside two empty cells — and THAT DISAGREEMENT IS INFORMATION, NOT A DEFECT:
 * it is precisely the case where the calibration is least earned. Keep the
 * registers apart. Calibration says how confident the compute is in what it
 * explored; coverage says what it explored.
 *
 * ⚠ AND IT IS NOT A VERDICT ON THE RUN. A payload can be `status: "ready"` AND
 * unevenly covered — 5 such runs in a 122-run corpus. Unequal coverage is a
 * fact about COMPLETENESS, never a claim that the analysis should not have run.
 * Wording that implies otherwise would put two Olumi affordances in
 * contradiction on one screen, which is the harm the `may_run` waiver exists to
 * prevent (see `canRunAnalysis.ts`).
 *
 * THE DENOMINATOR IS REQUIRED, NOT DERIVED HERE
 * ---------------------------------------------
 * `modelFactorIds` is a parameter with no default and no fallback. Deriving it
 * from the union of factors the options happen to address would silently HIDE a
 * factor that NO option addresses — in the run this module was written from,
 * "CRM Adoption and Usability" is unset on BOTH options, and a union-based
 * denominator would have made it invisible while reporting a tidier ratio.
 * A denominator that quietly changes with its input is a mirror; this one is
 * supplied by the caller, which must state where it got it.
 */

/** The producer's option, narrowed to what coverage needs. */
export interface CoverageOption {
  readonly id: string
  readonly label: string
  /** `analysis_ready.options[].interventions` — keys are factor ids. */
  readonly interventions?: Readonly<Record<string, unknown>> | null
}

export interface OptionCoverage {
  readonly optionId: string
  readonly label: string
  /** Model factors this option sets an effect on. Ordered as `modelFactorIds`. */
  readonly setFactorIds: readonly string[]
  /** Model factors this option does NOT set an effect on. Ordered as `modelFactorIds`. */
  readonly unsetFactorIds: readonly string[]
}

export interface CoverageReading {
  /**
   * THREE states, not two, and the distinction is the correctness of the whole
   * disclosure.
   *
   * ⚠ THIS WAS `'even' | 'uneven'` AND IT FABRICATED. `kind` was
   * `min(counts) === max(counts)` — an equality over COUNTS — and it selected
   * copy claiming "Every option has all its effects set". Those are different
   * claims: two options at 2 of 3 AGREE, and neither is COMPLETE. Measured
   * against the compiled module, both-2-of-3, disjoint singles with 4 of 6 cells
   * empty, and both-zero-of-3 all read `even` and were indistinguishable from a
   * genuinely complete model.
   *
   * ⭐ AND THE FEATURE'S OWN REMEDY PRODUCED THE FABRICATION, which is what made
   * it serious. On the captured run the strip asks the user to set the missing
   * licence cost. They set it. Both options reach 2 of 3. The old predicate
   * flipped to `even` and the product declared the model COMPLETE — while
   * adoption, which this module's own header calls "exactly the case that
   * matters", was still empty on both.
   *
   * The invariant had been written against the failure mode in hand rather than
   * against the claim the copy makes. **Completeness is a claim about the
   * denominator; agreement between counts is not evidence for it.** "The counts
   * match" must never be spoken as "nothing is missing" — the mirror image of
   * the honest-at-zero rule this module already follows.
   */
  readonly kind: 'complete' | 'even-incomplete' | 'uneven'
  /** The denominator, echoed back so a consumer can never restate it differently. */
  readonly modelFactorIds: readonly string[]
  readonly perOption: readonly OptionCoverage[]
}

/**
 * Returns null — say nothing — when there is nothing honest to report:
 * fewer than two options (no comparison to be uneven), or no model factors
 * (no denominator). Never guesses, per the UI's passthrough doctrine.
 */
export function deriveOptionCoverage(
  options: readonly CoverageOption[],
  modelFactorIds: readonly string[],
): CoverageReading | null {
  if (options.length < 2) return null
  if (modelFactorIds.length === 0) return null

  // Dedupe the denominator without reordering it: a repeated factor id would
  // inflate every option's total and make an even model read as uneven.
  const factorIds: string[] = []
  for (const id of modelFactorIds) {
    if (!factorIds.includes(id)) factorIds.push(id)
  }

  const perOption: OptionCoverage[] = options.map((option) => {
    const set: string[] = []
    const unset: string[] = []
    for (const factorId of factorIds) {
      // Presence of the KEY is the signal, per the producer's shape. A set
      // effect of 0 is a real value — `keep what we have` carries exactly that
      // for switching cost — so a truthiness test here would report a genuine
      // zero as missing.
      const has =
        option.interventions != null &&
        Object.prototype.hasOwnProperty.call(option.interventions, factorId)
      ;(has ? set : unset).push(factorId)
    }
    return { optionId: option.id, label: option.label, setFactorIds: set, unsetFactorIds: unset }
  })

  const counts = perOption.map((o) => o.setFactorIds.length)
  const kind: CoverageReading['kind'] = perOption.every((o) => o.unsetFactorIds.length === 0)
    ? 'complete'
    : Math.min(...counts) === Math.max(...counts)
      ? 'even-incomplete'
      : 'uneven'

  return { kind, modelFactorIds: factorIds, perOption }
}

/**
 * True when the ranking must be stated provisionally.
 *
 * ⚠ DELIBERATELY NOT KEYED ON ROBUSTNESS, and this is the load-bearing call.
 * Paul's ruling allows stronger leader language "only when the ranking is
 * sufficiently robust to the missing information". `robustness.level` is on the
 * wire and looks like that signal — IT IS NOT. It measures sensitivity to the
 * values that were SAMPLED, and an unset effect is never sampled, so it carries
 * no information about the missing values at all. Using it to license a
 * definitive "winner" would claim the compute tested something it did not.
 *
 * Nothing currently on the wire certifies robustness to values that were never
 * set, so the honest reading of the ruling is the conservative one: while
 * coverage is uneven, the ranking is provisional. If a producer-side signal for
 * that ever ships, THIS is the predicate to widen — one place, not a second
 * rule beside it.
 */
export function rankingIsProvisional(reading: CoverageReading | null): boolean {
  return reading !== null && reading.kind !== 'complete'
}

// ─────────────────────────────────────────────────────────────────────────────
// Disclosure copy
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CODE-KEYED TEMPLATES ONLY. Nothing here interpolates upstream prose — the only
 * interpolated strings are option and factor LABELS, which are the user's own
 * model, resolved by the caller through the same label policy the rest of this
 * card uses. That keeps the raw-message guards applicable and keeps this from
 * becoming a second author of producer copy.
 *
 * British English. No em dashes in UI strings.
 */
export interface CoverageDisclosure {
  readonly kind: 'complete' | 'even-incomplete' | 'uneven'
  readonly headline: string
  readonly detail: string
  /** Per option, the factors it leaves unset. Empty for an even reading. */
  readonly unsetByOption: readonly { readonly label: string; readonly unsetLabels: readonly string[] }[]
}

// ⚠ COMPLETE is the ONLY state that may claim completeness. `EVEN_INCOMPLETE`
// exists because "the counts match" and "nothing is missing" are different
// facts, and collapsing them is what let the product call a model complete
// while a factor sat empty on every option.
const COMPLETE_HEADLINE = 'Every option has all its effects set'
const COMPLETE_DETAIL = 'This comparison rests on a complete model.'
const EVEN_INCOMPLETE_HEADLINE = 'The same effects are unset on every option'
const UNEVEN_HEADLINE = 'Not every option is equally specified'

/**
 * ⚠ THE WORDING IS LOAD-BEARING IN TWO DIRECTIONS AT ONCE.
 *
 * It must convey that the ranking is PROVISIONAL (Paul's ruling, 26 Aug: show
 * the result, show the unequal coverage, say "currently scores higher" rather
 * than naming a winner, and never auto-suppress the comparison).
 *
 * And it must NOT read as a verdict that the analysis should not have run. A
 * payload can be `status: "ready"` AND unevenly covered — 5 such runs in a
 * 122-run corpus. Saying "this comparison is unreliable" beside a producer that
 * has just called the model ready puts two Olumi affordances in contradiction
 * on one screen, which is the harm the `may_run` waiver exists to prevent.
 *
 * So: a statement of COMPLETENESS and a hedge on the RANKING. Never a claim
 * about the run's validity, never a direction, never a cause.
 */
const UNEVEN_DETAIL =
  'While some effects are unset, treat the ranking as which option currently scores higher, not as a settled result.'

export function buildCoverageDisclosure(
  reading: CoverageReading | null,
  factorLabel: (factorId: string) => string | null,
): CoverageDisclosure | null {
  if (reading === null) return null

  if (reading.kind === 'complete') {
    // Honest at zero is SAID, not encoded as an absence. Rendering nothing here
    // would make "no disclosure" and "nothing to disclose" indistinguishable.
    return { kind: 'complete', headline: COMPLETE_HEADLINE, detail: COMPLETE_DETAIL, unsetByOption: [] }
  }

  const total = reading.modelFactorIds.length
  const counts = reading.perOption
    .map((o) => `${o.label} has ${o.setFactorIds.length} of ${total} set`)
    .join('. ')

  const unsetByOption = reading.perOption
    .filter((o) => o.unsetFactorIds.length > 0)
    .map((o) => ({
      label: o.label,
      // A factor with no honest label is DROPPED, never rendered as its id.
      // The id is an internal token and naming one at a user surface is the
      // leak this estate has already paid for.
      unsetLabels: o.unsetFactorIds
        .map(factorLabel)
        .filter((l): l is string => typeof l === 'string' && l.length > 0),
    }))
    .filter((o) => o.unsetLabels.length > 0)

  return {
    kind: reading.kind,
    headline: reading.kind === 'uneven' ? UNEVEN_HEADLINE : EVEN_INCOMPLETE_HEADLINE,
    detail: `${counts}. ${UNEVEN_DETAIL}`,
    unsetByOption,
  }
}
