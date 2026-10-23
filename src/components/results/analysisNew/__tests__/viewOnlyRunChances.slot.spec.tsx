/**
 * DL ruling A (23 Oct): a board read carrying only CEE's `canonical_analysis_view` (no `analysis_result`) says the bound,
 * current Run's served words in the pre-run slot, and the slot then says nothing implying no result exists.
 * Fixture: the capacity board's served view (`runView/__tests__/fixtures/capacity-view-only-read.json`).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn(() => true) }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { useCanonicalAnalysisViewStore } from '../../../../canvas/stores/canonicalAnalysisViewStore'
import { parseCanonicalAnalysisView } from '../../../../canvas/runView/canonicalAnalysisView'
import { openStrategicChallenge } from './analysisNewFixtures'
import read from '../../../../canvas/runView/__tests__/fixtures/capacity-view-only-read.json'

const served = read.canonical_analysis_view
const boundRun = { run_id: 'run-capacity-1', graph_hash_at_run: read.graph_hash, computed_at: '2026-10-23T08:00:00Z' }
const currentStaleness = { ...served.staleness, stale: false, limitation: 'Hash equality cannot detect brief, framing or stage changes.' }
const SENTENCE = 'In this model, on current information, each option’s chance of ‘Total weekly support capacity’ being at least 100 ticket / week at 1 week from now:'
const KEEP_FACE = '‘Keep current staffing’: less than 1% chance of ‘Total weekly support capacity’ being at least 100 ticket / week at 1 week from now, in this model, if ‘Weekly capacity per additional specialist’ follows Olumi’s provisional conversion of your range, 10 ticket / week / specialist to 30 ticket / week / specialist, into a bell-shaped spread and ‘Additional capacity with no additional specialists’ follows Olumi’s assumed relationship.'
const ADD_FACE = '‘Add one specialist’: about 50% chance of ‘Total weekly support capacity’ being at least 100 ticket / week at 1 week from now, in this model, if ‘Weekly capacity per additional specialist’ follows Olumi’s provisional conversion of your range, 10 ticket / week / specialist to 30 ticket / week / specialist, into a bell-shaped spread and ‘Additional capacity with no additional specialists’ follows Olumi’s assumed relationship.'
const NO_RESULT = 'No analysis has run yet'

afterEach(() => { cleanup(); useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null }) })
beforeEach(() => {
  useCanvasStore.setState({
    currentScenarioId: 'capacity',
    nodes: [
      { id: 'keep_current_staffing', type: 'option', data: { label: 'Keep current staffing' } },
      { id: 'add_one_specialist', type: 'option', data: { label: 'Add one specialist' } },
    ],
    goalThreshold: null,
    results: { ...useCanvasStore.getState().results, report: null, status: 'idle' },
  } as never)
  useStrengthenStore.setState({ records: {} })
})

const hold = (view: Record<string, unknown>) => {
  const parsed = parseCanonicalAnalysisView({ ...served, ...view })
  expect(parsed).not.toBeNull()
  useCanonicalAnalysisViewStore.getState().adopt('capacity', parsed)
}
const draw = () => render(
  <AnalysisNewTabBody resultsSectionData={openStrategicChallenge()} isPreRun isRunning={false} isStale={false}
    blockedListing={null} canRunAnalysis onReanalyse={() => {}} />,
)
const status = () => screen.getByTestId('analysis-new-status-pre-run')

describe('the pre-run slot on a view-only board read', () => {
  it('row 1: a bound, current view says each option’s served words and the goal sentence, and no "no result" line', () => {
    hold({ run: boundRun, staleness: currentStaleness })
    draw()
    expect(screen.getByTestId('analysis-view-only-chances-sentence').textContent).toBe(SENTENCE)
    expect(screen.getByTestId('analysis-view-only-chance-keep_current_staffing').textContent).toBe(KEEP_FACE)
    expect(screen.getByTestId('analysis-view-only-chance-add_one_specialist').textContent).toBe(ADD_FACE)
    expect(status()).not.toHaveTextContent(NO_RESULT)
    expect(status()).not.toHaveTextContent('Run a first pass')
    // The control stays.
    expect(screen.getByTestId('analysis-new-status-pre-run-act')).toBeInTheDocument()
  })

  it('row 2: the served view (no Run identity) shows no block and keeps today’s empty-state line', () => {
    hold({})
    draw()
    expect(screen.queryByTestId('analysis-view-only-chances')).toBeNull()
    expect(status()).toHaveTextContent('No analysis has run yet for this model.')
  })

  it('row 3: a stale bound Run shows no block', () => {
    hold({ run: boundRun, staleness: { ...currentStaleness, stale: true, reason: 'graph_changed' } })
    draw()
    expect(screen.queryByTestId('analysis-view-only-chances')).toBeNull()
    expect(status()).toHaveTextContent('No analysis has run yet for this model.')
  })

  it('row 4: with a report held (the café path), the block never shows', () => {
    hold({ run: boundRun, staleness: currentStaleness })
    useCanvasStore.setState({ results: { ...useCanvasStore.getState().results, report: { run_id: 'run-capacity-1' } } } as never)
    draw()
    expect(screen.queryByTestId('analysis-view-only-chances')).toBeNull()
  })
})
