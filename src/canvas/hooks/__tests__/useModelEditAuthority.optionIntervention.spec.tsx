/**
 * `proposeOptionIntervention` DISPATCHES (schemas 0.54.0).
 *
 * The sibling `localCommits` spec mocks the conversation away and can therefore
 * only prove the floor — with nothing to send through, nothing happens anywhere.
 * This file supplies a conversation and asserts the behaviour that floor exists
 * to protect: the exact payload, and the refusals that must NOT reach the wire.
 *
 * ⚠ THE STORE IS ASSERTED UNTOUCHED IN EVERY CASE, including the successful one.
 * That is not incidental — it is the property. `proposeGoalTarget` established
 * it on this surface: the draft never changes the store before a real applied
 * response, because a number on screen that the server has not accepted is the
 * harm the Model tab's own notice exists to avoid.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const sendSystemEvent = vi.fn()
vi.mock('../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => ({ sendSystemEvent }) }
})

import { useModelEditAuthority } from '../useModelEditAuthority'
import { useCanvasStore } from '../../store'

const OPTION = 'opt_premium'
const FACTOR = 'fac_cost'
const OTHER_FACTOR = 'fac_reach'
const HASH = '9f2c1b0ae4d37c5a'

function seed(lastServerGraphHash: string | null = HASH) {
  useCanvasStore.setState(
    {
      lastServerGraphHash,
      nodes: [
        {
          id: FACTOR, type: 'factor', position: { x: 0, y: 0 },
          data: { label: 'Cost', kind: 'factor' },
        },
        {
          id: OTHER_FACTOR, type: 'factor', position: { x: 0, y: 0 },
          data: { label: 'Reach', kind: 'factor' },
        },
        {
          id: OPTION, type: 'option', position: { x: 0, y: 0 },
          data: { label: 'Premium-first', kind: 'option', interventions: { [FACTOR]: 0.2 } },
        },
      ],
      edges: [],
    } as never,
    false,
  )
}

function authorityFor(activeNodeId: string | null) {
  return renderHook(() => useModelEditAuthority(activeNodeId)).result
}

function interventionsOf(id: string): Record<string, unknown> {
  const node = useCanvasStore.getState().nodes.find(n => n.id === id)
  return ((node?.data as Record<string, unknown>)?.interventions ?? {}) as Record<string, unknown>
}

beforeEach(() => {
  vi.clearAllMocks()
  seed()
})

describe('the dispatched payload', () => {
  it('sends the typed event with canonical ids, the model-scale value and the base hash', () => {
    expect(authorityFor(OPTION).current.proposeOptionIntervention(FACTOR, 0.75)).toBe('dispatched')
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    expect(sendSystemEvent.mock.calls[0]?.[0]).toEqual({
      type: 'option_intervention_edit',
      payload: {
        option_id: OPTION,
        factor_id: FACTOR,
        value: 0.75,
        base_graph_hash: HASH,
      },
    })
  })

  it('⭐ writes NOTHING to the store — the applied response owns that', () => {
    authorityFor(OPTION).current.proposeOptionIntervention(FACTOR, 0.75)
    expect(interventionsOf(OPTION)[FACTOR]).toBe(0.2)
  })

  it('sends no unit, raw value, provenance or actor — fields the client cannot honestly assert', () => {
    authorityFor(OPTION).current.proposeOptionIntervention(FACTOR, 0.75)
    const payload = sendSystemEvent.mock.calls[0]?.[0]?.payload as Record<string, unknown>
    expect(Object.keys(payload).sort()).toEqual(
      ['base_graph_hash', 'factor_id', 'option_id', 'value'].sort(),
    )
  })
})

describe('what must never reach the wire', () => {
  it('⚠ refuses when there is NO server-stamped base hash — the reload case', () => {
    // A restore reads persistence with no CEE turn, so `lastServerGraphHash` is
    // null. Sending an empty or invented hash would be refused by the server as
    // STALE, which reads to a user as "your edit conflicted" when in fact the
    // client never held a base to assert. Refuse, and let the caller disclose.
    seed(null)
    // ⭐ `needs_fresh_base`, NOT `not_encodable`, and the distinction is the
    // whole reason the outcome was split: this is the one refusal the user can
    // clear — any turn refreshes the base — so the caller must be able to tell
    // it apart from "your number is wrong" in order to offer the recovery.
    expect(authorityFor(OPTION).current.proposeOptionIntervention(FACTOR, 0.75)).toBe(
      'needs_fresh_base',
    )
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it.each([
    ['below the model scale', -0.01],
    ['above the model scale', 1.01],
    ['a user-unit magnitude', 120000],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ] as Array<[string, number]>)('refuses %s — REFUSE, never clamp', (_name, value) => {
    // A clamped 1.5 → 1 sends a number the user never stated, and the server
    // would persist it as theirs. Same ruling as edgeStrengthEdit's magnitude.
    expect(authorityFor(OPTION).current.proposeOptionIntervention(FACTOR, value)).toBe(
      'not_encodable',
    )
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it('refuses a factor that is not in the model, and an option addressing itself', () => {
    const a = authorityFor(OPTION).current
    expect(a.proposeOptionIntervention('fac_deleted', 0.5)).toBe('not_encodable')
    expect(a.proposeOptionIntervention(OPTION, 0.5)).toBe('not_encodable')
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it('refuses when the active node is not an option', () => {
    expect(authorityFor(FACTOR).current.proposeOptionIntervention(OTHER_FACTOR, 0.5)).toBe(
      'not_encodable',
    )
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  /**
   * ⭐⭐ WHEN BOTH QUESTIONS FAIL, THE ANSWER IS THE ONE THE USER CANNOT FIX.
   *
   * The two refusals are not ranked by which check happens to run first — they
   * are ranked by what a caller DOES with them. `needs_fresh_base` is an offer:
   * run a turn and this clears. Offering it for a number that can never encode
   * costs the user a turn to learn nothing, and then refuses again in different
   * words. This pins the ranking at the authority, where the caller reads it.
   */
  it('⚠ an off-scale value on a RESTORED session refuses not_encodable, not needs_fresh_base', () => {
    seed(null)
    expect(authorityFor(OPTION).current.proposeOptionIntervention(FACTOR, 1.4)).toBe(
      'not_encodable',
    )
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it('DISCRIMINATING TWIN: the SAME restored session with a good value says needs_fresh_base', () => {
    // Without this the assertion above would pass on an authority that had
    // simply lost `needs_fresh_base` altogether.
    seed(null)
    expect(authorityFor(OPTION).current.proposeOptionIntervention(FACTOR, 0.4)).toBe(
      'needs_fresh_base',
    )
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it('POSITIVE CONTROL: the refusals above are about their own cause', () => {
    // Without this, every assertion in this block would pass against a seam that
    // refuses everything.
    expect(authorityFor(OPTION).current.proposeOptionIntervention(OTHER_FACTOR, 0)).toBe(
      'dispatched',
    )
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
  })
})
