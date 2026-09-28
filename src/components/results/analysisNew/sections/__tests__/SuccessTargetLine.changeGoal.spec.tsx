/**
 * ⛔ R1 S4-core (MG 5879952291): the success-target control never offers its NUMBER editor for a goal whose target is
 * stated as a change from today. That editor writes a LEVEL figure; CEE refuses it over a change goal by name
 * (`goal_is_a_change`, all four goal writers). The control still says the target, and the Ask (chat) route stays.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

let state: Record<string, unknown> = {}
vi.mock('../../../../../canvas/store', () => {
  const useCanvasStore = (select: (s: Record<string, unknown>) => unknown) => select(state)
  ;(useCanvasStore as unknown as { getState: () => unknown }).getState = () => state
  return { useCanvasStore }
})
vi.mock('../../../../../canvas/hooks/useModelEditAuthority', () => ({
  useModelEditAuthority: () => ({
    goalTargetDispatchAvailable: false,
    captureScenarioId: () => 'scenario-1',
    proposeGoalTarget: vi.fn(() => 'dispatched' as const),
  }),
}))

import { SuccessTargetLine } from '../SuccessTargetLine'

const TID = 'target'
const CHANGE_GOAL = { label: 'Cut the monthly cloud bill', goal_threshold_frame: 'change_rel', goal_threshold_raw: -0.15, goal_threshold_unit: 'GBP/month' }
const LEVEL_GOAL = { label: 'Cut the monthly cloud bill', goal_threshold_raw: 38000, goal_threshold_unit: 'GBP/month' }

const renderLine = (data: Record<string, unknown>, variant?: 'reasoning') => {
  state = {
    nodes: [{ id: 'g1', type: 'goal', data }],
    goalThreshold: null,
    goalThresholdRepresentation: null,
    setGoalThresholdAndUpdateNode: vi.fn(),
  }
  return render(<SuccessTargetLine goalNodeId="g1" onCommitOutcome={() => {}} testId={TID} {...(variant ? { variant } : {})} />)
}

beforeEach(() => { state = {} })
afterEach(() => cleanup())

describe('SuccessTargetLine — a change target', () => {
  it('RED: says the change and offers no edit control; the Ask route stays', () => {
    renderLine(CHANGE_GOAL)
    expect(screen.getByTestId(TID).textContent).toContain('down 15% from today')
    expect(screen.queryByTestId(`${TID}-edit`), 'the level editor must not be offered').toBeNull()
    expect(screen.getByTestId(`${TID}-ask`)).toBeInTheDocument()
  })

  it('⛔ CONTRAST: a level target keeps its edit control', () => {
    renderLine(LEVEL_GOAL)
    expect(screen.getByTestId(`${TID}-edit`)).toBeInTheDocument()
  })
})
