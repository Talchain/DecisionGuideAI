/**
 * A GOAL CHANCE THAT WAITS SAYS WHAT IT WAITS ON (Paul, 24 Oct: "Waits on N figures", in place of each option's
 * "Chance not shown yet"). With every option withheld and CEE's `goal_chance.waits_on` listed, the result's headline is
 * "Chance of meeting the goal", then the count and CEE's labels. Paul, 27 Oct ("If all of them are the same, then it should
 * just say it once"): the list is said once, each unknown with CEE's words on why no one can size it yet, and an option's
 * reason that only repeats the list is not said again; any other reason still follows.
 *
 * Fixtures: the CEE 2de696a9 witness grant board after the Run press, and Paul's AI chat launch board bb169869 (27 Oct; see
 * each `_capture`). Real path: the real `AnalysisNewTabBody` pre-run slot. Expected words are spelled inline.
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
import aiLaunch from '../../../../canvas/runView/__tests__/fixtures/paul-ai-launch-waits-read-20261027.json'

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
      'Chance of meeting the goalwaits on 2 things: ‘Weekly admin unrelated to these two projects’, ‘Score on the panel\'s published scoring sheet’, '
      + 'which no one can size yet (The scoring sheet defines the measure, but no assessment or evidence connecting either time allocation or '
      + 'prototype progress to panel scores is available; rubric-based assessment would be needed to size it)')
    const block = screen.getByTestId('analysis-view-only-chances')
    expect(block.textContent).not.toContain('Chance not shown yet')
    expect(block.textContent).not.toContain('Waits on: ')
    // Said once: the options' reason only repeats the list, so it is not said again.
    expect(block.textContent?.split('which no one can size yet').length).toBe(2)
    expect(block.textContent).not.toContain('‘come across as credible to the grant panel’ waits on')
  })

  it('⭐ Paul\'s AI chat launch board (bb169869): the 10 things are said once, never again under each option', () => {
    board(aiLaunch as unknown as Read)
    draw()
    const block = screen.getByTestId('analysis-view-only-chances').textContent ?? ''
    expect(screen.getByTestId('analysis-view-only-waits-on').textContent).toBe(
      'waits on 10 things: ‘Tasks needed to launch the basic integration’, ‘Current team delivery pace’, '
      + '‘Time until experienced AI support can start’, ‘Time until the managed-service approach can start’, '
      + '‘Chance of unsafe responses affecting the launch’, which no one can size yet (This provisional risk applies to the launch under '
      + 'both existing approaches; no likelihood is supplied, and representative response evaluations and release safeguards would be '
      + 'needed to size it), '
      + '‘Launch-progress impact if unsafe responses occur’, which no one can size yet (No numerical impact is supplied; affected release '
      + 'requirements and remediation work would be needed to express a launch-progress impact, and user harm is not quantified by the '
      + 'task measure), '
      + '‘Chance of a data-exposure or access-control problem’, which no one can size yet (This provisional risk applies to the launch '
      + 'under both existing approaches; no likelihood is supplied, and a review of data flows, access controls and security testing '
      + 'would be needed to size it), '
      + '‘Launch-progress impact of a data-security problem’, which no one can size yet (No numerical impact is supplied; the security '
      + 'findings, required remediation and release-blocking requirements would be needed to express a launch-progress impact), '
      + '‘Chance of deadline pressure causing rushed testing’, which no one can size yet (This provisional risk applies to the launch '
      + 'under both existing approaches; no likelihood is supplied, and the test plan, available testing time and defect evidence would '
      + 'be needed to size it), '
      + '‘Launch-progress impact of missed defects and rework’, which no one can size yet (No numerical impact is supplied; missed-defect '
      + 'severity and resulting rework would be needed to express a launch-progress impact, and post-launch instability is not '
      + 'quantified by the task measure)')
    expect(block).not.toContain('The chance waits on')
    expect(block.split('‘Current team delivery pace’').length).toBe(2)
    expect(block.split('which no one can size yet').length).toBe(7)
  })

  it('CONTRAST: an option\'s reason that is not the waits-on list (the model is too large) still follows the headline', () => {
    const view = (aiLaunch as unknown as Read).canonical_analysis_view
    const [first, ...rest] = view.options
    const tooLarge = 'This model holds too many uncertain figures, risks and conditions at once to work out in one run.'
    board(aiLaunch as unknown as Read, null, [{ ...first, cell: { ...first.cell, why: tooLarge, reasons: [{ code: 'too_large', message: tooLarge }] } }, ...rest])
    draw()
    const block = screen.getByTestId('analysis-view-only-chances').textContent ?? ''
    expect(screen.getByTestId('analysis-view-only-waits-headline')).toBeTruthy()
    expect(block).toContain(tooLarge)
    expect(block).not.toContain('The chance waits on')
  })

  it('every item answered with a figure: "figure"; one item: singular', () => {
    const [admin] = (grant as Read).canonical_analysis_view.goal_chance.waits_on
    board(grant as Read, { waits_on: [admin] })
    draw()
    expect(screen.getByTestId('analysis-view-only-waits-on').textContent).toBe('waits on 1 figure: ‘Weekly admin unrelated to these two projects’')
  })

  it('CONTRAST: a Run with chances keeps each option’s line and the "Waits on:" list under it; no headline', () => {
    board(funding as Read)
    draw()
    expect(screen.queryByTestId('analysis-view-only-waits-headline')).toBeNull()
    expect(screen.getByTestId('analysis-view-only-waits-on').textContent)
      .toBe('Waits on: ‘Cash available now’, ‘Monthly cash burn after operating income’, ‘Additional cash costs of an angel raise’')
    expect(screen.getByTestId('analysis-view-only-chance-angel_investors').textContent).toContain('about 57% chance')
  })

  it('CONTRAST: one option with no cell at all is not "every option withheld": no headline', () => {
    const [first, ...rest] = (grant as Read).canonical_analysis_view.options
    board(grant as Read, null, [{ ...first, cell: { kind: 'none' } }, ...rest])
    draw()
    expect(screen.queryByTestId('analysis-view-only-waits-headline')).toBeNull()
    expect(screen.getByTestId('analysis-view-only-waits-on').textContent?.startsWith('Waits on: ')).toBe(true)
  })

  it('CONTRAST: every option withheld but nothing listed: each option’s withheld face, as before', () => {
    board(grant as Read, { waits_on: [] })
    draw()
    expect(screen.queryByTestId('analysis-view-only-waits-headline')).toBeNull()
    expect(screen.getByTestId('analysis-view-only-chances').textContent).toContain('Chance not shown yet')
  })
})
