/**
 * Exercise the actual Fit button, layout and camera. The geometry cases supply DOM sizes
 * and control when React Flow receives them, since jsdom does not lay out cards.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { View } from '../client'
import { cameraFrame, REVEAL_MS, ViewCanvas } from '../ViewCanvas'
import { useViewStore } from '../store'
import { useMe } from '../../olumiCore/me'
import { useCanvasStore } from '../../canvas/store'
import type { Viewport } from '@xyflow/react'
import { causalInputs, drawViewCanvas } from '../canvas'
import { QUESTION } from '../layout'
import { useLayoutStore } from '../../canvas/layoutStore'
import { setLevel } from '../v12/simpleStore'
import { useReveal } from '../reveal'
import { openEvidence } from '../RevealMarks'
import { FOOT_GUTTER } from '../footClear'
import { READABLE_WHOLE_ZOOM } from '../camera'
import { frameTop } from '../regions'
import { computeFitPadding } from '../../canvas/utils/computeFitPadding'
import { paddingToInsets } from '../../canvas/utils/cameraComfort'
import { LOD_BODY_HIDDEN_ZOOM, LOD_BODY_RESTORED_ZOOM } from '../../canvas/utils/zoomLegibility'

const harness = vi.hoisted(() => ({
  zoom: 1,
  viewportZoom: 1,
  moves: [] as Viewport[],
  layout: undefined as typeof import('../layout').causalPlaces | undefined,
  settled: undefined as ReturnType<typeof import('../canvas').useLayoutSettled>['layout'] | undefined,
}))
vi.mock('../layout', async (original) => {
  const real = await original<typeof import('../layout')>()
  return { ...real, causalPlaces: (...args: Parameters<typeof real.causalPlaces>) => (harness.layout ?? real.causalPlaces)(...args) }
})
vi.mock('../canvas', async (original) => {
  const real = await original<typeof import('../canvas')>()
  return { ...real, useLayoutSettled: (on: boolean) => {
    const result = real.useLayoutSettled(on)
    harness.settled = result.layout
    return result
  } }
})
vi.mock('@xyflow/react', async (original) => {
  const rf = await original<typeof import('@xyflow/react')>()
  const { useCallback } = await import('react')
  return {
    ...rf,
    // Deliver size changes only through the test-controlled ResizeObserver.
    useUpdateNodeInternals: () => () => undefined,
    ReactFlow: (props: import('@xyflow/react').ReactFlowProps) =>
      <rf.ReactFlow {...props} defaultViewport={{ x: 0, y: 0, zoom: harness.zoom }} />,
    useReactFlow: () => {
      const instance = rf.useReactFlow()
      const move = instance.setViewport
      const setViewport = useCallback((vp: Viewport) => {
        harness.moves.push(vp)
        harness.viewportZoom = vp.zoom
        return move(vp, { duration: 0 })
      }, [move])
      // jsdom has no viewport geometry for React Flow's zoom-button centering.
      const zoomBy = (factor: number) => {
        harness.viewportZoom = instance.getZoom() * factor
        return move({ ...instance.getViewport(), zoom: harness.viewportZoom }, { duration: 0 })
      }
      return { ...instance, setViewport, zoomIn: () => zoomBy(1.2), zoomOut: () => zoomBy(0.8) }
    },
  }
})

const refs = vi.hoisted(() => ({ moved: null as { current: number } | null, activity: null as { current: { at: number; active: boolean } } | null }))
vi.mock('../replyInView', async (orig) => {
  const real = await orig<typeof import('../replyInView')>()
  return { ...real, useReplyInView: (...a: Parameters<typeof real.useReplyInView>) => { refs.moved = a[0]; refs.activity = a[1]; return real.useReplyInView(...a) } }
})
// As in leftToolbar.spec: keep the mounted canvas; omit the dock and attention card, which need the whole app.
vi.mock('../../canvas/components/OutputsDock', () => ({ OutputsDock: () => null }))
vi.mock('../../canvas/components/OlumiAttentionCard', () => ({ OlumiAttentionCard: () => null }))
vi.mock('../../olumiCore/lane', async (real) => ({ ...(await real<object>()), isOlumiCoreLane: () => true }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: 'u1', accessToken: null }), supabase: {} }))
vi.mock('../../canvas/nodes/shared/savedGraph', () => ({ useSavedGraphRead: () => ({ status: 'none' }), useSavedGraph: () => null }))

const golden: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/s_ce285b3617bb.view.json'), 'utf8'))
const before: View = { ...golden, chat: golden.chat.slice(0, 1) } // turn 12 only: the reply already on screen
const after: View = golden // turn 14 arrives, naming cards that are on the board
const TICK = 250

type Spy = { mock: { calls: unknown[][]; results: Array<{ value: unknown }> }; mockRestore: () => void }
let setIntervalSpy: Spy, clearIntervalSpy: Spy
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] })
  vi.setSystemTime(new Date('2026-11-14T12:00:00Z'))
  setIntervalSpy = vi.spyOn(globalThis, 'setInterval'); clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
  refs.moved = null; refs.activity = null
  useViewStore.setState({ uuid: 'u', sid: before.id, view: before, status: 'ready', error: null, stale: false, at: null })
  useMe.setState({ me: { id: before.you_id, name: before.you }, status: 'ready' })
  useCanvasStore.setState({ nodes: [], edges: [] })
})
afterEach(() => {
  cleanup(); setIntervalSpy.mockRestore(); clearIntervalSpy.mockRestore(); vi.useRealTimers()
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null, at: null })
  useMe.setState({ me: null, status: 'none' })
  useCanvasStore.setState({ nodes: [], edges: [] })
})

/** The 250 ms intervals the camera hooks arm, created after `from` calls of setInterval, and not yet cleared. */
const pendingSince = (from: number): unknown[] => setIntervalSpy.mock.calls.flatMap((c, i) => (i >= from && c[1] === TICK ? [setIntervalSpy.mock.results[i]!.value] : []))
  .filter((h) => !clearIntervalSpy.mock.calls.some((x) => x[0] === h))
const fitButton = () => screen.getByRole('button', { name: 'Fit to view' })
function mountThenReplyArrives() {
  render(<div style={{ width: 1232, height: 704 }}><ViewCanvas /></div>)
  const from = setIntervalSpy.mock.calls.length // taken before the arrival: whatever the canvas armed on mounting is not the reply's
  act(() => { useViewStore.setState({ view: after }) })
  return from
}

describe('the canvas\'s own Fit button, pressed on the real canvas', () => {
  it('FH1 catch: it counts as the person\'s own move (movedAt rises by one) and stamps the activity as no drag, as the zoom buttons do', () => {
    render(<div style={{ width: 1232, height: 704 }}><ViewCanvas /></div>)
    expect(refs.moved, 'the canvas mounted the reply hook with its refs').not.toBeNull()
    const moves = refs.moved!.current
    fireEvent.click(fitButton())
    expect(refs.moved!.current).toBe(moves + 1)
    expect(refs.activity!.current).toEqual({ at: Date.now(), active: false })
  })
  it('FH2 catch: a reply\'s settling timer, pending when Fit is pressed, is released on the next tick', () => {
    const from = mountThenReplyArrives()
    expect(pendingSince(from).length, 'precondition: the new reply armed a timer that is still pending').toBeGreaterThan(0)
    fireEvent.click(fitButton())
    act(() => { vi.advanceTimersByTime(TICK + 10) })
    expect(pendingSince(from), 'every timer the reply armed has been released').toEqual([])
  })
  it('FH2b control: with no Fit, the timers the reply armed are still pending a tick later (so FH2 releases something real)', () => {
    const from = mountThenReplyArrives()
    act(() => { vi.advanceTimersByTime(TICK + 10) })
    expect(pendingSince(from).length).toBeGreaterThan(0)
  })
})

describe('Fit uses the committed layout and the face it lands on', () => {
  const aim = 'secure_funding'
  const option = 'continue_outreach'
  const ids = [QUESTION, option, aim]
  const pane = { width: 1232, height: 704 }
  const positions = (foot: number) => new Map(ids.map((id, i) => [id, { x: 0, y: [0, 160, foot][i]! }]))
  const revealed: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/j1/strategy-reveal-split.core-261df1d4.view3.json'), 'utf8'))
  const evidence = { ...revealed.evidence[0]!, concerns: [aim] }
  const view: View = {
    ...before,
    evidence: [evidence],
    model: { ...before.model!, cards: before.model!.cards.filter((c) => ids.includes(c.id)), links: [] },
  }
  const tick = async (frames = 1) => {
    for (let i = 0; i < frames; i++) await act(async () => { await vi.advanceTimersByTimeAsync(16) })
  }
  let report: (id: string) => void
  let heightOf: (node: HTMLElement) => number
  let widthOf: (node: HTMLElement) => number
  let nodeWidth: number
  let dockLeft: number
  let spacing: number
  let faceChanges: boolean[]
  let unsubscribe: () => void

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
    harness.zoom = 1
    harness.viewportZoom = 1
    harness.moves.length = 0
    harness.layout = undefined
    harness.settled = undefined
    spacing = useLayoutStore.getState().nodeSpacing
    heightOf = () => 100
    nodeWidth = 200
    widthOf = () => nodeWidth
    dockLeft = pane.width
    faceChanges = []
    useCanvasStore.setState({ lodRung: 'full' })
    unsubscribe = useCanvasStore.subscribe((next, prev) => {
      if ((next.lodRung === 'line') !== (prev.lodRung === 'line')) faceChanges.push(next.lodRung === 'line')
    })
    useViewStore.setState({ view })
    setLevel('simple')
    const observed = new Map<Element, () => void>()
    vi.stubGlobal('DOMMatrixReadOnly', class {
      m22: number
      constructor(transform: string) { this.m22 = Number(/scale\(([^)]+)\)/.exec(transform)?.[1] ?? 1) }
    })
    vi.stubGlobal('ResizeObserver', class {
      constructor(private callback: ResizeObserverCallback) {}
      observe(el: Element) { observed.set(el, () => this.callback([{ target: el } as ResizeObserverEntry], this)) }
      unobserve(el: Element) { observed.delete(el) }
      disconnect() {}
    })
    report = (id) => {
      const el = document.querySelector(`.react-flow__node[data-id="${id}"]`)!
      expect(observed.has(el)).toBe(true)
      observed.get(el)!()
    }
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.matches('.react-flow__node') ? widthOf(this) : pane.width
    })
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.matches('.react-flow__node') ? heightOf(this) : pane.height
    })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.matches('.react-flow')) return new DOMRect(0, 0, pane.width, pane.height)
      if (this.matches('aside[aria-label="Outputs dock"]')) return new DOMRect(dockLeft, 0, pane.width - dockLeft, pane.height)
      return new DOMRect()
    })
  })
  afterEach(() => {
    unsubscribe()
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    useLayoutStore.setState({ nodeSpacing: spacing })
    setLevel('working', view.id)
    useReveal.setState({ card: null, evidence: null, selected: null, opens: 0 })
    harness.layout = undefined
  })

  function mount(foot: number, oldHeight: number, unmeasured: readonly string[] = []) {
    drawViewCanvas(view.model!, positions(foot))
    useCanvasStore.setState((s) => ({
      nodes: s.nodes.map((n) => ({ ...n, measured: unmeasured.includes(n.id) ? undefined : { width: nodeWidth, height: oldHeight } })),
    }))
    render(<ViewCanvas />)
  }

  it('follows the opening layout and staggered measurements without an automatic overwrite', async () => {
    let finish!: () => void
    const pending = new Promise<void>((resolve) => { finish = resolve })
    harness.layout = async () => { await pending; return positions(930) }
    heightOf = (node) => node.dataset.id === aim ? 180 : 140
    mount(300, 100)
    fireEvent.click(fitButton())
    await tick(5)
    expect(harness.moves, 'the cached same-face boxes are still awaiting the opening layout').toEqual([])
    expect(screen.getByTestId('view-canvas')).toHaveClass('ok-board-unframed')
    await act(async () => { await vi.advanceTimersByTimeAsync(REVEAL_MS) })
    expect(screen.getByTestId('view-canvas')).not.toHaveClass('ok-board-unframed')
    expect(harness.moves, 'the reveal timeout can show an unsettled board without framing it').toEqual([])

    await act(async () => { finish() })
    for (const id of ids) {
      expect(harness.moves, 'React Flow still holds stale dimensions').toEqual([])
      act(() => report(id))
      await tick(4)
    }
    expect(harness.moves).toHaveLength(1)
    const [vp] = harness.moves
    const moved = useCanvasStore.getState().nodes.find((n) => n.id === aim)!
    expect(moved.position.y).toBe(930)
    expect(vp!.y + (moved.position.y + 180) * vp!.zoom).toBeLessThanOrEqual(pane.height - FOOT_GUTTER + 0.01)
    await tick(120)
    expect(harness.moves).toHaveLength(1)
  })

  it.each([false, true])('uses a single face for zoom and translation (evidence open: %s)', async (openDuringWait) => {
    harness.zoom = LOD_BODY_HIDDEN_ZOOM - 0.02
    useCanvasStore.setState({ lodRung: 'line' })
    heightOf = (node) => node.querySelector('[data-lod-far-title]') ? 65 : 1050
    harness.layout = async () => positions(430)
    mount(430, 65)
    act(() => useCanvasStore.setState((s) => ({
      nodes: s.nodes.map((n) => n.id !== option ? n : { ...n, position: { x: -30, y: -230 } }),
    })))
    faceChanges.length = 0
    fireEvent.click(fitButton())
    await tick(3)
    if (openDuringWait) {
      expect(harness.moves).toEqual([])
      act(() => openEvidence(evidence.id, aim))
      await tick(45)
      expect(harness.moves).toHaveLength(1)
      expect(harness.moves[0]!.zoom).toBeGreaterThanOrEqual(0.9)
      await tick(100)
      expect(harness.moves).toHaveLength(1)
      return
    }
    for (let i = 0; i < 5; i++) {
      act(() => ids.forEach(report))
      await tick(4)
    }
    expect(harness.moves).toHaveLength(1)
    const [vp] = harness.moves
    expect(vp!.zoom).toBeLessThan(LOD_BODY_RESTORED_ZOOM)
    expect(useCanvasStore.getState().lodRung).toBe('line')
    const nodes = useCanvasStore.getState().nodes
    const top = Math.min(...nodes.map((n) => n.position.y))
    const bottom = Math.max(...nodes.map((n) => n.position.y + 65))
    expect(top).toBe(-230)
    expect(vp!.y + top * vp!.zoom).toBeCloseTo(frameTop(paddingToInsets(computeFitPadding()).top))
    expect(vp!.y + bottom * vp!.zoom).toBeLessThanOrEqual(pane.height - FOOT_GUTTER + 0.01)
    expect(faceChanges).toEqual([false, true])
    await tick(120)
    expect(harness.moves).toHaveLength(1)
  })

  it('refreshes the row budget when a late dock position changes the room without a resize notification', async () => {
    dockLeft = 1000
    render(<aside aria-label="Outputs dock" />)
    const layout = vi.fn(async (..._args: Parameters<typeof import('../layout').causalPlaces>) => positions(230))
    harness.layout = layout
    mount(230, 100)
    await tick(8)
    const before = layout.mock.lastCall?.[2]?.row?.budget
    expect(before).toBeGreaterThan(0)

    dockLeft = 750
    harness.moves.length = 0
    fireEvent.click(fitButton())
    await tick(10)
    expect(layout.mock.lastCall?.[2]?.row?.budget).toBeLessThan(before!)
    expect(harness.moves).toHaveLength(1)
  })

  it.each([false, true])('frames an off-screen aim with no measurement (Fit pressed: %s)', async (fitPressed) => {
    const foot = 850
    harness.layout = async () => positions(foot)
    // jsdom supplies no live box for this off-screen card and its observer never reports it.
    heightOf = (node) => node.dataset.id === aim ? 0 : 100
    mount(foot, 100, [option, aim])
    if (fitPressed) fireEvent.click(fitButton())
    await tick(4)
    expect(harness.moves, 'an unmeasured on-screen card still holds the frame').toEqual([])
    act(() => report(option))
    await tick(8)

    expect(harness.moves).toHaveLength(1)
    const [vp] = harness.moves
    const card = view.model!.cards.find((c) => c.id === aim)!
    expect(useCanvasStore.getState().nodes.find((n) => n.id === aim)?.measured).toBeUndefined()
    expect(vp!.y + (foot + card.h) * vp!.zoom).toBeCloseTo(pane.height - FOOT_GUTTER)
  })

  it('preserves the settled Detailed Fit viewport', async () => {
    setLevel('working')
    harness.layout = async () => positions(190)
    nodeWidth = causalInputs(view.model!).size.get(option)!.width
    mount(190, 100)
    await tick(10)
    const nodes = useCanvasStore.getState().nodes
    const expected = cameraFrame({ full: { zoom: 1, nodes } }, pane)
    expect(expected).not.toBeNull()
    harness.moves.length = 0
    fireEvent.click(fitButton())
    await tick(5)
    expect(harness.moves).toEqual([expected])
  })

  it('fits a narrow rightmost Detailed card to its measured width', async () => {
    setLevel('working')
    act(() => useLayoutStore.setState({ nodeSpacing: spacing + 1 }))
    const placed = positions(240)
    placed.set(aim, { x: 900, y: 240 })
    const sizes = causalInputs(view.model!).boxes
    const widths = new Map(ids.map((id) => [id, id === aim ? 90 : sizes.get(id)!.width]))
    widthOf = (node) => widths.get(node.dataset.id!)!
    harness.layout = async () => placed
    mount(240, 100)
    act(() => ids.forEach(report))
    await tick(12)

    const nodes = useCanvasStore.getState().nodes
    expect(nodes.find((n) => n.id === aim)).toMatchObject({ position: { x: 900, y: 240 }, measured: { width: 90 } })
    expect(sizes.get(aim)!.width).toBeGreaterThan(90)
    const expected = cameraFrame({ full: { zoom: 1, nodes } }, pane)
    expect(expected).not.toBeNull()
    harness.moves.length = 0
    fireEvent.click(fitButton())
    await tick(8)
    expect(harness.moves).toEqual([expected])
  })

  it('commits Auto-arrange when a pending card resize gives way to a newer measurement', async () => {
    setLevel('working')
    harness.layout = async () => positions(320)
    mount(320, 100)
    await tick(10)
    const aimPosition = () => useCanvasStore.getState().nodes.find((n) => n.id === aim)?.position
    act(() => useCanvasStore.getState().onNodesChange([{ id: aim, type: 'position', position: { x: 450, y: 620 }, dragging: false }]))
    expect(aimPosition()).toEqual({ x: 450, y: 620 })

    let finishResize!: (places: ReturnType<typeof positions>) => void
    let finishArrange!: (places: ReturnType<typeof positions>) => void
    let finishNextResize!: (places: ReturnType<typeof positions>) => void
    const resize = new Promise<ReturnType<typeof positions>>((resolve) => { finishResize = resolve })
    const arrange = new Promise<ReturnType<typeof positions>>((resolve) => { finishArrange = resolve })
    const nextResize = new Promise<ReturnType<typeof positions>>((resolve) => { finishNextResize = resolve })
    const layout = vi.fn(() => nextResize)
      .mockImplementationOnce(() => resize)
      .mockImplementationOnce(() => arrange)
    harness.layout = layout
    heightOf = (node) => node.dataset.id === aim ? 120 : 100
    act(() => report(aim))
    await tick(3)
    expect(layout).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'More view options' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Auto-arrange' }))
    expect(layout).toHaveBeenCalledTimes(2)

    const stalePositions = positions(570)
    stalePositions.set(option, { x: 200, y: 160 })
    await act(async () => finishResize(stalePositions))
    expect(aimPosition()).toEqual({ x: 450, y: 620 })
    expect(useCanvasStore.getState().nodes.find((n) => n.id === option)?.position.x).toBe(0)
    heightOf = (node) => node.dataset.id === aim ? 140 : 100
    act(() => report(aim))
    await tick(3)
    await act(async () => finishArrange(positions(350)))
    expect(aimPosition()).toEqual({ x: 0, y: 350 })
    expect(layout).toHaveBeenCalledTimes(3)
    await act(async () => finishNextResize(positions(380)))
    await tick(10)
    expect(aimPosition()).toEqual({ x: 0, y: 380 })
    expect(harness.settled!.read()?.nodes.find((n) => n.id === aim)?.measured?.height).toBe(140)
  })

  it('discards an Auto-arrange result for A that finishes after B has been certified', async () => {
    dockLeft = 1020
    render(<aside aria-label="Outputs dock" />)
    const textA = view.model!.question.text
    const next: View = {
      ...view,
      version: { ...view.version!, n: view.version!.n + 1 },
      model: { ...view.model!, question: { ...view.model!.question, text: 'Version B' } },
    }
    let finishA!: (places: ReturnType<typeof positions>) => void
    let startedA = false
    harness.layout = async (model) => {
      if (model.question.text !== textA) return positions(470)
      if (dockLeft === 1020) return positions(241)
      startedA = true
      return new Promise((resolve) => { finishA = resolve })
    }
    mount(241, 100)
    await tick(10)
    expect(harness.settled!.read()?.nodes.find((n) => n.id === aim)?.position.y).toBe(241)

    dockLeft = 800
    fireEvent.click(screen.getByRole('button', { name: 'More view options' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Auto-arrange' }))
    expect(startedA).toBe(true)
    act(() => useViewStore.setState({ view: next }))
    await tick(16)
    const settledB = harness.settled!.read()!
    expect(settledB.nodes.find((n) => n.id === aim)?.position.y).toBe(470)

    await act(async () => finishA(1500))
    expect(harness.settled!.read()).toBe(settledB)
    expect(useCanvasStore.getState().nodes.find((n) => n.id === aim)?.position.y).toBe(470)
    harness.moves.length = 0
    fireEvent.click(fitButton())
    await tick(8)
    expect(harness.moves).toHaveLength(1)
    const vp = harness.moves[0]!
    expect(vp.y + (470 + 100) * vp.zoom).toBeLessThanOrEqual(pane.height - FOOT_GUTTER)
    expect(vp.zoom).toBeGreaterThan(0.9)
  })

  it('uses the job size for an off-screen card and excludes a cached height from the other face', async () => {
    const foot = 2400
    const measuredHeight = 172
    const layout = vi.fn(async (..._args: Parameters<typeof import('../layout').causalPlaces>) => positions(foot))
    harness.layout = layout
    heightOf = (node) => node.dataset.id === aim ? 0 : 100
    mount(foot, 100)
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    act(() => useCanvasStore.setState((s) => ({
      nodes: s.nodes.map((n) => n.id === aim ? { ...n, measured: { width: 200, height: measuredHeight } } : n),
    })))
    await tick(12)
    expect(layout.mock.lastCall?.[1].get(aim)?.height).toBe(measuredHeight)
    expect(harness.settled!.read()?.nodes.find((n) => n.id === aim)?.measured).toEqual(layout.mock.lastCall?.[1].get(aim))

    heightOf = (node) => node.dataset.id === aim ? 0 : 65
    act(() => useCanvasStore.getState().setLodRung('line'))
    act(() => [QUESTION, option].forEach(report))
    await tick(16)
    const size = layout.mock.lastCall?.[1].get(aim)
    const settled = harness.settled!.read()
    expect(settled?.far).toBe(true)
    expect(useCanvasStore.getState().nodes.find((n) => n.id === aim)?.measured?.height).toBe(measuredHeight)
    expect(size?.height).not.toBe(measuredHeight)
    expect(settled?.nodes.find((n) => n.id === aim)?.measured).toEqual(size)
  })

  it.each([true, false])('retries a rejected re-layout once (retry succeeds: %s)', async (succeeds) => {
    const foot = 916
    harness.layout = async () => positions(foot)
    mount(foot, 100)
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    await tick(30)
    const before = useCanvasStore.getState().nodes
    const cue = screen.getByTestId('view-below-cue').textContent
    expect(cue).toMatch(/more cards? below/)
    harness.moves.length = 0
    const resolved = vi.fn()
    const originalWait = harness.settled!.wait
    const wait = vi.spyOn(harness.settled!, 'wait').mockImplementation((signal) => originalWait(signal).then((snapshot) => {
      resolved(snapshot)
      return snapshot
    }))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const failedLayout = vi.fn().mockRejectedValue(new Error('layout failed'))
    if (succeeds) failedLayout.mockRejectedValueOnce(new Error('layout failed')).mockResolvedValueOnce(positions(280))
    harness.layout = failedLayout
    act(() => useLayoutStore.setState({ nodeSpacing: spacing + 1 }))
    fireEvent.click(fitButton())
    await tick(12)
    expect(failedLayout).toHaveBeenCalledTimes(2)
    expect(wait).toHaveBeenCalledTimes(1)
    if (succeeds) {
      expect(resolved).toHaveBeenCalledWith(expect.objectContaining({ nodes: expect.any(Array) }))
      expect(harness.moves).toHaveLength(1)
      expect(useCanvasStore.getState().nodes.find((n) => n.id === aim)?.position.y).toBe(280)
      expect(error).not.toHaveBeenCalled()
    } else {
      expect(resolved).toHaveBeenCalledWith(null)
      expect(harness.moves).toEqual([])
      expect(useCanvasStore.getState().nodes).toEqual(before)
      expect(screen.getByTestId('view-below-cue')).toHaveTextContent(cue!)
      expect(error).toHaveBeenCalledTimes(1)
    }
    expect(failedLayout).toHaveBeenCalledTimes(2)
  })

  it('finishes Detailed Fit on the full-face frame after zooming out', async () => {
    setLevel('working')
    const foot = 530
    heightOf = () => harness.viewportZoom < READABLE_WHOLE_ZOOM ? 130 : 80
    harness.layout = async () => positions(foot)
    mount(foot, 80)
    await tick(12)
    const snapshot = harness.settled!.read()
    expect(snapshot, 'full face has settled').not.toBeNull()
    const fullFrame = harness.moves[harness.moves.length - 1]!
    expect(fullFrame.zoom).toBeGreaterThanOrEqual(READABLE_WHOLE_ZOOM)
    expect(fullFrame.zoom).toBeLessThan(1)

    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    await tick(35)
    act(() => ids.forEach(report))
    await tick(10)
    harness.moves.length = 0
    fireEvent.click(fitButton())
    await tick(8)
    expect(harness.moves.map((move) => move.zoom)).toEqual([1])

    act(() => ids.forEach(report))
    await tick(12)
    expect(harness.moves).toHaveLength(2)
    expect(harness.moves[harness.moves.length - 1]).toEqual(fullFrame)
  })

  it('restores the Detailed viewport after two failed full-face attempts without starting another layout', async () => {
    setLevel('working')
    const foot = 530
    heightOf = () => harness.viewportZoom < READABLE_WHOLE_ZOOM ? 130 : 80
    harness.layout = async () => positions(foot)
    mount(foot, 80)
    await tick(12)
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    await tick(10)
    act(() => ids.forEach(report))
    await tick(10)
    expect(harness.settled!.read()).not.toBeNull()
    const originalZoom = harness.viewportZoom
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const layout = vi.fn(async () => positions(710))
      .mockImplementationOnce(() => new Promise(() => {})) // Wait for the full-face ResizeObserver reports.
      .mockRejectedValueOnce(new Error('full face failed'))
      .mockRejectedValueOnce(new Error('full face retry failed'))
    harness.layout = layout
    harness.moves.length = 0
    fireEvent.click(fitButton())
    await tick(5)
    expect(harness.moves.map((move) => move.zoom)).toEqual([1])
    expect(layout).toHaveBeenCalledTimes(1)
    act(() => ids.forEach(report))
    await tick(10)
    expect(harness.moves.map((move) => move.zoom)).toEqual([1, originalZoom])
    act(() => ids.forEach(report))
    await tick(14)

    expect(error).toHaveBeenCalledTimes(1)
    expect(layout).toHaveBeenCalledTimes(3) // One superseded job, then the measured job's two failed attempts.
    expect(useCanvasStore.getState().nodes.find((n) => n.id === aim)?.position.y).toBe(foot)
    expect(harness.settled!.read()?.nodes.find((n) => n.id === aim)?.measured?.height).toBe(130)
  })

})
