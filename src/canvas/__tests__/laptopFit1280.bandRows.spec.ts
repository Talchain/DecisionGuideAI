/**
 * ⭐⭐ GAP 7 — EVERY BAND ROW FITS THE 1280×800 DOCK-OPEN FRAME, BOUND BY CARD ID.
 *
 * Experience Design, #63 5808428246: 1280×800 with the Olumi dock open is the
 * ACCEPTANCE size (1440×900 the second), with no zoom floor below 0.5. At that
 * size the fit frame is 760px wide, i.e. 1520 flow units at the 0.5 floor —
 * derived through the real `computeFitPadding` and pinned in
 * `laptopFit.arithmetic.spec.ts`, so it is not re-derived here.
 *
 * A band of five repeated cards plus its 160 row-end prompt needed 1740 units,
 * so a five-option / five-factor / five-consequence band spilled 220 units
 * (110px at the floor). Canvas lead decision (decide-and-flag, 25 Sep 2026):
 * cap a band row at FOUR cards and wrap the rest to a further sub-row IN THE
 * SAME BAND — the S4 balanced wrap (ED #63 5806207128), so five reads 3 + 2 —
 * keeping the family grouping and the cards' left-to-right order.
 *
 * Every assertion names the cards it is about. The five-card bands and their
 * one-row, left-to-right order are RECORDED from the base layout (103e1ca6,
 * real `layoutGraph`, the S5 capture heights) — never derived from the layout
 * under test, which would be a guard agreeing with itself.
 */
import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import { layoutGraph } from '../utils/layout'
import { withGhostTiers } from '../utils/ghostTiers'
import {
  LAYOUT_NODE_GAP,
  LAYOUT_PADDING_X,
  REPEATED_CARD_W,
  ROW_PROMPT_W,
  TIER_BY_KIND,
} from '../utils/nodeLayoutConstants'
import capture from './__fixtures__/starter-node-heights.browser-capture-2026-09-24-s5.json'
import vendorSelection from '../starters/data/vendor-selection.draft.json'
import marketEntry from '../starters/data/market-entry.draft.json'
import buildVsBuy from '../starters/data/build-vs-buy.draft.json'
import headcountAllocation from '../starters/data/headcount-allocation.draft.json'
import pricingModel from '../starters/data/pricing-model.draft.json'

type Draft = { nodes: Array<{ id: string; kind: string; label: string }>; edges: Array<{ from?: string; to?: string }> }
const STARTERS: Record<string, Draft> = {
  'vendor-selection': vendorSelection as unknown as Draft,
  'market-entry': marketEntry as unknown as Draft,
  'build-vs-buy': buildVsBuy as unknown as Draft,
  'headcount-allocation': headcountAllocation as unknown as Draft,
  'pricing-model': pricingModel as unknown as Draft,
}
const HEIGHTS = (capture as { heights: Record<string, Record<string, number>> }).heights

/** The 1280×800 dock-open frame at the 0.5 floor, in flow units (760px / 0.5). */
const FRAME_1280_FLOW_AT_FLOOR = 1520

/** The card-to-card (and card-to-prompt) stride, box plus gap. */
const STRIDE = REPEATED_CARD_W + LAYOUT_PADDING_X + LAYOUT_NODE_GAP

/**
 * Every five-card band in the shipped starters, in its ONE-ROW left-to-right
 * order at the base (recorded, see the header). `prompts` are the row-end
 * prompts that family carries, in stack order.
 */
const FIVE_CARD_BANDS: Array<{ starter: string; family: string; order: string[]; prompts: string[] }> = [
  { starter: 'vendor-selection', family: 'consequence', prompts: ['__ghost-consequence__'],
    order: ['out_budget_headroom', 'risk_gdpr_breach', 'risk_team_overload', 'risk_migration_delay', 'out_platform_capability'] },
  { starter: 'market-entry', family: 'consequence', prompts: ['__ghost-consequence__'],
    order: ['out_uk_arr_retention', 'out_new_market_arr', 'risk_localisation_drag', 'risk_uk_distraction', 'risk_team_overstretch'] },
  { starter: 'build-vs-buy', family: 'consequence', prompts: ['__ghost-consequence__'],
    order: ['risk_eng_overload', 'out_delivery_speed', 'risk_billing_errors', 'out_billing_accuracy', 'risk_vendor_lock'] },
  { starter: 'headcount-allocation', family: 'factor', prompts: ['__ghost-factor__'],
    order: ['fac_eng_attrition', 'fac_eng_headcount', 'fac_market_demand', 'fac_ae_headcount', 'fac_quota_attainment'] },
  { starter: 'headcount-allocation', family: 'consequence', prompts: ['__ghost-consequence__'],
    order: ['out_reliability', 'risk_eng_attrition', 'risk_churn', 'out_new_arr', 'risk_sales_miss'] },
  { starter: 'pricing-model', family: 'factor', prompts: ['__ghost-factor__'],
    order: ['fac_adoption_friction', 'fac_market_competition', 'fac_usage_exposure', 'fac_enterprise_revenue_risk', 'fac_top_account_concentration'] },
]

/** CONTRAST: bands of FOUR or of EIGHT, whose shape must not move. */
const UNCHANGED_BANDS: Array<{ starter: string; rows: string[][] }> = [
  { starter: 'pricing-model', rows: [['risk_pricing_complexity', 'out_bottom_up_growth', 'risk_enterprise_churn', 'out_nrr']] },
  { starter: 'pricing-model', rows: [['opt_full_switch', 'opt_hybrid', 'opt_new_logos', 'opt_status_quo']] },
  { starter: 'vendor-selection', rows: [
    ['fac_annual_cost', 'fac_gdpr_compliance', 'fac_data_team_capacity', 'fac_ops_overhead'],
    ['fac_migration_effort', 'fac_segment', 'fac_snowflake_build', 'fac_rudderstack'],
  ] },
]

async function laidOut(starter: string) {
  const draft = STARTERS[starter]
  const nodes = draft.nodes.map((n) => ({
    id: n.id,
    type: n.kind,
    position: { x: 0, y: 0 },
    data: { label: n.label, kind: n.kind },
    measured: { width: REPEATED_CARD_W, height: HEIGHTS[starter][n.id] },
  })) as unknown as Node[]
  const edges = draft.edges.map((e, i) => ({ id: `e${i}`, source: e.from!, target: e.to! })) as Edge[]
  const out = await layoutGraph(nodes, edges, {})
  const withPrompts = withGhostTiers(out.nodes)
  const at = (id: string) => {
    const n = withPrompts.find((x) => x.id === id)
    if (!n) throw new Error(`${starter}: no node ${id}`)
    return n
  }
  return { out, at, draft, withPrompts }
}

/** The named cards' sub-rows: grouped by exact y, top to bottom, each left to right. */
function subRowsOf(ids: readonly string[], at: (id: string) => Node): string[][] {
  const byY = new Map<number, string[]>()
  for (const id of ids) {
    const y = at(id).position.y
    byY.set(y, [...(byY.get(y) ?? []), id])
  }
  return [...byY.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, row]) => row.sort((a, b) => at(a).position.x - at(b).position.x))
}

describe('gap 7 — a five-card band wraps inside its own band, in its own order', () => {
  it('the recorded bands are the starters\' real five-card families (non-vacuity)', () => {
    for (const band of FIVE_CARD_BANDS) {
      const draft = STARTERS[band.starter]
      const tierOf = (id: string) => TIER_BY_KIND[draft.nodes.find((n) => n.id === id)!.kind]
      const tier = tierOf(band.order[0])
      const family = draft.nodes.filter((n) => TIER_BY_KIND[n.kind] === tier).map((n) => n.id).sort()
      expect(family, `${band.starter} ${band.family}`).toEqual([...band.order].sort())
    }
  })

  it.each(FIVE_CARD_BANDS.map((b) => [`${b.starter} ${b.family}`, b] as const))(
    '%s: wraps 3 + 2, reading order unchanged, the second course laid in brick',
    async (_name, band) => {
      const { at } = await laidOut(band.starter)
      const rows = subRowsOf(band.order, at)
      expect(rows.map((r) => r.length)).toEqual([3, 2])
      // Reading order — left to right, then down — is the one-row order it had.
      expect(rows.flat()).toEqual(band.order)
      // One block under one family label, same stride in each course; v3.1 WS1
      // #10: the second course sits HALF A STRIDE right, so each of its cards
      // stands under a gap of the first course and edges run between cards.
      expect(at(rows[1][0]).position.x - at(rows[0][0]).position.x).toBe(STRIDE / 2)
      expect(at(rows[1][1]).position.x - at(rows[1][0]).position.x).toBe(STRIDE)
      expect(at(rows[0][1]).position.x - at(rows[0][0]).position.x).toBe(STRIDE)
    },
  )

  it.each(FIVE_CARD_BANDS.map((b) => [`${b.starter} ${b.family}`, b] as const))(
    '%s: every sub-row, prompt included, fits the 1280 dock-open frame at the floor',
    async (_name, band) => {
      const { at } = await laidOut(band.starter)
      const rows = subRowsOf(band.order, at)
      const finalRow = rows[rows.length - 1]
      for (const row of rows) {
        const left = at(row[0]).position.x
        let right = at(row[row.length - 1]).position.x + REPEATED_CARD_W
        if (row === finalRow) right = at(band.prompts[0]).position.x + ROW_PROMPT_W
        expect(right - left, `${band.starter} ${band.family}: sub-row ${row.join(',')}`).toBeLessThanOrEqual(
          FRAME_1280_FLOW_AT_FLOOR,
        )
      }
    },
  )

  it.each(FIVE_CARD_BANDS.map((b) => [`${b.starter} ${b.family}`, b] as const))(
    '%s: the family keeps its band — one prompt column at the end of the FINAL sub-row, and no other card inside the band',
    async (_name, band) => {
      const { at, withPrompts } = await laidOut(band.starter)
      const rows = subRowsOf(band.order, at)
      const finalRow = rows[rows.length - 1]
      const last = at(finalRow[finalRow.length - 1])
      // The row's ONE prompt (v3.1 WS1 #27) stands one card-gap after the last
      // card of the final sub-row, on that sub-row's line.
      expect(at(band.prompts[0]).position).toEqual({ x: last.position.x + STRIDE, y: last.position.y })
      // Exactly one prompt per kind this family carries — never one per sub-row.
      for (const p of band.prompts) expect(withPrompts.filter((n) => n.id === p), p).toHaveLength(1)
      // Family grouping: no card of another family has its top inside the band.
      const top = at(rows[0][0]).position.y
      const bottom = last.position.y
      const members = new Set(band.order)
      const intruders = withPrompts.filter(
        (n) => !members.has(n.id) && !band.prompts.includes(n.id) && n.position.y >= top && n.position.y <= bottom,
      )
      expect(intruders.map((n) => n.id)).toEqual([])
    },
  )
})

describe('gap 7 — CONTRAST: bands of four and of eight keep exactly their shape', () => {
  it.each(UNCHANGED_BANDS.map((b) => [`${b.starter} ${b.rows[0][0]}…`, b] as const))('%s', async (_name, band) => {
    const { at } = await laidOut(band.starter)
    expect(subRowsOf(band.rows.flat(), at)).toEqual(band.rows)
  })
})
