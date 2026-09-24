/**
 * `solveLayoutNodeWidth` MUST equal what `layoutGraph` actually laid out against.
 *
 * This is the whole basis of the reload fix: on a restored graph the layout has
 * not run, so nothing has told `BaseNode` how wide a card should be. Rather than
 * persist that width — it is a pure function of data already persisted, and a
 * stored copy would be a mirror that repairs nothing already saved — the restore
 * path RE-SOLVES it. That is only sound if the solver is exact.
 *
 * ⚠ THE AGREEMENT MUST BE A DISCRIMINATION, NOT A TAUTOLOGY (CLAUDE.md trap 13).
 * Most graphs land on `NODE_CARD_MAX_W`, so "predictor agrees with layout" can
 * be satisfied by a predictor that returns the constant. Every matrix case below
 * therefore also runs a NEGATIVE CONTROL (`always NODE_CARD_MAX_W`) and the test
 * asserts that control DISAGREES on a non-trivial number of cells. If a future
 * change made every graph render at the maximum, this test goes red on the
 * control rather than passing quietly.
 *
 * ⚠ AND IT PINS INDEPENDENCE, NOT JUST EQUALITY. The claim "the width can be
 * re-derived from a restored graph" is false unless the width is independent of
 * everything a restored graph does NOT carry into the solve — node spacing,
 * measured heights, edges. Those are varied across the matrix on purpose: if any
 * of them ever starts influencing the width, the restore path would derive a
 * value the geometry was not built on, and this test is what says so.
 */
import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import { layoutGraph, solveLayoutNodeWidth } from '../utils/layout'
import {
  NODE_CARD_MAX_W,
  MAX_CARDS_PER_ROW,
  REPEATED_CARD_W,
} from '../utils/nodeLayoutConstants'

/**
 * ⭐ THE WIDEST TIER THAT STILL SINGLE-ROWS, DERIVED (12 Sep 2026).
 *
 * ⚠ WAS IMPLICIT IN TWO HAND-WRITTEN FIXTURES (8-with-3-locked, and the 6/7
 * cliff below), and when `CANONICAL_LAYOUT_WIDTH` moved 1185 → 1482 the cap
 * went 6 → 8 and BOTH went quiet in different ways. The 6/7 pair simply RED-ed
 * — fine, that is a corpus doing its job. The `preserveLocked` case did
 * something worse: its two arms both landed on the single-row branch, so its
 * `not.toBe` assertion compared MAX with MAX and its DISCRIMINATION COLLAPSED.
 * Its own comment says "the two must differ, or this test cannot observe the
 * parameter at all" — which by then it could not.
 *
 * So the cap is derived here and the fixtures are expressed RELATIVE to it: a
 * future constants move changes what these tests exercise instead of quietly
 * stopping them exercising anything.
 */
/*
 * ⭐⭐ S4 (24 Sep 2026): THE CAP IS NOW A RULED COUNT, AND THE SINGLE WIDTH NO
 * LONGER VARIES WITH THE GRAPH. Experience Design (#63 5806207128) replaced the
 * fair-share gate with "rows above 5 cards wrap" and put every repeated card at
 * one width (`REPEATED_CARD_W`) whether or not its row wraps ("split rows keep
 * full card width"). So the single width — the one an unknown kind draws at —
 * is the repeated width in EVERY cell of the matrix below. That is the ruling,
 * and it is pinned as an equality in every cell rather than left as a
 * discrimination the design deliberately removed.
 */
const SINGLE_ROW_CAP = MAX_CARDS_PER_ROW

type Dir = 'DOWN' | 'RIGHT' | 'UP' | 'LEFT'
const DIRS: Dir[] = ['DOWN', 'RIGHT', 'UP', 'LEFT']

/** A decision + 2 options + `factorCount` factors — factors are the widest tier. */
function graph(
  factorCount: number,
  opts: { lockedFactors?: number; heights?: boolean } = {},
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    { id: 'd1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'D' } },
    { id: 'o1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'O1' } },
    { id: 'o2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'O2' } },
  ]
  for (let i = 0; i < factorCount; i++) {
    const node: Node = {
      id: `f${i}`,
      type: 'factor',
      position: { x: 0, y: 0 },
      data: { label: `F${i}`, ...(i < (opts.lockedFactors ?? 0) ? { locked: true } : {}) },
    }
    if (opts.heights) {
      ;(node as unknown as { measured: { width: number; height: number } }).measured = {
        width: 999,
        height: 40 + i * 37,
      }
    }
    nodes.push(node)
  }
  const edges: Edge[] = nodes
    .filter((n) => n.id !== 'd1')
    .map((n) => ({ id: `e-${n.id}`, source: 'd1', target: n.id }))
  return { nodes, edges }
}

describe('solveLayoutNodeWidth is exact', () => {
  it('equals layoutGraph across directions x widest-tier x spacing x heights', async () => {
    let cells = 0
    let solverMismatches = 0
    let controlDisagreements = 0
    const mismatches: string[] = []

    for (const direction of DIRS) {
      for (let factors = 1; factors <= 12; factors++) {
        for (const spacing of [15, 40, 120]) {
          for (const heights of [false, true]) {
            const { nodes, edges } = graph(factors, { heights })
            const actual = (
              await layoutGraph(nodes, edges, { direction, spacing, layerSpacing: spacing * 1.5 })
            ).layoutNodeWidth
            const solved = solveLayoutNodeWidth(nodes, { direction })

            cells++
            if (solved !== actual) {
              solverMismatches++
              mismatches.push(`${direction} f=${factors} sp=${spacing} h=${heights}: ${actual} vs ${solved}`)
            }
            // S4: every cell is the repeated width (see the header), and none is
            // the retired maximum — counted, so a regression to the old width
            // in ANY cell shows up.
            if (actual !== REPEATED_CARD_W) controlDisagreements++
          }
        }
      }
    }

    expect(cells).toBe(DIRS.length * 12 * 3 * 2)
    expect(mismatches).toEqual([])
    expect(solverMismatches).toBe(0)
    expect(controlDisagreements, 'a cell drew at a width other than the ruled repeated width').toBe(0)
    expect(REPEATED_CARD_W).not.toBe(NODE_CARD_MAX_W)
  }, 300_000)

  it('honours preserveLocked the same way layoutGraph does', async () => {
    // `SINGLE_ROW_CAP + 3` factors, 3 locked. With preserveLocked the unlocked
    // factor tier is exactly the cap (one row); without it, three more (it
    // wraps). Under S4 that changes the PACKING, not the width — so the
    // parameter is observed through the rows, and the width is pinned equal in
    // both arms, with the solver agreeing with the layout in each.
    const { nodes, edges } = graph(SINGLE_ROW_CAP + 3, { lockedFactors: 3 })
    const withLock = await layoutGraph(nodes, edges, { direction: 'DOWN', preserveLocked: true })
    const withoutLock = await layoutGraph(nodes, edges, { direction: 'DOWN', preserveLocked: false })

    // Locked nodes keep their saved position on write-back in BOTH arms, so the
    // rows are read over the UNLOCKED factors only.
    const unlockedFactorRows = (out: { nodes: Node[] }) =>
      new Set(
        out.nodes
          .filter((n) => n.type === 'factor' && (n.data as { locked?: boolean }).locked !== true)
          .map((n) => n.position.y),
      ).size
    // PIN THE PRECONDITION IN-TEST (CLAUDE.md trap 13b): the two arms really do
    // differ, or this test cannot observe the parameter at all.
    expect(unlockedFactorRows(withLock), 'the locked arm lays out the cap: one row').toBe(1)
    expect(unlockedFactorRows(withoutLock), 'the unlocked arm is above the cap: it wraps').toBe(2)

    expect(withLock.layoutNodeWidth).toBe(REPEATED_CARD_W)
    expect(withoutLock.layoutNodeWidth).toBe(REPEATED_CARD_W)
    expect(solveLayoutNodeWidth(nodes, { direction: 'DOWN', preserveLocked: true })).toBe(
      withLock.layoutNodeWidth,
    )
    expect(solveLayoutNodeWidth(nodes, { direction: 'DOWN', preserveLocked: false })).toBe(
      withoutLock.layoutNodeWidth,
    )
  }, 120_000)

  it('pins the reachable widths, so a silent constants drift is visible here', () => {
    // S4: ONE reachable width in every direction and at every tier size — the
    // cliff between a maximum and a floor is gone by ruling ("split rows keep
    // full card width").
    for (const direction of DIRS) {
      const reachable = new Set<number>()
      for (let f = 1; f <= 12; f++) reachable.add(solveLayoutNodeWidth(graph(f).nodes, { direction }))
      expect([...reachable], direction).toEqual([REPEATED_CARD_W])
    }
    // …at the cap and one above it alike.
    expect(solveLayoutNodeWidth(graph(SINGLE_ROW_CAP).nodes, { direction: 'DOWN' })).toBe(REPEATED_CARD_W)
    expect(solveLayoutNodeWidth(graph(SINGLE_ROW_CAP + 1).nodes, { direction: 'DOWN' })).toBe(REPEATED_CARD_W)
  })

  it('returns the repeated width for an empty / fully locked graph', () => {
    expect(solveLayoutNodeWidth([], { direction: 'DOWN' })).toBe(REPEATED_CARD_W)
    const { nodes } = graph(9, { lockedFactors: 9 })
    const allLocked = nodes.map((n) => ({ ...n, data: { ...(n.data as object), locked: true } }))
    expect(solveLayoutNodeWidth(allLocked, { direction: 'DOWN' })).toBe(REPEATED_CARD_W)
  })
})
