/**
 * ⭐⭐ THE WORKLIST MUST FOLLOW THE MODEL, NOT ONLY THE GESTURE.
 *
 * Two defects, both measured by an independent reviewer on `cbb934ec` — the
 * head that had already fixed the *initial* count, filter and ring:
 *
 *   1. A top-level `display_value` arriving on a factor with NO observed state
 *      moved the PURE builder's count to 1 and left the MOUNTED toggle saying
 *      2. `stripNodeValueSignature` returned `''` whenever observed state was
 *      absent, so the memo never recomputed.
 *   2. Starting from the open no-value worklist over `f_a`/`f_b`, a user value
 *      on `f_a` moved the count and the panel's marks to `[f_b]` while the
 *      canvas went on ringing BOTH. Every ring write hung off a gesture.
 *
 * ⚠⚠ WHY THE AUTHOR'S 21/21 COULD NOT SEE EITHER, AND IT IS THE WHOLE REASON
 * THIS FILE EXISTS. The sibling suites mock the store as
 * `(select) => select(read())` — a plain function call with NO subscription.
 * Mutating the node array under that mock triggers no re-render at all, so a
 * memo that never recomputes is INDISTINGUISHABLE from one that recomputes
 * correctly. The harness was structurally incapable of observing a staleness
 * defect, and it reported 21/21 while both defects were live. This file uses a
 * REAL zustand store and REPLACES the node array immutably, which is the
 * mechanism under test (CLAUDE.md trap 13 — an instrument that cannot fail).
 *
 * ⚠ V2 (Paul, 25 Sep 2026): the no-value chip left the strip. Defect 1 is now
 * read off the detail's value line (same memo); defect 2 off the Factors row's
 * ring (same reconcile effect). The claims are unchanged.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

type Node = { id: string; type: string; data: Record<string, unknown>; x?: number; y?: number }

/**
 * ⚠ `vi.hoisted`, NOT A TOP-LEVEL CONST. `vi.mock` factories are hoisted above
 * every import, so a factory closing over a module-scope `store` throws
 * "Cannot access 'store' before initialization" and the file collects ZERO
 * tests — which vitest reports as a failed SUITE, not as failed assertions.
 * (CLAUDE.md 2b: a spec that collects nothing is invisible to every aggregate.)
 */
const h = await vi.hoisted(async () => {
  const { create } = await import('zustand')
  type MockState = {
    nodes: Node[]
    highlighted: string[]
    setHighlightedNodes: (ids: string[]) => void
  }
  const store = create<MockState>((set) => ({
    nodes: [],
    highlighted: [],
    setHighlightedNodes: (ids: string[]) => set({ highlighted: [...ids] }),
  }))
  const ringWrites: string[][] = []
  store.subscribe((s, prev) => {
    if (s.highlighted !== prev.highlighted) ringWrites.push(s.highlighted)
  })
  return { store, ringWrites }
})

vi.mock('../../../../canvas/store', () => ({ useCanvasStore: h.store }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: () => true }))
vi.mock('../../../../canvas/utils/highlightHelpers', () => ({
  highlightNode: vi.fn(),
  clearHighlight: () => h.store.getState().setHighlightedNodes([]),
}))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))

import { ModelStrip } from '../sections/ModelStrip'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'

const TID = 'analysis-new-model-strip'
const bare = (id: string, label: string): Node => ({ id, type: 'factor', data: { label }, x: 0, y: 0 })

/**
 * Immutable replacement — a mutation in place would not move the selector.
 *
 * ⚠ INSIDE `act`. A bare `setState` reaches the store but React never flushes
 * the resulting render before the assertion, so EVERY case reads the mount's
 * previous text — including the ones that should pass. The opposite control
 * caught this: it failed identically to the defect cases, which is a probe
 * reporting on itself, not a finding (CLAUDE.md trap 13).
 */
const setNodes = (nodes: Node[]) => act(() => { h.store.setState({ nodes }) })

/**
 * The detail's value line for one factor, pinned by activating its mark.
 *
 * ⚠ RE-POINTED FOR V2 (Paul, 25 Sep 2026). These cases read the no-value
 * CHIP's count, and the chip left the strip. The defect is unchanged: a memo
 * that never recomputes. The detail's value line comes out of the same memo,
 * so it goes stale in exactly the same way.
 */
const valueLine = (nodeId: string) => {
  const mark = screen
    .getAllByTestId(`${TID}-mark`)
    .find((el) => el.getAttribute('data-node-id') === nodeId)!
  fireEvent.click(mark)
  const detail = screen.getByTestId(`${TID}-detail`)
  // PRECONDITION: the detail belongs to THIS factor, not the last one picked.
  expect(detail).toHaveAttribute('data-node-id', nodeId)
  return screen.getByTestId(`${TID}-detail-value-text`)
}
const markIds = () =>
  screen.queryAllByTestId(`${TID}-mark`).map((el) => el.getAttribute('data-node-id'))
/** The Factors row control — the one narrowing the strip still offers. */
const factorRow = () =>
  screen
    .getAllByTestId(`${TID}-row-filter`)
    .find((el) => el.getAttribute('data-kind') === 'factor')!
const lastRing = () => h.ringWrites[h.ringWrites.length - 1]

beforeEach(() => {
  h.ringWrites.length = 0
  h.store.setState({ nodes: [], highlighted: [] })
})
afterEach(cleanup)

describe('the mounted strip follows the live model', () => {
  it('sees a TOP-LEVEL display_value arrive on a factor with no observed state', () => {
    setNodes([bare('f_a', 'Alpha'), bare('f_b', 'Beta')])
    render(<ModelStrip isPreRun />)
    expect(valueLine('f_a')).toHaveAttribute('data-has-value', 'false')
    expect(valueLine('f_a')).toHaveTextContent(COPY.modelStrip.noValue)

    // Olumi's estimate: `display_value` at the TOP LEVEL, no observed state.
    setNodes([
      { ...bare('f_a', 'Alpha'), data: { label: 'Alpha', display_value: '0.25 to 0.75' } },
      bare('f_b', 'Beta'),
    ])
    expect(valueLine('f_a')).toHaveAttribute('data-has-value', 'true')
    expect(valueLine('f_a')).toHaveTextContent('0.25 to 0.75')
  })

  /**
   * ⭐ THE OPPOSITE CONTROL. The same text inside `observedState` was ALREADY
   * visible to the old signature, so this case passes with the defect present.
   * It is here to prove the harness can observe an update at all — without it,
   * the case above could be failing because the mount never updates for ANY
   * reason, which is a different (and much larger) claim.
   */
  it('CONTROL: the same text inside observedState also updates the value line', () => {
    setNodes([bare('f_a', 'Alpha'), bare('f_b', 'Beta')])
    render(<ModelStrip isPreRun />)
    expect(valueLine('f_a')).toHaveAttribute('data-has-value', 'false')

    setNodes([
      {
        ...bare('f_a', 'Alpha'),
        data: { label: 'Alpha', observedState: { display_value: '0.25 to 0.75' } },
      },
      bare('f_b', 'Beta'),
    ])
    expect(valueLine('f_a')).toHaveAttribute('data-has-value', 'true')
    expect(valueLine('f_a')).toHaveTextContent('0.25 to 0.75')
  })

  /**
   * ⚠ RE-POINTED FOR V2. The reconcile was witnessed through the no-value
   * worklist, which left with its chip. The same effect keeps the Factors
   * row's ring in step with the model, so the membership change here is a
   * factor leaving the canvas while that row is selected.
   */
  it('re-rings the canvas when the selected row loses a member', () => {
    setNodes([bare('f_a', 'Alpha'), bare('f_b', 'Beta')])
    render(<ModelStrip isPreRun />)
    fireEvent.click(factorRow())
    expect(lastRing()).toEqual(['f_a', 'f_b'])

    setNodes([bare('f_b', 'Beta')])
    expect(markIds()).toEqual(['f_b'])
    expect(lastRing()).toEqual(['f_b'])
  })

  /**
   * ⭐ THE OPPOSITE CONTROL FOR THE RECONCILE. A drag changes `x`/`y` and
   * nothing the strip renders; the signature ignores position on purpose. If
   * this fired, the reconcile would be writing the canvas channel on every
   * store change — a much worse defect than the one being fixed.
   */
  it('CONTROL: a position-only move rewrites nothing', () => {
    setNodes([bare('f_a', 'Alpha'), bare('f_b', 'Beta')])
    render(<ModelStrip isPreRun />)
    fireEvent.click(factorRow())
    const before = h.ringWrites.length

    setNodes([
      { ...bare('f_a', 'Alpha'), x: 400, y: 250 },
      { ...bare('f_b', 'Beta'), x: 90, y: 10 },
    ])
    expect(h.ringWrites.length).toBe(before)
    expect(lastRing()).toEqual(['f_a', 'f_b'])
  })

  /**
   * ⭐⭐ THE DISCRIMINATING PAIR FOR THE HOVER GUARD — and it took both halves
   * to get the guard right. A boolean "a mark owns the ring" passed the first
   * half and STRANDED the second: when the node you are pointing at leaves the
   * narrowing, its own mark goes with it, so no `mouseLeave` ever arrives on
   * it, the flag stayed set forever, and the canvas kept the obsolete pair
   * until the reader made another gesture. One case alone would have shipped
   * that.
   */
  it('DEFERS while the hovered mark survives the change, then lands it on leave', () => {
    setNodes([bare('f_a', 'Alpha'), bare('f_b', 'Beta')])
    render(<ModelStrip isPreRun />)
    fireEvent.click(factorRow())

    // Point at `f_b` — the one that will STILL be in the row afterwards.
    const surviving = screen.getAllByTestId(`${TID}-mark`)[1]
    expect(surviving).toHaveAttribute('data-node-id', 'f_b')
    fireEvent.mouseEnter(surviving)
    const duringHover = h.ringWrites.length

    setNodes([bare('f_b', 'Beta')])
    // The mark under the cursor is untouched: nothing is written while it owns
    // the channel.
    expect(h.ringWrites.length).toBe(duringHover)

    fireEvent.mouseLeave(surviving)
    expect(lastRing()).toEqual(['f_b'])
  })

  it('reconciles IMMEDIATELY when the hovered mark is the one that leaves', () => {
    setNodes([bare('f_a', 'Alpha'), bare('f_b', 'Beta')])
    render(<ModelStrip isPreRun />)
    fireEvent.click(factorRow())

    // Point at `f_a` — the one about to leave the row. Its mark goes with the
    // change, so no leave event can ever arrive to reconcile.
    const leaving = screen.getAllByTestId(`${TID}-mark`)[0]
    expect(leaving).toHaveAttribute('data-node-id', 'f_a')
    fireEvent.mouseEnter(leaving)

    setNodes([bare('f_b', 'Beta')])
    expect(lastRing()).toEqual(['f_b'])
  })
})

describe('a label-only rename reaches the mounted strip (Codex 5808182879)', () => {
  it('the factor mark names the NEW label; drag-only moves change nothing', () => {
    const f = { ...bare('f_v', 'Vendor cost'), data: { label: 'Vendor cost', observedState: { value: 0.49, source: 'cee_inference' } } }
    setNodes([f])
    render(<ModelStrip isPreRun />)
    expect(screen.getByRole('button', { name: 'Show Vendor cost on the canvas' }), 'PRECONDITION').toBeInTheDocument()
    setNodes([{ ...f, data: { ...f.data, label: 'Annual platform cost' } }])
    expect(screen.getByRole('button', { name: 'Show Annual platform cost on the canvas' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show Vendor cost on the canvas' })).toBeNull()
  })
})
