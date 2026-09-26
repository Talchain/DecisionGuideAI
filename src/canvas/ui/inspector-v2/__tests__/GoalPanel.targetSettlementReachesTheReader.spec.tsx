/**
 * ⭐⭐ THE GOAL TARGET'S SEND SETTLEMENT REACHES THE READER, now that the typed
 * `goal_target_edit` carrier is ARMED (`GOAL_TARGET_EDIT_ENABLED` is `true` in
 * production — read UNMOCKED here, so flipping it back REDs this file).
 *
 * `GoalPanel.targetReachesTheModel.spec.tsx` already pins the flag-OFF world:
 * a dispatch always shows the same static "Sent to Olumi. Its reply says
 * whether the target was recorded." sentence, because the `add_constraint`
 * path has no settlement to report at all. This file is that spec's flag-ON
 * twin, driven through the same real Router: with the typed carrier, the
 * settlement `sendSystemEvent`'s promise resolves to is what decides the
 * sentence, exactly as `FactorControllablePanel`'s value editor already does
 * for factor values.
 *
 * Split into its own file rather than added to the flag-OFF one for the same
 * reason `useModelEditAuthority.goalTargetEditEnabled.spec.tsx` is split from
 * its sibling: `vi.mock` is hoisted per FILE, not per `describe`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Node } from '@xyflow/react'

const dispatchAction = vi.fn()
const sendSystemEvent = vi.fn()

vi.mock('@xyflow/react', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))
vi.mock('../../../conversation/ConversationContext', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useOptionalConversationContext: () => ({ dispatchAction, sendSystemEvent }),
}))
vi.mock('../../../../contexts/AuthContext', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../../contexts/AuthContext')>()
  return { ...actual, useAuth: vi.fn(() => ({ authenticated: true, user: { id: 'u-1', email: 'a@b.io' } })) }
})

import { InspectorRouter } from '../InspectorRouter'
import { useCanvasStore } from '../../../store'
import { SystemEventSendError } from '../../../conversation/useConversation'
import {
  GOAL_TARGET_NOT_RECORDED_CONFLICT,
  GOAL_TARGET_NOT_RECORDED_DECLINED,
} from '../../../conversation/goalTargetEdit'

const GOAL_ID = 'goal_mrr'
const SCENARIO_ID = 'scenario-a'
/** A category `isProvenNoWriteConflict` certifies as "the producer wrote nothing". */
const PROVEN_NO_WRITE = 'BASE_HASH_DIVERGED'

function goalNode(): Node {
  return {
    id: GOAL_ID,
    type: 'goal',
    position: { x: 0, y: 0 },
    data: { kind: 'goal', label: 'Reach £30k MRR within 18 months', goal_threshold_unit: '£' },
  } as unknown as Node
}

function seed() {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    lastServerGraphHash: 'f3d31f75957c5cb5',
    nodes: [goalNode()] as never[],
    edges: [] as never[],
    results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    goalThreshold: null,
    goalThresholdRepresentation: null,
    goalConstraints: null,
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
}

function openGoal() {
  return render(<InspectorRouter nodeId={GOAL_ID} edgeId={null} onClose={vi.fn()} />)
}

async function stateTarget(amount: string) {
  const user = userEvent.setup()
  await user.click(screen.getByTestId('goal-panel-target-edit'))
  const input = screen.getByTestId('goal-panel-target-input')
  await user.clear(input)
  await user.type(input, amount)
  await user.click(screen.getByTestId('goal-panel-target-save'))
}

beforeEach(() => {
  dispatchAction.mockReset()
  sendSystemEvent.mockReset()
  seed()
})
afterEach(cleanup)

describe('the typed carrier fires instead of add_constraint', () => {
  it('sends goal_target_edit; add_constraint is never dispatched', async () => {
    sendSystemEvent.mockResolvedValue('sent')
    openGoal()
    await stateTarget('30000')
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    expect(sendSystemEvent.mock.calls[0]?.[0]).toMatchObject({
      type: 'goal_target_edit',
      payload: { goal_node_id: GOAL_ID, constraint_type: 'at_least', raw_value: 30000, unit: '£' },
    })
    expect(dispatchAction).not.toHaveBeenCalled()
  })
})

describe('the sentence is the one the settlement earned', () => {
  it('a settled SEND shows the same honest "its reply says" sentence as today', async () => {
    sendSystemEvent.mockResolvedValue('sent')
    openGoal()
    await stateTarget('30000')
    await waitFor(() =>
      expect(
        screen.getByText('Sent to Olumi. Its reply says whether the target was recorded.'),
      ).toBeTruthy(),
    )
  })

  it('a PROVEN no-write refusal says NOT RECORDED — never the generic "sent" sentence', async () => {
    sendSystemEvent.mockRejectedValue(
      new SystemEventSendError('server', { conflictCategory: PROVEN_NO_WRITE }),
    )
    openGoal()
    await stateTarget('30000')
    await waitFor(() =>
      expect(screen.getByTestId('goal-panel-target-outcome').textContent).toMatch(/not recorded/i),
    )
    expect(
      screen.queryByText('Sent to Olumi. Its reply says whether the target was recorded.'),
    ).toBeNull()
  })

  /**
   * ⭐⭐ THE TWO PROVEN NO-WRITES ARE NAMED APART, AND NEITHER POINTS AT A REPLY.
   * A refused SYSTEM EVENT renders no transcript bubble, so "Olumi's reply says
   * why" — the one collapsed sentence this pane used to show — pointed the
   * reader at nothing. The stale base (409) names the remedy that refreshes it;
   * CEE's outright decline (422 `system_event_refused_no_write`) names none,
   * because repeating it cannot succeed. Literals, both, and both asserted
   * against the other so a re-collapse REDs.
   */
  it('a stale-base 409 (BASE_HASH_DIVERGED) says the model changed and names the remedy', async () => {
    sendSystemEvent.mockRejectedValue(
      new SystemEventSendError('server', { conflictCategory: 'BASE_HASH_DIVERGED', reason: 'graph_write_conflict' }),
    )
    openGoal()
    await stateTarget('30000')
    await waitFor(() =>
      expect(screen.getByTestId('goal-panel-target-outcome').textContent).toBe(
        'Not recorded — the model changed while this was sending, so nothing was written. Ask Olumi anything, then set the target again.',
      ),
    )
    expect(GOAL_TARGET_NOT_RECORDED_CONFLICT).toBe(screen.getByTestId('goal-panel-target-outcome').textContent)
    expect(screen.getByTestId('goal-panel-target-outcome').textContent).not.toMatch(/reply says why/i)
  })

  it('a 422 `system_event_refused_no_write` says the target was REFUSED — no stale-base remedy', async () => {
    sendSystemEvent.mockRejectedValue(
      new SystemEventSendError('server', {
        code: 'INGRESS_CONTRACT_VIOLATION',
        reason: 'system_event_refused_no_write',
      }),
    )
    openGoal()
    await stateTarget('30000')
    await waitFor(() =>
      expect(screen.getByTestId('goal-panel-target-outcome').textContent).toBe(
        'Not recorded — this target was refused, so the model is unchanged.',
      ),
    )
    expect(GOAL_TARGET_NOT_RECORDED_DECLINED).toBe(screen.getByTestId('goal-panel-target-outcome').textContent)
    // The machine token is never shown, and no remedy that cannot succeed is offered.
    expect(screen.getByTestId('goal-panel-target-outcome').textContent).not.toMatch(/system_event_refused_no_write|set the target again/)
  })

  it('an UNVERIFIED transport failure says "may not have recorded" — never a confident claim either way', async () => {
    sendSystemEvent.mockRejectedValue(new SystemEventSendError('transport'))
    openGoal()
    await stateTarget('30000')
    await waitFor(() =>
      expect(screen.getByTestId('goal-panel-target-outcome').textContent).toMatch(
        /may not have recorded/i,
      ),
    )
  })

  it('CONTRAST: the three sentences are three different sentences', async () => {
    sendSystemEvent.mockResolvedValue('sent')
    openGoal()
    await stateTarget('30000')
    const sent = await waitFor(() => screen.getByTestId('goal-panel-target-outcome').textContent)

    cleanup()
    sendSystemEvent.mockReset()
    sendSystemEvent.mockRejectedValue(
      new SystemEventSendError('server', { conflictCategory: PROVEN_NO_WRITE }),
    )
    seed()
    openGoal()
    await stateTarget('30000')
    const refused = await waitFor(() => screen.getByTestId('goal-panel-target-outcome').textContent)

    cleanup()
    sendSystemEvent.mockReset()
    sendSystemEvent.mockRejectedValue(new SystemEventSendError('transport'))
    seed()
    openGoal()
    await stateTarget('30000')
    const unverified = await waitFor(() => screen.getByTestId('goal-panel-target-outcome').textContent)

    expect(new Set([sent, refused, unverified]).size).toBe(3)
  })
})

describe('two attempts: the status belongs to the NEWEST attempt (pre-review finding 5825017549)', () => {
  it('A pending, B blocked, then A settles — the panel still shows B\'s "Not sent"', async () => {
    let resolveA: (v: unknown) => void = () => {}
    sendSystemEvent
      .mockImplementationOnce(() => new Promise(r => { resolveA = r }))
      .mockResolvedValueOnce('send_blocked')
    openGoal()
    await stateTarget('30000')
    await stateTarget('35000')
    await waitFor(() =>
      expect(screen.getByTestId('goal-panel-target-outcome').textContent).toMatch(/^Not sent/),
    )
    resolveA('sent')
    await new Promise(r => setTimeout(r, 50))
    expect(sendSystemEvent).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('goal-panel-target-outcome').textContent).toMatch(/^Not sent/)
    expect(screen.queryByText('Sent to Olumi. Its reply says whether the target was recorded.')).toBeNull()
  })

  it('CONTRAST — a single attempt that settles `sent` does show the sent sentence', async () => {
    sendSystemEvent.mockResolvedValueOnce('sent')
    openGoal()
    await stateTarget('30000')
    await waitFor(() =>
      expect(screen.getByText('Sent to Olumi. Its reply says whether the target was recorded.')).toBeTruthy(),
    )
  })
})
