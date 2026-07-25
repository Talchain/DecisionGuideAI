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
  LEADER_GAP_THRESHOLD,
  LEADER_CLEAR_WIN_PROBABILITY,
  type DecisionVerdictReportLike,
  type LeaderSeparation,
} from '../decisionVerdict'

const twoOptions = (a: number, b: number, extra: Partial<DecisionVerdictReportLike> = {}): DecisionVerdictReportLike => ({
  option_probabilities: { opt_a: { win_probability: a }, opt_b: { win_probability: b } },
  robustness: { recommended_option_id: 'opt_a', ...(extra.robustness ?? {}) },
  ...(extra.decision_brief ? { decision_brief: extra.decision_brief } : {}),
})

describe('deriveDecisionVerdict — residual win-probability fallback', () => {
  it('the journey run (72% vs 20%) IS a leading option, despite being fragile — stability is not an input', () => {
    const v = deriveDecisionVerdict(twoOptions(0.72, 0.20))
    expect(v.separation).toBe('clear')
    expect(v.hasLeadingOption).toBe(true)
    expect(v.leaderId).toBe('opt_a')
    expect(v.gapPp).toBe(52)
    expect(v.source).toBe('win_probability')
  })

  it('a gap inside the producer threshold is TIED — no leading option', () => {
    const v = deriveDecisionVerdict(twoOptions(0.52, 0.48))
    expect(v.separation).toBe('tied')
    expect(v.hasLeadingOption).toBe(false)
  })

  it('a majority-but-not-dominant leader is SLIGHT — still a leading option', () => {
    const v = deriveDecisionVerdict(twoOptions(0.55, 0.30))
    expect(v.separation).toBe('slight')
    expect(v.hasLeadingOption).toBe(true)
  })

  it('is exactly bounded by the two exported thresholds', () => {
    // Just under / exactly at the gap boundary. The exact-boundary case is a
    // deliberate pin: 0.50 - 0.40 is 0.09999999999999998 in IEEE-754, so
    // without the epsilon a mathematically-exact 10-point gap would read as a
    // tie. This assertion is what makes that knife-edge visible.
    expect(deriveDecisionVerdict(twoOptions(0.50, 0.50 - LEADER_GAP_THRESHOLD + 0.001)).separation).toBe('tied')
    expect(deriveDecisionVerdict(twoOptions(0.50, 0.40)).separation).toBe('slight')
    // Just under / at the clear boundary.
    expect(deriveDecisionVerdict(twoOptions(LEADER_CLEAR_WIN_PROBABILITY - 0.01, 0.1)).separation).toBe('slight')
    expect(deriveDecisionVerdict(twoOptions(LEADER_CLEAR_WIN_PROBABILITY, 0.1)).separation).toBe('clear')
  })
})

describe('deriveDecisionVerdict — producer authority', () => {
  const nearTie = (isTie: boolean, top = 'opt_a') => ({
    robustness: { recommended_option_id: 'opt_a', near_tie: { is_tie: isTie, top_option_id: top, gap: 0.5, threshold: 0.1 } },
  })

  it("PLoT's near_tie OVERRIDES the win-probability fallback in the deny direction", () => {
    // Win probabilities alone would say 'clear' (52-point gap).
    const v = deriveDecisionVerdict(twoOptions(0.72, 0.20, nearTie(true)))
    expect(v.separation).toBe('tied')
    expect(v.hasLeadingOption).toBe(false)
    expect(v.source).toBe('producer_near_tie')
  })

  it("PLoT's near_tie OVERRIDES it in the assert direction too", () => {
    // Win probabilities alone would say 'tied' (4-point gap).
    const v = deriveDecisionVerdict(twoOptions(0.52, 0.48, nearTie(false)))
    expect(v.hasLeadingOption).toBe(true)
    expect(v.source).toBe('producer_near_tie')
  })

  it('IDENTITY GATE: a near_tie naming a different top option is not applied', () => {
    const v = deriveDecisionVerdict(twoOptions(0.72, 0.20, nearTie(true, 'opt_ghost')))
    expect(v.source).toBe('win_probability')
    expect(v.separation).toBe('clear')
  })

  it('FAIL-CLOSED: a malformed near_tie falls through rather than being guessed', () => {
    for (const bad of [{}, { is_tie: 'yes' }, null, 42, 'tied']) {
      const v = deriveDecisionVerdict(twoOptions(0.72, 0.20, { robustness: { near_tie: bad } as never }))
      expect(v.source).toBe('win_probability')
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
    const v = deriveDecisionVerdict({
      option_probabilities: { opt_a: { win_probability: 0.28 }, opt_b: { win_probability: 0.72 } },
      robustness: { recommended_option_id: 'opt_a' },
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
        robustness: { recommended_option_id: 'opt_a' },
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
    record(twoOptions(0.72, 0.20)) // clear
    record(twoOptions(0.55, 0.30)) // slight
    record(twoOptions(0.52, 0.48)) // tied
    record(null) // unknown
    expect([...seen].sort()).toEqual(['clear', 'slight', 'tied', 'unknown'])
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
