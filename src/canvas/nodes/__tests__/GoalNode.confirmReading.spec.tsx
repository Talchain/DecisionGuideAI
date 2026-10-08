import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReactFlow, ReactFlowProvider, type ReactFlowInstance } from '@xyflow/react'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))
vi.mock('../shared/openNodeInspector', () => ({ openNodeInspector: vi.fn() }))
vi.mock('../../hooks/useModelEditAuthority', () => ({ useModelEditAuthority: vi.fn() }))
vi.mock('../../conversation/actionBar/pressOffer', () => ({ pressOffer: vi.fn() }))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
    achievementProbability: null, stabilityPercentage: null, winRate: null,
    isResultsMode: false, predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))
vi.mock('../../ui/inspector-v2/useAnalysisResults', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../ui/inspector-v2/useAnalysisResults')>()),
  useHasAnyRealProbability: vi.fn(() => false),
}))

import { useCanvasStore } from '../../store'
import { useModelEditAuthority } from '../../hooks/useModelEditAuthority'
import { openNodeInspector } from '../shared/openNodeInspector'
import { useActionBarStore } from '../../conversation/actionBar/actionBarStore'
import { parseActionBar, type ActionBarV1, type ActionOffer } from '../../conversation/actionBar/actionBarContract'
import { pressOffer } from '../../conversation/actionBar/pressOffer'
import { ACTION_BAR_COPY } from '../../conversation/actionBar/ActionBar'
import { GoalNode } from '../GoalNode'
import { withNodeKeyboardScope } from '../nodeKeyboardScope'

const GOAL_ID = 'goal-1'
const SCENARIO_ID = 'confirm-reading-scenario'
const MARK_ID = 'goal-node-confirm-reading'
// CEE #2802's own offer words (P45, 8 Oct), until CHAT-STABLE's reading_label lands.
const WHY_NOW = 'Olumi can’t show the chance until you check how it reads ‘MRR’.'
const DISABLED_REASON = 'This reading is already confirmed.'
const selectNodeWithoutHistory = vi.fn()
const updateNodeData = vi.fn()
const setState = vi.fn()
const setGoalThresholdAndUpdateNode = vi.fn()
const proposeGoalTarget = vi.fn()
const onCardClick = vi.fn()
const onCardPointerDown = vi.fn()
const props = {
  id: GOAL_ID, type: 'goal', position: { x: 0, y: 0 }, selected: false,
  isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false,
  zIndex: 0, deletable: true, selectable: true, draggable: true,
}
const data = { label: 'Reach £30k MRR Within 18 Months', type: 'goal' }

function makeBar(slot: 'priority' | 'standard' | 'more' = 'priority', overrides: Partial<ActionOffer> = {}): ActionBarV1 {
  const issues = vi.fn()
  const bar = parseActionBar({
    v: 1, state_key: '0123456789abcdef',
    revision: { graph_hash: 'goal-reading-graph', run_key: 'goal-reading-run' },
    priority: [], standard: [], more: [],
    [slot]: [{
      action_id: 'confirm_reading', label: 'Confirm reading', icon: 'Check', group: 'gap',
      press_id: 'act:confirm_reading', user_line: 'Confirm Olumi’s reading of the goal',
      enabled: true, why_now: WHY_NOW, target: { kind: 'goal', id: GOAL_ID },
      offer_key: 'fedcba9876543210', ...overrides,
    }],
  }, issues)
  // The real parser must retain the offer: malformed fixtures cannot prove an absent control.
  expect(issues).not.toHaveBeenCalled()
  expect(bar).not.toBeNull()
  expect(bar![slot]).toHaveLength(1)
  return bar!
}

function seedStore() {
  const state = {
    results: { status: 'idle', report: null }, highlightedNodes: new Set(),
    dimmedNodeIds: new Set(), lens: { _dimmedNodeIds: new Set() }, goalThreshold: null,
    goalConstraints: [], nodes: [{ ...props, data }], edges: [],
    ceeAnalysisReady: null, viewMode: 'expert', currentScenarioId: SCENARIO_ID,
    selectNodeWithoutHistory, updateNodeData, setGoalThresholdAndUpdateNode,
  }
  vi.mocked(useCanvasStore).mockImplementation(((selector: (s: unknown) => unknown) => selector(state)) as never)
  Object.assign(useCanvasStore, { getState: () => state, setState })
  return state
}

function renderGoal(bar: ActionBarV1 | null, owner = SCENARIO_ID) {
  seedStore()
  useActionBarStore.getState().setBar(owner, bar)
  return render(<ReactFlowProvider><div onClick={onCardClick} onPointerDown={onCardPointerDown}>
    <GoalNode {...props} data={data} />
  </div></ReactFlowProvider>)
}

function expectNoLocalWrite() {
  expect(updateNodeData).not.toHaveBeenCalled()
  expect(setState).not.toHaveBeenCalled()
  expect(setGoalThresholdAndUpdateNode).not.toHaveBeenCalled()
  expect(proposeGoalTarget).not.toHaveBeenCalled()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('DOMMatrixReadOnly', class { m22 = 1 })
  useActionBarStore.getState().setBar(null, null)
  vi.mocked(pressOffer).mockReturnValue('sent')
  vi.mocked(useModelEditAuthority).mockReturnValue({
    goalTargetDispatchAvailable: true, captureScenarioId: () => SCENARIO_ID, proposeGoalTarget,
  } as unknown as ReturnType<typeof useModelEditAuthority>)
})
afterEach(() => { cleanup(); useActionBarStore.getState().setBar(null, null); vi.unstubAllGlobals() })

describe('DGAI: the goal card offers CEE’s reading through the same confirm door', () => {
  it.each(['priority', 'standard', 'more'] as const)('1: %s renders why_now verbatim and one press sends the exact offer and revision', async (slot) => {
    const bar = makeBar(slot)
    const offer = bar[slot][0]
    renderGoal(bar)
    const mark = screen.getByTestId(MARK_ID)
    expect(mark.textContent).toBe(WHY_NOW)
    expect(mark).toHaveAccessibleName(`${offer.label}: ${WHY_NOW}`)
    mark.focus()
    expect(await screen.findByRole('tooltip')).toHaveTextContent(`${offer.label}: ${WHY_NOW}`)
    await userEvent.click(mark)
    expect(pressOffer).toHaveBeenCalledTimes(1)
    expect(pressOffer).toHaveBeenCalledWith(offer, bar.revision)
    expect(vi.mocked(pressOffer).mock.calls[0][0].offer_key).toBe(offer.offer_key)
    expect(onCardClick).not.toHaveBeenCalled()
    expect(onCardPointerDown).not.toHaveBeenCalled()
    expectNoLocalWrite()
  })

  it('1b: a model-level confirm_reading offer with no target uses the same goal door', async () => {
    const bar = makeBar('more', { target: undefined })
    renderGoal(bar)
    const mark = screen.getByTestId(MARK_ID)
    expect(mark.textContent).toBe(WHY_NOW)
    await userEvent.click(mark)
    expect(pressOffer).toHaveBeenCalledTimes(1)
    expect(pressOffer).toHaveBeenCalledWith(bar.more[0], bar.revision)
    expectNoLocalWrite()
  })

  it.each([
    { target: { kind: 'goal', id: 'another-goal' } },
    { action_id: 'set_target' },
    { target: { kind: 'factor', id: GOAL_ID } },
  ] satisfies Partial<ActionOffer>[])('2: CONTROL — another goal, action or target kind renders nothing (%j)', (overrides) => {
    renderGoal(makeBar('priority', overrides))
    expect(screen.queryByTestId(MARK_ID)).not.toBeInTheDocument()
    expect(screen.queryByText(WHY_NOW)).not.toBeInTheDocument()
    expect(pressOffer).not.toHaveBeenCalled()
  })

  it('3: a bar owned by another scenario renders nothing', () => {
    renderGoal(makeBar(), 'another-scenario')
    expect(screen.queryByTestId(MARK_ID)).not.toBeInTheDocument()
    expect(screen.queryByText(WHY_NOW)).not.toBeInTheDocument()
    expect(pressOffer).not.toHaveBeenCalled()
  })

  it('4: a disabled offer renders nothing on the card (P45: the signal is the ENABLED offer) and nothing presses', () => {
    renderGoal(makeBar('priority', { enabled: false, why_now: undefined, disabled_reason: DISABLED_REASON }))
    expect(screen.queryByTestId(MARK_ID)).not.toBeInTheDocument()
    expect(screen.queryByText(DISABLED_REASON)).not.toBeInTheDocument()
    expect(pressOffer).not.toHaveBeenCalled()
    expectNoLocalWrite()
  })

  it('5: no native title; Enter presses once without selecting or moving the React Flow node', async () => {
    const state = seedStore()
    const bar = makeBar()
    useActionBarStore.getState().setBar(SCENARIO_ID, bar)
    const onNodesChange = vi.fn()
    let flow: Pick<ReactFlowInstance, 'getNode'> | undefined
    const nodeTypes = { goal: withNodeKeyboardScope(GoalNode) }
    render(<div style={{ width: 800, height: 600 }}><ReactFlow
      defaultNodes={state.nodes} nodeTypes={nodeTypes} onNodesChange={onNodesChange}
      onInit={(instance) => { flow = instance }}
    /></div>)
    const mark = await screen.findByTestId(MARK_ID)
    expect(mark).not.toHaveAttribute('title')
    expect(mark).toHaveClass('nodrag')
    const node = flow!.getNode(GOAL_ID)!
    const before = { selected: node.selected, position: { ...node.position } }
    mark.focus()
    await userEvent.keyboard('{Enter}')
    expect(pressOffer).toHaveBeenCalledTimes(1)
    expect(pressOffer).toHaveBeenCalledWith(bar.priority[0], bar.revision)
    expect(flow!.getNode(GOAL_ID)!.selected).toBe(before.selected)
    expect(flow!.getNode(GOAL_ID)!.position).toEqual(before.position)
    expect(onNodesChange.mock.calls.flat(2).filter((change) => change.type === 'select' || change.type === 'position')).toEqual([])
    expect(selectNodeWithoutHistory).not.toHaveBeenCalled()
    expect(openNodeInspector).not.toHaveBeenCalled()
    expectNoLocalWrite()
  })

  it('no offer: renders nothing until CEE supplies the confirm_reading offer', () => {
    renderGoal(null)
    expect(screen.queryByTestId(MARK_ID)).not.toBeInTheDocument()
    expect(pressOffer).not.toHaveBeenCalled()
  })

  it('a press with no conversation explains the same result as the ActionBar', async () => {
    vi.mocked(pressOffer).mockReturnValue('none')
    renderGoal(makeBar())
    await userEvent.click(screen.getByTestId(MARK_ID))
    expect(screen.getByRole('status')).toHaveTextContent(ACTION_BAR_COPY.noConversation)
    expectNoLocalWrite()
  })
})
