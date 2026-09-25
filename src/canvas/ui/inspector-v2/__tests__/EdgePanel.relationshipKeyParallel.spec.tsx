/**
 * ⛔ THE EDGE INSPECTOR NEVER SHOWS ONE PARALLEL EDGE'S FINDING ON THE OTHER.
 *
 * Pre-review 5828511534 on #2002: the relationship-key fallback (a producer
 * `edge_id` of `"<from>-><to>"` read as the endpoint pair) is safe only with
 * the caller's parallel-edge context. `EdgePanel` called the matcher without
 * it, so two edges on the same endpoints would BOTH have shown the finding.
 *
 * The row is the served shape (CEE `0303ef5` pricing: `pro_plan_price->mrr`,
 * switch 0.5504, on a drafted edge whose canvas id is local, `e-6`). Mounted
 * the way `EdgePanel.fragilePresence.spec.tsx` mounts it (inspector-v2 is the
 * live path).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { EdgePanel } from '../panels/EdgePanel'
import { FRAGILE_CUE_SENTENCE } from '../../../edges/connectorCopy'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'

const ROW = { edge_id: 'pro_plan_price->mrr', from_id: 'pro_plan_price', to_id: 'mrr', switch_probability: 0.5504 }
const DATA = { weight: 0.5, direction: 'positive', beliefExists: 0.8, strengthStd: 0.1 }

function seed(edgeIds: string[]) {
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    nodes: [
      { id: 'pro_plan_price', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Pro plan price' } },
      { id: 'mrr', type: 'goal', position: { x: 100, y: 0 }, data: { label: 'MRR' } },
    ],
    edges: edgeIds.map((id) => ({ id, source: 'pro_plan_price', target: 'mrr', data: DATA })),
    results: { status: 'complete', report: { robustness: { fragile_edges: [ROW] } } },
  } as never)
}

function inspectorShowsFinding(edgeId: string): boolean {
  render(<EdgePanel edgeId={edgeId} techMode={false} onClose={vi.fn()} onNavigate={vi.fn()} />)
  const shows = screen.queryByText('55% flip risk') !== null
  // The heading and the number travel together; a half-rendered finding is a defect too.
  expect(screen.queryByText(FRAGILE_CUE_SENTENCE) !== null).toBe(shows)
  cleanup()
  return shows
}

beforeEach(() => {
  useCanvasStore.setState(useCanvasStore.getState(), true)
  useGuidanceStore.setState({ guidanceItems: [], _prefillChat: null, _sendMessage: null })
})

describe('EdgePanel and the producer relationship key', () => {
  it('KEEP — one drafted edge (local id) shows the served 55% finding', () => {
    seed(['e-6'])
    expect(inspectorShowsFinding('e-6')).toBe(true)
  })

  it('⭐ two parallel edges on those endpoints: NEITHER inspector shows it', () => {
    seed(['e-6', 'e-parallel'])
    expect(inspectorShowsFinding('e-6')).toBe(false)
    expect(inspectorShowsFinding('e-parallel')).toBe(false)
  })

  it('EXACT ID — an edge that really carries the key owns it; its parallel twin does not', () => {
    seed(['pro_plan_price->mrr', 'e-parallel'])
    expect(inspectorShowsFinding('pro_plan_price->mrr')).toBe(true)
    expect(inspectorShowsFinding('e-parallel')).toBe(false)
  })
})
