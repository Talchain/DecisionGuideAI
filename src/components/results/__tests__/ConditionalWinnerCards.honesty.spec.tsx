/**
 * ConditionalWinnerCards — producer-attestation honesty (V6 Science-to-Reasoning slice).
 *
 * The card binds to the PRODUCER's claims, never to display-label comparison:
 *   - a scenario is a row the producer ATTESTED with `winner_flips: true`
 *     (label inequality is trap 19 — two options can share a label, and a
 *     label churn is not a flip);
 *   - direction binds to `winner_id` vs `recommendedOptionId` by IDENTITY;
 *   - identity-stripped rows (CEE's withheld-claim projection) render the
 *     NEUTRAL two-sided arm — factor + threshold, no option name — instead
 *     of silently vanishing (the over-suppression CEE shipped bytes to avoid);
 *   - absent numerics render as absent. No `?? 0`, no minted percentages.
 *
 * Withheld fixture: GENERATED from the full producer row by applying CEE's
 * published projection rule (strip exactly WITHHELD_DROPPED_CONDITIONAL_BUCKET_MEMBERS
 * per bucket — olumi-assistants-service
 * `src/orchestrator-v5/compose/withheld-claim-projection.ts:452,914-937` @ fa8bacc5),
 * never hand-written member by member. Preconditions are pinned in-test.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConditionalWinnerCards } from '../ConditionalWinnerCards'
import type { ConditionalWinner } from '../types'

/**
 * Mirror of CEE's exported WITHHELD_DROPPED_CONDITIONAL_BUCKET_MEMBERS
 * (withheld-claim-projection.ts:452 @ fa8bacc5). The fixture below is derived
 * from the full row by this rule, so the withheld shape under test is the
 * projection's published output shape, not a hand-authored guess.
 */
const WITHHELD_DROPPED_CONDITIONAL_BUCKET_MEMBERS = [
  'winner_id',
  'winner_label',
  'runner_up_id',
  'runner_up_label',
] as const

function projectRowForWithheldClaim(row: ConditionalWinner): ConditionalWinner {
  const strip = (bucket: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(bucket)) {
      if ((WITHHELD_DROPPED_CONDITIONAL_BUCKET_MEMBERS as readonly string[]).includes(k)) continue
      out[k] = v
    }
    return out
  }
  return {
    ...row,
    high_bucket: strip(row.high_bucket as unknown as Record<string, unknown>),
    low_bucket: strip(row.low_bucket as unknown as Record<string, unknown>),
  } as ConditionalWinner
}

const fullRow = (overrides: Partial<ConditionalWinner> = {}): ConditionalWinner => ({
  factor_label: 'Market growth',
  factor_id: 'fac_growth',
  split_value: 42.5,
  split_unit: '%',
  winner_flips: true,
  high_bucket: {
    winner_id: 'opt_expand',
    winner_label: 'Expand into Europe',
    runner_up_id: 'opt_hold',
    runner_up_label: 'Hold position',
    win_probability: 0.7,
  },
  low_bucket: {
    winner_id: 'opt_hold',
    winner_label: 'Hold position',
    runner_up_id: 'opt_expand',
    runner_up_label: 'Expand into Europe',
    win_probability: 0.6,
  },
  ...overrides,
})

describe('ConditionalWinnerCards — attestation binding (winner_flips, not labels)', () => {
  it('renders a same-label flip: identical display labels, producer attests winner_flips', () => {
    // Two DIFFERENT options that share one display label — a label-inequality
    // filter is structurally blind to this row (trap 19).
    const row = fullRow({
      high_bucket: { winner_id: 'opt_b', winner_label: 'Rebrand', win_probability: 0.7 },
      low_bucket: { winner_id: 'opt_a', winner_label: 'Rebrand', win_probability: 0.6 },
    })
    // Precondition pin: the labels REALLY are identical and the attestation
    // REALLY is present — the render below is the code's doing, not the fixture's.
    expect(row.high_bucket.winner_label).toBe(row.low_bucket.winner_label)
    expect(row.high_bucket.winner_id).not.toBe(row.low_bucket.winner_id)
    expect(row.winner_flips).toBe(true)

    render(<ConditionalWinnerCards winners={[row]} recommendedOptionId="opt_a" />)
    const body = screen.getByTestId('conditional-winner-cards')
    expect(body.textContent).toMatch(/Market growth/)
    expect(body.textContent).toMatch(/42\.5/)
  })

  it('renders exactly the attested rows from a mixed array: label churn without winner_flips is not a scenario', () => {
    // One genuine attested flip + one label-churn row the producer says did
    // NOT flip (same winner_id both sides, cosmetically different labels).
    const flip = fullRow({ factor_label: 'Demand', factor_id: 'fac_demand' })
    const churn = fullRow({
      factor_label: 'Churn factor',
      factor_id: 'fac_churn',
      winner_flips: false,
      high_bucket: { winner_id: 'opt_expand', winner_label: 'Expand into Europe', win_probability: 0.7 },
      low_bucket: { winner_id: 'opt_expand', winner_label: 'European expansion', win_probability: 0.65 },
    })
    // Precondition pin: the churn row's labels differ (a label filter WOULD
    // render it) while its identity does not.
    expect(churn.high_bucket.winner_label).not.toBe(churn.low_bucket.winner_label)
    expect(churn.high_bucket.winner_id).toBe(churn.low_bucket.winner_id)
    expect(churn.winner_flips).toBe(false)

    render(<ConditionalWinnerCards winners={[flip, churn]} recommendedOptionId="opt_hold" />)
    const body = screen.getByTestId('conditional-winner-cards')
    // Exactly the attested factor renders; the churn factor does not.
    expect(body.textContent).toMatch(/Demand/)
    expect(body.textContent).not.toMatch(/Churn factor/)
  })

  it('renders nothing when no row carries the winner_flips attestation', () => {
    const rows = [
      fullRow({ winner_flips: false }),
      fullRow({ winner_flips: undefined }),
    ]
    const { container } = render(
      <ConditionalWinnerCards winners={rows} recommendedOptionId="opt_hold" />,
    )
    expect(container.querySelector('[data-testid="conditional-winner-cards"]')).toBeNull()
  })
})

describe('ConditionalWinnerCards — withheld/neutral arm (CEE projection shape)', () => {
  it('renders the neutral two-sided line for identity-stripped rows: factor + threshold, no option name', () => {
    const projected = projectRowForWithheldClaim(fullRow())
    // Precondition pins (assert the SHAPE before asserting the render —
    // the fixture must actually be the withheld projection's output):
    for (const bucket of [projected.high_bucket, projected.low_bucket] as unknown as Record<string, unknown>[]) {
      for (const member of WITHHELD_DROPPED_CONDITIONAL_BUCKET_MEMBERS) {
        expect(member in bucket).toBe(false)
      }
      expect(bucket.win_probability).toBeDefined()
    }
    expect(projected.winner_flips).toBe(true)

    render(<ConditionalWinnerCards winners={[projected]} recommendedOptionId="opt_expand" />)
    const body = screen.getByTestId('conditional-winner-cards')
    // Neutral claim: names the factor and the threshold…
    expect(body.textContent).toMatch(/Which option leads depends on/)
    expect(body.textContent).toMatch(/Market growth/)
    expect(body.textContent).toMatch(/42\.5%/)
    // …and licensed anonymous probabilities…
    expect(body.textContent).toMatch(/Above: 70%/)
    expect(body.textContent).toMatch(/Below: 60%/)
    // …but NO option identity anywhere (the pre-projection fixture carries
    // both names, so this assertion discriminates).
    expect(body.textContent).not.toMatch(/Expand into Europe/)
    expect(body.textContent).not.toMatch(/Hold position/)
    // And no directional claim — direction is a claim about the withheld leader.
    expect(body.textContent).not.toMatch(/leads instead/)
  })

  it('uses the neutral arm, never a guess, when recommendedOptionId matches neither bucket', () => {
    render(<ConditionalWinnerCards winners={[fullRow()]} recommendedOptionId="opt_unrelated" />)
    const body = screen.getByTestId('conditional-winner-cards')
    expect(body.textContent).toMatch(/Which option leads depends on/)
    expect(body.textContent).not.toMatch(/exceeds/)
    expect(body.textContent).not.toMatch(/falls below/)
    expect(body.textContent).not.toMatch(/leads instead/)
  })

  it('uses the neutral arm, never a guess, when recommendedOptionId is absent', () => {
    render(<ConditionalWinnerCards winners={[fullRow()]} />)
    const body = screen.getByTestId('conditional-winner-cards')
    expect(body.textContent).toMatch(/Which option leads depends on/)
    expect(body.textContent).not.toMatch(/exceeds/)
    expect(body.textContent).not.toMatch(/falls below/)
  })
})

describe('ConditionalWinnerCards — honest absence (no minted numbers)', () => {
  it('drops a row with a non-finite split_value; a producer-sent 0 survives (positive control)', () => {
    const bad = fullRow({ factor_label: 'Broken factor', factor_id: 'fac_bad', split_value: Number.NaN })
    const zero = fullRow({ factor_label: 'Zero-threshold factor', factor_id: 'fac_zero', split_value: 0 })
    render(<ConditionalWinnerCards winners={[bad, zero]} recommendedOptionId="opt_hold" />)
    const body = screen.getByTestId('conditional-winner-cards')
    expect(body.textContent).not.toMatch(/Broken factor/)
    expect(body.textContent).not.toMatch(/NaN/)
    // Positive control: 0 is a real threshold, not an absence.
    expect(body.textContent).toMatch(/Zero-threshold factor/)
    expect(body.textContent).toMatch(/0%/) // split 0 with '%' unit renders
  })

  it('omits the percentage when win_probability is absent — never renders a minted 0%', () => {
    // The 15 real persisted staging rows (Apr–Jun 2026) carry identity and
    // winner_flips but NO win_probability — the pre-0.44 wire shape. They must
    // render their scenario without inventing "(0%)".
    const historic = fullRow({
      split_unit: undefined,
      high_bucket: { winner_id: 'opt_expand', winner_label: 'Expand into Europe' },
      low_bucket: { winner_id: 'opt_hold', winner_label: 'Hold position' },
    })
    expect('win_probability' in (historic.high_bucket as object)).toBe(false)

    render(<ConditionalWinnerCards winners={[historic]} recommendedOptionId="opt_hold" />)
    const body = screen.getByTestId('conditional-winner-cards')
    // The scenario renders with its labels…
    expect(body.textContent).toMatch(/Expand into Europe/)
    // …and no percentage is fabricated anywhere.
    expect(body.textContent).not.toMatch(/0%/)
    expect(body.textContent).not.toMatch(/%\)/)
  })

  it('renders a producer-sent win_probability of 0 (positive control for absence handling)', () => {
    const row = fullRow({
      high_bucket: { winner_id: 'opt_expand', winner_label: 'Expand into Europe', win_probability: 0 },
      low_bucket: { winner_id: 'opt_hold', winner_label: 'Hold position', win_probability: 1 },
    })
    render(<ConditionalWinnerCards winners={[row]} recommendedOptionId="opt_hold" />)
    const body = screen.getByTestId('conditional-winner-cards')
    expect(body.textContent).toMatch(/\(0%\)/)
    expect(body.textContent).toMatch(/\(100%\)/)
  })
})

describe('ConditionalWinnerCards — direction binds by identity (trap 19 discriminating fixture)', () => {
  // Both options share the SAME display label, so any label-based direction
  // predicate cannot distinguish them; only winner_id can.
  const sameLabelRow = (): ConditionalWinner =>
    fullRow({
      high_bucket: { winner_id: 'opt_b', winner_label: 'Expand', win_probability: 0.7 },
      low_bucket: { winner_id: 'opt_a', winner_label: 'Expand', win_probability: 0.6 },
    })

  it('recommended id in the LOW bucket → flip on the HIGH side ("exceeds")', () => {
    render(<ConditionalWinnerCards winners={[sameLabelRow()]} recommendedOptionId="opt_a" />)
    const body = screen.getByTestId('conditional-winner-cards')
    expect(body.textContent).toMatch(/exceeds/)
    expect(body.textContent).not.toMatch(/falls below/)
  })

  it('recommended id in the HIGH bucket → flip on the LOW side ("falls below")', () => {
    render(<ConditionalWinnerCards winners={[sameLabelRow()]} recommendedOptionId="opt_b" />)
    const body = screen.getByTestId('conditional-winner-cards')
    expect(body.textContent).toMatch(/falls below/)
    expect(body.textContent).not.toMatch(/exceeds/)
  })
})
