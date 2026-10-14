/**
 * Data layer Phase 1 (+ placeholder licence): a link nobody sized never prints its default prior as a number.
 * Served wire shape mrr-17d1cd3a: Pro plan price → MRR is CEE's 0.5 placeholder; it used to read "50%".
 * Control: Olumi's −0.4 estimate on the same board keeps its figure. Bound by edge id.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import fixture from '../../../../../e2e/geometry/fixtures/mrr-17d1cd3a.fixture.json'
import { EdgePills } from '../EdgePills'
import { mapDraftEdgeToCanvas } from '../../../utils/applyDraftResult'
import { edgeProvenance } from '../../../domain/edgeProvenance'

vi.mock('../../../store', () => ({ useCanvasStore: vi.fn() }))
import { useCanvasStore } from '../../../store'

type WireEdge = Record<string, unknown> & { from: string; to: string }
const WIRE = (fixture as unknown as { draft: { edges: WireEdge[] } }).draft.edges
const dataFor = (from: string, to: string) => {
  const i = WIRE.findIndex((w) => w.from === from && w.to === to)
  expect(i).toBeGreaterThanOrEqual(0)
  return mapDraftEdgeToCanvas({ ...WIRE[i] }, i).data as Record<string, unknown>
}

function pillsFor(data: Record<string, unknown>) {
  const state = {
    edges: [{ id: 'e1', source: 'f1', target: 'o1', data }],
    nodes: [{ id: 'o1', type: 'outcome', data: { label: 'MRR' } }],
  }
  vi.mocked(useCanvasStore).mockImplementation((sel: any) => sel(state as never))
  return render(<EdgePills nodeId="f1" />).container
}

beforeEach(() => { vi.clearAllMocks() })

describe('EdgePills — a placeholder is never a number', () => {
  it('Pro plan price → MRR (0.5 placeholder): no "%" anywhere on the pill', () => {
    const d = dataFor('pro_plan_price', 'mrr')
    expect(edgeProvenance(d)?.kind).toBe('placeholder')
    const c = pillsFor(d)
    expect(c.textContent ?? '').not.toMatch(/\d+%/)
    expect(c.innerHTML).not.toMatch(/50%/)
  })
  it('CONTROL: Olumi\'s estimate (Pro plan price → new subscribers) keeps its figure', () => {
    const d = dataFor('pro_plan_price', 'monthly_new_pro_subscribers')
    expect(edgeProvenance(d)?.kind).toBe('olumi_estimate')
    expect(pillsFor(d).innerHTML).toMatch(/\d+%/)
  })
})
