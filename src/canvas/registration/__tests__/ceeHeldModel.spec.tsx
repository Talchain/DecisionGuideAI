/**
 * OW-1 — the one-writer latch's READER and WRITER, as Panel's Run gate will
 * consume them (programme-docs #63 5797440981): stored state on the canvas
 * store (`ceeHeldScenarioIds`), read by identity through `ceeHoldsModel`.
 *
 * The reason it is stored, pinned directly: a selector over the latch re-runs
 * when an acknowledgement lands although the graph does not change — the
 * reactivity a selector bound to `nodes` cannot have.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import { useCanvasStore } from '../../store'
import {
  __resetCeeHeldModelLatchForTest,
  ceeHoldsModel,
  latchCeeHeldModel,
} from '../ceeHeldModel'

const A = '0a0a0a0a-1111-4111-8111-0a0a0a0a0a0a'
const B = '0b0b0b0b-2222-4222-8222-0b0b0b0b0b0b'

beforeEach(() => {
  __resetCeeHeldModelLatchForTest()
})

describe('ceeHoldsModel / latchCeeHeldModel', () => {
  it('reads the stored field by scenario: nothing latched at start, A only after A is latched', () => {
    expect(ceeHoldsModel(useCanvasStore.getState(), A)).toBe(false)
    latchCeeHeldModel(A, 'boot_read')
    expect(useCanvasStore.getState().ceeHeldScenarioIds.has(A)).toBe(true)
    expect(ceeHoldsModel(useCanvasStore.getState(), A)).toBe(true)
    expect(ceeHoldsModel(useCanvasStore.getState(), B)).toBe(false)
  })

  it('no id holds nothing, and latches nothing', () => {
    latchCeeHeldModel(null, 'registration')
    latchCeeHeldModel(undefined, 'registration')
    latchCeeHeldModel('', 'registration')
    expect(useCanvasStore.getState().ceeHeldScenarioIds.size).toBe(0)
    latchCeeHeldModel(A, 'registration')
    expect(ceeHoldsModel(useCanvasStore.getState(), null)).toBe(false)
    expect(ceeHoldsModel(useCanvasStore.getState(), undefined)).toBe(false)
    expect(ceeHoldsModel(useCanvasStore.getState(), '')).toBe(false)
  })

  it('is idempotent: a second acknowledgement for the same scenario writes nothing', () => {
    latchCeeHeldModel(A, 'registration')
    const first = useCanvasStore.getState().ceeHeldScenarioIds
    latchCeeHeldModel(A, 'applied_receipt')
    expect(useCanvasStore.getState().ceeHeldScenarioIds).toBe(first)
  })

  it('survives a decision-context change: resetting the canvas does not un-latch what CEE holds', () => {
    // A non-empty canvas, so `resetCanvas` takes its full path (the empty-graph
    // early return keeps the scenario id).
    useCanvasStore.setState({
      currentScenarioId: A,
      nodes: [{ id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'x', kind: 'factor' } }] as never,
      edges: [] as never,
    } as never)
    latchCeeHeldModel(A, 'boot_read')
    act(() => {
      useCanvasStore.getState().resetCanvas()
    })
    expect(useCanvasStore.getState().currentScenarioId).toBeNull()
    expect(ceeHoldsModel(useCanvasStore.getState(), A)).toBe(true)
  })

  it('⭐ a selector over the latch re-runs when an acknowledgement lands, with NO graph change', () => {
    useCanvasStore.setState({ currentScenarioId: A, nodes: [] as never, edges: [] as never } as never)
    const nodesBefore = useCanvasStore.getState().nodes
    const { result } = renderHook(() => useCanvasStore((s) => ceeHoldsModel(s, s.currentScenarioId)))
    expect(result.current).toBe(false)
    act(() => {
      latchCeeHeldModel(A, 'applied_receipt')
    })
    expect(useCanvasStore.getState().nodes).toBe(nodesBefore)
    expect(result.current).toBe(true)
  })
})
