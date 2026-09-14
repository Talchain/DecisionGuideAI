import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Node } from '@xyflow/react'

const dispatchAction = vi.fn().mockResolvedValue(undefined)
vi.mock('../../conversation/ConversationContext', async importOriginal => ({
  ...await importOriginal<Record<string, unknown>>(),
  useOptionalConversationContext: () => ({ dispatchAction, sendSystemEvent: vi.fn() }),
}))
vi.mock('../../utils/focusHelpers', () => ({ focusNodeById: vi.fn(), focusEdgeById: vi.fn() }))
import { useCanvasStore } from '../../store'
import { ModelTabV2Panel } from '../ModelTabV2Panel'
import { openOutlineGroups } from './openOutlineGroups'
import { buildChipMeta } from '../../conversation/chipMeta'
import { buildV5Payload } from '../../../v5/buildPayload'
import { callV5Turn } from '../../../v5/v5Adapter'
import { OrchestratorTurnPayloadSchema } from '@talchain/schemas/boundary'
import { manualGoalTargetMessage } from '../../conversation/manualGoalTarget'

const goal: Node = { id: 'goal-revenue', type: 'goal', position: { x: 0, y: 0 },
  data: { kind: 'goal', label: 'Annual revenue', goal_threshold_raw: 100000, goal_threshold_unit: '£' } }
const factor: Node = { id: 'factor-cost', type: 'factor', position: { x: 0, y: 0 },
  data: { kind: 'factor', label: 'Cost', observedState: { value: 0.5 } } }
function mount() {
  render(<ModelTabV2Panel nodes={[goal, factor]} edges={[]} goalThreshold={100000} />)
  openOutlineGroups()
}
function edit(value: string) {
  fireEvent.click(screen.getByTestId('model-row-v2-goal-revenue-value'))
  const input = screen.getByLabelText('New value for Annual revenue')
  fireEvent.change(input, { target: { value } })
  return input
}
beforeEach(() => {
  vi.clearAllMocks()
  useCanvasStore.setState({ nodes: [structuredClone(goal), structuredClone(factor)], edges: [], currentScenarioId: 'scenario-a' })
})
afterEach(() => { cleanup() })

describe('manual goal target uses the existing canonical typed action', () => {
  it('opens an explicit minimum target in its own units; discard sends and changes nothing', () => {
    mount()
    const before = structuredClone(useCanvasStore.getState().nodes)
    edit('120000')
    expect(screen.getByLabelText('Target unit for Annual revenue')).toHaveValue('£')
    fireEvent.keyDown(screen.getByLabelText('New value for Annual revenue'), { key: 'Escape' })
    expect(dispatchAction).not.toHaveBeenCalled()
    expect(useCanvasStore.getState().nodes).toEqual(before)
  })
  it('requires explicit confirmation, sends exact raw value/unit and does not invent an acknowledgement', () => {
    mount()
    const before = structuredClone(useCanvasStore.getState().nodes)
    const input = edit('120000')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(dispatchAction).not.toHaveBeenCalled()
    expect(useCanvasStore.getState().nodes).toEqual(before)
    expect(screen.getByTestId('model-row-v2-goal-revenue-value-to')).toHaveTextContent('At least 120000 £ (absolute level)')
    fireEvent.click(screen.getByRole('button', { name: 'Confirm new value for Annual revenue' }))
    expect(dispatchAction).toHaveBeenCalledOnce()
    expect(dispatchAction.mock.calls[0][0]).toMatchObject({ action_type: 'add_constraint',
      source: 'inspector', parameters: { target_id: 'goal-revenue', constraint_type: 'at_least', value: 120000, unit: '£' },
      message: 'This goal must be at least £120000. This is an absolute level, not a change from the current level.' })
    expect(useCanvasStore.getState().nodes).toEqual(before)
  })
  it('has a working factor control as the opposite control', () => {
    mount()
    fireEvent.click(screen.getByTestId('model-row-v2-factor-cost-value'))
    expect(screen.getByLabelText('New value for Cost')).toBeInTheDocument()
    expect(dispatchAction).not.toHaveBeenCalled()
  })
  it('does not offer a success target on the decision/question row', () => {
    const question = { ...goal, id: 'question-a', type: 'decision', data: { kind: 'decision', label: 'Which plan?' } }
    render(<ModelTabV2Panel nodes={[question]} edges={[]} goalThreshold={null} />)
    openOutlineGroups()
    expect(screen.getByTestId('model-row-v2-question-a-value').tagName).toBe('SPAN')
  })
  it.each(['', '0', '-1', '120k', '1e999', '0x10', '120000 pounds'])('does not send invalid target %j', value => {
    mount()
    const input = edit(value)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.queryByRole('button', { name: 'Confirm new value for Annual revenue' })).not.toBeInTheDocument()
    expect(dispatchAction).not.toHaveBeenCalled()
  })
  it('requires a unit instead of silently guessing one', () => {
    mount()
    const input = edit('120000')
    fireEvent.change(screen.getByLabelText('Target unit for Annual revenue'), { target: { value: '  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.queryByRole('button', { name: 'Confirm new value for Annual revenue' })).not.toBeInTheDocument()
    expect(dispatchAction).not.toHaveBeenCalled()
  })
  it('shows changed units in the proposal and passes those exact units', () => {
    mount()
    const input = edit('80')
    fireEvent.change(screen.getByLabelText('Target unit for Annual revenue'), { target: { value: '%' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByTestId('model-row-v2-goal-revenue-value-to')).toHaveTextContent('At least 80 % (absolute level)')
    fireEvent.click(screen.getByRole('button', { name: 'Confirm new value for Annual revenue' }))
    expect(dispatchAction.mock.calls[0][0].parameters).toMatchObject({ value: 80, unit: '%' })
    expect(dispatchAction.mock.calls[0][0].message).toBe('This goal must be at least 80%. This is an absolute level, not a change from the current level.')
  })
  it('does not retarget an open proposal when another scenario reuses the goal id', () => {
    mount()
    const input = edit('120000')
    fireEvent.keyDown(input, { key: 'Enter' })
    useCanvasStore.setState({ currentScenarioId: 'scenario-b' })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm new value for Annual revenue' }))
    expect(dispatchAction).not.toHaveBeenCalled()
    expect(useCanvasStore.getState().nodes[0].data.goal_threshold_raw).toBe(100000)
    expect(screen.getByRole('alert')).toHaveTextContent('Target not sent')
  })
  it('renders the node’s stated target and unit rather than a different global scalar', () => {
    render(<ModelTabV2Panel nodes={[goal, factor]} edges={[]} goalThreshold={0.8} />)
    openOutlineGroups()
    // ⚠ WAS `'100,000 £'`. A prefix currency now renders in front of the number
    // — the defect witnessed on staging 10 Sep 2026 (deploy
    // `6aa1fdec0d71200008252154`, UI `9eb30b54`), where the canvas card said
    // `Target: £250,000` and this row said `250,000 £` for one figure. See
    // `theModelTabPutsTheCurrencyInFront.spec.ts`.
    //
    // ⭐ THE STRING IS INCIDENTAL TO WHAT THIS TEST IS FOR, AND THE
    // DISCRIMINATION IS UNCHANGED. Its question is WHICH VALUE the row reads —
    // the node's `goal_threshold_raw` (100000) or the global scalar passed as
    // `goalThreshold={0.8}` — not where the symbol sits. `£100,000` is no more
    // producible from `0.8` than `100,000 £` was, so this remains a real
    // discriminator rather than a restated expectation. It is NOT a dated
    // capture corpus (CLAUDE.md trap 14b): nothing here records a sentence a
    // build once emitted, so updating it falsifies no evidence.
    expect(screen.getByTestId('model-row-v2-goal-revenue-value')).toHaveTextContent('£100,000')
  })
  it('carries the confirmed action through the real payload and HTTP adapter, with no text routing', async () => {
    mount()
    fireEvent.keyDown(edit('120000'), { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm new value for Annual revenue' }))
    const opts = dispatchAction.mock.calls[0][0]
    const built = buildV5Payload({ turnId: '11111111-1111-4111-8111-111111111111',
      scenarioId: '22222222-2222-4222-8222-222222222222', stage: 'analyse', turnClass: 'frame',
      mode: 'user', message: opts.message, source: opts.source, chipMeta: buildChipMeta(opts) })
    if (!built.ok) throw new Error('typed target did not build')
    OrchestratorTurnPayloadSchema.parse(built.payload)
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ response_version: 1, assistant_text: 'ok', blocks: [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }))
    await callV5Turn(built.payload, { fetchImpl })
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body)
    /**
     * ⚠ A LITERAL, NOT THE PRODUCER. This read
     * `toBe(manualGoalTargetMessage(120000, '£'))`, which puts the function
     * under test on BOTH sides: any change to the sentence moves the
     * expectation with it and the assertion cannot RED in either direction
     * (CLAUDE.md trap 13b, a guard agreeing with itself). Spelled out, it now
     * pins what actually crossed the wire — including the BOUND, which is the
     * half that was never stated to the reader who set it.
     */
    expect(body.message).toBe(
      'This goal must be at least £120000. This is an absolute level, not a change from the current level.')
    expect(body.source).toBe('chip_click')
    expect(body.chip).toMatchObject({ action_type: 'add_constraint', parameters: {
      target_id: 'goal-revenue', constraint_type: 'at_least', value: 120000, unit: '£' } })
  })
  it.each([[120000, '£', '£120000'], [80, '%', '80%'], [12.5, 'points', '12.5 points'],
    [1e21, '$', '$1000000000000000000000'], [1e-7, 'points', '0.0000001 points']] as const)(
    'states the exact %s %s amount without scientific notation or unit reassignment', (value, unit, amount) => {
      expect(manualGoalTargetMessage(value, unit, 'at_least')).toBe(
        `This goal must be at least ${amount}. This is an absolute level, not a change from the current level.`)
      /**
       * ⭐ THE OPPOSITE-DIRECTION TWIN, on the SAME amount. The amount
       * formatting is direction-independent and must stay so: a bound that
       * changed how a figure is rendered would be a second defect hiding
       * behind the first. Every case here gets both doors watched
       * (CLAUDE.md trap 22b).
       */
      expect(manualGoalTargetMessage(value, unit, 'at_most')).toBe(
        `This goal must be at most ${amount}. This is an absolute level, not a change from the current level.`)
    })
})
