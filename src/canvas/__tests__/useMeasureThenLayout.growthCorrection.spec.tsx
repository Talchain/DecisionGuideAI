/**
 * THE OVERLAP COMES BACK AFTER ANALYSIS, THROUGH A SECOND DOOR.
 *
 * `useMeasureThenLayout`'s fallback correction handles a layout computed
 * BEFORE the cards measured. It does nothing when the heights change LATER —
 * and analysis changes them: results add content to option and factor cards,
 * so they grow while their positions do not. Measured on an analysed model:
 * 5 overlapping pairs, up to 160x54px, on a settled graph at fit-to-view.
 *
 * Nothing in the analysis path asks for a re-layout. Enumerated at
 * `origin/staging` with controls: `applyScenarioAnalysisRead.ts` contains ZERO
 * `setPendingLayout`/`applyLayout` calls, against TWO in `applyDraftResult.ts`
 * as a contrast control, and a fabricated symbol found zero times — so the
 * absence is measured, not assumed.
 *
 * `layoutGraph` sizes every canonical row as (tallest card in that row +
 * layerSpacing). Once a card is TALLER than the height its row was computed
 * against, it overlaps the row beneath. This suite pins the correction, and —
 * more importantly — pins its ASYMMETRY.
 *
 * ⭐ THE OPPOSITE-DIRECTION TWIN IS THE POINT OF THIS SUITE.
 * Growth and shrink are not two cases of one rule:
 *   - a card that GREW overflows its band and covers the row beneath — a defect;
 *   - a card that SHRANK leaves whitespace — untidy, harmless.
 * Re-laying out on both would move the model under a reader for no gain, and a
 * model that re-arranges itself while you are reading it is a worse defect than
 * the overlap this exists to prevent. A single symmetric predicate would pass
 * the growth test and silently buy that harm, so both directions are asserted.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCanvasStore } from '../store'
import { useMeasureThenLayout } from '../hooks/useMeasureThenLayout'
import { HEIGHT_GROWTH_TOLERANCE_PX } from '../utils/nodeLayoutConstants'
import { handleLayoutWithRecovery, type LayoutAttemptResult } from '../layout/handleLayoutWithRecovery'

let mockNodesInitialized = false
let mockNodeLookup = new Map<string, { measured?: { width?: number; height?: number } }>()

vi.mock('@xyflow/react', () => ({
  useNodesInitialized: () => mockNodesInitialized,
  useStore: <T,>(selector: (s: { nodeLookup: typeof mockNodeLookup }) => T) =>
    selector({ nodeLookup: mockNodeLookup }),
}))
vi.mock('../layout/handleLayoutWithRecovery', () => ({
  handleLayoutWithRecovery: vi.fn((fn: () => Promise<LayoutAttemptResult>) => { void fn() }),
}))
vi.mock('../../lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const mockedRecovery = vi.mocked(handleLayoutWithRecovery)

function spyOnApplyLayout() {
  return vi.spyOn(useCanvasStore.getState(), 'applyLayout')
    .mockImplementation(() => Promise.resolve({ laidOut: true }))
}

/** Two unlocked nodes, addressed by id so assertions bind by identity. */
function seed() {
  useCanvasStore.setState({
    nodes: [
      { id: 'opt', type: 'option', position: { x: 0, y: 0 }, data: { label: 'opt', kind: 'option' } },
      { id: 'fac', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'fac', kind: 'factor' } },
    ] as never,
    pendingLayout: true,
    layoutRequestId: 1,
  } as never)
}

const setHeights = (opt: number, fac: number) => {
  mockNodeLookup = new Map([
    ['opt', { measured: { width: 320, height: opt } }],
    ['fac', { measured: { width: 320, height: fac } }],
  ])
  mockNodesInitialized = true
}

describe('a settled layout is corrected when a card GROWS, and left alone when it shrinks', () => {
  let applySpy: ReturnType<typeof spyOnApplyLayout>

  beforeEach(() => {
    vi.useFakeTimers()
    useCanvasStore.getState().resetCanvas()
    useCanvasStore.setState({
      pendingLayout: false, layoutInProgress: false, layoutVersion: 0, layoutRequestId: 0,
    } as never)
    mockNodesInitialized = false
    mockNodeLookup = new Map()
    mockedRecovery.mockClear()
    mockedRecovery.mockImplementation((fn: () => Promise<LayoutAttemptResult>) => { void fn() })
    applySpy = spyOnApplyLayout()
  })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  /** Drive to a committed layout with real heights, then settle. */
  function layOutThenSettle(rerender: () => void, opt = 160, fac = 108) {
    setHeights(opt, fac)
    rerender()
    act(() => { useCanvasStore.setState({ pendingLayout: false, layoutInProgress: false } as never) })
    rerender()
  }

  it('re-lays out when a card grows past the tolerance — the analysis case', () => {
    seed()
    const { rerender } = renderHook(() => useMeasureThenLayout())
    layOutThenSettle(rerender)
    const afterInitial = applySpy.mock.calls.length
    expect(afterInitial, 'the initial layout should have run').toBeGreaterThan(0)

    // Analysis lands: the option card gains content and grows.
    act(() => { setHeights(160 + HEIGHT_GROWTH_TOLERANCE_PX + 40, 108) })
    rerender()

    expect(
      applySpy.mock.calls.length,
      'a card grew past its row band — the committed layout is stale and must be recomputed',
    ).toBe(afterInitial + 1)
  })

  it('OPPOSITE-DIRECTION TWIN: does NOT re-lay out when a card shrinks', () => {
    seed()
    const { rerender } = renderHook(() => useMeasureThenLayout())
    layOutThenSettle(rerender)
    const afterInitial = applySpy.mock.calls.length

    act(() => { setHeights(160 - 60, 108) })
    rerender()

    expect(
      applySpy.mock.calls.length,
      'shrinking leaves whitespace, not overlap — re-laying out would move the model ' +
        'under the reader for no gain',
    ).toBe(afterInitial)
  })

  it('ignores jitter at or below the tolerance', () => {
    seed()
    const { rerender } = renderHook(() => useMeasureThenLayout())
    layOutThenSettle(rerender)
    const afterInitial = applySpy.mock.calls.length

    act(() => { setHeights(160 + HEIGHT_GROWTH_TOLERANCE_PX, 108) })
    rerender()

    expect(
      applySpy.mock.calls.length,
      'sub-tolerance drift is font settling and rounding, not a layout change',
    ).toBe(afterInitial)
  })

  it('corrects once per growth — a steady taller card does not re-trigger', () => {
    seed()
    const { rerender } = renderHook(() => useMeasureThenLayout())
    layOutThenSettle(rerender)
    act(() => { setHeights(240, 108) })
    rerender()
    const afterCorrection = applySpy.mock.calls.length

    // React Flow re-emits nodeLookup constantly at the same heights.
    act(() => { mockNodeLookup = new Map(mockNodeLookup) })
    rerender()
    act(() => { mockNodeLookup = new Map(mockNodeLookup) })
    rerender()

    expect(applySpy.mock.calls.length, 'the correction must be one-shot per growth').toBe(afterCorrection)
  })

  it('does not fire while a layout is already in progress', () => {
    seed()
    const { rerender } = renderHook(() => useMeasureThenLayout())
    layOutThenSettle(rerender)
    const afterInitial = applySpy.mock.calls.length

    act(() => { useCanvasStore.setState({ layoutInProgress: true } as never) })
    act(() => { setHeights(300, 108) })
    rerender()

    expect(applySpy.mock.calls.length, 're-entry guard must hold').toBe(afterInitial)
  })
})
