/**
 * ⭐⭐ HALF OF THIS FIX COULD BE REVERTED WITH THE WHOLE SUITE GREEN.
 *
 * The fix for the founder-reported overlap is TWO things:
 *   1. compute `measuredHeightSignature` (`useMeasureThenLayout.ts:84-90`), and
 *   2. **list it in the effect's dependency array** (`:264`).
 *
 * The independent review blocked this PR on exactly that: delete ONLY the dep-array
 * entry and the shipped defect returns — the selector still runs, still produces a
 * fresh string, and the effect still never re-runs. Nothing REDs.
 *
 *   · `useMeasureThenLayout.heightSubscription.spec.tsx` calls `renderHook` ONCE, never
 *     `rerender`s, and never asserts the effect ran — it invokes the captured selectors
 *     by hand. Both its tests are claims about the SELECTOR; neither can observe the
 *     dep array.
 *   · `useMeasureThenLayout.growthCorrection.spec.tsx` assigns a BRAND NEW Map, so the
 *     pre-existing `nodeLookup` dep changes identity and the correction fires whether or
 *     not the new dep is listed.
 *
 * ⚠ AND THE LINE IS LINT-FLAGGED FOR DELETION. `eslint.config.js:231` sets
 * `react-hooks/exhaustive-deps` to `warn`, and `measuredHeightSignature` is referenced
 * NOWHERE in the effect body — precisely the shape that rule reports as an *unnecessary*
 * dependency, and precisely the line a future tidy-up removes. CLAUDE.md trap 11: never
 * merge a fix until reverting it turns something RED. This file is that red.
 *
 * ── HOW IT DISCRIMINATES, AND WHY EVERY OTHER DEP IS HELD STILL ──────────────
 * React Flow MUTATES `nodeLookup` in place. So between the two renders below, this spec
 * changes EXACTLY ONE thing: a node's `measured.height`, inside the SAME Map. The Map
 * reference, `pendingLayout`, `layoutInProgress`, `layoutRequestId`, `storeNodes` and
 * `applyLayout` are all untouched, so `measuredHeightSignature` is the ONLY dep whose
 * value can differ. If it is not listed, React sees no changed dependency, the effect
 * does not re-run, and the call count below does not move.
 *
 * ⛔ THAT IS WHY `pendingLayout` IS NOT TOGGLED. Toggling it would re-run the effect on
 * its own and the test would pass with the dep removed — a guard agreeing with itself.
 *
 * ⚠ Bound by node id (`'opt'`), never by a value predicate the sibling could satisfy.
 * ⚠ jsdom cannot see geometry (CLAUDE.md trap 3). This asserts that the effect RAN, which
 * is the trigger the e2e measures could observe but the unit suite could not.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCanvasStore } from '../store'
import { useMeasureThenLayout } from '../hooks/useMeasureThenLayout'
import { handleLayoutWithRecovery } from '../layout/handleLayoutWithRecovery'

type LookupEntry = { measured?: { width?: number; height?: number } }
type RFState = { nodeLookup: Map<string, LookupEntry>; transform: [number, number, number] }

/** ONE Map, mutated and never replaced — React Flow's real behaviour. */
const lookup = new Map<string, LookupEntry>()
/** The live camera. `transform[2]` is the zoom, exactly as React Flow stores it. */
const transform: [number, number, number] = [0, 0, 1]

/**
 * ⭐⭐ TWO HEIGHT AUTHORITIES, MODELLED SEPARATELY — WHICH IS THE ENTIRE POINT.
 *
 * `lookup` carries the LIVE height, which moves with the camera because the
 * canvas type tokens multiply by `--canvas-label-scale`. `boundHeights` carries
 * what `measureNodeHeightsAtLabelBound()` returns: the height at a CONSTANT
 * scale, which is what `store.ts` passes to the layout and what
 * `utils/layout.ts:609-612` prefers.
 *
 * ⛔ A FIXTURE WITH ONLY ONE OF THESE CANNOT EXPRESS THE DEFECT, and mine had
 * only one. That is why two reviews had to find it instead of this file.
 */
const boundHeights = new Map<string, number>()

vi.mock('@xyflow/react', () => ({
  useNodesInitialized: () => true,
  useStore: <T,>(selector: (s: RFState) => T) => selector({ nodeLookup: lookup, transform }),
}))
vi.mock('../layout/handleLayoutWithRecovery', () => ({
  handleLayoutWithRecovery: vi.fn(),
}))
vi.mock('../utils/measureNodeHeightsAtLabelBound', () => ({
  measureNodeHeightsAtLabelBound: () => new Map(boundHeights),
}))
vi.mock('../../lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const layoutCalls = () => (handleLayoutWithRecovery as unknown as { mock: { calls: unknown[] } }).mock.calls.length

/**
 * ⚠ THE REAL STORE CLEARS `pendingLayout` ONCE A LAYOUT COMMITS, AND THE FIRST
 * VERSION OF THIS FILE DID NOT. Leaving it `true` forever means the ordinary
 * run-now path dispatches on EVERY effect run, so the growth-correction arm —
 * the thing guarded on `!pendingLayout` — was never reached by any test here.
 * The two cases below are about that arm, so they have to emulate the commit.
 */
const settleLayout = () => {
  act(() => { useCanvasStore.setState({ pendingLayout: false } as never) })
}

describe('the dep-array entry is the fix, and removing it REDs here', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    lookup.clear()
    boundHeights.clear()
    boundHeights.set('opt', 160)
    boundHeights.set('fac', 108)
    transform[2] = 1
    lookup.set('opt', { measured: { width: 336, height: 160 } })
    lookup.set('fac', { measured: { width: 336, height: 108 } })
    useCanvasStore.getState().resetCanvas()
    useCanvasStore.setState({
      nodes: [
        { id: 'opt', type: 'option', position: { x: 0, y: 0 }, data: { label: 'opt', kind: 'option' } },
        { id: 'fac', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'fac', kind: 'factor' } },
      ] as never,
      pendingLayout: true,
      layoutInProgress: false,
      layoutVersion: 1,
      layoutRequestId: 1,
    } as never)
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('⭐ THE MUTANT TARGET: a card grown IN PLACE re-runs the layout effect', () => {
    const { rerender } = renderHook(() => useMeasureThenLayout())

    // PRECONDITION, pinned in-test: the first render actually laid out. Without this the
    // assertion below could pass by nothing ever having run (CLAUDE.md trap 13).
    const afterFirst = layoutCalls()
    expect(afterFirst, 'the hook must lay out on first render, or this spec proves nothing').toBeGreaterThan(0)

    // ⚠ THE ONLY CHANGE: one height, inside the SAME Map. Nothing else in the dep array moves.
    const before = lookup.get('opt')!.measured!.height
    lookup.get('opt')!.measured!.height = 260
    expect(lookup.get('opt')!.measured!.height).not.toBe(before) // the mutation applied

    rerender()

    expect(
      layoutCalls(),
      'the effect did not re-run: with `measuredHeightSignature` absent from the dep array, ' +
        'React sees no changed dependency and the card grows under a layout computed for its ' +
        'old height — the founder-reported overlap, exactly',
    ).toBeGreaterThan(afterFirst)
  })

  it('CONTRAST: a rerender that changes NO height does not re-run it — so the trigger is the height, not the render', () => {
    const { rerender } = renderHook(() => useMeasureThenLayout())
    const afterFirst = layoutCalls()
    expect(afterFirst).toBeGreaterThan(0)

    // Same Map, same heights, same everything.
    rerender()

    expect(
      layoutCalls(),
      'a bare rerender must not lay out, or the first test would pass on render count alone',
    ).toBe(afterFirst)
  })

  /**
   * ⛔⛔ THE NEGATIVE CONTROL AN INDEPENDENT REVIEW REQUIRED, AND THE REASON IT
   * IS NOT OPTIONAL.
   *
   * `measured.height` is the card's height AT TODAY'S ZOOM: `CanvasLabelScaleSync`
   * writes `--canvas-label-scale` and every canvas type token multiplies by it.
   * Measured in real Chromium, a card's height moves **×2.05 across the zoom
   * band, 45–315px on individual cards**. The layout does not consume that
   * number — it reserves `heightAtLabelBound`, measured at a CONSTANT scale.
   *
   * So without this gate the fix above would dispatch a full product layout on
   * a **zoom**, re-arranging the model under a reader who only moved the camera,
   * while the height the layout reserves had not changed at all. Founder ruling
   * R1: the canonical layout has no viewport input.
   *
   * ⚠ THE FIRST VERSION OF THIS FILE COULD NOT SEE THAT, and that is why it is
   * worth stating. Its mocked store had no `transform` at all, so a zoom was
   * unrepresentable and every test passed on a camera that never moved. A guard
   * whose fixture cannot express the failure mode is not a lenient guard; it is
   * a blind one.
   */
  /**
   * ⛔⛔ THE TWO SCHEDULES A RETURNED REVIEW EXECUTED AGAINST MY FIRST FIX.
   *
   * That fix filtered the live height by watching the label scale. It was wrong
   * in BOTH directions, and neither could be seen by a fixture that changed
   * transform and heights before one rerender — which is exactly what this file
   * used to do. `CanvasLabelScaleSync` writes the CSS variable from an effect
   * AFTER the transform state changes, and React Flow's ResizeObserver then
   * updates node dimensions in a separate emission. They are not one
   * notification.
   *
   * Reading the bound height makes the schedule irrelevant, which is why these
   * two cases and the co-emitted growth case below can all hold at once.
   */
  it('⛔ SCHEDULE 1 — transform first, zoom-induced heights LATER: still lays out nothing', () => {
    const { rerender } = renderHook(() => useMeasureThenLayout())
    expect(layoutCalls()).toBeGreaterThan(0)
    settleLayout(); rerender()
    const settled = layoutCalls()

    // (a) the transform notification, with the old dimensions still in the store
    transform[2] = 0.5
    rerender()
    expect(layoutCalls(), 'the transform-only notification does not require a layout').toBe(settled)

    // (b) the ResizeObserver emission that follows it — same content, same Map
    lookup.get('opt')!.measured!.height = 328
    lookup.get('fac')!.measured!.height = 221
    rerender()
    expect(
      layoutCalls(),
      'the zoom-induced heights arrived a tick later and were read as growth — this is the 2-calls-vs-1 case',
    ).toBe(settled)
  })

  it('⛔ SCHEDULE 2 — content growth CO-EMITTED with a zoom is not absorbed', () => {
    const { rerender } = renderHook(() => useMeasureThenLayout())
    expect(layoutCalls()).toBeGreaterThan(0)
    settleLayout(); rerender()
    const settled = layoutCalls()

    // Real content growth AND a zoom in one emission. The bound height moves
    // because the CONTENT moved; the extra is the camera.
    boundHeights.set('opt', 260)
    transform[2] = 0.5
    lookup.get('opt')!.measured!.height = 560
    lookup.get('fac')!.measured!.height = 221
    rerender()

    expect(
      layoutCalls(),
      'a genuinely taller card was recorded as already laid out because a zoom rode along — ' +
        'the correction is absorbed and no later emission can recover it',
    ).toBeGreaterThan(settled)
  })

  it('⛔ ZOOM-ONLY, BATCHED IN ONE EMISSION: lays out nothing', () => {
    const { rerender } = renderHook(() => useMeasureThenLayout())
    expect(layoutCalls()).toBeGreaterThan(0)
    settleLayout(); rerender()
    const settled = layoutCalls()

    transform[2] = 0.5
    lookup.get('opt')!.measured!.height = 328
    lookup.get('fac')!.measured!.height = 221
    rerender()

    expect(layoutCalls(), 'a zoom re-laid out the model').toBe(settled)
  })

  it('⭐ THE POSITIVE TWIN: real growth at an UNCHANGED zoom still wakes the layout', () => {
    // Without this the three negatives above are all satisfied by a hook that
    // never lays out at all.
    const { rerender } = renderHook(() => useMeasureThenLayout())
    expect(layoutCalls()).toBeGreaterThan(0)
    settleLayout(); rerender()
    const settled = layoutCalls()

    boundHeights.set('opt', 320)
    lookup.get('opt')!.measured!.height = 320
    rerender()

    expect(
      layoutCalls(),
      'content grew at an unchanged zoom and nothing re-laid out — the gate suppresses too much',
    ).toBeGreaterThan(settled)
  })

  it('CONTRAST: the sibling node is untouched — the signature is per-node, bound by id', () => {
    renderHook(() => useMeasureThenLayout())
    expect(lookup.get('fac')!.measured!.height).toBe(108)
    expect(lookup.get('opt')!.measured!.height).toBe(160)
  })
})
