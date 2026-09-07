/**
 * `useEdgeMutations.setStrength` — THE STRENGTH SLIDER REACHES THE SERVER.
 *
 * ⭐ THE DEFECT, as a user meets it: dragging the strength control changed the
 * line, stamped `weightSource: 'user'`, and told the server nothing. On the next
 * reload the number was gone. `setStrength` performed ONE local `updateEdge` and
 * emitted no turn — a control that looks like it saves and does not.
 *
 * ⚠ THIS FILE TESTS THE SEAM, NOT A SURFACE, AND THAT IS THE POINT. Four call
 * sites drive `setStrength` — `EdgePanel`'s slider, its band presets and its
 * confirm-current action, `EdgeAdvancedEditor`'s coefficient field, and the
 * Model tab's weight chip. A surface test pins what ONE of them does; the seam
 * is what makes the claim true for all four, and it is where a future fifth
 * caller arrives. (The same argument `setPriorRange`'s own emit makes.)
 *
 * ⚠ EVERY ASSERTION BINDS BY IDENTITY. The dispatched event is compared field
 * for field against an exact literal, and the local write is read back from the
 * store BY EDGE ID — never by "some edge whose weight is 0.75", which a second
 * edge could satisfy (CLAUDE.md trap 19).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

import type { WireSystemEvent } from '../../../conversation/types'

/**
 * ⚠ TYPED BY ITS ARGUMENT, NOT BARE. A bare `vi.fn(() => ...)` infers
 * `mock.calls: [][]`, so `calls[0][0]` is a TYPE ERROR the ratchet catches —
 * and the tempting workaround (`as any`) would make every payload assertion
 * below unchecked.
 */
const sendSystemEvent =
  vi.fn<[WireSystemEvent, unknown?], Promise<string>>(() => Promise.resolve('SENT'))

/** The single typed read of the one dispatched event — never re-indexed inline. */
function dispatchedEvent(index = 0): WireSystemEvent {
  const call = sendSystemEvent.mock.calls[index]
  expect(call, `expected a dispatched event at call index ${index}`).toBeDefined()
  return call[0]
}

vi.mock('../../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    // ⚠ `importOriginal`-SPREAD, NEVER A HAND-LISTED FACTORY. A `vi.mock`
    // factory REPLACES the module, so a hand-listed mock silently drops every
    // export added since it was written (CLAUDE.md trap 12 — that pattern once
    // killed 51 tests at collection).
    useOptionalConversationContext: () => ({ sendSystemEvent: mockContextValue() }),
  }
})

import { useEdgeMutations } from '../useInspectorMutations'
import { useCanvasStore } from '../../../store'

/** Flipped per-test so the SAME mocked module can present "no provider". */
let providerMounted = true
function mockContextValue() {
  return providerMounted ? sendSystemEvent : undefined
}

const EDGE = 'e_price_revenue'
const OTHER_EDGE = 'e_churn_revenue'

/** An edge whose strength AND direction both come from a producer. */
const PRODUCER_DATA = {
  strength_mean: 0.4,
  weight: 0.4,
  effect_direction: 'positive' as const,
  direction: 'positive' as const,
}

/**
 * An edge whose weight is the UI FALLTHROUGH (`DEFAULT_EDGE_DATA.weight = 0.5`)
 * with no source stamp and no producer-only raw field — so `expected` cannot be
 * asserted about the server.
 */
const DEFAULTED_DATA = { weight: 0.5, direction: 'positive' as const }

function seed(edgeData: Record<string, unknown>) {
  useCanvasStore.setState(
    {
      nodes: [],
      edges: [
        { id: EDGE, source: 'fac_price', target: 'goal_revenue', data: { ...edgeData } },
        // ⚠ THE DISCRIMINATION CONTROL. A second edge with the SAME shape means
        // an assertion that matched "an edge with weight 0.75" would pass on the
        // wrong object; every read below names EDGE.
        {
          id: OTHER_EDGE,
          source: 'fac_churn',
          target: 'goal_revenue',
          data: { ...PRODUCER_DATA },
        },
      ],
    } as never,
    false,
  )
}

function readEdge(id: string) {
  return useCanvasStore.getState().edges.find((e) => e.id === id)
}

beforeEach(() => {
  sendSystemEvent.mockClear()
  providerMounted = true
})

describe('setStrength reaches the server', () => {
  it('dispatches ONE edge_strength_edit carrying the (from, to) identity and the expected-before tuple', () => {
    seed(PRODUCER_DATA)
    const { result } = renderHook(() => useEdgeMutations(EDGE))

    const outcome = result.current.setStrength(0.75)

    expect(outcome).toBe('dispatched')
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    expect(dispatchedEvent()).toEqual({
      type: 'edge_strength_edit',
      payload: {
        from: 'fac_price',
        to: 'goal_revenue',
        magnitude: 0.75,
        direction_intent: 'positive',
        expected: { mean: 0.4, effect_direction: 'positive' },
        intent: 'set',
      },
    })
  })

  it('the LOCAL write still lands, on THAT edge, and does not touch its sibling', () => {
    seed(PRODUCER_DATA)
    const { result } = renderHook(() => useEdgeMutations(EDGE))

    result.current.setStrength(0.75)

    expect(readEdge(EDGE)?.data).toMatchObject({ weight: 0.75, weightSource: 'user' })
    // The sibling is untouched — binding by id, not by value.
    expect(readEdge(OTHER_EDGE)?.data).toMatchObject({ weight: 0.4 })
  })

  it('`expected` describes the edge BEFORE the write, never the number just sent', () => {
    // The whole purpose of `expected` is optimistic concurrency: it asserts what
    // the SERVER holds. Building it after the local write would send the user's
    // own new number back as the assertion, and CEE would compare it against a
    // graph that never held it.
    seed(PRODUCER_DATA)
    const { result } = renderHook(() => useEdgeMutations(EDGE))

    result.current.setStrength(0.9)

    const payload = dispatchedEvent().payload as Record<string, unknown>
    expect(payload.expected).toEqual({ mean: 0.4, effect_direction: 'positive' })
    expect(payload.magnitude).toBe(0.9)
  })

  it('preserveDirection sends `preserve` and writes NO direction locally', () => {
    seed({ ...PRODUCER_DATA, strength_mean: -0.6, weight: 0.6, effect_direction: 'negative', direction: 'negative' })
    const { result } = renderHook(() => useEdgeMutations(EDGE))

    // Zero on a NEGATIVE edge is the proven regression: `-0 >= 0` is `true`.
    result.current.setStrength(0, { preserveDirection: true })

    expect(dispatchedEvent().payload).toMatchObject({
      magnitude: 0,
      direction_intent: 'preserve',
      expected: { mean: -0.6, effect_direction: 'negative' },
    })
    expect(readEdge(EDGE)?.data).toMatchObject({ direction: 'negative', weight: 0 })
  })

  // ── The non-saves. Each is a DIFFERENT token; none is flattened. ───────────

  it('a DEFAULTED edge answers `not_wire_encodable`, sends NOTHING, and STILL writes locally', () => {
    seed(DEFAULTED_DATA)
    const { result } = renderHook(() => useEdgeMutations(EDGE))

    const outcome = result.current.setStrength(0.75)

    expect(outcome).toBe('not_wire_encodable')
    expect(sendSystemEvent).not.toHaveBeenCalled()
    // ⭐ THE LOCAL WRITE IS THE ASSERTION HERE, NOT AN INCIDENTAL. Failing closed
    // would make the slider do nothing for every edge whose weight came from
    // DEFAULT_EDGE_DATA — a silently dead control, which is worse than the
    // disclosed gap the token reports.
    expect(readEdge(EDGE)?.data).toMatchObject({ weight: 0.75, weightSource: 'user' })
  })

  it('with NO conversation provider it answers `local_only` and still writes locally', () => {
    providerMounted = false
    seed(PRODUCER_DATA)
    const { result } = renderHook(() => useEdgeMutations(EDGE))

    expect(result.current.setStrength(0.75)).toBe('local_only')
    expect(sendSystemEvent).not.toHaveBeenCalled()
    expect(readEdge(EDGE)?.data).toMatchObject({ weight: 0.75 })
  })

  it('an unknown edge answers `not_encodable` and writes NOTHING ANYWHERE', () => {
    seed(PRODUCER_DATA)
    const { result } = renderHook(() => useEdgeMutations('e_does_not_exist'))

    expect(result.current.setStrength(0.75)).toBe('not_encodable')
    expect(sendSystemEvent).not.toHaveBeenCalled()
    expect(readEdge(EDGE)?.data).toMatchObject({ weight: 0.4 })
  })

  it('a NON-FINITE number answers `not_encodable` and writes NOTHING ANYWHERE', () => {
    seed(PRODUCER_DATA)
    const { result } = renderHook(() => useEdgeMutations(EDGE))

    expect(result.current.setStrength(NaN)).toBe('not_encodable')
    expect(sendSystemEvent).not.toHaveBeenCalled()
    // ⚠ Fail CLOSED here, unlike the `not_wire_encodable` case above: there is
    // no honest local write for NaN either. `Math.abs(NaN)` is `NaN`, and
    // writing that would paint an unrenderable weight over a real one.
    expect(readEdge(EDGE)?.data).toMatchObject({ weight: 0.4 })
  })

  it('the four outcome tokens are DISTINCT — no two states share a name', () => {
    // The rule this pins: a non-save is never flattened into "saved", and two
    // different non-saves are never flattened into each other (trap 21).
    seed(PRODUCER_DATA)
    const producer = renderHook(() => useEdgeMutations(EDGE))
    const dispatched = producer.result.current.setStrength(0.75)

    seed(DEFAULTED_DATA)
    const defaulted = renderHook(() => useEdgeMutations(EDGE))
    const notWireEncodable = defaulted.result.current.setStrength(0.75)

    providerMounted = false
    seed(PRODUCER_DATA)
    const noProvider = renderHook(() => useEdgeMutations(EDGE))
    const localOnly = noProvider.result.current.setStrength(0.75)

    const missing = renderHook(() => useEdgeMutations('e_does_not_exist'))
    const notEncodable = missing.result.current.setStrength(0.75)

    expect([dispatched, notWireEncodable, localOnly, notEncodable]).toEqual([
      'dispatched',
      'not_wire_encodable',
      'local_only',
      'not_encodable',
    ])
    expect(new Set([dispatched, notWireEncodable, localOnly, notEncodable]).size).toBe(4)
  })

  it('the send failing NEVER breaks the local edit', () => {
    seed(PRODUCER_DATA)
    sendSystemEvent.mockImplementationOnce(() => Promise.reject(new Error('network')))
    const { result } = renderHook(() => useEdgeMutations(EDGE))

    expect(() => result.current.setStrength(0.75)).not.toThrow()
    expect(readEdge(EDGE)?.data).toMatchObject({ weight: 0.75 })
  })
})
