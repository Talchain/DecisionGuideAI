/**
 * ⛔ THE ANALYSIS TAB'S ASSUMED-STRENGTH CARD NAMES NO STRONGER OPTION ON A RUN
 * WHOSE RANKING WAS WITHHELD — the Reasoning tab's rule, on its sibling surface.
 *
 * AI Quality's audit of served UI `b017e3c2` (#69 5827943157, leak 1): the
 * Analysis tab's hero renders `assumedStrengthWhy` ("In the runs where that
 * link came out weak, {alt} was the stronger option {pct}% of the time…") with
 * no verdict gate, while the Reasoning tab withholds the same sentence
 * (`buildAnalysisNewViewModel.ts`, `rankingWasWithheld(...) ? null : …`). A run
 * that withheld its leader then ranks an option on one tab and not the other.
 *
 * The rule is the Reasoning tab's, read from the SAME predicate
 * (`rankingWasWithheld`), not a second one: the card keeps its lead and its ask
 * (setting a strength is exactly the act that can lift the withholding), and
 * drops only the sentence that presupposes a stronger option.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))

import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import { buildHeroModel } from '../buildHeroModel'
import type { HeroChartModel } from '../heroTypes'
import { rankingWasWithheld } from '../../leaderDesignation'
import { assumedStrengthWhy } from '../../strengthElicitation/assumedStrengthCopy'
import type { AssumedStrengthSelection } from '../../strengthElicitation/selectAssumedStrengthToResolve'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { makeHeroData } from '../__fixtures__/hero.fixtures'

afterEach(cleanup)

// The same selections as the Reasoning tab's twin spec
// (`theAssumptionNamesNoStrongerOptionOnAWithheldRun.spec.ts`).
const NAMED: AssumedStrengthSelection = {
  edgeId: 'edge_elasticity_to_margin',
  fromLabel: 'Price elasticity',
  toLabel: 'Sustained margin',
  switchProbability: 0.41,
  alternativeWinnerLabel: 'Hold price',
  strengthProvenance: 'ai_inferred',
  strengthEditReachable: true,
}
const UNNAMED: AssumedStrengthSelection = { ...NAMED, alternativeWinnerLabel: null }

const withSelection = (data: ResultsSectionDataReturn, selected: AssumedStrengthSelection): ResultsSectionDataReturn => ({
  ...data,
  assumedStrength: { selected, refusalReason: null, assumedFragileCount: 3 },
})

const STRONGER = /\bthe stronger (option|one)\b/i

// The hero's own fixture, so the panel renders as it does in the dock. The licence
// is the composed `leaderDesignationPermitted` the hook emits beside `verdict`.
const permitted = () => makeHeroData({ recommendation: { leaderDesignationPermitted: true } })
const withheld = () => makeHeroData({ recommendation: { leaderDesignationPermitted: false } })

const renderHero = (data: ResultsSectionDataReturn) => {
  const model = buildHeroModel(data)
  // PRECONDITION: the card mounts in the chart model; a status model would test nothing.
  expect(model.kind, 'the hero built a status model, not a chart').toBe('chart')
  return render(<AnalysisHeroPanel model={model as HeroChartModel} rerunDisabled={false} />)
}

describe('⛔ the Analysis tab hero on a run whose ranking was withheld', () => {
  it('PRECONDITION: the twins answer the licence question the way the gate reads it', () => {
    expect(rankingWasWithheld(withheld().recommendation)).toBe(true)
    expect(rankingWasWithheld(permitted().recommendation)).toBe(false)
  })

  for (const [name, selection] of [
    ['named alternative', NAMED],
    ['unnamed alternative', UNNAMED],
  ] as const) {
    describe(name, () => {
      it('✅ PERMITTED twin (positive control): the card states the measured rate', () => {
        renderHero(withSelection(permitted(), selection))
        const why = screen.getByTestId('assumed-strength-why')
        expect(why).toHaveTextContent(assumedStrengthWhy(selection))
        expect(why.textContent ?? '').toMatch(STRONGER)
        expect(why).toHaveTextContent('41%')
      })

      it('⛔ WITHHELD twin: no stronger option and no rate, but the card and its ask remain', () => {
        renderHero(withSelection(withheld(), selection))
        // The card survives: its value on this run is the naming and the ask.
        expect(screen.getByTestId('assumed-strength-card')).toBeInTheDocument()
        expect(screen.getByTestId('assumed-strength-ask')).toBeInTheDocument()
        expect(screen.queryByTestId('assumed-strength-why')).toBeNull()
        const card = screen.getByTestId('assumed-strength-card').textContent ?? ''
        expect(card).not.toMatch(STRONGER)
        expect(card).not.toContain('41%')
        expect(card).not.toMatch(/highest such rate/i)
      })
    })
  }
})
