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
import { NODE_CARD_MAX_W, NODE_LAYOUT_MIN_W } from '../utils/nodeLayoutConstants'

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
            // NEGATIVE CONTROL — see the header.
            if (actual !== NODE_CARD_MAX_W) controlDisagreements++
          }
        }
      }
    }

    expect(cells).toBe(DIRS.length * 12 * 3 * 2)
    expect(mismatches).toEqual([])
    expect(solverMismatches).toBe(0)
    // The matrix must contain compressed graphs, or the agreement proves nothing.
    expect(controlDisagreements).toBeGreaterThan(cells / 4)
  }, 300_000)

  it('honours preserveLocked the same way layoutGraph does', async () => {
    // 8 factors, 3 locked. With preserveLocked the widest UNLOCKED tier is 5
    // (single-row, MAX); without it, 8 (split, MIN). The two must differ, or
    // this test cannot observe the parameter at all.
    const { nodes, edges } = graph(8, { lockedFactors: 3 })
    const withLock = await layoutGraph(nodes, edges, { direction: 'DOWN', preserveLocked: true })
    const withoutLock = await layoutGraph(nodes, edges, { direction: 'DOWN', preserveLocked: false })

    expect(withLock.layoutNodeWidth).not.toBe(withoutLock.layoutNodeWidth)
    expect(solveLayoutNodeWidth(nodes, { direction: 'DOWN', preserveLocked: true })).toBe(
      withLock.layoutNodeWidth,
    )
    expect(solveLayoutNodeWidth(nodes, { direction: 'DOWN', preserveLocked: false })).toBe(
      withoutLock.layoutNodeWidth,
    )
  }, 120_000)

  it('pins the reachable widths, so a silent constants drift is visible here', () => {
    const down = new Set<number>()
    for (let f = 1; f <= 12; f++) down.add(solveLayoutNodeWidth(graph(f).nodes, { direction: 'DOWN' }))
    expect([...down].sort((a, b) => a - b)).toEqual([NODE_LAYOUT_MIN_W, NODE_CARD_MAX_W])
    // The DOWN cliff: a widest tier of 6 stays at max, 7 compresses.
    expect(solveLayoutNodeWidth(graph(6).nodes, { direction: 'DOWN' })).toBe(NODE_CARD_MAX_W)
    expect(solveLayoutNodeWidth(graph(7).nodes, { direction: 'DOWN' })).toBe(NODE_LAYOUT_MIN_W)
  })

  it('returns the max width for an empty / fully locked graph', () => {
    expect(solveLayoutNodeWidth([], { direction: 'DOWN' })).toBe(NODE_CARD_MAX_W)
    const { nodes } = graph(9, { lockedFactors: 9 })
    const allLocked = nodes.map((n) => ({ ...n, data: { ...(n.data as object), locked: true } }))
    expect(solveLayoutNodeWidth(allLocked, { direction: 'DOWN' })).toBe(NODE_CARD_MAX_W)
  })
})
