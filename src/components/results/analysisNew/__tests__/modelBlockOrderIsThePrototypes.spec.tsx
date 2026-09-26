/**
 * ⭐ THE MODEL BLOCK'S ORDER, THROUGH THE REAL TAB — census → "N to review" →
 * success line → review tool → selected-item detail (V2 prototype `mainHTML`:
 * `mapHTML()`, `.model-utils`, `goalHTML()`, `reviewHTML()`, `selectedHTML()`).
 *
 * Audit B5 measured the live order the other way round: with the review tool
 * open, the success line sat BELOW it, and a mark's detail opened directly
 * under the census, ABOVE "N to review". The sibling specs pin the order on a
 * bare `ModelStrip`; this one pins the mount `AnalysisNewTabBody` actually
 * ships, so a body that stops threading the success line through the review
 * tool REDs here.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn(() => true) }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { openStrategicChallenge } from './analysisNewFixtures'

const NODES = [
  { id: 'g1', type: 'goal', data: { label: 'Board wants NRR back above 110%' } },
  { id: 'o1', type: 'option', data: { label: 'Hold current strategy' } },
  { id: 'r1', type: 'risk', data: { label: 'Churn spike' } },
]

const before = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

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

describe('the tab mounts the model block in the prototype’s order', () => {
  it('census → "N to review" → success line → review tool → detail', () => {
    render(
      <AnalysisNewTabBody
        resultsSectionData={openStrategicChallenge()}
        isPreRun={false}
        isRunning={false}
        isStale={false}
        responseHash="run_abc123"
      />,
    )
    const rows = screen.getByTestId('analysis-new-model-strip-rows')
    const toggle = screen.getByTestId('analysis-new-review-toggle')
    const success = screen.getByTestId('analysis-new-model-strip-target')
    // r1 is about nothing the review queue holds, so its mark opens the detail.
    const riskMark = screen
      .getAllByTestId('analysis-new-model-strip-mark')
      .find((m) => m.getAttribute('data-node-id') === 'r1')!
    fireEvent.click(riskMark)
    fireEvent.click(toggle)
    const review = screen.getByTestId('analysis-new-review-item')
    const detail = screen.getByTestId('analysis-new-model-strip-detail')
    expect(before(rows, toggle), 'census before "N to review"').toBe(true)
    expect(before(toggle, success), '"N to review" before the success line').toBe(true)
    expect(before(success, review), 'the success line before the review tool').toBe(true)
    expect(before(review, detail), 'the review tool before the detail').toBe(true)
  })
})
