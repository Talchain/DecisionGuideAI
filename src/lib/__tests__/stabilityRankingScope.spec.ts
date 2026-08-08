/**
 * ROADMAP 2.580 member 3 — STABILITY COPY MUST CLAIM ONLY WHAT WAS TESTED.
 *
 * Codex simulated-user review, 5 Aug 2026: "'Stable result' / 'held up under
 * the changes we tested' appeared alongside 19 sensitive assumptions and zero
 * stable edges"; and, in its own list of places Olumi claims more than it
 * knows: "It called an analysis 'Stable' while displaying 19 sensitive
 * assumptions and zero stable edges; if only the leader survived sampled
 * perturbations, the label needs to say that."
 *
 * THE EXPECTATION IS DERIVED FROM THE PRODUCER, NOT FROM THE UI'S READING
 * ---------------------------------------------------------------------
 * CLAUDE.md trap 13c: a mutant kit measures whether a test can DETECT a
 * change, never whether the expectation is RIGHT — so the oracle comes from
 * the producer's declared semantics, read at ISL `staging`:
 *
 *   `RobustnessResultV2.recommendation_stability`
 *     — "P(same recommendation across samples)"
 *       (src/models/robustness_v2.py)
 *   `_build_robustness_interpretation`
 *     — "{most_frequent_winner} wins in {recommendation_stability:.0%} of
 *        sampled scenarios"
 *       (src/services/robustness_analyzer_v2.py)
 *
 * So the quantity is: THE SHARE OF SAMPLED SCENARIOS IN WHICH THE SAME OPTION
 * CAME OUT ON TOP. It is a statement about the RANKING, over a FINITE SAMPLE.
 *
 * The copy at bc997f50 said "Stable result" / "Result stays the same even if
 * estimates are off" — two over-claims stacked:
 *   (a) "the result" — every number, not just which option leads. The 19
 *       sensitive assumptions the reviewer saw are precisely the numbers that
 *       did NOT stay the same.
 *   (b) "even if estimates are off" — an unbounded universal over all possible
 *       estimate errors, from a finite sample of scenarios.
 *
 * WHAT THIS SPEC PINS
 * -------------------
 * Not one hard-coded sentence — that would pin today's wording and nothing
 * else. It pins the two PROPERTIES the member is about, at every tier:
 *   1. the claim is scoped to the RANKING / which option leads, and
 *   2. it does not assert an unbounded "whatever the estimates" guarantee.
 * A future copy edit that keeps both properties passes; one that reintroduces
 * either over-claim fails.
 *
 * RED-first: tiers `high` and `moderate` fail both properties at bc997f50.
 */

import { describe, it, expect } from 'vitest'
import { getStabilityClassification } from '../stability'

/** The four tier boundaries, one representative stability each. */
const TIERS = [
  { name: 'high', stability: 0.97 },
  { name: 'moderate', stability: 0.78 },
  { name: 'low', stability: 0.55 },
  { name: 'very_low', stability: 0.2 },
] as const

/**
 * Vocabulary that scopes a claim to the ranking rather than to "the result".
 * Any ONE of these is enough — this is a property check, not a copy pin.
 */
const RANKING_SCOPED = /\branking\b|which option leads|the same option led|the leading option/i

/**
 * Unbounded guarantees. Each asserts something about estimate error IN
 * GENERAL, which a finite sample of scenarios cannot establish.
 */
const UNBOUNDED_CLAIM = /even if estimates are off|whatever the estimates|regardless of (?:the )?(?:estimates|assumptions)|under any assumptions/i

/** "the result stays the same" — the (a) over-claim, in any tense. */
const RESULT_LEVEL_CLAIM = /\bresult (?:stays|stayed|remains|remained|is|was) the same\b/i

describe('stability copy is scoped to the RANKING (ROADMAP 2.580 member 3)', () => {
  it.each(TIERS)('$name — the hero label names the ranking, not "the result"', ({ stability }) => {
    const cls = getStabilityClassification(stability)!
    expect(cls.heroLabel).toMatch(RANKING_SCOPED)
  })

  it.each(TIERS)('$name — the expanded text is scoped to the ranking', ({ stability }) => {
    const cls = getStabilityClassification(stability)!
    expect(cls.heroExpandedText).toMatch(RANKING_SCOPED)
  })

  it.each(TIERS)('$name — no unbounded "even if estimates are off" guarantee anywhere', ({ stability }) => {
    const cls = getStabilityClassification(stability)!
    const prose = [cls.heroLabel, cls.heroShortText, cls.heroExpandedText, cls.coaching ?? ''].join(' | ')
    expect(prose).not.toMatch(UNBOUNDED_CLAIM)
  })

  it.each(TIERS)('$name — no "the result stays the same" claim anywhere', ({ stability }) => {
    const cls = getStabilityClassification(stability)!
    const prose = [cls.heroLabel, cls.heroShortText, cls.heroExpandedText, cls.coaching ?? ''].join(' | ')
    expect(prose).not.toMatch(RESULT_LEVEL_CLAIM)
  })

  it.each(TIERS)('$name — the expanded text says the finding came from a SAMPLE', ({ stability }) => {
    // The quantity is a share of sampled scenarios. Saying so is the whole
    // difference between "this held" and "this held in what we tried".
    const cls = getStabilityClassification(stability)!
    expect(cls.heroExpandedText).toMatch(/sampl/i)
  })

  it('the tiers stay DISTINGUISHABLE — a rewrite must not collapse them', () => {
    // Guards the lazy fix: renaming every tier to one ranking-scoped phrase
    // would satisfy every assertion above while destroying the signal.
    const labels = TIERS.map(t => getStabilityClassification(t.stability)!.heroLabel)
    expect(new Set(labels).size).toBe(TIERS.length)
  })

  it('the tier BOUNDARIES are untouched — this is a copy change, not a threshold change', () => {
    expect(getStabilityClassification(0.85)!.level).toBe('high')
    expect(getStabilityClassification(0.8499)!.level).toBe('moderate')
    expect(getStabilityClassification(0.70)!.level).toBe('moderate')
    expect(getStabilityClassification(0.6999)!.level).toBe('low')
    expect(getStabilityClassification(0.40)!.level).toBe('low')
    expect(getStabilityClassification(0.3999)!.level).toBe('very_low')
    expect(getStabilityClassification(null)).toBeNull()
    expect(getStabilityClassification(undefined)).toBeNull()
  })

  it('only the high tier withholds coaching — unchanged contract', () => {
    expect(getStabilityClassification(0.97)!.coaching).toBeNull()
    expect(getStabilityClassification(0.78)!.coaching).not.toBeNull()
    expect(getStabilityClassification(0.55)!.coaching).not.toBeNull()
    expect(getStabilityClassification(0.2)!.coaching).not.toBeNull()
  })
})
