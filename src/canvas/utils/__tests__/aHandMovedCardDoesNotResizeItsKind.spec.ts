/**
 * ⭐⭐ ONE HAND-MOVED CARD MUST NOT SET THE WIDTH OF EVERY CARD OF ITS KIND.
 *
 * ## The defect (canvas audit edit-structure/F1, reproduced by a skeptic on the
 * served build, 27 Sep 2026)
 *
 * Load `build-vs-buy`, move 'Vendor Solution Adoption' 90 flow units right with
 * the keyboard, reload. Every factor card drew at 191 instead of 248, the
 * narrower cards wrapped taller, and Engineering Capacity then overlapped
 * Stripe Middleware Extension in the sub-row below — two cards the user never
 * touched. Moving the card back to its landing x and reloading did NOT repair
 * it: the board stayed at 191 with two overlaps.
 *
 * Two mechanisms, both in `solveRestoredCardWidths`:
 *   1. the tier's stride was the MINIMUM over every same-row pair, so the one
 *      pair the user squeezed (206) capped the whole kind (206 - 24 = 182);
 *   2. a cap below `NODE_LAYOUT_MIN_W` was published although `BaseNode` can
 *      never draw it (its CSS `minWidth` is that floor).
 * The stickiness is a third mechanism, outside this file: the autosave persisted
 * the heights React Flow measured at 191, and the next restore paired
 * Engineering Capacity (y464 + h323 = 787) with the sub-row at y758 — a stride
 * of 148, so 124, so 191 again. `persistedMeasurement.spec.ts` pins that half.
 *
 * ## The corpus is the SERVED board, not a hand-drawn one
 *
 * Every position and height below is the skeptic's measurement of the deployed
 * build (`skeptic-F1-edit-structure/served-bvb-nudge3-back3.json`, flow units,
 * 1440x900). The contrast cases keep the old-board protection this function
 * exists for: a board laid out uniformly at a NARROWER stride must still bound.
 *
 * ⚠ 30 SEP 2026 (Paul, "wider and shorter"): the FRESH width is now each tier's
 * fair share of `ROW_BUDGET_W` (these eight factors: 4 + 4 → 325; four options →
 * 350), wider than this 27 Sep board's 296 stride allows. So this served board —
 * laid out at 248 — now restores at its STRIDE's bound, 296 − 24 = 272, not at
 * 248. The property under test is unchanged and is what every case now binds
 * to: ONE moved card (or stale heights) must not move the kind's width off the
 * width the UNMOVED board restores at. "248" was that width's value on 27 Sep.
 */
import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import { solveLayoutCardWidths, solveRestoredCardWidths } from '../layout'
import { LAYOUT_NODE_GAP, LAYOUT_PADDING_X, NODE_LAYOUT_MIN_W } from '../nodeLayoutConstants'

type Row = readonly [id: string, kind: string, x: number, y: number, h: number]

/** Served `build-vs-buy` at landing (every repeated card 248 wide). */
const LANDING: readonly Row[] = [
  ['dec_billing', 'decision', 472, 24, 93],
  ['opt_build', 'option', 172, 177, 226],
  ['opt_stripe', 'option', 468, 177, 226],
  ['opt_vendor', 'option', 764, 177, 226],
  ['opt_status_quo', 'option', 1060, 177, 208],
  ['fac_platform_migration', 'factor', 320, 464, 186],
  ['fac_eng_capacity', 'factor', 616, 464, 250],
  ['fac_billing_complexity', 'factor', 912, 464, 186],
  ['fac_dev_time', 'factor', 1208, 464, 200],
  ['fac_build_indicator', 'factor', 172, 758, 223],
  ['fac_stripe_indicator', 'factor', 468, 758, 223],
  ['fac_vendor_indicator', 'factor', 764, 758, 223],
  ['fac_vendor_cost', 'factor', 1060, 758, 142],
  ['risk_eng_overload', 'risk', 24, 1042, 188],
  ['out_delivery_speed', 'outcome', 320, 1042, 144],
  ['risk_billing_errors', 'risk', 616, 1042, 164],
  ['out_billing_accuracy', 'outcome', 912, 1042, 144],
  ['risk_vendor_lock', 'risk', 1208, 1042, 164],
  ['goal_billing', 'goal', 472, 1290, 93],
]

/**
 * Served heights after the first broken reload — measured at the 191 width the
 * defect drew, i.e. what the autosave carried into the NEXT restore.
 */
const HEIGHTS_AT_191: Readonly<Record<string, number>> = {
  fac_platform_migration: 233,
  fac_eng_capacity: 323,
  fac_billing_complexity: 186,
  fac_dev_time: 223,
  fac_build_indicator: 223,
  fac_stripe_indicator: 223,
  fac_vendor_indicator: 223,
  fac_vendor_cost: 186,
}

function board(
  over: { x?: Record<string, number>; h?: Record<string, number> } = {},
): Node[] {
  return LANDING.map(([id, kind, x, y, h]) => ({
    id,
    type: kind,
    position: { x: over.x?.[id] ?? x, y },
    data: { label: id },
    measured: { width: kind === 'decision' || kind === 'goal' ? 720 : 248, height: over.h?.[id] ?? h },
  })) as Node[]
}

/** The served repro: 'Vendor Solution Adoption' moved 90 units right (764 -> 854). */
const MOVED = { x: { fac_vendor_indicator: 854 } }
/** …then moved back to its landing x, restored with the heights persisted at 191. */
const MOVED_BACK_STALE = { h: HEIGHTS_AT_191 }

/** Adjacent same-sub-row gap for `kind` at width `w` (sub-rows by exact y). */
function worstRowGap(nodes: Node[], kind: string, w: number): number {
  const rows = new Map<number, number[]>()
  for (const n of nodes) {
    if (n.type !== kind) continue
    const list = rows.get(n.position.y) ?? []
    list.push(n.position.x)
    rows.set(n.position.y, list)
  }
  let worst = Number.POSITIVE_INFINITY
  for (const xs of rows.values()) {
    xs.sort((a, b) => a - b)
    for (let i = 1; i < xs.length; i++) worst = Math.min(worst, xs[i] - xs[i - 1] - w)
  }
  return worst
}

const OPTS = { direction: 'DOWN' as const, spacing: 15 }

/** The served board's same-row stride (every adjacent pair at landing: 248 + 48). */
const LANDING_STRIDE = 296
/** The gap `solveRestoredCardWidths` keeps: max(LAYOUT_NODE_GAP, spacing 15) = 24. */
const GAP = Math.max(LAYOUT_NODE_GAP, OPTS.spacing)
/**
 * The width the UNMOVED served board restores at, per kind: the fresh fair share
 * bounded by its own stride minus the VISIBLE gap (ELK padding + sibling gap):
 * min(325 or 350, 296 − 24 − 24) = 248. That is exactly as saved, so a board from
 * before 30 Sep keeps its 48 gap (it was the fresh 248 on 27 Sep).
 */
const CAP_GAP = GAP + LAYOUT_PADDING_X
const landingWidth = (kind: string) =>
  Math.min(solveLayoutCardWidths(board(), OPTS)[kind], LANDING_STRIDE - CAP_GAP)

describe('a hand-moved card does not resize its kind (edit-structure/F1)', () => {
  it('precondition: the landing board restores at its own stride\'s bound (30 Sep: 296 − 24 − 24 = 248, exactly as saved), and no unmoved pair overlaps at it', () => {
    const w = solveRestoredCardWidths(board(), OPTS)
    // RE-PINNED 30 Sep 2026: was `toBe(REPEATED_CARD_W)` (248, the fresh width then).
    expect(w.factor).toBe(landingWidth('factor'))
    expect(w.option).toBe(landingWidth('option'))
    expect(w.factor).toBe(248) // 296 − 24 − 24: exactly as saved, the visible gap stays 48
    expect(w.option).toBe(248)
    // The bound binds because the fresh fair share is wider than the stride allows.
    expect(solveLayoutCardWidths(board(), OPTS).factor).toBeGreaterThan(LANDING_STRIDE - CAP_GAP)
    expect(worstRowGap(board(), 'factor', w.factor)).toBeGreaterThanOrEqual(0)
  })

  it('⛔ THE SERVED REPRO: one factor moved 90 units right still restores every factor at the landing width', () => {
    const nodes = board(MOVED)
    // Precondition pinned: the move really does squeeze one pair below the
    // width + gap, or this case passes for the wrong reason.
    expect(1060 - 854, 'the fixture no longer squeezes a pair below width + gap').toBeLessThan(landingWidth('factor') + GAP)
    const w = solveRestoredCardWidths(nodes, OPTS)
    expect(w.factor, 'one moved card capped every factor card').toBe(landingWidth('factor'))
  })

  it('⛔ THE STICKY HALF: moved back, restored on heights measured at 191, still the landing width', () => {
    const w = solveRestoredCardWidths(board(MOVED_BACK_STALE), OPTS)
    expect(w.factor, 'stale tall heights paired the two sub-rows and re-capped the kind').toBe(landingWidth('factor'))
  })

  it('⛔ an unusable cap is never published: whatever the stride, a width below the card floor is not returned', () => {
    // Three options squeezed to a uniform 150 stride: every pair agrees, so the
    // dominant stride IS 150 and the cap is 126 — narrower than BaseNode can draw.
    const nodes = board({ x: { opt_build: 172, opt_stripe: 322, opt_vendor: 472, opt_status_quo: 622 } })
    const w = solveRestoredCardWidths(nodes, OPTS)
    expect(w.option).toBeGreaterThanOrEqual(NODE_LAYOUT_MIN_W)
    // …and it is still the tightest DRAWABLE width, not the fresh one.
    expect(w.option).toBe(NODE_LAYOUT_MIN_W)
  })

  it('⭐ CONTRAST — a board laid out uniformly at a narrower stride still bounds (the old-board protection)', () => {
    // Every factor on a uniform 280 stride — as a layout at a 232 card would
    // (RE-SITED 30 Sep from 260: the cap is now stride − padding − gap, and 260 − 48 = 212 sits below the floor)
    // leave them. All pairs agree, so the bound must bite.
    // RE-SITED (27 Sep: landing text cap 1.36 → 1.64, owner decision, #70 5859837231): the stride was 230, a
    // 206 card. The drawable floor is now NODE_LAYOUT_MIN_W = 221.12, so a 206 cap
    // takes the floor path (pinned by the case above) and this contrast stopped
    // testing a DRAWABLE cap below the fresh width. At 260 the cap (236) sits
    // between the floor and the fresh 248 again.
    const narrow: Record<string, number> = {
      fac_platform_migration: 320, fac_eng_capacity: 600, fac_billing_complexity: 880, fac_dev_time: 1160,
      fac_build_indicator: 172, fac_stripe_indicator: 452, fac_vendor_indicator: 732, fac_vendor_cost: 1012,
    }
    const nodes = board({ x: narrow })
    const fresh = solveLayoutCardWidths(nodes, OPTS)
    expect(fresh.factor, 'the fixture no longer provokes a widening').toBeGreaterThan(280 - CAP_GAP)
    expect(280 - CAP_GAP, 'the cap is no longer a drawable width — this would test the floor path').toBeGreaterThan(NODE_LAYOUT_MIN_W)
    const w = solveRestoredCardWidths(nodes, OPTS)
    expect(w.factor).toBe(280 - CAP_GAP)
    expect(worstRowGap(nodes, 'factor', w.factor)).toBeGreaterThanOrEqual(0)
  })

  it('⭐ CONTRAST — the same narrow board with ONE card moved away still bounds the rest', () => {
    // The row's last card pulled 100 units clear of its neighbour. A rule that
    // took the WIDEST stride would lift the bound here and overlap the others.
    // Re-sited with the case above (230 → 260 stride, the 1.64 cap).
    const narrow: Record<string, number> = {
      fac_platform_migration: 320, fac_eng_capacity: 600, fac_billing_complexity: 880, fac_dev_time: 1160,
      fac_build_indicator: 172, fac_stripe_indicator: 452, fac_vendor_indicator: 732, fac_vendor_cost: 1112,
    }
    const w = solveRestoredCardWidths(board({ x: narrow }), OPTS)
    expect(w.factor, 'one card moved away lifted the bound for the untouched pairs').toBe(280 - CAP_GAP)
  })
})
