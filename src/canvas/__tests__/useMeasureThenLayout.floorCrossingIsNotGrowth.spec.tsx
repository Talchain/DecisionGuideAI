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
/**
 * ⛔ Review 5825181742: crossing `ICON_LEGIBLE_ZOOM` INSIDE the `full` rung changes
 * the rendered Detailed option rows (stacked ↔ grid). The growth baseline must be
 * keyed on that too, or the first zoom-in re-lays out the model under the reader.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCanvasStore } from '../store'
import { useMeasureThenLayout } from '../hooks/useMeasureThenLayout'
import { HEIGHT_GROWTH_TOLERANCE_PX } from '../utils/nodeLayoutConstants'
import { handleLayoutWithRecovery, type LayoutAttemptResult } from '../layout/handleLayoutWithRecovery'
import { setAnchorRailFitsBeside } from '../nodes/shared/anchorRailFloor'

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

// Detailed option rows at the label bound: STACKED below the old Normal floor,
// GRID at or above it — both inside the `full` rung since landing counts as Normal.
const FULL_BELOW_FLOOR = { opt: 292, fac: 178 }
const FULL_AT_OR_ABOVE_FLOOR = { opt: 318, fac: 178 }

function spyOnApplyLayout() {
  return vi.spyOn(useCanvasStore.getState(), 'applyLayout')
    .mockImplementation(() => Promise.resolve({ laidOut: true }))
}

describe('a floor crossing inside the Normal rung is not growth', () => {
  let applySpy: ReturnType<typeof spyOnApplyLayout>

  beforeEach(() => {
    useCanvasStore.getState().resetCanvas()
    useCanvasStore.setState({ pendingLayout: false, layoutInProgress: false, layoutVersion: 0, layoutRequestId: 0 } as never)
    setAnchorRailFitsBeside(true)
    mockNodesInitialized = false
    mockNodeLookup = new Map()
    mockedRecovery.mockClear()
    mockedRecovery.mockImplementation((fn: () => Promise<LayoutAttemptResult>) => { void fn() })
    applySpy = spyOnApplyLayout()
  })
  afterEach(() => { vi.restoreAllMocks(); setAnchorRailFitsBeside(true) })

  function layOutAtLanding(rerender: () => void) {
    setRung('full')
    setAnchorRailFitsBeside(false)
    seed()
    setHeights(FULL_BELOW_FLOOR.opt, FULL_BELOW_FLOOR.fac)
    rerender()
    act(() => { useCanvasStore.setState({ pendingLayout: false, layoutInProgress: false } as never) })
    rerender()
  }

  it('zooming in past the old Normal floor (rows stacked → grid, rung stays full) lays out NOTHING', () => {
    const { rerender } = renderHook(() => useMeasureThenLayout())
    layOutAtLanding(rerender)
    const after = applySpy.mock.calls.length
    expect(after, 'PRECONDITION: the initial layout ran').toBeGreaterThan(0)
    act(() => { setAnchorRailFitsBeside(true); setHeights(FULL_AT_OR_ABOVE_FLOOR.opt, FULL_AT_OR_ABOVE_FLOOR.fac) })
    rerender()
    expect(useCanvasStore.getState().lodRung, 'PRECONDITION: still the Normal rung').toBe('full')
    expect(applySpy.mock.calls.length, 'a floor crossing is not growth').toBe(after)
  })

  it('CONTRAST: real growth after the crossing (against that side\'s own baseline) still re-lays out', () => {
    const { rerender } = renderHook(() => useMeasureThenLayout())
    layOutAtLanding(rerender)
    act(() => { setAnchorRailFitsBeside(true); setHeights(FULL_AT_OR_ABOVE_FLOOR.opt, FULL_AT_OR_ABOVE_FLOOR.fac) })
    rerender()
    const after = applySpy.mock.calls.length
    act(() => { setHeights(FULL_AT_OR_ABOVE_FLOOR.opt + HEIGHT_GROWTH_TOLERANCE_PX + 40, FULL_AT_OR_ABOVE_FLOOR.fac) })
    rerender()
    expect(applySpy.mock.calls.length).toBe(after + 1)
  })

  it('NEVER ABSORBED: growth hidden behind a crossing is still caught back below the floor', () => {
    const { rerender } = renderHook(() => useMeasureThenLayout())
    layOutAtLanding(rerender)
    act(() => { setAnchorRailFitsBeside(true); setHeights(FULL_AT_OR_ABOVE_FLOOR.opt, FULL_AT_OR_ABOVE_FLOOR.fac) })
    rerender()
    const after = applySpy.mock.calls.length
    act(() => { setAnchorRailFitsBeside(false); setHeights(FULL_BELOW_FLOOR.opt + HEIGHT_GROWTH_TOLERANCE_PX + 30, FULL_BELOW_FLOOR.fac) })
    rerender()
    expect(applySpy.mock.calls.length).toBe(after + 1)
  })
})
