/**
 * DL ruling A (23 Oct): a board read carrying only CEE's `canonical_analysis_view` (no `analysis_result`) says the bound,
 * current Run's served words in the pre-run slot, and the slot then says nothing implying no result exists.
 * Fixtures: CEE's served reads of two program boards (S3 smoke-alpha2 r1, trimmed): capacity (figures) and hiring
 * (withheld). Expected words are spelled inline.
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
import capacity from '../../../../canvas/runView/__tests__/fixtures/alpha2-capacity-r1-read.json'
import hiring from '../../../../canvas/runView/__tests__/fixtures/alpha2-hiring-r1-read.json'

const SENTENCE = 'In this model, on current information, each option’s chance of ‘Weekly support capacity’ being at least 100 ticket / week at 1 week from now:'
const KEEP_FACE = '‘Keep current staffing’: 0% chance of ‘Weekly support capacity’ being at least 100 ticket / week at 1 week from now, in this model, if ‘Weekly capacity per additional specialist’ follows Olumi’s provisional conversion of your range, 10 ticket / week / specialist to 30 ticket / week / specialist, into a bell-shaped spread, held within those bounds.'
const ADD_FACE = '‘Add one specialist’: about 50% chance of ‘Weekly support capacity’ being at least 100 ticket / week at 1 week from now, in this model, if ‘Weekly capacity per additional specialist’ follows Olumi’s provisional conversion of your range, 10 ticket / week / specialist to 30 ticket / week / specialist, into a bell-shaped spread, held within those bounds.'
const NO_RESULT = 'No analysis has run yet for this model.'
const RUN_NEXT = 'Check the framing, then run the analysis.'
// CEE's served stale face (hydrate/__tests__/fixtures/founder-blocked-reopen-247ae5b4.read.json).
const STALE_FACE = 'Run the analysis again to see the chance.'

type Read = { scenario_id: string; graph: { nodes: { id: string; kind: string; label: string }[] }; canonical_analysis_view: Record<string, unknown> }

afterEach(() => { cleanup(); useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null }) })
beforeEach(() => { useStrengthenStore.setState({ records: {} }) })

/** The board on the canvas, pre-run (no report held), and CEE's served view as the read carries it, or changed. */
const board = (read: Read, view: Record<string, unknown> | null = {}) => {
  useCanvasStore.setState({
    currentScenarioId: read.scenario_id,
    nodes: read.graph.nodes.map(n => ({ id: n.id, type: n.kind, data: { label: n.label } })),
    goalThreshold: null,
    results: { ...useCanvasStore.getState().results, report: null, status: 'idle' },
  } as never)
  if (view === null) return
  const parsed = parseCanonicalAnalysisView({ ...read.canonical_analysis_view, ...view })
  expect(parsed).not.toBeNull()
  useCanonicalAnalysisViewStore.getState().adopt(read.scenario_id, parsed)
}
const draw = () => render(
  <AnalysisNewTabBody resultsSectionData={openStrategicChallenge()} isPreRun isRunning={false} isStale={false}
    blockedListing={null} canRunAnalysis onReanalyse={() => {}} />,
)
const slot = () => screen.getByTestId('analysis-new-commitment-pre-run')

describe('the pre-run slot on a program board read (view only)', () => {
  it('row 1: capacity, bound and current as served: the goal sentence and each option’s face, no "no result" line', () => {
    board(capacity as Read)
    draw()
    expect(screen.getByTestId('analysis-view-only-chances-sentence').textContent).toBe(SENTENCE)
    expect(screen.getByTestId('analysis-view-only-chance-keep_current_staffing').textContent).toBe(KEEP_FACE)
    expect(screen.getByTestId('analysis-view-only-chance-add_one_specialist').textContent).toBe(ADD_FACE)
    expect(slot()).not.toHaveTextContent(NO_RESULT)
    expect(slot()).not.toHaveTextContent(RUN_NEXT)
    expect(slot()).not.toHaveTextContent(/run a first pass/i)
    expect(slot()).not.toHaveTextContent('No goal selected')
    // The control stays.
    expect(screen.getByTestId('analysis-new-status-pre-run-act')).toBeInTheDocument()
  })

  it('row 1b: hiring, bound and current, both cells withheld with the same words: CEE’s face and why, said once', () => {
    board(hiring as Read)
    draw()
    const line = screen.getByTestId('analysis-view-only-chance-hire_tech_lead+hire_two_developers')
    expect(Array.from(line.querySelectorAll('p')).map(p => p.textContent)).toEqual(['Chance not shown yet', 'No aim has a measure yet.'])
    expect(screen.getByTestId('analysis-view-only-chances').querySelectorAll('[data-testid^="analysis-view-only-chance-"]')).toHaveLength(1)
    // CEE serves no chance words here, so no goal sentence is composed.
    expect(screen.queryByTestId('analysis-view-only-chances-sentence')).toBeNull()
    expect(slot()).not.toHaveTextContent(NO_RESULT)
    expect(slot()).not.toHaveTextContent(RUN_NEXT)
  })

  it('row 2 (contrast): no Run identity: no block, today’s lines', () => {
    board(capacity as Read, { run: null, staleness: { ...(capacity.canonical_analysis_view.staleness), stale: null, reason: null } })
    draw()
    expect(screen.queryByTestId('analysis-view-only-chances')).toBeNull()
    expect(slot()).toHaveTextContent(NO_RESULT)
    expect(slot()).toHaveTextContent(RUN_NEXT)
  })

  it('row 3 (contrast): the bound Run is stale, with CEE’s stale face: no block, today’s lines', () => {
    board(capacity as Read, { staleness: { ...(capacity.canonical_analysis_view.staleness), stale: true, reason: 'graph_changed' },
      face_when_stale: STALE_FACE })
    draw()
    expect(screen.queryByTestId('analysis-view-only-chances')).toBeNull()
    expect(slot()).toHaveTextContent(NO_RESULT)
    expect(slot()).toHaveTextContent(RUN_NEXT)
    expect(slot()).not.toHaveTextContent(STALE_FACE)
  })

  it('row 4: with a report held (the café path), the block never shows', () => {
    board(capacity as Read)
    useCanvasStore.setState({ results: { ...useCanvasStore.getState().results, report: { run_id: 'mp_run_1_8854be2b3478' } } } as never)
    draw()
    expect(screen.queryByTestId('analysis-view-only-chances')).toBeNull()
  })

  it('row 5 (non-program board, no canonical view): unchanged', () => {
    board({ scenario_id: 'cafe', graph: { nodes: [{ id: 'loyalty_card', kind: 'option', label: 'Start a loyalty card' }] }, canonical_analysis_view: {} }, null)
    draw()
    expect(screen.queryByTestId('analysis-view-only-chances')).toBeNull()
    expect(slot()).toHaveTextContent(NO_RESULT)
    expect(slot()).toHaveTextContent(RUN_NEXT)
  })
})
