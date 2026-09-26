import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Node } from '@xyflow/react'

/**
 * ⭐ SINCE THE FLIP (`GOAL_TARGET_EDIT_ENABLED` is `true`, `goalTargetEdit.ts`)
 * a confirmed goal target leaves as the typed `goal_target_edit` system event
 * through `sendSystemEvent` — not `add_constraint` + a sentence through
 * `dispatchAction`. Every "nothing was sent" case below therefore asserts BOTH
 * carriers silent, so neither can pass by the other one being the live one.
 */
const dispatchAction = vi.fn().mockResolvedValue(undefined)
const sendSystemEvent = vi.fn().mockResolvedValue('sent')
vi.mock('../../conversation/ConversationContext', async importOriginal => ({
  ...await importOriginal<Record<string, unknown>>(),
  useOptionalConversationContext: () => ({ dispatchAction, sendSystemEvent }),
}))
vi.mock('../../utils/focusHelpers', () => ({ focusNodeById: vi.fn(), focusEdgeById: vi.fn() }))
import { useCanvasStore } from '../../store'
import { ModelTabV2Panel } from '../ModelTabV2Panel'
import { openOutlineGroups } from './openOutlineGroups'
import { buildV5Payload } from '../../../v5/buildPayload'
import { callV5Turn } from '../../../v5/v5Adapter'
import { manualGoalTargetMessage } from '../../conversation/manualGoalTarget'
import { SystemEventSendError } from '../../conversation/useConversation'

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
const BASE_HASH = '5c0e7a19d2b84f36'
beforeEach(() => {
  vi.clearAllMocks()
  sendSystemEvent.mockReset()
  sendSystemEvent.mockResolvedValue('sent')
  useCanvasStore.setState({
    nodes: [structuredClone(goal), structuredClone(factor)], edges: [], currentScenarioId: 'scenario-a',
    lastServerGraphHash: BASE_HASH,
  } as never)
})
/** Nothing left the panel on EITHER carrier. */
function expectNothingSent() {
  expect(sendSystemEvent).not.toHaveBeenCalled()
  expect(dispatchAction).not.toHaveBeenCalled()
}
afterEach(() => { cleanup() })

describe('manual goal target uses the existing canonical typed action', () => {
  it('opens an explicit minimum target in its own units; discard sends and changes nothing', () => {
    mount()
    const before = structuredClone(useCanvasStore.getState().nodes)
    edit('120000')
    expect(screen.getByLabelText('Target unit for Annual revenue')).toHaveValue('£')
    fireEvent.keyDown(screen.getByLabelText('New value for Annual revenue'), { key: 'Escape' })
    expectNothingSent()
    expect(useCanvasStore.getState().nodes).toEqual(before)
  })
  it('requires explicit confirmation, sends exact raw value/unit and does not invent an acknowledgement', () => {
    mount()
    const before = structuredClone(useCanvasStore.getState().nodes)
    const input = edit('120000')
    fireEvent.keyDown(input, { key: 'Enter' })
    expectNothingSent()
    expect(useCanvasStore.getState().nodes).toEqual(before)
    /**
     * ⭐ UPDATED 15 Sep 2026, AND THIS SPEC ENCODED THE DEFECT.
     *
     * It asserted the review line as `120000 £` while line ~129 below asserts
     * the COMMITTED value as `£100,000` — the same figure, two spellings, both
     * pinned as correct in one file. Watched live in a single edit flow:
     * `At least 25000 £` → `£25,000` → `≥ £25,000`.
     *
     * The review line is the sentence the reader confirms AGAINST, so it is the
     * one that must match what lands. It now composes through
     * `formatValueWithUnit` — the same formatter `adapters.ts` uses for the
     * committed value — so the two are one string by construction.
     *
     * ⚠ Only the CURRENCY case moves: `%` is neither a currency symbol, an ISO
     * code nor a generic placeholder, so it still renders `80 %` (see the `%`
     * expectation further down, deliberately unchanged).
     */
    expect(screen.getByTestId('model-row-v2-goal-revenue-value-to')).toHaveTextContent('At least £120,000 (absolute level)')
    fireEvent.click(screen.getByRole('button', { name: 'Confirm new value for Annual revenue' }))
    expect(sendSystemEvent).toHaveBeenCalledOnce()
    expect(dispatchAction).not.toHaveBeenCalled()
    expect(sendSystemEvent.mock.calls[0][0]).toEqual({
      type: 'goal_target_edit',
      payload: { goal_node_id: 'goal-revenue', constraint_type: 'at_least', raw_value: 120000, unit: '£', base_graph_hash: '5c0e7a19d2b84f36' },
    })
    expect(useCanvasStore.getState().nodes).toEqual(before)
  })
  it('has a working factor control as the opposite control', () => {
    mount()
    fireEvent.click(screen.getByTestId('model-row-v2-factor-cost-value'))
    expect(screen.getByLabelText('New value for Cost')).toBeInTheDocument()
    expectNothingSent()
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
    expectNothingSent()
  })
  it('requires a unit instead of silently guessing one', () => {
    mount()
    const input = edit('120000')
    fireEvent.change(screen.getByLabelText('Target unit for Annual revenue'), { target: { value: '  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.queryByRole('button', { name: 'Confirm new value for Annual revenue' })).not.toBeInTheDocument()
    expectNothingSent()
  })
  it('shows changed units in the proposal and passes those exact units', () => {
    mount()
    const input = edit('80')
    fireEvent.change(screen.getByLabelText('Target unit for Annual revenue'), { target: { value: '%' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByTestId('model-row-v2-goal-revenue-value-to')).toHaveTextContent('At least 80 % (absolute level)')
    fireEvent.click(screen.getByRole('button', { name: 'Confirm new value for Annual revenue' }))
    expect(sendSystemEvent.mock.calls[0][0].payload).toMatchObject({ raw_value: 80, unit: '%' })
    expect(dispatchAction).not.toHaveBeenCalled()
  })
  it('does not retarget an open proposal when another scenario reuses the goal id', () => {
    mount()
    const input = edit('120000')
    fireEvent.keyDown(input, { key: 'Enter' })
    useCanvasStore.setState({ currentScenarioId: 'scenario-b' })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm new value for Annual revenue' }))
    expectNothingSent()
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
  it('carries the confirmed target through the real payload and HTTP adapter as a typed system event', async () => {
    mount()
    fireEvent.keyDown(edit('120000'), { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm new value for Annual revenue' }))
    const event = sendSystemEvent.mock.calls[0][0]
    const built = buildV5Payload({ turnId: '11111111-1111-4111-8111-111111111111',
      scenarioId: '22222222-2222-4222-8222-222222222222', stage: 'analyse', turnClass: 'frame',
      mode: 'system', systemEvent: event })
    if (!built.ok) throw new Error('typed target did not build')
    // ⚠ NOT `OrchestratorTurnPayloadSchema.parse`: the UI still vendors 0.55.0,
    // whose union has no `goal_target_edit` member, so the vendored schema would
    // refuse a body CEE #1859's 0.59.0 accepts. That acceptance was checked
    // against CEE's own vendored tgz (Task A of the flip); here the body is
    // pinned as a LITERAL, which is what actually crosses the wire.
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ response_version: 1, assistant_text: 'ok', blocks: [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }))
    await callV5Turn(built.payload, { fetchImpl })
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body)
    expect(body).toEqual({
      kind: 'system_event',
      turn_id: '11111111-1111-4111-8111-111111111111',
      scenario_id: '22222222-2222-4222-8222-222222222222',
      stage: 'analyse',
      event: {
        kind: 'goal_target_edit',
        goal_node_id: 'goal-revenue',
        constraint_type: 'at_least',
        raw_value: 120000,
        unit: '£',
        base_graph_hash: '5c0e7a19d2b84f36',
      },
    })
    // No text routing: a system event has no message, source or chip at all.
    expect('message' in body).toBe(false)
    expect('chip' in body).toBe(false)
    expect(dispatchAction).not.toHaveBeenCalled()
  })

  /**
   * ⭐⭐ A REFUSED TARGET IS SAID ON THE ROW — AND BEFORE THE FLIP IT DID NOT
   * NEED TO BE. `add_constraint` was a MESSAGE turn, so CEE's refusal arrived as
   * a reply in the conversation. A refused SYSTEM EVENT renders no bubble, so
   * the row closing on `dispatched` and never listening made a 409 or 422
   * silent. The row now re-opens the reader's own proposal with the shared
   * sentence (`goalTargetSettlementNotice`). Literals; the two refusals are
   * asserted apart.
   */
  async function confirmAndSettle(rejection: unknown) {
    sendSystemEvent.mockReset()
    sendSystemEvent.mockRejectedValue(rejection)
    mount()
    fireEvent.keyDown(edit('120000'), { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm new value for Annual revenue' }))
    expect(sendSystemEvent).toHaveBeenCalledOnce()
    return screen.findByRole('alert')
  }
  it('a stale-base 409 re-opens the proposal and says the model changed', async () => {
    const alert = await confirmAndSettle(
      new SystemEventSendError('server', { conflictCategory: 'BASE_HASH_DIVERGED', reason: 'graph_write_conflict' }))
    expect(alert).toHaveTextContent(
      'Not recorded — the model changed while this was sending, so nothing was written. Ask Olumi anything, then set the target again.')
    // The reader's own proposal is back, so the remedy is one press away.
    expect(screen.getByTestId('model-row-v2-goal-revenue-value-to')).toHaveTextContent('At least £120,000 (absolute level)')
  })
  it('a 422 refused_no_write says the target was refused — not that the model moved', async () => {
    const alert = await confirmAndSettle(
      new SystemEventSendError('server', { code: 'INGRESS_CONTRACT_VIOLATION', reason: 'system_event_refused_no_write' }))
    expect(alert).toHaveTextContent('Not recorded — this target was refused, so the model is unchanged.')
    expect(alert).not.toHaveTextContent(/model changed|system_event_refused_no_write/)
  })
  it('CONTRAST — a send that settled `sent` stays closed and says nothing on the row', async () => {
    mount()
    fireEvent.keyDown(edit('120000'), { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm new value for Annual revenue' }))
    await new Promise(r => setTimeout(r, 0))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByTestId('model-row-v2-goal-revenue-value-to')).not.toBeInTheDocument()
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
