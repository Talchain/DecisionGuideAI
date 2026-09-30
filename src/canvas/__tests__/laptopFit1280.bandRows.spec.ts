/**
 * ⭐⭐ GAP 7 — EVERY BAND ROW FITS THE 1280×800 DOCK-OPEN FRAME, BOUND BY CARD ID.
 *
 * Experience Design, #63 5808428246: 1280×800 with the Olumi dock open is the
 * ACCEPTANCE size (1440×900 the second), with no zoom floor below 0.5. At that
 * size the fit frame is 869px wide since the flush 319 panel (26 Sep), i.e.
 * 1738 flow units at the 0.5 floor — derived through the real
 * `computeFitPadding` and pinned in `laptopFit.arithmetic.spec.ts`, so it is not
 * re-derived here.
 *
 * History: at the 1520 frame a band of five cards plus its 160 prompt spilled,
 * so the Canvas lead capped a row at FOUR (25 Sep; five read 3 + 2).
 * 27 Sep 2026: Paul's laptop-width ruling — five per row, anchors ≤720, row gap 40.
 * A five-card band is now ONE row (5 × 304 + 160 = 1680 ≤ 1738), and the wrap
 * branch is exercised by the EIGHT-card factor bands (4 + 4, brick-laid).
 *
 * Every assertion names the cards it is about. The five-card bands' one-row,
 * left-to-right order is RECORDED from the base layout (103e1ca6, real
 * `layoutGraph`, the S5 capture heights); the eight-card bands' sub-rows were
 * recorded from the layout on 27 Sep 2026 (d37252e8).
 *
 * 30 Sep 2026 (Paul, "wider and shorter"): a band's cards are its row's FAIR
 * SHARE of `ROW_BUDGET_W` — the same 1656 frame — so the widths now DIFFER per
 * band (five → 270, a 4 + 4 wrap → 325), and the prompt is a 64-unit icon. Every
 * stride below is read from the band's OWN per-kind width, and the prompts are
 * placed after the card's DRAWN width, as the mount places them.
 */
import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import { layoutGraph } from '../utils/layout'
import { GHOST_TIERS, withGhostTiers } from '../utils/ghostTiers'
import {
  LAYOUT_NODE_GAP,
  LAYOUT_PADDING_X,
  REPEATED_CARD_W,
  ROW_BUDGET_W,
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

/**
 * The 1280×800 dock-open frame at the 0.5 floor, in flow units:
 * (1280 − 76 − 376) / 0.5 = 1656 since the 360 dock (27 Sep). This file had kept
 * 1738 (the 26 Sep 319 panel) after `laptopFit.arithmetic.spec.ts` moved to 1656,
 * which left every "fits the frame" arm here 82 units loose. `ROW_BUDGET_W` IS
 * this frame (that spec pins `ROW_BUDGET_W === frameFlowAtFloor.w`).
 */
const FRAME_1280_FLOW_AT_FLOOR = ROW_BUDGET_W

/** The card-to-card (and card-to-prompt) stride for a card `w` wide: box plus gap. */
const strideOf = (w: number) => w + LAYOUT_PADDING_X + LAYOUT_NODE_GAP

/**
 * Every five-card band in the shipped starters, in its ONE-ROW left-to-right
 * order at the base (recorded, see the header). `prompts` are the row-end
 * prompts that family carries, in stack order.
 */
// ⚠ RE-PINNED 28 Sep 2026: three consequence orders moved because
// `orderConsequenceRowsByUpstream` (utils/layout.ts) re-seats that row by its
// links once X is final: crossings vendor-selection 19 → 15, market-entry
// 42 → 28, build-vs-buy 33 → 16 (utils/__tests__/consequenceRowOrder.spec.ts).
// Same five slots per row, so the one-row shape, stride and width claims below
// are unchanged; only which card sits where moved.
const FIVE_CARD_BANDS: Array<{ starter: string; family: string; order: string[]; prompts: string[] }> = [
  { starter: 'vendor-selection', family: 'consequence', prompts: ['__ghost-consequence__'],
    order: ['out_budget_headroom', 'risk_migration_delay', 'risk_gdpr_breach', 'risk_team_overload', 'out_platform_capability'] },
  { starter: 'market-entry', family: 'consequence', prompts: ['__ghost-consequence__'],
    order: ['risk_uk_distraction', 'out_uk_arr_retention', 'out_new_market_arr', 'risk_localisation_drag', 'risk_team_overstretch'] },
  { starter: 'build-vs-buy', family: 'consequence', prompts: ['__ghost-consequence__'],
    order: ['risk_eng_overload', 'out_billing_accuracy', 'risk_billing_errors', 'out_delivery_speed', 'risk_vendor_lock'] },
  { starter: 'headcount-allocation', family: 'factor', prompts: ['__ghost-factor__'],
    order: ['fac_eng_attrition', 'fac_eng_headcount', 'fac_market_demand', 'fac_ae_headcount', 'fac_quota_attainment'] },
  { starter: 'headcount-allocation', family: 'consequence', prompts: ['__ghost-consequence__'],
    order: ['out_reliability', 'risk_eng_attrition', 'risk_churn', 'out_new_arr', 'risk_sales_miss'] },
  { starter: 'pricing-model', family: 'factor', prompts: ['__ghost-factor__'],
    order: ['fac_adoption_friction', 'fac_market_competition', 'fac_usage_exposure', 'fac_enterprise_revenue_risk', 'fac_top_account_concentration'] },
]

/**
 * Every band that WRAPS in the shipped starters (above five cards): the three
 * eight-card factor bands, 4 + 4, each sub-row left to right (recorded).
 */
const WRAPPED_BANDS: Array<{ starter: string; family: string; rows: string[][]; prompts: string[] }> = [
  { starter: 'vendor-selection', family: 'factor', prompts: ['__ghost-factor__'], rows: [
    ['fac_annual_cost', 'fac_gdpr_compliance', 'fac_data_team_capacity', 'fac_ops_overhead'],
    ['fac_migration_effort', 'fac_segment', 'fac_snowflake_build', 'fac_rudderstack'],
  ] },
  { starter: 'market-entry', family: 'factor', prompts: ['__ghost-factor__'], rows: [
    ['fac_arr', 'fac_market_size', 'fac_uk_deepdive', 'fac_competitive_intensity'],
    ['fac_germany', 'fac_nordics', 'fac_team_capacity', 'fac_localisation_cost'],
  ] },
  { starter: 'build-vs-buy', family: 'factor', prompts: ['__ghost-factor__'], rows: [
    ['fac_platform_migration', 'fac_eng_capacity', 'fac_billing_complexity', 'fac_dev_time'],
    ['fac_build_indicator', 'fac_stripe_indicator', 'fac_vendor_indicator', 'fac_vendor_cost'],
  ] },
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
  // The prompt stands after the card's RENDERED width (`widthOf`); on a mounted
  // board that is the layout's per-kind width, not this fixture's 248 measurement.
  const drawnW = (n: Node) => out.layoutCardWidths[n.type as string]
  const withPrompts = withGhostTiers(out.nodes, GHOST_TIERS, { widthOf: drawnW })
  const at = (id: string) => {
    const n = withPrompts.find((x) => x.id === id)
    if (!n) throw new Error(`${starter}: no node ${id}`)
    return n
  }
  /** The drawn width of the family card `id` belongs to — its tier's own width. */
  const widthOfCard = (id: string) => drawnW(at(id))
  return { out, at, draft, withPrompts, widthOfCard }
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

describe('gap 7 — a five-card band is ONE row since 27 Sep, in its own order', () => {
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
    '%s: stays on one row, reading order unchanged, one stride apart',
    async (_name, band) => {
      const { at, widthOfCard } = await laidOut(band.starter)
      const rows = subRowsOf(band.order, at)
      expect(rows.map((r) => r.length)).toEqual([5])
      expect(rows.flat()).toEqual(band.order)
      // Five cards take their fair share: floor((1656 − 88 − 96) / 5) − 24 = 270,
      // so the stride is 270 + 48 = 318 (was the flat 248 + 48 = 296).
      const STRIDE = strideOf(widthOfCard(band.order[0]))
      expect(STRIDE, `${band.starter} ${band.family}: stride`).toBe(318)
      for (let i = 1; i < band.order.length; i++) {
        expect(at(band.order[i]).position.x - at(band.order[i - 1]).position.x).toBe(STRIDE)
      }
    },
  )

  it.each(FIVE_CARD_BANDS.map((b) => [`${b.starter} ${b.family}`, b] as const))(
    '%s: the row, prompt included, fits the 1280 dock-open frame at the floor',
    async (_name, band) => {
      const { at, widthOfCard } = await laidOut(band.starter)
      const left = at(band.order[0]).position.x
      const right = at(band.prompts[0]).position.x + ROW_PROMPT_W
      // 5 × 318 + 64 = 1654 (was 5 × 296 + 160 = 1640).
      expect(right - left, `${band.starter} ${band.family}`).toBe(5 * strideOf(widthOfCard(band.order[0])) + ROW_PROMPT_W)
      expect(right - left).toBeLessThanOrEqual(FRAME_1280_FLOW_AT_FLOOR)
    },
  )

  it.each(FIVE_CARD_BANDS.map((b) => [`${b.starter} ${b.family}`, b] as const))(
    '%s: the family keeps its band — one prompt at the end of the row, and no other card inside the band',
    async (_name, band) => {
      const { at, withPrompts, widthOfCard } = await laidOut(band.starter)
      const last = at(band.order[band.order.length - 1])
      expect(at(band.prompts[0]).position).toEqual({ x: last.position.x + strideOf(widthOfCard(last.id)), y: last.position.y })
      for (const p of band.prompts) expect(withPrompts.filter((n) => n.id === p), p).toHaveLength(1)
      const members = new Set(band.order)
      const intruders = withPrompts.filter(
        (n) => !members.has(n.id) && !band.prompts.includes(n.id) && n.position.y === last.position.y,
      )
      expect(intruders.map((n) => n.id)).toEqual([])
    },
  )
})

describe('gap 7 — a band above five cards wraps inside its own band, in its own order', () => {
  it('the recorded bands are the starters\' real eight-card families (non-vacuity)', () => {
    for (const band of WRAPPED_BANDS) {
      const draft = STARTERS[band.starter]
      const tier = TIER_BY_KIND[draft.nodes.find((n) => n.id === band.rows[0][0])!.kind]
      const family = draft.nodes.filter((n) => TIER_BY_KIND[n.kind] === tier).map((n) => n.id).sort()
      expect(family, `${band.starter} ${band.family}`).toEqual(band.rows.flat().sort())
    }
  })

  it.each(WRAPPED_BANDS.map((b) => [`${b.starter} ${b.family}`, b] as const))(
    '%s: wraps 4 + 4, reading order recorded, the FIRST course laid in brick',
    async (_name, band) => {
      const { at, widthOfCard } = await laidOut(band.starter)
      const rows = subRowsOf(band.rows.flat(), at)
      expect(rows.map((r) => r.length)).toEqual([4, 4])
      expect(rows).toEqual(band.rows)
      // A 4 + 4 wrap takes the fair share of four, capped by its brick course:
      // min(350, floor((1656 − 3.5 × 24) / 4.5) − 24) = 325; stride 325 + 48 = 373.
      const STRIDE = strideOf(widthOfCard(rows[0][0]))
      expect(STRIDE, `${band.starter} ${band.family}: stride`).toBe(373)
      // v3.1 WS1 #10: alternate courses sit HALF A STRIDE apart, so each card
      // stands under a gap of the next course. For 4 + 4 the FIRST course
      // shifts (the final course carries the prompt, so that block is narrower).
      // 373 / 2 = 186.5 (was 296 / 2 = 148).
      expect(at(rows[0][0]).position.x - at(rows[1][0]).position.x).toBe(STRIDE / 2)
      for (const row of rows) {
        for (let i = 1; i < row.length; i++) expect(at(row[i]).position.x - at(row[i - 1]).position.x).toBe(STRIDE)
      }
    },
  )

  it.each(WRAPPED_BANDS.map((b) => [`${b.starter} ${b.family}`, b] as const))(
    '%s: every sub-row, prompt included, fits the 1280 dock-open frame at the floor',
    async (_name, band) => {
      const { at, widthOfCard } = await laidOut(band.starter)
      const rows = subRowsOf(band.rows.flat(), at)
      const finalRow = rows[rows.length - 1]
      for (const row of rows) {
        const left = at(row[0]).position.x
        let right = at(row[row.length - 1]).position.x + widthOfCard(row[row.length - 1])
        if (row === finalRow) right = at(band.prompts[0]).position.x + ROW_PROMPT_W
        expect(right - left, `${band.starter} ${band.family}: sub-row ${row.join(',')}`).toBeLessThanOrEqual(
          FRAME_1280_FLOW_AT_FLOOR,
        )
      }
    },
  )

  it.each(WRAPPED_BANDS.map((b) => [`${b.starter} ${b.family}`, b] as const))(
    '%s: the family keeps its band — one prompt column at the end of the FINAL sub-row, and no other card inside the band',
    async (_name, band) => {
      const { at, withPrompts, widthOfCard } = await laidOut(band.starter)
      const rows = subRowsOf(band.rows.flat(), at)
      const finalRow = rows[rows.length - 1]
      const last = at(finalRow[finalRow.length - 1])
      // The row's ONE prompt (v3.1 WS1 #27) stands one card-gap after the last
      // card of the final sub-row, on that sub-row's line.
      expect(at(band.prompts[0]).position).toEqual({ x: last.position.x + strideOf(widthOfCard(last.id)), y: last.position.y })
      // Exactly one prompt per kind this family carries — never one per sub-row.
      for (const p of band.prompts) expect(withPrompts.filter((n) => n.id === p), p).toHaveLength(1)
      // Family grouping: no card of another family has its top inside the band.
      const top = at(rows[0][0]).position.y
      const bottom = last.position.y
      const members = new Set(band.rows.flat())
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
