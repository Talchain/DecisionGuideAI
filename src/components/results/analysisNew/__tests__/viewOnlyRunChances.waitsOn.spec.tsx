/**
 * WHAT THE RESULT WAITS ON, LISTED WITH IT (DL, 24 Oct; buddy 00:47Z). CEE S1 (#3716) serves `goal_chance.waits_on`: each
 * thing the result waits on by its own label, with `answer.quantity_id` where the person can answer it with a figure, and
 * its first reply promises "The chance also waits on N other things, listed with the result". The result now lists them
 * under the chance as "Waits on: ‘A’, ‘B’, …" in CEE's labels and order, and a label with an answer opens that figure's own
 * answer box on its card (the existing in-card field, `graphChanges/valuePrefill.ts`) and brings the card into view.
 *
 * Fixture: the served turn reply on the funding board (CEE b225bbed, one typed card edit, 0 AI calls; see its `_capture`).
 * Real path: the real `AnalysisNewTabBody` pre-run slot on a program board read. Expected words are spelled inline.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn(() => true) }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { useCanonicalAnalysisViewStore } from '../../../../canvas/stores/canonicalAnalysisViewStore'
import { parseCanonicalAnalysisView } from '../../../../canvas/runView/canonicalAnalysisView'
import { useValuePrefillStore } from '../../../../canvas/graphChanges/valuePrefill'
import { focusModelTarget } from '../../../../canvas/utils/focusHelpers'
import { openStrategicChallenge } from './analysisNewFixtures'
import funding from '../../../../canvas/runView/__tests__/fixtures/s1-funding-waits-on-turn.json'
import capacity from '../../../../canvas/runView/__tests__/fixtures/alpha2-capacity-r1-read.json'

type Read = { scenario_id: string; graph: { nodes: { id: string; kind: string | null; label: string | null }[] }; canonical_analysis_view: Record<string, any> }
// One label per line (audit U2, 25 Oct): the lead, then each label as its own list item, in CEE's order.
const WAITS = ['‘Cash available now’', '‘Monthly cash burn after operating income’', '‘Additional cash costs of an angel raise’']
const items = (el: HTMLElement) => Array.from(el.querySelectorAll('li')).map((li) => li.textContent)


afterEach(() => { cleanup(); useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null }); useValuePrefillStore.setState({ request: null }) })
beforeEach(() => { useStrengthenStore.setState({ records: {} }); vi.mocked(focusModelTarget).mockClear() })

/** The board on the canvas, pre-run (no report held), and CEE's served view, or changed. */
const board = (read: Read, goalChance: Record<string, unknown> | null = null, nodes = read.graph.nodes) => {
  useCanvasStore.setState({
    currentScenarioId: read.scenario_id,
    nodes: nodes.map(n => ({ id: n.id, type: n.kind, data: { label: n.label } })),
    goalThreshold: null,
    results: { ...useCanvasStore.getState().results, report: null, status: 'idle' },
  } as never)
  const view = read.canonical_analysis_view
  const parsed = parseCanonicalAnalysisView(goalChance === null ? view : { ...view, goal_chance: { ...view.goal_chance, ...goalChance } })
  expect(parsed).not.toBeNull()
  useCanonicalAnalysisViewStore.getState().adopt(read.scenario_id, parsed)
}
const draw = () => render(
  <AnalysisNewTabBody resultsSectionData={openStrategicChallenge()} isPreRun isRunning={false} isStale={false}
    blockedListing={null} canRunAnalysis onReanalyse={() => {}} />,
)
const waits = () => screen.getByTestId('analysis-view-only-waits-on')

describe('the result lists what it waits on, in CEE’s labels', () => {
  it('every waits_on label, in CEE’s order, under the chance', () => {
    board(funding as Read)
    draw()
    expect(waits().querySelector('p')?.textContent).toBe('Waits on:')
    expect(items(waits())).toEqual(WAITS)
    // Under the chance: after the sentence and each option's line, in the same result.
    const block = screen.getByTestId('analysis-view-only-chances')
    expect(block).toContainElement(waits())
    const sentence = screen.getByTestId('analysis-view-only-chances-sentence')
    const lastLine = screen.getByTestId('analysis-view-only-chance-angel_investors')
    expect(sentence.compareDocumentPosition(waits()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(lastLine.compareDocumentPosition(waits()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('a label with an answer opens that figure’s answer box on its card, and brings the card into view', () => {
    board(funding as Read)
    draw()
    fireEvent.click(screen.getByTestId('analysis-view-only-waits-on-answer-cash_available'))
    expect(focusModelTarget).toHaveBeenCalledWith('cash_available')
    expect(useValuePrefillStore.getState().request).toMatchObject({ nodeId: 'cash_available', text: '' })
    // Each answerable label is its own control.
    for (const id of ['monthly_net_burn', 'angel_cash_overhead']) expect(screen.getByTestId(`analysis-view-only-waits-on-answer-${id}`)).toBeInTheDocument()
  })

  it('CONTRAST: no answer, or no card for it on the canvas: the label alone, never a control', () => {
    const [cash, burn, overhead] = (funding as Read).canonical_analysis_view.goal_chance.waits_on
    board(funding as Read, { waits_on: [{ ...cash, answer: null }, burn, overhead] },
      (funding as Read).graph.nodes.filter(n => n.id !== 'monthly_net_burn'))
    draw()
    expect(waits().querySelector('p')?.textContent).toBe('Waits on:')
    expect(items(waits())).toEqual(WAITS)
    expect(screen.queryByTestId('analysis-view-only-waits-on-answer-cash_available')).toBeNull()
    expect(screen.queryByTestId('analysis-view-only-waits-on-answer-monthly_net_burn')).toBeNull()
    expect(screen.getByTestId('analysis-view-only-waits-on-answer-angel_cash_overhead')).toBeInTheDocument()
    expect(screen.getByTestId('analysis-view-only-waits-on-cash_available').textContent).toBe('‘Cash available now’')
  })

  it('CONTRAST: a Run with no waits_on says no "Waits on" line; a malformed list is not said, and the chance still is', () => {
    board(capacity as unknown as Read)
    draw()
    expect(screen.getByTestId('analysis-view-only-chances')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-view-only-waits-on')).toBeNull()
    cleanup()
    const [cash] = (funding as Read).canonical_analysis_view.goal_chance.waits_on
    board(funding as Read, { waits_on: [{ ...cash, label: '' }] })
    draw()
    expect(screen.queryByTestId('analysis-view-only-waits-on')).toBeNull()
    expect(screen.getByTestId('analysis-view-only-chances-sentence')).toBeInTheDocument()
    expect(screen.getByTestId('analysis-view-only-chance-existing_outreach')).toBeInTheDocument()
  })
})
