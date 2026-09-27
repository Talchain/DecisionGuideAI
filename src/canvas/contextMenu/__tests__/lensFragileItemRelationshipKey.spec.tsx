/**
 * ⛔ THE EDGE MENU'S "Show all fragile edges" FOLLOWS THE SAME IDENTITY RULE AS
 * THE CUE AND THE INSPECTOR.
 *
 * Pre-review 5828511534 on #2002: every caller of the shared matcher must hand
 * it the parallel-edge context, or the relationship-key fallback cannot tell one
 * edge from two. The menu called it without. Row = the served shape (CEE
 * `0303ef5` pricing, `pro_plan_price->mrr`, 0.5504) on a drafted edge `e-6`.
 * The lens flag is ON, the deployed posture.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMenuItems } from '../useMenuItems'
import type { EdgeTarget } from '../types'
import { useCanvasStore } from '../../store'
import { DEFAULT_EDGE_DATA } from '../../domain/edges'

vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isGraphLensEnabled: () => true,
}))

const ROW = { edge_id: 'pro_plan_price->mrr', from_id: 'pro_plan_price', to_id: 'mrr', switch_probability: 0.5504 }
const edge = (id: string) => ({ id, source: 'pro_plan_price', target: 'mrr', data: { ...DEFAULT_EDGE_DATA } })

function seed(edgeIds: string[]) {
  useCanvasStore.setState({
    nodes: [
      { id: 'pro_plan_price', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Pro plan price' } },
      { id: 'mrr', type: 'goal', position: { x: 100, y: 0 }, data: { label: 'MRR' } },
    ],
    edges: edgeIds.map(edge),
    results: { status: 'complete', report: { robustness: { fragile_edges: [ROW] } } },
  } as never)
}

function offersFragileLens(edgeId: string): boolean {
  const target: EdgeTarget = { kind: 'edge', edgeId, edge: edge(edgeId) as never, isStructural: false, screenPos: { x: 0, y: 0 } }
  const { result } = renderHook(() =>
    useMenuItems({ target, showToast: vi.fn(), screenToFlowPosition: (p) => p, onClose: vi.fn() }),
  )
  return result.current.some((e) => (e as { id?: string }).id === 'lens-fragile')
}

beforeEach(() => {
  useCanvasStore.setState(useCanvasStore.getState(), true)
})

describe('the edge menu fragile-lens item and the producer relationship key', () => {
  it('KEEP — one drafted edge (local id) offers it', () => {
    seed(['e-6'])
    expect(offersFragileLens('e-6')).toBe(true)
  })

  it('⭐ two parallel edges on those endpoints: neither offers it', () => {
    seed(['e-6', 'e-parallel'])
    expect(offersFragileLens('e-6')).toBe(false)
    expect(offersFragileLens('e-parallel')).toBe(false)
  })

  it('CONTROL — an edge that really carries the key offers it; its parallel twin does not', () => {
    seed(['pro_plan_price->mrr', 'e-parallel'])
    expect(offersFragileLens('pro_plan_price->mrr')).toBe(true)
    expect(offersFragileLens('e-parallel')).toBe(false)
  })
})
