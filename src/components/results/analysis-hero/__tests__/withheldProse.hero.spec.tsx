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
// Cut 6: "the most-supported option" presupposes one exists exactly as "the leading option" did, so it is hunted too.
const LEADER_PRESUPPOSITION_RE = /leading option|likely leader|the leader\b|most-supported option/i

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
        // ⭐ THE COMPOSED ANSWER, PUBLISHED BESIDE THE VERDICT — the shape
        // `useResultsSectionData` emits. A fixture carrying a verdict and no
        // composed answer is one `leaderDesignationPermitted` may only WITHHOLD
        // on, which would make the PERMITTED half of this pair withheld and the
        // positive control (`the PERMITTED wording contains the presupposition
        // the matcher hunts`) vacuous.
        //
        // Q1 is absent here and therefore permitting, so the conjunction is the
        // verdict's own answer; the MODEL-refuses dimension lives in
        // `admissionGatesHeroCrown.spec.ts`.
        leaderDesignationPermitted: verdict?.hasLeadingOption,
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

  it('the matcher catches the PERMITTED wording served before; the permitted run no longer carries it', () => {
    // Positive control for LEADER_PRESUPPOSITION_RE itself: if this stops
    // matching, the withheld assertions below are vacuous.
    // Run-4 judge (DL 12 Oct, the class): the permitted "… becomes the most-supported option" / "… the most-supported
    // option changes" / "… changes the most-supported option" wording is removed; nothing replaces it. The control is
    // rebound to those strings as served before, and the permitted run is now asserted to carry none of them.
    for (const before of [
      'If ‘Team capacity’ falls below about 30%, ‘Upskill the current team’ becomes the most-supported option, in this model.',
      'If ‘Salary cost’ rises above about $60,000, the most-supported option changes, in this model.',
      'Share of runs in which varying a relationship within its plausible range changes the most-supported option, in this model.',
    ]) expect(before).toMatch(LEADER_PRESUPPOSITION_RE)
    expect(flipTexts(PERMITTED_VERDICT).join(' ')).not.toMatch(LEADER_PRESUPPOSITION_RE)
    expect(HERO_COPY.evidence.flipRisksNote).not.toMatch(LEADER_PRESUPPOSITION_RE)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SURFACE 2 — heroCopy.evidence, as pure copy
// ─────────────────────────────────────────────────────────────────────────────

describe('heroCopy.evidence — the three flip-risk strings', () => {
  // Run-4 judge (DL 12 Oct, the class): `flipRisksNote` is one string and the two sentence templates lost their
  // `designationsWithheld` argument — every run takes the wording a withheld run had.
  it('WITHHELD: the view note presupposes no leader', () => {
    expect(HERO_COPY.evidence.flipRisksNote).not.toMatch(LEADER_PRESUPPOSITION_RE)
  })

  it('WITHHELD: neither sentence template presupposes a leader', () => {
    expect(
      HERO_COPY.evidence.flipRiskWithAlternative('Team capacity', 'falls below', '30%', 'Upskill'),
    ).not.toMatch(LEADER_PRESUPPOSITION_RE)
    expect(
      HERO_COPY.evidence.flipRiskNoAlternative('Salary cost', 'rises above', '$60,000'),
    ).not.toMatch(LEADER_PRESUPPOSITION_RE)
  })

  it('WITHHELD: the producer alternative-winner label SURVIVES (no over-suppression)', () => {
    expect(
      HERO_COPY.evidence.flipRiskWithAlternative('Team capacity', 'falls below', '30%', 'Upskill'),
    ).toContain('Upskill')
  })

  /**
   * PERMITTED is byte-identical to the strings that shipped before this
   * change. Written out in full rather than compared to a helper: a helper
   * would have to restate the string anyway, and a literal is the only form
   * that catches a one-word drift.
   */
  it('PERMITTED: every string is the one wording every run now takes, byte for byte', () => {
    // Run-4 judge (DL 12 Oct, the class): the permitted "most-supported option" arms are removed; nothing replaces
    // them. A permitted run now gets the withheld run's words, pinned as literals.
    expect(HERO_COPY.evidence.flipRisksNote).toBe(
      'Share of runs in which varying a relationship within its plausible range changes how the options compare, in this model.',
    )
    expect(
      HERO_COPY.evidence.flipRiskWithAlternative('Team capacity', 'falls below', '30%', 'Upskill'),
    ).toBe('If ‘Team capacity’ falls below about 30%, the comparison shifts towards ‘Upskill’, in this model.')
    expect(
      HERO_COPY.evidence.flipRiskNoAlternative('Salary cost', 'rises above', '$60,000'),
    ).toBe('If ‘Salary cost’ rises above about $60,000, the comparison changes, in this model.')
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

  it('PERMITTED: the built sentences are the withheld wording, byte for byte', () => {
    // Run-4 judge (DL 12 Oct, the class): "… becomes the most-supported option" / "… the most-supported option changes"
    // are removed; nothing replaces them. The permitted run builds the same sentences as the withheld one.
    expect(flipTexts(PERMITTED_VERDICT)).toEqual([
      'If ‘Team capacity’ falls below about 30%, the comparison shifts towards ‘Upskill the current team’, in this model.',
      'If ‘Salary cost’ rises above about $60,000, the comparison changes, in this model.',
    ])
    expect(flipTexts(PERMITTED_VERDICT)).toEqual(flipTexts(WITHHELD_VERDICT))
  })
})
