/**
 * ⭐ THE QUESTION IS A HEADING AND THE CENSUS IS ALWAYS THERE (design audit
 * B2/B3, V2 prototype `reasoningHTML`: `<div class="briefrow"><h2>…</h2></div>`
 * then `mapHTML()`, with no fold between them).
 *
 * Audit B2 measured the live question as the fold toggle for the census: one
 * press on the reader's own question hid the four rows the prototype always
 * shows. B3: each mark's accessible name said "Show X on the canvas", but the
 * press opens the review tool or the detail as well as focusing the canvas —
 * the prototype names it "Inspect X", which covers the whole press.
 *
 * Bound to the mount `AnalysisNewTabBody` ships (`openAtRest`); a bare mount
 * keeps its fold, pinned as the contrast so the static header cannot leak to
 * a caller that did not ask for it.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn(() => true) }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { ModelStrip } from '../sections/ModelStrip'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { openStrategicChallenge } from './analysisNewFixtures'

const T = 'analysis-new-model-strip'
const NODES = [
  { id: 'd1', type: 'decision', data: { label: 'Should we restructure pricing?' } },
  { id: 'g1', type: 'goal', data: { label: 'Board wants NRR back above 110%' } },
  { id: 'o1', type: 'option', data: { label: 'Hold current strategy' } },
  { id: 'r1', type: 'risk', data: { label: 'Churn spike' } },
]

const previousNodes = { value: [] as unknown }
beforeEach(() => {
  previousNodes.value = useCanvasStore.getState().nodes
  useStrengthenStore.setState({ records: {} })
  useCanvasStore.setState({ nodes: NODES, goalThreshold: null } as never)
})
afterEach(() => {
  cleanup()
  useCanvasStore.setState({ nodes: previousNodes.value } as never)
})

const renderTab = () =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={openStrategicChallenge()}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="run_abc123"
    />,
  )

describe('the Reasoning tab’s question is static, as in the prototype', () => {
  it('⭐ the question is a level-2 heading, not a control', () => {
    renderTab()
    const lead = screen.getByTestId(`${T}-lead`)
    expect(lead.tagName, 'the prototype’s `.briefrow h2`').toBe('H2')
    expect(lead.closest('button'), 'no control wraps the question').toBeNull()
    expect(screen.queryByTestId(`${T}-toggle`), 'no fold toggle on the Reasoning tab').toBeNull()
    // The landmark is still named by its subject.
    expect(screen.getByTestId(T)).toHaveAttribute('aria-labelledby', lead.id)
  })

  it('⭐ pressing the question hides nothing: the four census rows stay', () => {
    renderTab()
    const rowsBefore = screen.getAllByTestId(`${T}-row`).map((r) => r.getAttribute('data-kind'))
    expect(rowsBefore, 'PRECONDITION: the census shows all four kinds').toEqual([
      'option',
      'factor',
      'risk',
      'outcome',
    ])
    fireEvent.click(screen.getByTestId(`${T}-lead`))
    expect(screen.getByTestId(`${T}-region`)).toBeInTheDocument()
    expect(screen.getAllByTestId(`${T}-row`).map((r) => r.getAttribute('data-kind'))).toEqual(rowsBefore)
    expect(screen.queryByTestId(`${T}-tallies`), 'the closed-state tallies never replace the rows').toBeNull()
  })

  it('⭐ a mark is named for what its press does: "Inspect <name>"', () => {
    renderTab()
    const mark = screen.getAllByTestId(`${T}-mark`).find((m) => m.getAttribute('data-node-id') === 'r1')!
    expect(mark).toHaveAccessibleName('Inspect Churn spike')
    expect(screen.queryByRole('button', { name: /on the canvas/ }), 'the half-name that left out the detail is gone').toBeNull()
  })

  it('CONTRAST: a bare mount (no `openAtRest`) keeps its fold', () => {
    render(<ModelStrip isPreRun={false} />)
    const toggle = screen.getByTestId(`${T}-toggle`)
    expect(toggle.tagName).toBe('BUTTON')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByTestId(`${T}-lead`).tagName).toBe('SPAN')
  })
})
