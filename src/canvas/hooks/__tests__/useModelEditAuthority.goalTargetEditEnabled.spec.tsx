/**
 * `proposeGoalTarget` with `GOAL_TARGET_EDIT_ENABLED` forced `true` —
 * simulating the world AFTER CEE deploys a `goal_target_edit` reader. The
 * production default is `false` (`goalTargetEdit.ts`'s header); this file
 * exists only to prove the flagged branch, and is the flag-ON half of a pair
 * with `useModelEditAuthority.goalTargetEdit.spec.tsx` (the flag-OFF
 * contrast). See that file's header for why they are split rather than
 * combined: `vi.mock` is hoisted per file, not per `describe`.
 *
 * Mirrors `useModelEditAuthority.optionIntervention.spec.tsx`'s discipline on
 * this exact surface: NO local write, the exact payload, and the refusals
 * that must NOT reach the wire.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const sendSystemEvent = vi.fn()
const dispatchAction = vi.fn((..._args: unknown[]) => Promise.resolve())
vi.mock('../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => ({ sendSystemEvent, dispatchAction }) }
})
vi.mock('../../conversation/goalTargetEdit', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, GOAL_TARGET_EDIT_ENABLED: true }
})

import { useModelEditAuthority } from '../useModelEditAuthority'
import { useCanvasStore } from '../../store'

const GOAL = 'goal_reduce_churn'
const SCENARIO = 'scn_1'
const HASH = '9f2c1b0ae4d37c5a'

function seed(lastServerGraphHash: string | null = HASH) {
  useCanvasStore.setState(
    {
      currentScenarioId: SCENARIO,
      lastServerGraphHash,
      nodes: [
        {
          id: GOAL, type: 'goal', position: { x: 0, y: 0 },
          data: { label: 'Reduce churn', kind: 'goal' },
        },
      ],
      edges: [],
    } as never,
    false,
  )
}

function authorityFor() {
  return renderHook(() => useModelEditAuthority(GOAL)).result
}

beforeEach(() => {
  vi.clearAllMocks()
  seed()
})

describe('the dispatched payload', () => {
  it('sends the typed event with the goal id, direction, magnitude, unit and base hash', () => {
    const outcome = authorityFor().current.proposeGoalTarget('12', 'months', SCENARIO, 'at_least')
    expect(outcome).toBe('dispatched')
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    expect(sendSystemEvent.mock.calls[0]?.[0]).toEqual({
      type: 'goal_target_edit',
      payload: {
        goal_node_id: GOAL,
        constraint_type: 'at_least',
        raw_value: 12,
        unit: 'months',
        base_graph_hash: HASH,
      },
    })
    expect(dispatchAction).not.toHaveBeenCalled()
  })

  it('⭐ writes NOTHING to the store — the applied response owns that', () => {
    authorityFor().current.proposeGoalTarget('12', 'months', SCENARIO, 'at_least')
    const goal = useCanvasStore.getState().nodes.find((n) => n.id === GOAL)
    expect((goal?.data as Record<string, unknown>)?.success_threshold).toBeUndefined()
  })

  it('settles through settleSystemEventSend and reports it to the caller', async () => {
    sendSystemEvent.mockResolvedValueOnce('sent')
    const onSendSettled = vi.fn()
    authorityFor().current.proposeGoalTarget('12', 'months', SCENARIO, 'at_least', {
      onSendSettled,
    })
    await vi.waitFor(() => expect(onSendSettled).toHaveBeenCalled())
    expect(onSendSettled).toHaveBeenCalledWith('sent', {})
  })

  it('accepts a zero at_most ceiling — a real, sayable value (Codex amendment 5821693599)', () => {
    expect(authorityFor().current.proposeGoalTarget('0', 'months', SCENARIO, 'at_most')).toBe(
      'dispatched',
    )
    expect(sendSystemEvent.mock.calls[0]?.[0]?.payload).toMatchObject({ raw_value: 0 })
  })
})

describe('what must never reach the wire', () => {
  it('refuses an unparseable draft before ever building an event', () => {
    expect(
      authorityFor().current.proposeGoalTarget('not a number', 'months', SCENARIO, 'at_least'),
    ).toBe('not_encodable')
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it('refuses a zero at_least floor client-side — never reaches the wire', () => {
    expect(authorityFor().current.proposeGoalTarget('0', 'months', SCENARIO, 'at_least')).toBe(
      'not_encodable',
    )
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it('refuses (not_encodable) with no server-stamped base hash — the reload case', () => {
    // ⚠ `needs_fresh_base` IS FOLDED TO `not_encodable` AT THIS AUTHORITY, and
    // that is a scope decision pinned by `useModelEditAuthority.ts`'s own
    // comment — the outcome union this authority returns predates the split
    // `proposeOptionIntervention` uses and has no slot for a sixth member.
    seed(null)
    expect(authorityFor().current.proposeGoalTarget('12', 'months', SCENARIO, 'at_least')).toBe(
      'not_encodable',
    )
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it('refuses when the node is not a goal, or the scenario has moved on', () => {
    seed()
    useCanvasStore.setState(
      { nodes: [{ id: GOAL, type: 'factor', position: { x: 0, y: 0 }, data: {} }] } as never,
      false,
    )
    expect(authorityFor().current.proposeGoalTarget('12', 'months', SCENARIO, 'at_least')).toBe(
      'not_encodable',
    )
    expect(sendSystemEvent).not.toHaveBeenCalled()

    seed()
    expect(
      authorityFor().current.proposeGoalTarget('12', 'months', 'a_different_scenario', 'at_least'),
    ).toBe('not_encodable')
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it('POSITIVE CONTROL: the refusals above are each about their own cause', () => {
    expect(authorityFor().current.proposeGoalTarget('12', 'months', SCENARIO, 'at_least')).toBe(
      'dispatched',
    )
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
  })
})
