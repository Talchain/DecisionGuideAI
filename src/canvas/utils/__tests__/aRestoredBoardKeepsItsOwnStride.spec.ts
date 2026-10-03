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
import { respreadSubFloorRows, solveLayoutCardWidths, solveRestoredCardWidths } from '../layout'
import { LAYOUT_NODE_GAP, LAYOUT_PADDING_X, NODE_LAYOUT_MIN_W } from '../nodeLayoutConstants'

/**
 * Codex's fixture shape. ⚠ S4 (24 Sep 2026) MOVED THE SAVED WIDTH 336 → 140;
 * ⚠ THE LANDING TEXT CAP (27 Sep 2026) MOVED IT 140 → 230.
 *
 * The defect class is "the fresh solver draws WIDER than the stride a saved
 * board's positions leave". Codex's witness was a board saved at a uniform 336
 * reopened when options solved to 440. S4 narrows every repeated card to 260, so
 * a 336 board no longer provokes it — the reproduction control below went RED
 * and said so. The class is still live for any board saved NARROWER than the
 * repeated card (248).
 *
 * ⭐ WHY 230, NOT 140 (Canvas owner, 27 Sep 2026). The cap raised
 * `NODE_LAYOUT_MIN_W` — the card's own CSS floor — 190.88 → 221.12, so a 140
 * board (stride 196) can no longer be drawn without overlap by ANY width: that
 * board is now the sub-floor case, which re-spreads (the second `describe`
 * below). These arms pin the other half of the owner's rule — a board at a
 * FITTING stride keeps it exactly — on a board saved between the floor and the
 * repeated card, where the bound still has to bite. There the unbounded solver
 * eats the saved sibling gap (286 − 248 = 38 < 56) rather than overlapping, so
 * the protective assertions read the gap, `SAVED_GAP`, not zero.
 */
const SAVED_UNIFORM_W = 230
const SAVED_GAP = 56
/**
 * ⚠ 30 SEP 2026: A REAL SAVED STRIDE IS width + ELK padding + gap (`layout.sameRowGap.spec.ts`: the
 * rendered neighbour gap is LAYOUT_PADDING_X + spacing; the served landing stride is 296 = 248 + 24 + 24).
 * This fixture modelled it as width + gap (286). That under-counted the padding, which went unnoticed while
 * the restore cap was `stride − gap`. The cap is now `stride − padding − gap` (a board saved before 30 Sep
 * reopens exactly as saved), so the fixture writes the stride a layout at spacing 56 actually leaves.
 */
const SAVED_STRIDE = SAVED_UNIFORM_W + LAYOUT_PADDING_X + SAVED_GAP // 310

function boardAt(stride: number): Node[] {
  const optionXs = [416, 416 + stride, 416 + 2 * stride]
  return [
    { id: 'd', type: 'decision', position: { x: 800, y: 0 }, data: { label: 'd' } },
    ...optionXs.map((x, i) => ({ id: `o${i}`, type: 'option', position: { x, y: 300 }, data: { label: `o${i}` } })),
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `f${i}`, type: 'factor', position: { x: 200 + i * stride, y: 600 }, data: { label: `f${i}` },
    })),
    { id: 'g', type: 'goal', position: { x: 800, y: 900 }, data: { label: 'g' } },
  ] as Node[]
}

function savedBoard(): Node[] {
  return boardAt(SAVED_STRIDE)
}

/** The narrowest adjacent same-row gap left once each card draws at `w`. */
function worstGap(nodes: Node[], kind: string, w: number): number {
  const xs = nodes.filter((n) => n.type === kind).map((n) => n.position.x).sort((a, b) => a - b)
  let worst = Number.POSITIVE_INFINITY
  for (let i = 1; i < xs.length; i++) worst = Math.min(worst, xs[i] - xs[i - 1] - w)
  return worst
}

/** The board as the restore hook sees it: every card measured (it waits for that). */
function withHeights(nodes: Node[], height = 120): Node[] {
  return nodes.map((n) => ({ ...n, measured: { width: SAVED_UNIFORM_W, height } })) as Node[]
}

describe('a restored board keeps its own stride', () => {
  it('⛔ THE REPRODUCTION: the UNBOUNDED solver eats this saved board\'s gap', () => {
    // The preconditions, pinned in-test: this fixture must be a FITTING board
    // (drawable at its own width) and must still provoke a widening, or the
    // assertion below passes for the wrong reason (trap 13b).
    expect(SAVED_UNIFORM_W, 'the saved width is under the card floor — this is the sub-floor case, not this one').toBeGreaterThanOrEqual(NODE_LAYOUT_MIN_W)
    const fresh = solveLayoutCardWidths(savedBoard(), { direction: 'DOWN', spacing: SAVED_GAP })
    expect(fresh.option, 'the fresh solver no longer widens options past the saved uniform width — this fixture has stopped reproducing the defect').toBeGreaterThan(SAVED_UNIFORM_W)
    expect(worstGap(savedBoard(), 'option', fresh.option)).toBeLessThan(SAVED_GAP)
  })

  it('⭐ THE REPAIR: a board at a fitting stride keeps it — its width and its gap, exactly', () => {
    const nodes = savedBoard()
    const bounded = solveRestoredCardWidths(nodes, { direction: 'DOWN', spacing: SAVED_GAP })
    for (const kind of ['option', 'factor']) {
      expect(worstGap(nodes, kind, bounded[kind]), `${kind} cards lost their saved gap`).toBeGreaterThanOrEqual(SAVED_GAP)
    }
    // ⚠ RE-PINNED 27 Sep 2026 (landing text cap). This read `<= max(140,
    // NODE_LAYOUT_MIN_W)` on the 140 board, where the floor bound. At a fitting
    // stride the bound is the saved width itself, and the re-spread must not
    // touch the board.
    expect(bounded.option).toBe(SAVED_UNIFORM_W)
    const measured = withHeights(nodes)
    expect(respreadSubFloorRows(measured, { spacing: SAVED_GAP }), 'a fitting board was moved').toBe(measured)
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
    const strideFor = (w: number) => w + LAYOUT_PADDING_X + SAVED_GAP
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
    expect(worstGap(nodes, 'option', bounded.option), 'staggered rows lifted the bound and the cards lost their saved gap').toBeGreaterThanOrEqual(SAVED_GAP)
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
    expect(worstGap(nodes, 'option', bounded.option), 'height-staggered cards lifted the bound and lost their saved gap').toBeGreaterThanOrEqual(SAVED_GAP)
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
    expect(worstGap(nodes, 'option', bounded.option), 'a manual stagger with no heights lifted the bound and the cards lost their saved gap').toBeGreaterThanOrEqual(SAVED_GAP)
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
    expect(worstGap(nodes, 'option', bounded.option)).toBeGreaterThanOrEqual(SAVED_GAP)
  })
})

/**
 * ⭐⭐ NO OVERLAP BEATS AN OLD STRIDE — A SUB-FLOOR ROW RE-SPREADS (Canvas owner,
 * 27 Sep 2026, canvas/landing-text-cap).
 *
 * The landing text cap raised `NODE_LAYOUT_MIN_W` — the narrowest a card can
 * draw — 190.88 → 221.12. A board saved before 17 Aug at a 196 stride (140
 * cards, 56 gap) then overlaps by 25.12 on reopen, however narrow the width
 * record says the card is: no width repairs it. The owner's rule: a row whose
 * saved stride is below the minimum card plus the sibling gap is re-spread to
 * the minimum workable stride, about its own saved centre, in its saved order,
 * every y kept. Rows that fit — hand-moved cards in them included — stay exactly
 * as saved (the `describe` above).
 */
describe('a sub-floor restored row re-spreads to the minimum workable stride', () => {
  const SUB_FLOOR_STRIDE = 196 // the pre-17-Aug board: 140 + 56
  const opts = { spacing: SAVED_GAP }
  const MIN_STRIDE = Math.ceil(NODE_LAYOUT_MIN_W + SAVED_GAP) // 278
  const subFloor = () => withHeights(boardAt(SUB_FLOOR_STRIDE))
  const row = (nodes: Node[], kind: string) =>
    nodes.filter((n) => n.type === kind).sort((a, b) => a.position.x - b.position.x)
  const centre = (r: Node[]) => (r[0].position.x + r[r.length - 1].position.x) / 2

  it('⛔ THE REPRODUCTION: kept at its saved stride, no drawable width clears it', () => {
    const nodes = subFloor()
    expect(SUB_FLOOR_STRIDE, 'the fixture is no longer below the floor + gap — it cannot reproduce').toBeLessThan(NODE_LAYOUT_MIN_W + SAVED_GAP)
    const bounded = solveRestoredCardWidths(nodes, { direction: 'DOWN', ...opts })
    expect(bounded.option).toBeGreaterThanOrEqual(NODE_LAYOUT_MIN_W)
    expect(worstGap(nodes, 'option', bounded.option)).toBeLessThan(0)
  })

  it('⭐ THE RULE: 0 overlaps, and each row keeps its order, its centre and its y', () => {
    const saved = subFloor()
    const out = respreadSubFloorRows(saved, opts)
    const bounded = solveRestoredCardWidths(out, { direction: 'DOWN', ...opts })
    for (const kind of ['option', 'factor']) {
      expect(worstGap(out, kind, bounded[kind]), `${kind} cards still overlap after the re-spread`).toBeGreaterThanOrEqual(0)
      const before = row(saved, kind)
      const after = row(out, kind)
      expect(after.map((n) => n.id), `${kind} order changed`).toEqual(before.map((n) => n.id))
      expect(centre(after), `${kind} row moved off its saved centre`).toBeCloseTo(centre(before), 9)
      for (let i = 1; i < after.length; i++) {
        expect(after[i].position.x - after[i - 1].position.x, `${kind} stride is not the minimum workable one`).toBeCloseTo(MIN_STRIDE, 9)
      }
      for (const n of after) {
        expect(n.position.y, `${n.id} moved in y`).toBe(saved.find((s) => s.id === n.id)!.position.y)
      }
    }
    // A card with no same-row neighbour is not a row: the Question and the Goal stay.
    for (const id of ['d', 'g']) expect(out.find((n) => n.id === id)).toBe(saved.find((n) => n.id === id))
  })

  it('⭐ A FITTING ROW ON THE SAME BOARD — hand-moved card included — stays exactly as saved', () => {
    // Options at the fitting stride, one of them hand-moved 60 towards its
    // neighbour (the median still fits); factors at the sub-floor stride.
    const saved = withHeights(boardAt(SAVED_STRIDE)).map((n) => {
      if (n.type === 'factor') {
        const i = Number(n.id.slice(1))
        return { ...n, position: { x: 200 + i * SUB_FLOOR_STRIDE, y: n.position.y } }
      }
      if (n.id === 'o2') return { ...n, position: { x: n.position.x - 60, y: n.position.y } }
      return n
    }) as Node[]
    const out = respreadSubFloorRows(saved, opts)
    for (const n of saved.filter((x) => x.type === 'option')) {
      expect(out.find((x) => x.id === n.id), `fitting-row card ${n.id} was touched`).toBe(n)
    }
    expect(worstGap(out, 'factor', solveRestoredCardWidths(out, { direction: 'DOWN', ...opts }).factor)).toBeGreaterThanOrEqual(0)
  })

  it('⭐ ONCE: a re-spread board reads as fitting on the next restore, so nothing moves again', () => {
    const saved = subFloor()
    const once = respreadSubFloorRows(saved, opts)
    expect(once, 'the sub-floor board was not re-spread at all').not.toBe(saved)
    expect(respreadSubFloorRows(once, opts)).toBe(once)
  })

  it('⛔ NO HEIGHT EVIDENCE, NO MOVE — a row cannot be told from two sub-rows without it', () => {
    const bare = boardAt(SUB_FLOOR_STRIDE)
    expect(respreadSubFloorRows(bare, opts)).toBe(bare)
  })

  it('⛔ A ROW HOLDING A LOCKED CARD STAYS AS SAVED — a locked card does not move', () => {
    const saved = subFloor().map((n) => (n.id === 'o1' ? { ...n, data: { ...(n.data as object), locked: true } } : n)) as Node[]
    const out = respreadSubFloorRows(saved, { ...opts, preserveLocked: true })
    for (const n of saved.filter((x) => x.type === 'option')) expect(out.find((x) => x.id === n.id)).toBe(n)
    // …while the factor row, which holds no locked card, still re-spreads.
    expect(row(out, 'factor')[1].position.x - row(out, 'factor')[0].position.x).toBeCloseTo(MIN_STRIDE, 9)
  })

  /**
   * ⛔⛔ THE DELIVERY LEAD'S PROBE (#2235 r1): ONE FAR-OFF CARD DRAGGED THE WHOLE ROW.
   *
   * The first cut spread every card of a sub-floor row about the midpoint of
   * its FIRST and LAST card. Four cards at the pre-17-Aug 196 stride plus one
   * the user had dragged to x 2,600 put that midpoint at 1,300: the tight cards
   * moved +808 to +958 and the far card was pulled 808 units back across the
   * board. Now the row is cut at every step that already clears the floor, each
   * too-tight run is spread about its MEDIAN card, and a card already clear of
   * its neighbours stays where the user put it. Default spacing, as probed.
   */
  it('⛔ THE DL PROBE: four tight cards and one dragged 2,000 away — the tight cards move only what the floor needs, the far card not at all', () => {
    const TIGHT = [0, 196, 392, 588]
    const FAR_X = 2600
    const saved = withHeights([
      ...TIGHT.map((x, i) => ({ id: `t${i}`, type: 'factor', position: { x, y: 600 }, data: { label: `t${i}` } })),
      { id: 'far', type: 'factor', position: { x: FAR_X, y: 600 }, data: { label: 'far' } },
    ] as Node[])
    const need = NODE_LAYOUT_MIN_W + LAYOUT_NODE_GAP
    const workable = Math.ceil(need)
    // Preconditions: the row IS sub-floor by its median stride (so it is
    // re-spread at all), and the far card's step already clears the floor.
    expect(SUB_FLOOR_STRIDE, 'the tight stride is no longer sub-floor — the probe cannot reproduce').toBeLessThan(need)
    expect(FAR_X - TIGHT[TIGHT.length - 1]).toBeGreaterThanOrEqual(need)

    const out = respreadSubFloorRows(saved)
    expect(out, 'the sub-floor row was not re-spread at all').not.toBe(saved)
    expect(out.find((n) => n.id === 'far'), 'the far card was moved from where the user put it').toBe(saved.find((n) => n.id === 'far'))
    // The most any tight card has to move to reach the workable stride about
    // the run's own middle: half the run's growth.
    const floorNeeds = ((TIGHT.length - 1) / 2) * (workable - SUB_FLOOR_STRIDE)
    const after = TIGHT.map((_, i) => out.find((n) => n.id === `t${i}`)!.position.x)
    after.forEach((x, i) => {
      expect(Math.abs(x - TIGHT[i]), `t${i} moved ${x - TIGHT[i]}, more than the floor requires (${floorNeeds})`).toBeLessThanOrEqual(floorNeeds + 1e-9)
    })
    for (let i = 1; i < after.length; i++) expect(after[i] - after[i - 1], 'the tight run is not at the workable stride').toBeCloseTo(workable, 9)
    expect(FAR_X - after[after.length - 1], 'the tight run now crowds the far card').toBeGreaterThanOrEqual(need)
  })

  it('⛔ A SPREAD RUN THAT WOULD CROWD ITS NEIGHBOUR TAKES IT IN — never an overlap, never a reorder', () => {
    // The same four tight cards, and a fifth only just clear of them (250 ≥
    // floor + gap). Spread alone, the run's last card lands 175 short of it —
    // an overlap the cut must not create. The two are spread as one run.
    const TIGHT = [0, 196, 392, 588]
    const NEAR_X = 588 + 250
    const saved = withHeights([
      ...TIGHT.map((x, i) => ({ id: `t${i}`, type: 'factor', position: { x, y: 600 }, data: { label: `t${i}` } })),
      { id: 'near', type: 'factor', position: { x: NEAR_X, y: 600 }, data: { label: 'near' } },
    ] as Node[])
    const need = NODE_LAYOUT_MIN_W + LAYOUT_NODE_GAP
    expect(NEAR_X - TIGHT[TIGHT.length - 1], 'the fifth card no longer clears the floor on its own — this is the plain case').toBeGreaterThanOrEqual(need)

    const out = respreadSubFloorRows(saved)
    const ordered = [...out].sort((a, b) => a.position.x - b.position.x)
    expect(ordered.map((n) => n.id), 'the saved order changed').toEqual(['t0', 't1', 't2', 't3', 'near'])
    for (let i = 1; i < ordered.length; i++) {
      expect(ordered[i].position.x - ordered[i - 1].position.x, `${ordered[i - 1].id} → ${ordered[i].id} is inside the floor`).toBeGreaterThanOrEqual(need)
    }
  })
})
