import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReactFlow, ReactFlowProvider, type ReactFlowInstance } from '@xyflow/react'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))
vi.mock('../shared/openNodeInspector', () => ({ openNodeInspector: vi.fn() }))
vi.mock('../../hooks/useModelEditAuthority', () => ({ useModelEditAuthority: vi.fn() }))
vi.mock('../../ToastContext', () => ({ useShowToastSafe: () => showToast }))
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
import { GoalNode } from '../GoalNode'
import { withNodeKeyboardScope } from '../nodeKeyboardScope'
import { ANALYSIS_NEW_COPY as COPY } from '../../../components/results/analysisNew/analysisNewCopy'
import { goalTargetSettlementNotice } from '../../conversation/goalTargetEdit'

const GOAL_ID = 'goal-1'
const SCENARIO_ID = 'target-press-scenario'
const FIGURE = '30000'
const UNIT = '£'
const EDITOR_ID = 'goal-node-target-editor'
const showToast = vi.fn()
const proposeGoalTarget = vi.fn()
const updateNodeData = vi.fn()
const setState = vi.fn()
const setGoalThresholdAndUpdateNode = vi.fn()
const selectNodeWithoutHistory = vi.fn()
const props = {
  id: GOAL_ID, type: 'goal', position: { x: 0, y: 0 }, selected: false,
  isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false,
  zIndex: 0, deletable: true, selectable: true, draggable: true,
}
const data = { label: 'Reach £30k MRR Within 18 Months', type: 'goal' }

function seedStore(targetData: Record<string, unknown> = {}) {
  const state = {
    results: { status: 'idle', report: null }, highlightedNodes: new Set(),
    dimmedNodeIds: new Set(), lens: { _dimmedNodeIds: new Set() }, goalThreshold: null,
    goalConstraints: [], nodes: [{ ...props, data: { ...data, ...targetData } }], edges: [],
    ceeAnalysisReady: null, viewMode: 'expert', currentScenarioId: SCENARIO_ID,
    selectNodeWithoutHistory, updateNodeData, setGoalThresholdAndUpdateNode,
  }
  vi.mocked(useCanvasStore).mockImplementation(((selector: (s: unknown) => unknown) => selector(state)) as never)
  Object.assign(useCanvasStore, { getState: () => state, setState })
  return state
}
function renderGoal(targetData: Record<string, unknown> = {}) {
  seedStore(targetData)
  return render(<ReactFlowProvider><GoalNode {...props} data={{ ...data, ...targetData }} /></ReactFlowProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
  // jsdom supplies no DOMMatrix; React Flow reads only the viewport zoom here.
  vi.stubGlobal('DOMMatrixReadOnly', class { m22 = 1 })
  proposeGoalTarget.mockReturnValue('dispatched')
  vi.mocked(useModelEditAuthority).mockReturnValue({
    goalTargetDispatchAvailable: true, captureScenarioId: () => SCENARIO_ID, proposeGoalTarget,
  } as unknown as ReturnType<typeof useModelEditAuthority>)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('DGAI: the missing-target mark resolves on the canvas in one press', () => {
  it('1: one press opens the shared editor with its input focused, without the inspector', async () => {
    renderGoal()
    await userEvent.click(screen.getByTestId('goal-node-no-target-chip'))
    expect(screen.getByTestId(`${EDITOR_ID}-editor`)).toBeInTheDocument()
    expect(screen.getByTestId(`${EDITOR_ID}-input`)).toHaveFocus()
    expect(openNodeInspector).not.toHaveBeenCalled()
  })

  it.each(['dispatched', 'local_only'] as const)('2: figure + unit uses the goal-target door and closes on %s, without a local echo', async (outcome) => {
    proposeGoalTarget.mockReturnValue(outcome)
    renderGoal()
    await userEvent.click(screen.getByTestId('goal-node-no-target-chip'))
    fireEvent.change(screen.getByTestId(`${EDITOR_ID}-input`), { target: { value: FIGURE } })
    fireEvent.change(screen.getByTestId(`${EDITOR_ID}-unit`), { target: { value: UNIT } })
    await userEvent.click(screen.getByTestId(`${EDITOR_ID}-save`))
    // Bind the exact hook goal and call arguments; a different node/value/unit cannot satisfy this row.
    expect(useModelEditAuthority).toHaveBeenLastCalledWith(GOAL_ID)
    expect(proposeGoalTarget).toHaveBeenCalledTimes(1)
    expect(proposeGoalTarget).toHaveBeenNthCalledWith(1, FIGURE, UNIT, SCENARIO_ID, 'at_least', { onSendSettled: expect.any(Function) })
    expect(screen.queryByTestId(EDITOR_ID)).not.toBeInTheDocument()
    expect(updateNodeData).not.toHaveBeenCalled()
    expect(setState).not.toHaveBeenCalled()
    expect(setGoalThresholdAndUpdateNode).not.toHaveBeenCalled()
    expect(showToast).toHaveBeenCalledWith(outcome === 'dispatched' ? COPY.successTarget.dispatched : COPY.successTarget.changedLocally)
    // A refusal can arrive after dispatch closed the popover; the shared notice must still reach the reader.
    const detail = { refusal: 'declined' as const, reason: 'The goal is a change.' }
    proposeGoalTarget.mock.calls[0][4].onSendSettled('refused', detail)
    expect(showToast).toHaveBeenLastCalledWith(goalTargetSettlementNotice('refused', detail), 'error')
  })

  it('3: Escape closes and returns focus to the chip; an outside press also dismisses', async () => {
    renderGoal()
    const chip = screen.getByTestId('goal-node-no-target-chip')
    await userEvent.click(chip)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByTestId(EDITOR_ID)).not.toBeInTheDocument()
    expect(chip).toHaveFocus()
    await userEvent.click(chip)
    expect(screen.getByTestId(`${EDITOR_ID}-input`)).toHaveFocus()
    await userEvent.click(document.body)
    expect(screen.queryByTestId(EDITOR_ID)).not.toBeInTheDocument()
  })

  it('4: CONTROL — a captured target renders neither chip nor editor', () => {
    renderGoal({ goal_threshold_raw: 30000, goal_threshold_unit: UNIT })
    expect(screen.queryByTestId('goal-node-no-target-chip')).not.toBeInTheDocument()
    expect(screen.queryByTestId(EDITOR_ID)).not.toBeInTheDocument()
    expect(proposeGoalTarget).not.toHaveBeenCalled()
  })

  it('5: Enter and Space open from the band without selecting or moving the React Flow node', async () => {
    const state = seedStore()
    const onNodesChange = vi.fn()
    let flow: Pick<ReactFlowInstance, 'getNode'> | undefined
    const nodeTypes = { goal: withNodeKeyboardScope(GoalNode) }
    render(<div style={{ width: 800, height: 600 }}><ReactFlow
      defaultNodes={state.nodes} nodeTypes={nodeTypes} onNodesChange={onNodesChange}
      onInit={(instance) => { flow = instance }}
    /></div>)
    const chip = await screen.findByTestId('goal-node-no-target-chip')
    const node = flow!.getNode(GOAL_ID)!
    const before = { selected: node.selected, position: { ...node.position } }
    chip.focus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByTestId(`${EDITOR_ID}-input`)).toHaveFocus()
    expect(flow!.getNode(GOAL_ID)!.selected).toBe(before.selected)
    expect(flow!.getNode(GOAL_ID)!.position).toEqual(before.position)
    expect(onNodesChange.mock.calls.flat(2).filter((change) => change.type === 'select' || change.type === 'position')).toEqual([])
    expect(selectNodeWithoutHistory).not.toHaveBeenCalled()
    expect(openNodeInspector).not.toHaveBeenCalled()
    await userEvent.keyboard('{Escape}')
    await userEvent.keyboard(' ')
    expect(screen.getByTestId(`${EDITOR_ID}-input`)).toHaveFocus()
    fireEvent.change(screen.getByTestId(`${EDITOR_ID}-input`), { target: { value: FIGURE } })
    fireEvent.change(screen.getByTestId(`${EDITOR_ID}-unit`), { target: { value: UNIT } })
    screen.getByTestId(`${EDITOR_ID}-input`).focus()
    await userEvent.keyboard('{Enter}')
    expect(screen.queryByTestId(EDITOR_ID)).not.toBeInTheDocument()
    expect(flow!.getNode(GOAL_ID)!.selected).toBe(before.selected)
    expect(flow!.getNode(GOAL_ID)!.position).toEqual(before.position)
    expect(onNodesChange.mock.calls.flat(2).filter((change) => change.type === 'select' || change.type === 'position')).toEqual([])
  })
})
