/**
 * `useEdgeMutations.setDirection` — THE HELPS/HURTS CONTROL REACHES THE SERVER.
 *
 * ⭐ THE DEFECT, as a user meets it: choosing "positive" or "negative" changed
 * the line, stamped `directionSource: 'user'`, and told the server nothing.
 * `setDirection` performed ONE local `updateEdge` and emitted no turn, so the
 * claim survived until the next reload and then vanished — and any analysis
 * re-run in between silently used the OLD sign. Direction is the most
 * load-bearing fact in a causal model; this is the control that states it.
 *
 * ⚠ THIS FILE TESTS THE SEAM, NOT A SURFACE, AND THAT IS THE POINT — the same
 * argument `setStrengthEmitsEdgeStrengthEdit.spec.tsx` makes. Two call sites
 * drive `setDirection` today (`EdgeAdvancedEditor`'s direction select and the
 * Model tab's `RelationshipsSection.handleDirectionToggle`); a surface test pins
 * what ONE of them does, the seam is what makes the claim true for both and for
 * the third that arrives later.
 *
 * ⚠ EVERY ASSERTION BINDS BY IDENTITY (CLAUDE.md trap 19). The dispatched event
 * is compared field for field against an exact literal, and the local write is
 * read back BY EDGE ID against a same-shaped sibling — never by "some edge whose
 * direction is negative", which the sibling could satisfy.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

import type { WireSystemEvent } from '../../../conversation/types'

/** Typed by its argument — a bare `vi.fn` makes every payload read unchecked. */
const sendSystemEvent =
  vi.fn<[WireSystemEvent, unknown?], Promise<string>>(() => Promise.resolve('SENT'))

function dispatchedEvent(index = 0): WireSystemEvent {
  const call = sendSystemEvent.mock.calls[index]
  expect(call, `expected a dispatched event at call index ${index}`).toBeDefined()
  return call[0]
}

vi.mock('../../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    // ⚠ `importOriginal`-SPREAD, NEVER A HAND-LISTED FACTORY (CLAUDE.md trap 12).
    ...actual,
    useOptionalConversationContext: () => ({ sendSystemEvent: mockContextValue() }),
  }
})

import { useEdgeMutations } from '../useInspectorMutations'
import { useCanvasStore } from '../../../store'

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

/** The UI fallthrough (`DEFAULT_EDGE_DATA.weight = 0.5`) — no assertable tuple. */
const DEFAULTED_DATA = { weight: 0.5, direction: 'positive' as const }

function seed(edgeData: Record<string, unknown>) {
  useCanvasStore.setState(
    {
      nodes: [],
      edges: [
        { id: EDGE, source: 'fac_price', target: 'goal_revenue', data: { ...edgeData } },
        // ⚠ THE DISCRIMINATION CONTROL — a same-shaped sibling, so an assertion
        // that matched "an edge with direction negative" would pass on the wrong
        // object. Every read below names EDGE.
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

describe('setDirection reaches the server', () => {
  it('dispatches ONE edge_strength_edit stating the direction, with the magnitude untouched', () => {
    seed(PRODUCER_DATA)
    const { result } = renderHook(() => useEdgeMutations(EDGE))

    const outcome = result.current.setDirection('negative')

    expect(outcome).toBe('dispatched')
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    expect(dispatchedEvent()).toEqual({
      type: 'edge_strength_edit',
      payload: {
        from: 'fac_price',
        to: 'goal_revenue',
        magnitude: 0.4,
        direction_intent: 'negative',
        expected: { mean: 0.4, effect_direction: 'positive' },
        intent: 'set',
      },
    })
  })

  it('states a NEGATIVE direction at ZERO magnitude — the seam-level form of the `-0` trap', () => {
    // ⭐⭐ THE DISCRIMINATING CASE. On a zero-magnitude edge there is no sign for
    // a signed encoding to carry (`-0 >= 0` is `true`), so any implementation
    // that routed direction through a mean would send `'positive'` here and
    // silently invert the user's choice.
    seed({ ...PRODUCER_DATA, strength_mean: 0, weight: 0 })
    const { result } = renderHook(() => useEdgeMutations(EDGE))

    result.current.setDirection('negative')

    expect(dispatchedEvent().payload).toMatchObject({
      magnitude: 0,
      direction_intent: 'negative',
      expected: { mean: 0, effect_direction: 'positive' },
    })
  })

  it('asserts the SERVER-stated magnitude, never the locally-edited `weight`', () => {
    // CEE compares `expected` with a bare `!==` and answers
    // `edge_expected_tuple_mismatch` — "That link has changed since you opened
    // it" — on any disagreement. Sending the local 0.9 would manufacture a
    // phantom concurrent edit for a change that was fine.
    seed({ ...PRODUCER_DATA, strength_mean: 0.4, weight: 0.9 })
    const { result } = renderHook(() => useEdgeMutations(EDGE))

    result.current.setDirection('negative')

    const payload = dispatchedEvent().payload as Record<string, unknown>
    expect(payload.expected).toEqual({ mean: 0.4, effect_direction: 'positive' })
    expect(payload.magnitude).toBe(0.4)
  })

  it('the LOCAL write still lands, on THAT edge, and does not touch its sibling', () => {
    seed(PRODUCER_DATA)
    const { result } = renderHook(() => useEdgeMutations(EDGE))

    result.current.setDirection('negative')

    expect(readEdge(EDGE)?.data).toMatchObject({ direction: 'negative', directionSource: 'user' })
    // Bound by id — the sibling keeps the direction it was seeded with.
    expect(readEdge(OTHER_EDGE)?.data).toMatchObject({ direction: 'positive' })
  })

  // ── The non-saves. Each is a DIFFERENT token; none is flattened. ───────────

  it('reports `not_wire_encodable` on a defaulted edge and STILL writes locally', () => {
    // ⚠ The local write is unconditional BY DESIGN — see the setter's header.
    // Failing closed would make the control dead for a whole class of edges.
    seed(DEFAULTED_DATA)
    const { result } = renderHook(() => useEdgeMutations(EDGE))

    const outcome = result.current.setDirection('negative')

    expect(outcome).toBe('not_wire_encodable')
    expect(sendSystemEvent).not.toHaveBeenCalled()
    expect(readEdge(EDGE)?.data).toMatchObject({ direction: 'negative', directionSource: 'user' })
  })

  it('reports `local_only` when no conversation provider is mounted', () => {
    providerMounted = false
    seed(PRODUCER_DATA)
    const { result } = renderHook(() => useEdgeMutations(EDGE))

    const outcome = result.current.setDirection('negative')

    expect(outcome).toBe('local_only')
    expect(sendSystemEvent).not.toHaveBeenCalled()
    expect(readEdge(EDGE)?.data).toMatchObject({ direction: 'negative' })
  })

  it('reports `not_encodable` for an edge id that is not in the store', () => {
    seed(PRODUCER_DATA)
    const { result } = renderHook(() => useEdgeMutations('e_does_not_exist'))

    expect(result.current.setDirection('negative')).toBe('not_encodable')
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })
})
