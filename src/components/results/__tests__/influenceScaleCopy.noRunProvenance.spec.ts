/**
 * THE INFLUENCE COPY MAY NOT CLAIM THE NUMBER CAME FROM THE RUN.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS GUARD EXISTS RATHER THAN JUST THE FIXED STRINGS
 * ═══════════════════════════════════════════════════════════════════════════
 * The clause "from the analysis" was removed from three strings on 5 Sep 2026.
 * Each is separately asserted by its own component spec, and each of those
 * assertions would happily be UPDATED alongside a re-introduction — that is how
 * the clause got written into three places to begin with. A spec that pins one
 * exact sentence cannot notice the sentence being changed on purpose.
 *
 * So this suite asserts the PROPERTY, over the module's whole exported surface:
 * no influence string may attribute the figure to the analysis run.
 *
 * WHAT WAS MEASURED (PLoT `d37c8cfd`, the deployed SHA, verified at its bytes
 * on 7 Sep 2026 — this paragraph was PROSE ASSERTED FROM A DOCBLOCK until then,
 * and two of its clauses were wrong).
 *
 * On the graph path `influence_score` is `f.normalised_influence`
 * (`src/lib/factor-influence.ts:798`): a DFS accumulates the PRODUCT of
 * `edge.strength_mean` along each path to the goal (`:444`), those path effects
 * are SUMMED (`:471`, "Influence = Sum of all path effects"), and the total is
 * divided by the largest absolute influence in the SAME RESPONSE (`:604-613`).
 *
 *   ⚠ CORRECTED: it is a normalised SUM OVER PATHS OF PRODUCTS, not "a
 *     normalised product". And "normalised" means BY THE MAX ROW — a row's
 *     value is therefore not a property of that row alone, and an absolute gap
 *     between two rows can be moved by a third row outside the pair.
 *
 *   ⚠ CORRECTED: "at a line that runs before the ISL result exists" is FALSE.
 *     The sole call site (`src/routes/v2/run.ts:7989`) runs AFTER the ISL await
 *     at `:7599`, inside the ISL-success branch. The true and defensible claim
 *     is ISL-INDEPENDENCE, not temporal precedence: its graph argument is fixed
 *     from `body.graph` before ISL is called, and its one ISL-derived argument
 *     (`fragileEdgesForVoi`) reaches only `value_of_information`
 *     (`factor-influence.ts:822`) and `flip_risk_category` (`:859`) — never
 *     `influence_score`.
 *
 * ⚠⚠ AND THE CLAIM IS PATH-CONDITIONAL, WHICH THE OLD WORDING HID. All of the
 * above holds on the GRAPH path. When the graph path finds no factor with a
 * path to the goal it returns null (`factor-influence.ts:766-768`) and the ISL
 * fallback publishes `influence_score: prob01(f.influence_score)`
 * (`run.ts:1056`) — ISL's own Monte-Carlo value, which is NOT structural. The
 * wire discloses which one you got via `importance_basis`
 * (`'graph_structural' | 'isl_uncertainty'`), and `influenceScaleCopy.ts` gates
 * the structural noun on it for exactly this reason.
 *
 * The run-invariance witness stands unchanged: a founder added an option and
 * flipped the leader outright; all five canvas influence numbers were
 * byte-identical across both runs.
 *
 * ⚠ THE POSITIVE CONTROL IS THE LOAD-BEARING PART. An absence assertion over
 * strings is vacuous if the strings stop being reachable, get renamed, or come
 * back empty — so this suite first proves it is looking at real, non-empty copy
 * that still says what it should (CLAUDE.md trap 13).
 */
import { describe, it, expect } from 'vitest'

import {
  INFLUENCE_EXPLANATION_ABSOLUTE,
  INFLUENCE_EXPLANATION_RELATIVE,
  INFLUENCE_EXPLANATION_GENERIC,
  influenceExplanation,
  influenceBarAriaLabel,
  influencePillAriaLabel,
  influenceBasisNoun,
  INFLUENCE_QUANTITY_BY_BASIS,
} from '../influenceScaleCopy'

/** Every influence string a mounted surface can render, both provenance arms. */
const ALL_INFLUENCE_COPY: Array<[string, string]> = [
  ['INFLUENCE_EXPLANATION_ABSOLUTE', INFLUENCE_EXPLANATION_ABSOLUTE],
  ['INFLUENCE_EXPLANATION_RELATIVE', INFLUENCE_EXPLANATION_RELATIVE],
  ['INFLUENCE_EXPLANATION_GENERIC', INFLUENCE_EXPLANATION_GENERIC],
  ['influenceExplanation(influence_score)', influenceExplanation('influence_score')],
  ['influenceExplanation(normalised_elasticity)', influenceExplanation('normalised_elasticity')],
  ['influenceExplanation(null)', influenceExplanation(null)],
  ['influenceBarAriaLabel(influence_score)', influenceBarAriaLabel('influence_score')],
  ['influenceBarAriaLabel(normalised_elasticity)', influenceBarAriaLabel('normalised_elasticity')],
  ['influenceBarAriaLabel(null)', influenceBarAriaLabel(null)],
  ['influencePillAriaLabel(influence_score)', influencePillAriaLabel(60, 'influence_score')],
  ['influencePillAriaLabel(normalised_elasticity)', influencePillAriaLabel(60, 'normalised_elasticity')],
  ['influenceBasisNoun(influence_score)', influenceBasisNoun('influence_score')],
  ['influenceBasisNoun(normalised_elasticity)', influenceBasisNoun('normalised_elasticity')],
  /* ⭐ THE QUANTITY VOCABULARY IS SUBJECT TO THE SAME PROPERTY, AND IT IS THE
     ONE MOST AT RISK OF BREAKING IT. Naming a quantity invites a sentence about
     where the quantity came from, and for `influence_score` the honest answer is
     NOT the run: this suite's header records the measurement (on the graph
     path, a normalised sum over paths of products of authored strengths,
     computed independently of the ISL result; five canvas numbers
     byte-identical across two runs with different option sets). Derived over the total record so a third basis is
     covered without an edit here. */
  ...Object.entries(INFLUENCE_QUANTITY_BY_BASIS).flatMap(
    ([basis, quantity]): Array<[string, string]> => [
      [`INFLUENCE_QUANTITY_BY_BASIS.${basis}.noun`, quantity.noun],
      [`INFLUENCE_QUANTITY_BY_BASIS.${basis}.gloss`, quantity.gloss],
      [`INFLUENCE_QUANTITY_BY_BASIS.${basis}.runDisclosure`, quantity.runDisclosure],
    ],
  ),
]

describe('influence copy — no string attributes the figure to the analysis run', () => {
  it('POSITIVE CONTROL: the corpus is non-empty and still says what it should', () => {
    // Without this, every absence assertion below would pass on an empty or
    // renamed export — an instrument that cannot fail.
    // ⚠ 13 WAS THE WHOLE CORPUS WHEN THIS WAS WRITTEN; the quantity vocabulary
    // added six more (three fields x two bases) on 7 Sep 2026. The floor is
    // raised rather than left at 13 so a change that DROPPED the new strings
    // from this corpus would RED here instead of passing on the old count.
    expect(ALL_INFLUENCE_COPY.length).toBeGreaterThanOrEqual(19)
    for (const [name, copy] of ALL_INFLUENCE_COPY) {
      expect(copy, `${name} must be non-empty`).toBeTruthy()
      expect(copy.length, `${name} must be real copy`).toBeGreaterThan(3)
    }
    // And the two arms still make their OWN distinct claims — so a later change
    // that collapsed them into one bland string would be visible here.
    // ⚠ THE WITNESS CHANGED; THE PROPERTY DID NOT. This asserted the producer
    // arm contains "absolute" — a true witness for a FALSE claim. #1228
    // established that `influence_score` is set-relative (normalised against
    // `max|influence|`; of the 21 JSON files under `src/` carrying the field,
    // every one whose maximum is non-zero maxes at exactly 1.0 and none exceeds
    // it — narrowed 6 Sep 2026 from a universal a reviewer refuted, the sweep is
    // derived in `influenceIsNeverCalledAbsolute.spec.ts`), so that word had to go.
    //
    // What this control is FOR survives untouched, and it caught a real
    // over-reach: the first cut of #1228 aliased the two constants together and
    // this REDded, exactly as its author intended. The arms must stay distinct.
    expect(INFLUENCE_EXPLANATION_ABSOLUTE).not.toBe(INFLUENCE_EXPLANATION_RELATIVE)
    expect(INFLUENCE_EXPLANATION_ABSOLUTE).toContain('structural influence score')
    expect(INFLUENCE_EXPLANATION_RELATIVE).toContain('relative to the strongest')
    // And neither may claim an absolute scale any more.
    for (const [name, copy] of ALL_INFLUENCE_COPY) {
      expect(copy.toLowerCase(), `${name} claims an absolute scale`).not.toContain('absolute')
    }
  })

  it.each(ALL_INFLUENCE_COPY)(
    '%s does not claim the figure comes from the analysis run',
    (_name, copy) => {
      expect(copy).not.toMatch(/from the analysis/i)
      expect(copy).not.toMatch(/from the run\b/i)
      expect(copy).not.toMatch(/\bproduced by the (analysis|run)\b/i)
    },
  )

  it('the producer arm still names its SCALE — removing the lie did not blank the disclosure', () => {
    /**
     * The opposite-direction twin, and its INTENT is untouched: a fix that
     * closed the false claim by deleting the basis entirely would leave a bare
     * percentage, which is the defect one level down. The reader must still be
     * told what the scale is.
     *
     * ⚠⚠ ONLY THE WITNESS CHANGED, AND THE PREMISE IT CITED WAS THE FALSEHOOD.
     * This asserted the phrase "absolute causal influence score", on the stated
     * grounds that "`driverDisplayModel.ts` records that `influence_score` is
     * 'an absolute producer scale, not a share'". **That sentence in
     * `driverDisplayModel.ts` was wrong**, and it is corrected at its source in
     * the same change as this. `influence_score` is normalised against
     * `max|influence|` — top row 1.0 by construction, and of the 21 JSON files
     * under `src/` carrying the field every one whose maximum is non-zero maxes
     * at exactly 1.0 (one real degenerate turn is uniformly 0; none exceeds 1.0).
     *
     * So this guard was defending a true property with a false witness. The
     * property stays; the witness becomes the scale that is actually there.
     */
    // ⚠ "strongest", not one exact phrasing — the three surfaces word it
    // differently on purpose ("relative to" / "scaled against"), and pinning one
    // literal would RED on a legitimate rewording rather than on a lost
    // disclosure. The property is that the reference point is named.
    for (const copy of [
      INFLUENCE_EXPLANATION_ABSOLUTE,
      influenceBarAriaLabel('influence_score'),
      influencePillAriaLabel(60, 'influence_score'),
    ]) {
      expect(copy, `the scale reference is missing: "${copy}"`).toMatch(/strongest/)
    }
    // ⚠ And the disclosure is not merely present but INFORMATIVE — the
    // 100%-by-construction fact is the whole point of telling the reader.
    expect(influencePillAriaLabel(60, 'influence_score')).toMatch(/always shows 100%/)
  })

  it('the relative arm is untouched — its claim was about SCALING, never provenance', () => {
    expect(influenceExplanation('normalised_elasticity')).toContain('The top driver always shows 100%')
    expect(influenceBasisNoun('normalised_elasticity')).toBe('Relative influence')
  })
})
