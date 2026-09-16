/**
 * ⭐⭐ A RESTORED BOARD MAY ONLY DRAW AS WIDE AS ITS OWN SAVED STRIDE.
 *
 * ## The defect, found by independent review and reproduced here by execution
 *
 * Codex, 16 Sep 2026, reviewing #1608 at `c2c796e38`. `useRestoredLayoutWidth`
 * exists to NARROW a restored card to the stride beneath it — cards laid out at
 * 230px came back at the 320px maximum and overlapped. Per-tier widths inverted
 * that direction: `solveLayoutCardWidths` answers *"how wide would a FRESH
 * layout draw this tier"*, and that can exceed the uniform width a saved board
 * was actually laid out at. **The hook that repaired overlap began to cause it.**
 *
 *     3 options, saved uniform width 336, x = 416 / 808 / 1200
 *     saved gap        56px
 *     restored at 440  gap becomes  -48px          ← 48px of overlap, on reopen
 *
 * ⭐ AND THE HOOK'S HEADER STATES THE MECHANISM ONE CASE EARLIER, which is the
 * part worth keeping: explaining why a layout that has run must win, it says a
 * width derived against unmoved positions *"would cause the very overlap it
 * exists to remove"*. The per-kind limb was added four lines below that sentence
 * without applying it to itself.
 *
 * ## Why these three cases and not one
 *
 * The bound could be satisfied by simply reverting per-tier widths, so a test
 * that only checks "no overlap" cannot tell a repair from a revert. The fresh
 * control is what separates them, and the locked case pins the promise the hook
 * makes about never moving anything.
 */
import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import { solveLayoutCardWidths, solveRestoredCardWidths } from '../layout'

/** Codex's fixture, at the numbers its executed witness reported. */
const SAVED_UNIFORM_W = 336
const SAVED_GAP = 56
const SAVED_STRIDE = SAVED_UNIFORM_W + SAVED_GAP // 392

function savedBoard(): Node[] {
  const optionXs = [416, 808, 1200]
  return [
    { id: 'd', type: 'decision', position: { x: 800, y: 0 }, data: { label: 'd' } },
    ...optionXs.map((x, i) => ({ id: `o${i}`, type: 'option', position: { x, y: 300 }, data: { label: `o${i}` } })),
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `f${i}`, type: 'factor', position: { x: 200 + i * SAVED_STRIDE, y: 600 }, data: { label: `f${i}` },
    })),
    { id: 'g', type: 'goal', position: { x: 800, y: 900 }, data: { label: 'g' } },
  ] as Node[]
}

/** The narrowest adjacent same-row gap left once each card draws at `w`. */
function worstGap(nodes: Node[], kind: string, w: number): number {
  const xs = nodes.filter((n) => n.type === kind).map((n) => n.position.x).sort((a, b) => a - b)
  let worst = Number.POSITIVE_INFINITY
  for (let i = 1; i < xs.length; i++) worst = Math.min(worst, xs[i] - xs[i - 1] - w)
  return worst
}

describe('a restored board keeps its own stride', () => {
  it('⛔ THE REPRODUCTION: the UNBOUNDED solver overlaps this saved board', () => {
    // The precondition, pinned in-test: this fixture must actually provoke a
    // widening, or the assertion below passes for the wrong reason (trap 13b).
    const fresh = solveLayoutCardWidths(savedBoard(), { direction: 'DOWN', spacing: SAVED_GAP })
    expect(fresh.option, 'the fresh solver no longer widens options past the saved uniform width — this fixture has stopped reproducing the defect').toBeGreaterThan(SAVED_UNIFORM_W)
    expect(worstGap(savedBoard(), 'option', fresh.option)).toBeLessThan(0)
  })

  it('⭐ THE REPAIR: no same-row gap goes negative on the restored board', () => {
    const nodes = savedBoard()
    const bounded = solveRestoredCardWidths(nodes, { direction: 'DOWN', spacing: SAVED_GAP })
    for (const kind of ['option', 'factor']) {
      expect(worstGap(nodes, kind, bounded[kind]), `${kind} cards overlap their own saved row`).toBeGreaterThanOrEqual(0)
    }
    expect(bounded.option).toBeLessThanOrEqual(SAVED_UNIFORM_W)
  })

  it('⭐ A TIER WITH NO SAME-ROW NEIGHBOUR IS NOT BOUNDED — it cannot overlap one', () => {
    const nodes = savedBoard()
    const fresh = solveLayoutCardWidths(nodes, { direction: 'DOWN', spacing: SAVED_GAP })
    const bounded = solveRestoredCardWidths(nodes, { direction: 'DOWN', spacing: SAVED_GAP })
    // decision and goal are one card each on every shipped starter, and that is
    // where most of the visible widening lives.
    expect(bounded.decision).toBe(fresh.decision)
    expect(bounded.goal).toBe(fresh.goal)
  })

  it('⛔ CONTRAST — THE FRESH CONTROL: a board saved AT the per-tier widths keeps them', () => {
    // Otherwise the "repair" is a revert wearing a bound. Same graph, but its
    // positions were written by a layout that already used the wider cards.
    const wide = solveLayoutCardWidths(savedBoard(), { direction: 'DOWN', spacing: SAVED_GAP })
    const strideFor = (w: number) => w + SAVED_GAP
    const nodes = savedBoard().map((n) => {
      if (n.type !== 'option' && n.type !== 'factor') return n
      const w = n.type === 'option' ? wide.option : wide.factor
      const idx = Number(n.id.slice(1))
      return { ...n, position: { x: 200 + idx * strideFor(w), y: n.position.y } }
    }) as Node[]
    const bounded = solveRestoredCardWidths(nodes, { direction: 'DOWN', spacing: SAVED_GAP })
    expect(bounded.option, 'a board already saved at the per-tier widths lost them on reopen — this is a revert, not a bound').toBe(wide.option)
    expect(worstGap(nodes, 'option', bounded.option)).toBeGreaterThanOrEqual(0)
  })

  it('⛔ LOCKED AND MANUAL POSITIONS: the solver returns widths only, and moves nothing', () => {
    const nodes = savedBoard().map((n) => (n.id === 'o1' ? { ...n, data: { ...(n.data as object), locked: true } } : n)) as Node[]
    const before = JSON.stringify(nodes.map((n) => n.position))
    solveRestoredCardWidths(nodes, { direction: 'DOWN', spacing: SAVED_GAP })
    expect(JSON.stringify(nodes.map((n) => n.position)), 'the restore solver mutated a node position').toBe(before)
  })

  /**
   * ⛔⛔ THE FIRST VERSION OF THIS TEST WAS A TAUTOLOGY AND A MUTANT CAUGHT IT.
   *
   * It marked the middle option `draggable: false`. `isUnlocked` reads
   * `data.locked !== true` — so the node was never locked, the "exclude locked
   * nodes from the stride measurement" mutant changed nothing, and the test
   * **SURVIVED it while claiming to be about locked cards**. A guard agreeing
   * with itself (CLAUDE.md trap 13b), caught only because the mutant was run.
   *
   * Locking by the predicate the code actually uses, the mutant REDs: with `o1`
   * excluded the row reads as x 416 and 1200, a stride of 784, so the bound
   * lifts to 728 and the middle card — the one that cannot move out of the way —
   * is overlapped by 48px.
   */
  it('⛔ A LOCKED CARD STILL COUNTS AS A NEIGHBOUR when measuring the stride', () => {
    const nodes = savedBoard().map((n) => (n.id === 'o1' ? { ...n, data: { ...(n.data as object), locked: true } } : n)) as Node[]
    // The precondition, pinned: this node must be locked BY THE PREDICATE THE
    // SOLVER USES, or the assertion below is about an ordinary node.
    expect((nodes.find((n) => n.id === 'o1')?.data as { locked?: boolean }).locked).toBe(true)
    const bounded = solveRestoredCardWidths(nodes, { direction: 'DOWN', spacing: SAVED_GAP, preserveLocked: true })
    expect(worstGap(nodes, 'option', bounded.option)).toBeGreaterThanOrEqual(0)
  })
})
