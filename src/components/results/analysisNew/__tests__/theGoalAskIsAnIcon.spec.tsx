/**
 * ⭐ THE GOAL'S OLUMI ASK IS AN ICON, as the prototype's `ai('ask-goal', …)`.
 *
 * Measured on served `7f39c88b` (24 Sep 2026) at the 280px dock: the text
 * button "Work through with Olumi" made the success row's non-shrinking action
 * group 223px wide and pushed the Reasoning tab into a horizontal scroll
 * (scrollWidth 359 against clientWidth 267). Icon-only, it keeps the same act
 * and the same specific accessible name.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

let state: Record<string, unknown> = {}
vi.mock('../../../../canvas/store', () => {
  const useCanvasStore = (select: (s: Record<string, unknown>) => unknown) => select(state)
  ;(useCanvasStore as unknown as { getState: () => unknown }).getState = () => state
  return { useCanvasStore }
})
vi.mock('../../../../canvas/hooks/useModelEditAuthority', () => ({
  useModelEditAuthority: () => ({ goalTargetDispatchAvailable: false, captureScenarioId: () => 's', proposeGoalTarget: vi.fn() }),
}))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))

import { SuccessTargetLine } from '../sections/SuccessTargetLine'
import { openAskOlumi } from '../../coaching/askOlumiStore'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'

beforeEach(() => {
  vi.mocked(openAskOlumi).mockReset()
  state = {
    nodes: [{ id: 'g1', type: 'goal', data: { label: 'Grow MRR' } }],
    goalThreshold: null,
    goalThresholdRepresentation: null,
    setGoalThresholdAndUpdateNode: vi.fn(),
  }
})
afterEach(cleanup)

describe('the goal ask', () => {
  it('is icon-only: no visible text, the specific ask as its accessible name', () => {
    render(<SuccessTargetLine goalNodeId="g1" onCommitOutcome={vi.fn()} testId="target" />)
    const ask = screen.getByTestId('target-ask')
    expect(ask).toHaveAttribute('aria-label', 'Ask Olumi to help define success')
    expect(ask.textContent ?? '').not.toContain(COPY.disclosure.askOlumi)
  })

  it('CONTRAST: it still opens the same ask, bound to the goal', () => {
    render(<SuccessTargetLine goalNodeId="g1" onCommitOutcome={vi.fn()} testId="target" />)
    fireEvent.click(screen.getByTestId('target-ask'))
    expect(openAskOlumi).toHaveBeenCalledTimes(1)
    expect(vi.mocked(openAskOlumi).mock.calls[0][0].targetId).toBe('g1')
  })
})
