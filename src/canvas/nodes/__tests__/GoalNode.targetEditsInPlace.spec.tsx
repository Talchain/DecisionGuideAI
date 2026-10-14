/**
 * ⭐ E1a — THE GOAL TARGET IS EDITED ON THE CARD, through the ONE authority the Model tab uses.
 *
 * Paul, 29 Sep: "edit the obvious thing where you see it". The goal card only NAVIGATED to the Model tab's editor. It
 * now edits the number in place when every other input `proposeGoalTarget` needs is already STATED on the goal (a level
 * target, a declared unit, a held comparator of exactly `>=` / `<=`). The card collects only the number: it never
 * chooses a direction (`goalTargetRouteChannels`' rule), so the controls below keep the route to the full editor.
 *
 * CLAIM TYPE: jsdom render of `GoalNode`; the authority is a spy, so the row pins WHAT the card proposes (number, unit,
 * scenario, direction). The authority's own write is pinned by its specs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen, act } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { GoalNode, GOAL_TARGET_ROUTE_TESTID } from '../GoalNode'
import { settleSystemEventSend } from '../../conversation/settleSystemEventSend'
import { SystemEventSendError } from '../../conversation/useConversation'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../shared/openModelValueEditor', () => ({ openModelValueEditor: vi.fn() }))
// The 409 below is built with the real `SystemEventSendError`; its module reads the session through this seam.
vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))

/** What a row replaces in the store (the goal as saved, the write base); `storeListeners` hear each replacement. */
let storeOverlay: Record<string, unknown> = {}
const storeListeners = new Set<() => void>()
const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(), dimmedNodeIds: new Set(), lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null, goalConstraints: [], nodes: [], edges: [], ceeAnalysisReady: null, viewMode: 'expert',
  lastServerGraphHash: null, ...storeOverlay,
  ...overrides,
})
vi.mock('../../store', () => {
  const useCanvasStore = Object.assign(vi.fn((selector: (s: unknown) => unknown) => selector(makeStoreState())), {
    getState: () => makeStoreState(),
    subscribe: (listener: () => void) => { storeListeners.add(listener); return () => { storeListeners.delete(listener) } },
  })
  return { useCanvasStore }
})
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false, achievementProbability: null,
    stabilityPercentage: null, winRate: null, isResultsMode: false, predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))

const proposeGoalTarget = vi.fn(() => 'dispatched' as const)
let dispatchAvailable = true
vi.mock('../../hooks/useModelEditAuthority', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useModelEditAuthority')>()
  return {
    ...actual,
    useModelEditAuthority: () => new Proxy({}, {
      get: (_t, key) => key === 'proposeGoalTarget' ? proposeGoalTarget
        : key === 'captureScenarioId' ? () => 'scn-1'
        : key === 'goalTargetDispatchAvailable' ? dispatchAvailable
        : () => undefined,
    }),
  }
})

const ID = 'goal_mrr'
const props = {
  id: ID, type: 'goal', selected: false, isConnectable: true, position: { x: 0, y: 0 }, positionAbsoluteX: 0,
  positionAbsoluteY: 0, dragging: false, zIndex: 0, deletable: true, selectable: true, draggable: true,
}
const LEVEL = { goal_threshold_raw: 85000, goal_threshold_unit: 'GBP/month' }

function renderGoal(data: Record<string, unknown>) {
  return render(
    <ReactFlowProvider>
      <GoalNode {...props} data={{ label: 'MRR', type: 'goal', ...data }} />
    </ReactFlowProvider>,
  )
}

function editTo(value: string) {
  fireEvent.click(screen.getByTestId(`goal-target-editor-${ID}`))
  const input = screen.getByTestId(`goal-target-editor-${ID}-input`)
  fireEvent.change(input, { target: { value } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

beforeEach(() => { proposeGoalTarget.mockClear(); dispatchAvailable = true; storeOverlay = {}; storeListeners.clear() })

describe('the goal card edits its target in place when the goal already states unit and direction', () => {
  it('held >= : edits on the card and proposes at_least with the goal\'s own unit', () => {
    renderGoal({ ...LEVEL, goal_direction: '>=' })
    expect(screen.queryByTestId(GOAL_TARGET_ROUTE_TESTID)).toBeNull()
    editTo('90000')
    expect(proposeGoalTarget).toHaveBeenCalledTimes(1)
    expect(proposeGoalTarget.mock.calls[0].slice(0, 4)).toEqual(['90000', 'GBP/month', 'scn-1', 'at_least'])
  })

  it('held <= : proposes at_most (the direction is the goal\'s, never a default)', () => {
    renderGoal({ ...LEVEL, goal_direction: '<=' })
    editTo('70000')
    expect(proposeGoalTarget.mock.calls[0].slice(0, 4)).toEqual(['70000', 'GBP/month', 'scn-1', 'at_most'])
  })
})

describe('PoC widening (Paul 29 Sep): "above"/"below" also edit in place, on the same side of the target', () => {
  it('strict > : proposes at_least', () => {
    renderGoal({ ...LEVEL, goal_direction: '>' })
    editTo('90000')
    expect(proposeGoalTarget.mock.calls[0].slice(0, 4)).toEqual(['90000', 'GBP/month', 'scn-1', 'at_least'])
  })
  it('strict < : proposes at_most', () => {
    renderGoal({ ...LEVEL, goal_direction: '<' })
    editTo('70000')
    expect(proposeGoalTarget.mock.calls[0].slice(0, 4)).toEqual(['70000', 'GBP/month', 'scn-1', 'at_most'])
  })
})

describe('CONTROLS: the card keeps the route to the full editor, and proposes nothing, when it would have to choose', () => {
  const routeOnly = (data: Record<string, unknown>) => {
    renderGoal(data)
    expect(screen.queryByTestId(`goal-target-editor-${ID}`)).toBeNull()
    expect(screen.getByTestId(GOAL_TARGET_ROUTE_TESTID)).toBeDefined()
    expect(proposeGoalTarget).not.toHaveBeenCalled()
  }
  it('no held comparator', () => routeOnly(LEVEL))
  it('no declared unit', () => routeOnly({ goal_threshold_raw: 85000, goal_direction: '>=' }))
  it('the typed route is not available', () => { dispatchAvailable = false; routeOnly({ ...LEVEL, goal_direction: '>=' }) })
  it('a change target is not edited as a level', () => {
    renderGoal({ goal_threshold_raw: -0.2, goal_threshold_unit: 'GBP/month', goal_threshold_frame: 'change_rel', goal_direction: '<=' })
    expect(screen.queryByTestId(`goal-target-editor-${ID}`)).toBeNull()
  })
})

/**
 * Recovery Batch B (served capacity row 7a, the option card's twin): a target retried after a lost reply is refused on
 * a MOVED base (409 GRAPH_DIVERGED `stale_base_graph_hash`, the served envelope). The card reads the saved model before
 * it speaks, so the authority's settlement DETAIL has to reach the editor; the card used to drop it.
 */
describe('a goal target refused on a moved base reads the saved model before it speaks', () => {
  it('RED on 3e3e798: the saved goal holds 90000, so the card says saved, never "Not saved"', async () => {
    const goal = (raw: number) => ({ id: ID, type: 'goal', data: { label: 'MRR', type: 'goal', ...LEVEL, goal_threshold_raw: raw, goal_direction: '>=' } })
    storeOverlay = { nodes: [goal(85000)], lastServerGraphHash: 'f246477dd0d5eabf' }
    renderGoal({ ...LEVEL, goal_direction: '>=' })
    editTo('90000')
    expect(proposeGoalTarget).toHaveBeenCalledTimes(1)
    const opts = (proposeGoalTarget.mock.calls[0] as unknown[])[4] as { onSendSettled: Parameters<typeof settleSystemEventSend>[1] }
    const served409 = new SystemEventSendError('server', {
      code: 'GRAPH_DIVERGED', conflictCategory: 'stale_base_graph_hash', reason: 'graph_write_conflict', retryable: false,
    })
    await act(async () => { settleSystemEventSend(Promise.reject(served409), opts.onSendSettled); await Promise.resolve() })
    await act(async () => {
      storeOverlay = { nodes: [goal(90000)], lastServerGraphHash: '909617df4d06d742' }
      storeListeners.forEach(listener => listener())
      await new Promise(resolve => setTimeout(resolve, 5))
    })
    expect(screen.getByTestId(`goal-target-editor-${ID}-settlement`).textContent).toBe('Saved. The model holds this value.')
    expect(screen.queryByText(/kept its previous value/)).toBeNull()
    expect(proposeGoalTarget).toHaveBeenCalledTimes(1)
  })
})
