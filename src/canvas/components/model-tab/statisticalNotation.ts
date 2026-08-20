/**
 * PLAIN-LANGUAGE STATISTICAL NOTATION — one wording table, gated by the ONE
 * expert-mode authority.
 *
 * ## The defect this closes
 *
 * A UX gate on the frozen deployed build (UI `2b6ec553`) read the Model surface
 * as a FRESH GUEST with expert mode OFF and found `(normalised)` ×5, `Prior` ×2
 * and `Δ` ×13. The same gate found 0 snake_case, 0 UUIDs and 0 hex ids with a
 * positive control firing — so this was never a general rawness problem, it was
 * a bounded leak of STATISTICAL VOCABULARY past a control that exists precisely
 * to keep modelling internals away from a first-time reader.
 *
 * ## Why a formatter and NOT a new gate
 *
 * There is exactly ONE expert-mode authority and this module deliberately does
 * not become a second one. The chain, derived at `2b6ec553`:
 *
 *   OutputsDock.tsx:1053   useState ← localStorage['olumi.expertMode']
 *   OutputsDock.tsx:~3278  expertMode ──▶ ModelTabBody
 *   ModelTabBody.tsx:811   showDetail={expertMode ?? false} ──▶ ModelTabHeader
 *   ModelTabHeader.tsx:24  DetailToggleContext.Provider value={{ showDetail }}
 *   every section          const { showDetail } = useContext(DetailToggleContext)
 *
 * Every function here takes that SAME `showDetail` as a parameter. It decides
 * WORDING, never VISIBILITY — so there is no second decision to drift out of
 * step with the first. `FactorsSection` already consumed the context (`:158`)
 * and honoured it at `:485` and `:560`; the leaking lines simply sat outside it.
 *
 * ## Why the quantity is never deleted
 *
 * Deleting the term would be the worse failure. A normalised value genuinely is
 * normalised, a prior genuinely is a prior, and a delta genuinely is a change —
 * a reader who cannot tell a prior from a posterior, or a normalised score from
 * a raw one, will MISREAD the model, and "scientific credibility" is the whole
 * product claim. So the default says the same thing in the product's voice and
 * expert mode restores the technical term. Both directions are pinned by tests;
 * a single-direction test would let a fix that simply deletes the term pass.
 *
 * ## Why "the model's own scale" and not "a 0–1 scale"
 *
 * Derived, not assumed. `OptionsSection`'s `looksNormalised` predicate DOES
 * require `0 ≤ v ≤ 1` (`OptionsSection.tsx:93-95`), but `FactorsSection`'s
 * normalised value is `formatSmartNumber(obs.value)` with NO bound asserted
 * anywhere (`FactorsSection.tsx:205`), and the prior min/max are free-text
 * editable. Writing "0–1" at those two sites would be a precision the data does
 * not carry — the exact shape of trap 13d, a guard stating more than its source
 * supports. One honest phrase, true at all three sites, beats two phrasings for
 * one concept.
 */

/**
 * Suffix marking a value that is in model space rather than a real-world unit.
 * Default names the scale in words; expert mode restores `(normalised)`.
 */
export function normalisedScaleSuffix(showDetail: boolean): string {
  return showDetail ? '(normalised)' : "on the model's own scale"
}

/**
 * Label for an external factor's prior range — the belief held BEFORE evidence.
 * `NodeInspector.tsx:652` already glosses the same term as "(belief before
 * evidence)"; this is that gloss promoted to the default label.
 */
export function priorRangeLabel(showDetail: boolean): string {
  return showDetail ? 'Prior' : 'Starting range'
}

/**
 * The gap between two independent estimates of the same edge strength.
 *
 * ⚠ The producer is `Math.abs(pass1Mean - pass2Mean)` (`ContestedEdgeCard.tsx:267`)
 * — a MAGNITUDE, sign-free. So the plain form says "differ by" and asserts no
 * direction. Naming a direction here would invent information the quantity does
 * not carry, which is the same class of harm as hiding it.
 */
export function estimateGapText(magnitude: number, showDetail: boolean): string {
  const value = magnitude.toFixed(2)
  return showDetail ? `Δ ${value}` : `estimates differ by ${value}`
}
