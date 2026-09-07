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
 * WHAT WAS MEASURED (PLoT `d37c8cfd`). `influence_score` is a normalised product
 * of authored edge weights along the paths to the goal, computed over a graph
 * with option and decision nodes FILTERED OUT, at a line that runs before the
 * ISL result exists. A founder added an option and flipped the leader outright;
 * all five canvas influence numbers were byte-identical across both runs.
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
]

describe('influence copy — no string attributes the figure to the analysis run', () => {
  it('POSITIVE CONTROL: the corpus is non-empty and still says what it should', () => {
    // Without this, every absence assertion below would pass on an empty or
    // renamed export — an instrument that cannot fail.
    expect(ALL_INFLUENCE_COPY.length).toBeGreaterThanOrEqual(13)
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
