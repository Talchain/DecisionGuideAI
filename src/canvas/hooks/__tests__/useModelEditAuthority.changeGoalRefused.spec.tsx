/**
 * ⛔ R1 S4-core (MG 5879952291): the edit authority never overwrites a goal target stated as a CHANGE from today with a
 * level figure — on either carrier. CEE refuses the same write by name (`goal_is_a_change`, all four goal writers); this
 * refuses it before anything is sent, whichever editor asked. Contrast: the same goal as a level is dispatched.
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
  return { ...actual, GOAL_TARGET_EDIT_ENABLED: false }
})

import { useModelEditAuthority } from '../useModelEditAuthority'
import { useCanvasStore } from '../../store'

const GOAL = 'goal_reduce_churn'
const SCENARIO = 'scn_1'

function seed() {
  useCanvasStore.setState(
    {
      currentScenarioId: SCENARIO,
      lastServerGraphHash: '9f2c1b0ae4d37c5a',
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

function seedFrame(frame: string | undefined) {
  useCanvasStore.setState(
    {
      nodes: [{
        id: GOAL, type: 'goal', position: { x: 0, y: 0 },
        data: { label: 'Reduce churn', kind: 'goal', goal_threshold_raw: -0.15, goal_threshold_unit: '%', ...(frame ? { goal_threshold_frame: frame } : {}) },
      }],
    } as never,
    false,
  )
}

describe('a change goal is refused at the authority', () => {
  it.each(['change_rel', 'change_abs', 'CHANGE_REL', 'bogus'])('RED: %s → not_encodable, nothing dispatched or sent', (frame) => {
    seedFrame(frame)
    expect(authorityFor().current.proposeGoalTarget('12', 'months', SCENARIO, 'at_least')).toBe('not_encodable')
    expect(dispatchAction).not.toHaveBeenCalled()
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it.each([undefined, 'level', 'delta'])('⛔ CONTRAST: frame %s is a level and is dispatched as before', (frame) => {
    seedFrame(frame)
    expect(authorityFor().current.proposeGoalTarget('12', 'months', SCENARIO, 'at_least')).toBe('dispatched')
    expect(dispatchAction).toHaveBeenCalledTimes(1)
  })
})
