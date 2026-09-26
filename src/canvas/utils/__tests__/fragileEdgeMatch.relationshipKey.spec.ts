/**
 * ⛔ A MEASURED FRAGILE RELATIONSHIP IS NOT DROPPED BECAUSE THE PRODUCER NAMED
 * IT BY ITS ENDPOINTS.
 *
 * Independent pre-review 5828017429 (#69), confirmed on CEE `0303ef5`'s served
 * pricing Run (the fixture here, verbatim):
 * - the drafted edges carry NO `id` (13 of 13), so `mapDraftEdgeToCanvas`
 *   gives them local ids `e-0`…`e-12`;
 * - every `fragile_edges` row carries `edge_id` as the producer's relationship
 *   key, `"<from_id>-><to_id>"` (`pro_plan_price->mrr`, switch 0.5504);
 * - `entryMatchesEdge` treated ANY present `edge_id` as exclusive canvas
 *   identity (Codex #1919), so `e-6` never matched. The default-view badge, the
 *   inspector's flip-risk row and the lens hover's entry all went missing on a
 *   55% relationship.
 *
 * The rule kept from #1919: a supplied id that names a DIFFERENT edge never
 * falls back to endpoints, and an endpoint match shared by parallel edges is
 * withheld. The rule added: a key that IS the row's own `from_id->to_id` names
 * no canvas edge, only the relationship, so it is read as the endpoint pair,
 * unless an edge on the canvas really carries that id, in which case that
 * edge is the exclusive match.
 */
import { describe, it, expect } from 'vitest'
import served from './fixtures/served-0303ef5-pricing-fragile-edges.json'
import { mapDraftEdgeToCanvas } from '../applyDraftResult'
import {
  findFragileEntryForEdge,
  getFragileEdgeSwitchProbability,
  isEdgeFragile,
  isTopFragileEdge,
  parallelEdgeIdsFor,
  type FragileEdgeCandidate,
} from '../fragileEdgeMatch'

const canvasEdges = served.draft_edges.map((e, i) => {
  const m = mapDraftEdgeToCanvas(e, i) as { id: string; source: string; target: string }
  return { id: m.id, source: m.source, target: m.target }
})
const rows = served.fragile_edges as FragileEdgeCandidate[]
const priceToMrr = canvasEdges.find((e) => e.source === 'pro_plan_price' && e.target === 'mrr')!
const ctxOf = (e: { source: string; target: string }, edges = canvasEdges) => ({
  parallelEdgeIds: parallelEdgeIdsFor(edges, e.source, e.target),
})

describe('the producer relationship key resolves to the id-less canvas edge (served 0303ef5 pricing)', () => {
  it('PRECONDITION — the served shapes are what this fix is about', () => {
    expect(served.draft_edges.every((e) => !('id' in e))).toBe(true)
    expect(priceToMrr.id).toBe('e-6')
    expect(rows[0]).toMatchObject({ edge_id: 'pro_plan_price->mrr', from_id: 'pro_plan_price', to_id: 'mrr', switch_probability: 0.5504 })
  })

  it('⭐ the 55% relationship is fragile, is the top one, and carries its measured value', () => {
    const ctx = ctxOf(priceToMrr)
    expect(isEdgeFragile(priceToMrr.id, priceToMrr.source, priceToMrr.target, rows, ctx)).toBe(true)
    expect(isTopFragileEdge(priceToMrr.id, priceToMrr.source, priceToMrr.target, rows, ctx)).toBe(true)
    expect(getFragileEdgeSwitchProbability(priceToMrr.id, priceToMrr.source, priceToMrr.target, rows, ctx)).toBe(0.5504)
    expect(findFragileEntryForEdge(priceToMrr.id, priceToMrr.source, priceToMrr.target, rows, ctx)).toBe(rows[0])
  })

  it('every served row lands on exactly its own edge, and no other edge borrows it', () => {
    for (const row of rows) {
      const owners = canvasEdges.filter((e) => findFragileEntryForEdge(e.id, e.source, e.target, [row], ctxOf(e)) !== null)
      expect(owners.map((e) => [e.source, e.target])).toEqual([[row.from_id, row.to_id]])
    }
  })

  it('CONTROL (#1919) — a supplied id naming a DIFFERENT edge still never falls back to endpoints', () => {
    const mismatched = [{ ...rows[0], edge_id: 'e9' }]
    expect(isEdgeFragile(priceToMrr.id, priceToMrr.source, priceToMrr.target, mismatched, ctxOf(priceToMrr))).toBe(false)
    // …nor does a relationship key whose endpoints disagree with the row's own.
    const inconsistent = [{ ...rows[0], edge_id: 'pro_plan_price->monthly_churn' }]
    expect(isEdgeFragile(priceToMrr.id, priceToMrr.source, priceToMrr.target, inconsistent, ctxOf(priceToMrr))).toBe(false)
  })

  it('CONTROL (#1919) — the key shared by PARALLEL canvas edges is withheld on both', () => {
    const withParallel = [...canvasEdges, { id: 'e-parallel', source: 'pro_plan_price', target: 'mrr' }]
    const ctx = ctxOf(priceToMrr, withParallel)
    expect(ctx.parallelEdgeIds).toEqual(['e-6', 'e-parallel'])
    expect(isEdgeFragile('e-6', 'pro_plan_price', 'mrr', rows, ctx)).toBe(false)
    expect(isEdgeFragile('e-parallel', 'pro_plan_price', 'mrr', rows, ctx)).toBe(false)
    expect(getFragileEdgeSwitchProbability('e-parallel', 'pro_plan_price', 'mrr', rows, ctx)).toBeNull()
  })

  it('CONTROL — when a canvas edge really carries the key as its id, that edge is the EXCLUSIVE match', () => {
    const keyed = [
      { id: 'pro_plan_price->mrr', source: 'pro_plan_price', target: 'mrr' },
      { id: 'e-parallel', source: 'pro_plan_price', target: 'mrr' },
    ]
    const ctx = ctxOf(keyed[0], keyed)
    expect(isEdgeFragile('pro_plan_price->mrr', 'pro_plan_price', 'mrr', rows, ctx)).toBe(true)
    expect(isEdgeFragile('e-parallel', 'pro_plan_price', 'mrr', rows, ctx)).toBe(false)
  })

  it('CONTROL — a caller with NO parallel context gets the old exclusive answer (fail closed)', () => {
    // Pre-review 5828511534: without the context this path cannot tell one edge
    // from two, so it must not guess.
    expect(isEdgeFragile(priceToMrr.id, priceToMrr.source, priceToMrr.target, rows)).toBe(false)
    expect(getFragileEdgeSwitchProbability(priceToMrr.id, priceToMrr.source, priceToMrr.target, rows)).toBeNull()
    // …while an exact id still matches with or without it.
    expect(isEdgeFragile('pro_plan_price->mrr', 'pro_plan_price', 'mrr', rows)).toBe(true)
  })

  it('CONTROL — a row below the display floor stays unshown however it is keyed', () => {
    const low = rows.find((r) => (r.switch_probability ?? 1) <= 0.15)!
    const edge = canvasEdges.find((e) => e.source === low.from_id && e.target === low.to_id)!
    expect(getFragileEdgeSwitchProbability(edge.id, edge.source, edge.target, [low], ctxOf(edge))).toBeNull()
  })
})
