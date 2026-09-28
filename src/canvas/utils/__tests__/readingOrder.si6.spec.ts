/**
 * Audit SI-6 (27 Sep 2026) — cards are met in the board's reading order.
 *
 * Measured on pricing (local and served): React Flow tabs through cards in
 * array order, the array was id order, and the walk went Question, the factors
 * at x 70, 522, 221, 672, 371, the GOAL, then the options, outcomes and risks.
 * The contract's prototype walks the Question, the options left to right, the
 * factors left to right, the outcomes and the risk left to right, the goal last.
 *
 * The positions below are the pricing starter's laid-out cards as measured on
 * screen (a positive-scale transform of the graph positions, so the order is
 * the same), fed in the id order the store holds them in.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { sortNodesInReadingOrder, readingRow } from '../readingOrder'

type N = { id: string; type: string; position: { x: number; y: number }; data?: unknown }
const n = (id: string, type: string, x: number, y: number, data?: unknown): N => ({ id, type, position: { x, y }, data })

/** Pricing, in the store's (id) order — the order the live Tab walk followed. */
const PRICING_ID_ORDER: N[] = [
  n('dec_pricing', 'decision', 298, 118),
  n('fac_adoption_friction', 'factor', 70, 372),
  n('fac_enterprise_revenue_risk', 'factor', 522, 372),
  n('fac_market_competition', 'factor', 221, 372),
  n('fac_top_account_concentration', 'factor', 672, 372),
  n('fac_usage_exposure', 'factor', 371, 372),
  n('goal_pricing_transition', 'goal', 298, 623),
  n('opt_full_switch', 'option', 145, 196),
  n('opt_hybrid', 'option', 296, 196),
  n('opt_new_logos', 'option', 446, 196),
  n('opt_status_quo', 'option', 597, 196),
  n('out_bottom_up_growth', 'outcome', 296, 497),
  n('out_nrr', 'outcome', 597, 497),
  n('risk_enterprise_churn', 'risk', 446, 497),
  n('risk_pricing_complexity', 'risk', 145, 497),
  n('__ghost-option__', 'ghost-option', 747, 196, { tier: 'option' }),
  n('__ghost-factor__', 'ghost-tier', 823, 372, { tier: 'factor' }),
  n('__ghost-consequence__', 'ghost-tier', 747, 497, { tier: 'consequence' }),
]

describe('SI-6 — the board\'s reading order', () => {
  it('⭐ pricing reads Question → options L→R → factors L→R → outcomes and risks L→R → Goal', () => {
    expect(sortNodesInReadingOrder(PRICING_ID_ORDER).map(x => x.id)).toEqual([
      'dec_pricing',
      'opt_full_switch', 'opt_hybrid', 'opt_new_logos', 'opt_status_quo', '__ghost-option__',
      'fac_adoption_friction', 'fac_market_competition', 'fac_usage_exposure', 'fac_enterprise_revenue_risk', 'fac_top_account_concentration', '__ghost-factor__',
      'risk_pricing_complexity', 'out_bottom_up_growth', 'risk_enterprise_churn', 'out_nrr', '__ghost-consequence__',
      'goal_pricing_transition',
    ])
  })

  it('the Goal comes after every option — the audit\'s sharpest case', () => {
    const ids = sortNodesInReadingOrder(PRICING_ID_ORDER).map(x => x.id)
    for (const opt of ids.filter(id => id.startsWith('opt_'))) {
      expect(ids.indexOf(opt)).toBeLessThan(ids.indexOf('goal_pricing_transition'))
    }
  })

  it('a wrapped row reads line by line, each line left to right', () => {
    const wrapped = [
      n('f_b2', 'factor', 300, 520), n('f_a1', 'factor', 0, 400), n('f_b1', 'factor', 0, 520), n('f_a2', 'factor', 300, 400),
    ]
    expect(sortNodesInReadingOrder(wrapped).map(x => x.id)).toEqual(['f_a1', 'f_a2', 'f_b1', 'f_b2'])
  })

  it('a card is read with its family, by the layout\'s row, not by where a drag left it', () => {
    // A factor dragged up level with the options (y 196) still reads after them:
    // the order is the board's families (TIER_BY_KIND), then left to right.
    const dragged = PRICING_ID_ORDER.map(x => x.id === 'fac_adoption_friction' ? n(x.id, x.type, 70, 196) : x)
    const ids = sortNodesInReadingOrder(dragged).map(x => x.id)
    expect(ids.indexOf('fac_adoption_friction')).toBeGreaterThan(ids.indexOf('__ghost-option__'))
    expect(ids.indexOf('fac_adoption_friction')).toBeLessThan(ids.indexOf('fac_market_competition'))
  })

  it('a door belongs to the row it ends: an outcome/risk door is read with that row, before the Goal', () => {
    expect(readingRow(n('__ghost-consequence__', 'ghost-tier', 0, 0, { tier: 'consequence' }))).toBe(readingRow(n('o', 'outcome', 0, 0)))
    expect(readingRow(n('__ghost-option__', 'ghost-option', 0, 0, { tier: 'option' }))).toBe(readingRow(n('o', 'option', 0, 0)))
  })

  it('returns the SAME array when it is already in order (no churn downstream of the memo)', () => {
    const ordered = sortNodesInReadingOrder(PRICING_ID_ORDER)
    expect(sortNodesInReadingOrder(ordered)).toBe(ordered)
  })

  it('keeps every node exactly once', () => {
    const out = sortNodesInReadingOrder(PRICING_ID_ORDER)
    expect(out).toHaveLength(PRICING_ID_ORDER.length)
    expect(new Set(out)).toEqual(new Set(PRICING_ID_ORDER))
  })
})

/**
 * THE WIRING (review, 28 Sep 2026: reverting only the `ReactFlowGraph.tsx` line
 * left every spec green). The sort above is only the reading order if the board
 * renders its output, so bind the one array the board hands `<ReactFlow>` to
 * it. CLAIM TYPE: a source scan of the wiring, comments blanked, so a
 * commented-out call cannot satisfy it. That Tab then walks it is the browser
 * witness's claim.
 */
describe('SI-6 wiring — the board renders the sorted array', () => {
  const raw = readFileSync(resolve(__dirname, '../../ReactFlowGraph.tsx'), 'utf8')
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('`memoizedNodes` is the output of `sortNodesInReadingOrder`', () => {
    const start = src.indexOf('const memoizedNodes = useMemo(')
    expect(start, 'PRECONDITION: the memo exists').toBeGreaterThan(-1)
    const end = src.indexOf('}, [nodesWithGhost])', start)
    expect(end, 'PRECONDITION: the memo closes on its dependency list').toBeGreaterThan(start)
    expect(src.slice(start, end)).toMatch(/return\s+sortNodesInReadingOrder\(/)
  })

  it('the board\'s <ReactFlow> takes `memoizedNodes`', () => {
    expect(src.match(/<ReactFlow\s+nodes=\{memoizedNodes\}/g)?.length ?? 0).toBeGreaterThan(0)
  })
})
