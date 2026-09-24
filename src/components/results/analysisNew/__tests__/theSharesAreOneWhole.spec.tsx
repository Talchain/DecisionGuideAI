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
 *
 * ⛔⛔ V2 (24 Sep 2026): THE PARTITION IS NO LONGER DRAWN ON THIS SECTION.
 * Paul's staging test read the shares (81 / 17 / 2) as a ranking, and the V2
 * comparison drops every win-share presentation from the resting view: the
 * per-row bar, its readout, and this track. The shares stay on the view model
 * for "About this analysis". This file now pins the REMOVAL, on the runs where
 * the track used to draw, with the view model's shares as the precondition so
 * the absence is the section's doing and not a fixture that could not
 * partition. The sum-tolerance and missing-share guards went with the code
 * they guarded (git history keeps both, should a partition return elsewhere).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
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

describe('the shares are one whole — and V2 no longer draws them here', () => {
  /** The shares the view model carries, by option id, for the precondition. */
  const vmShares = (data: ResultsSectionDataReturn) =>
    buildAnalysisNewViewModel({
      data,
      recommendations: [],
      isPreRun: false,
      isRunning: false,
      isStale: false,
    }).optionsComparison.rows.flatMap((r) => (r.kind === 'analysed' ? [r.winFraction] : []))

  it.each([
    ['an exact partition', [0.31, 0.69]],
    ['a tie', [0.5, 0.5]],
    ['a partition inside the rounding tolerance', [0.305, 0.69]],
  ] as const)('⛔ %s draws NO partition track and NO caption at rest', (_name, wins) => {
    const data = withWins(wins)
    // PRECONDITION: these are the runs on which the track used to draw.
    const shares = vmShares(data)
    expect(shares, 'PRECONDITION: every analysed option carries its share').toEqual([...wins])
    renderBody(data)
    // PRECONDITION: the section is open and its rows are on screen, so the
    // absence below is not an unopened body.
    expect(screen.getAllByTestId('analysis-new-options-row')).toHaveLength(wins.length)

    expect(screen.queryByTestId(BAR), 'the partition track left the resting view').toBeNull()
    expect(screen.queryByTestId(`${BAR}-caption`)).toBeNull()
    expect(segments()).toBeNull()
  })
})
