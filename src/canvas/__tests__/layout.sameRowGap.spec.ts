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
import type { CanvasSize } from '../utils/layout'
import { COLLISION_GAP, LAYOUT_PADDING_X } from '../utils/nodeLayoutConstants'
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
 * The two packing branches, named by what they exercise rather than by number.
 * `layout.ts` splits a tier into multiple rows when the per-node fair share of
 * `canvasSize.width * 0.85` falls below `NODE_SINGLE_ROW_FAIR_SHARE_W +
 * LAYOUT_PADDING_X`, so these two widths straddle that threshold for the
 * five-factor starters. Asserted below by IDENTITY (row occupancy of the
 * factor tier), never assumed.
 */
const BRANCHES: ReadonlyArray<{ name: string; canvas: CanvasSize }> = [
  { name: 'single-row branch', canvas: { width: 1300, height: 742 } },
  { name: 'multi-row branch', canvas: { width: 900, height: 742 } },
]

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

async function layOut(id: StarterId, canvas: CanvasSize): Promise<Rect[]> {
  const { nodes, edges } = buildGraph(id)
  const out = await layoutGraph(nodes, edges, {}, canvas)
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
  for (const branch of BRANCHES) {
    for (const id of Object.keys(STARTERS) as StarterId[]) {
      it(`${id} — ${branch.name} @${branch.canvas.width}px: every same-row neighbour pair clears COLLISION_GAP`, async () => {
        const rects = await layOut(id, branch.canvas)
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
          `no row of "${id}" holds two nodes at ${branch.canvas.width}px — the gap assertion would be vacuous`,
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
              `"${id}" @${branch.canvas.width}px: "${left.id}" and "${right.id}" share row y=${left.y} with a ${gap}px gap`,
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
  // Bind the branch claim to node IDENTITY, not to a width literal. If a future
  // change moves the threshold, this REDs and says so, instead of quietly
  // running both cells on the same branch and reporting double coverage.
  const FACTOR_TIER_OF_HEADCOUNT = [
    'fac_ae_headcount',
    'fac_eng_attrition',
    'fac_eng_headcount',
    'fac_market_demand',
    'fac_quota_attainment',
  ] as const

  it('headcount-allocation packs its factor tier on ONE row at 1300px', async () => {
    const rects = await layOut('headcount-allocation', { width: 1300, height: 742 })
    const ys = new Set(
      FACTOR_TIER_OF_HEADCOUNT.map((nid) => rects.find((r) => r.id === nid)!.y),
    )
    expect(ys.size, 'expected the single-row branch').toBe(1)
  })

  it('headcount-allocation splits its factor tier across MORE THAN ONE row at 900px', async () => {
    const rects = await layOut('headcount-allocation', { width: 900, height: 742 })
    const ys = new Set(
      FACTOR_TIER_OF_HEADCOUNT.map((nid) => rects.find((r) => r.id === nid)!.y),
    )
    expect(ys.size, 'expected the multi-row branch').toBeGreaterThan(1)
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
  const EXPECTED_STRIDE_GAP = LAYOUT_PADDING_X + 20 // effectiveNodeSpacing floor: Math.max(20, spacing)

  it.each(Object.keys(STARTERS) as StarterId[])(
    '%s: the minimum same-row gap is the STRIDE (44px), strictly above COLLISION_GAP',
    async (id) => {
      let min = Number.POSITIVE_INFINITY
      for (const branch of BRANCHES) {
        const rows = rowsOf(await layOut(id, branch.canvas))
        for (const row of rows.values()) {
          for (let i = 1; i < row.length; i++) {
            min = Math.min(min, row[i].x - (row[i - 1].x + row[i - 1].w))
          }
        }
      }
      expect(Number.isFinite(min), 'no same-row pair existed to measure').toBe(true)
      expect(min).toBe(EXPECTED_STRIDE_GAP)
      expect(min).toBeGreaterThan(COLLISION_GAP)
    },
  )
})
