/**
 * THE DEFECT (Paul's staging test, 28 Sep 2026; build-vs-buy served on
 * 662afcfd): the links into the outcome/risk row cross in a tangle of
 * near-horizontal runs above it. ELK ordered that row against the factor layer
 * as ELK laid it out; the brick courses and the spine then moved every factor,
 * so the row's order was tuned to positions that no longer exist. Measured on
 * the served after-Run capture: 33 crossings where 16 is the fewest any order
 * reaches.
 *
 * ⚠ EVERY ORDER ASSERTION BINDS BY NODE ID, read out left to right, so a
 * permutation with the right x values on the wrong cards fails.
 */
import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import { layoutGraph, orderConsequenceRowsByUpstream } from '../layout'
import { REPEATED_CARD_W, TIER_BY_KIND } from '../nodeLayoutConstants'
import capture from '../../__tests__/__fixtures__/starter-node-heights.browser-capture-2026-09-24-s5.json'
import vendorSelection from '../../starters/data/vendor-selection.draft.json'
import marketEntry from '../../starters/data/market-entry.draft.json'
import buildVsBuy from '../../starters/data/build-vs-buy.draft.json'
import headcountAllocation from '../../starters/data/headcount-allocation.draft.json'
import pricingModel from '../../starters/data/pricing-model.draft.json'

type P = { x: number; y: number }
type Link = { source: string; target: string }

/** Crossings between a row and one side of it, counted independently of the module. */
function crossings(rowIds: string[], links: Link[], pos: Map<string, P>, rowY: number): number {
  const row = new Set(rowIds)
  const sides: Record<'above' | 'below', Array<[string, string]>> = { above: [], below: [] }
  for (const l of links) {
    const pair = row.has(l.target) ? [l.target, l.source] : row.has(l.source) ? [l.source, l.target] : null
    if (!pair || row.has(pair[1]!) || !pos.has(pair[1]!)) continue
    sides[pos.get(pair[1]!)!.y < rowY ? 'above' : 'below'].push(pair as [string, string])
  }
  let n = 0
  for (const side of Object.values(sides)) {
    for (let i = 0; i < side.length; i++) for (let j = i + 1; j < side.length; j++) {
      const [a, b] = side[i]!, [c, d] = side[j]!
      if (a === c || b === d) continue
      if ((pos.get(a)!.x - pos.get(c)!.x) * (pos.get(b)!.x - pos.get(d)!.x) < 0) n++
    }
  }
  return n
}

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs]
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]))
}

/** The fewest crossings any seating of `rowIds` into its own slots reaches. */
function fewestCrossings(rowIds: string[], links: Link[], pos: Map<string, P>): number {
  const slots = [...rowIds].sort((a, b) => pos.get(a)!.x - pos.get(b)!.x).map((id) => pos.get(id)!)
  let best = Infinity
  for (const perm of permutations(rowIds)) {
    const trial = new Map(pos)
    perm.forEach((id, i) => trial.set(id, slots[i]!))
    best = Math.min(best, crossings(rowIds, links, trial, slots[0]!.y))
  }
  return best
}

const leftToRight = (ids: string[], pos: Map<string, P>) => [...ids].sort((a, b) => pos.get(a)!.x - pos.get(b)!.x)

// ── The served shape: build-vs-buy after Run on 662afcfd, 1440×900, world units
// (screen rect ÷ zoom 0.5). Cards are all 248 wide; x is the card's left edge.
const W = 248
const SERVED: Record<string, P> = {
  fac_platform_migration: { x: 610, y: 684 }, fac_eng_capacity: { x: 906, y: 684 },
  fac_billing_complexity: { x: 1202, y: 684 }, fac_dev_time: { x: 1498, y: 684 },
  fac_build_indicator: { x: 462, y: 1047 }, fac_stripe_indicator: { x: 758, y: 1047 },
  fac_vendor_indicator: { x: 1054, y: 1047 }, fac_vendor_cost: { x: 1350, y: 1047 },
  risk_eng_overload: { x: 314, y: 1337 }, out_delivery_speed: { x: 610, y: 1337 },
  risk_billing_errors: { x: 906, y: 1337 }, out_billing_accuracy: { x: 1202, y: 1337 },
  risk_vendor_lock: { x: 1498, y: 1337 }, goal_billing: { x: 762, y: 1645 },
}
const SERVED_LINKS: Link[] = [
  ['fac_billing_complexity', 'out_delivery_speed'], ['fac_billing_complexity', 'risk_billing_errors'],
  ['fac_build_indicator', 'out_billing_accuracy'], ['fac_build_indicator', 'risk_billing_errors'],
  ['fac_dev_time', 'out_delivery_speed'], ['fac_eng_capacity', 'out_delivery_speed'],
  ['fac_eng_capacity', 'risk_eng_overload'], ['fac_platform_migration', 'risk_eng_overload'],
  ['fac_stripe_indicator', 'out_billing_accuracy'], ['fac_stripe_indicator', 'risk_billing_errors'],
  ['fac_vendor_cost', 'risk_vendor_lock'], ['fac_vendor_indicator', 'out_billing_accuracy'],
  ['fac_vendor_indicator', 'risk_billing_errors'], ['fac_vendor_indicator', 'risk_vendor_lock'],
  ['out_billing_accuracy', 'goal_billing'], ['out_delivery_speed', 'goal_billing'],
  ['risk_billing_errors', 'goal_billing'], ['risk_eng_overload', 'goal_billing'], ['risk_vendor_lock', 'goal_billing'],
].map(([source, target]) => ({ source: source!, target: target! }))
const SERVED_ROW = ['risk_eng_overload', 'out_delivery_speed', 'risk_billing_errors', 'out_billing_accuracy', 'risk_vendor_lock']

function servedMaps() {
  const pos = new Map(Object.entries(SERVED).map(([k, v]) => [k, { ...v }]))
  // Crossing geometry reads card CENTRES; every card here is W wide, so left edges order the same.
  const size = new Map(Object.keys(SERVED).map((k) => [k, { width: k === 'goal_billing' ? 720 : W, height: 200 }]))
  const tiers = new Map<number, string[]>([
    [TIER_BY_KIND.factor, Object.keys(SERVED).filter((k) => k.startsWith('fac_'))],
    [TIER_BY_KIND.outcome, SERVED_ROW],
    [TIER_BY_KIND.goal, ['goal_billing']],
  ])
  return { pos, size, tiers }
}

describe('the consequence row reads in the order of the cards it hangs from', () => {
  it('⭐ SERVED build-vs-buy: 33 crossings become the fewest any order reaches (16), seated by id', () => {
    const { pos, size, tiers } = servedMaps()
    expect(crossings(SERVED_ROW, SERVED_LINKS, pos, 1337)).toBe(33)
    const floor = fewestCrossings(SERVED_ROW, SERVED_LINKS, pos)
    expect(floor).toBe(16)

    orderConsequenceRowsByUpstream(pos, size, tiers, SERVED_LINKS, W)

    expect(leftToRight(SERVED_ROW, pos)).toEqual([
      'risk_eng_overload', 'out_billing_accuracy', 'risk_billing_errors', 'out_delivery_speed', 'risk_vendor_lock',
    ])
    expect(crossings(SERVED_ROW, SERVED_LINKS, pos, 1337)).toBe(floor)
  })

  it('⭐ IT IS A PERMUTATION: the same slots, every y unchanged, nothing outside the row moves', () => {
    const { pos, size, tiers } = servedMaps()
    const before = new Map([...pos].map(([k, v]) => [k, { ...v }]))
    orderConsequenceRowsByUpstream(pos, size, tiers, SERVED_LINKS, W)
    const slotKey = (p: P) => `${p.x},${p.y}`
    expect(SERVED_ROW.map((id) => slotKey(pos.get(id)!)).sort()).toEqual(SERVED_ROW.map((id) => slotKey(before.get(id)!)).sort())
    for (const id of SERVED_ROW) expect(pos.get(id)!.y).toBe(before.get(id)!.y)
    for (const id of Object.keys(SERVED).filter((k) => !SERVED_ROW.includes(k))) expect(pos.get(id)).toEqual(before.get(id))
    expect(SERVED_ROW.some((id) => pos.get(id)!.x !== before.get(id)!.x)).toBe(true)
  })

  it('⛔ NEVER ADDS A CROSSING: where barycentre is worse (6 → 7), the row stays exactly as it was', () => {
    // Found by exhaustive search: sources s0..s4 left to right, row t0 t1 t2.
    // Barycentre order is t1 t0 t2, which crosses 7 times against the current 6.
    const pos = new Map<string, P>([
      ...[0, 1, 2, 3, 4].map((i) => [`s${i}`, { x: i * 300, y: 0 }] as [string, P]),
      ...[0, 1, 2].map((i) => [`t${i}`, { x: 150 + i * 300, y: 500 }] as [string, P]),
    ])
    const size = new Map([...pos.keys()].map((k) => [k, { width: W, height: 100 }]))
    const links: Link[] = [['s0', 't1'], ['s1', 't2'], ['s2', 't0'], ['s3', 't0'], ['s3', 't1'], ['s4', 't1'], ['s4', 't2']]
      .map(([source, target]) => ({ source: source!, target: target! }))
    const row = ['t0', 't1', 't2']
    expect(crossings(row, links, pos, 500)).toBe(6)
    const barycentreSeat = new Map(pos)
    ;(['t1', 't0', 't2'] as const).forEach((id, i) => barycentreSeat.set(id, pos.get(`t${i}`)!))
    expect(crossings(row, links, barycentreSeat, 500)).toBe(7)

    const before = new Map([...pos].map(([k, v]) => [k, { ...v }]))
    orderConsequenceRowsByUpstream(pos, size, new Map([[TIER_BY_KIND.outcome, row], [TIER_BY_KIND.factor, ['s0', 's1', 's2', 's3', 's4']]]), links, W)
    for (const id of row) expect(pos.get(id)).toEqual(before.get(id))
  })

  it('⚠ A ROW OF UNEQUAL WIDTHS IS LEFT ALONE: swapping unequal footprints is not a permutation', () => {
    const { pos, size, tiers } = servedMaps()
    size.set('risk_vendor_lock', { width: W + 40, height: 200 })
    const before = new Map([...pos].map(([k, v]) => [k, { ...v }]))
    orderConsequenceRowsByUpstream(pos, size, tiers, SERVED_LINKS, W)
    for (const id of SERVED_ROW) expect(pos.get(id)).toEqual(before.get(id))
  })

  it('⚠ NOR MAY IT STRETCH A LINK THAT RUNS ALONG THE ROW: fewer crossings bought that way leave the row alone', () => {
    const { pos, size, tiers } = servedMaps()
    // A risk into a neighbouring outcome, one slot apart now; the barycentre
    // order would put them three slots apart.
    const links = [...SERVED_LINKS, { source: 'out_billing_accuracy', target: 'risk_vendor_lock' }]
    const before = new Map([...pos].map(([k, v]) => [k, { ...v }]))
    orderConsequenceRowsByUpstream(pos, size, tiers, links, W)
    for (const id of SERVED_ROW) expect(pos.get(id)).toEqual(before.get(id))
    // CONTROL: the same row without that link IS reordered (the served row above).
  })

  // ── Wiring: the real layout, on the shipped starters.
  const HEIGHTS = (capture as { heights: Record<string, Record<string, number>> }).heights
  type Draft = { nodes: Array<{ id: string; kind: string; label: string }>; edges: Array<{ from?: string; to?: string }> }
  const STARTERS: Record<string, Draft> = {
    'vendor-selection': vendorSelection as unknown as Draft,
    'market-entry': marketEntry as unknown as Draft,
    'build-vs-buy': buildVsBuy as unknown as Draft,
    'headcount-allocation': headcountAllocation as unknown as Draft,
    'pricing-model': pricingModel as unknown as Draft,
  }

  async function laidOut(starter: string) {
    const draft = STARTERS[starter]!
    const nodes = draft.nodes.map((n) => ({
      id: n.id, type: n.kind, position: { x: 0, y: 0 },
      data: { label: n.label, kind: n.kind },
      measured: { width: REPEATED_CARD_W, height: HEIGHTS[starter]![n.id] },
    })) as unknown as Node[]
    const edges = draft.edges.map((e, i) => ({ id: `e${i}`, source: e.from!, target: e.to! })) as Edge[]
    const out = await layoutGraph(nodes, edges, {})
    const pos = new Map(out.nodes.map((n) => [n.id, { x: n.position.x, y: n.position.y }]))
    const row = draft.nodes.filter((n) => TIER_BY_KIND[n.kind] === TIER_BY_KIND.outcome).map((n) => n.id)
    return { pos, row, links: edges as Link[] }
  }

  it('⭐ WIRED INTO layoutGraph: build-vs-buy lays its consequence row out at the fewest crossings, by id', async () => {
    const { pos, row, links } = await laidOut('build-vs-buy')
    expect(leftToRight(row, pos)).toEqual([
      'risk_eng_overload', 'out_billing_accuracy', 'risk_billing_errors', 'out_delivery_speed', 'risk_vendor_lock',
    ])
    expect(crossings(row, links, pos, pos.get(row[0]!)!.y)).toBe(fewestCrossings(row, links, pos))
  })

  // Measured at 662afcfd + this step: vendor-selection 19 → 15, market-entry 42 → 28,
  // build-vs-buy 33 → 16 (the served count); headcount 2 and pricing 4 unchanged.
  it.each(Object.keys(STARTERS))('%s: a row the step moves crosses FEWER times than ELK\'s order; a row it leaves crosses the same', async (starter) => {
    // The pre-step orders, recorded from `laptopFit1280.bandRows.spec.ts` at staging 662afcfd.
    const PRE_STEP: Record<string, string[]> = {
      'vendor-selection': ['out_budget_headroom', 'risk_gdpr_breach', 'risk_team_overload', 'risk_migration_delay', 'out_platform_capability'],
      'market-entry': ['out_uk_arr_retention', 'out_new_market_arr', 'risk_localisation_drag', 'risk_uk_distraction', 'risk_team_overstretch'],
      'build-vs-buy': ['risk_eng_overload', 'out_delivery_speed', 'risk_billing_errors', 'out_billing_accuracy', 'risk_vendor_lock'],
      'headcount-allocation': ['out_reliability', 'risk_eng_attrition', 'risk_churn', 'out_new_arr', 'risk_sales_miss'],
      'pricing-model': ['risk_pricing_complexity', 'out_bottom_up_growth', 'risk_enterprise_churn', 'out_nrr'],
    }
    const { pos, row, links } = await laidOut(starter)
    const rowY = pos.get(row[0]!)!.y
    const slots = leftToRight(row, pos).map((id) => pos.get(id)!)
    const preStep = new Map(pos)
    PRE_STEP[starter]!.forEach((id, i) => preStep.set(id, slots[i]!))
    const moved = leftToRight(row, pos).join() !== PRE_STEP[starter]!.join()
    const [now, pre] = [crossings(row, links, pos, rowY), crossings(row, links, preStep, rowY)]
    if (moved) expect(now, `${starter}: ${pre} → ${now}`).toBeLessThan(pre)
    else expect(now).toBe(pre)
    // Which rows move is part of the claim: three of the five.
    expect(moved).toBe(['vendor-selection', 'market-entry', 'build-vs-buy'].includes(starter))
  })
})
