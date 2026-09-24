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

/**
 * Codex's fixture shape. ⚠ S4 (24 Sep 2026) MOVED THE SAVED WIDTH 336 → 140.
 *
 * The defect class is "the fresh solver draws WIDER than the stride a saved
 * board's positions leave". Codex's witness was a board saved at a uniform 336
 * reopened when options solved to 440. S4 narrows every repeated card to 260, so
 * a 336 board no longer provokes it — the reproduction control below went RED
 * and said so. The class is still live for any board saved NARROWER than 260:
 * the pre-17-Aug boards, whose card floor was 140. So the fixture now stands in
 * for one of those, and every case in this file bites again.
 */
const SAVED_UNIFORM_W = 140
const SAVED_GAP = 56
const SAVED_STRIDE = SAVED_UNIFORM_W + SAVED_GAP // 196

function savedBoard(): Node[] {
  const optionXs = [416, 416 + SAVED_STRIDE, 416 + 2 * SAVED_STRIDE]
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

  /**
   * ⛔⛔ THE SECOND DEFECT, AND IT WAS FOUND IN THE FIRST VERSION OF THE FIX.
   *
   * Codex, re-reviewing `a1d120612`: **"exact-y absence is not non-overlap."**
   * The first cut grouped rows by `Math.round(y)`. Real boards do not have an
   * exact shared y — this file's own `normaliseTierRows` speaks of *"preserving
   * ELK's incidental intra-tier Y variation (caused by measured node-height
   * differences)"*. At y 300 / 301 / 302 the three options fell into three
   * single-member rows, no stride was measurable, the bound lifted, and the
   * board overlapped by 48px — **including a genuinely locked middle card**,
   * which is precisely the one that cannot move out of the way.
   *
   * ⚠ NOTE WHAT THE FIRST FIXTURE COULD NOT SEE. Every card in it sat at an
   * exactly equal y, so the grouping bug was invisible to a suite that already
   * had five passing cases — including one specifically about locked cards. A
   * corpus that shares the code's assumption cannot observe the code's defect.
   */
  it('⛔ STAGGERED Y: a row whose cards differ by a pixel is still a row', () => {
    const nodes = savedBoard().map((n) => {
      if (n.type !== 'option') return n
      const idx = Number(n.id.slice(1))
      const staggered = { ...n, position: { x: n.position.x, y: 300 + idx } }
      return idx === 1 ? { ...staggered, data: { ...(staggered.data as object), locked: true } } : staggered
    }) as Node[]
    // Precondition pinned: the ys must genuinely differ, or this is the old case.
    const ys = nodes.filter((n) => n.type === 'option').map((n) => n.position.y)
    expect(new Set(ys).size, 'the fixture no longer staggers y — it cannot reproduce the defect').toBe(3)
    const bounded = solveRestoredCardWidths(nodes, { direction: 'DOWN', spacing: SAVED_GAP })
    expect(worstGap(nodes, 'option', bounded.option), 'staggered rows lifted the bound and the cards overlap').toBeGreaterThanOrEqual(0)
  })

  /**
   * ⛔ THE GAP THE TOLERANCE ALONE LEAVES, closed before a reviewer had to find
   * it. Two cards genuinely on one row can differ in y by MORE than `rowEps` if
   * their heights differ enough — a tall card and a short one, top-aligned
   * differently. The tolerance would then read them as separate rows and lift
   * the bound, which is the same failure as the exact-y one wearing different
   * numbers. Where heights are known, vertical EXTENT OVERLAP answers it
   * outright and needs no tolerance.
   */
  it('⛔ TALL AND SHORT: cards that overlap vertically are one row even beyond the tolerance', () => {
    const nodes = savedBoard().map((n) => {
      if (n.type !== 'option') return n
      const idx = Number(n.id.slice(1))
      // 60px apart — beyond rowEps (43) — but 300px tall, so plainly one row.
      return { ...n, position: { x: n.position.x, y: 300 + idx * 60 }, measured: { width: 336, height: 300 } }
    }) as Node[]
    const ys = nodes.filter((n) => n.type === 'option').map((n) => n.position.y)
    expect(Math.max(...ys) - Math.min(...ys), 'the fixture no longer exceeds the tolerance — it cannot reproduce the gap').toBeGreaterThan(Math.round(72 * 0.6))
    const bounded = solveRestoredCardWidths(nodes, { direction: 'DOWN', spacing: SAVED_GAP })
    expect(worstGap(nodes, 'option', bounded.option), 'height-staggered cards lifted the bound and overlap').toBeGreaterThanOrEqual(0)
  })

  /**
   * ⛔⛔ CODEX'S P2 ON #1608, CLOSED HERE. Its words: absent height metadata plus a
   * larger manual stagger can still overlap at restore.
   *
   * The old fallback was a 43px tolerance derived from the smallest separation two
   * genuine SUB-ROWS can have. That argument covers incidental variation — a few
   * pixels of differing card height — and says nothing about a reader DRAGGING a
   * card, which has no bound. At 70px of stagger with no heights, the row read as
   * three rows, the bound lifted, and the cards overlapped by the same 48px.
   *
   * ⭐ With no height evidence there is nothing to discriminate on, so the answer
   * is the safe one: same tier, same row.
   */
  it('⛔ NO HEIGHTS + a MANUAL stagger beyond the old tolerance: still one row', () => {
    const nodes = savedBoard().map((n) => {
      if (n.type !== 'option') return n
      const idx = Number(n.id.slice(1))
      // 70px apart — well beyond the retired 43px tolerance — and NO `measured`.
      return { ...n, position: { x: n.position.x, y: 300 + idx * 70 } }
    }) as Node[]
    const ys = nodes.filter((n) => n.type === 'option').map((n) => n.position.y)
    expect(Math.max(...ys) - Math.min(...ys), 'the stagger no longer exceeds the retired tolerance — cannot reproduce').toBeGreaterThan(Math.round(72 * 0.6))
    expect(nodes.filter((n) => n.type === 'option').every((n) => (n as { measured?: unknown }).measured === undefined),
      'the fixture carries measured heights, so it is testing the OTHER branch').toBe(true)
    const bounded = solveRestoredCardWidths(nodes, { direction: 'DOWN', spacing: SAVED_GAP })
    expect(worstGap(nodes, 'option', bounded.option), 'a manual stagger with no heights lifted the bound and the cards overlap').toBeGreaterThanOrEqual(0)
  })

  /**
   * ⛔⛔ THE CONTRAST CODEX ASKED FOR, AND THE CASE MY SUITE NEVER HAD.
   *
   * Every earlier fixture either carried NO heights, or carried heights that DID
   * overlap. "Known heights, genuinely separate rows" is the one combination I
   * never wrote — and it is exactly what the fall-through broke: `shareARow`
   * returned true even when the measurements PROVED no overlap, so real sub-rows
   * merged and their cards shrank for nothing (measured 440 -> 336 at y 300 /
   * 1000 / 1700 with 100px cards).
   *
   * ⭐ Evidence wins in BOTH directions. The conservative "same row" answer is
   * for the ABSENCE of evidence; it must never override evidence that exists.
   */
  it('⭐ MEASURED AND SEPARATE: known heights that prove no overlap are NOT one row', () => {
    const nodes = savedBoard().map((n) => {
      if (n.type !== 'option') return n
      const idx = Number(n.id.slice(1))
      // ⚠ X MUST STILL DIFFER. A first version put all three at one x; the stride
      // is then 0, `solveRestoredCardWidths` skips the pair outright, and the
      // whole test passed WITHOUT EVER CALLING `shareARow`. The mutant survived
      // and the survival was the finding — a fixture satisfied by a path that
      // does not involve the code under test.
      return { ...n, position: { x: n.position.x, y: 300 + idx * 700 }, measured: { width: 336, height: 100 } }
    }) as Node[]
    // Preconditions, pinned: heights present, rows genuinely separated, AND a
    // measurable stride, or the assertion below is vacuous.
    const opts = nodes.filter((n) => n.type === 'option')
    expect(opts.every((n) => (n as { measured?: { height?: number } }).measured?.height === 100),
      'the fixture lost its heights — it would be testing the no-evidence branch').toBe(true)
    const ys = opts.map((n) => n.position.y).sort((a, b) => a - b)
    expect(ys[1] - ys[0], 'the rows are not separated by more than a card height — cannot reproduce').toBeGreaterThan(100)
    const xs = [...new Set(opts.map((n) => n.position.x))]
    expect(xs.length, 'every option sits at the same x, so no stride is measurable and this asserts nothing').toBeGreaterThan(1)

    const bounded = solveRestoredCardWidths(nodes, { direction: 'DOWN', spacing: SAVED_GAP })
    const fresh = solveLayoutCardWidths(nodes, { direction: 'DOWN', spacing: SAVED_GAP })
    expect(bounded.option,
      'measured-separate rows were merged, so the option cards were needlessly narrowed').toBe(fresh.option)
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
