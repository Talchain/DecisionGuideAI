/**
 * ⭐ D3 cut 6 HOLD-AT-1.0: the "Depends on" rows (ConnRow "N% conf.", Outcome/Risk hover) show the existence the Run USES —
 * 100 for a link CEE holds at 1.0 (the user's own range excludes zero), never Olumi's stored 80.
 */
import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCanvasStore } from '../../store'
import { useNodeConnections } from '../useNodeConnections'

function seed(edgeData: Record<string, unknown>) {
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    nodes: [
      { id: 'price', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price' } },
      { id: 'subs', type: 'outcome', position: { x: 100, y: 0 }, data: { label: 'Subscribers' } },
    ],
    edges: [{ id: 'e1', source: 'price', target: 'subs', type: 'styled', data: edgeData }],
    results: { status: 'complete', report: null },
  } as never)
}
const STORED = { weight: 0.4, beliefExists: 0.8, exists_probability: 0.8 }

describe('Depends on: the existence the Run uses', () => {
  it('HELD → 100', () => {
    seed({ ...STORED, existenceHeld: true })
    expect(renderHook(() => useNodeConnections('subs', 'inbound')).result.current[0]?.confidencePct).toBe(100)
  })
  it('TWIN (not held) → its stored 80', () => {
    seed({ ...STORED })
    expect(renderHook(() => useNodeConnections('subs', 'inbound')).result.current[0]?.confidencePct).toBe(80)
  })
})
