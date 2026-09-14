/**
 * The findings an independent review raised against the first cut of this
 * surface, turned into guards. Every case here FAILS on the code as it was, and
 * each names the defect it keeps out rather than the fix that closed it.
 *
 * ⭐ THE SHAPE THAT REPEATED FOUR TIMES ON ONE CHANGE, and the reason this file
 * exists: the two-statement separation was AUDITED WHERE IT HAD ALREADY BEEN
 * FOUND and SHIPPED WHERE IT HAD NOT — correct in the data, correct in the
 * movement sentence, wrong in the leader sentence, wrong in the container's
 * tone. A guard that greps prose cannot see a claim made by a CSS class.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { RunDelta } from '@talchain/schemas/boundary'
import { WhatsChanged, WHATS_CHANGED_TESTID } from '../sections/WhatsChanged'
import { buildRunDeltaView } from '../runDeltaView'

const LABELS: Record<string, string> = { opt_a: 'Raise the price', opt_b: 'Hold the price' }
const labelFor = (id: string): string | null => LABELS[id] ?? null

function delta(over: Partial<RunDelta> = {}): RunDelta {
  return {
    attribution_case: 'C1_attributable',
    pair_provenance: { seed_equal: true, hash_equal: false, builds_equal: 'equal', n_equal: true },
    leader: { changed: false, noise_verdict: 'signal', prior_leading_option_id: 'opt_a', current_leading_option_id: 'opt_a' },
    win_probabilities: [{ option_id: 'opt_a', prior: 0.6, current: 0.7, noise_verdict: 'signal' }],
    flip_thresholds: [],
    ...over,
  } as RunDelta
}
const view = (over: Partial<RunDelta> = {}) => buildRunDeltaView(delta(over), labelFor)

const ALL_CASES = ['C0_identical', 'C1_attributable', 'C2_unpaired', 'C3_engine_drift', 'C4_budget_drift'] as const

describe('⛔ BLOCKING — the leader line may not state a change the producer declined to qualify', () => {
  /**
   * CEE hardcodes `not_noise_qualified` at the leader's ONLY assignment
   * (`build-run-delta.ts:508`), with its own note that the state means "no
   * honest band exists for this quantity on this pair, rendered as direction
   * only". The line was gated on `changed` alone and never read the verdict, so
   * on 100% of emissions today the product asserted a leadership change as fact.
   */
  it('not_noise_qualified carries the qualifier beside the sentence', () => {
    render(<WhatsChanged view={view({
      leader: { changed: true, noise_verdict: 'not_noise_qualified', prior_leading_option_id: 'opt_a', current_leading_option_id: 'opt_b' },
    })} />)
    const el = screen.getByTestId(`${WHATS_CHANGED_TESTID}-highest-scoring`)
    expect(el).toHaveAttribute('data-noise-verdict', 'not_noise_qualified')
    expect(el.textContent).toMatch(/no basis for saying whether that is a real difference/i)
  })

  it('within_noise carries its own qualifier', () => {
    render(<WhatsChanged view={view({
      leader: { changed: true, noise_verdict: 'within_noise', prior_leading_option_id: 'opt_a', current_leading_option_id: 'opt_b' },
    })} />)
    expect(screen.getByTestId(`${WHATS_CHANGED_TESTID}-highest-scoring`).textContent)
      .toMatch(/run-to-run/i)
  })

  it('⭐ signal — and ONLY signal — reads as an unhedged statement', () => {
    render(<WhatsChanged view={view({
      leader: { changed: true, noise_verdict: 'signal', prior_leading_option_id: 'opt_a', current_leading_option_id: 'opt_b' },
    })} />)
    expect(screen.getByTestId(`${WHATS_CHANGED_TESTID}-highest-scoring`).textContent)
      .not.toMatch(/run-to-run|no basis/i)
  })

  it('⛔ the three verdicts must not collapse — two of them differ from signal AND from each other', () => {
    const read = (v: RunDelta['leader']['noise_verdict']): string => {
      const { unmount } = render(<WhatsChanged view={view({
        leader: { changed: true, noise_verdict: v, prior_leading_option_id: 'opt_a', current_leading_option_id: 'opt_b' },
      })} />)
      const t = screen.getByTestId(`${WHATS_CHANGED_TESTID}-highest-scoring`).textContent ?? ''
      unmount()
      return t
    }
    const [sig, within, unq] = [read('signal'), read('within_noise'), read('not_noise_qualified')]
    expect(new Set([sig, within, unq]).size).toBe(3)
  })
})

describe('⛔ BLOCKING — attribution may not set the tone of the box that encloses the movements', () => {
  /**
   * `panelSurfaces.ts` makes tone a claim: `neutral` = "No claim. The default
   * for a box that groups without judging.", `info` = "Worth stopping on." The
   * container was toned by `view.attributable`, so PART A was styling PART B —
   * `C2_unpaired` with three certified `signal` movements read "no claim", and
   * `C1_attributable` with an empty list read "worth stopping on".
   */
  it.each(ALL_CASES)('%s gets the SAME container tone', (c) => {
    const { unmount } = render(<WhatsChanged view={view({ attribution_case: c })} />)
    const cls = screen.getByTestId(WHATS_CHANGED_TESTID).className
    unmount()
    render(<WhatsChanged view={view({ attribution_case: 'C1_attributable' })} />)
    expect(cls).toBe(screen.getByTestId(WHATS_CHANGED_TESTID).className)
  })

  it('⛔ and the tone is not the attributable one either — the box judges neither statement', () => {
    render(<WhatsChanged view={view({ attribution_case: 'C2_unpaired' })} />)
    // `info` is the "worth stopping on" token; a grouping box must not carry it.
    expect(screen.getByTestId(WHATS_CHANGED_TESTID).className).not.toMatch(/border-info|bg-info/)
  })
})

describe('⛔ a partial movement list is not a complete one', () => {
  /**
   * The producer builds `win_probabilities` only from options it could match
   * across BOTH runs, so an option present in one is absent by construction.
   * "Unknown" was representable only at whole-array grain, so two rows out of
   * three looked exhaustive and said nothing about the third.
   */
  it('states the scope whenever any movement is listed', () => {
    render(<WhatsChanged view={view({
      win_probabilities: [
        { option_id: 'opt_a', prior: 0.6, current: 0.7, noise_verdict: 'signal' },
        { option_id: 'opt_b', prior: 0.4, current: 0.3, noise_verdict: 'signal' },
      ],
    })} />)
    expect(screen.getByTestId(`${WHATS_CHANGED_TESTID}-movement-scope`).textContent)
      .toMatch(/appear in both analyses/i)
  })

  it('and does NOT state it when there is no list to qualify', () => {
    render(<WhatsChanged view={view({ win_probabilities: [] })} />)
    expect(screen.queryByTestId(`${WHATS_CHANGED_TESTID}-movement-scope`)).toBeNull()
  })
})

describe('⛔ each comparability sentence belongs to ITS case', () => {
  /**
   * ⭐ THE ROTATION GUARD. Rotating the sentence map so every case carries a
   * NEIGHBOUR's sentence left the whole suite green — no assertion bound a
   * sentence to a case, so the five could be permuted freely. These bind by
   * content, and the last one fails on ANY permutation at all.
   */
  const MARKER: Record<(typeof ALL_CASES)[number], RegExp> = {
    C0_identical: /nothing about the model/i,
    C1_attributable: /only difference .* is a change to the model/i,
    C2_unpaired: /not worked out on a comparable basis/i,
    C3_engine_drift: /the way this analysis was worked out changed/i,
    C4_budget_drift: /different levels of precision/i,
  }

  it.each(ALL_CASES)('%s renders its own sentence', (c) => {
    render(<WhatsChanged view={view({ attribution_case: c })} />)
    expect(screen.getByTestId(`${WHATS_CHANGED_TESTID}-comparability`).textContent).toMatch(MARKER[c])
  })

  it('⭐ all five sentences are DISTINCT — a rotation cannot survive this', () => {
    const seen = ALL_CASES.map((c) => {
      const { unmount } = render(<WhatsChanged view={view({ attribution_case: c })} />)
      const t = (screen.getByTestId(`${WHATS_CHANGED_TESTID}-comparability`).textContent ?? '').trim()
      unmount()
      return t
    })
    expect(new Set(seen).size).toBe(ALL_CASES.length)
  })
})

describe('⭐ C1 WITH movement that did not move — the headline case, actually exercised', () => {
  /**
   * ⛔ THE OLD FIXTURE FOR THIS CASE WAS `win_probabilities: []`, which this
   * surface treats as "no option could be matched" — UNAVAILABLE, not
   * unmoved. So the test named for the headline case never exercised it.
   * A pair CAN be attributable and show no movement: the producer sends the
   * options with equal prior and current.
   */
  it('says the change was the only difference AND that the scores held level', () => {
    render(<WhatsChanged view={view({
      attribution_case: 'C1_attributable',
      win_probabilities: [{ option_id: 'opt_a', prior: 0.62, current: 0.62, noise_verdict: 'signal' }],
    })} />)
    expect(screen.getByTestId(`${WHATS_CHANGED_TESTID}-comparability`).textContent)
      .toMatch(/change to the model/i)
    expect(screen.queryByTestId(`${WHATS_CHANGED_TESTID}-no-pairs`)).toBeNull()
    const row = screen.getByTestId(`${WHATS_CHANGED_TESTID}-movement`)
    expect(row.textContent).toMatch(/62%/)
    // ⛔ and the surface still does not fuse the two: an attributable pair with
    // level scores must not be dressed as "your change did nothing".
    expect(row.textContent).not.toMatch(/no effect|did nothing|made no difference/i)
  })
})
