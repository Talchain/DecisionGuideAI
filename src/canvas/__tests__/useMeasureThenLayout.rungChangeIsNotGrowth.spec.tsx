/**
 * ⛔ A ZOOM-TIER CHANGE IS NOT GROWTH (S5, 24 Sep 2026).
 *
 * S5 made the landing rung (`quiet`) and the Normal rung (`full`) render
 * different card content: stacked change rows vs the contract grid, and no
 * quick-action band vs the band. `measureNodeHeightsAtLabelBound` pins the
 * SCALE to the bound but cannot pin the RUNG (it cannot re-render
 * synchronously), so at `full` it measures a state that never renders — the
 * grid and the band at scale 2. Compared against heights recorded at `quiet`,
 * that read as growth: a relayout (and, through `layoutVersion`, a re-fit back
 * to the floor) on the user's first zoom-in.
 *
 * The rule: growth is judged against a baseline recorded AT THE SAME RUNG. The
 * first reading at a rung the layout was not recorded at becomes that rung's
 * baseline and lays out nothing; real growth at any rung still re-lays out, and
 * growth that happened at one rung is caught at the other (never absorbed).
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
    ['opt', { measured: { width: 260, height: opt } }],
    ['fac', { measured: { width: 260, height: fac } }],
  ])
  mockNodesInitialized = true
}
const setRung = (lodRung: 'full' | 'quiet' | 'line') => useCanvasStore.setState({ lodRung } as never)

// Landing-rung (quiet) heights, and the fictional full-rung-at-scale-2 reading.
const QUIET = { opt: 292, fac: 178 }
const FULL_AT_BOUND = { opt: 343, fac: 204 }

function spyOnApplyLayout() {
  return vi.spyOn(useCanvasStore.getState(), 'applyLayout')
    .mockImplementation(() => Promise.resolve({ laidOut: true }))
}

describe('growth is judged per zoom rung — a rung change alone never re-lays out', () => {
  let applySpy: ReturnType<typeof spyOnApplyLayout>

  beforeEach(() => {
    useCanvasStore.getState().resetCanvas()
    useCanvasStore.setState({ pendingLayout: false, layoutInProgress: false, layoutVersion: 0, layoutRequestId: 0 } as never)
    mockNodesInitialized = false
    mockNodeLookup = new Map()
    mockedRecovery.mockClear()
    mockedRecovery.mockImplementation((fn: () => Promise<LayoutAttemptResult>) => { void fn() })
    applySpy = spyOnApplyLayout()
  })
  afterEach(() => { vi.restoreAllMocks() })

  function layOutAtQuiet(rerender: () => void) {
    setRung('quiet')
    seed()
    setHeights(QUIET.opt, QUIET.fac)
    rerender()
    act(() => { useCanvasStore.setState({ pendingLayout: false, layoutInProgress: false } as never) })
    rerender()
  }

  it('RED before S5-fix: zooming into Normal (rung full, taller bound reading) lays out NOTHING', () => {
    const { rerender } = renderHook(() => useMeasureThenLayout())
    layOutAtQuiet(rerender)
    const after = applySpy.mock.calls.length
    expect(after, 'PRECONDITION: the initial layout ran').toBeGreaterThan(0)

    act(() => { setRung('full'); setHeights(FULL_AT_BOUND.opt, FULL_AT_BOUND.fac) })
    rerender()
    expect(applySpy.mock.calls.length, 'a rung change is not growth').toBe(after)
  })

  it('CONTRAST: real growth AT the Normal rung (against its own baseline) still re-lays out', () => {
    const { rerender } = renderHook(() => useMeasureThenLayout())
    layOutAtQuiet(rerender)
    act(() => { setRung('full'); setHeights(FULL_AT_BOUND.opt, FULL_AT_BOUND.fac) })
    rerender()
    const after = applySpy.mock.calls.length

    act(() => { setHeights(FULL_AT_BOUND.opt + HEIGHT_GROWTH_TOLERANCE_PX + 40, FULL_AT_BOUND.fac) })
    rerender()
    expect(applySpy.mock.calls.length).toBe(after + 1)
  })

  it('NEVER ABSORBED: growth that happens while at Normal is still caught back at the landing rung', () => {
    const { rerender } = renderHook(() => useMeasureThenLayout())
    layOutAtQuiet(rerender)
    // At full: first reading is the baseline; then content grows a little —
    // not past the full baseline's tolerance.
    act(() => { setRung('full'); setHeights(FULL_AT_BOUND.opt, FULL_AT_BOUND.fac) })
    rerender()
    act(() => { setHeights(FULL_AT_BOUND.opt + 2, FULL_AT_BOUND.fac) })
    rerender()
    const after = applySpy.mock.calls.length
    // Back at the landing rung, the card is now taller than the landing layout reserved.
    act(() => { setRung('quiet'); setHeights(QUIET.opt + HEIGHT_GROWTH_TOLERANCE_PX + 30, QUIET.fac) })
    rerender()
    expect(applySpy.mock.calls.length, 'growth hidden behind a rung change must still correct the layout').toBe(after + 1)
  })

  it('CONTRAST: growth at the SAME rung the layout ran at still re-lays out (unchanged behaviour)', () => {
    const { rerender } = renderHook(() => useMeasureThenLayout())
    layOutAtQuiet(rerender)
    const after = applySpy.mock.calls.length
    act(() => { setHeights(QUIET.opt + HEIGHT_GROWTH_TOLERANCE_PX + 40, QUIET.fac) })
    rerender()
    expect(applySpy.mock.calls.length).toBe(after + 1)
  })
})
