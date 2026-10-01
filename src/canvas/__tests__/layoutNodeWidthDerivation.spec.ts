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
  REPEATED_CARD_MAX_W,
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
    const widthByGraph = new Map<string, number>()
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
            // 30 Sep 2026 (Paul, "wider and shorter"): a tier's width is its fair share of
            // ROW_BUDGET_W, so cells legitimately differ by tier SIZE and DIRECTION, but
            // NEVER by spacing or heights: the width is a function of the graph alone.
            // Counted, so a cell that takes spacing or heights into account shows up.
            const key = `${direction} f=${factors}`
            const seen = widthByGraph.get(key)
            if (seen === undefined) widthByGraph.set(key, actual)
            else if (seen !== actual) controlDisagreements++
            if (actual < REPEATED_CARD_W || actual > REPEATED_CARD_MAX_W) controlDisagreements++
          }
        }
      }
    }

    expect(cells).toBe(DIRS.length * 12 * 3 * 2)
    expect(mismatches).toEqual([])
    expect(solverMismatches).toBe(0)
    expect(controlDisagreements, 'a cell\'s width moved with spacing or heights, or left [REPEATED_CARD_W, REPEATED_CARD_MAX_W]').toBe(0)
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

    // 30 Sep 2026: the width now follows the PACKING too. The locked arm's one row of five takes
    // floor((1656 − 56 − 4 × 24) / 5) − 24 = 276 (Paul 1 Oct: the prompt slot is 24 + 32), and the unlocked arm's 4 + 4 wrap takes
    // min(358, brick floor((1656 − 3.5 × 24) / 4.5) − 24 = 325) = 325.
    expect(withLock.layoutNodeWidth).toBe(276)
    expect(withoutLock.layoutNodeWidth).toBe(325)
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
    // 30 Sep 2026 (the fair-share rule): the reachable widths per direction, in first-seen order for 1..12
    // factors. DOWN wraps (≤5 per row, brick-bounded) and reserves the 88 prompt slot:
    //   1–3 → 400 (cap) · 4 → 358 · 5 → 276 · 7,8,11,12 (4-wide wraps) → 325 · 9,10 (5-wide wraps) → 257.
    //   (350 / 270 before Paul's 1 Oct half-size row-end prompt, 64 → 32.)
    // RIGHT/UP/LEFT never wrap or reserve a prompt: 1–3 → 400 · 4 → 372 · 5 → 288 · ≥6 → the 248 floor.
    const EXPECTED: Record<string, number[]> = {
      DOWN: [400, 358, 276, 325, 257],
      RIGHT: [400, 372, 288, REPEATED_CARD_W],
      UP: [400, 372, 288, REPEATED_CARD_W],
      LEFT: [400, 372, 288, REPEATED_CARD_W],
    }
    for (const direction of DIRS) {
      const reachable = new Set<number>()
      for (let f = 1; f <= 12; f++) reachable.add(solveLayoutNodeWidth(graph(f).nodes, { direction }))
      expect([...reachable], direction).toEqual(EXPECTED[direction])
    }
    // …at the cap and one above it: five in one row, six wrapping 3 + 3 at the 400 cap.
    expect(solveLayoutNodeWidth(graph(SINGLE_ROW_CAP).nodes, { direction: 'DOWN' })).toBe(276)
    expect(solveLayoutNodeWidth(graph(SINGLE_ROW_CAP + 1).nodes, { direction: 'DOWN' })).toBe(REPEATED_CARD_MAX_W)
  })

  it('returns the repeated width for an empty / fully locked graph', () => {
    expect(solveLayoutNodeWidth([], { direction: 'DOWN' })).toBe(REPEATED_CARD_W)
    const { nodes } = graph(9, { lockedFactors: 9 })
    const allLocked = nodes.map((n) => ({ ...n, data: { ...(n.data as object), locked: true } }))
    expect(solveLayoutNodeWidth(allLocked, { direction: 'DOWN' })).toBe(REPEATED_CARD_W)
  })
})
