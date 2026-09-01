/**
 * THE RELOADED STATE CLASS — Auto-arrange on a model that arrived by RESTORE.
 *
 * ⚠⚠ READ THIS BEFORE TREATING THIS FILE AS A REGRESSION TEST FOR THE REPORTED
 * DEFECT. IT IS NOT ONE. A live witness reported, in a real browser on deployed
 * staging, that Auto-arrange re-frames the camera BEFORE a page reload and does
 * NOT after one (2-vs-2 inside one session; post-reload the transform stayed
 * byte-identical for 28s while the layout itself succeeded, overlaps 2 -> 0).
 * **These tests do not reproduce that.** Every arm below is GREEN, at the tip
 * where the defect is live. They are the coverage that was MISSING — nothing
 * pinned the reloaded class at all — and they will RED if this contract breaks
 * in future. They are not evidence that the witnessed defect is fixed, and a
 * green run here must never be reported as such.
 *
 * WHAT THE ARMS PIN. On a restored model `layoutVersion` stays 0 for the whole
 * page session (`useRestoredLayoutWidth.ts`'s header records this measured over
 * 30s: overlapping pairs constant, `layoutVersion` 0, zero `applyLayout` calls),
 * so the user's Auto-arrange is the FIRST layout of the session — a state class
 * the fresh-draft path never occupies, and one no other spec drives.
 *
 * WHAT WAS RULED OUT HERE, and recorded so the next lane does not re-tread it:
 *   - A2 drives the product's own measurement path BETWEEN the layout commit and
 *     the frame, the non-quiescent class the restore spec's header names as the
 *     one its own tests could not represent (SENDABLE failure 6). Still fits.
 *   - A3 puts an outstanding USER camera claim on the model first ("Show whole
 *     model"), the state `#1096`'s key conjunct reads. Still fits — because the
 *     initiator conjunct is `'user'`, so the guard cannot return whatever the
 *     claim says.
 *   - B is the fresh contrast arm, so a failure in A is attributable to the
 *     state class and not to the harness.
 *
 * ⚠ WHAT THIS FILE STRUCTURALLY CANNOT SEE (CLAUDE.md trap 3, and the reason the
 * arms above may all be beside the point). `fitNow` has TWO exits: an animated
 * `setViewport` when the fit would clamp below `LABEL_LEGIBLE_ZOOM`, and
 * `fitView` otherwise. The `useReactFlow` mock here — like the one in all three
 * sibling fit specs — supplies only `{ fitView, getNodes }`, and `readFocusCamera`
 * returns null in jsdom regardless (it needs a laid-out `.react-flow` element).
 * So the top-anchored `setViewport` branch is UNREACHABLE in every existing test,
 * and it is exactly the branch a CLAMPED fit takes — which is the restore arm's
 * measured condition (it parked at 0.4279, below the floor, at 1280x800). Any
 * defect living in that branch is invisible to this file and to its siblings.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCanvasStore } from '../store'
import { useFitViewOnLayoutVersion } from '../hooks/useFitViewOnLayoutVersion'
import { GHOST_OPTION_NODE_ID } from '../utils/fitTargets'

type HydrateArg = Parameters<ReturnType<typeof useCanvasStore.getState>['hydrateGraphSlice']>[0]
type RestoreGraph = {
  nodes: NonNullable<HydrateArg['nodes']>
  edges: NonNullable<HydrateArg['edges']>
}

const fitViewSpy = vi.fn()

type PendingFrame = { id: number; cb: () => void }
let frames: PendingFrame[] = []
let nextFrameId = 0
let cancelledIds: number[] = []

function spyOnRaf() {
  frames = []
  nextFrameId = 0
  cancelledIds = []
  const raf = vi
    .spyOn(globalThis, 'requestAnimationFrame')
    .mockImplementation((cb: FrameRequestCallback) => {
      nextFrameId += 1
      frames.push({ id: nextFrameId, cb: cb as unknown as () => void })
      return nextFrameId
    })
  const caf = vi
    .spyOn(globalThis, 'cancelAnimationFrame')
    .mockImplementation((id: number) => {
      cancelledIds.push(id)
      frames = frames.filter((f) => f.id !== id)
    })
  return { restore: () => { raf.mockRestore(); caf.mockRestore() } }
}

const FIT_PADDING = { top: '73px', right: '68px', bottom: '29px', left: '68px' }
let currentPadding = FIT_PADDING
let currentNodes: Array<{ id: string }> = []

vi.mock('@xyflow/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@xyflow/react')>()),
  useReactFlow: () => ({ fitView: fitViewSpy, getNodes: () => currentNodes }),
}))

vi.mock('../utils/computeFitPadding', () => ({
  computeFitPadding: () => currentPadding,
}))

function restoredGraph(): RestoreGraph {
  const nodes = [
    { id: 'n-decision', type: 'decision', position: { x: 400, y: 0 }, data: { label: 'Pick a vendor' } },
    { id: 'n-option-a', type: 'option', position: { x: 120, y: 260 }, data: { label: 'Vendor A' } },
    { id: 'n-option-b', type: 'option', position: { x: 680, y: 260 }, data: { label: 'Vendor B' } },
    { id: 'n-goal', type: 'goal', position: { x: 400, y: 540 }, data: { label: 'Lower total cost' } },
    { id: GHOST_OPTION_NODE_ID, type: 'option', position: { x: 940, y: 260 }, data: { label: 'Add an option' } },
  ] as unknown as RestoreGraph['nodes']
  const edges = [
    { id: 'e-1', source: 'n-decision', target: 'n-option-a' },
    { id: 'e-2', source: 'n-decision', target: 'n-option-b' },
    { id: 'e-3', source: 'n-option-a', target: 'n-goal' },
  ] as unknown as RestoreGraph['edges']
  return { nodes, edges }
}

function restore(graph: RestoreGraph) {
  currentNodes = graph.nodes.map((n) => ({ id: n.id }))
  useCanvasStore.getState().hydrateGraphSlice({ nodes: graph.nodes, edges: graph.edges })
}

/**
 * The user's Auto-arrange, as the store actually commits it. Re-lays out the
 * SAME nodes (same ids -> same model key) at new positions, which is what
 * `applyLayout` does, and stamps the initiator 'user'.
 */
function userAutoArrange() {
  const s = useCanvasStore.getState()
  const relaid = s.nodes.map((n, i) => ({ ...n, position: { x: 50 + i * 300, y: 50 + i * 200 } }))
  useCanvasStore.setState({
    nodes: relaid,
    layoutVersion: useCanvasStore.getState().layoutVersion + 1,
    pendingLayout: false,
    lastLayoutInitiatedBy: 'user',
  } as never)
}

describe('Auto-arrange on a RELOADED model (restore state class)', () => {
  let rafSpy: ReturnType<typeof spyOnRaf>

  beforeEach(() => {
    useCanvasStore.getState().resetCanvas()
    useCanvasStore.setState({ layoutVersion: 0, pendingLayout: false, layoutInProgress: false } as never)
    fitViewSpy.mockReset()
    currentPadding = FIT_PADDING
    currentNodes = []
    rafSpy = spyOnRaf()
  })

  afterEach(() => { rafSpy.restore(); vi.restoreAllMocks() })

  const flushFrames = () => act(() => {
    const due = frames
    frames = []
    due.forEach((f) => f.cb())
  })

  it('ARM A (reloaded): user Auto-arrange after a restore re-frames the camera', () => {
    renderHook(() => useFitViewOnLayoutVersion())

    act(() => { restore(restoredGraph()) })
    flushFrames()
    // The restore trigger owns this one.
    expect(fitViewSpy, 'precondition: the restore fit ran').toHaveBeenCalledTimes(1)
    expect(useCanvasStore.getState().layoutVersion, 'precondition: reloaded class').toBe(0)

    fitViewSpy.mockReset()
    act(() => { userAutoArrange() })
    flushFrames()

    expect(fitViewSpy, 'ARM A: Auto-arrange must re-frame on a reloaded model').toHaveBeenCalledTimes(1)
  })

  const measureAll = (graph: RestoreGraph) =>
    useCanvasStore.getState().onNodesChange(
      graph.nodes.map((n) => ({
        id: n.id,
        type: 'dimensions',
        dimensions: { width: 180, height: 64 },
        resizing: false,
      })) as never,
    )

  it('ARM A2 (reloaded, NON-QUIESCENT): measurement between the commit and the frame', () => {
    renderHook(() => useFitViewOnLayoutVersion())
    const graph = restoredGraph()
    act(() => { restore(graph) })
    flushFrames()
    fitViewSpy.mockReset()

    act(() => { userAutoArrange() })
    // PIN THE PRECONDITION (CLAUDE.md trap 13b): a fit really was scheduled, so
    // what follows is about the frame surviving the churn and not about one
    // never having been asked for.
    const scheduled = frames.map((f) => f.id)
    expect(scheduled, 'the layout trigger scheduled no frame — this arm would prove nothing').toHaveLength(1)

    // Interleave the product's own measurement path, as the live canvas does.
    const nodesBefore = useCanvasStore.getState().nodes
    act(() => { measureAll(graph) })
    // ...and pin that the churn REALLY happened: a no-op measurement would make
    // this arm a duplicate of ARM A wearing a different name.
    expect(useCanvasStore.getState().nodes, 'measurement was a no-op — no churn occurred').not.toBe(nodesBefore)

    flushFrames()

    expect(fitViewSpy, 'ARM A2: churn between commit and frame lost the re-frame').toHaveBeenCalledTimes(1)
  })

  it('ARM A3 (reloaded, camera CLAIMED by the user first): Auto-arrange still re-frames', async () => {
    const { claimCameraForUser } = await import('../utils/userCameraClaim')
    const { currentModelKey } = await import('../utils/currentModelKey')
    renderHook(() => useFitViewOnLayoutVersion())
    const graph = restoredGraph()
    act(() => { restore(graph) })
    flushFrames()
    fitViewSpy.mockReset()

    // The user presses "Show whole model" — the claim is now outstanding for
    // THIS model, which is the state the layout guard's key conjunct reads.
    act(() => { claimCameraForUser(currentModelKey()) })

    act(() => { userAutoArrange() })
    act(() => { measureAll(graph) })
    flushFrames()

    expect(fitViewSpy, 'ARM A3: a claimed camera suppressed the user\'s own Auto-arrange').toHaveBeenCalledTimes(1)
  })

  it('ARM B (fresh): user Auto-arrange after a product layout re-frames the camera', () => {
    renderHook(() => useFitViewOnLayoutVersion())

    act(() => { restore(restoredGraph()) })
    flushFrames()
    fitViewSpy.mockReset()

    // A product layout has already run this session (the fresh-draft path).
    act(() => {
      useCanvasStore.setState({
        nodes: useCanvasStore.getState().nodes.map((n, i) => ({ ...n, position: { x: i * 10, y: i * 10 } })),
        layoutVersion: 1,
        pendingLayout: false,
        lastLayoutInitiatedBy: 'product',
      } as never)
    })
    flushFrames()
    fitViewSpy.mockReset()

    act(() => { userAutoArrange() })
    flushFrames()

    expect(fitViewSpy, 'ARM B: Auto-arrange must re-frame on a fresh model').toHaveBeenCalledTimes(1)
  })
})
