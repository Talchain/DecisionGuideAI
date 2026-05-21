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
import type { CanvasSize } from '../utils/layout'
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
} from '../utils/nodeLayoutConstants'
import type { Node, Edge } from '@xyflow/react'

function n(id: string, type: string, extra: Record<string, unknown> = {}): Node {
  return { id, type, position: { x: 0, y: 0 }, data: { label: id, kind: type, ...extra } }
}

function e(id: string, src: string, tgt: string): Edge {
  return { id, source: src, target: tgt }
}

const STD_CANVAS: CanvasSize = { width: 1300, height: 750 }
const NARROW: CanvasSize = { width: 936, height: 750 }

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
      STD_CANVAS,
    )

    const optionYs = result.nodes
      .filter((node) => node.type === 'option')
      .map((node) => node.position.y)
    expect(optionYs.length).toBe(4)
    // All four options share a single Y (within the same canonical row).
    expect(new Set(optionYs).size).toBe(1)

    // Sanity check: factors share their tier's Y too (5 factors).
    const factorYs = result.nodes
      .filter((node) => node.type === 'factor')
      .map((node) => node.position.y)
    expect(factorYs.length).toBe(5)
    expect(new Set(factorYs).size).toBe(1)
  })
})

describe('normaliseTierRows — canonical tier Y (D3)', () => {
  it('strict tier monotonicity across small/medium fixtures', async () => {
    const small = await layoutGraph(
      [n('d', 'decision'), n('o', 'option'), n('f', 'factor'), n('g', 'goal')],
      [e('1', 'd', 'o'), e('2', 'o', 'f'), e('3', 'f', 'g')],
      {},
      STD_CANVAS,
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
      STD_CANVAS,
    )
    expect(tierY(medium.nodes, 'd')).toBeLessThan(tierY(medium.nodes, 'o1'))
    expect(tierY(medium.nodes, 'o1')).toBeLessThan(tierY(medium.nodes, 'f1'))
    expect(tierY(medium.nodes, 'f1')).toBeLessThan(tierY(medium.nodes, 'out'))
    expect(tierY(medium.nodes, 'out')).toBeLessThan(tierY(medium.nodes, 'r'))
    expect(tierY(medium.nodes, 'r')).toBeLessThan(tierY(medium.nodes, 'g'))
  })

  it('outcomes and risks no longer share a Y row', async () => {
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
      STD_CANVAS,
    )
    const outY = tierY(laid, 'out')
    const rY = tierY(laid, 'r')
    expect(outY).toBeLessThan(rY)
    expect(Math.abs(outY - rY)).toBeGreaterThan(10)
  })

  it('two factors fed directly from decision share a Y row', async () => {
    const { nodes: laid } = await layoutGraph(
      [n('d', 'decision'), n('f1', 'factor'), n('f2', 'factor'), n('g', 'goal')],
      [e('1', 'd', 'f1'), e('2', 'd', 'f2'), e('3', 'f1', 'g'), e('4', 'f2', 'g')],
      {},
      STD_CANVAS,
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
    const a = (await layoutGraph(nodes, edges, {}, STD_CANVAS)).nodes
    const b = (await layoutGraph(nodes, edges, {}, STD_CANVAS)).nodes
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
      STD_CANVAS,
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
      STD_CANVAS,
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
    const { nodes: laid } = await layoutGraph(nodes, edges, {}, NARROW)
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

  it('6 factors split balanced', async () => {
    const sizes = rowSizesFor(await layoutFactors(6), 'f')
    expect(balancedAdjacentDifference(sizes)).toBe(true)
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(6)
  })

  it('7 factors split balanced', async () => {
    const sizes = rowSizesFor(await layoutFactors(7), 'f')
    expect(balancedAdjacentDifference(sizes)).toBe(true)
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(7)
  })

  it('10 factors split balanced (never N+1 mismatch)', async () => {
    const sizes = rowSizesFor(await layoutFactors(10), 'f')
    expect(balancedAdjacentDifference(sizes)).toBe(true)
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(10)
  })

  it('11 factors split balanced', async () => {
    const sizes = rowSizesFor(await layoutFactors(11), 'f')
    expect(balancedAdjacentDifference(sizes)).toBe(true)
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(11)
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
      STD_CANVAS,
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
  it('tiers separate outcome (3), risk (4), goal (5)', () => {
    expect(TIER_BY_KIND.decision).toBe(0)
    expect(TIER_BY_KIND.option).toBe(1)
    expect(TIER_BY_KIND.factor).toBe(2)
    expect(TIER_BY_KIND.outcome).toBe(3)
    expect(TIER_BY_KIND.risk).toBe(4)
    expect(TIER_BY_KIND.goal).toBe(5)
  })
})

describe('constants contract', () => {
  it('LAYOUT_BOX_MAX_W === NODE_CARD_MAX_W + LAYOUT_PADDING_X', () => {
    expect(LAYOUT_BOX_MAX_W).toBe(NODE_CARD_MAX_W + LAYOUT_PADDING_X)
  })

  it('LAYOUT_BOX_MIN_W === NODE_LAYOUT_MIN_W + LAYOUT_PADDING_X', () => {
    expect(LAYOUT_BOX_MIN_W).toBe(NODE_LAYOUT_MIN_W + LAYOUT_PADDING_X)
  })

  it('NODE_CARD_MAX_W is 320, NODE_LAYOUT_MIN_W is 140', () => {
    expect(NODE_CARD_MAX_W).toBe(320)
    expect(NODE_LAYOUT_MIN_W).toBe(140)
  })

  it('COLLISION_GAP < expected node-node gap', () => {
    // Default node-node gap is `Math.max(20, spacing=30) = 30` (default
    // spacing was reduced from 60 → 30; see layout.ts:54). COLLISION_GAP
    // = 20 < 30 so the post-layout collision guard only fires when ELK /
    // multi-row splitting leaves nodes closer than the intended gap.
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
      STD_CANVAS,
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
