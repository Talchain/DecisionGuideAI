/**
 * ⭐ THE CHART LEADS THE GLANCE'S READING; ITS STATUS STILL LEADS THE CHART.
 *
 * Fidelity gap 1 ("the options chart and 'Move towards commitment' are not on
 * the first screen"), measured 25 Sep 2026 on a local build of #1978 + bundle
 * 3 + #1983, live OpenAI hiring auto-run, 1440×900 (dock band y 60–829):
 *
 *   model strip 120 · review 252 · Challenge 328 (155px) · glance 499 (172px)
 *   · "Move towards commitment" 671 · chart 768–996 · qualifier 1002
 *
 * The chart was cut at the fold and the qualifier sat below it, under a
 * 172px reading the V2 prototype does not have above the chart. The prototype
 * runs challenge → commit (synthesis → stale row → chart → qualifier →
 * record), with the stale row inside the commitment block ABOVE the chart.
 *
 * So the glance is mounted in two halves. Its STATUS row (model changed,
 * could not confirm, did not run, partial, and the one act that answers them)
 * sits INSIDE "Move towards commitment", after its synthesis and before the
 * chart (V2 `.stale`, 26 Sep; it sat above the block before): after an edit
 * the reader still meets "The model has changed…" before any figure. Its READING (the withheld
 * reason and its act, the reading, the scope, the condition) follows the
 * commitment block. Design ask: #63 5825359499.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { decisionWithLeaderWithheldAndReason, genuineDecision } from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

const precedes = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

const renderBody = (data: ResultsSectionDataReturn, stale = false) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={stale}
      staleReason={stale ? 'changed' : null}
      responseHash="gap1"
    />,
  )

beforeEach(() => useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never))
afterEach(cleanup)

const BOTH: ReadonlyArray<[string, () => ResultsSectionDataReturn]> = [
  ['a permitted run', genuineDecision],
  ['a withheld run', decisionWithLeaderWithheldAndReason],
]

describe('the chart leads the glance reading', () => {
  it.each(BOTH)('⭐ the chart and its qualifier come before the reading, inside the answer zone — %s', (_n, make) => {
    renderBody(make())
    const answer = screen.getByTestId('analysis-new-zone-answer-group')
    const commitment = screen.getByTestId('analysis-new-commitment')
    const options = screen.getByTestId('analysis-new-options')
    const reading = screen.getByTestId('analysis-new-glance')
    expect(answer).toContainElement(reading)
    expect(precedes(commitment, reading), '"Move towards commitment" before the reading').toBe(true)
    expect(precedes(options, reading), 'the chart before the reading').toBe(true)
    const qualifier = screen.queryByTestId('analysis-new-commitment-qualifier')
    if (qualifier !== null) expect(precedes(qualifier, reading), 'the qualifier before the reading').toBe(true)
  })

  it('the withheld reading keeps its act, in the reading', () => {
    renderBody(decisionWithLeaderWithheldAndReason())
    const reading = screen.getByTestId('analysis-new-glance')
    // V2 prototype (Paul, 25 Sep 2026): the refusal's door sits in the reading,
    // closed at rest; the sentence is one click away, still in the reading.
    const door = screen.getByTestId('analysis-new-glance-withheld-toggle')
    expect(reading).toContainElement(door)
    expect(door).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(door)
    expect(reading).toContainElement(screen.getByTestId('analysis-new-glance-withheld-reason'))
    // The act mounts only where a route exists (none in this harness); where it
    // does, it travels with its sentence.
    const act = screen.queryByTestId('analysis-new-glance-withheld-review-estimates')
    if (act !== null) expect(reading).toContainElement(act)
  })

  it('⭐ after an edit, "The model has changed" still comes before any figure', () => {
    renderBody(genuineDecision(), true)
    const status = screen.getByTestId('analysis-new-glance-status')
    const stale = screen.getByTestId('analysis-new-status-stale')
    expect(status).toContainElement(stale)
    expect(screen.getByTestId('analysis-new-zone-answer-group')).toContainElement(status)
    // ⚠ RE-POINTED (26 Sep, V2 `.stale`): the prototype's stale row sits INSIDE
    // "Move towards commitment", after its synthesis and before the chart —
    // still before any figure. Bullet 1 reads "Last run" above it.
    expect(screen.getByTestId('analysis-new-commitment'), 'the stale state is inside the commitment block').toContainElement(stale)
    expect(precedes(screen.getByTestId('analysis-new-commitment-synthesis'), stale), 'after the synthesis').toBe(true)
    expect(precedes(stale, screen.getByTestId('analysis-new-options')), 'and before the chart').toBe(true)
    // One statement of the fact: the reading half carries no second ribbon.
    expect(screen.getAllByTestId('analysis-new-status-stale')).toHaveLength(1)
  })

  it('⭐ both halves on screen → ONE "At a glance" landmark (the status half is not a second region)', () => {
    renderBody(decisionWithLeaderWithheldAndReason(), true)
    expect(screen.getByTestId('analysis-new-glance-status'), 'PRECONDITION: the status half renders').toBeInTheDocument()
    expect(screen.getByTestId('analysis-new-glance'), 'PRECONDITION: the reading half renders').toBeInTheDocument()
    expect(screen.getAllByRole('region', { name: 'At a glance' })).toHaveLength(1)
    expect(screen.getByRole('region', { name: 'At a glance' })).toBe(screen.getByTestId('analysis-new-glance'))
  })

  it('CONTROL: a current run with nothing to say renders no empty status block', () => {
    renderBody(genuineDecision())
    expect(screen.queryByTestId('analysis-new-status-stale')).toBeNull()
    expect(screen.queryByTestId('analysis-new-glance-status')).toBeNull()
  })
})
