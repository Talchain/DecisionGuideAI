/**
 * "Show in the workspace" end to end: the control (ShowInWorkspace.tsx), its two sequences (show.ts), the snapshot (snapshot.ts) and the
 * canvas's side of the camera port (canvasSide.ts, the REAL `makeShowCameraPort`), on the real stores, over a fake canvas this spec lays
 * out itself. No network and no real React Flow: core's reads are answered here (setTeamFetch), React Flow's three camera calls are a
 * recorder, and the board settles only when this spec lays it out (`layOut`: exactly what boardOf draws for the View in the store, plus the
 * question). Every camera expectation is computed from the box of the NAMED cards as the fake canvas holds them.
 *
 * Fixtures are core's own Views as the repo holds them. Anything altered is marked INVENTED, keeps the real View shape and uses invented
 * words only:
 *   - storied(): one failure story (invented words) on a card no target is, and the pre-mortem gate set to 'chose' or 'closed' (the
 *     bookshop's own gate object, `state` changed). No fixture carries a failure story. S3, S4.
 *   - shutOpen: the closed bookshop with newsletter's badge flagged open, as the person had it. S3b.
 *   - pointing(): a real turn's next step pointed at other ids. S1, S3d, S4, S5, S6, S8, S9, S11. Turn ids 1 and 5 are control keys only.
 *   - S9's other sid, reader, version id and proposal id (the proposal object is golden/proposal.view.json's own, its id changed).
 *   - the 503's error words; the fake canvas's places and the viewports.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const paneNow = vi.hoisted(() => ({ value: { size: { w: 1232, h: 704 }, inset: { left: 0, top: 56, right: 420, bottom: 0 } } }))
vi.mock('../../../revealCamera', async (orig) => ({
  ...(await orig<typeof import('../../../revealCamera')>()),
  // A fresh object per call, as the real one measures the pane each time: a pane change is a new value, never the same object mutated.
  freePane: () => ({ size: { ...paneNow.value.size }, inset: { ...paneNow.value.inset } }),
}))
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))

import { act, cleanup, fireEvent, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setTeamFetch } from '../../../../olumiCore/team/api'
import { QUESTION, VIEW_CARD, boardOf, cardGroupsOf, drawnModelOf, groupOpen, inputIdsOf, inputsFolded, setGroupOpen, setInputsOpen, useCanvasStore, useInputsOpen, useLayer, useSimpleLevel, useViewLens, useViewStore, type LayerId, type Opened, type View } from '../deps'
import { setLevel, showSimple, showWholeModel } from '../../simpleStore'
import { registerShowCameraPort, showHolds, type Box, type Pane, type Viewport } from '../cameraPort'
import { makeShowCameraPort, type CanvasSide } from '../canvasSide'
import { COULD_NOT_SHOW, MOVE_MS, SETTLE_MS, resetShow, returnToBefore } from '../show'
import { RETURN_TO_BEFORE, SHOW_IN_WORKSPACE, ShowInWorkspace } from '../ShowInWorkspace'
import { cameraFor, layerFor, lensSetsBack, planShow, selectionSetsBack, type Next } from '../targets'

// ── fixtures ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const read = (file: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView', file), 'utf8')) as View
const golden = read('golden/s_ce285b3617bb.view.json')
const closed = read('fixtures/j1/bookshop-v1.core-5d8a009b.view3.json')
const opened = read('fixtures/j1/bookshop-v1-open.core-5d8a009b.view3.json')
const growth = read('fixtures/sc01/growth16.core-5d8a009b.view3.json')
const european = read('fixtures/real/european-22cards.view3.json')
const hiring = read('fixtures/real/hiring.view3.json')
const proposalShape = read('golden/proposal.view.json').proposal!

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const nextOf = (view: View, turn: number): Next => view.chat.find((t) => t.id === turn)!.answer!.next
/** A reply's next step in the real shape, pointing at the ids given (INVENTED pointer; the words are the real turn's own). */
const pointing = (base: Next, at: string | null, about: string[]): Next => ({ ...base, at, about })
const cardOf = (view: View, id: string) => view.model!.cards.find((c) => c.id === id)!
const GATE = closed.session.pre_mortem!
/** INVENTED: one failure story in invented words resting on `on`, and the pre-mortem gate at `state` (the bookshop's own gate, in core's shape). */
function storied(v: View, on: string, state: 'chose' | 'wrote' | 'closed' = 'chose'): View {
  const out = clone(v)
  cardOf(out, on).failed = [{ n: 1, title: 'Invented story: the shelves were never restocked', olumi: { glyph: '◇', title: 'Invented mark' } }]
  out.session = { ...out.session, pre_mortem: { ...clone(GATE), state } }
  return out
}
/** INVENTED pointer: european's chat has no reply, so a real turn's next step is pointed at one of its input cards. */
const atInput = pointing(nextOf(golden, 14), 'starting_customers', ['starting_customers'])

// ── the fake canvas: React Flow's three camera calls and the canvas's own three things, recorded ─────────────────────────────────────
const W = 260, H = 150
type At = { x: number; y: number }
const V0: Viewport = { x: 0, y: 0, zoom: 1 }
/** Every write to "the person holds the camera", with the frames that made it: a row's message names who wrote last. */
const movedLog: string[] = []
const heldFlag = { v: false }
const userMoved = {
  get current(): boolean { return heldFlag.v },
  set current(v: boolean) { heldFlag.v = v; movedLog.push(`${v} @ ${(new Error().stack ?? '').split('\n').slice(2, 6).map((l) => l.trim().replace(/^at /, '')).join(' < ')}`) },
}
const rf = {
  vp: { ...V0 } as Viewport,
  at: new Map<string, At>(),
  sets: [] as { to: Viewport; opts: { duration: number }; holds: boolean }[],
  fits: 0,
  /** The fits asked for while a show or a return held the board: the show's own, never the canvas's. */
  fitsHeld: 0,
  hands: 0,
  userMoved,
}
const side: CanvasSide = {
  getViewport: () => ({ ...rf.vp }),
  setViewport: (to, opts) => { rf.sets.push({ to: { ...to }, opts: { ...opts }, holds: showHolds() }); rf.vp = { ...to }; return Promise.resolve(true) },
  getInternalNode: (id) => { const p = rf.at.get(id); return p === undefined ? undefined : { measured: { width: W, height: H }, internals: { positionAbsolute: { ...p } } } },
  userMoved: rf.userMoved,
  hand: () => { rf.hands += 1 },
  fit: () => { rf.fits += 1; if (showHolds()) rf.fitsHeld += 1 },
}
let unregister: (() => void) | null = null
/** The canvas registers its port (a new one each call, as a remounted canvas would). */
const register = (): void => { unregister?.(); unregister = registerShowCameraPort(makeShowCameraPort(side)) }

/** Off the free canvas at the start viewport: every card is far below and right, four to a row. */
const placeOf = (i: number, dy = 0): At => ({ x: 2000 + (i % 4) * 300, y: 2000 + Math.floor(i / 4) * 220 + dy })
/**
 * The fake canvas lays the board out: exactly what boardOf draws for the View in the store, plus the question, each measured. A node that
 * stays keeps its `selected` flag; links are rebuilt without theirs (as the real canvas's drawViewCanvas does).
 */
function layOut(places: Readonly<Record<string, At>> = {}, dy = 0): void {
  const model = useViewStore.getState().view!.model!
  const board = boardOf(model).model
  const ids = [QUESTION, ...board.cards.map((c) => c.id)]
  rf.at = new Map(ids.map((id, i) => [id, places[id] ?? placeOf(i, dy)]))
  const was = new Map(useCanvasStore.getState().nodes.map((n) => [n.id, n]))
  const nodes = ids.map((id) => ({ id, type: id === QUESTION ? 'viewQuestion' : VIEW_CARD, data: {}, position: rf.at.get(id)!, measured: { width: W, height: H }, ...(was.get(id)?.selected === true ? { selected: true } : {}) }))
  const drawn = new Set(ids)
  const edges = board.links.filter((l) => drawn.has(l.from) && drawn.has(l.to)).map((l) => ({ id: `${l.from}->${l.to}:${l.kind}`, source: l.from, target: l.to, type: 'viewLink', data: {} }))
  useCanvasStore.setState({ nodes: nodes as never, edges: edges as never })
  const pane = document.querySelector('.react-flow')!
  pane.innerHTML = ids.map((id) => `<div class="react-flow__node" data-id="${id}"></div>`).join('')
}
const lay = (places: Readonly<Record<string, At>> = {}, dy = 0): void => { act(() => { layOut(places, dy) }) }
/** The box around these cards as the fake canvas holds them. */
function boxOf(ids: readonly string[]): Box {
  for (const id of ids) expect(rf.at.has(id), `${id} is on the fake canvas`).toBe(true)
  const ps = ids.map((id) => rf.at.get(id)!)
  const x0 = Math.min(...ps.map((p) => p.x)), y0 = Math.min(...ps.map((p) => p.y))
  const x1 = Math.max(...ps.map((p) => p.x + W)), y1 = Math.max(...ps.map((p) => p.y + H))
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}
const pane = (): Pane => clone(paneNow.value)
const pulsing = (): string[] => Array.from(document.querySelectorAll('.react-flow__node.v10-pulse'), (e) => e.getAttribute('data-id') ?? '').sort()

// ── core's reads ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
type Answer = { status: number; body: unknown }
interface Read { readonly url: string; readonly open: Record<string, string[]> | null; readonly all: boolean; readonly holds: boolean; answered: boolean; answer(a: Answer): void }
let reads: Read[] = []
/** How core answers a read as it is made; null holds it until the row answers it. */
let route: (r: Read) => Answer | null = () => null
const ok = (view: View): Answer => ({ status: 200, body: view })
const unanswered = (): Read[] => reads.filter((r) => !r.answered)
function core(): void {
  setTeamFetch(((url: string) => new Promise((done) => {
    const q = new URL(url, 'http://core.invalid').searchParams
    const entry: Read = {
      url, open: q.has('open') ? (JSON.parse(q.get('open')!) as Record<string, string[]>) : null, all: q.get('all') === '1', holds: showHolds(), answered: false,
      // What `call` reads of a Response, and nothing more: a body that is all there.
      answer: (a) => { entry.answered = true; done({ ok: a.status >= 200 && a.status < 300, status: a.status, json: async () => clone(a.body) } as unknown as Response) },
    }
    reads.push(entry)
    const a = route(entry)
    if (a !== null) entry.answer(a)
  })) as unknown as typeof fetch)
}
const hasMonthly = (r: Read): boolean => r.open !== null && 'monthly_revenue' in r.open

// ── the page ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const UUID = '00000000-0000-4000-8000-00000000e2e5'
function install(view: View, was: Opened = { open: new Map(), all: false }): void {
  useViewStore.setState({ uuid: UUID, sid: view.id, view: clone(view), opened: was, status: 'ready', error: null, stale: false, at: null })
}
const openedNow = () => { const o = useViewStore.getState().opened; return { open: [...o.open].map(([k, v]) => [k, [...v]]), all: o.all } }
const selectionNow = () => {
  const s = useCanvasStore.getState()
  return { nodes: s.nodes.filter((n) => n.selected === true).map((n) => n.id), edges: s.edges.filter((e) => e.selected === true).map((e) => e.id), nodeIds: [...s.selection.nodeIds], edgeIds: [...s.selection.edgeIds], anchor: s.selection.anchorPosition }
}
function mount(turn: number, next: Next) {
  const r = render(<ShowInWorkspace turn={turn} next={next} />)
  return {
    ...r,
    button: (): HTMLButtonElement | null => r.container.querySelector<HTMLButtonElement>('[data-testid="show-in-workspace-button"]'),
    said: (): string | null => r.container.querySelector('[data-testid="show-in-workspace-said"]')?.textContent ?? null,
  }
}
const run = async (ms: number): Promise<void> => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }
const press = async (b: HTMLElement): Promise<void> => { await act(async () => { b.focus(); fireEvent.click(b) }) }
const answer = async (r: Read, a: Answer): Promise<void> => { await act(async () => { r.answer(a); await vi.advanceTimersByTimeAsync(1) }) }
/**
 * The Return key on the focused control, through user-event (its keydown and the click the platform makes of it). Testing Library's async
 * wrapper drains on a timer, which the fake clock holds, so the clock is moved a millisecond at a time until the key press has finished.
 */
async function enter(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  let done = false
  const pressed = user.keyboard('{Enter}').then(() => { done = true })
  for (let i = 0; i < 200 && !done; i += 1) await run(1)
  await pressed
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] })
  rf.vp = { ...V0 }; rf.at = new Map(); rf.sets = []; rf.fits = 0; rf.fitsHeld = 0; rf.hands = 0; rf.userMoved.current = false; movedLog.length = 0
  paneNow.value = { size: { w: 1232, h: 704 }, inset: { left: 0, top: 56, right: 420, bottom: 0 } }
  reads = []; route = () => null; core()
  const el = document.createElement('div'); el.className = 'react-flow'; document.body.appendChild(el)
  register()
})
afterEach(() => {
  // Read first: what the row left behind, before anything here aborts or answers it.
  const holding = showHolds(), left = unanswered().map((r) => r.url)
  try {
    cleanup()
    resetShow()
    unregister?.(); unregister = null
    for (const r of unanswered()) r.answer({ status: 503, body: { error: 'Invented words: the test is over.' } }) // nothing hangs into the next row
  } finally {
    setTeamFetch(null)
    useViewStore.setState({ uuid: null, sid: null, view: null, opened: { open: new Map(), all: false }, status: 'none', error: null, stale: false, at: null })
    useInputsOpen.setState({ open: {} }); useLayer.setState({ layer: 'full', sid: null }); useViewLens.setState({ lens: 'full' })
    useSimpleLevel.setState({ levels: {} }); try { window.localStorage.clear() } catch { /* nothing kept */ }
    useCanvasStore.setState({ nodes: [], edges: [], selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null } })
    document.querySelectorAll('.react-flow').forEach((e) => e.remove())
    vi.useRealTimers()
  }
  expect(left, 'every read the row made was answered within it').toStrictEqual([])
  expect(holding, 'no show or return still holds the board when the row ends').toBe(false)
})

// ── S1 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('S1 show, nothing folded (golden turn 14)', () => {
  const next = nextOf(golden, 14)
  const THREE = ['reported_cash_and_spend_basis', 'opening_cash', 'monthly_burn']
  it('asks for no read, moves nothing until the board is laid out, then moves once to exactly those three cards as the person\'s own move; the same focused button reads Return', async () => {
    expect(next.about).toStrictEqual(THREE)
    install(golden)
    const c = mount(14, next), button = c.button()!
    expect(button.textContent).toBe(SHOW_IN_WORKSPACE)
    await press(button)
    await run(500)
    expect(reads).toHaveLength(0)
    expect(rf.sets).toStrictEqual([])
    expect(showHolds()).toBe(true)
    lay()
    await run(100)
    const to = cameraFor(boxOf(THREE), pane(), V0)
    expect(to).not.toBeNull()
    expect(rf.sets).toStrictEqual([{ to, opts: { duration: MOVE_MS }, holds: true }])
    expect(rf.userMoved.current).toBe(true)
    expect(showHolds()).toBe(false)
    expect(c.button()).toBe(button)
    expect(button.textContent).toBe(RETURN_TO_BEFORE)
    expect(document.activeElement).toBe(button)
    await run(MOVE_MS)
    expect(pulsing()).toStrictEqual([...THREE].sort())
    expect(reads).toHaveLength(0)
  })
  it('reduced motion: the camera goes there at once (duration 0) and the cards are pulsed without waiting for a move', async () => {
    const was = window.matchMedia
    window.matchMedia = ((q: string) => ({ matches: q.includes('prefers-reduced-motion: reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
    try {
      install(golden); lay()
      const c = mount(14, next)
      await press(c.button()!); await run(100)
      expect(rf.sets).toStrictEqual([{ to: cameraFor(boxOf(THREE), pane(), V0), opts: { duration: 0 }, holds: true }])
      expect(pulsing()).toStrictEqual([...THREE].sort())
    } finally { window.matchMedia = was }
  })
  it('contrast: a reply naming other cards moves to another viewport, the box of exactly those', async () => {
    install(golden); lay()
    const c = mount(14, pointing(next, 'horizon', ['horizon', 'cash_survival']))
    await press(c.button()!); await run(100)
    const to = cameraFor(boxOf(['horizon', 'cash_survival']), pane(), V0)
    expect(rf.sets).toStrictEqual([{ to, opts: { duration: MOVE_MS }, holds: true }])
    expect(to).not.toStrictEqual(cameraFor(boxOf(THREE), pane(), V0))
  })
  it('contrast: cards already inside the free canvas move nothing, "the person holds the camera" keeps its value, and the control still reads Return', async () => {
    install(golden)
    lay({ reported_cash_and_spend_basis: { x: 20, y: 80 }, opening_cash: { x: 300, y: 80 }, monthly_burn: { x: 20, y: 300 } })
    expect(cameraFor(boxOf(THREE), pane(), V0)).toBeNull()
    rf.userMoved.current = false
    const c = mount(14, next), button = c.button()!
    await press(button); await run(400)
    expect(rf.sets).toStrictEqual([])
    expect(rf.userMoved.current).toBe(false)
    expect(showHolds()).toBe(false)
    expect(c.button()).toBe(button)
    expect(button.textContent).toBe(RETURN_TO_BEFORE)
  })
})

// ── S2 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('S2 show with a badge to open (bookshop: closed on screen, open as read)', () => {
  const next = nextOf(closed, 4)
  const records = [...cardOf(closed, 'monthly_revenue').badge!.records]
  it('the read carries monthly_revenue\'s records; nothing moves until it answers and the opened View is laid out; the target is the records now drawn as cards', async () => {
    expect([next.at, next.about]).toStrictEqual(['visits', ['visits', 'spend_per_visit']])
    install(closed); lay()
    const c = mount(4, next)
    await press(c.button()!); await run(50)
    expect(reads.map((r) => [r.open, r.all, r.holds])).toStrictEqual([[{ monthly_revenue: records }, false, true]])
    expect(rf.sets).toStrictEqual([])
    await answer(reads[0]!, ok(opened))
    await run(300)
    expect(rf.sets).toStrictEqual([]) // the fake canvas still holds the closed board
    expect(showHolds()).toBe(true)
    lay()
    await run(200)
    const to = cameraFor(boxOf(['visits', 'spend_per_visit']), pane(), V0)
    expect(rf.sets).toStrictEqual([{ to, opts: { duration: MOVE_MS }, holds: true }])
    expect(to).not.toStrictEqual(cameraFor(boxOf(['monthly_revenue']), pane(), V0))
    expect(showHolds()).toBe(false)
    expect(reads).toHaveLength(1)
    expect(c.button()!.textContent).toBe(RETURN_TO_BEFORE)
  })
})

// ── S3 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('S3 Return restores exactly what the show changed', () => {
  const SID = closed.id
  const EDGE = 'newsletter->monthly_revenue:through'
  const next = nextOf(closed, 4)
  const TARGETS = ['visits', 'spend_per_visit']
  const records = [...cardOf(closed, 'monthly_revenue').badge!.records]
  const shut = storied(closed, 'rival_sales'), open = storied(opened, 'rival_sales') // INVENTED: a failure story on rival_sales, gate 'chose'
  const CLEARED = { nodes: [], edges: [], nodeIds: [], edgeIds: [], anchor: null }

  /** Simple; the newsletter option's layer and "If it failed" on; newsletter's card and one link selected; the camera at `vp`. */
  function setUp(v: View, was: Opened, vp: Viewport, held: boolean): void {
    install(v, was)
    setLevel('simple', SID)
    lay()
    useLayer.setState({ layer: 'option:newsletter', sid: SID })
    useViewLens.setState({ lens: 'premortem' })
    useCanvasStore.setState((s) => ({
      nodes: s.nodes.map((n) => (n.id === 'newsletter' ? { ...n, selected: true } : n)),
      edges: s.edges.map((e) => (e.id === EDGE ? { ...e, selected: true } : e)),
      selection: { nodeIds: new Set(['newsletter']), edgeIds: new Set([EDGE]), anchorPosition: { x: 5, y: 7 } },
    }))
    rf.vp = { ...vp }; rf.userMoved.current = held
    route = (r) => ok(hasMonthly(r) ? open : v)
  }
  it('the fixtures: on the opened View the newsletter layer, the lens and the selected newsletter card each set a target back', () => {
    expect(layerFor(open, 'option:newsletter', TARGETS)).toBe('full')
    expect(lensSetsBack(open, 'premortem', TARGETS)).toBe(true)
    expect(selectionSetsBack(open.model, 'simple', 'newsletter', TARGETS)).toBe(true)
  })

  it('S3a by click, in Simple with no badge open and a camera the person did not hold: Return puts back badges, layer, lens, inputs, node and link selection, and the camera exactly', async () => {
    setUp(shut, { open: new Map(), all: false }, { x: -40, y: 12, zoom: 0.9 }, false)
    const vp0 = { ...rf.vp }
    const was = { opened: openedNow(), inputs: { ...useInputsOpen.getState().open }, layer: { ...useLayer.getState() }, lens: useViewLens.getState().lens, selection: selectionNow() }
    expect(was.selection).toStrictEqual({ nodes: ['newsletter'], edges: [EDGE], nodeIds: ['newsletter'], edgeIds: [EDGE], anchor: { x: 5, y: 7 } })
    const c = mount(4, next), button = c.button()!
    await press(button); await run(50)
    lay() // the opened View laid out
    await run(300)
    // The show stepped each of them aside, opened the badge, and moved.
    expect(rf.sets).toHaveLength(1)
    expect(useLayer.getState()).toStrictEqual({ layer: 'full', sid: SID })
    expect(useViewLens.getState().lens).toBe('full')
    expect(selectionNow()).toStrictEqual(CLEARED)
    expect(openedNow()).toStrictEqual({ open: [['monthly_revenue', records]], all: false })
    expect(rf.userMoved.current).toBe(true)
    expect(button.textContent).toBe(RETURN_TO_BEFORE)

    await press(button); await run(100)
    // The badge's read has answered; the board has not laid the closed View out again, so neither the selection nor the camera is back yet.
    expect(rf.sets).toHaveLength(1)
    expect(selectionNow()).toStrictEqual(CLEARED)
    lay()
    await run(100)
    expect(rf.sets).toHaveLength(2)
    expect(rf.sets[1]).toStrictEqual({ to: vp0, opts: { duration: 0 }, holds: true })
    expect(rf.vp).toStrictEqual(vp0)
    // Putting the badge back made the board another board, so the camera just put back is kept as the person's (S10 shows why);
    // S3c and S3d, where the board did not change, end with the flag as it was.
    expect(rf.userMoved.current, movedLog.join('\n')).toBe(true)
    expect(openedNow()).toStrictEqual(was.opened)
    expect(useInputsOpen.getState().open).toStrictEqual(was.inputs)
    expect(SID in useInputsOpen.getState().open).toBe(false)
    expect(useLayer.getState()).toStrictEqual(was.layer)
    expect(useViewLens.getState().lens).toBe(was.lens)
    expect(selectionNow()).toStrictEqual(was.selection)
    expect(reads.map((r) => [r.open, r.all])).toStrictEqual([[{ monthly_revenue: records }, false], [null, false]])
    expect(c.button()).toBe(button)
    expect(button.textContent).toBe(SHOW_IN_WORKSPACE)
    expect(document.activeElement).toBe(button)
    expect(showHolds()).toBe(false)
  })

  it('S3b by the Return key, focus on the same button throughout: a badge the person had open, `all` on, and a camera they held, all put back', async () => {
    const shutOpen = clone(shut); cardOf(shutOpen, 'newsletter').badge!.open = true // INVENTED: newsletter's badge flagged open, as the person had it
    setUp(shutOpen, { open: new Map([['newsletter', ['reminded']]]), all: true }, { x: 33, y: -71, zoom: 1.1 }, true)
    const vp0 = { ...rf.vp }
    const was = { opened: openedNow(), layer: { ...useLayer.getState() }, lens: useViewLens.getState().lens, selection: selectionNow() }
    const user = userEvent.setup({ delay: null, advanceTimers: (ms) => vi.advanceTimersByTime(ms) })
    const c = mount(4, next), button = c.button()!
    await act(async () => { button.focus() })
    await enter(user)
    await run(50)
    expect(document.activeElement).toBe(button)
    lay(); await run(300)
    expect(rf.sets).toHaveLength(1)
    expect(openedNow()).toStrictEqual({ open: [['newsletter', ['reminded']], ['monthly_revenue', records]], all: true })
    expect(selectionNow()).toStrictEqual(CLEARED)
    expect(button.textContent).toBe(RETURN_TO_BEFORE)
    expect(document.activeElement).toBe(button)

    await enter(user)
    await run(100)
    expect(document.activeElement).toBe(button)
    lay(); await run(200)
    expect(rf.sets).toHaveLength(2)
    expect(rf.sets[1]).toStrictEqual({ to: vp0, opts: { duration: 0 }, holds: true })
    expect(rf.userMoved.current, movedLog.join('\n')).toBe(true)
    expect(openedNow()).toStrictEqual(was.opened)
    expect(useViewStore.getState().opened.all).toBe(true)
    expect(useLayer.getState()).toStrictEqual(was.layer)
    expect(useViewLens.getState().lens).toBe(was.lens)
    expect(selectionNow()).toStrictEqual(was.selection)
    expect(reads.map((r) => [r.open, r.all])).toStrictEqual([[{ newsletter: ['reminded'], monthly_revenue: records }, true], [{ newsletter: ['reminded'] }, true]])
    expect(c.button()).toBe(button)
    expect(button.textContent).toBe(SHOW_IN_WORKSPACE)
    expect(document.activeElement).toBe(button)
  })

  it('S3c opened inputs (european, Simple): an entry that was false is false again after Return, and the camera goes back exactly', async () => {
    const S = european.id
    install(european); setLevel('simple', S); useInputsOpen.setState({ open: { [S]: false } })
    lay()
    rf.vp = { x: 4, y: 8, zoom: 0.8 }; const vp0 = { ...rf.vp }
    const c = mount(1, atInput)
    await press(c.button()!); await run(100)
    expect(useInputsOpen.getState().open).toStrictEqual({ [S]: true })
    lay(); await run(200)
    expect(rf.sets).toHaveLength(1)
    await press(c.button()!); await run(100)
    expect(useInputsOpen.getState().open).toStrictEqual({ [S]: false })
    lay(); await run(200)
    expect(rf.sets).toHaveLength(2)
    expect(rf.sets[1]).toStrictEqual({ to: vp0, opts: { duration: 0 }, holds: true })
    expect(rf.userMoved.current).toBe(false)
    expect(c.button()!.textContent).toBe(SHOW_IN_WORKSPACE)
  })

  it('S3d the first snapshot wins: show A, then B (A reads Show, B Return); Return restores the state from before A', async () => {
    install(golden)
    lay({ deferral_feasibility: { x: 6000, y: 6000 } })
    rf.vp = { x: 10, y: -20, zoom: 1 }; const vp0 = { ...rf.vp }
    const A = mount(14, nextOf(golden, 14))
    const B = mount(12, pointing(nextOf(golden, 12), 'deferral_feasibility', ['deferral_feasibility'])) // INVENTED pointer on turn 12
    await press(A.button()!); await run(100)
    expect(rf.sets).toHaveLength(1)
    const toA = rf.sets[0]!.to
    await press(B.button()!); await run(100)
    expect(rf.sets).toHaveLength(2)
    expect(rf.sets[1]!.to).toStrictEqual(cameraFor(boxOf(['deferral_feasibility']), pane(), toA))
    expect(A.button()!.textContent).toBe(SHOW_IN_WORKSPACE)
    expect(B.button()!.textContent).toBe(RETURN_TO_BEFORE)
    await press(B.button()!); await run(100)
    expect(rf.sets).toHaveLength(3)
    expect(rf.sets[2]).toStrictEqual({ to: vp0, opts: { duration: 0 }, holds: true })
    expect(rf.userMoved.current).toBe(false)
    expect(A.button()!.textContent).toBe(SHOW_IN_WORKSPACE)
    expect(B.button()!.textContent).toBe(SHOW_IN_WORKSPACE)
  })
})

// ── S4 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('S4 the lens and the layer step aside only when they set a target back (golden turn 14)', () => {
  const SID = golden.id
  const next = nextOf(golden, 14)
  const THREE = next.about
  const OPTION: LayerId = 'option:add_angel_bridge'

  it('lens "If it failed" with a story resting on none of the targets steps to the full model, and Return brings it back', async () => {
    const v = storied(golden, 'horizon') // INVENTED
    expect(THREE).not.toContain('horizon')
    expect(lensSetsBack(v, 'premortem', THREE)).toBe(true)
    install(v); lay(); useViewLens.setState({ lens: 'premortem' })
    const c = mount(14, next)
    await press(c.button()!); await run(100)
    expect(useViewLens.getState().lens).toBe('full')
    expect(rf.sets).toHaveLength(1)
    await press(c.button()!); await run(100)
    expect(useViewLens.getState().lens).toBe('premortem')
    expect(rf.sets[1]).toStrictEqual({ to: V0, opts: { duration: 0 }, holds: true })
  })
  it('contrast: lens "Rests on" is left alone', async () => {
    install(storied(golden, 'horizon')); lay(); useViewLens.setState({ lens: 'rests_on' }) // INVENTED
    const c = mount(14, next)
    await press(c.button()!); await run(100)
    expect(rf.sets).toHaveLength(1)
    expect(useViewLens.getState().lens).toBe('rests_on')
  })
  it('contrast: "If it failed" with core\'s gate closed shows no story, so it is left alone', async () => {
    const v = storied(golden, 'horizon', 'closed') // INVENTED
    expect(lensSetsBack(v, 'premortem', THREE)).toBe(false)
    install(v); lay(); useViewLens.setState({ lens: 'premortem' })
    const c = mount(14, next)
    await press(c.button()!); await run(100)
    expect(rf.sets).toHaveLength(1)
    expect(useViewLens.getState().lens).toBe('premortem')
  })

  it('a layer whose option path leaves a target out steps to the full model; the camera moves only after the board settles AGAIN, at its new places; Return brings the layer back with its scenario', async () => {
    expect(layerFor(golden, OPTION, THREE)).toBe('full')
    install(golden); lay(); useLayer.setState({ layer: OPTION, sid: SID })
    const atFirst = cameraFor(boxOf(THREE), pane(), V0)
    // The fake canvas: the layer's notes leave the cards, so the board is unmeasured until it is laid out again.
    const off = useLayer.subscribe((s, p) => { if (s.layer === 'full' && p.layer !== 'full') rf.at = new Map() })
    try {
      const c = mount(14, next)
      await press(c.button()!); await run(300)
      expect(useLayer.getState()).toStrictEqual({ layer: 'full', sid: SID })
      expect(rf.sets).toStrictEqual([])
      expect(showHolds()).toBe(true)
      lay({}, 120) // laid out again: every card 120 lower
      await run(100)
      const to = cameraFor(boxOf(THREE), pane(), V0)
      expect(to).not.toStrictEqual(atFirst)
      expect(rf.sets).toStrictEqual([{ to, opts: { duration: MOVE_MS }, holds: true }])
      await press(c.button()!); await run(100)
      expect(useLayer.getState()).toStrictEqual({ layer: OPTION, sid: SID })
      expect(rf.sets[1]).toStrictEqual({ to: V0, opts: { duration: 0 }, holds: true })
    } finally { off() }
  })
  it('contrast: a layer every target stands out in is left alone', async () => {
    const only = pointing(next, 'add_angel_bridge', ['add_angel_bridge']) // INVENTED pointer
    expect(layerFor(golden, OPTION, ['add_angel_bridge'])).toBe(OPTION)
    install(golden); lay(); useLayer.setState({ layer: OPTION, sid: SID })
    const c = mount(14, only)
    await press(c.button()!); await run(100)
    expect(useLayer.getState()).toStrictEqual({ layer: OPTION, sid: SID })
    expect(rf.sets).toStrictEqual([{ to: cameraFor(boxOf(['add_angel_bridge']), pane(), V0), opts: { duration: MOVE_MS }, holds: true }])
  })
})

// ── S5 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('S5 Simple\'s folded inputs (european-22cards)', () => {
  const SID = european.id
  it('the fixture: exactly 15 inputs, starting_customers among them, so Simple folds them', () => {
    const drawn = drawnModelOf(european.model!)
    expect(inputIdsOf(drawn)).toHaveLength(15)
    expect(inputIdsOf(drawn)).toContain('starting_customers')
    expect(inputsFolded(SID, drawn, {})).toBe(true)
  })
  it('Simple: the inputs are opened, the show waits for them to be laid out, then moves to that card; Return removes the entry again', async () => {
    install(european); setLevel('simple', SID); lay()
    expect(rf.at.has('starting_customers')).toBe(false) // folded: not on the board
    const c = mount(1, atInput)
    await press(c.button()!); await run(300)
    expect(useInputsOpen.getState().open).toStrictEqual({ [SID]: true })
    expect(rf.sets).toStrictEqual([])
    lay(); await run(200)
    expect(rf.sets).toStrictEqual([{ to: cameraFor(boxOf(['starting_customers']), pane(), V0), opts: { duration: MOVE_MS }, holds: true }])
    await press(c.button()!); await run(100)
    expect(useInputsOpen.getState().open, 'shut again by the store\'s own writer').toStrictEqual({ [SID]: false })
    lay(); await run(200)
    expect(rf.at.has('starting_customers')).toBe(false)
    expect(rf.sets[1]).toStrictEqual({ to: V0, opts: { duration: 0 }, holds: true })
    expect(reads).toHaveLength(0)
  })
  it('contrast: on Detailed nothing is opened and the card is shown where it is', async () => {
    install(european); lay() // the test run's default level is Detailed
    expect(rf.at.has('starting_customers')).toBe(true)
    const c = mount(1, atInput)
    await press(c.button()!); await run(100)
    expect(useInputsOpen.getState().open).toStrictEqual({})
    expect(rf.sets).toStrictEqual([{ to: cameraFor(boxOf(['starting_customers']), pane(), V0), opts: { duration: MOVE_MS }, holds: true }])
  })
})

// ── S6 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('S6 a relation the board draws as a link (growth16)', () => {
  const base = nextOf(growth, 6)
  it('the camera target is the box of its two end cards', async () => {
    install(growth); lay()
    expect(rf.at.has('i_adoption_pilot')).toBe(false)
    const c = mount(6, pointing(base, 'i_adoption_pilot', ['i_adoption_pilot'])) // INVENTED pointer on turn 6
    await press(c.button()!); await run(100)
    expect(rf.sets).toStrictEqual([{ to: cameraFor(boxOf(['cross_team_adoption', 'pilot_conversion']), pane(), V0), opts: { duration: MOVE_MS }, holds: true }])
  })
  it('contrast: another link card is shown by its own two ends', async () => {
    install(growth); lay()
    const c = mount(6, pointing(base, null, ['i_pilot_arr'])) // INVENTED pointer on turn 6
    await press(c.button()!); await run(100)
    const to = cameraFor(boxOf(['pilot_conversion', 'arr_2027']), pane(), V0)
    expect(rf.sets).toStrictEqual([{ to, opts: { duration: MOVE_MS }, holds: true }])
    expect(to).not.toStrictEqual(cameraFor(boxOf(['cross_team_adoption', 'pilot_conversion']), pane(), V0))
  })
})

// ── S7 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('S7 a failed read and an overtaken read (bookshop turn 4)', () => {
  const next = nextOf(closed, 4)
  const WORDS = 'Invented words: the shop is shut for stocktaking.'
  async function failedShow() {
    install(closed); lay()
    route = () => ({ status: 503, body: { error: WORDS } })
    const c = mount(4, next)
    await press(c.button()!); await run(300)
    return c
  }
  it('(a) a 503: the control reads Show again, core\'s words are said, `opened` and the inputs record are as they were, nothing is held', async () => {
    const c = await failedShow()
    expect(reads).toHaveLength(1)
    expect(c.button()!.textContent).toBe(SHOW_IN_WORKSPACE)
    expect(c.said()).toBe(WORDS)
    expect(openedNow()).toStrictEqual({ open: [], all: false })
    expect(useInputsOpen.getState().open).toStrictEqual({})
    expect(showHolds()).toBe(false)
    expect(rf.vp).toStrictEqual(V0)
  })
  it('(a) a 503 moves nothing: no setViewport at all, and "the person holds the camera" is not written', async () => {
    await failedShow()
    expect(rf.sets).toStrictEqual([])
    expect(rf.userMoved.current).toBe(false)
    expect(movedLog.filter((l) => l.startsWith('true'))).toStrictEqual([])
  })
  it('contrast: the same press answered 200 moves', async () => {
    install(closed); lay()
    route = (r) => ok(hasMonthly(r) ? opened : closed)
    const c = mount(4, next)
    await press(c.button()!); await run(50)
    lay(); await run(200)
    expect(rf.sets).toStrictEqual([{ to: cameraFor(boxOf(['visits', 'spend_per_visit']), pane(), V0), opts: { duration: MOVE_MS }, holds: true }])
    expect(c.said()).toBeNull()
  })
  it('(b) overtaken: the person opens another badge while the show\'s read is on its way; the show moves nothing, says so, and leaves the person\'s own `opened` standing', async () => {
    install(closed); lay()
    const c = mount(4, next)
    await press(c.button()!); await run(50)
    expect(reads).toHaveLength(1)
    let theirs!: Promise<boolean>
    await act(async () => { theirs = useViewStore.getState().setOpened({ open: new Map([['newsletter', ['reminded']]]), all: false }) })
    expect(reads).toHaveLength(2)
    expect(reads[1]!.open).toStrictEqual({ newsletter: ['reminded'] })
    // The person's own read answers first, with the open View (what it draws is not under test here; the `opened` map is).
    await answer(reads[1]!, ok(opened))
    expect(await theirs).toBe(true)
    await answer(reads[0]!, ok(opened))
    lay(); await run(300)
    expect(rf.sets).toStrictEqual([])
    expect(c.said()).toBe(COULD_NOT_SHOW)
    expect(openedNow()).toStrictEqual({ open: [['newsletter', ['reminded']]], all: false })
    expect(c.button()!.textContent).toBe(SHOW_IN_WORKSPACE)
    expect(showHolds()).toBe(false)
    await act(async () => { await returnToBefore() })
    await run(300)
    expect(rf.sets).toStrictEqual([])
    expect(openedNow()).toStrictEqual({ open: [['newsletter', ['reminded']]], all: false })
    expect(reads).toHaveLength(2)
  })
})

// ── S8 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('S8 the camera race', () => {
  it('(a) Return pressed while the show\'s read is pending: when that read answers late and the canvas lays out, the show moves nothing after Return\'s own restore', async () => {
    install(closed); lay()
    rf.vp = { x: 7, y: 9, zoom: 1 }; const vp0 = { ...rf.vp }; rf.userMoved.current = false
    const c = mount(4, nextOf(closed, 4)), button = c.button()!
    await press(button); await run(50)
    expect(reads).toHaveLength(1)
    expect(button.textContent).toBe(RETURN_TO_BEFORE)
    await press(button); await run(50) // Return
    expect(reads).toHaveLength(2)
    expect(reads[1]!.open).toBeNull()
    await answer(reads[1]!, ok(closed)); await run(100)
    // The show never moved the camera and the board is the board it was: Return has nothing to put back, and touches nothing.
    expect(rf.sets).toStrictEqual([])
    expect(rf.vp).toStrictEqual(vp0)
    expect(rf.userMoved.current, movedLog.join('\n')).toBe(false)
    await answer(reads[0]!, ok(opened)) // the aborted show's read, late
    lay(); await run(400)
    expect(rf.sets).toStrictEqual([])
    expect(rf.vp).toStrictEqual(vp0)
    expect(rf.userMoved.current).toBe(false)
    expect(openedNow()).toStrictEqual({ open: [], all: false })
    expect(button.textContent).toBe(SHOW_IN_WORKSPACE)
  })
  it('(b) show A\'s read is slow, show B starts and completes; A\'s late read moves nothing and "the person holds the camera" stays true', async () => {
    install(closed); lay()
    const A = mount(4, nextOf(closed, 4))
    const B = mount(5, pointing(nextOf(closed, 4), 'rival_sales', ['rival_sales'])) // INVENTED turn id and pointer
    await press(A.button()!); await run(50)
    expect(reads).toHaveLength(1)
    await press(B.button()!); await run(100)
    expect(rf.sets).toStrictEqual([{ to: cameraFor(boxOf(['rival_sales']), pane(), V0), opts: { duration: MOVE_MS }, holds: true }])
    expect(rf.userMoved.current).toBe(true)
    await answer(reads[0]!, ok(opened))
    lay(); await run(400)
    expect(rf.sets).toHaveLength(1)
    expect(rf.userMoved.current).toBe(true)
    expect(A.button()!.textContent).toBe(SHOW_IN_WORKSPACE)
    expect(B.button()!.textContent).toBe(RETURN_TO_BEFORE)
    expect(showHolds()).toBe(false)
  })
  it('(c) the board never lays out the opened inputs: after SETTLE_MS the show says so, the inputs entry is put back, nothing is held', async () => {
    const S = european.id
    install(european); setLevel('simple', S); lay()
    const c = mount(1, atInput)
    await press(c.button()!); await run(SETTLE_MS - 200)
    expect(c.said()).toBeNull()
    expect(showHolds()).toBe(true)
    expect(useInputsOpen.getState().open).toStrictEqual({ [S]: true })
    await run(400)
    expect(c.said()).toBe(COULD_NOT_SHOW)
    expect(useInputsOpen.getState().open).toStrictEqual({ [S]: false })
    expect(showHolds()).toBe(false)
    expect(rf.vp).toStrictEqual(V0)
    expect(c.button()!.textContent).toBe(SHOW_IN_WORKSPACE)
  })
  it('(c) the board never lays out the opened badge: after SETTLE_MS the show says so, and `opened` is put back by a read', async () => {
    install(closed); lay()
    route = (r) => ok(hasMonthly(r) ? opened : closed)
    const c = mount(4, nextOf(closed, 4))
    await press(c.button()!); await run(SETTLE_MS - 200)
    expect(c.said()).toBeNull()
    expect(openedNow().open.map(([k]) => k)).toStrictEqual(['monthly_revenue'])
    await run(400)
    expect(c.said()).toBe(COULD_NOT_SHOW)
    expect(openedNow()).toStrictEqual({ open: [], all: false })
    expect(reads.map((r) => r.open === null)).toStrictEqual([false, true])
    expect(showHolds()).toBe(false)
    expect(rf.vp).toStrictEqual(V0)
    expect(rf.userMoved.current, 'the badge closed again under the return, so the camera is kept where it is').toBe(true)
    expect(c.button()!.textContent).toBe(SHOW_IN_WORKSPACE)
  })

  describe('(d) the pane changed size between show and return', () => {
    const DOCK_CLOSED: Pane = { size: { w: 1232, h: 704 }, inset: { left: 0, top: 56, right: 0, bottom: 0 } }
    async function showThenReturn(held: boolean, resize: boolean): Promise<Viewport> {
      install(golden); lay()
      rf.vp = { x: 15, y: 25, zoom: 1 }; rf.userMoved.current = held
      const vp0 = { ...rf.vp }
      const c = mount(14, nextOf(golden, 14))
      await press(c.button()!); await run(100)
      expect(rf.sets).toHaveLength(1)
      if (resize) paneNow.value = clone(DOCK_CLOSED)
      await press(c.button()!); await run(100)
      expect(c.button()!.textContent).toBe(SHOW_IN_WORKSPACE)
      expect(showHolds()).toBe(false)
      return vp0
    }
    it('a camera the person did not hold: Return hands it to the board (fit) and does not put back the old viewport', async () => {
      await showThenReturn(false, true)
      expect(rf.fits).toBe(1)
      expect(rf.sets).toHaveLength(1)
      expect(rf.userMoved.current).toBe(false)
    })
    it('contrast: the same pane: the exact viewport is put back and fit is not called', async () => {
      const vp0 = await showThenReturn(false, false)
      expect(rf.fits).toBe(0)
      expect(rf.sets).toHaveLength(2)
      expect(rf.sets[1]).toStrictEqual({ to: vp0, opts: { duration: 0 }, holds: true })
      expect(rf.userMoved.current).toBe(false)
    })
    it('contrast: the person held the camera before the show: the exact viewport is put back although the pane changed', async () => {
      const vp0 = await showThenReturn(true, true)
      expect(rf.fits).toBe(0)
      expect(rf.sets).toHaveLength(2)
      expect(rf.sets[1]).toStrictEqual({ to: vp0, opts: { duration: 0 }, holds: true })
      expect(rf.userMoved.current).toBe(true)
    })
  })
})

// ── S9 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('S9 scope and visibility', () => {
  const next = nextOf(golden, 14)
  it('no canvas port registered: the control draws nothing; contrast: once one registers, it is drawn', () => {
    install(golden); lay()
    unregister?.(); unregister = null
    const c = mount(14, next)
    expect(c.container.innerHTML).toBe('')
    act(() => { register() })
    expect(c.button()!.textContent).toBe(SHOW_IN_WORKSPACE)
  })
  it('a reply whose ids are not in the reader\'s View: nothing is drawn', () => {
    install(golden); lay()
    const c = mount(14, pointing(next, 'record_since_removed', ['record_since_removed', 'another_gone'])) // INVENTED pointer
    expect(c.container.innerHTML).toBe('')
  })
  it('a mixed reply: drawn, with no trace of the absent id and no count; it shows exactly the cards that are there', async () => {
    install(golden); lay()
    const c = mount(14, pointing(next, 'record_since_removed', ['record_since_removed', 'opening_cash', 'monthly_burn'])) // INVENTED pointer
    /** Every attribute of the control's own elements but its classes (the icon's geometry is the icon's): none carries an id or a number. */
    const words = (): string[] => Array.from(c.container.querySelectorAll('*')).filter((e) => e.closest('svg') === null).flatMap((e) => Array.from(e.attributes).filter((a) => a.name !== 'class').map((a) => a.value))
    expect(c.container.innerHTML).not.toContain('record_since_removed')
    expect(c.container.textContent).toBe(SHOW_IN_WORKSPACE)
    expect(words().filter((w) => /\d/.test(w))).toStrictEqual([])
    await press(c.button()!); await run(100)
    expect(rf.sets).toStrictEqual([{ to: cameraFor(boxOf(['opening_cash', 'monthly_burn']), pane(), V0), opts: { duration: MOVE_MS }, holds: true }])
    expect(c.container.innerHTML).not.toContain('record_since_removed')
    expect(c.container.textContent).toBe(RETURN_TO_BEFORE)
    expect(words().filter((w) => /\d/.test(w))).toStrictEqual([])
  })

  const discards: [string, () => void, () => void][] = [
    ['another scenario (sid)', () => {}, () => useViewStore.setState({ sid: 's_invented0001' })],
    ['another reader (view.you_id)', () => {}, () => useViewStore.setState((s) => ({ view: { ...s.view!, you_id: 'p_invented' } as View }))],
    ['another version (view.version.id)', () => {}, () => useViewStore.setState((s) => ({ view: { ...s.view!, version: { ...s.view!.version!, id: 9001 } } as View }))],
    ['a new proposal id', () => {}, () => useViewStore.setState((s) => ({ view: { ...s.view!, proposal: { ...clone(proposalShape), id: 9002 } } as View }))],
    ['a level change, Detailed to Simple (showSimple)', () => {}, () => showSimple(golden.id)],
    ['a level change, Simple to Detailed (showWholeModel)', () => setLevel('simple', golden.id), () => showWholeModel(golden.id)],
    ['the canvas unregistering, then a new port registering', () => {}, () => { unregister?.(); unregister = null; register() }],
  ]
  it.each(discards)('after a completed show, %s discards the snapshot: the control reads Show and returnToBefore() moves nothing', async (_name, before, change) => {
    install(golden); before(); lay()
    const c = mount(14, next)
    await press(c.button()!); await run(100)
    lay(); await run(400) // on Simple this reply's note stands behind a row group: the show opened it and waits for it to be laid out
    expect(rf.sets).toHaveLength(1)
    expect(c.button()!.textContent).toBe(RETURN_TO_BEFORE)
    const fits = rf.fits, folds = { ...useInputsOpen.getState().open }
    act(() => { change() })
    await run(50)
    expect(c.button()!.textContent).toBe(SHOW_IN_WORKSPACE)
    await act(async () => { await returnToBefore() })
    await run(100)
    expect(rf.sets).toHaveLength(1)
    expect(rf.fits, 'nothing is framed either').toBe(fits)
    expect(useInputsOpen.getState().open, 'and no fold is put back').toStrictEqual(folds)
    expect(reads).toHaveLength(0)
  })
  it('contrast: with nothing changed, the control still reads Return and returnToBefore() puts the camera back', async () => {
    install(golden); lay()
    const c = mount(14, next)
    await press(c.button()!); await run(100)
    await run(50)
    expect(c.button()!.textContent).toBe(RETURN_TO_BEFORE)
    act(() => { void returnToBefore() }) // it waits for the board, which only the frames below can show settled
    await run(100)
    expect(rf.sets).toHaveLength(2)
    expect(rf.sets[1]).toStrictEqual({ to: V0, opts: { duration: 0 }, holds: true })
    expect(c.button()!.textContent).toBe(SHOW_IN_WORKSPACE)
  })
  it('a show still on its way when the version changes ends with COULD_NOT_SHOW said for that turn, and moves nothing', async () => {
    install(golden) // the board not laid out yet: the show waits for it
    const c = mount(14, next)
    await press(c.button()!); await run(200)
    expect(showHolds()).toBe(true)
    act(() => { useViewStore.setState((s) => ({ view: { ...s.view!, version: { ...s.view!.version!, id: 9003 } } as View })) }) // INVENTED version id
    await run(50)
    expect(c.said()).toBe(COULD_NOT_SHOW)
    expect(c.button()!.textContent).toBe(SHOW_IN_WORKSPACE)
    expect(showHolds()).toBe(false)
    lay(); await run(300)
    expect(rf.sets).toStrictEqual([])
    expect(c.said()).toBe(COULD_NOT_SHOW)
  })
  it('unmounting the control during a first show still on its way puts `opened` back and holds nothing', async () => {
    install(closed); lay()
    route = (r) => (r.open === null ? ok(closed) : null) // the show's read stays on its way; the return's is answered
    const c = mount(4, nextOf(closed, 4))
    await press(c.button()!); await run(50)
    expect(openedNow().open.map(([k]) => k)).toStrictEqual(['monthly_revenue'])
    c.unmount()
    await run(200)
    expect(reads.map((r) => r.open === null)).toStrictEqual([false, true])
    expect(openedNow()).toStrictEqual({ open: [], all: false })
    await answer(reads[0]!, ok(opened)) // the show's read, late
    await run(200)
    expect(openedNow()).toStrictEqual({ open: [], all: false })
    expect(showHolds()).toBe(false)
  })
  it('unmounting the control during a first show that opened the inputs puts the inputs entry back and holds nothing', async () => {
    const S = european.id
    install(european); setLevel('simple', S); lay()
    const c = mount(1, atInput)
    await press(c.button()!); await run(100)
    expect(useInputsOpen.getState().open).toStrictEqual({ [S]: true })
    c.unmount()
    await run(200)
    expect(useInputsOpen.getState().open).toStrictEqual({ [S]: false })
    expect(showHolds()).toBe(false)
  })
})

// ── S10 ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('S10 beside the canvas\'s own framing: a model of the ONE loop the mounted line makes wait', () => {
  const next = nextOf(closed, 4)
  /**
   * A MODEL of ViewCanvas.tsx's one framing loop (useViewCamera `settle`) with the mounted line in it, which the fake canvas side does not
   * have: the loop WAITS while a show or a return holds the board, then frames the board (`fit`) unless the camera is held. The canvas
   * starts it from two effects, modelled as the canvas has them: a board change (its key: board, open badges, level) first resets "the
   * person holds the camera"; a change of the free canvas's size starts it only where the camera is not held.
   */
  function frameLoop(): void {
    const tick = (): void => {
      if (showHolds()) { requestAnimationFrame(tick); return }
      if (rf.userMoved.current) return
      void side.fit()
    }
    requestAnimationFrame(tick)
  }
  function boardChanged(): void { act(() => { rf.userMoved.current = false; frameLoop() }) }
  function paneResized(): void { act(() => { if (!rf.userMoved.current) frameLoop() }) }
  it('a show that opens a badge, then Return: the board never frames over the camera the show chose, nor over the one Return put back', async () => {
    install(closed); lay()
    rf.vp = { x: -40, y: 12, zoom: 0.9 }; const vp0 = { ...rf.vp }
    const c = mount(4, next), button = c.button()!
    await press(button); await run(50)
    await answer(reads[0]!, ok(opened)); boardChanged()
    lay(); await run(400)
    // The board framed the opened board itself first, at the show's asking and under its hold; the cards being out of view still, the show moved.
    expect([rf.fits, rf.fitsHeld]).toStrictEqual([1, 1])
    expect(rf.sets).toHaveLength(1)
    expect(rf.userMoved.current).toBe(true)
    await press(button); await run(50) // Return
    expect(reads).toHaveLength(2)
    await answer(reads[1]!, ok(closed)); boardChanged()
    lay(); await run(400)
    expect(rf.sets).toHaveLength(2)
    expect(rf.sets[1]).toStrictEqual({ to: vp0, opts: { duration: 0 }, holds: true })
    expect(rf.fits, 'the board\'s own framing did not replace the camera Return put back').toBe(1)
    expect(rf.vp).toStrictEqual(vp0)
    expect(button.textContent).toBe(SHOW_IN_WORKSPACE)
  })
  it('a show that opens a badge: the board frames the opened board itself first; the cards then being whole in view, the show moves nothing and the camera stays the board\'s', async () => {
    install(closed); lay()
    const c = mount(4, next)
    await press(c.button()!); await run(50)
    await answer(reads[0]!, ok(opened)); boardChanged()
    lay({ visits: { x: 100, y: 100 }, spend_per_visit: { x: 400, y: 100 } }) // both whole inside the free canvas
    await run(400)
    expect(cameraFor(boxOf(['visits', 'spend_per_visit']), pane(), V0)).toBeNull()
    expect(rf.fitsHeld, 'asked for once by the show, under its hold').toBe(1)
    expect(rf.sets).toStrictEqual([])
    expect(rf.userMoved.current).toBe(false)
    expect(rf.fits, 'and the canvas\'s own waiting loop frames the same board once it is let go').toBe(2)
    expect(c.button()!.textContent).toBe(RETURN_TO_BEFORE)
  })
  it('the same for a camera the person held: a badge opening frames the board whoever held the camera, as the canvas itself does', async () => {
    install(closed); lay()
    rf.userMoved.current = true
    const c = mount(4, next)
    await press(c.button()!); await run(50)
    await answer(reads[0]!, ok(opened)); boardChanged()
    lay({ visits: { x: 100, y: 100 }, spend_per_visit: { x: 400, y: 100 } })
    await run(400)
    expect(rf.fitsHeld).toBe(1)
    expect(rf.sets).toStrictEqual([])
    expect(rf.userMoved.current).toBe(false)
  })
  it('contrast: Simple\'s inputs opened under a camera the person holds: the board is not asked to frame itself, and the show moves to the card', async () => {
    const S = european.id
    install(european); setLevel('simple', S); lay()
    rf.userMoved.current = true
    const c = mount(1, atInput)
    await press(c.button()!); await run(100)
    lay(); await run(200)
    expect(rf.fitsHeld).toBe(0)
    expect(rf.sets).toHaveLength(1)
    expect(rf.userMoved.current).toBe(true)
  })
  const DOCK_CLOSED: Pane = { size: { w: 1232, h: 704 }, inset: { left: 0, top: 56, right: 0, bottom: 0 } }
  const IN_VIEW = { reported_cash_and_spend_basis: { x: 20, y: 80 }, opening_cash: { x: 300, y: 80 }, monthly_burn: { x: 20, y: 300 } }
  it('the free canvas changes size while a show holds the board: the canvas\'s own loop waits, and frames the new room once the show lets go, the camera not being held; the port frames nothing itself', async () => {
    install(golden) // the board not laid out yet: the show waits, holding
    const c = mount(14, nextOf(golden, 14))
    await press(c.button()!); await run(200)
    expect(showHolds()).toBe(true)
    paneNow.value = clone(DOCK_CLOSED); paneResized() // the dock closes mid-show
    await run(100)
    expect(rf.fits, 'nothing is framed under the hold').toBe(0)
    lay(IN_VIEW); await run(200)
    expect(showHolds()).toBe(false)
    expect(rf.sets).toStrictEqual([]) // the cards were in view: the show moved nothing and does not hold the camera
    expect(rf.userMoved.current).toBe(false)
    expect([rf.fits, rf.fitsHeld], 'the canvas\'s loop, once, after the hold').toStrictEqual([1, 0])
  })
  it('contrast: the same show with no change of size asks for no refit', async () => {
    install(golden)
    const c = mount(14, nextOf(golden, 14))
    await press(c.button()!); await run(200)
    lay(IN_VIEW); await run(200)
    expect(rf.sets).toStrictEqual([])
    expect(rf.fits).toBe(0)
  })
  it('contrast: a show that moved the camera holds it, so the loop a change of size started meanwhile frames nothing', async () => {
    install(golden)
    const c = mount(14, nextOf(golden, 14))
    await press(c.button()!); await run(200)
    paneNow.value = clone(DOCK_CLOSED); paneResized()
    lay(); await run(200)
    expect(rf.sets).toHaveLength(1)
    expect(rf.userMoved.current).toBe(true)
    expect(rf.fits).toBe(0)
  })
  it('contrast: a badge the person opened themselves while a show held the board IS framed by the board, once the show lets go', async () => {
    install(closed); lay()
    const c = mount(4, next)
    await press(c.button()!); await run(50)
    let theirs!: Promise<boolean>
    await act(async () => { theirs = useViewStore.getState().setOpened({ open: new Map([['newsletter', ['reminded']]]), all: false }) })
    await answer(reads[1]!, ok(opened)); boardChanged()
    expect(await theirs).toBe(true)
    await answer(reads[0]!, ok(opened))
    lay(); await run(400)
    expect(c.said()).toBe(COULD_NOT_SHOW)
    expect(rf.sets).toStrictEqual([])
    expect(rf.fits, 'the framing was put off, not dropped').toBe(1)
    expect(rf.userMoved.current).toBe(false)
  })
  it('the same with a camera the person HELD before the show: the canvas took the flag back for their own board change, and the overtaken show does not write "held" over it', async () => {
    install(closed); lay()
    rf.userMoved.current = true
    const c = mount(4, next)
    await press(c.button()!); await run(50)
    let theirs!: Promise<boolean>
    await act(async () => { theirs = useViewStore.getState().setOpened({ open: new Map([['newsletter', ['reminded']]]), all: false }) })
    await answer(reads[1]!, ok(opened)); boardChanged()
    expect(await theirs).toBe(true)
    await answer(reads[0]!, ok(opened))
    lay(); await run(400)
    expect(c.said()).toBe(COULD_NOT_SHOW)
    expect(rf.sets).toStrictEqual([])
    expect(rf.userMoved.current, movedLog.join('\n')).toBe(false)
    expect(rf.fits, 'their own board change is framed by the board').toBe(1)
  })
})

// ── S11 ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('S11 Simple\'s row groups (golden turn 14: core\'s own reply names a note the inputs row\'s notes group holds)', () => {
  const SID = golden.id, NOTES = 'group:notes:inputs', next = nextOf(golden, 14)
  const THREE = ['reported_cash_and_spend_basis', 'opening_cash', 'monthly_burn']
  it('what the plan calls folded is what the board leaves out: for every card of three real Views on Simple, with the inputs and the groups each shut and opened, a fold is asked for exactly when boardOf does not draw the card', () => {
    let folded = 0, drawnNow = 0
    for (const v of [golden, european, hiring]) {
      install(v); setLevel('simple', v.id)
      const drawn = drawnModelOf(v.model!), groups = cardGroupsOf(drawn, v).map((g) => g.id)
      for (const inputs of [false, true]) for (const grouped of [false, true]) {
        useInputsOpen.setState({ open: {} })
        if (inputs) setInputsOpen(v.id, true)
        if (grouped) for (const g of groups) setGroupOpen(v.id, g)
        const open = useInputsOpen.getState().open
        const onBoard = new Set(boardOf(v.model!, open).model.cards.map((c) => c.id))
        for (const card of drawn.cards) {
          const plan = planShow(v, pointing(next, card.id, [card.id]), { sid: v.id, level: 'simple', inputsOpen: open })!
          const asks = plan.inputs || plan.groups.length > 0
          expect(asks, `${v.id} ${card.id} inputs opened=${inputs} groups opened=${grouped}`).toBe(!onBoard.has(card.id))
          if (asks) folded += 1; else drawnNow += 1
        }
      }
    }
    expect(folded, 'the row is not vacuous: some cards were behind a fold').toBeGreaterThan(20)
    expect(drawnNow).toBeGreaterThan(20)
  })
  it('Simple: the group is opened with no read; nothing moves until its cards are laid out; the board frames itself, then the camera moves to exactly the three cards; Return shuts the group again and puts the camera back', async () => {
    install(golden); setLevel('simple', SID); lay()
    expect(rf.at.has('reported_cash_and_spend_basis')).toBe(false) // behind the group card
    rf.vp = { x: 4, y: 8, zoom: 0.8 }; const vp0 = { ...rf.vp }
    const c = mount(14, next)
    await press(c.button()!); await run(300)
    expect(groupOpen(SID, NOTES)).toBe(true)
    expect([rf.sets.length, rf.fits]).toStrictEqual([0, 0])
    lay(); await run(400)
    expect(rf.at.has('reported_cash_and_spend_basis')).toBe(true)
    expect(rf.fitsHeld, 'the board framed what it grew into, once, at the show\'s asking').toBe(1)
    expect(rf.sets).toStrictEqual([{ to: cameraFor(boxOf(THREE), pane(), vp0), opts: { duration: MOVE_MS }, holds: true }])
    expect(c.button()!.textContent).toBe(RETURN_TO_BEFORE)
    await press(c.button()!); await run(100)
    expect(groupOpen(SID, NOTES)).toBe(false)
    lay(); await run(200)
    expect(rf.at.has('reported_cash_and_spend_basis')).toBe(false)
    expect(rf.sets[1]).toStrictEqual({ to: vp0, opts: { duration: 0 }, holds: true })
    expect(rf.userMoved.current).toBe(false)
    expect(reads).toHaveLength(0)
    expect(c.button()!.textContent).toBe(SHOW_IN_WORKSPACE)
  })
  it('contrast: under a camera the person holds the board is not asked to frame itself; the show moves to the cards and Return hands their camera back as theirs', async () => {
    install(golden); setLevel('simple', SID); lay()
    rf.userMoved.current = true
    const c = mount(14, next)
    await press(c.button()!); await run(300)
    lay(); await run(400)
    expect(rf.fits).toBe(0)
    expect(rf.sets).toHaveLength(1)
    await press(c.button()!); await run(100)
    lay(); await run(200)
    expect(rf.sets[1]).toStrictEqual({ to: V0, opts: { duration: 0 }, holds: true })
    expect(rf.userMoved.current).toBe(true)
  })
  it('contrast: a group the person had opened themselves is still open after Return; on Detailed nothing is opened at all', async () => {
    install(golden); setLevel('simple', SID); act(() => { setGroupOpen(SID, NOTES) }); lay()
    const before = { ...useInputsOpen.getState().open }
    const c = mount(14, next)
    await press(c.button()!); await run(400)
    expect(useInputsOpen.getState().open).toStrictEqual(before)
    await press(c.button()!); await run(300)
    expect(useInputsOpen.getState().open).toStrictEqual(before)
    expect(groupOpen(SID, NOTES)).toBe(true)
    c.unmount()
    act(() => { resetShow(); useInputsOpen.setState({ open: {} }); setLevel('working', SID) }); lay()
    const d = mount(14, next)
    await press(d.button()!); await run(400)
    expect(useInputsOpen.getState().open).toStrictEqual({})
    expect(d.button()!.textContent).toBe(RETURN_TO_BEFORE)
  })
  it('only what the show opened is shut: the show opens the inputs, the person opens the notes group while the card is shown; after Return the inputs are folded again and their group is still open', async () => {
    const S = european.id
    install(european); setLevel('simple', S); lay()
    const c = mount(1, atInput)
    await press(c.button()!); await run(300); lay(); await run(400)
    expect(c.button()!.textContent).toBe(RETURN_TO_BEFORE)
    act(() => { setGroupOpen(S, NOTES) }); lay(); await run(100)
    expect(c.button()!.textContent, 'their own press lets go of nothing').toBe(RETURN_TO_BEFORE)
    await press(c.button()!); await run(100); lay(); await run(300)
    expect(inputsFolded(S, drawnModelOf(european.model!))).toBe(true)
    expect(groupOpen(S, NOTES)).toBe(true)
    expect(c.button()!.textContent).toBe(SHOW_IN_WORKSPACE)
  })
  it('the mirror: the person had opened the inputs; the show opens the notes group alone; after Return the group is shut and the inputs are still open', async () => {
    const S = european.id, note = pointing(next, 'entry_interpretation', ['entry_interpretation'])
    install(european); setLevel('simple', S); act(() => { setInputsOpen(S, true) }); lay()
    const c = mount(1, note)
    await press(c.button()!); await run(300)
    expect(groupOpen(S, NOTES)).toBe(true)
    lay(); await run(400)
    expect(c.button()!.textContent).toBe(RETURN_TO_BEFORE)
    await press(c.button()!); await run(100); lay(); await run(300)
    expect(groupOpen(S, NOTES)).toBe(false)
    expect(useInputsOpen.getState().open[S]).toBe(true)
    expect(rf.at.has('starting_customers'), 'the inputs are still on the board').toBe(true)
    expect(rf.at.has('entry_interpretation')).toBe(false)
  })
  it('a group in the folded inputs\' row (european-22cards): Show opens both folds and moves to the note; Return shuts both', async () => {
    const S = european.id, note = pointing(next, 'entry_interpretation', ['entry_interpretation'])
    install(european); setLevel('simple', S); lay()
    const c = mount(1, note)
    await press(c.button()!); await run(300)
    expect(useInputsOpen.getState().open[S]).toBe(true)
    expect(groupOpen(S, NOTES)).toBe(true)
    expect(rf.sets).toStrictEqual([])
    lay(); await run(400)
    expect(rf.sets).toStrictEqual([{ to: cameraFor(boxOf(['entry_interpretation']), pane(), V0), opts: { duration: MOVE_MS }, holds: true }])
    await press(c.button()!); await run(100)
    expect([useInputsOpen.getState().open[S], groupOpen(S, NOTES)]).toStrictEqual([false, false])
    lay(); await run(200)
    expect(rf.at.has('entry_interpretation')).toBe(false)
    expect(rf.sets[1]).toStrictEqual({ to: V0, opts: { duration: 0 }, holds: true })
  })
  it('INVENTED (the opened bookshop with `visits` made a sentence-only note): a card the badge hands out stands behind its row\'s group: the badge opens by a read, THEN that group, once; the camera moves to both cards; Return puts the badge and the group back', async () => {
    const S = closed.id, turn4 = nextOf(closed, 4)
    const notes = clone(opened); Object.assign(cardOf(notes, 'visits'), { kind: 'note', figure: null })
    const group = cardGroupsOf(drawnModelOf(notes.model!), notes).find((g) => g.cards.includes('visits'))!.id
    expect(cardGroupsOf(drawnModelOf(opened.model!), opened), 'contrast: the real opened View folds nothing').toStrictEqual([])
    install(closed); setLevel('simple', S); lay()
    const c = mount(4, turn4)
    await press(c.button()!); await run(50)
    expect(reads).toHaveLength(1)
    await answer(reads[0]!, ok(notes))
    lay(); await run(200)
    expect(rf.at.has('visits'), 'the board core now sends still keeps the note behind its group').toBe(false)
    expect(groupOpen(S, group)).toBe(true)
    expect(rf.sets).toStrictEqual([])
    expect(c.said()).toBeNull()
    lay(); await run(400)
    expect(rf.sets).toStrictEqual([{ to: cameraFor(boxOf(['visits', 'spend_per_visit']), pane(), V0), opts: { duration: MOVE_MS }, holds: true }])
    expect(c.button()!.textContent).toBe(RETURN_TO_BEFORE)
    await press(c.button()!); await run(50)
    expect(reads).toHaveLength(2)
    await answer(reads[1]!, ok(closed))
    lay(); await run(400)
    expect(groupOpen(S, group)).toBe(false)
    expect(openedNow()).toStrictEqual({ open: [], all: false })
    expect(rf.sets[1]).toStrictEqual({ to: V0, opts: { duration: 0 }, holds: true })
    expect(c.button()!.textContent).toBe(SHOW_IN_WORKSPACE)
  })
  it('the board never lays out the opened group: after SETTLE_MS the show says so, the group is shut again, nothing is held', async () => {
    install(golden); setLevel('simple', SID); lay()
    const c = mount(14, next)
    await press(c.button()!); await run(SETTLE_MS - 200)
    expect(c.said()).toBeNull()
    expect(groupOpen(SID, NOTES)).toBe(true)
    await run(400)
    expect(c.said()).toBe(COULD_NOT_SHOW)
    expect(groupOpen(SID, NOTES)).toBe(false)
    expect(showHolds()).toBe(false)
    expect(rf.vp).toStrictEqual(V0)
    expect(c.button()!.textContent).toBe(SHOW_IN_WORKSPACE)
  })
})
