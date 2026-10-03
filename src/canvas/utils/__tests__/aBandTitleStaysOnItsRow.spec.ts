/**
 * ⛔ ONE CARD DRAGGED OUT OF ITS ROW DOES NOT TAKE THE BAND TITLE WITH IT
 * (canvas audit edit-structure/F4, reproduced on the served build, 27 Sep 2026).
 *
 * Drag one factor up into the Alternatives row of `pricing-model`: the FACTORS
 * title jumped from y 397 to y 255 — inside the Alternatives row (203–372) —
 * and stayed there after a reload. The title stood above the lane's MINIMUM
 * card top, so a single out-of-row card relabelled another tier's row. Contract
 * v3.1's band grammar is one title per row, above that row.
 *
 * ⭐ The spec: a band title stands above the first row its tier's cards form —
 * a row holding at least two of them — so one card moved out of the row cannot
 * move it. A tier with no such row (the Question, the Goal, a lone card) is its
 * card, and the title follows it.
 *
 * Geometry is the SERVED `build-vs-buy` landing (skeptic-F1 JSON, flow units),
 * not a hand-drawn board; the move mirrors F4's drag (-120, -150 screen px at
 * zoom 0.606 ≈ -200, -250 flow).
 */
import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import { deriveLaneTitles, deriveTierLanes } from '../tierLanes'

type Row = readonly [id: string, kind: string, x: number, y: number, w: number, h: number]

const LANDING: readonly Row[] = [
  ['dec_billing', 'decision', 472, 24, 720, 93],
  ['fac_billing_complexity', 'factor', 912, 464, 248, 186],
  ['fac_build_indicator', 'factor', 172, 758, 248, 223],
  ['fac_dev_time', 'factor', 1208, 464, 248, 200],
  ['fac_eng_capacity', 'factor', 616, 464, 248, 250],
  ['fac_platform_migration', 'factor', 320, 464, 248, 186],
  ['fac_stripe_indicator', 'factor', 468, 758, 248, 223],
  ['fac_vendor_cost', 'factor', 1060, 758, 248, 142],
  ['fac_vendor_indicator', 'factor', 764, 758, 248, 223],
  ['goal_billing', 'goal', 472, 1290, 720, 93],
  ['opt_build', 'option', 172, 177, 248, 226],
  ['opt_status_quo', 'option', 1060, 177, 248, 208],
  ['opt_stripe', 'option', 468, 177, 248, 226],
  ['opt_vendor', 'option', 764, 177, 248, 226],
  ['out_billing_accuracy', 'outcome', 912, 1042, 248, 144],
  ['out_delivery_speed', 'outcome', 320, 1042, 248, 144],
  ['risk_billing_errors', 'risk', 616, 1042, 248, 164],
  ['risk_eng_overload', 'risk', 24, 1042, 248, 188],
  ['risk_vendor_lock', 'risk', 1208, 1042, 248, 164],
]

function board(moves: Record<string, { x: number; y: number }> = {}): Node[] {
  return LANDING.map(([id, type, x, y, w, h]) => ({
    id, type, position: moves[id] ?? { x, y }, data: { label: id }, measured: { width: w, height: h },
  })) as Node[]
}

const laneY = (nodes: Node[], tier: number) => deriveLaneTitles(nodes).find((t) => t.tier === tier)!.laneY

const FACTORS = 2
const ALTERNATIVES = 1
const GOAL = 5

describe('a band title stays on its row (edit-structure/F4)', () => {
  it('precondition: at landing each title stands on its tier’s first row', () => {
    const nodes = board()
    expect(laneY(nodes, ALTERNATIVES)).toBe(177)
    expect(laneY(nodes, FACTORS), 'a two-sub-row tier titles its FIRST row, not its second').toBe(464)
  })

  it('⛔ a factor dragged up into the Alternatives row does not move the FACTORS title', () => {
    const nodes = board({ fac_billing_complexity: { x: 712, y: 214 } })
    // Precondition: the dragged card really sits inside the Alternatives row.
    expect(214).toBeLessThan(177 + 226)
    expect(laneY(nodes, FACTORS), 'FACTORS followed one card into the Alternatives row').toBe(464)
  })

  it('⛔ an option dragged DOWN into the factor rows does not move either title', () => {
    const nodes = board({ opt_vendor: { x: 764, y: 520 } })
    expect(laneY(nodes, ALTERNATIVES)).toBe(177)
    expect(laneY(nodes, FACTORS)).toBe(464)
  })

  it('⭐ CONTRAST — a card nudged a little within its row still counts as the row: the title clears it', () => {
    // 30 units up, still overlapping its row vertically: the row now starts
    // higher, and the title must stand above that card, not across it.
    const nodes = board({ fac_billing_complexity: { x: 912, y: 434 } })
    expect(laneY(nodes, FACTORS)).toBe(434)
  })

  it('⭐ CONTRAST — a lone card IS its band: the Goal title follows the Goal', () => {
    const nodes = board({ goal_billing: { x: 472, y: 1400 } })
    expect(laneY(nodes, GOAL)).toBe(1400)
  })

  it('⭐ the lane’s own extent is unchanged — it still spans every member, the moved one included', () => {
    const nodes = board({ fac_billing_complexity: { x: 712, y: 214 } })
    const lane = deriveTierLanes(nodes).find((l) => l.tier === FACTORS)!
    expect(lane.y).toBe(214)
    expect(lane.y + lane.height).toBe(758 + 223)
  })
})
