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
import { __resetPendingEdgeEditsForTest } from '../../../conversation/pendingEdgeEdit'

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
  // The pending-edit register is module state: a row's in-flight edit must not make the next row's link unsettled.
  __resetPendingEdgeEditsForTest()
  useCanvasStore.setState({ currentScenarioId: null } as never, false)
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
    expect(sendSystemEvent.mock.calls[0]?.[1]).not.toHaveProperty('optimisticEdgeEdit') // nothing to "confirm" later
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

/**
 * ⭐ THE SERVER'S VALUE CHOSEN OVER AN UNSETTLED CANVAS IS A RESTORATION, NOT AGREEMENT (Codex on #2489 @c23042b5, P1).
 * The server holds 0.4; 0.75 is on the wire (or shown local-only); the user picks 0.4. The canvas must move back, the
 * send must carry its optimistic carrier (so a queued one is rebased at dispatch), and no `'user'` stamp is minted.
 */
describe('setStrength: the server\'s value over an unsettled canvas is a restoration', () => {
  it.each([
    ['magnitude, direction preserved', true],
    ['signed, direction restated', false],
  ])('RED: 0.75 on the wire, then 0.4 (%s) → the canvas moves back with its carrier, the stamps put back', (_name, preserveDirection) => {
    seed({ ...PRODUCER_DATA, weightSource: 'cee', directionSource: 'cee' })
    const { result } = renderHook(() => useEdgeMutations(EDGE))
    expect(result.current.setStrength(0.75, { preserveDirection, onSendSettled: noSettlementExpectedHere })).toBe('dispatched')
    expect(readEdge(EDGE)?.data).toMatchObject({ weight: 0.75, weightSource: 'user' })

    expect(result.current.setStrength(0.4, { preserveDirection, onSendSettled: noSettlementExpectedHere })).toBe('dispatched')
    expect(readEdge(EDGE)?.data).toMatchObject({ weight: 0.4, weightSource: 'cee', directionSource: 'cee', direction: 'positive' })
    expect(sendSystemEvent).toHaveBeenCalledTimes(2)
    expect(dispatchedEvent(1).payload).toMatchObject({ from: 'fac_price', to: 'goal_revenue', intent: 'set', magnitude: 0.4, expected: { mean: 0.4, effect_direction: 'positive' } })
    expect(sendSystemEvent.mock.calls[1]?.[1]).toMatchObject({ optimisticEdgeEdit: { edgeId: EDGE, sentMagnitude: 0.4 } })
    expect(readEdge(OTHER_EDGE)?.data).toEqual(PRODUCER_DATA)
  })

  it('RED: a LOCAL-ONLY divergence (0.75 shown, nothing pending, server 0.4) → back to 0.4, stamps left as they stand', () => {
    seed({ ...PRODUCER_DATA, weight: 0.75, weightSource: 'cee' })
    const { result } = renderHook(() => useEdgeMutations(EDGE))
    expect(result.current.setStrength(0.4, { preserveDirection: true, onSendSettled: noSettlementExpectedHere })).toBe('dispatched')
    expect(readEdge(EDGE)?.data).toMatchObject({ weight: 0.4, weightSource: 'cee' })
    expect(sendSystemEvent.mock.calls[0]?.[1]).toMatchObject({ optimisticEdgeEdit: { edgeId: EDGE, sentMagnitude: 0.4 } })
  })

  it('RED: …and with NO carrier the restoration still lands on the canvas (local_only)', () => {
    providerMounted = false
    seed({ ...PRODUCER_DATA, weight: 0.75, weightSource: 'cee' })
    const { result } = renderHook(() => useEdgeMutations(EDGE))
    expect(result.current.setStrength(0.4, { preserveDirection: true, onSendSettled: noSettlementExpectedHere })).toBe('local_only')
    expect(readEdge(EDGE)?.data).toMatchObject({ weight: 0.4, weightSource: 'cee' })
  })
})

/**
 * ⭐ Codex #2489 round 2: a restoration borrows the pending edit's pre-edit stamps ONLY while they still describe this
 * link's current server state; and an agreement that QUEUES still settles when the queue sends it.
 */
describe('setStrength: a restoration never restores superseded provenance', () => {
  const USER_SET = { ...PRODUCER_DATA, weightSource: 'user', directionSource: 'user' }
  const ingest = (patch: { source?: string; data: Record<string, unknown> }) =>
    useCanvasStore.setState({
      edges: useCanvasStore.getState().edges.map((e) => (e.id === EDGE
        ? { ...e, ...(patch.source ? { source: patch.source } : {}), data: { ...(e.data as Record<string, unknown>), ...patch.data } }
        : e)),
    } as never, false)

  it('RED: user-set 0.4, 0.75 pending, then Olumi\'s 0.6 ingested → choosing 0.6 keeps the ingested stamp, never the old "user"', () => {
    seed(USER_SET)
    const { result } = renderHook(() => useEdgeMutations(EDGE))
    result.current.setStrength(0.75, { preserveDirection: true, onSendSettled: noSettlementExpectedHere })
    ingest({ data: { weight: 0.6, strength_mean: 0.6, weightSource: 'cee' } })
    result.current.setStrength(0.6, { preserveDirection: true, onSendSettled: noSettlementExpectedHere })
    expect(readEdge(EDGE)?.data).toMatchObject({ weight: 0.6, weightSource: 'cee' })
  })

  it('RED: the same edge id re-pointed to another factor → the departed link\'s stamps are not inherited', () => {
    seed(USER_SET)
    const { result } = renderHook(() => useEdgeMutations(EDGE))
    result.current.setStrength(0.75, { preserveDirection: true, onSendSettled: noSettlementExpectedHere })
    ingest({ source: 'fac_churn', data: { weightSource: 'cee' } })
    result.current.setStrength(0.4, { preserveDirection: true, onSendSettled: noSettlementExpectedHere })
    expect(readEdge(EDGE)?.data).toMatchObject({ weight: 0.4, weightSource: 'cee' })
  })

  it('RED: another scenario with the same edge id → the departed scenario\'s stamps are not inherited', () => {
    useCanvasStore.setState({ currentScenarioId: 'scen-a' } as never, false)
    seed(USER_SET)
    const { result } = renderHook(() => useEdgeMutations(EDGE))
    result.current.setStrength(0.75, { preserveDirection: true, onSendSettled: noSettlementExpectedHere })
    useCanvasStore.setState({ currentScenarioId: 'scen-b' } as never, false)
    ingest({ data: { weightSource: 'cee' } })
    result.current.setStrength(0.4, { preserveDirection: true, onSendSettled: noSettlementExpectedHere })
    expect(readEdge(EDGE)?.data).toMatchObject({ weight: 0.4, weightSource: 'cee' })
  })

  it('RED: Olumi FLIPPED the sign while 0.75 was pending (same magnitude) → choosing −0.4 keeps the ingested stamps', () => {
    seed(USER_SET)
    const { result } = renderHook(() => useEdgeMutations(EDGE))
    result.current.setStrength(0.75, { onSendSettled: noSettlementExpectedHere })
    ingest({ data: { strength_mean: -0.4, effect_direction: 'negative', direction: 'negative', weightSource: 'cee', directionSource: 'cee' } })
    result.current.setStrength(-0.4, { onSendSettled: noSettlementExpectedHere })
    expect(readEdge(EDGE)?.data).toMatchObject({ weight: 0.4, direction: 'negative', weightSource: 'cee', directionSource: 'cee' })
  })

  it('RED (r3): a pending FLIP, a magnitude edit, then the signed server value → the direction stamp is the pre-flip one', () => {
    seed({ ...PRODUCER_DATA, weightSource: 'cee', directionSource: 'cee' })
    const { result } = renderHook(() => useEdgeMutations(EDGE))
    result.current.setDirection('negative', { onSendSettled: noSettlementExpectedHere })
    result.current.setStrength(0.75, { preserveDirection: true, onSendSettled: noSettlementExpectedHere })
    expect(readEdge(EDGE)?.data).toMatchObject({ direction: 'negative', directionSource: 'user' }) // the flip's own stamp
    result.current.setStrength(0.4, { onSendSettled: noSettlementExpectedHere })
    expect(readEdge(EDGE)?.data).toMatchObject({ weight: 0.4, direction: 'positive', weightSource: 'cee', directionSource: 'cee' })
  })

  it('RED (r3): no flip pending, but the strength edit\'s snapshot shows ANOTHER sign (a local, unsent direction) → its direction stamp is not borrowed', () => {
    seed({ ...PRODUCER_DATA, direction: 'negative', directionSource: 'user', weightSource: 'cee' }) // server: +0.4
    const { result } = renderHook(() => useEdgeMutations(EDGE))
    result.current.setStrength(0.75, { preserveDirection: true, onSendSettled: noSettlementExpectedHere })
    ingest({ data: { directionSource: 'cee' } }) // a stamp-only change: the snapshot's 'user' is now NOT what stands
    result.current.setStrength(0.4, { onSendSettled: noSettlementExpectedHere })
    expect(readEdge(EDGE)?.data).toMatchObject({ weight: 0.4, direction: 'positive', weightSource: 'cee', directionSource: 'cee' })
  })

  it('CONTROL: nothing moved → the pre-edit stamps ARE put back (the round-1 restoration)', () => {
    seed(USER_SET)
    const { result } = renderHook(() => useEdgeMutations(EDGE))
    result.current.setStrength(0.75, { preserveDirection: true, onSendSettled: noSettlementExpectedHere })
    ingest({ data: { weightSource: 'cee' } }) // a stamp-only change: the server state `before` describes is unchanged
    result.current.setStrength(0.4, { preserveDirection: true, onSendSettled: noSettlementExpectedHere })
    expect(readEdge(EDGE)?.data).toMatchObject({ weight: 0.4, weightSource: 'user' })
  })

  it('RED (P2): a settled agreement that QUEUES settles again when the queue sends it', async () => {
    seed(PRODUCER_DATA)
    sendSystemEvent.mockImplementationOnce(() => Promise.resolve('send_deferred'))
    const settled: string[] = []
    const { result } = renderHook(() => useEdgeMutations(EDGE))
    result.current.setStrength(0.4, { preserveDirection: true, onSendSettled: (s) => { settled.push(s) } })
    await vi.waitFor(() => expect(settled).toEqual(['queued']))
    const opts = sendSystemEvent.mock.calls[0]?.[1] as { onDeferredSettled?: (d: Promise<unknown>) => void } | undefined
    expect(opts).not.toHaveProperty('optimisticEdgeEdit')
    opts?.onDeferredSettled?.(Promise.resolve(undefined))
    await vi.waitFor(() => expect(settled).toEqual(['queued', 'sent']))
  })
})
