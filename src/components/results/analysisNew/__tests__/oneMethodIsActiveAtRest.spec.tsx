/**
 * B1/B7 — "ONE METHOD IS ALWAYS ACTIVE" (V2 prototype: `state.method` is never
 * empty; the strip's active icon and the Challenge question are the same
 * method), mounted in the real tab body.
 *
 * ⚠ WHAT THE LIVE TAB CAN HONESTLY DO. The prototype starts on an authored
 * default. The live tab has no producer field naming a default method, so it
 * does NOT pick one: the method active at rest is the one the run's OWN top
 * finding names (`methodForRecommendation`, the same four-argument call the
 * strip's "raised" dot and the card use). When that finding names no
 * technique, nothing is active — never a UI-chosen default.
 *
 * ⚠ AND A PICK STAYS PICKED. The prototype's strip sets the method; pressing
 * the active one again does not clear it. The live strip used to toggle.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: () => true }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { genuineDecision } from './analysisNewFixtures'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

const STRIP = 'analysis-new-method-strip'
const CARD = 'analysis-new-challenge'

/** A completed run with a fragile link: the engine's top finding is a flip, which names "Consider the opposite". */
const flipDecision = (): ResultsSectionDataReturn => {
  const d = genuineDecision()
  return {
    ...d,
    recommendation: { ...d.recommendation, analysisStatus: 'computed', hasGoalTarget: true },
    confidence: {
      ...d.confidence,
      challengeFragileEdges: [
        { edge_id: 'e_price', from_label: 'Price elasticity', to_label: 'Revenue', switch_probability: 0.42, alternative_winner_label: 'Hold price' },
      ],
    },
  } as unknown as ResultsSectionDataReturn
}

const drawBody = (data: ResultsSectionDataReturn) =>
  render(<AnalysisNewTabBody resultsSectionData={data} isPreRun={false} isRunning={false} isStale={false} responseHash="rest" />)

const pressed = () =>
  Array.from(screen.getByTestId(STRIP).querySelectorAll('button[aria-pressed="true"]')).map((b) =>
    (b.getAttribute('data-testid') ?? '').replace(`${STRIP}-method-`, ''),
  )

beforeEach(() => useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never))
afterEach(cleanup)

describe('one method is active at rest — when the run names one', () => {
  it('⭐ the run\'s top finding names "Consider the opposite": that icon is pressed and dotted, and the card shows the finding', () => {
    drawBody(flipDecision())
    const card = screen.getByTestId(CARD)
    expect(card, 'PRECONDITION: the flip is the top finding').toHaveAttribute('data-recommendation-id', 'strengthen:flip:e_price')
    expect(pressed()).toEqual(['consider_opposite'])
    expect(screen.getByTestId(`${STRIP}-method-consider_opposite-mark`)).toBeInTheDocument()
  })

  it('⛔ CONTRAST — a top finding that names no technique leaves every method unpressed (no invented default)', () => {
    drawBody(genuineDecision())
    const card = screen.getByTestId(CARD)
    expect(card, 'PRECONDITION: an unmapped finding leads').not.toHaveAttribute('data-method-id')
    expect(pressed()).toEqual([])
  })

  it('a pick moves the active method and the card together, and pressing it again does NOT clear it', () => {
    drawBody(flipDecision())
    const reframe = screen.getByTestId(`${STRIP}-method-reframe_problem`)
    fireEvent.click(reframe)
    expect(pressed()).toEqual(['reframe_problem'])
    expect(screen.getByTestId(CARD)).toHaveAttribute('data-method-id', 'reframe_problem')
    fireEvent.click(screen.getByTestId(`${STRIP}-method-reframe_problem`))
    expect(pressed()).toEqual(['reframe_problem'])
    expect(screen.getByTestId(CARD)).toHaveAttribute('data-source', 'method')
  })

  it('"Not useful right now" on a pick returns the card, and the strip, to the finding', () => {
    drawBody(flipDecision())
    fireEvent.click(screen.getByTestId(`${STRIP}-method-reframe_problem`))
    fireEvent.click(screen.getByTestId(`${CARD}-more`))
    fireEvent.click(screen.getByTestId(`${CARD}-not-useful`))
    expect(screen.getByTestId(CARD)).toHaveAttribute('data-source', 'intervention')
    expect(pressed()).toEqual(['consider_opposite'])
  })

  it('⛔ (#2066 review B1) pressing the RESTING icon latches nothing: "Not useful right now" still sets the finding aside', () => {
    drawBody(flipDecision())
    fireEvent.click(screen.getByTestId(`${STRIP}-method-consider_opposite`))
    expect(screen.getByTestId(CARD), 'no visible change on the press').toHaveAttribute('data-source', 'intervention')
    fireEvent.click(screen.getByTestId(`${CARD}-more`))
    fireEvent.click(screen.getByTestId(`${CARD}-not-useful`))
    // CONTROL (the same dismissal without the press) clears the card and the strip;
    // the press must not change that.
    expect(pressed(), 'the dismissed method is not re-presented').toEqual([])
    expect(screen.queryByTestId(CARD)?.getAttribute('data-method-id') ?? null).not.toBe('consider_opposite')
  })

  it('⛔ (#2066 re-review) a pick made on an EARLIER run, which the new run\'s finding then names, does not survive "Not useful right now"', () => {
    // Its own response hash, so no retirement from another case can leak in.
    const draw = (data: ResultsSectionDataReturn) => (
      <AnalysisNewTabBody resultsSectionData={data} isPreRun={false} isRunning={false} isStale={false} responseHash="b1-rerun" />
    )
    const { rerender } = render(draw(genuineDecision()))
    expect(pressed(), 'PRECONDITION run 1: nothing active').toEqual([])
    fireEvent.click(screen.getByTestId(`${STRIP}-method-consider_opposite`))
    expect(pressed(), 'run 1: the reader picked it').toEqual(['consider_opposite'])
    rerender(draw(flipDecision()))
    expect(screen.getByTestId(CARD), 'run 2: the finding names the pick, so it shows the finding').toHaveAttribute('data-source', 'intervention')
    fireEvent.click(screen.getByTestId(`${CARD}-more`))
    fireEvent.click(screen.getByTestId(`${CARD}-not-useful`))
    expect(pressed(), 'the dismissed method is not re-presented').toEqual([])
    expect(screen.queryByTestId(CARD)?.getAttribute('data-method-id') ?? null).not.toBe('consider_opposite')
  })

  it('⛔ (#2066 review B2) a method the READER picked wears the ring, not the run\'s "raised" dot', () => {
    drawBody(flipDecision())
    fireEvent.click(screen.getByTestId(`${STRIP}-method-reframe_problem`))
    expect(pressed()).toEqual(['reframe_problem'])
    expect(screen.queryByTestId(`${STRIP}-method-reframe_problem-mark`), 'no provenance dot on a pick').toBeNull()
    // CONTRAST: the method the run DID raise keeps its dot.
    expect(screen.getByTestId(`${STRIP}-method-consider_opposite-mark`)).toBeInTheDocument()
  })

  it('the tab\'s "Challenge the thinking" title carries the ⓘ', () => {
    drawBody(flipDecision())
    expect(screen.getByRole('heading', { name: 'Challenge the thinking' })).toBe(screen.getByTestId('analysis-new-zone-also'))
    expect(screen.getByRole('button', { name: 'Why this method here?' })).toBeInTheDocument()
  })
})
