/**
 * useInspectorMutations.setPriorRange — the user-set prior range REACHES THE
 * WIRE (P4 transport).
 *
 * Verified defect at staging dae8908f: `setPriorRange` wrote
 * `data.prior.range_min/range_max` locally and emitted NOTHING — user-set
 * prior ranges never reached the server. This spec pins the new wiring at the
 * single seam every caller shares: the setter still writes locally exactly as
 * before, AND emits the `prior_range_edit` system event (best-effort — an
 * absent conversation context must not break the local edit).
 *
 * CARRY-ONLY, deliberately: the event persists the judgement as a turn fact.
 * Whether/how confirmed ranges affect the maths is a separate explicit design
 * decision — nothing here touches analysis inputs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useNodeMutations } from '../useInspectorMutations'
import { useCanvasStore } from '../../../store'

const sendSystemEvent = vi.fn().mockResolvedValue(undefined)
let contextValue: { sendSystemEvent: typeof sendSystemEvent } | null = {
  sendSystemEvent,
}
vi.mock('../../../conversation/ConversationContext', () => ({
  useOptionalConversationContext: () => contextValue,
}))

const updateNode = vi.fn()
const NODE = {
  id: 'fac_adoption',
  type: 'factor',
  position: { x: 0, y: 0 },
  data: { prior: { distribution: 'beta', range_min: 0.1, range_max: 0.9 } },
}

beforeEach(() => {
  updateNode.mockClear()
  sendSystemEvent.mockClear()
  contextValue = { sendSystemEvent }
  useCanvasStore.setState({ nodes: [NODE], edges: [], updateNode } as never, false)
})

describe('setPriorRange — wire emission', () => {
  it('⭐ writes locally AND emits prior_range_edit, identity-bound to the node', () => {
    const { result } = renderHook(() => useNodeMutations('fac_adoption'))
    act(() => result.current.setPriorRange(0.2, 0.6))

    // The existing local write is untouched.
    expect(updateNode).toHaveBeenCalledTimes(1)
    const [, patch] = updateNode.mock.calls[0]!
    expect((patch as { data: { prior: Record<string, unknown> } }).data.prior).toMatchObject({
      range_min: 0.2,
      range_max: 0.6,
    })

    // …and the judgement now leaves the browser, carrying the node's own
    // stated distribution alongside the new bounds.
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    const [event] = sendSystemEvent.mock.calls[0]!
    expect(event).toEqual({
      type: 'prior_range_edit',
      payload: {
        target_id: 'fac_adoption',
        range_min: 0.2,
        range_max: 0.6,
        distribution: 'beta',
      },
    })
  })

  it('omits distribution when the node states none', () => {
    useCanvasStore.setState(
      { nodes: [{ ...NODE, data: {} }], edges: [], updateNode } as never,
      false,
    )
    const { result } = renderHook(() => useNodeMutations('fac_adoption'))
    act(() => result.current.setPriorRange(0.3, 0.5))
    const [event] = sendSystemEvent.mock.calls[0]!
    expect(event.payload).toEqual({ target_id: 'fac_adoption', range_min: 0.3, range_max: 0.5 })
  })

  it('an INVERTED range still writes locally but emits nothing (fail-closed, no wire 422)', () => {
    const { result } = renderHook(() => useNodeMutations('fac_adoption'))
    act(() => result.current.setPriorRange(0.9, 0.1))
    expect(updateNode).toHaveBeenCalledTimes(1)
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it('a missing conversation context must not break the local edit (best-effort wire)', () => {
    contextValue = null
    const { result } = renderHook(() => useNodeMutations('fac_adoption'))
    act(() => result.current.setPriorRange(0.2, 0.6))
    expect(updateNode).toHaveBeenCalledTimes(1)
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })
})
