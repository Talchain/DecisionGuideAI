/**
 * `proposeGoalTarget` with `GOAL_TARGET_EDIT_ENABLED` forced `false` — the
 * `add_constraint` FALLBACK. ⚠ No longer the production default: the flag is
 * ARMED (`true`) on `canvas/goal-target-edit-live` (see `goalTargetEdit.ts`),
 * so this file now mocks it `false` to keep the fallback branch — still in
 * `useModelEditAuthority` — honest for as long as it exists. This is the
 * CONTRAST half of the pair;
 * `useModelEditAuthority.goalTargetEditEnabled.spec.tsx` is the flag-ON half.
 * Split into two files rather than one `describe` block per flag value,
 * because `vi.mock` is hoisted per FILE regardless of which `describe` it is
 * written under — a single file cannot give the two halves different mocked
 * values of the same module.
 *
 * ⭐ THE CLAIM HERE IS "BYTE-IDENTICAL TO TODAY". `add_constraint` behaviour in
 * full is already pinned in depth by `successTargetDispatches.spec.tsx`,
 * `successTargetDirection.spec.tsx` and their siblings; this file is the
 * authority-level version of the same claim, run alongside the new flagged
 * branch so a regression in either shows up beside its own contrast.
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

describe('flag OFF (the add_constraint fallback) — byte-identical to the pre-flip path', () => {
  it('takes the add_constraint path: dispatchAction fires, sendSystemEvent never does', () => {
    const outcome = authorityFor().current.proposeGoalTarget('12', 'months', SCENARIO, 'at_least')
    expect(outcome).toBe('dispatched')
    expect(dispatchAction).toHaveBeenCalledTimes(1)
    expect(dispatchAction.mock.calls[0]?.[0]).toMatchObject({ action_type: 'add_constraint' })
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it('an onSendSettled callback is inert — nothing to settle on this path', () => {
    const onSendSettled = vi.fn()
    authorityFor().current.proposeGoalTarget('12', 'months', SCENARIO, 'at_least', { onSendSettled })
    expect(onSendSettled).not.toHaveBeenCalled()
  })

  it('a zero at_most draft is STILL refused (existing add_constraint rule, unchanged)', () => {
    // `buildManualGoalTarget` refuses `value <= 0` for EVERY direction,
    // `at_most` included — the flagged path's zero-for-`at_most` widening
    // (Codex amendment 5821693599) must not leak into this path while the
    // flag is off.
    expect(authorityFor().current.proposeGoalTarget('0', 'months', SCENARIO, 'at_most')).toBe(
      'not_encodable',
    )
    expect(dispatchAction).not.toHaveBeenCalled()
  })
})
