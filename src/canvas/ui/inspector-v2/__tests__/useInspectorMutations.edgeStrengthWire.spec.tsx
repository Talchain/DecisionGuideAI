/**
 * useEdgeMutations.commitStrength — a link-strength edit REACHES THE WIRE.
 *
 * THE DEFECT THIS PINS. `EdgePanel` shipped three strength affordances and all
 * three landed in `setStrength`, which did one local `updateEdge` and emitted
 * nothing. Client autosave is `localStorage` and the client's `scenarios`
 * writes never touch `graph`, so the value was gone on reload — the model never
 * heard it. This spec pins the emission, its fail-closed rules, and the two
 * OPPOSITE outcomes a refusal can have.
 *
 * ⚠ WHY THE CONTINUOUS SETTER MUST STAY SILENT is asserted here too, and it is
 * not a style preference: `setStrength` is called on every tick of a drag, so
 * an emission inside it would fire one CEE turn per animation frame.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useEdgeMutations } from '../useInspectorMutations'
import { useCanvasStore } from '../../../store'
import { EDGE_STRENGTH_NOTICE } from '../../../mutations/edgeStrengthEdit'

const sendSystemEvent = vi.fn().mockResolvedValue(undefined)
let contextValue: { sendSystemEvent: typeof sendSystemEvent } | null = { sendSystemEvent }
vi.mock('../../../conversation/ConversationContext', () => ({
  useOptionalConversationContext: () => contextValue,
}))

/**
 * ⚠ THE MOCK MUST ACTUALLY WRITE, and getting this wrong manufactured a false
 * RED the first time this spec ran. The revert below is gated on a STAND-DOWN
 * CHECK — "does the edge still hold the magnitude this gesture sent?" — which
 * reads the STORE. A `vi.fn()` that records the call and mutates nothing leaves
 * the store holding the pre-edit value, so the check correctly concludes the
 * canvas has moved on and declines to revert. The failure looked like a broken
 * revert; it was a harness that dropped the write the revert depends on.
 *
 * So this models the real `updateEdge`'s merge (`{...e.data, ...updates.data}`)
 * rather than standing in for it.
 */
const updateEdge = vi.fn((id: string, updates: { data?: Record<string, unknown> }) => {
  useCanvasStore.setState(
    (s) => ({
      edges: (s.edges as unknown as Array<{ id: string; data?: Record<string, unknown> }>).map(
        (e) => (e.id === id ? { ...e, data: { ...e.data, ...updates.data } } : e),
      ),
    }),
    false,
  )
})

/**
 * The edge under test, and a DECOY sharing its weight and direction between
 * different endpoints — so an assertion that resolved by value would pass while
 * naming the wrong edge on the wire.
 */
const TARGET = {
  id: 'e_price_demand',
  source: 'fac_price',
  target: 'fac_demand',
  data: { weight: 0.4, direction: 'negative', weightSource: 'cee', directionSource: 'cee' },
}
const DECOY = {
  id: 'e_other_pair',
  source: 'fac_supply',
  target: 'fac_margin',
  data: { weight: 0.4, direction: 'negative' },
}

beforeEach(() => {
  updateEdge.mockClear()
  sendSystemEvent.mockClear()
  sendSystemEvent.mockResolvedValue(undefined)
  contextValue = { sendSystemEvent }
  useCanvasStore.setState({ edges: [DECOY, TARGET], updateEdge } as never, false)
})

describe('commitStrength — wire emission', () => {
  it('⭐ writes locally AND emits edge_strength_edit, identity-bound to this edge', () => {
    const { result } = renderHook(() => useEdgeMutations('e_price_demand'))
    act(() => result.current.commitStrength(-0.7))

    // The existing local write is untouched.
    expect(updateEdge).toHaveBeenCalledTimes(1)
    const [id, patch] = updateEdge.mock.calls[0]!
    expect(id).toBe('e_price_demand')
    expect((patch as { data: Record<string, unknown> }).data).toMatchObject({
      weight: 0.7,
      direction: 'negative',
      weightSource: 'user',
    })

    // …and the edit now leaves the browser, addressed by the CANONICAL
    // endpoint pair. The decoy shares the weight, so a value-keyed resolution
    // would name `fac_supply`/`fac_margin` and still satisfy the numbers.
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    const [event] = sendSystemEvent.mock.calls[0]!
    expect(event).toEqual({
      type: 'edge_strength_edit',
      payload: {
        from: 'fac_price',
        to: 'fac_demand',
        magnitude: 0.7,
        direction_intent: 'negative',
        expected: { mean: -0.4, effect_direction: 'negative' },
        intent: 'set',
      },
    })
  })

  it('⭐ setStrength — the CONTINUOUS setter — still emits NOTHING', () => {
    // A drag calls this on every tick. If this assertion ever goes green by
    // being deleted, the product fires a CEE turn per animation frame.
    const { result } = renderHook(() => useEdgeMutations('e_price_demand'))
    act(() => result.current.setStrength(-0.55))
    expect(updateEdge).toHaveBeenCalledTimes(1)
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it('a preset click preserves direction on the wire, not just in the store', () => {
    const { result } = renderHook(() => useEdgeMutations('e_price_demand'))
    act(() => result.current.commitStrength(0.9, { preserveDirection: true }))
    const [event] = sendSystemEvent.mock.calls[0]!
    expect((event as { payload: Record<string, unknown> }).payload).toMatchObject({
      magnitude: 0.9,
      direction_intent: 'preserve',
    })
  })

  it('⭐ confirm_current restates the exact current magnitude', () => {
    const { result } = renderHook(() => useEdgeMutations('e_price_demand'))
    act(() =>
      result.current.commitStrength(0.4, { preserveDirection: true, intent: 'confirm_current' }),
    )
    const [event] = sendSystemEvent.mock.calls[0]!
    expect((event as { payload: Record<string, unknown> }).payload).toMatchObject({
      magnitude: 0.4,
      direction_intent: 'preserve',
      intent: 'confirm_current',
    })
  })

  it('the local edit survives when there is no conversation context', () => {
    contextValue = null
    const { result } = renderHook(() => useEdgeMutations('e_price_demand'))
    act(() => result.current.commitStrength(0.8))
    expect(updateEdge).toHaveBeenCalledTimes(1)
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it('⭐ the SECOND commit asserts what the FIRST one sent, not the original value', () => {
    // Without advancing the baseline, every edit after the first asserts a
    // value the server no longer holds and refuses forever — an affordance
    // terminating in refusal, arrived at by doing nothing.
    const { result } = renderHook(() => useEdgeMutations('e_price_demand'))
    act(() => result.current.commitStrength(0.6, { preserveDirection: true }))
    act(() => result.current.commitStrength(0.8, { preserveDirection: true }))
    const [second] = sendSystemEvent.mock.calls[1]!
    expect((second as { payload: { expected: unknown } }).payload.expected).toEqual({
      mean: 0.6,
      effect_direction: 'negative',
    })
  })
})

describe('commitStrength — the two OPPOSITE refusal outcomes', () => {
  /** A 409 CEE proves wrote nothing, carrying its own current value. */
  function provenNoWrite() {
    return Object.assign(new Error('diverged'), {
      kind: 'server',
      code: 'GRAPH_DIVERGED',
      conflictCategory: 'edge_expected_tuple_mismatch',
      details: {
        conflict_category: 'edge_expected_tuple_mismatch',
        edge: { current: { mean: -0.65, std: 0.1, effect_direction: 'negative' } },
      },
    })
  }

  it('⭐ REVERTS when the server PROVED it wrote nothing, and names the real value', async () => {
    sendSystemEvent.mockRejectedValue(provenNoWrite())
    const onNotice = vi.fn()
    const { result } = renderHook(() => useEdgeMutations('e_price_demand'))

    await act(async () => {
      result.current.commitStrength(0.7, { preserveDirection: true, onNotice })
      await Promise.resolve()
      await Promise.resolve()
    })

    // Two writes: the optimistic one, then the undo.
    expect(updateEdge).toHaveBeenCalledTimes(2)
    const [, revertPatch] = updateEdge.mock.calls[1]!
    expect((revertPatch as { data: Record<string, unknown> }).data).toMatchObject({
      weight: 0.4,
      direction: 'negative',
      weightSource: 'cee',
    })
    expect(onNotice).toHaveBeenCalledTimes(1)
    expect(onNotice.mock.calls[0]![0]).toContain('0.65')
  })

  it('⭐ does NOT revert when the outcome is merely UNCONFIRMED — reverting is data loss', async () => {
    // The opposite-direction twin of the case above. One control cannot cover
    // both: a revert-always rule passes the first test and destroys the user's
    // work here, on no evidence either way.
    sendSystemEvent.mockRejectedValue(
      Object.assign(new Error('boom'), { kind: 'server', code: 'INTERNAL' }),
    )
    const onNotice = vi.fn()
    const { result } = renderHook(() => useEdgeMutations('e_price_demand'))

    await act(async () => {
      result.current.commitStrength(0.7, { preserveDirection: true, onNotice })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(updateEdge).toHaveBeenCalledTimes(1) // the optimistic write only
    expect(onNotice).toHaveBeenCalledWith(EDGE_STRENGTH_NOTICE.unconfirmed_server)
  })

  it('distinguishes a transport failure from a server one in the copy', async () => {
    sendSystemEvent.mockRejectedValue(
      Object.assign(new Error('offline'), { kind: 'transport' }),
    )
    const onNotice = vi.fn()
    const { result } = renderHook(() => useEdgeMutations('e_price_demand'))
    await act(async () => {
      result.current.commitStrength(0.7, { preserveDirection: true, onNotice })
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(onNotice).toHaveBeenCalledWith(EDGE_STRENGTH_NOTICE.unconfirmed_transport)
  })

  it('⭐ stands down from the revert when the edge has moved on since', async () => {
    sendSystemEvent.mockRejectedValue(provenNoWrite())
    const { result } = renderHook(() => useEdgeMutations('e_price_demand'))

    await act(async () => {
      result.current.commitStrength(0.7, { preserveDirection: true })
      // A newer truth lands before the refusal is read — a later user edit, or
      // a server graph. Restoring here would be a silent overwrite dressed as
      // a correction.
      useCanvasStore.setState(
        { edges: [DECOY, { ...TARGET, data: { ...TARGET.data, weight: 0.2 } }] } as never,
        false,
      )
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(updateEdge).toHaveBeenCalledTimes(1) // no revert
  })
})
