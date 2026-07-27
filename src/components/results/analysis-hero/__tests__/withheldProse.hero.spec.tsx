/**
 * WITHHELD RUNS MAY NOT PRESUPPOSE A LEADER — the analysis-hero prose half
 * (ROADMAP 1.267, follow-up to PR #501).
 *
 * #501 removed the designations a string matcher CANNOT see (order, ordinals,
 * crowns, screen-reader cues). This file and its siblings remove the ones it
 * can: sentences that PRESUPPOSE a leading option exists, on a run where CEE
 * has declined to put one forward.
 *
 * The hero's three flip-risk strings were the widest leak, because they are
 * built unconditionally in `buildHeroModel` with no verdict input at all:
 *
 *   · the view note   "Chance the leading option changes when a relationship
 *                      is varied within its plausible range."
 *   · with-alternative "If X falls below V, Y becomes the likely leader."
 *   · no-alternative   "If X rises above V, the leading option is likely to
 *                      change."
 *
 * ## The distinction being pinned
 *
 * The flip NUMBERS are data and must survive: the factor, its threshold, its
 * unit, the direction, the producer's `alternative_winner_label`, and the
 * switch probability. Only the leader FRAMING around them is withheld. A
 * change that silences the withheld run by dropping the flip rows would fail
 * the DATA PRESERVED cases below — it would cost the user exactly the
 * computed facts the ruling protects.
 *
 * ## Lives here, not in results/__tests__
 *
 * `inertness.spec.ts` allows analysis-hero imports only from inside the
 * module and from ResultsBody. Same reason the #501 hero half lives here.
 *
 * ## Scope of the claim (CLAUDE.md trap 3)
 *
 * These are string assertions over a built model and, for the disclosure, a
 * jsdom render. They prove WORDING and presence. They do not prove layout.
 */
import { describe, expect, it } from 'vitest'
import { buildHeroModel } from '../buildHeroModel'
import { HERO_COPY } from '../heroCopy'
import type { HeroChartModel } from '../heroTypes'
import { makeHeroData } from '../__fixtures__/hero.fixtures'
import {
  PERMITTED_VERDICT,
  WITHHELD_VERDICT,
  withheldFixtureOptions as options,
} from '../../__fixtures__/withheldDesignations.fixtures'

/**
 * Anything that asserts, or presupposes, that one option is out in front.
 *
 * Deliberately NARROWER than the fixture's `DESIGNATION_RE`: that one bans
 * "leads" outright, which would also condemn a producer-supplied CONDITIONAL
 * ("if X, then Y leads") — a different claim with a different owner. This
 * matcher targets the unconditional leader NOUN and the verb phrases that
 * only make sense when a current leader exists.
 */
const LEADER_PRESUPPOSITION_RE = /leading option|likely leader|the leader\b/i

/** Two producer flip thresholds: one WITH an alternative winner, one without. */
const FLIP_THRESHOLDS = [
  {
    label: 'Team capacity',
    node_id: 'fac_capacity',
    flip_value: 30,
    current_value: 45,
    unit: '%',
    alternative_winner_label: 'Upskill the current team',
  },
  {
    label: 'Salary cost',
    node_id: 'fac_salary',
    flip_value: 60000,
    current_value: 52000,
    unit: '$',
  },
]

function heroModel(verdict: typeof WITHHELD_VERDICT): HeroChartModel {
  return buildHeroModel(
    makeHeroData({
      options: options(),
      recommendation: {
        verdict,
        storyHeadlines: {},
        flipThresholds: FLIP_THRESHOLDS,
      } as NonNullable<Parameters<typeof makeHeroData>[0]>['recommendation'],
    }),
  ) as HeroChartModel
}

const flipTexts = (verdict: typeof WITHHELD_VERDICT): string[] =>
  heroModel(verdict).evidence.flipRisks.map((r) => r.text)

// ─────────────────────────────────────────────────────────────────────────────
// ANTI-VACUITY — if the fixture pair stops discriminating, or the flip rows
// stop being built at all, every assertion below starts passing for the wrong
// reason. Trap 13: an absence assertion must first prove it can see a
// presence.
// ─────────────────────────────────────────────────────────────────────────────

describe('the flip-risk harness can actually go red', () => {
  it('the fixture pair withholds on one verdict and permits on the other', () => {
    expect(WITHHELD_VERDICT.hasLeadingOption).toBe(false)
    expect(PERMITTED_VERDICT.hasLeadingOption).toBe(true)
  })

  it('both verdicts build the SAME two flip rows (so absence is never why)', () => {
    expect(flipTexts(WITHHELD_VERDICT)).toHaveLength(2)
    expect(flipTexts(PERMITTED_VERDICT)).toHaveLength(2)
  })

  it('the PERMITTED wording contains the presupposition the matcher hunts', () => {
    // Positive control for LEADER_PRESUPPOSITION_RE itself: if this stops
    // matching, the withheld assertions below are vacuous.
    expect(flipTexts(PERMITTED_VERDICT).join(' ')).toMatch(LEADER_PRESUPPOSITION_RE)
    expect(HERO_COPY.evidence.flipRisksNote(false)).toMatch(LEADER_PRESUPPOSITION_RE)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SURFACE 2 — heroCopy.evidence, as pure copy
// ─────────────────────────────────────────────────────────────────────────────

describe('heroCopy.evidence — the three flip-risk strings', () => {
  it('WITHHELD: the view note presupposes no leader', () => {
    expect(HERO_COPY.evidence.flipRisksNote(true)).not.toMatch(LEADER_PRESUPPOSITION_RE)
  })

  it('WITHHELD: neither sentence template presupposes a leader', () => {
    expect(
      HERO_COPY.evidence.flipRiskWithAlternative('Team capacity', 'falls below', '30%', 'Upskill', true),
    ).not.toMatch(LEADER_PRESUPPOSITION_RE)
    expect(
      HERO_COPY.evidence.flipRiskNoAlternative('Salary cost', 'rises above', '$60,000', true),
    ).not.toMatch(LEADER_PRESUPPOSITION_RE)
  })

  it('WITHHELD: the producer alternative-winner label SURVIVES (no over-suppression)', () => {
    expect(
      HERO_COPY.evidence.flipRiskWithAlternative('Team capacity', 'falls below', '30%', 'Upskill', true),
    ).toContain('Upskill')
  })

  /**
   * PERMITTED is byte-identical to the strings that shipped before this
   * change. Written out in full rather than compared to a helper: a helper
   * would have to restate the string anyway, and a literal is the only form
   * that catches a one-word drift.
   */
  it('PERMITTED: every string is byte-identical to today', () => {
    expect(HERO_COPY.evidence.flipRisksNote(false)).toBe(
      'Chance the leading option changes when a relationship is varied within its plausible range.',
    )
    expect(
      HERO_COPY.evidence.flipRiskWithAlternative('Team capacity', 'falls below', '30%', 'Upskill', false),
    ).toBe('If Team capacity falls below 30%, Upskill becomes the likely leader.')
    expect(
      HERO_COPY.evidence.flipRiskNoAlternative('Salary cost', 'rises above', '$60,000', false),
    ).toBe('If Salary cost rises above $60,000, the leading option is likely to change.')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SURFACE 2 — buildHeroModel, i.e. the wiring, not just the copy
//
// The copy cases above would still pass if buildHeroModel never passed the
// verdict through. These are the ones that prove the gate is CONNECTED.
// ─────────────────────────────────────────────────────────────────────────────

describe('buildHeroModel — flip-risk rows quote the verdict', () => {
  it('WITHHELD: no built flip sentence presupposes a leader', () => {
    for (const text of flipTexts(WITHHELD_VERDICT)) {
      expect(text, `flip row leaked a leader presupposition: "${text}"`).not.toMatch(
        LEADER_PRESUPPOSITION_RE,
      )
    }
  })

  it('WITHHELD: the model carries the flag the disclosure note reads', () => {
    expect(heroModel(WITHHELD_VERDICT).evidence.designationsWithheld).toBe(true)
    expect(heroModel(PERMITTED_VERDICT).evidence.designationsWithheld).toBe(false)
  })

  it('WITHHELD DATA PRESERVED: factor, threshold, unit and direction all survive', () => {
    const [withAlt, noAlt] = flipTexts(WITHHELD_VERDICT)
    // Factor labels
    expect(withAlt).toContain('Team capacity')
    expect(noAlt).toContain('Salary cost')
    // Producer thresholds, with their units
    expect(withAlt).toContain('30%')
    expect(noAlt).toContain('$60,000')
    // Direction, derived from current_value vs flip_value
    expect(withAlt).toContain('falls below')
    expect(noAlt).toContain('rises above')
    // The producer's alternative winner
    expect(withAlt).toContain('Upskill the current team')
  })

  it('WITHHELD DATA PRESERVED: the switch-probability slot is untouched', () => {
    const withheld = heroModel(WITHHELD_VERDICT).evidence.flipRisks
    const permitted = heroModel(PERMITTED_VERDICT).evidence.flipRisks
    expect(withheld.map((r) => r.switchMeta)).toEqual(permitted.map((r) => r.switchMeta))
    expect(withheld.map((r) => r.magnitude)).toEqual(permitted.map((r) => r.magnitude))
    expect(withheld.map((r) => r.targetId)).toEqual(permitted.map((r) => r.targetId))
  })

  it('PERMITTED: the built sentences are byte-identical to today', () => {
    expect(flipTexts(PERMITTED_VERDICT)).toEqual([
      'If Team capacity falls below 30%, Upskill the current team becomes the likely leader.',
      'If Salary cost rises above $60,000, the leading option is likely to change.',
    ])
  })
})
