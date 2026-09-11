/**
 * THE CORRECTION LOGIC IS CORRECT. ITS TRIGGER WAS MISSING.
 *
 * Founder-reported, deployed staging `d4ff3683`: canvas nodes visibly touching
 * and overlapping. Measured in real Chromium (`e2e/geometry/nodeOverlap.measure.ts`),
 * across 15 cells, the correlation is exact:
 *   layoutVersion === 1  => overlapping (2/2 cells)
 *   layoutVersion >= 2   => zero overlaps (13/13 cells)
 *
 * The height timeline (`e2e/geometry/overlapHeightTimeline.measure.ts`) shows
 * why. Cards paint at a transient height, ELK commits against THAT, and the
 * cards then finish much taller:
 *   t=688ms  lv=0  cards 119/139/154/125/110
 *   t=1512ms lv=1  pitches [183,230,218,137,155]  cards ALREADY 253/300/251/269/244
 * A 137 px row pitch under a 161 px card is the overlap the founder photographed.
 * (Note for anyone chasing a constant: 137 is not one. It is ELK's output for
 * the transient heights. It merely RESEMBLES DEFAULT_NODE_HEIGHT + LAYOUT_PADDING_Y
 * = 116, and the fallback timer provably never fired — no fallback warning was
 * emitted in 6/6 probe runs.)
 *
 * `useMeasureThenLayout` already contains the correction for exactly this. The
 * discriminating experiment (`e2e/geometry/overlapTriggerProbe.measure.ts`)
 * nudged ONLY the identity of the `nodes` array — same node objects, same
 * positions, same content, no geometry touched — and the overlap resolved
 * itself: 15 pairs @ lv=1 -> 0 pairs @ lv=3. So the logic was never wrong. The
 * effect simply never re-ran once the cards reached their final height.
 *
 * ⭐ WHY THE EXISTING SUITE COULD NOT SEE THIS.
 * `useMeasureThenLayout.growthCorrection.spec.tsx` drives growth via
 * `setHeights`, which assigns a BRAND NEW Map to the mocked nodeLookup. React
 * Flow does the opposite: it MUTATES `nodeLookup` IN PLACE. So the existing
 * suite validates the correction's LOGIC while assuming away its TRIGGER —
 * every assertion in it is true as stated and none of them can observe this
 * defect (CLAUDE.md trap 13b: a guard whose discrimination depends on a fixture
 * that nothing pins).
 *
 * This spec therefore asserts the ONE property that suite cannot: that a
 * measured-height change made IN PLACE produces a different value from the
 * hook's React Flow subscription, so React re-renders and the effect re-runs.
 * Bound by node id ('opt'), never by a value predicate another node could satisfy.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCanvasStore } from '../store'
import { useMeasureThenLayout } from '../hooks/useMeasureThenLayout'

type LookupEntry = { measured?: { width?: number; height?: number } }
type RFState = { nodeLookup: Map<string, LookupEntry> }

/** Every selector the hook hands to React Flow's `useStore`, in order. */
const capturedSelectors: Array<(s: RFState) => unknown> = []
let mockNodeLookup = new Map<string, LookupEntry>()

vi.mock('@xyflow/react', () => ({
  useNodesInitialized: () => true,
  useStore: <T,>(selector: (s: RFState) => T) => {
    capturedSelectors.push(selector as (s: RFState) => unknown)
    return selector({ nodeLookup: mockNodeLookup })
  },
}))
vi.mock('../layout/handleLayoutWithRecovery', () => ({
  handleLayoutWithRecovery: vi.fn(),
}))
vi.mock('../../lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

describe('useMeasureThenLayout observes an IN-PLACE measured-height change', () => {
  beforeEach(() => {
    capturedSelectors.length = 0
    useCanvasStore.getState().resetCanvas()
    useCanvasStore.setState({
      nodes: [
        { id: 'opt', type: 'option', position: { x: 0, y: 0 }, data: { label: 'opt', kind: 'option' } },
        { id: 'fac', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'fac', kind: 'factor' } },
      ] as never,
      pendingLayout: false,
      layoutInProgress: false,
      layoutVersion: 1,
      layoutRequestId: 1,
    } as never)
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('a card growing IN PLACE changes what the hook subscribes to, so the effect re-runs', () => {
    // React Flow's real nodeLookup: one Map, mutated, never replaced.
    const lookup = new Map<string, LookupEntry>([
      ['opt', { measured: { width: 320, height: 160 } }],
      ['fac', { measured: { width: 320, height: 108 } }],
    ])
    mockNodeLookup = lookup

    renderHook(() => useMeasureThenLayout())
    expect(
      capturedSelectors.length,
      'the hook must subscribe to React Flow state for this assertion to mean anything',
    ).toBeGreaterThan(0)

    const state: RFState = { nodeLookup: lookup }
    const before = capturedSelectors.map((s) => s(state))

    // ⭐ THE MUTATION REACT FLOW ACTUALLY PERFORMS. The Map identity is
    // deliberately preserved — that is the whole defect.
    lookup.set('opt', { measured: { width: 320, height: 420 } })
    expect(state.nodeLookup, 'the probe must not replace the Map').toBe(lookup)

    const after = capturedSelectors.map((s) => s(state))

    const changed = before.some((v, i) => !Object.is(v, after[i]))
    expect(
      changed,
      "node 'opt' grew 160 -> 420 in place, but every value the hook subscribes to is " +
        'unchanged, so React never re-renders, the effect never re-runs and the growth ' +
        'correction never fires — the committed layout stays sized for a 160 px card. ' +
        'This is the deployed overlap.',
    ).toBe(true)
  })

  it('OPPOSITE-DIRECTION TWIN: an unchanged lookup must NOT look like a change', () => {
    // Guards against "fixing" the above with a value that differs every call
    // (a Date, a counter, a fresh object) — that would re-run the effect on
    // every React Flow emission and re-lay out the model under the reader.
    const lookup = new Map<string, LookupEntry>([
      ['opt', { measured: { width: 320, height: 160 } }],
      ['fac', { measured: { width: 320, height: 108 } }],
    ])
    mockNodeLookup = lookup

    renderHook(() => useMeasureThenLayout())
    const state: RFState = { nodeLookup: lookup }

    const first = capturedSelectors.map((s) => s(state))
    const second = capturedSelectors.map((s) => s(state))

    expect(
      first.every((v, i) => Object.is(v, second[i])),
      'nothing changed between these two reads, so every subscribed value must be ' +
        'identical — otherwise the effect re-runs on every React Flow emission and the ' +
        'model re-arranges itself while the reader is looking at it',
    ).toBe(true)
  })
})
