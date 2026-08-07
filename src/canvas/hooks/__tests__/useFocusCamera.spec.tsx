/**
 * useFocusCamera — the focus/pulse camera seam, end to end.
 *
 * Covers the three adversarial-review findings that lived here unpinned:
 *  - finding 1: the lens must end on ANY reframe except focus's own fit —
 *    including the app's own camera buttons, which reach ReactFlow
 *    PROGRAMMATICALLY (event === null). The old `if (event)` filter swallowed
 *    exactly those.
 *  - finding 3: focusing an EDGE pans away, so it must end the lens too.
 *  - finding 4: the no-churn gate and the fit it gates must frame against the
 *    SAME rect — a panel-aware gate handing off to a bare-number fit moves the
 *    camera and leaves the target under the panel.
 *  - finding 5: the pan→clear wiring and the programmatic-move exemption.
 *
 * `@xyflow/react` is mocked (its hooks need a Provider, and mounting one would
 * load the whole canvas) — the layoutLifecycle.integration precedent. But
 * readFocusCamera and computeFitPadding are the REAL ones (finding 7: every
 * other fit-seam test spies over the bridge, so it never ran). Only the
 * element rects are faked.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCanvasStore } from '../../store'
import { useFocusCamera } from '../useFocusCamera'
import { focusNodeById, focusEdgeById, fitNodesOnCanvas } from '../../utils/focusHelpers'

const fitViewSpy = vi.fn()
const setCenterSpy = vi.fn()
let mockViewport = { x: 0, y: 0, zoom: 1 }

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    getViewport: () => mockViewport,
    setCenter: setCenterSpy,
    fitView: fitViewSpy,
  }),
}))

let mockReducedMotion = false
vi.mock('../usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => mockReducedMotion,
}))

// ---- DOM rects the REAL computeFitPadding / readFocusCamera measure --------
function fakeEl(rect: Partial<DOMRect>): HTMLElement {
  const full = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect
  return { getBoundingClientRect: () => full } as unknown as HTMLElement
}

const FLOW = '.react-flow'
const DOCK = 'aside[aria-label="Outputs dock"]'
const PANE = { width: 1440, height: 900, left: 0, right: 1440, top: 0, bottom: 900 }
/** An EXPANDED dock: overlaps the pane's right 428px, so it occludes. */
const EXPANDED_DOCK = { width: 416, height: 900, left: 1012, right: 1428 }
/** Base margin with nothing occluding: floor((1440 - 1440/1.2) * 0.5) = 120. */
const BASE_X = 120

function stubCanvas(opts: { dock?: boolean; pane?: Partial<DOMRect> | null } = {}) {
  const map: Record<string, HTMLElement | null> = {}
  if (opts.pane !== null) map[FLOW] = fakeEl({ ...PANE, ...(opts.pane ?? {}) })
  if (opts.dock) map[DOCK] = fakeEl(EXPANDED_DOCK)
  vi.spyOn(document, 'querySelector').mockImplementation(
    (sel: string) => (sel in map ? map[sel] : null) as Element | null,
  )
}

const node = (id: string, x: number, y: number) =>
  ({
    id,
    type: 'factor',
    position: { x, y },
    measured: { width: 200, height: 80 },
    data: { label: id, kind: 'factor' },
  }) as any

// a—b adjacent and comfortably in the clear; 'far' is way off-screen.
const NODES = [node('a', 300, 300), node('b', 600, 300), node('far', 9000, 9000)]
const EDGES = [{ id: 'e1', source: 'a', target: 'b' }] as any

function setGraph() {
  useCanvasStore.setState({
    nodes: NODES,
    edges: EDGES,
    dimmedNodeIds: new Set<string>(),
    focusDimSourceId: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as any)
}

/**
 * ReactFlow calls onMoveStart(event, viewport): the originating gesture for a
 * user drag/wheel, and NULL for any programmatic move — which is how the app's
 * own zoom/reset/fit buttons arrive.
 */
function emitMoveStart(onMoveStart: () => void, event: unknown = null) {
  ;(onMoveStart as unknown as (e: unknown, v: unknown) => void)(event, mockViewport)
}

const focusDim = () => useCanvasStore.getState().focusDimSourceId
const dimmed = () => [...useCanvasStore.getState().dimmedNodeIds].sort()

beforeEach(() => {
  fitViewSpy.mockClear()
  setCenterSpy.mockClear()
  mockViewport = { x: 0, y: 0, zoom: 1 }
  mockReducedMotion = false
  setGraph()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useFocusCamera — F3 lens ends on any reframe (finding 1 + 5)', () => {
  it('focusing a node dims the non-neighbours and records the focus source', () => {
    stubCanvas()
    renderHook(() => useFocusCamera())
    act(() => focusNodeById('a'))
    expect(focusDim()).toBe('a')
    // a's neighbourhood is {a, b}; only 'far' is outside it.
    expect(dimmed()).toEqual(['far'])
  })

  it('focus’s OWN fit does not clear the dim it just set', () => {
    // 'far' is off-screen, so the plan fits — and that fit emits a move-start.
    stubCanvas()
    const { result } = renderHook(() => useFocusCamera())
    act(() => focusNodeById('far'))
    expect(fitViewSpy).toHaveBeenCalledTimes(1)
    act(() => emitMoveStart(result.current.onMoveStart))
    expect(focusDim()).toBe('far')
  })

  it('an APP CAMERA BUTTON move clears the dim — a programmatic move is still a user action', () => {
    // THE finding-1 regression: zoom in/out/reset/fit call ReactFlow directly,
    // so onMoveStart arrives with a null event. Filtering on the event left a
    // stale lens over a camera the user had just reframed.
    stubCanvas()
    const { result } = renderHook(() => useFocusCamera())
    act(() => useCanvasStore.getState().setFocusDim('a', ['far']))
    act(() => emitMoveStart(result.current.onMoveStart, null))
    expect(focusDim()).toBeNull()
  })

  it('a user drag clears the dim', () => {
    stubCanvas()
    const { result } = renderHook(() => useFocusCamera())
    act(() => useCanvasStore.getState().setFocusDim('a', ['far']))
    act(() => emitMoveStart(result.current.onMoveStart, new MouseEvent('mousedown')))
    expect(focusDim()).toBeNull()
  })

  it('the SECOND move after focus’s fit clears — the exemption covers one move only', () => {
    stubCanvas()
    const { result } = renderHook(() => useFocusCamera())
    act(() => focusNodeById('far'))
    act(() => emitMoveStart(result.current.onMoveStart)) // focus's own fit
    expect(focusDim()).toBe('far')
    act(() => emitMoveStart(result.current.onMoveStart)) // the user's next pan
    expect(focusDim()).toBeNull()
  })

  it('a no-churn focus arms nothing, so the next move still clears', () => {
    // {a,b} are already comfortably visible → no fit → no exemption to spend.
    stubCanvas()
    const { result } = renderHook(() => useFocusCamera())
    act(() => focusNodeById('a'))
    expect(fitViewSpy).not.toHaveBeenCalled()
    act(() => emitMoveStart(result.current.onMoveStart))
    expect(focusDim()).toBeNull()
  })
})

describe('useFocusCamera — F3 an edge focus ends the lens (finding 3)', () => {
  it('focusing an edge clears a live focus dim', () => {
    stubCanvas()
    renderHook(() => useFocusCamera())
    act(() => focusNodeById('a'))
    expect(focusDim()).toBe('a')
    act(() => focusEdgeById('e1'))
    expect(focusDim()).toBeNull()
    expect(dimmed()).toEqual([])
  })

  it('still pans to the edge midpoint (the clear does not skip the move)', () => {
    stubCanvas()
    renderHook(() => useFocusCamera())
    act(() => focusEdgeById('e1'))
    expect(setCenterSpy).toHaveBeenCalledWith(450, 300, expect.objectContaining({ zoom: 1 }))
  })
})

describe('useFocusCamera — F2/F4 the gate and the fit share one frame (finding 4)', () => {
  it('the focus fit uses the PANEL-AWARE padding, not a bare number', () => {
    // A bare number is a FRACTION of the full pane, so the fit would reframe
    // the target straight back under the expanded dock the gate just measured.
    stubCanvas({ dock: true })
    renderHook(() => useFocusCamera())
    act(() => focusNodeById('far'))
    expect(fitViewSpy).toHaveBeenCalledTimes(1)
    const { padding } = fitViewSpy.mock.calls[0]![0]
    expect(padding).toEqual({
      top: expect.stringMatching(/px$/),
      right: '444px', // overlap 428 + 16px gap — clear of the dock
      bottom: expect.stringMatching(/px$/),
      left: `${BASE_X}px`,
    })
  })

  it('the F4 pulse fit uses the same panel-aware padding', () => {
    stubCanvas({ dock: true })
    renderHook(() => useFocusCamera())
    act(() => {
      fitNodesOnCanvas(['far'])
    })
    expect(fitViewSpy).toHaveBeenCalledTimes(1)
    expect(fitViewSpy.mock.calls[0]![0].padding).toMatchObject({ right: '444px' })
  })

  it('falls back to bare-number padding only when the camera is unmeasurable', () => {
    // No .react-flow → readFocusCamera returns null → the gate fails open and
    // fits, and there is no measured frame to fit into.
    stubCanvas({ pane: null })
    renderHook(() => useFocusCamera())
    act(() => focusNodeById('a'))
    expect(fitViewSpy).toHaveBeenCalledTimes(1)
    expect(fitViewSpy.mock.calls[0]![0].padding).toBe(0.3)
  })
})

describe('useFocusCamera — F4 no-churn through the real bridge (finding 7)', () => {
  it('does NOT move the camera when the pulse target is already comfortable', () => {
    stubCanvas()
    renderHook(() => useFocusCamera())
    act(() => {
      fitNodesOnCanvas(['a'])
    })
    expect(fitViewSpy).not.toHaveBeenCalled()
  })

  it('DOES fit when the same target is occluded by an expanded dock', () => {
    // Same node, same viewport — only the dock differs. This is the bridge
    // doing real work: measurement → panel-aware gate → fit.
    useCanvasStore.setState({ nodes: [node('under', 1100, 300)] } as any)
    stubCanvas({ dock: true })
    renderHook(() => useFocusCamera())
    act(() => {
      fitNodesOnCanvas(['under'])
    })
    expect(fitViewSpy).toHaveBeenCalledTimes(1)
  })

  it('does not fit that same node when nothing occludes it', () => {
    useCanvasStore.setState({ nodes: [node('under', 1100, 300)] } as any)
    stubCanvas({ dock: false })
    renderHook(() => useFocusCamera())
    act(() => {
      fitNodesOnCanvas(['under'])
    })
    expect(fitViewSpy).not.toHaveBeenCalled()
  })

  it('F1: reduced motion collapses the focus fit to an instant jump', () => {
    mockReducedMotion = true
    stubCanvas()
    renderHook(() => useFocusCamera())
    act(() => focusNodeById('far'))
    expect(fitViewSpy.mock.calls[0]![0].duration).toBe(0)
  })

  it('F1: reduced motion collapses the edge pan too', () => {
    mockReducedMotion = true
    stubCanvas()
    renderHook(() => useFocusCamera())
    act(() => focusEdgeById('e1'))
    expect(setCenterSpy.mock.calls[0]![2].duration).toBe(0)
  })
})
