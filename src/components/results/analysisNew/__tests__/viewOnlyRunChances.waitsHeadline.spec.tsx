/**
 * A GOAL CHANCE THAT WAITS SAYS WHAT IT WAITS ON (Paul, 24 Oct: "Waits on N figures", in place of each option's
 * "Chance not shown yet"). With every option withheld and CEE's `goal_chance.waits_on` listed, the result's headline is
 * "Chance of meeting the goal", then the count and CEE's labels; each option's own reason still follows.
 *
 * Fixture: the CEE 2de696a9 witness grant board after the Run press (see its `_capture`). Real path: the real
 * `AnalysisNewTabBody` pre-run slot. Expected words are spelled inline.
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
import grant from '../../../../canvas/runView/__tests__/fixtures/w3735-grant-press-read.json'
import funding from '../../../../canvas/runView/__tests__/fixtures/s1-funding-waits-on-turn.json'

type Read = { scenario_id: string; graph: { nodes: { id: string; kind: string | null; label: string | null }[] }; canonical_analysis_view: Record<string, any> }

afterEach(() => { cleanup(); useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null }) })
beforeEach(() => { useStrengthenStore.setState({ records: {} }) })

const board = (read: Read, goalChance: Record<string, unknown> | null = null, options: unknown[] | null = null) => {
  useCanvasStore.setState({
    currentScenarioId: read.scenario_id,
    nodes: read.graph.nodes.map(n => ({ id: n.id, type: n.kind, data: { label: n.label } })),
    goalThreshold: null,
    results: { ...useCanvasStore.getState().results, report: null, status: 'idle' },
  } as never)
  const view = read.canonical_analysis_view
  const parsed = parseCanonicalAnalysisView({ ...view, ...(options === null ? {} : { options }),
    goal_chance: goalChance === null ? view.goal_chance : { ...view.goal_chance, ...goalChance } })
  expect(parsed).not.toBeNull()
  useCanonicalAnalysisViewStore.getState().adopt(read.scenario_id, parsed)
}
const items = (el: HTMLElement) => Array.from(el.querySelectorAll('li')).map((li) => li.textContent)
const draw = () => render(
  <AnalysisNewTabBody resultsSectionData={openStrategicChallenge()} isPreRun isRunning={false} isStale={false}
    blockedListing={null} canRunAnalysis onReanalyse={() => {}} />,
)

describe('a goal chance that waits says what it waits on', () => {
  it('⭐ every option withheld: one headline with the count and CEE’s labels, never each option’s withheld face', () => {
    board(grant as Read)
    draw()
    const headline = screen.getByTestId('analysis-view-only-waits-headline')
    expect(headline.textContent).toBe(
      'Chance of meeting the goalwaits on 2 things:‘Weekly admin unrelated to these two projects’‘Score on the panel\'s published scoring sheet’')
    expect(items(headline)).toEqual(['‘Weekly admin unrelated to these two projects’', '‘Score on the panel\'s published scoring sheet’'])
    const block = screen.getByTestId('analysis-view-only-chances')
    expect(block.textContent).not.toContain('Chance not shown yet')
    expect(block.textContent).not.toContain('Waits on: ')
    // Each option's own reason still follows (CEE's `why`, said once for the options that share it).
    expect(block.textContent).toContain('‘come across as credible to the grant panel’ waits on ‘Score on the panel\'s published scoring sheet’, which no one can size yet')
  })

  it('every item answered with a figure: "figure"; one item: singular', () => {
    const [admin] = (grant as Read).canonical_analysis_view.goal_chance.waits_on
    board(grant as Read, { waits_on: [admin] })
    draw()
    const waits = screen.getByTestId('analysis-view-only-waits-on')
    expect(waits.querySelector('p')?.textContent).toBe('waits on 1 figure:')
    expect(items(waits)).toEqual(['‘Weekly admin unrelated to these two projects’'])
  })

  it('CONTRAST: a Run with chances keeps each option’s line and the "Waits on:" list under it; no headline', () => {
    board(funding as Read)
    draw()
    expect(screen.queryByTestId('analysis-view-only-waits-headline')).toBeNull()
    const waits = screen.getByTestId('analysis-view-only-waits-on')
    expect(waits.querySelector('p')?.textContent).toBe('Waits on:')
    expect(items(waits)).toEqual(['‘Cash available now’', '‘Monthly cash burn after operating income’', '‘Additional cash costs of an angel raise’'])
    expect(screen.getByTestId('analysis-view-only-chance-angel_investors').textContent).toContain('about 57% chance')
  })

  it('CONTRAST: one option with no cell at all is not "every option withheld": no headline', () => {
    const [first, ...rest] = (grant as Read).canonical_analysis_view.options
    board(grant as Read, null, [{ ...first, cell: { kind: 'none' } }, ...rest])
    draw()
    expect(screen.queryByTestId('analysis-view-only-waits-headline')).toBeNull()
    expect(screen.getByTestId('analysis-view-only-waits-on').querySelector('p')?.textContent).toBe('Waits on:')
  })

  it('CONTRAST: every option withheld but nothing listed: each option’s withheld face, as before', () => {
    board(grant as Read, { waits_on: [] })
    draw()
    expect(screen.queryByTestId('analysis-view-only-waits-headline')).toBeNull()
    expect(screen.getByTestId('analysis-view-only-chances').textContent).toContain('Chance not shown yet')
  })
})
