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
 * inspector one double-click away calls it **Low** and says *"Further
 * investigation here is unlikely to change the outcome."* Two surfaces, one
 * number, opposite instructions.
 *
 * ⛔ THAT IS DELIBERATELY NOT REPAIRED BY ALIGNING THE NUMBERS HERE, because the
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
 * bottom tier and tell the user not to bother investigating — a confident
 * instruction derived from nothing. It returns `null` instead, and the caller
 * renders no tier at all.
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
