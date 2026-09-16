/**
 * ⭐⭐ THREE SEPARATE BARS CANNOT SAY "THESE ARE SHARES OF ONE WHOLE".
 *
 * Comparative shares PARTITION the simulated runs — the fraction in which each
 * option out-ranked the others — and they sum to 1. A row of individual bars
 * shows each share's size and loses that. It also makes a TIE something the
 * reader must compare across rows: on the run witnessed tonight two options sat
 * at 48% and 48%, which side by side in one track reads instantly.
 *
 * ⛔ IT RENDERS ONLY WHERE THE SHARES ACTUALLY PARTITION. If any analysed option
 * carries no share, or they do not sum to one within tolerance, the picture
 * would assert a completeness the run does not have.
 *
 * ⛔ ONE COLOUR, DIVIDED BY GAPS. A graded or alternating fill reads as a
 * ranking, and #1593 is the ruling that a bar states magnitude and does not
 * grade the number.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { genuineDecision } from './analysisNewFixtures'
import { openAllSections } from './openNamedGroups'

const renderBody = (data: ResultsSectionDataReturn) => {
  const r = render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="shares_one_whole"
    />,
  )
  openAllSections()
  return r
}

/** `wins` is applied in producer order; `null` means the producer sent none. */
const withWins = (wins: ReadonlyArray<number | null>): ResultsSectionDataReturn => {
  const data = genuineDecision()
  const all = data.recommendation.allOptions ?? []
  expect(all.length, 'precondition: the fixture carries options').toBeGreaterThan(0)
  // Extend by cloning when a case needs more options than the fixture ships —
  // the three-option case below is the one that discriminates the
  // missing-share guard from the sum check.
  const base = wins.map((_, i) =>
    i < all.length
      ? all[i]
      : ({ ...all[0], id: `opt_extra_${i}`, label: `Extra option ${i}` } as (typeof all)[number]),
  )
  return {
    ...data,
    recommendation: {
      ...data.recommendation,
      allOptions: base.map((o, i) => {
        const w = wins[i]
        const { winProbability: _drop, ...rest } = o as typeof o & { winProbability?: number }
        return w === null ? rest : { ...rest, winProbability: w }
      }),
    },
  } as ResultsSectionDataReturn
}

const BAR = 'analysis-new-options-partition'
const segments = () => {
  const el = screen.queryByTestId(BAR)
  if (el === null) return null
  return [...(el.firstElementChild?.children ?? [])].map((c) => (c as HTMLElement).style.width)
}

afterEach(cleanup)

describe('the shares are one whole', () => {
  it('⭐ THEY PARTITION — one track, one segment per option, each its own share', () => {
    renderBody(withWins([0.31, 0.69]))
    expect(segments(), 'the segments are the shares, in producer order').toEqual(['31%', '69%'])
    expect(screen.getByTestId(`${BAR}-caption`).textContent).toContain('Every simulated scenario')
  })

  it('⭐ A TIE READS AS A TIE — the case the separate bars make you compare across rows', () => {
    renderBody(withWins([0.5, 0.5]))
    expect(segments()).toEqual(['50%', '50%'])
  })

  it('⛔ THEY DO NOT SUM TO ONE — nothing renders', () => {
    renderBody(withWins([0.3, 0.3]))
    expect(
      screen.queryByTestId(BAR),
      'a 0.6 sum drawn as a full track leaves two fifths of the runs silently unaccounted for',
    ).toBeNull()
  })

  it('⛔ AN OPTION WITH NO SHARE — nothing renders, because the set is incomplete', () => {
    renderBody(withWins([0.31, null]))
    expect(screen.queryByTestId(BAR)).toBeNull()
  })

  it('⛔⛔ THE DISCRIMINATOR — a missing share where the REST ALREADY SUM TO ONE', () => {
    /**
     * ⚠ THIS CASE EXISTS BECAUSE A MUTANT SURVIVED WITHOUT IT. Removing the
     * missing-share guard and coalescing to `?? 0` passed all six other tests:
     * on `[0.31, null]` the sum falls to 0.31 and the SUM CHECK catches it, so
     * the sum check was standing in for a guard that was never independently
     * exercised — a guard agreeing with its neighbour.
     *
     * Here the two analysed options already sum to 1 and a third carries no
     * share, which is the ordinary state `computeOptionScale`'s own header
     * describes: add an option after a run and it is in the list, unscored.
     * Coalescing would draw it as a measured zero inside a full track.
     */
    renderBody(withWins([0.31, 0.69, null]))
    expect(
      screen.queryByTestId(BAR),
      'an unscored option drawn as a measured zero is the fabrication this guard exists for',
    ).toBeNull()
  })

  it('⛔ TOLERANCE IS FOR ROUNDING, NOT FOR A SET THAT DOES NOT ADD UP', () => {
    // Within 0.01 — ordinary float error in a set the producer normalised.
    renderBody(withWins([0.305, 0.69]))
    expect(screen.queryByTestId(BAR), 'sums to 0.995 — inside tolerance').not.toBeNull()
    cleanup()
    // Outside it, and the difference is a real tenth of the runs.
    renderBody(withWins([0.21, 0.69]))
    expect(screen.queryByTestId(BAR), 'sums to 0.90 — outside tolerance').toBeNull()
  })

  it('⛔ ONE COLOUR — no graded or alternating fill, which would read as a ranking', () => {
    renderBody(withWins([0.31, 0.69]))
    const el = screen.getByTestId(BAR)
    const fills = [...(el.firstElementChild?.children ?? [])].map(
      (c) => (c as HTMLElement).className.split(' ').filter((k) => k.startsWith('bg-')).join(),
    )
    expect(new Set(fills).size, `segments must share one fill, got ${fills.join(' | ')}`).toBe(1)
  })
})
