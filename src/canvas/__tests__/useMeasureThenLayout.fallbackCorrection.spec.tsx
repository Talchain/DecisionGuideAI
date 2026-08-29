/**
 * THE FALLBACK LAYOUT IS TERMINAL, AND THAT IS THE CANVAS OVERLAP DEFECT.
 *
 * `useMeasureThenLayout` waits for React Flow to measure every unlocked node
 * so ELK runs against real heights. When measurement does not settle within
 * `LAYOUT_MEASUREMENT_FALLBACK_MS`, it lays out anyway using
 * `DEFAULT_NODE_HEIGHT` for every unmeasured node — and then STOPS. Nothing
 * re-runs layout when the real heights arrive a moment later.
 *
 * `layoutGraph` sizes each canonical row as (tallest card in the row +
 * layerSpacing). Given fallback heights it sizes every row identically, so any
 * card taller than that uniform band overlaps the row beneath it. Measured on
 * deployed staging (headcount-allocation starter, 2026-08-29): row pitch was
 * uniform at 164 layout units across all six rows — exactly
 * DEFAULT_NODE_HEIGHT(100) + LAYOUT_PADDING_Y(16) + layerSpacing(48) — while
 * rendered card heights ranged 52–160 px. Four node pairs overlapped, and the
 * overlap of each equalled its card's spill past the band.
 *
 * Driven offline over the five shipped starters with the committed browser
 * height capture, the same pipeline gives 0 overlapping pairs at REAL heights
 * and 13–36 pairs at DEFAULT_NODE_HEIGHT — so the algorithm is right and the
 * heights it was handed were not.
 *
 * This suite pins the correction: after a fallback layout, the FIRST moment
 * measurement completes must trigger exactly one more layout. It asserts the
 * property (a corrective pass happens, once) rather than any particular ref or
 * flag, so the implementation stays free.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCanvasStore } from '../store'
import { useMeasureThenLayout } from '../hooks/useMeasureThenLayout'
import { LAYOUT_MEASUREMENT_FALLBACK_MS } from '../utils/nodeLayoutConstants'
import { handleLayoutWithRecovery, type LayoutAttemptResult } from '../layout/handleLayoutWithRecovery'

let mockNodesInitialized = false
let mockNodeLookup = new Map<string, { measured?: { width?: number; height?: number } }>()

vi.mock('@xyflow/react', () => ({
  useNodesInitialized: () => mockNodesInitialized,
  useStore: <T,>(selector: (s: { nodeLookup: typeof mockNodeLookup }) => T) =>
    selector({ nodeLookup: mockNodeLookup }),
}))

vi.mock('../layout/handleLayoutWithRecovery', () => ({
  handleLayoutWithRecovery: vi.fn((fn: () => Promise<LayoutAttemptResult>) => {
    void fn()
  }),
}))

const mockedRecovery = vi.mocked(handleLayoutWithRecovery)

/** Two unlocked nodes, bound by id so the assertions cannot drift onto another object. */
function seedTwoNodes() {
  useCanvasStore.setState({
    nodes: [
      { id: 'tall', type: 'option', position: { x: 0, y: 0 }, data: { label: 'tall', kind: 'option' } },
      { id: 'short', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'short', kind: 'factor' } },
    ] as never,
    pendingLayout: true,
    layoutRequestId: 1,
  } as never)
}

function measureAll() {
  mockNodeLookup = new Map([
    ['tall', { measured: { width: 320, height: 285 } }],
    ['short', { measured: { width: 320, height: 108 } }],
  ])
  mockNodesInitialized = true
}

/**
 * Typed via the helper's own return so the spy keeps `applyLayout`'s real
 * signature. A bare `ReturnType<typeof vi.spyOn>` widens to
 * `MockInstance<unknown[], unknown>` and does not accept it — caught by the
 * typecheck ratchet, fixed here rather than absorbed into the baseline.
 */
function spyOnApplyLayout() {
  return vi
    .spyOn(useCanvasStore.getState(), 'applyLayout')
    .mockImplementation(() => Promise.resolve({ laidOut: true }))
}

describe('a fallback layout is corrected once real heights arrive', () => {
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

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('re-runs layout when measurement completes after the fallback fired', () => {
    seedTwoNodes()
    const { rerender } = renderHook(() => useMeasureThenLayout())

    // Fallback fires with nothing measured — this is the layout that overlaps.
    act(() => { vi.advanceTimersByTime(LAYOUT_MEASUREMENT_FALLBACK_MS) })
    expect(applySpy, 'fallback layout should have run').toHaveBeenCalledTimes(1)

    // The fallback layout completes and clears pendingLayout, exactly as the store does.
    act(() => { useCanvasStore.setState({ pendingLayout: false, layoutInProgress: false } as never) })

    // Real heights now arrive.
    act(() => { measureAll() })
    rerender()

    expect(
      applySpy.mock.calls.length,
      'measurement completed after a fallback layout — a corrective layout must run',
    ).toBe(2)
  })

  it('does not re-run when the first layout already had complete measurement', () => {
    seedTwoNodes()
    measureAll()
    const { rerender } = renderHook(() => useMeasureThenLayout())

    expect(applySpy, 'run-now layout should have run').toHaveBeenCalledTimes(1)

    act(() => { useCanvasStore.setState({ pendingLayout: false, layoutInProgress: false } as never) })
    rerender()
    act(() => { vi.advanceTimersByTime(LAYOUT_MEASUREMENT_FALLBACK_MS * 4) })
    rerender()

    expect(
      applySpy.mock.calls.length,
      'no fallback was used, so nothing needs correcting',
    ).toBe(1)
  })

  it('corrects at most once — a later re-render does not keep re-laying out', () => {
    seedTwoNodes()
    const { rerender } = renderHook(() => useMeasureThenLayout())
    act(() => { vi.advanceTimersByTime(LAYOUT_MEASUREMENT_FALLBACK_MS) })
    act(() => { useCanvasStore.setState({ pendingLayout: false, layoutInProgress: false } as never) })
    act(() => { measureAll() })
    rerender()
    const afterCorrection = applySpy.mock.calls.length

    // React Flow re-emits nodeLookup constantly; none of it should re-trigger.
    act(() => { mockNodeLookup = new Map(mockNodeLookup) })
    rerender()
    act(() => { mockNodeLookup = new Map(mockNodeLookup) })
    rerender()

    expect(applySpy.mock.calls.length, 'correction must be one-shot').toBe(afterCorrection)
  })
})
