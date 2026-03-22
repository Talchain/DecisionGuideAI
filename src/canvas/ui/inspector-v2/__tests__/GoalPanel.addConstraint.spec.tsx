/**
 * GoalPanel — add constraint regression tests (B.5)
 * Verifies: button hidden in results mode, visible in pre-analysis mode.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { GoalPanel } from '../panels/GoalPanel'
import { useCanvasStore } from '../../../store'

// Minimal store setup helpers
function setStoreState(overrides: Record<string, unknown>) {
  const state = useCanvasStore.getState()
  useCanvasStore.setState({
    ...state,
    nodes: [{ id: 'goal1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Test Goal' } }],
    edges: [],
    ...overrides,
  } as any)
}

describe('GoalPanel — add constraint gating', () => {
  beforeEach(() => {
    useCanvasStore.setState(useCanvasStore.getState(), true)
  })

  it('shows add-constraint button in pre-analysis mode', () => {
    setStoreState({ results: { status: 'idle', report: null } })
    const { container } = render(
      <GoalPanel nodeId="goal1" techMode={false} onClose={() => {}} onNavigate={() => {}} />
    )
    const btn = container.querySelector('[data-testid="add-constraint-button"]')
    expect(btn).not.toBeNull()
    expect(btn?.textContent).toContain('Add constraint')
  })

  it('hides add-constraint button in results mode', () => {
    setStoreState({
      results: {
        status: 'complete',
        report: { option_comparison_status: 'computed', option_comparison: [] },
      },
    })
    const { container } = render(
      <GoalPanel nodeId="goal1" techMode={false} onClose={() => {}} onNavigate={() => {}} />
    )
    const btn = container.querySelector('[data-testid="add-constraint-button"]')
    expect(btn).toBeNull()
  })
})
