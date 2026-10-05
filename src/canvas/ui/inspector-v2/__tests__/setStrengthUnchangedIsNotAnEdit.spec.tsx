/**
 * ⭐ AN UNCHANGED `set` IS NOT AN EDIT, so `setStrength` neither writes nor stamps it (Acceptance #87 5986653143; DL
 * 0df0e1, 5 Oct). CEE refuses every such `set` by contract (`edgeStrengthEditChangesNothing`), and the optimistic
 * `weightSource: 'user'` it used to write was later "confirmed" by "the model shows the sent magnitude" — which an
 * unchanged value always does — so the row kept "User edited" on a write the server refused. The `set` is still SENT
 * (CEE's own sentence answers the user), with no optimistic write and no optimistic carrier.
 *
 * Harness: `setStrengthEmitsEdgeStrengthEdit.spec.tsx` (real store; the conversation context mocked at its seam).
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

/**
 * ⛔ `onSendSettled` IS REQUIRED, AND THESE CALLS ARE WHY THAT IS WORTH THE CHURN.
 *
 * `setStrength` used to accept a bare `setStrength(v)`, and four product carriers
 * took that form and swallowed every settlement — including the server saying no.
 * Making the option required is what found the fourth one (`EdgeAdvancedEditor`'s
 * β field); a grep had missed it three times.
 *
 * ⚠ These specs are the OTHER half of that lesson. I checked every PRODUCT caller
 * before making it required and did not check the SPECS — and the repo's named
 * local gate is blind to test files by config (`tsconfig.build.json` excludes
 * them), so only the separate CI typecheck drift job could see it. CLAUDE.md
 * trap 2's refinement, exactly.
 *
 * `noSettlementExpectedHere` is deliberately NAMED rather than an inline
 * `() => {}`: these cases assert the WIRE EVENT and the STORE WRITE, not what any
 * surface says about the outcome, so no settlement assertion belongs here. An
 * anonymous no-op would be indistinguishable from the swallow this change removes.
 */
const noSettlementExpectedHere = () => {}


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

describe('setStrength: the value the server already states is not an edit', () => {
  it('PRECONDITION: the edge\'s strength is server-stated (0.4, positive)', () => {
    seed(PRODUCER_DATA)
    const { result } = renderHook(() => useEdgeMutations(EDGE))
    expect(result.current.setStrength(0.75, { onSendSettled: noSettlementExpectedHere })).toBe('dispatched')
    expect((dispatchedEvent().payload as { expected?: unknown }).expected).toEqual({ mean: 0.4, effect_direction: 'positive' })
  })

  it.each([
    ['magnitude, direction preserved', 0.4, true],
    ['signed, direction restated as it is', 0.4, false],
  ])('RED: the same %s → sent once as a set, NOTHING written, no optimistic carrier', (_name, mean, preserveDirection) => {
    seed(PRODUCER_DATA)
    const before = { ...(readEdge(EDGE)?.data as Record<string, unknown>) }
    const { result } = renderHook(() => useEdgeMutations(EDGE))
    expect(result.current.setStrength(mean, { preserveDirection, onSendSettled: noSettlementExpectedHere })).toBe('dispatched')
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    expect((dispatchedEvent().payload as { intent?: unknown }).intent).toBe('set')
    expect(sendSystemEvent.mock.calls[0]?.[1]).toBeUndefined() // no `optimisticEdgeEdit` to "confirm" later
    expect(readEdge(EDGE)?.data).toEqual(before)
    expect((readEdge(EDGE)?.data as Record<string, unknown>).weightSource).toBeUndefined()
  })

  it('RED: the same value with NO carrier → not_encodable, nothing anywhere', () => {
    providerMounted = false
    seed(PRODUCER_DATA)
    const before = { ...(readEdge(EDGE)?.data as Record<string, unknown>) }
    const { result } = renderHook(() => useEdgeMutations(EDGE))
    expect(result.current.setStrength(0.4, { preserveDirection: true, onSendSettled: noSettlementExpectedHere })).toBe('not_encodable')
    expect(sendSystemEvent).not.toHaveBeenCalled()
    expect(readEdge(EDGE)?.data).toEqual(before)
  })

  it.each([
    ['a changed magnitude', 0.75],
    ['the same magnitude with the sign FLIPPED (a real direction change)', -0.4],
  ])('CONTROL: %s is an edit → written locally as the user\'s, with its optimistic carrier', (_name, mean) => {
    seed(PRODUCER_DATA)
    const { result } = renderHook(() => useEdgeMutations(EDGE))
    expect(result.current.setStrength(mean, { onSendSettled: noSettlementExpectedHere })).toBe('dispatched')
    expect(readEdge(EDGE)?.data).toMatchObject({ weight: Math.abs(mean), weightSource: 'user' })
    expect(sendSystemEvent.mock.calls[0]?.[1]).toMatchObject({ optimisticEdgeEdit: { edgeId: EDGE, sentMagnitude: Math.abs(mean) } })
  })
})
