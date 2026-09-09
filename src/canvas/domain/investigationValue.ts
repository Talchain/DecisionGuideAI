/**
 * ⭐⭐ HOW MUCH BETTER EVIDENCE ON THIS FACTOR WOULD HELP — ONE AUTHORITY.
 *
 * ── WHAT WAS HERE INSTEAD ────────────────────────────────────────────────────
 * SIX hand-written copies of the same ladder, in three sibling panels, all
 * reading the same `displayMetadata.valueOfInformation`:
 *
 *     FactorExternalPanel      trailing label at :321  ·  guidance prose at :332
 *     FactorObservablePanel    trailing label at :265  ·  guidance prose at :276
 *     FactorControllablePanel  trailing label at :517  ·  guidance prose at :528
 *
 * Byte-identical thresholds (`>= 0.7`, `>= 0.4`), typed out six times. Moving a
 * boundary meant remembering all six, and the two anybody forgot would have gone
 * on disagreeing under a green suite — the hand-maintained mirror this estate
 * keeps paying for. A census in this module's spec now fails loud on a seventh.
 *
 * ── WHAT IS *NOT* COLLAPSED, AND WHY THAT MATTERS MORE ───────────────────────
 * The three panels' SENTENCES differ, correctly: an observable factor is told
 * "Updating this measurement…" and "More recent data here…", because you refresh
 * a measurement and you gather evidence for an estimate. Those are different
 * acts, and flattening them into one string would trade a mirror for a wrong
 * instruction.
 *
 * So exactly one question moves here — *which tier is this value in?* — and the
 * question *what do we say to this factor's owner?* stays with each panel, keyed
 * by the tier. One authority per question, which is the whole rule.
 *
 * ── ⚠⚠ A DIVERGENCE THIS MODULE DOES NOT FIX, AND MUST NOT HIDE ─────────────
 * `FactorNode` classifies the SAME `valueOfInformation` on a completely
 * different ladder (`FactorNode.tsx:384-388`):
 *
 *     voi > 0.20  AND  voiRank <= 3   →  'critical'   (evidence-gap badge)
 *     voi > 0.05                      →  'warning'
 *     otherwise                       →  'none'
 *
 * So a factor at `voi = 0.25` is badged **critical** on the canvas while the
 * inspector one double-click away calls it **Low**. Until this commit the
 * inspector also said *"Further investigation here is unlikely to change the
 * outcome"* — two surfaces, one number, opposite instructions. That half is
 * removed here (see `INVESTIGATION_VALUE_COMPARISON` below); the node's
 * `critical` is the half still outstanding.
 *
 * ⛔ IT IS DELIBERATELY NOT REPAIRED BY ALIGNING THE NUMBERS, because the
 * two are not obviously the same question: the node's flag is RELATIVE (it takes
 * `voiRank <= 3`, i.e. "among the top few to look at"), and this ladder is
 * ABSOLUTE (a level on 0–1). A relative flag and an absolute level can honestly
 * disagree — and picking one set of thresholds for both would be reconciling two
 * authorities that answer different questions, which is how the estate produces
 * its worst defects. What they may NOT do is contradict each other in front of a
 * user. Naming the divergence is this module's job; deciding the surface copy is
 * the option-node/spec owner's, and it is reported on programme #38.
 */

/** The three levels this product distinguishes for value-of-information. */
export type InvestigationValueTier = 'high' | 'medium' | 'low'

/**
 * The boundaries, in ONE place. Inclusive lower bounds, descending — a value is
 * in the first tier whose bound it meets.
 *
 * ⚠ These are the numbers the six copies carried, preserved exactly. This change
 * moves them; it does not retune them. Retuning is a separate decision with its
 * own evidence, and doing both at once would make neither reviewable.
 */
export const INVESTIGATION_VALUE_BOUNDS: ReadonlyArray<readonly [InvestigationValueTier, number]> = [
  ['high', 0.7],
  ['medium', 0.4],
  ['low', Number.NEGATIVE_INFINITY],
] as const

/**
 * Which tier a value-of-information score falls in.
 *
 * ⚠ A NON-FINITE SCORE IS NOT 'low'. `null` never reaches here (every call site
 * gates on it), but `NaN` from a malformed payload would silently score as the
 * bottom tier and rank the factor below its peers — a confident comparison
 * derived from nothing. It returns `null` instead, and the caller renders no
 * tier at all.
 */
export function investigationValueTier(score: number): InvestigationValueTier | null {
  if (!Number.isFinite(score)) return null
  for (const [tier, bound] of INVESTIGATION_VALUE_BOUNDS) {
    if (score >= bound) return tier
  }
  /* istanbul ignore next — the last bound is -Infinity, so this is unreachable
     while the table above ends the way it does. It exists so a future edit that
     removes that row fails closed rather than returning undefined. */
  return null
}

/**
 * The short word beside the bar.
 *
 * ⚠ "Medium", NOT "Med". `sensitivityTierLabel` (`utils/labelUtils.ts`) spells
 * the same middle band "Med" at the SAME 0.7/0.4 boundaries — one vocabulary,
 * two spellings, on cards a user reads side by side. This module keeps the
 * spelling the three panels already shipped; unifying the two ladders is a
 * separate change, because they describe different quantities (sensitivity is
 * not value-of-information) and only their words collide.
 */
export const INVESTIGATION_VALUE_LABEL: Record<InvestigationValueTier, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

/**
 * ⭐⭐ HOW THE TIER MAY BE SPOKEN — COMPARATIVE AND ATTRIBUTED, NEVER ABSOLUTE.
 *
 * ── THE OVERCLAIM THIS REPLACES ──────────────────────────────────────────────
 * The bottom band used to end the sentence *"Further investigation here is
 * unlikely to change the outcome."* That is a claim about the WORLD, made from a
 * 0-1 score that **no contract establishes as a calibrated absolute benefit**.
 * Nothing on the wire says that 0.39 means "little would change"; it says this
 * factor scored 0.39 on the producer's own index. The sentence turned an
 * arbitrary cut-off into an instruction to stop looking — which is the most
 * expensive thing a thinking tool can get wrong, because the reader cannot see
 * what they were told not to examine.
 *
 * The ruling this implements (option-node owner, programme docs #38): *"neither
 * arbitrary tier nor ordinal position licences 'unlikely to change the outcome'
 * or 'critical' … do not claim the 0-1 score is calibrated absolute benefit
 * without a producer contract."*
 *
 * ── WHAT IS LEFT SAYABLE, AND WHY EACH PART IS ───────────────────────────────
 * A tier IS a legitimate COMPARATIVE statement: this factor scored higher than
 * most on the producer's index. That claim needs no calibration, because it is a
 * claim about the ORDERING, which the producer does supply. So the tails below
 * compare, attribute, and stop:
 *
 *   high    "more than for most factors"
 *   medium  "about as much as for a typical factor"
 *   low     "less than for most factors"          ← not "not worth looking at"
 *
 * ⚠ THE STEM IS A SEPARATE RECORD, NOT A SHARED SENTENCE. "better evidence here"
 * is wrong for an observable factor, which needs "a more recent measurement
 * here" — you refresh a measurement and you gather evidence for an estimate. The
 * two are named apart and keyed by the ACT, so a panel picks its own voice and a
 * fourth panel cannot quietly invent a third one.
 */
/**
 * The half of the sentence that names the ACT, keyed by what a factor of that
 * category actually needs. Ends with a space; `INVESTIGATION_VALUE_COMPARISON`
 * finishes the sentence.
 */
export const INVESTIGATION_VALUE_STEM: Record<'evidence' | 'measurement', string> = {
  evidence: "On this model's own estimate, better evidence here would sharpen its analysis ",
  measurement:
    "On this model's own estimate, a more recent measurement here would sharpen its analysis ",
}

export const INVESTIGATION_VALUE_COMPARISON: Record<InvestigationValueTier, string> = {
  high: 'more than for most factors.',
  medium: 'about as much as for a typical factor.',
  low: 'less than for most factors.',
}

/**
 * The one ACTIONABLE thing the producer genuinely supports.
 *
 * ⚠ THIS IS ORDINAL, NOT A LEVEL, and that is exactly why it may be said out
 * loud. `useNodeDisplayMetadata` sets `voiRank` only when the factor's position
 * is 1-3 (`voiPos > 0 && voiPos <= 3`), so a non-null rank IS the producer's own
 * ordering, not our reading of a magnitude. It licenses "among this model's top
 * few to look into" and nothing stronger — not "critical", which asserts
 * consequence, and not a claim about how much difference it would make.
 */
export const INVESTIGATION_VALUE_TOP_RANK_NOTE =
  "This model puts it among its top few factors to look into."

