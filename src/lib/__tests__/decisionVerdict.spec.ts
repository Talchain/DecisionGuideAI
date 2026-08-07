/**
 * deriveDecisionVerdict — the single owner of "is there a leading option?".
 *
 * Covers: producer precedence, the identity gate, the residual fallback, and
 * REACHABILITY of every branch (this estate has twice shipped branches whose
 * comments claimed they fired and which could not — see CLAUDE.md verification
 * traps 10 and 12).
 */

import { describe, it, expect } from 'vitest'
import {
  deriveDecisionVerdict,
  normalizeHeadlineBanded,
  type DecisionVerdictReportLike,
  type LeaderSeparation,
} from '../decisionVerdict'

const twoOptions = (a: number, b: number, extra: Partial<DecisionVerdictReportLike> = {}): DecisionVerdictReportLike => ({
  option_probabilities: { opt_a: { win_probability: a }, opt_b: { win_probability: b } },
  robustness: { recommended_option_id: 'opt_a', ...(extra.robustness ?? {}) },
  ...(extra.decision_brief ? { decision_brief: extra.decision_brief } : {}),
})

describe('deriveDecisionVerdict — NO producer signal means NO claim (ROADMAP 1.223)', () => {
  // This describe replaces the old "residual win-probability fallback" suite.
  // That fallback (gap >= 0.10 ⇒ a leader exists; top win >= 0.65 ⇒ 'clear')
  // is DELETED. CEE #711 made producer silence meaningful — on a withheld
  // constraint verdict it drops `headline_banded` and nulls
  // `leading_option_id` while the win probabilities keep riding the wire — so
  // a consumer-side fallback reading those numbers did not degrade
  // gracefully, it OVERWROTE the withheld message.

  it('the journey run (72% vs 20%) yields NO leading option without a producer signal', () => {
    const v = deriveDecisionVerdict(twoOptions(0.72, 0.20))
    // A 52-point gap is not the UI's to interpret. It used to return
    // separation 'clear' / source 'win_probability'.
    expect(v.separation).toBe('unknown')
    expect(v.hasLeadingOption).toBe(false)
    expect(v.source).toBe('none')
    // Identity and the measured gap survive — only the ENTITLEMENT is withheld.
    expect(v.leaderId).toBe('opt_a')
    expect(v.gapPp).toBe(52)
  })

  it('no gap is large enough to manufacture a claim', () => {
    for (const [a, b] of [[0.99, 0.01], [0.55, 0.30], [0.52, 0.48]] as const) {
      const v = deriveDecisionVerdict(twoOptions(a, b))
      expect(v.hasLeadingOption, `${a} vs ${b}`).toBe(false)
      expect(v.separation, `${a} vs ${b}`).toBe('unknown')
    }
  })

  it("fails toward SILENCE, never toward a denial", () => {
    // 'unknown' licenses no claim in either direction. 'tied' would license
    // "no clear leading option" — a second claim the UI equally lacks the
    // authority to make, and one that would be actively false on a withheld
    // turn (the options may be far apart; the verdict was simply not issued).
    expect(deriveDecisionVerdict(twoOptions(0.52, 0.48)).separation).not.toBe('tied')
  })
})

describe('deriveDecisionVerdict — producer authority', () => {
  const nearTie = (isTie: boolean, top = 'opt_a') => ({
    robustness: { recommended_option_id: 'opt_a', near_tie: { is_tie: isTie, top_option_id: top, gap: 0.5, threshold: 0.1 } },
  })

  it("PLoT's near_tie DENIES a leader that the raw gap would have suggested", () => {
    // A 52-point gap; the producer says it is a tie, and the producer decides.
    const v = deriveDecisionVerdict(twoOptions(0.72, 0.20, nearTie(true)))
    expect(v.separation).toBe('tied')
    expect(v.hasLeadingOption).toBe(false)
    expect(v.source).toBe('producer_near_tie')
  })

  it("PLoT's near_tie ASSERTS a leader that the raw gap would not have supported", () => {
    // A 4-point gap; the producer says there is a leader, and the producer
    // decides. This is the positive control for the assert direction: the
    // deletion of the UI fallback must not cost us a producer-owned claim.
    const v = deriveDecisionVerdict(twoOptions(0.52, 0.48, nearTie(false)))
    expect(v.hasLeadingOption).toBe(true)
    expect(v.source).toBe('producer_near_tie')
  })

  it('IDENTITY GATE: a near_tie naming a different top option is not applied — and nothing replaces it', () => {
    // A producer claim about option X is never re-pointed at option Y. With
    // the signal inapplicable there is now no second authority to fall back
    // to, so the verdict withholds rather than deriving 'clear' from the gap.
    const v = deriveDecisionVerdict(twoOptions(0.72, 0.20, nearTie(true, 'opt_ghost')))
    expect(v.source).toBe('none')
    expect(v.separation).toBe('unknown')
    expect(v.hasLeadingOption).toBe(false)
  })

  it('FAIL-CLOSED: a malformed near_tie yields no claim rather than being guessed', () => {
    for (const bad of [{}, { is_tie: 'yes' }, null, 42, 'tied']) {
      const v = deriveDecisionVerdict(twoOptions(0.72, 0.20, { robustness: { near_tie: bad } as never }))
      expect(v.source).toBe('none')
      expect(v.hasLeadingOption).toBe(false)
    }
  })

  it('headline_banded refines how far ahead when near_tie is absent', () => {
    const cases: Array<[string, LeaderSeparation]> = [
      ['clearly_ahead', 'clear'],
      ['slightly_ahead', 'slight'],
      ['very_close', 'tied'],
    ]
    for (const [band, expected] of cases) {
      const v = deriveDecisionVerdict(
        twoOptions(0.55, 0.30, { decision_brief: { headline_banded: { band, leader_option_id: 'opt_a' } } }),
      )
      expect(v.separation, band).toBe(expected)
      expect(v.source).toBe('producer_band')
    }
  })

  it("a band of very_close cannot overturn near_tie's explicit not-a-tie", () => {
    const v = deriveDecisionVerdict(
      twoOptions(0.55, 0.30, {
        robustness: { recommended_option_id: 'opt_a', near_tie: { is_tie: false, top_option_id: 'opt_a' } } as never,
        decision_brief: { headline_banded: { band: 'very_close', leader_option_id: 'opt_a' } },
      }),
    )
    expect(v.separation).toBe('slight')
    expect(v.hasLeadingOption).toBe(true)
  })
})

describe('deriveDecisionVerdict — identity is separate from entitlement', () => {
  it('names the PRODUCER recommendation even when it is not the win-max, and still grades the field', () => {
    // PLoT recommended opt_a at 28% while opt_b holds 72%. Separation is a
    // property of the field (44 points apart), not a leader-minus-rival
    // subtraction that would go negative and read as a tie.
    // The near_tie names opt_b — the win-probability RANK-1 option — because
    // that is what the producer's signal describes; the recommendation still
    // decides IDENTITY. Keeping the two apart is the point of this test.
    const v = deriveDecisionVerdict({
      option_probabilities: { opt_a: { win_probability: 0.28 }, opt_b: { win_probability: 0.72 } },
      robustness: {
        recommended_option_id: 'opt_a',
        near_tie: { is_tie: false, top_option_id: 'opt_b' },
      },
    })
    expect(v.leaderId).toBe('opt_a')
    expect(v.gapPp).toBe(44)
    expect(v.hasLeadingOption).toBe(true)
  })

  it('falls back to the argmax when the producer sent no recommendation', () => {
    const v = deriveDecisionVerdict({
      option_probabilities: { opt_a: { win_probability: 0.28 }, opt_b: { win_probability: 0.72 } },
    })
    expect(v.leaderId).toBe('opt_b')
  })

  it('ignores options no longer on the canvas (recovered-session identity mismatch)', () => {
    const v = deriveDecisionVerdict(
      {
        option_probabilities: {
          opt_a: { win_probability: 0.40 },
          opt_b: { win_probability: 0.35 },
          opt_ghost: { win_probability: 0.90 },
        },
        robustness: {
          recommended_option_id: 'opt_a',
          // Names opt_a, the argmax AMONG VISIBLE OPTIONS — the visibility
          // filter is applied before rank-1 is taken, which is the behaviour
          // this test exists to pin. opt_ghost's 0.90 must not participate.
          near_tie: { is_tie: true, top_option_id: 'opt_a' },
        },
      },
      { visibleOptionIds: new Set(['opt_a', 'opt_b']) },
    )
    expect(v.leaderId).toBe('opt_a')
    expect(v.gapPp).toBe(5)
    expect(v.separation).toBe('tied')
  })
})

describe("REACHABILITY — every branch can actually fire (traps 10 & 12)", () => {
  const seen = new Set<LeaderSeparation>()
  const record = (r: DecisionVerdictReportLike | null) => {
    seen.add(deriveDecisionVerdict(r).separation)
  }

  it("'unknown' fires on a single-option run — the results panel has copy for exactly this case", () => {
    const v = deriveDecisionVerdict({ option_probabilities: { opt_a: { win_probability: 1 } } })
    expect(v.separation).toBe('unknown')
    expect(v.hasLeadingOption).toBe(false)
    expect(v.leaderId).toBeNull()
  })

  it("'unknown' fires when the producer omits win probabilities (degraded run)", () => {
    const v = deriveDecisionVerdict({
      option_probabilities: { opt_a: {}, opt_b: { win_probability: null } },
      robustness: { recommended_option_id: 'opt_a' },
    })
    expect(v.separation).toBe('unknown')
  })

  it("'unknown' fires on a null / absent report (pre-analysis)", () => {
    expect(deriveDecisionVerdict(null).separation).toBe('unknown')
    expect(deriveDecisionVerdict(undefined).separation).toBe('unknown')
  })

  it('all four separations are reachable from realistic reports', () => {
    // Every non-'unknown' separation is now reachable ONLY through a producer
    // signal — which is the contract. The corollary matters as much as the
    // test: if this ever goes red because 'clear'/'slight'/'tied' became
    // unreachable, the UI has stopped being able to render a claim the
    // producer DID make (over-suppression), which is the opposite failure and
    // just as bad.
    const band = (b: string) => ({ decision_brief: { headline_banded: { band: b, leader_option_id: 'opt_a' } } })
    record(twoOptions(0.72, 0.20, band('clearly_ahead'))) // clear
    record(twoOptions(0.55, 0.30, band('slightly_ahead'))) // slight
    record(twoOptions(0.52, 0.48, band('very_close'))) // tied
    record(null) // unknown
    expect([...seen].sort()).toEqual(['clear', 'slight', 'tied', 'unknown'])
  })

  it("'unknown' is what an absent producer claim yields — the withheld-turn path", () => {
    // The branch ROADMAP 1.223 added. Distinct from the three above: a full,
    // healthy, two-option report with a large gap and no producer claim.
    const v = deriveDecisionVerdict(twoOptions(0.72, 0.20))
    expect(v.separation).toBe('unknown')
    expect(v.source).toBe('none')
  })

  it('is total — never throws on hostile input', () => {
    const hostile: unknown[] = [
      {}, { option_probabilities: null }, { option_probabilities: { a: null } },
      { option_probabilities: { a: { win_probability: NaN }, b: { win_probability: Infinity } } },
      { robustness: null }, { robustness: { recommended_option_id: null } },
    ]
    for (const h of hostile) {
      expect(() => deriveDecisionVerdict(h as DecisionVerdictReportLike)).not.toThrow()
    }
  })
})

describe('normalizeHeadlineBanded — moved here from components/results/types.ts', () => {
  it('still behaves identically after the move (the existing spec at its old import path is the other half of this proof)', () => {
    expect(normalizeHeadlineBanded({ band: 'clearly_ahead', leader_option_id: 'x', robustness_gated: true }))
      .toEqual({ band: 'clearly_ahead', leaderOptionId: 'x', robustnessGated: true })
    expect(normalizeHeadlineBanded({ band: 'dominant', leader_option_id: 'x' })).toBeNull()
    expect(normalizeHeadlineBanded({ band: 'clearly_ahead', leader_option_id: '' })).toBeNull()
    expect(normalizeHeadlineBanded(null)).toBeNull()
  })
})
