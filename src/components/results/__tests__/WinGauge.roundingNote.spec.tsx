/**
 * ROADMAP 2.580 member 1 — the rounding note on the LIVE odds surface.
 *
 * Codex simulated-user review, 5 Aug 2026: "option percentages displayed as
 * 99% and 101% totals because of rounding, with no explanation".
 *
 * WHY THIS SURFACE (CLAUDE.md trap 3b — bind to what the deployed flags mount)
 * --------------------------------------------------------------------------
 * `WinGauge` renders the COMPLETE partition — its legend iterates every share
 * on the run — and `ResultsBody` mounts it unconditionally at the top of the
 * options section (`ResultsBody.tsx:591`). `OptionCards` beneath it truncates
 * to the top 2 behind a "Show all (N more)" toggle, so a total taken there
 * would routinely be a SUBSET total, which is not a rounding artefact and must
 * not be described as one. `CompactOptionSpread` is not on this route at all
 * (`ResultsBody.tsx:527-529` states so).
 *
 * ONE SOURCE OF TRUTH (trap 12/21)
 * --------------------------------
 * The note is derived from the very strings the legend prints — the component
 * builds `legendEntries` once and both the legend and the note read it. The
 * assertions below therefore compare the note's total against the SUM OF THE
 * RENDERED READOUTS, re-read from the DOM, rather than against a number this
 * spec computed for itself.
 *
 * RED-first: every assertion in this file fails at bc997f50.
 */

import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { WinGauge, type OptionWinShare } from '../WinGauge'
import { ODDS_ROUNDING_NOTE_TESTID } from '../utils/oddsRoundingNote'

/** Sum the percentages actually printed in the legend, by identity. */
function sumRenderedLegendPercents(): number {
  const block = screen.getByTestId('win-gauge-comparative-block')
  const printed = within(block)
    .getAllByText(/^\d+%$/)
    .map(el => Number(el.textContent!.replace('%', '')))
  return printed.reduce((a, b) => a + b, 0)
}

/** Three near-equal shares: each rounds to 33%, so the legend totals 99. */
function sharesTotalling99(): OptionWinShare[] {
  return [
    { id: 'a', label: 'Option A', winProbability: 0.334, isWinner: true, goalProbability: null },
    { id: 'b', label: 'Option B', winProbability: 0.333, isWinner: false, goalProbability: null },
    { id: 'c', label: 'Option C', winProbability: 0.333, isWinner: false, goalProbability: null },
  ]
}

/** Two shares at .335 and one at .330: 34 + 34 + 33 = 101. */
function sharesTotalling101(): OptionWinShare[] {
  return [
    { id: 'a', label: 'Option A', winProbability: 0.335, isWinner: true, goalProbability: null },
    { id: 'b', label: 'Option B', winProbability: 0.335, isWinner: false, goalProbability: null },
    { id: 'c', label: 'Option C', winProbability: 0.330, isWinner: false, goalProbability: null },
  ]
}

/** A clean partition — nothing to explain. */
function sharesTotalling100(): OptionWinShare[] {
  return [
    { id: 'a', label: 'Option A', winProbability: 0.65, isWinner: true, goalProbability: null },
    { id: 'b', label: 'Option B', winProbability: 0.35, isWinner: false, goalProbability: null },
  ]
}

describe('WinGauge — rounding note (ROADMAP 2.580 member 1)', () => {
  it('states the shortfall when the printed percentages total 99%', () => {
    render(<WinGauge shares={sharesTotalling99()} />)

    // Precondition pinned IN-TEST (trap 13b): the note is only meaningful if
    // the legend really does print a set that misses 100. Assert the defect
    // condition on the payload under test before asserting the remedy.
    expect(sumRenderedLegendPercents()).toBe(99)

    const note = screen.getByTestId(ODDS_ROUNDING_NOTE_TESTID)
    expect(note.textContent).toBe(
      'These are rounded to whole percentages, so they total 99%, not 100%.',
    )
  })

  it('states the overshoot when the printed percentages total 101%', () => {
    render(<WinGauge shares={sharesTotalling101()} />)

    expect(sumRenderedLegendPercents()).toBe(101)

    expect(screen.getByTestId(ODDS_ROUNDING_NOTE_TESTID).textContent).toBe(
      'These are rounded to whole percentages, so they total 101%, not 100%.',
    )
  })

  it('names the SAME total the legend prints — note and legend are one source', () => {
    render(<WinGauge shares={sharesTotalling99()} />)

    const rendered = sumRenderedLegendPercents()
    const note = screen.getByTestId(ODDS_ROUNDING_NOTE_TESTID).textContent!
    expect(note).toContain(`total ${rendered}%`)
  })

  it('renders NO note when the printed percentages already total 100%', () => {
    render(<WinGauge shares={sharesTotalling100()} />)

    expect(sumRenderedLegendPercents()).toBe(100)
    expect(screen.queryByTestId(ODDS_ROUNDING_NOTE_TESTID)).not.toBeInTheDocument()
  })

  it('renders no note for a single-option run (not a partition)', () => {
    render(
      <WinGauge
        shares={[{ id: 'a', label: 'Only', winProbability: 0.99, isWinner: true, goalProbability: null }]}
      />,
    )
    expect(screen.queryByTestId(ODDS_ROUNDING_NOTE_TESTID)).not.toBeInTheDocument()
  })

  it('FAILS CLOSED when any share prints as a sub-resolution bound', () => {
    // `< 1%` carries no derivable total, so the component must claim nothing
    // rather than state a sum that excludes an unknown quantity.
    render(
      <WinGauge
        shares={[
          { id: 'a', label: 'A', winProbability: 0.5, isWinner: true, goalProbability: null },
          { id: 'b', label: 'B', winProbability: 0.4949, isWinner: false, goalProbability: null },
          { id: 'c', label: 'C', winProbability: 0.0051, isWinner: false, goalProbability: null },
        ]}
      />,
    )
    const block = screen.getByTestId('win-gauge-comparative-block')
    expect(within(block).getByText(/^<\s?1%$/)).toBeInTheDocument()
    expect(screen.queryByTestId(ODDS_ROUNDING_NOTE_TESTID)).not.toBeInTheDocument()
  })

  it('lives inside the comparative block, beside the numbers it describes', () => {
    render(<WinGauge shares={sharesTotalling99()} />)
    const block = screen.getByTestId('win-gauge-comparative-block')
    expect(within(block).getByTestId(ODDS_ROUNDING_NOTE_TESTID)).toBeInTheDocument()
  })
})
