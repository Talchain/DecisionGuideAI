/**
 * Semantic layout tests (D3, D4, D6).
 *
 * Covers:
 * - normaliseTierRows direct fixture test for sub-row cumulative heights
 *   (I.2 — function exported for unit test).
 * - normaliseTierRows pipeline behaviour: canonical tier Y, separated
 *   outcome/risk/goal, sparse-tier no-phantom-gap, determinism.
 * - centreRowsOnSpine: every row aligned, spine excludes goal.
 * - Balanced row splits (exact remainder).
 * - Global translation: min(x), min(y) ≥ CANVAS_MARGIN; locked nodes untouched.
 * - groupByYRow determinism.
 * - Constants contract.
 * - End-to-end no-overlap.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { layoutGraph, groupByYRow, normaliseTierRows } from '../utils/layout'
import {
  CANVAS_MARGIN,
  TIER_BY_KIND,
  NODE_CARD_MAX_W,
  NODE_LAYOUT_MIN_W,
  LAYOUT_PADDING_X,
  LAYOUT_PADDING_Y,
  LAYOUT_BOX_MAX_W,
  LAYOUT_BOX_MIN_W,
  COLLISION_GAP,
  DEFAULT_NODE_HEIGHT,
  NODE_CARD_PADDING_X,
  NODE_HEADER_RESERVE_PX,
  MAX_CARDS_PER_ROW,
  NODE_TITLE_MIN_MEASURE_PX,
} from '../utils/nodeLayoutConstants'
import type { Node, Edge } from '@xyflow/react'

function n(id: string, type: string, extra: Record<string, unknown> = {}): Node {
  return { id, type, position: { x: 0, y: 0 }, data: { label: id, kind: type, ...extra } }
}

function e(id: string, src: string, tgt: string): Edge {
  return { id, source: src, target: tgt }
}

// ⚠ `STD_CANVAS` (1300) and `NARROW` (936) are gone: `layoutGraph` no longer
// takes a canvas (founder ruling R1, 18 Aug 2026). The budget is the constant
// `CANONICAL_LAYOUT_WIDTH`, and the packing branch is now selected by the widest
// tier's node count alone — <= 6 single-row, >= 7 multi-row at 3 per row. The
// row-splitting cases below therefore choose their branch by COUNT, and the
// 6-vs-7 pair is deliberately kept as a discriminating pair: if the boundary
// moves in either direction one of them REDs.

const tierY = (laid: Node[], id: string): number =>
  laid.find(node => node.id === id)!.position.y

// ───────────────────────────────────────────────────────────────────────────
// I.2 direct fixture test of normaliseTierRows sub-row cumulative behaviour
// ───────────────────────────────────────────────────────────────────────────
describe('normaliseTierRows — direct fixture (I.2)', () => {
  it('places cumulative sub-row Y based on previous sub-row max height', () => {
    const positionMap = new Map<string, { x: number; y: number }>([
      ['a1', { x: 0, y: 0 }],
      ['a2', { x: 200, y: 0 }],
      ['b1', { x: 0, y: 200 }],
      ['b2', { x: 200, y: 200 }],
    ])
    const sizeMap = new Map<string, { width: number; height: number }>([
      ['a1', { width: 320, height: 120 }],
      ['a2', { width: 320, height: 100 }],
      ['b1', { width: 320, height: 80 }],
      ['b2', { width: 320, height: 60 }],
    ])
    const tierAssignments = new Map<number, string[]>([
      [2, ['a1', 'a2', 'b1', 'b2']],
    ])
    const effectiveLayerSpacing = 90

    // Pass tier 2 in `splitterCreatedTiers` because this fixture simulates
    // a tier that the splitter deliberately divided into sub-rows. Without
    // that signal, normaliseTierRows now collapses intra-tier Y variation
    // (per the staggering-bug fix); see `option staggering bug fix` test
    // below for the collapsing-default branch.
    normaliseTierRows(positionMap, sizeMap, tierAssignments, effectiveLayerSpacing, new Set([2]))

    const subRowSpacing = Math.round(effectiveLayerSpacing * 0.6) // 54

    // First sub-row at y=0
    expect(positionMap.get('a1')!.y).toBe(0)
    expect(positionMap.get('a2')!.y).toBe(0)
    // Second sub-row uses prev max (120), not its own max (80).
    expect(positionMap.get('b1')!.y).toBe(0 + 120 + subRowSpacing)
    expect(positionMap.get('b2')!.y).toBe(0 + 120 + subRowSpacing)
    // X untouched.
    expect(positionMap.get('a1')!.x).toBe(0)
    expect(positionMap.get('b2')!.x).toBe(200)
  })

  it('multi-tier cumulative Y uses each tier maxHeight', () => {
    const positionMap = new Map<string, { x: number; y: number }>([
      ['d', { x: 0, y: 0 }],
      ['o1', { x: 0, y: 100 }],
      ['o2', { x: 200, y: 100 }],
      ['g', { x: 0, y: 200 }],
    ])
    const sizeMap = new Map<string, { width: number; height: number }>([
      ['d', { width: 320, height: 200 }],
      ['o1', { width: 320, height: 80 }],
      ['o2', { width: 320, height: 80 }],
      ['g', { width: 320, height: 100 }],
    ])
    const tierAssignments = new Map<number, string[]>([
      [0, ['d']],
      [1, ['o1', 'o2']],
      [5, ['g']],
    ])

    normaliseTierRows(positionMap, sizeMap, tierAssignments, 50)

    expect(positionMap.get('d')!.y).toBe(0)
    expect(positionMap.get('o1')!.y).toBe(250) // 0 + 200 + 50
    expect(positionMap.get('o2')!.y).toBe(250)
    expect(positionMap.get('g')!.y).toBe(380) // 250 + 80 + 50
  })

  it('skips empty tiers — no phantom gap', () => {
    const positionMap = new Map<string, { x: number; y: number }>([
      ['d', { x: 0, y: 0 }],
      ['f', { x: 0, y: 500 }],
    ])
    const sizeMap = new Map<string, { width: number; height: number }>([
      ['d', { width: 320, height: 100 }],
      ['f', { width: 320, height: 100 }],
    ])
    const tierAssignments = new Map<number, string[]>([
      [0, ['d']],
      [2, ['f']],
    ])

    normaliseTierRows(positionMap, sizeMap, tierAssignments, 50)

    expect(positionMap.get('d')!.y).toBe(0)
    expect(positionMap.get('f')!.y).toBe(150) // 0 + 100 + 50
  })

  // Regression: option-staggering bug surfaced by the
  // 2026-05-07 layout-pipeline diagnostic on graph B (marketing
  // approach). When measured node heights varied, ELK shifted one
  // option ~17 px above its peers within the same semantic tier.
  // groupByYRow's default 10 px tolerance treated that gap as a
  // sub-row split, and the previous normaliseTierRows preserved the
  // split — staggering options onto two canonical rows. After the fix,
  // normaliseTierRows must collapse any intra-tier Y variation when
  // the tier was NOT in `splitterCreatedTiers`.
  it('option-staggering fix — collapses ELK incidental intra-tier Y when no splitter ran', () => {
    // Mimics graph B: 4 options, ELK placed opt_status_quo 17 px above
    // the others (within the same tier 1).
    const positionMap = new Map<string, { x: number; y: number }>([
      ['opt_a', { x: 100, y: 222 }],
      ['opt_b', { x: 400, y: 222 }],
      ['opt_c', { x: 700, y: 222 }],
      ['opt_status_quo', { x: 1000, y: 205 }], // 17 px above peers
    ])
    const sizeMap = new Map<string, { width: number; height: number }>([
      ['opt_a', { width: 320, height: 100 }],
      ['opt_b', { width: 320, height: 100 }],
      ['opt_c', { width: 320, height: 100 }],
      ['opt_status_quo', { width: 320, height: 117 }], // taller (longer label)
    ])
    const tierAssignments = new Map<number, string[]>([
      [1, ['opt_a', 'opt_b', 'opt_c', 'opt_status_quo']],
    ])

    // No splitterCreatedTiers passed (or empty Set) → tier 1 must
    // collapse to a single canonical Y regardless of the 17 px gap.
    normaliseTierRows(positionMap, sizeMap, tierAssignments, 90)

    const ys = ['opt_a', 'opt_b', 'opt_c', 'opt_status_quo'].map(
      (id) => positionMap.get(id)!.y,
    )
    expect(new Set(ys).size).toBe(1) // all four on the same canonical row
    // X positions preserved (centring is centreRowsOnSpine's job).
    expect(positionMap.get('opt_a')!.x).toBe(100)
    expect(positionMap.get('opt_status_quo')!.x).toBe(1000)
  })

  it('splitter signal — when splitterCreatedTiers includes the tier, sub-rows are still preserved', () => {
    // Same fixture, but this time the caller signals that the tier was
    // deliberately split (via applyTierRowSplitting). Sub-rows must be
    // preserved for backwards compatibility with viewport-fit row
    // splitting.
    const positionMap = new Map<string, { x: number; y: number }>([
      ['n1', { x: 0, y: 0 }],
      ['n2', { x: 200, y: 0 }],
      ['n3', { x: 0, y: 200 }],
      ['n4', { x: 200, y: 200 }],
    ])
    const sizeMap = new Map<string, { width: number; height: number }>([
      ['n1', { width: 320, height: 100 }],
      ['n2', { width: 320, height: 100 }],
      ['n3', { width: 320, height: 100 }],
      ['n4', { width: 320, height: 100 }],
    ])
    const tierAssignments = new Map<number, string[]>([
      [2, ['n1', 'n2', 'n3', 'n4']],
    ])

    normaliseTierRows(positionMap, sizeMap, tierAssignments, 90, new Set([2]))

    // Two sub-rows preserved.
    const ys = new Set(['n1', 'n2', 'n3', 'n4'].map((id) => positionMap.get(id)!.y))
    expect(ys.size).toBe(2)
  })

  // End-to-end regression for the option-staggering bug. Loads the actual
  // graph B fixture (the marketing-approach decision recovered from the
  // failing screenshot run), assigns per-node measured heights that vary
  // — long-label option `opt_status_quo` taller than peers — and runs the
  // FULL `layoutGraph` pipeline (applyTierRowSplitting → normaliseTierRows
  // → centreRowsOnSpine → applyCollisionGuard → applyGlobalTranslation).
  // Asserts every option ends up on a single canonical Y. Without the fix
  // (splitter-provenance signal in normaliseTierRows), ELK's intra-tier
  // height-driven Y shift would have been preserved as a sub-row split,
  // staggering opt_status_quo onto a separate row.
  it('option-staggering fix — full pipeline (real graph B fixture, varied heights)', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '__fixtures__',
      'graph-b-staggering-regression.json',
    )
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))

    // Apply heights that mimic the real-CSS-rendered measurement gap that
    // surfaced the bug: 3 options at ~100 px, opt_status_quo notably
    // taller. The exact numbers don't matter — what matters is that any
    // option-tier intra-Y variation ELK induces is collapsed to a single
    // canonical row.
    const heights: Record<string, number> = {
      opt_ai_tool: 100,
      opt_hire_manager: 100,
      opt_hybrid: 100,
      opt_status_quo: 140, // taller (longer label)
    }
    const nodesWithHeights = (fixture.nodes as Node[]).map((node) => {
      const h = heights[node.id]
      if (!h) return node
      return {
        ...node,
        height: h,
        // measured is read by layoutGraph's getNodeDimensions in
        // preference to node.height; populate both to be defensive.
        measured: { width: 320, height: h },
      } as Node
    })

    const result = await layoutGraph(
      nodesWithHeights,
      fixture.edges as Edge[],
      {},
    )

    const optionYs = result.nodes
      .filter((node) => node.type === 'option')
      .map((node) => node.position.y)
    expect(optionYs.length).toBe(4)
    // All four options share a single Y (within the same canonical row).
    expect(new Set(optionYs).size).toBe(1)

    // Sanity check: factors share their SUB-ROW's Y too (5 factors). ⚠ GAP 7
    // (25 Sep 2026): the row cap is four, so these five wrap DELIBERATELY into
    // the ruled 3 + 2 — two splitter-created sub-rows, each on ONE exact Y. An
    // ELK-induced stagger would show as a third Y or a 4 + 1 / 2 + 2 + 1 split.
    const factorYs = result.nodes
      .filter((node) => node.type === 'factor')
      .map((node) => node.position.y)
    expect(factorYs.length).toBe(5)
    const factorRowYs = [...new Set(factorYs)].sort((a, b) => a - b)
    expect(factorRowYs.map((y) => factorYs.filter((fy) => fy === y).length)).toEqual([3, 2])
  })
})

describe('normaliseTierRows — canonical tier Y (D3)', () => {
  it('strict tier monotonicity across small/medium fixtures', async () => {
    const small = await layoutGraph(
      [n('d', 'decision'), n('o', 'option'), n('f', 'factor'), n('g', 'goal')],
      [e('1', 'd', 'o'), e('2', 'o', 'f'), e('3', 'f', 'g')],
      {},
    )
    expect(tierY(small.nodes, 'd')).toBeLessThan(tierY(small.nodes, 'o'))
    expect(tierY(small.nodes, 'o')).toBeLessThan(tierY(small.nodes, 'f'))
    expect(tierY(small.nodes, 'f')).toBeLessThan(tierY(small.nodes, 'g'))

    const medium = await layoutGraph(
      [
        n('d', 'decision'),
        n('o1', 'option'), n('o2', 'option'),
        n('f1', 'factor'), n('f2', 'factor'),
        n('out', 'outcome'),
        n('r', 'risk'),
        n('g', 'goal'),
      ],
      [
        e('1', 'd', 'o1'), e('2', 'd', 'o2'),
        e('3', 'o1', 'f1'), e('4', 'o2', 'f2'),
        e('5', 'f1', 'out'), e('6', 'out', 'r'), e('7', 'r', 'g'),
      ],
      {},
    )
    expect(tierY(medium.nodes, 'd')).toBeLessThan(tierY(medium.nodes, 'o1'))
    expect(tierY(medium.nodes, 'o1')).toBeLessThan(tierY(medium.nodes, 'f1'))
    expect(tierY(medium.nodes, 'f1')).toBeLessThan(tierY(medium.nodes, 'out'))
    // ⭐ OUTCOME AND RISK ARE ONE TIER NOW (ruled 14 Sep 2026) — see
    // `TIER_BY_KIND`. This asserted `out < r`; strict monotonicity across the
    // CONSEQUENCE layer is exactly what the ruling removes, so the assertion
    // becomes equality rather than being deleted. Monotonicity across the tiers
    // that ARE distinct is untouched, above and below.
    expect(tierY(medium.nodes, 'out')).toBe(tierY(medium.nodes, 'r'))
    expect(tierY(medium.nodes, 'r')).toBeLessThan(tierY(medium.nodes, 'g'))
  })

  /**
   * ⭐⭐⭐ REVERSED BY FOUNDER RULING, 14 Sep 2026 — and inverted rather than
   * deleted, because the property is still worth pinning; only its direction
   * changed.
   *
   * This test was named "outcomes and risks no longer share a Y row" and
   * asserted `outY < rY`. It arrived 7 May as a line item in the commit that
   * replaced ELK's Y assignment, and the only reason recorded anywhere for the
   * separation restates the decision: *"Outcomes, risks, and goals occupy
   * distinct tiers so they never share a row."*
   *
   * The ruling is on a CAUSAL argument, not a spatial one: `risk` is not a
   * causal class. Measured across all five committed starters — 87 nodes, 163
   * edges — risks and outcomes have identical structural signatures, both fed
   * only by factors and both feeding only the goal, with `risk→outcome` and
   * `outcome→risk` at **0 and 0**. One layer, two labels, the label carrying
   * valence rather than causal position. `TIER_BY_KIND` carries the full record.
   *
   * ⚠ NOTE WHAT THIS FIXTURE CONTAINS, because it is the one thing that would
   * make the merge wrong: the `medium` fixture above has an `out → r` edge, and
   * it is the ONLY `outcome → risk` edge anywhere in this repository. If that
   * class ever becomes real in a shipped model it would render as an intra-row
   * edge, and `TIER_BY_KIND` is the line to revisit.
   */
  it('outcomes and risks share one consequence row', async () => {
    const { nodes: laid } = await layoutGraph(
      [
        n('d', 'decision'),
        n('o', 'option'),
        n('out', 'outcome'),
        n('r', 'risk'),
        n('g', 'goal'),
      ],
      [
        e('1', 'd', 'o'), e('2', 'o', 'out'), e('3', 'o', 'r'),
        e('4', 'out', 'g'), e('5', 'r', 'g'),
      ],
      {},
    )
    const outY = tierY(laid, 'out')
    const rY = tierY(laid, 'r')
    // Exactly equal, not merely close: a tolerance would pass on a near-miss
    // produced by a sub-row split, which is a different layout and not this one.
    expect(outY).toBe(rY)
    // …and the row is still a real row between the option and the goal, so a
    // mutant that collapsed every tier to one Y is visible here.
    expect(tierY(laid, 'o')).toBeLessThan(outY)
    expect(outY).toBeLessThan(tierY(laid, 'g'))
  })

  it('two factors fed directly from decision share a Y row', async () => {
    const { nodes: laid } = await layoutGraph(
      [n('d', 'decision'), n('f1', 'factor'), n('f2', 'factor'), n('g', 'goal')],
      [e('1', 'd', 'f1'), e('2', 'd', 'f2'), e('3', 'f1', 'g'), e('4', 'f2', 'g')],
      {},
    )
    expect(Math.abs(tierY(laid, 'f1') - tierY(laid, 'f2'))).toBeLessThanOrEqual(10)
  })

  it('determinism — same graph laid out twice produces identical positions', async () => {
    const nodes = [
      n('d', 'decision'),
      n('o1', 'option'), n('o2', 'option'),
      n('f1', 'factor'), n('f2', 'factor'), n('f3', 'factor'),
      n('out', 'outcome'),
      n('r', 'risk'),
      n('g', 'goal'),
    ]
    const edges = [
      e('1', 'd', 'o1'), e('2', 'd', 'o2'),
      e('3', 'o1', 'f1'), e('4', 'o1', 'f2'), e('5', 'o2', 'f3'),
      e('6', 'f1', 'out'), e('7', 'f3', 'r'),
      e('8', 'out', 'g'), e('9', 'r', 'g'),
    ]
    const a = (await layoutGraph(nodes, edges, {})).nodes
    const b = (await layoutGraph(nodes, edges, {})).nodes
    for (const node of a) {
      const match = b.find(x => x.id === node.id)!
      expect(match.position.x).toBeCloseTo(node.position.x, 5)
      expect(match.position.y).toBeCloseTo(node.position.y, 5)
    }
  })
})

describe('groupByYRow — deterministic output', () => {
  it('returns row anchors sorted ascending and node IDs sorted by X then id', () => {
    const positionMap = new Map<string, { x: number; y: number }>([
      ['c', { x: 50, y: 200 }],
      ['a', { x: 10, y: 100 }],
      ['b', { x: 100, y: 100 }],
      ['d', { x: 50, y: 100 }],
      ['e', { x: 50, y: 200 }],
    ])
    const out = groupByYRow(['c', 'a', 'b', 'd', 'e'], positionMap)
    expect([...out.keys()]).toEqual([100, 200])
    expect(out.get(100)).toEqual(['a', 'd', 'b'])
    expect(out.get(200)).toEqual(['c', 'e'])
  })
})

describe('global translation', () => {
  it('all unlocked nodes have x, y ≥ CANVAS_MARGIN', async () => {
    const { nodes: laid } = await layoutGraph(
      [n('d', 'decision'), n('o', 'option'), n('f', 'factor'), n('g', 'goal')],
      [e('1', 'd', 'o'), e('2', 'o', 'f'), e('3', 'f', 'g')],
      {},
    )
    for (const node of laid) {
      expect(node.position.x).toBeGreaterThanOrEqual(CANVAS_MARGIN - 0.5)
      expect(node.position.y).toBeGreaterThanOrEqual(CANVAS_MARGIN - 0.5)
    }
  })

  it('locked nodes retain their saved positions exactly', async () => {
    const lockedX = 1234
    const lockedY = 567
    const { nodes: laid } = await layoutGraph(
      [
        n('d', 'decision'),
        n('o', 'option'),
        n('locked', 'factor', { locked: true }),
        n('f', 'factor'),
        n('g', 'goal'),
      ].map(node =>
        node.id === 'locked'
          ? { ...node, position: { x: lockedX, y: lockedY } }
          : node,
      ),
      [e('1', 'd', 'o'), e('2', 'o', 'f'), e('3', 'f', 'g')],
      {},
    )
    const locked = laid.find(node => node.id === 'locked')!
    expect(locked.position.x).toBe(lockedX)
    expect(locked.position.y).toBe(lockedY)
  })
})

describe('balanced row splits (exact remainder)', () => {
  async function layoutFactors(count: number): Promise<Node[]> {
    const nodes: Node[] = [n('d', 'decision'), n('g', 'goal')]
    const edges: Edge[] = []
    for (let i = 0; i < count; i++) {
      const id = `f${i}`
      nodes.push(n(id, 'factor'))
      edges.push(e(`ed-f${i}`, 'd', id))
      edges.push(e(`ef-g${i}`, id, 'g'))
    }
    const { nodes: laid } = await layoutGraph(nodes, edges, {})
    return laid
  }

  function rowSizesFor(laid: Node[], prefix: string): number[] {
    const factors = laid.filter(node => node.id.startsWith(prefix))
    const positionMap = new Map(factors.map(node => [node.id, node.position]))
    const rows = groupByYRow(factors.map(f => f.id), positionMap)
    return [...rows.values()].map(ids => ids.length)
  }

  function balancedAdjacentDifference(sizes: number[]): boolean {
    if (sizes.length <= 1) return true
    const sorted = [...sizes].sort((a, b) => b - a)
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i - 1] - sorted[i] > 1) return false
    }
    return true
  }

  // ── The discriminating pair. 8 is the widest tier the canonical budget still
  // admits as a single row; 9 is the first that splits. Neither assertion alone
  // shows the boundary is where it is — 8-does-not-split would stay green if the
  // splitter stopped working entirely, and 9-splits would stay green if
  // everything split. Together they pin it.
  //
  // ⚠ WAS 6 AND 7. `CANONICAL_LAYOUT_WIDTH` moved 1185 → 1482 so that seven-
  // and eight-wide tiers single-row; at 1185 those tiers split and three of the
  // five shipped starters came out portrait in a landscape pane.
  it('8 factors split 4 + 4 (S4) — rows above four cards wrap (gap 7); four is the widest single row', async () => {
    // ⚠ WAS "8 factors do NOT split": the retired fair-share gate kept up to
    // eight on one row. ED S4 (#63 5806207128): "Rows above 5 cards wrap into
    // balanced sub-rows … 8→4+4". ⚠ GAP 7 (25 Sep 2026, ED #63 5808428246 —
    // 1280x800 dock open is the acceptance size): the cap is four, so five now
    // wraps 3 + 2 and four is the widest single row.
    expect(rowSizesFor(await layoutFactors(8), 'f')).toEqual([4, 4])
    expect(rowSizesFor(await layoutFactors(5), 'f')).toEqual([3, 2])
    expect(rowSizesFor(await layoutFactors(4), 'f')).toEqual([4])
  })

  it('10 factors split balanced', async () => {
    const sizes = rowSizesFor(await layoutFactors(10), 'f')
    expect(balancedAdjacentDifference(sizes)).toBe(true)
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(10)
    expect(sizes.length).toBeGreaterThan(1)
  })

  it('9 factors split balanced — the first tier width that splits', async () => {
    const sizes = rowSizesFor(await layoutFactors(9), 'f')
    expect(balancedAdjacentDifference(sizes)).toBe(true)
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(9)
    expect(sizes.length).toBeGreaterThan(1)
  })

  it('10 factors split balanced (never N+1 mismatch)', async () => {
    const sizes = rowSizesFor(await layoutFactors(10), 'f')
    expect(balancedAdjacentDifference(sizes)).toBe(true)
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(10)
    expect(sizes.length).toBeGreaterThan(1)
  })

  it('11 factors split balanced', async () => {
    const sizes = rowSizesFor(await layoutFactors(11), 'f')
    expect(balancedAdjacentDifference(sizes)).toBe(true)
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(11)
    expect(sizes.length).toBeGreaterThan(1)
  })
})

describe('spine centring', () => {
  it('every row centre lands within 100 px of the graph spine', async () => {
    const { nodes: laid } = await layoutGraph(
      [
        n('d', 'decision'),
        n('o1', 'option'), n('o2', 'option'), n('o3', 'option'),
        n('f1', 'factor'), n('f2', 'factor'), n('f3', 'factor'),
        n('out', 'outcome'),
        n('g', 'goal'),
      ],
      [
        e('1', 'd', 'o1'), e('2', 'd', 'o2'), e('3', 'd', 'o3'),
        e('4', 'o1', 'f1'), e('5', 'o2', 'f2'), e('6', 'o3', 'f3'),
        e('7', 'f1', 'out'), e('8', 'out', 'g'),
      ],
      {},
    )
    const spineNodes = ['d', 'o1', 'o2', 'o3'].map(id => laid.find(node => node.id === id)!)
    const centres = spineNodes.map(node => node.position.x).sort((a, b) => a - b)
    const spineX = centres[Math.floor(centres.length / 2)]

    const rowsToCheck = [
      ['o1', 'o2', 'o3'],
      ['f1', 'f2', 'f3'],
      ['out'],
      ['g'],
    ]
    for (const rowIds of rowsToCheck) {
      const xs = rowIds.map(id => laid.find(node => node.id === id)!.position.x)
      const mean = xs.reduce((a, b) => a + b, 0) / xs.length
      expect(Math.abs(mean - spineX)).toBeLessThan(100)
    }
  })
})

describe('TIER_BY_KIND values', () => {
  it('outcome and risk share tier 3 — the consequence layer (ruled 14 Sep 2026)', () => {
    expect(TIER_BY_KIND.decision).toBe(0)
    expect(TIER_BY_KIND.option).toBe(1)
    expect(TIER_BY_KIND.factor).toBe(2)
    expect(TIER_BY_KIND.outcome).toBe(3)
    expect(TIER_BY_KIND.risk).toBe(3)
    expect(TIER_BY_KIND.goal).toBe(5)
  })

  it('the consequence kinds share a tier BY IDENTITY, not by both being 3', () => {
    // The assertion above would pass if someone set BOTH to 4, or to 2 — it
    // pins values, not the relationship the ruling is about. This pins the
    // relationship, so the two cannot be separated again without a red.
    expect(TIER_BY_KIND.risk).toBe(TIER_BY_KIND.outcome)
    // …and they are genuinely a layer of their own, between the drivers and the
    // goal. Without this a mutant merging consequences INTO the factor tier
    // would satisfy the equality above.
    expect(TIER_BY_KIND.outcome).toBeGreaterThan(TIER_BY_KIND.factor)
    expect(TIER_BY_KIND.outcome).toBeLessThan(TIER_BY_KIND.goal)
  })

  it('tier 4 is empty, and that is deliberate rather than an oversight', () => {
    // `goal` stays at 5 rather than being renumbered to 4, so the diff carrying
    // the ruling is the one line that states it. `normaliseTierRows` iterates
    // OCCUPIED tiers and accumulates Y across them, so the gap produces no
    // phantom row — pinned by "skips empty tiers — no phantom gap" above.
    expect(Object.values(TIER_BY_KIND)).not.toContain(4)
  })
})

describe('constants contract', () => {
  it('LAYOUT_BOX_MAX_W === NODE_CARD_MAX_W + LAYOUT_PADDING_X', () => {
    expect(LAYOUT_BOX_MAX_W).toBe(NODE_CARD_MAX_W + LAYOUT_PADDING_X)
  })

  it('LAYOUT_BOX_MIN_W === NODE_LAYOUT_MIN_W + LAYOUT_PADDING_X', () => {
    expect(LAYOUT_BOX_MIN_W).toBe(NODE_LAYOUT_MIN_W + LAYOUT_PADDING_X)
  })

  it('NODE_CARD_MAX_W is 320; NODE_LAYOUT_MIN_W is the label-scale-derived floor', () => {
    // ⚠ 320 → 336 (12 Sep 2026). The maximum a card may take on the single-row
    // branch, and the only place card width is actually decided — the canonical
    // budget never set it (see `CANONICAL_LAYOUT_WIDTH`'s derivation note).
    // Raised because the canvas type ramp moved to the design system's own
    // stated 14px minimum; BOUNDED at 336 because the options row is laid on
    // the same stride, and `e2e/visual/firstViewFraming.visual.spec.ts` REDs at
    // 360 with an option under the Outputs dock at 1280x800. Measured, not
    // argued: 336 passes, 360 fails, 400 fails on 4 of 5 starters.
    expect(NODE_CARD_MAX_W).toBe(336)

    // ⚠ WAS `toBe(140)` (17 Aug 2026). `NODE_LAYOUT_MIN_W` is no longer a
    // number anyone may state: canvas label text is counter-scaled, and a card
    // floor tuned against the DECLARED font size holds half the text it claims
    // to at the zoom the product settles on — that is #758's regression. The
    // floor is now derived from `MAX_LABEL_COUNTER_SCALE`, so this lock asserts
    // the DERIVATION. Restating 140 (or 244, or any literal) here would
    // reinstate exactly the hand-maintained mirror that let the font scale and
    // the geometry drift apart in the first place (CLAUDE.md trap 12).
    //
    // The row-split policy is deliberately NOT the card floor. It was the fair
    // share `NODE_SINGLE_ROW_FAIR_SHARE_W` (140) until S4; it is now a COUNT,
    // `MAX_CARDS_PER_ROW`, which by construction cannot move with the label
    // scale. (Five until gap 7, 25 Sep 2026: four fits the 1280 frame.)
    expect(NODE_LAYOUT_MIN_W).toBe(
      NODE_TITLE_MIN_MEASURE_PX + NODE_HEADER_RESERVE_PX + NODE_CARD_PADDING_X,
    )
    expect(MAX_CARDS_PER_ROW).toBe(4)
  })

  it('COLLISION_GAP does not exceed the rendered node-node gap', () => {
    // Rendered gap = `Math.max(20, default spacing)` = 20. (Default spacing
    // is 15 after the chain 60 → 30 → 20 → 15; the literal-20 floor in
    // layout.ts pins the runtime value at 20 even though the persisted
    // intent is 15.) COLLISION_GAP must not exceed the rendered gap — if it
    // did, the post-layout collision guard would push apart correctly-
    // laid-out same-row pairs. Currently COLLISION_GAP=20 = rendered gap,
    // so the guard is essentially inert; it only fires when ELK / multi-row
    // splitting drives nodes closer than 20 px.
    //
    // The tight bound (`<= 20`) reflects the current contract; the loose
    // `< 30` is a documentation-grade ceiling preserved from earlier rounds.
    // Both are asserted so a future change that breaks either surfaces here.
    //
    // Note: the historical `COLLISION_GAP < MIN_GAP` relation no longer
    // holds after the MIN_GAP 30 → 15 change (MIN_GAP=15 < COLLISION_GAP=20).
    // The two constants serve unrelated concerns; see `nodeLayoutConstants.ts`.
    expect(COLLISION_GAP).toBeLessThanOrEqual(20)
    expect(COLLISION_GAP).toBeLessThan(30)
  })

  it('DEFAULT_NODE_HEIGHT + LAYOUT_PADDING_Y is a reasonable fallback', () => {
    expect(DEFAULT_NODE_HEIGHT + LAYOUT_PADDING_Y).toBeGreaterThanOrEqual(60)
  })
})

describe('end-to-end no-overlap', () => {
  it('full pipeline produces non-overlapping nodes', async () => {
    const { nodes: laid } = await layoutGraph(
      [
        n('d', 'decision'),
        n('o1', 'option'), n('o2', 'option'), n('o3', 'option'),
        n('f1', 'factor'), n('f2', 'factor'),
        n('out', 'outcome'),
        n('r', 'risk'),
        n('g', 'goal'),
      ],
      [
        e('1', 'd', 'o1'), e('2', 'd', 'o2'), e('3', 'd', 'o3'),
        e('4', 'o1', 'f1'), e('5', 'o2', 'f2'),
        e('6', 'f1', 'out'), e('7', 'out', 'r'), e('8', 'r', 'g'),
      ],
      {},
    )
    const minBoxW = LAYOUT_BOX_MIN_W
    const minBoxH = DEFAULT_NODE_HEIGHT + LAYOUT_PADDING_Y
    for (let i = 0; i < laid.length; i++) {
      for (let j = i + 1; j < laid.length; j++) {
        const a = laid[i].position
        const b = laid[j].position
        const overlapX = Math.abs(a.x - b.x) < minBoxW - COLLISION_GAP / 2
        const overlapY = Math.abs(a.y - b.y) < minBoxH
        expect(overlapX && overlapY).toBe(false)
      }
    }
  })
})
