/**
 * ⭐ A CAUSE IS NEVER DEALT INTO A LOWER ROW THAN ITS EFFECT (27 Sep 2026).
 *
 * Paul's MRR model (served e8ba18e6, debug export 17d1cd3a): five factors wrap
 * into two rows. Dealt on ELK's x order alone, "Pro paying subscribers" took the
 * FIRST row and "Monthly new Pro subscribers", which drives it, the second — so
 * the link ran UP into the bottom of its target, beside a second same-row link.
 * The graph below is that model's own nodes and links, verbatim.
 */
import { describe, it, expect } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { layoutGraph, inTierCausalDepth } from '../utils/layout'
import { REPEATED_CARD_W } from '../utils/nodeLayoutConstants'

const node = (id: string, type: string, h = 120): Node =>
  ({ id, type, position: { x: 0, y: 0 }, data: { label: id, kind: type }, measured: { width: REPEATED_CARD_W, height: h } }) as unknown as Node

const KINDS: Array<[string, string]> = [
  ['decision_mrr', 'decision'], ['mrr', 'goal'],
  ['keep_current_49_price', 'option'], ['increase_price_to_59', 'option'], ['increase_price_to_54', 'option'],
  ['pro_plan_price', 'factor'], ['pro_paying_subscribers', 'factor'], ['monthly_churn', 'factor'],
  ['monthly_new_pro_subscribers', 'factor'], ['other_mrr_growth', 'factor'],
  ['price_sensitivity', 'risk'],
]
const LINKS: Array<[string, string]> = [
  ['decision_mrr', 'keep_current_49_price'], ['decision_mrr', 'increase_price_to_59'], ['decision_mrr', 'increase_price_to_54'],
  ['increase_price_to_59', 'pro_plan_price'], ['increase_price_to_54', 'pro_plan_price'], ['keep_current_49_price', 'pro_plan_price'],
  ['pro_plan_price', 'mrr'], ['pro_plan_price', 'price_sensitivity'], ['price_sensitivity', 'monthly_churn'],
  ['pro_plan_price', 'monthly_new_pro_subscribers'], ['monthly_churn', 'pro_paying_subscribers'],
  ['monthly_new_pro_subscribers', 'pro_paying_subscribers'], ['pro_paying_subscribers', 'mrr'], ['other_mrr_growth', 'mrr'],
]
const edges: Edge[] = LINKS.map(([s, t], i) => ({ id: `e-${i}`, source: s, target: t }) as Edge)
const heights = new Map(KINDS.map(([id, k]) => [id, k === 'decision' || k === 'goal' ? 110 : 150]))

describe("Paul's MRR model: every same-band link runs down or across, never up", () => {
  it('the five factors still wrap into two rows, and no factor→factor link points upward', async () => {
    const out = await layoutGraph(KINDS.map(([id, k]) => node(id, k, heights.get(id))), edges, { heightAtLabelBound: heights })
    const y = new Map(out.nodes.map((n) => [n.id, n.position.y]))
    const factors = KINDS.filter(([, k]) => k === 'factor').map(([id]) => id)
    // Contrast: the row sizes are the layout's own (5 → 3 + 2); nothing is added.
    expect(new Set(factors.map((id) => y.get(id))).size).toBe(2)
    const upward = LINKS.filter(([s, t]) => factors.includes(s) && factors.includes(t) && y.get(s)! > y.get(t)!)
    expect(upward, 'a factor→factor link runs up into the bottom of its target').toEqual([])
    // The chain's end sits below both of its causes.
    expect(y.get('pro_paying_subscribers')!).toBeGreaterThan(y.get('monthly_churn')!)
  })
})

describe('inTierCausalDepth', () => {
  it('counts only same-tier links, and a same-tier cycle terminates', () => {
    const tiers = new Map<number, string[]>([[1, ['a', 'b', 'c', 'd']], [2, ['z']]])
    const d = inTierCausalDepth(tiers, [
      { source: 'a', target: 'b' }, { source: 'b', target: 'c' }, { source: 'z', target: 'd' }, { source: 'c', target: 'a' },
    ])
    expect(d.get('z')).toBe(0)
    expect(d.get('d')).toBe(0) // its only cause is in another tier
    for (const id of ['a', 'b', 'c']) expect(d.get(id)!).toBeLessThan(4)
    const acyclic = inTierCausalDepth(tiers, [{ source: 'a', target: 'b' }, { source: 'b', target: 'c' }])
    expect([acyclic.get('a'), acyclic.get('b'), acyclic.get('c'), acyclic.get('d')]).toEqual([0, 1, 2, 0])
  })
})
