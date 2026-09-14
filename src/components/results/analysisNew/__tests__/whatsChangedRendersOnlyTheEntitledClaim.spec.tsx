/**
 * The rendered surface, not the view model.
 *
 * The view-model spec proves the DATA is right; this proves a person cannot READ
 * a claim off the screen that the producer never made. The two are different
 * failures: a correct model rendered into the wrong sentence is invisible to the
 * first spec.
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

describe('absence renders nothing at all', () => {
  it('a null view mounts no section', () => {
    const { container } = render(<WhatsChanged view={null} />)
    expect(container.innerHTML).toBe('')
    expect(screen.queryByTestId(WHATS_CHANGED_TESTID)).toBeNull()
  })
})

describe('only C1 reads as caused by the person', () => {
  it('C1 renders attributable and NO limit', () => {
    render(<WhatsChanged view={view()} />)
    expect(screen.getByTestId(WHATS_CHANGED_TESTID)).toHaveAttribute('data-attributable', 'true')
    expect(screen.queryByTestId(`${WHATS_CHANGED_TESTID}-attribution-limit`)).toBeNull()
  })

  it.each(['C0_identical', 'C2_unpaired', 'C3_engine_drift', 'C4_budget_drift'] as const)(
    '%s renders the limit and is not attributable', (c) => {
      render(<WhatsChanged view={view({ attribution_case: c })} />)
      expect(screen.getByTestId(WHATS_CHANGED_TESTID)).toHaveAttribute('data-attributable', 'false')
      expect(screen.getByTestId(`${WHATS_CHANGED_TESTID}-attribution-limit`).textContent)
        .toMatch(/cannot be put down to your change/i)
    })
})

describe('an unmatched pair is never rendered as stillness', () => {
  it('says no option could be matched — and does NOT say nothing moved', () => {
    render(<WhatsChanged view={view({ win_probabilities: [] })} />)
    const el = screen.getByTestId(`${WHATS_CHANGED_TESTID}-no-pairs`)
    expect(el.textContent).toMatch(/could be matched/i)
    expect(el.textContent).not.toMatch(/nothing (moved|changed)|no change|unchanged/i)
    expect(screen.queryByTestId(`${WHATS_CHANGED_TESTID}-movements`)).toBeNull()
  })
})

describe('the noise tag governs what the screen shows', () => {
  it('within_noise shows the numbers AND the qualifier', () => {
    render(<WhatsChanged view={view({
      win_probabilities: [{ option_id: 'opt_a', prior: 0.6, current: 0.7, noise_verdict: 'within_noise' }],
    })} />)
    const row = screen.getByTestId(`${WHATS_CHANGED_TESTID}-movement`)
    expect(row).toHaveAttribute('data-noise-verdict', 'within_noise')
    expect(row.textContent).toMatch(/60%/)
    expect(row.textContent).toMatch(/run-to-run/i)
  })

  it('⛔ not_noise_qualified WITHHOLDS the magnitude — direction only', () => {
    render(<WhatsChanged view={view({
      win_probabilities: [{ option_id: 'opt_a', prior: 0.2, current: 0.8, noise_verdict: 'not_noise_qualified' }],
    })} />)
    const row = screen.getByTestId(`${WHATS_CHANGED_TESTID}-movement`)
    expect(row.textContent).not.toMatch(/\d+%/)
    expect(row.textContent).toMatch(/scored higher/i)
    // the producer's own numbers stay auditable in the DOM without being spoken
    expect(row).toHaveAttribute('data-prior', '0.2')
  })

  it('signal shows the numbers with no hedge', () => {
    render(<WhatsChanged view={view()} />)
    const row = screen.getByTestId(`${WHATS_CHANGED_TESTID}-movement`)
    expect(row.textContent).toMatch(/60%/)
    expect(row.textContent).toMatch(/70%/)
    expect(row.textContent).not.toMatch(/run-to-run|no basis/i)
  })
})

describe('an absent id is never named', () => {
  it('says the top option changed WITHOUT naming either side', () => {
    render(<WhatsChanged view={view({
      leader: { changed: true, noise_verdict: 'signal', current_leading_option_id: 'opt_b' },
    })} />)
    const el = screen.getByTestId(`${WHATS_CHANGED_TESTID}-highest-scoring`)
    expect(el).toHaveAttribute('data-may-name', 'false')
    expect(el.textContent).not.toMatch(/Raise the price|Hold the price/)
    expect(el.textContent).toMatch(/not the same one as last time/i)
  })

  it('names both sides only when both ids arrived', () => {
    render(<WhatsChanged view={view({
      leader: { changed: true, noise_verdict: 'signal', prior_leading_option_id: 'opt_a', current_leading_option_id: 'opt_b' },
    })} />)
    const el = screen.getByTestId(`${WHATS_CHANGED_TESTID}-highest-scoring`)
    expect(el).toHaveAttribute('data-may-name', 'true')
    expect(el.textContent).toMatch(/Raise the price/)
    expect(el.textContent).toMatch(/Hold the price/)
  })

  it('an unchanged top option renders no line at all', () => {
    render(<WhatsChanged view={view()} />)
    expect(screen.queryByTestId(`${WHATS_CHANGED_TESTID}-highest-scoring`)).toBeNull()
  })
})
