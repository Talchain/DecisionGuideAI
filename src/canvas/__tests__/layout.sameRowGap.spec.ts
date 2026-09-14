/**
 * SAME-ROW GAP INVARIANT — the guard the viewport decision needs, and the
 * re-derivation that refuted the premise it was commissioned from.
 *
 * WHY THIS EXISTS
 * ---------------
 * `WORKSPACE-VIEWPORT-DECISION-2026-08-18.md` §STEP 2 commissioned a fix to
 * `applyCollisionGuard` on the recorded premise that flipping a tier into
 * multi-row packing takes same-row overlap area from 4,554 to 115,988 px²
 * (headcount-allocation) and 5,589 to 140,396 px² (pricing-model). Those
 * figures are recorded in `nodeLayoutConstants.ts` and `nodeLabelFit.spec.ts`.
 * The decision doc itself says: "A's figures are the repo's, not A's own
 * measurement. Re-derive them at your tip before treating them as a baseline."
 *
 * RE-DERIVED 18 Aug 2026 at 6524caed, and the premise does not reproduce.
 * Measured with browser-real node heights (the capture fixture this spec
 * loads) across all five starters x eight canvas widths x three node-spacing
 * settings — 120 cells spanning BOTH packing branches:
 *
 *     same-row overlap = 0 px² in every cell
 *     minimum same-row gap = 44 px in every cell
 *
 * And, decisively, deleting the `applyCollisionGuard` call from `layoutGraph`
 * produced a BYTE-IDENTICAL position signature across 25 cells
 * (sha256/16 = a36fe11f1762b6b5, pristine and mutant). The guard is inert on
 * every reachable input: `centreRowsOnSpine` runs immediately before it and
 * re-snaps every row to a uniform `elkBoxW + gap` stride, so the guard's
 * precondition can never be violated by the pipeline that calls it.
 *
 * WHAT THIS SPEC THEREFORE ASSERTS
 * --------------------------------
 * The PROPERTY, not the function. Step 3 of the decision replaces the packing
 * selector in `layout.ts`; this pins what must remain true across that change,
 * for the real shipped corpus, at both packing branches, with the threshold
 * DERIVED from `COLLISION_GAP` rather than recorded (CLAUDE.md trap 12).
 *
 * It also pins the AUTHORITY, which is the part a future lane will otherwise
 * get wrong: the gap is `LAYOUT_PADDING_X + effectiveNodeSpacing`, i.e. the
 * stride, and it is strictly GREATER than `COLLISION_GAP`. If the guard had
 * had to act, the gap would land exactly ON `COLLISION_GAP`. That distinction
 * is the discriminator, so this suite cannot be read as evidence that the
 * guard is protecting anything (the estate's guarantee-theatre defect class).
 */

import { describe, it, expect } from 'vitest'
import { layoutGraph } from '../utils/layout'
import {
  COLLISION_GAP,
  LAYOUT_PADDING_X,
  LAYOUT_NODE_GAP,
  CANONICAL_LAYOUT_WIDTH,
  MIN_GAP,
  NODE_SINGLE_ROW_FAIR_SHARE_W,
  NODE_CARD_MAX_W,
} from '../utils/nodeLayoutConstants'
import type { Node, Edge } from '@xyflow/react'

import capture from './__fixtures__/starter-node-heights.browser-capture-2026-08-18.json'
import vendorSelection from '../starters/data/vendor-selection.draft.json'
import marketEntry from '../starters/data/market-entry.draft.json'
import buildVsBuy from '../starters/data/build-vs-buy.draft.json'
import headcountAllocation from '../starters/data/headcount-allocation.draft.json'
import pricingModel from '../starters/data/pricing-model.draft.json'

/**
 * The five shipped starters, by id, bound to their committed draft payloads.
 * Not a glob: a starter that stops being covered must be a compile error here,
 * not a silently smaller corpus (CLAUDE.md trap 2b in miniature).
 */
const STARTERS = {
  'vendor-selection': vendorSelection,
  'market-entry': marketEntry,
  'build-vs-buy': buildVsBuy,
  'headcount-allocation': headcountAllocation,
  'pricing-model': pricingModel,
} as const
type StarterId = keyof typeof STARTERS

const HEIGHTS = (capture as { heights: Record<string, Record<string, number>> }).heights

/**
 * ⭐ THE BRANCH IS NOW A PROPERTY OF THE MODEL, NOT OF THE SCREEN (founder ruling
 * R1, 18 Aug 2026). This suite used to straddle the two packing branches by
 * handing `layoutGraph` a 1300px and a 900px canvas. `layoutGraph` no longer
 * takes a canvas: the budget is `CANONICAL_LAYOUT_WIDTH`, so the branch is
 * selected by the widest tier's node count alone.
 *
 * ⚠⚠ THE CORPUS NO LONGER STRADDLES BOTH BRANCHES, AND THAT IS A CONSEQUENCE
 * WORTH STATING RATHER THAN PAPERING OVER (12 Sep 2026). This header used to
 * read "the shipped starters carry widest tiers of 5 (single-row) and 8
 * (multi-row), which is strictly better evidence than a synthetic width". The
 * canonical budget moved 1185 -> 1482 so that an eight-wide tier stops
 * splitting — the fix for models coming out portrait in a landscape pane — and
 * the consequence is that ALL FIVE shipped starters are now single-row.
 *
 * That is good for users and bad for this corpus: the multi-row branch is still
 * reachable in production (any tier of nine or more) and no shipped shape
 * exercises it any more. So the multi-row arm is now SYNTHETIC, and the loss of
 * evidence quality is recorded here rather than hidden by a table that still
 * says "multi-row" somewhere.
 *
 * `BRANCH_OF` records which starter exercises which, and the `describe` block
 * below proves each one really is on the branch claimed, BY NODE IDENTITY.
 * Recorded rather than derived from the layout, deliberately: a table derived
 * from the thing it describes is a guard agreeing with itself.
 */
type Branch = 'single-row' | 'multi-row'
const BRANCH_OF: Record<StarterId, Branch> = {
  'vendor-selection': 'single-row',
  'market-entry': 'single-row',
  'build-vs-buy': 'single-row',
  'headcount-allocation': 'single-row',
  'pricing-model': 'single-row',
}

/** The widest tier that still single-rows, derived rather than recalled. */
const SINGLE_ROW_CAP = Math.floor(
  (CANONICAL_LAYOUT_WIDTH + MIN_GAP) / (NODE_SINGLE_ROW_FAIR_SHARE_W + LAYOUT_PADDING_X + MIN_GAP),
)

/**
 * A synthetic tier of `n` same-tier factors — the multi-row arm, now that no
 * shipped starter reaches it. Heights are uniform because this graph is about
 * the HORIZONTAL gap only; the starter corpus above carries the real heights.
 */
function syntheticTier(n: number): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    { id: 'dec', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Decision', kind: 'decision' }, measured: { width: NODE_CARD_MAX_W, height: 120 } },
    { id: 'opt', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option', kind: 'option' }, measured: { width: NODE_CARD_MAX_W, height: 120 } },
  ] as unknown as Node[]
  const edges: Edge[] = [{ id: 'e-d-o', source: 'dec', target: 'opt' }]
  for (let i = 0; i < n; i++) {
    nodes.push({ id: `fac_${i}`, type: 'factor', position: { x: 0, y: 0 }, data: { label: `Factor ${i}`, kind: 'factor' }, measured: { width: NODE_CARD_MAX_W, height: 120 } } as unknown as Node)
    edges.push({ id: `e-o-${i}`, source: 'opt', target: `fac_${i}` })
  }
  return { nodes, edges }
}

interface Rect { id: string; x: number; y: number; w: number; h: number }

function buildGraph(id: StarterId): { nodes: Node[]; edges: Edge[] } {
  const draft = STARTERS[id] as unknown as {
    nodes: Array<{ id: string; kind: string; label: string }>
    edges: Array<{ id?: string; from?: string; to?: string; source?: string; target?: string }>
  }
  const heights = HEIGHTS[id]
  const nodes = draft.nodes.map((n) => ({
    id: n.id,
    type: n.kind,
    position: { x: 0, y: 0 },
    data: { label: n.label, kind: n.kind },
    // The captured RENDERED height. `layoutGraph` reads `measured.height`.
    measured: { width: 320, height: heights[n.id] },
  })) as unknown as Node[]
  const edges = draft.edges.map((e, i) => ({
    id: e.id ?? `e${i}`,
    source: (e.from ?? e.source) as string,
    target: (e.to ?? e.target) as string,
  })) as Edge[]
  return { nodes, edges }
}

/** Rows keyed by EXACT y — `layoutGraph` emits one canonical y per row. */
function rowsOf(rects: Rect[]): Map<number, Rect[]> {
  const rows = new Map<number, Rect[]>()
  for (const r of rects) {
    const bucket = rows.get(r.y)
    if (bucket) bucket.push(r)
    else rows.set(r.y, [r])
  }
  for (const bucket of rows.values()) bucket.sort((a, b) => a.x - b.x)
  return rows
}

async function layOut(id: StarterId): Promise<Rect[]> {
  const { nodes, edges } = buildGraph(id)
  const out = await layoutGraph(nodes, edges, {})
  return out.nodes.map((n) => ({
    id: n.id,
    x: n.position.x,
    y: n.position.y,
    w: out.layoutNodeWidth,
    h: HEIGHTS[id][n.id],
  }))
}

describe('the capture is complete before anything is derived from it', () => {
  // A capture missing an id silently falls back to DEFAULT_NODE_HEIGHT and the
  // whole suite then measures a graph that never rendered. Positive control on
  // the instrument, before the instrument is trusted.
  it.each(Object.keys(STARTERS) as StarterId[])(
    'every node of "%s" has a captured rendered height',
    (id) => {
      const draft = STARTERS[id] as unknown as { nodes: Array<{ id: string }> }
      const captured = HEIGHTS[id]
      expect(captured, `no capture for starter "${id}"`).toBeDefined()
      const missing = draft.nodes.map((n) => n.id).filter((nid) => typeof captured[nid] !== 'number')
      expect(missing, `capture is short for "${id}"`).toEqual([])
      expect(draft.nodes.length).toBeGreaterThan(0)
    },
  )
})

describe('same-row gap holds at BOTH packing branches, for every shipped starter', () => {
  // The corpus must actually contain both branches, or "BOTH" in this
  // describe's name is a claim nothing checks (trap 13: an absence/coverage
  // claim needs a control).
  it('⚠ the shipped corpus is ENTIRELY single-row, and the multi-row arm is synthetic', async () => {
    /**
     * "BOTH" in this describe's name is a claim, so it is checked (trap 13: a
     * coverage claim needs a control). It used to be satisfied by the starters
     * alone; since the budget move it is not, and the honest form of that is to
     * assert the new fact rather than to keep a table that claims otherwise.
     */
    const covered = new Set(Object.values(BRANCH_OF))
    expect([...covered]).toEqual(['single-row'])

    // …so the multi-row branch is reached synthetically, and it is REACHED —
    // asserted here rather than assumed, because a synthetic that quietly
    // single-rows would leave the branch untested with nothing going red.
    const { nodes, edges } = syntheticTier(SINGLE_ROW_CAP + 1)
    const out = await layoutGraph(nodes, edges, {})
    const ys = new Set(out.nodes.filter(n => n.id.startsWith('fac_')).map(n => n.position.y))
    expect(ys.size, 'the synthetic multi-row arm did not split').toBeGreaterThan(1)

    // CONTRAST CONTROL: one fewer factor and it does NOT split. Without this,
    // the assertion above would pass on a layout that split everything.
    const atCap = await layoutGraph(...(({ nodes: n2, edges: e2 }) => [n2, e2, {}] as const)(syntheticTier(SINGLE_ROW_CAP)))
    expect(new Set(atCap.nodes.filter(n => n.id.startsWith('fac_')).map(n => n.position.y)).size).toBe(1)
  })

  it('every same-row neighbour pair of the SYNTHETIC multi-row tier clears COLLISION_GAP', async () => {
    const { nodes, edges } = syntheticTier(SINGLE_ROW_CAP + 1)
    const out = await layoutGraph(nodes, edges, {})
    const rects: Rect[] = out.nodes.map(n => ({ id: n.id, x: n.position.x, y: n.position.y, w: out.layoutNodeWidth, h: 120 }))
    const rows = rowsOf(rects)
    const multiNodeRows = [...rows.values()].filter(r => r.length >= 2)
    expect(multiNodeRows.length, 'the gap assertion would be vacuous').toBeGreaterThan(0)
    let pairsChecked = 0
    for (const row of rows.values()) {
      for (let i = 1; i < row.length; i++) {
        expect(row[i].x - (row[i - 1].x + row[i - 1].w)).toBeGreaterThanOrEqual(COLLISION_GAP)
        pairsChecked++
      }
    }
    expect(pairsChecked).toBeGreaterThan(0)
  })

  {
    for (const id of Object.keys(STARTERS) as StarterId[]) {
      it(`${id} — ${BRANCH_OF[id]} branch: every same-row neighbour pair clears COLLISION_GAP`, async () => {
        const rects = await layOut(id)
        expect(rects.length, `"${id}" laid out no nodes`).toBe(
          (STARTERS[id] as unknown as { nodes: unknown[] }).nodes.length,
        )

        const rows = rowsOf(rects)
        // POSITIVE CONTROL. A corpus with no multi-node row satisfies every
        // gap assertion by having nothing to compare — the vacuity this whole
        // family of tests exists to avoid. Assert there is something to check.
        const multiNodeRows = [...rows.values()].filter((r) => r.length >= 2)
        expect(
          multiNodeRows.length,
          `no row of "${id}" holds two nodes — the gap assertion would be vacuous`,
        ).toBeGreaterThan(0)

        let pairsChecked = 0
        for (const row of rows.values()) {
          for (let i = 1; i < row.length; i++) {
            const left = row[i - 1]
            const right = row[i]
            const gap = right.x - (left.x + left.w)
            // Bound by IDENTITY: the message names both nodes, and the
            // threshold is DERIVED from the shipped constant, never recorded.
            expect(
              gap,
              `"${id}": "${left.id}" and "${right.id}" share row y=${left.y} with a ${gap}px gap`,
            ).toBeGreaterThanOrEqual(COLLISION_GAP)
            pairsChecked++
          }
        }
        expect(pairsChecked, 'no adjacent same-row pair was examined').toBeGreaterThan(0)
      })
    }
  }
})

describe('the branches this suite claims to straddle are the branches it exercises', () => {
  // Bind the branch claim to node IDENTITY, never to a width literal or to a
  // count re-derived from the layout. If the boundary moves in EITHER direction
  // one of these REDs and says so, instead of quietly running every cell on one
  // branch and reporting double coverage.
  const FACTOR_TIER_OF_HEADCOUNT = [
    'fac_ae_headcount',
    'fac_eng_attrition',
    'fac_eng_headcount',
    'fac_market_demand',
    'fac_quota_attainment',
  ] as const

  // vendor-selection's tier-2 nodes: eight, the first width the canonical
  // budget refuses as a single row.
  const FACTOR_TIER_OF_VENDOR_SELECTION = [
    'fac_annual_cost',
    'fac_data_team_capacity',
    'fac_gdpr_compliance',
    'fac_migration_effort',
    'fac_ops_overhead',
    'fac_rudderstack',
    'fac_segment',
    'fac_snowflake_build',
  ] as const

  it('headcount-allocation (5-wide tier) packs its factor tier on ONE row', async () => {
    const rects = await layOut('headcount-allocation')
    const ys = new Set(
      FACTOR_TIER_OF_HEADCOUNT.map((nid) => rects.find((r) => r.id === nid)!.y),
    )
    expect(ys.size, 'expected the single-row branch').toBe(1)
    expect(BRANCH_OF['headcount-allocation']).toBe('single-row')
  })

  it('⭐ vendor-selection (8-wide tier) now holds its factor tier on ONE row', async () => {
    /**
     * ⚠ THIS ASSERTION IS INVERTED FROM WHAT IT WAS, AND THE INVERSION IS THE
     * DELIVERABLE. It read `toBeGreaterThan(1)` — an eight-wide tier splitting
     * across rows, which made this starter 1142 x 1937: a PORTRAIT model in a
     * LANDSCAPE pane, fitted on its height and using about 30% of the available
     * width. At the 1482 budget it is 3592 x 1811 and the tier is one row.
     *
     * Kept pointed at the same eight node ids so the claim is still bound by
     * IDENTITY rather than by a count that some other tier could satisfy.
     */
    const rects = await layOut('vendor-selection')
    const ys = new Set(
      FACTOR_TIER_OF_VENDOR_SELECTION.map((nid) => rects.find((r) => r.id === nid)!.y),
    )
    expect(ys.size, 'expected the single-row branch').toBe(1)
    expect(BRANCH_OF['vendor-selection']).toBe('single-row')
  })
})

describe('WHERE THE GAP COMES FROM — and it is not applyCollisionGuard', () => {
  /**
   * The discriminator, and the reason this suite is not guarantee theatre.
   *
   * `centreRowsOnSpine` re-snaps every row to a uniform `elkBoxW + gap` stride
   * immediately before the guard runs, so the RENDERED neighbour gap is
   * `LAYOUT_PADDING_X + effectiveNodeSpacing` = 24 + 20 = 44. If the guard had
   * had to act on a pair, that pair would sit at exactly `COLLISION_GAP` (20),
   * because that is the value the guard writes.
   *
   * Measured 18 Aug 2026: the minimum gap is 44 in all 120 measured cells, and
   * removing the guard call altogether leaves every node position unchanged
   * (identical sha256 across 25 cells). So this asserts the gap is the
   * STRIDE's, not the guard's — which is what stops a later reader citing a
   * green suite as evidence that the guard protects the corpus.
   */
  // ⚠ WAS `LAYOUT_PADDING_X + 20`, with the 20 hand-copied from the old
  // `Math.max(20, spacing)` literal in `layout.ts`. That floor is now the named
  // `LAYOUT_NODE_GAP`, so this reads it rather than restating it — the mirror
  // is what made five cases RED with a bare `expected 56 to be 44` when the
  // floor was raised (CLAUDE.md trap 12).
  const EXPECTED_STRIDE_GAP = LAYOUT_PADDING_X + LAYOUT_NODE_GAP

  it.each(Object.keys(STARTERS) as StarterId[])(
    '%s: the minimum same-row gap is the STRIDE, strictly above COLLISION_GAP',
    async (id) => {
      let min = Number.POSITIVE_INFINITY
      const rows = rowsOf(await layOut(id))
      for (const row of rows.values()) {
        for (let i = 1; i < row.length; i++) {
          min = Math.min(min, row[i].x - (row[i - 1].x + row[i - 1].w))
        }
      }
      expect(Number.isFinite(min), 'no same-row pair existed to measure').toBe(true)
      expect(min).toBe(EXPECTED_STRIDE_GAP)
      expect(min).toBeGreaterThan(COLLISION_GAP)
    },
  )
})
