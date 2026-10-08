/** GoalPanel must not deny that a guest's held target reaches analysis. */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { GoalPanel } from '../panels/GoalPanel'
import { useCanvasStore } from '../../../store'
import { useAuth } from '../../../../contexts/AuthContext'

// Control session state while keeping every other auth export live.
vi.mock('../../../../contexts/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../contexts/AuthContext')>()
  return { ...actual, useAuth: vi.fn() }
})

const OBSOLETE_CLAIM = "aren't included in the analysis"

const UNAUTHENTICATED_AUTH = { authenticated: false, user: null }
const GUEST_AUTH = { authenticated: true, user: { id: 'guest', email: 'guest@poc' } }
const REAL_AUTH = { authenticated: true, user: { id: 'u-123', email: 'real@user.io' } }

const GOAL_NODE = { id: 'goal1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Test Goal' } }
const ONE_CONSTRAINT = [
  { constraint_id: 'c1', node_id: 'f1', operator: '>=' as const, value: 5, label: 'Churn rate' },
]
const OWN_TARGET_ROW = {
  constraint_id: 'target1', node_id: 'goal1', operator: '>=' as const, value: 25, unit: '%', label: 'Test Goal',
}

function setAuth(state: Record<string, unknown>) {
  vi.mocked(useAuth).mockReturnValue(state as unknown as ReturnType<typeof useAuth>)
}

function setStore(overrides: Record<string, unknown>) {
  const state = useCanvasStore.getState()
  useCanvasStore.setState({
    ...state,
    nodes: [GOAL_NODE],
    edges: [],
    results: { status: 'idle', report: null },
    goalConstraints: null,
    goalThreshold: null,
    goalThresholdRepresentation: null,
    ...overrides,
  } as any)
}

function renderPanel() {
  return render(
    <GoalPanel nodeId="goal1" techMode={false} onClose={() => {}} onNavigate={() => {}} readOnly />
  )
}

function expectNoObsoleteNote(panel: ReturnType<typeof renderPanel>) {
  expect(panel.queryByTestId('constraints-inert-note')).toBeNull()
  expect(panel.queryByTestId('constraints-inert-note-entry')).toBeNull()
  expect(panel.container.textContent).not.toContain(OBSOLETE_CLAIM)
}

// Served witness 8 Oct (UI e9db8c04, CEE e9acc962, guest scenario 98f319eb): the inspector's 25% target reached Run; Add constraint is fenced disabled.
describe('GoalPanel — no obsolete guest constraint warning', () => {
  beforeEach(() => {
    useCanvasStore.setState(useCanvasStore.getState(), true)
    vi.mocked(useAuth).mockReset()
  })

  it.each([
    { surface: 'target row only', constraints: [OWN_TARGET_ROW] },
    { surface: 'additional constraint', constraints: [OWN_TARGET_ROW, ...ONE_CONSTRAINT] },
  ])('unauthenticated guest + pre-analysis + held user target ($surface) → no warning', ({ constraints }) => {
    setAuth(UNAUTHENTICATED_AUTH)
    setStore({
      nodes: [{
        ...GOAL_NODE,
        data: {
          ...GOAL_NODE.data,
          goal_threshold_raw: 25,
          goal_threshold_unit: '%',
          success_threshold: 25,
          threshold_source: 'user',
        },
      }],
      goalThreshold: 25,
      goalThresholdRepresentation: 'raw',
      goalConstraints: constraints,
    })
    const panel = renderPanel()
    expect(panel.getByTestId('goal-panel-target').textContent).toContain('25%')
    expect(panel.getByTestId('add-constraint-button')).toBeDisabled()
    expectNoObsoleteNote(panel)
  })

  it('GUEST + pre-analysis + constraints present → no warning', () => {
    setAuth(GUEST_AUTH)
    setStore({ goalConstraints: ONE_CONSTRAINT })
    expectNoObsoleteNote(renderPanel())
  })

  it('GUEST + pre-analysis + no constraints yet → no warning', () => {
    setAuth(GUEST_AUTH)
    setStore({ goalConstraints: null })
    expectNoObsoleteNote(renderPanel())
  })

  it('AUTHENTICATED + pre-analysis → no warning', () => {
    setAuth(REAL_AUTH)
    setStore({ goalConstraints: ONE_CONSTRAINT })
    expectNoObsoleteNote(renderPanel())
  })

  it('GUEST + results mode → no warning', () => {
    setAuth(GUEST_AUTH)
    setStore({
      goalConstraints: ONE_CONSTRAINT,
      results: { status: 'complete', report: { option_comparison_status: 'computed', option_comparison: [] } },
    })
    expectNoObsoleteNote(renderPanel())
  })
})
