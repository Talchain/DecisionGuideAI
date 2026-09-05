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
  INFLUENCE_STRUCTURAL_BASIS_NOTE,
  STRUCTURAL_IMPORTANCE_BASIS,
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
  // The structural-basis disclosure (5 Sep 2026) is copy a mounted surface
  // renders, so it joins the corpus this property is asserted over. It states
  // what the figure IS derived from; it must still never attribute it to the
  // run.
  ['INFLUENCE_STRUCTURAL_BASIS_NOTE', INFLUENCE_STRUCTURAL_BASIS_NOTE],
  [
    'influenceExplanation(influence_score, graph_structural)',
    influenceExplanation('influence_score', STRUCTURAL_IMPORTANCE_BASIS),
  ],
  [
    'influenceBarAriaLabel(influence_score, graph_structural)',
    influenceBarAriaLabel('influence_score', STRUCTURAL_IMPORTANCE_BASIS),
  ],
  [
    'influencePillAriaLabel(influence_score, graph_structural)',
    influencePillAriaLabel(60, 'influence_score', STRUCTURAL_IMPORTANCE_BASIS),
  ],
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
    expect(INFLUENCE_EXPLANATION_ABSOLUTE).toContain('absolute')
    expect(INFLUENCE_EXPLANATION_RELATIVE).toContain('relative to the strongest')
  })

  it.each(ALL_INFLUENCE_COPY)(
    '%s does not claim the figure comes from the analysis run',
    (_name, copy) => {
      expect(copy).not.toMatch(/from the analysis/i)
      expect(copy).not.toMatch(/from the run\b/i)
      expect(copy).not.toMatch(/\bproduced by the (analysis|run)\b/i)
    },
  )

  it('the absolute arm still names its SCALE — removing the lie did not blank the disclosure', () => {
    // The opposite-direction twin. A fix that closed the false claim by deleting
    // the basis entirely would leave a bare percentage, which is the defect one
    // level down: `driverDisplayModel.ts` records that `influence_score` is "an
    // absolute producer scale, not a share", and the reader must still be told.
    expect(INFLUENCE_EXPLANATION_ABSOLUTE).toMatch(/absolute causal influence score/)
    expect(influenceBarAriaLabel('influence_score')).toMatch(/absolute causal influence score/)
    expect(influencePillAriaLabel(60, 'influence_score')).toMatch(/absolute causal influence score/)
  })

  it('the relative arm is untouched — its claim was about SCALING, never provenance', () => {
    expect(influenceExplanation('normalised_elasticity')).toContain('The top driver always shows 100%')
    expect(influenceBasisNoun('normalised_elasticity')).toBe('Relative influence')
  })
})
