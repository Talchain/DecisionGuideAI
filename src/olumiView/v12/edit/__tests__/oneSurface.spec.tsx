/**
 * SURFACES STEP 2 (18 Nov): one thing open at a time. On the mounted lane canvas (the real ViewCanvas, its right-click menu,
 * edit form, details panel and add form; since step 5 the card's figure editor is the details panel's Value row), at most one is open in every state; Escape closes the open one (from the focused field,
 * as a person presses it) and only after that cancels a waiting challenge; a press on empty canvas closes whatever is open; the card's hover
 * pop-up is never up while one is. Each is bound by the test ids the components render.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ViewCanvas } from '../../../ViewCanvas'
import { ViewComposer, useViewChat } from '../../../ViewChat'
import { currentModel, useViewStore } from '../../../store'
import { useCanvasStore } from '../../../../canvas/store'
import { drawViewCanvas } from '../../../canvas'
import { causalPlaces, drawKindOf } from '../../../layout'
import { connectionsOf } from '../../inspect/connections'
import { MENU_ROW, MENU_SHELL } from '../../../look/menu'
import { LENSES_TESTID } from '../../lenses/LensesMenu'
import { HOVER_CARD_OPEN_DELAY_MS } from '../../../../canvas/components/hoverCard/hoverCardPlacement'
import { useLaneInspector } from '../inspectorStore'
import { anchorOf, FORM_MIN_SHOWN, freeCanvas, placeBeside, stayBeside } from '../placeBeside'
import { registerBoxCamera, type View as BoardView } from '../makeRoom'
import { HOVER_CARD_GAP } from '../../../../canvas/components/hoverCard/hoverCardPlacement'
import { setTeamFetch } from '../../../../olumiCore/team/api'
import type { View } from '../../../client'
import { approved, install, uninstall } from './harness'

vi.mock('../../../../canvas/components/OutputsDock', () => ({ OutputsDock: () => null }))
vi.mock('../../../../canvas/components/OlumiAttentionCard', () => ({ OlumiAttentionCard: () => null }))
const lane = vi.hoisted(() => ({ on: true }))
vi.mock('../../../../olumiCore/lane', async (real) => ({ ...(await real<object>()), isOlumiCoreLane: () => lane.on }))
vi.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: 'u1', accessToken: null }), supabase: {} }))
vi.mock('../../../../canvas/nodes/shared/savedGraph', () => ({ useSavedGraphRead: () => ({ status: 'none' }), useSavedGraph: () => null }))

beforeAll(() => { ;(window as unknown as { DOMMatrixReadOnly?: unknown }).DOMMatrixReadOnly ??= class { m22 = 1 } })
afterEach(() => { lane.on = true; cleanup(); useLaneInspector.getState().close(); useLaneInspector.setState({ peek: null }); vi.useRealTimers(); uninstall(); useViewChat.setState({ armed: null, text: '' }); useCanvasStore.setState({ nodes: [], edges: [] }) })

const FIG = 'starting_customers', FIG2 = 'customer_target', OPT = 'broader_entry', OTHER = 'single_country_test'
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 60)) })
let root: HTMLElement
async function board(withComposer = false, view: View = approved()): Promise<void> {
  install(view)
  const model = currentModel({ view, error: null, stale: false })!
  const places = await causalPlaces(model, new Map())
  act(() => { drawViewCanvas(model, places) })
  root = render(<div style={{ width: 1232, height: 704 }}><ViewCanvas />{withComposer ? <ViewComposer /> : null}</div>).container
  await settle()
}
const node = (id: string) => root.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)!
const pane = () => root.querySelector<HTMLElement>('.react-flow__pane')!

// The surfaces, each by what it renders. (Surfaces step 5: the card's figure editor is not one of them on the lane any more: its pencil opens the details, whose Value row is the
// one place a figure is changed; the older look's pop-over is covered by ONE-13 and oneFigureEditor.spec.tsx.)
const SEEN = {
  form: () => document.querySelector('[data-testid="lane-edit-form"]'),
  details: () => document.querySelector('[data-testid="lane-inspector"]'),
  menu: () => document.querySelector('[role="menu"][aria-label="Canvas context menu"]'),
  add: () => document.querySelector('[data-testid="view-add-figure-form"]'),
}
type Name = keyof typeof SEEN
const open = (): Name[] => (Object.keys(SEEN) as Name[]).filter((k) => SEEN[k]() !== null)
const row = (label: string) => within(document.querySelector('[role="menu"][aria-label="Canvas context menu"]') as HTMLElement).getByText(label)

const OPENERS: Record<Name, () => Promise<void>> = {
  details: async () => { fireEvent.click(node(OPT)); await settle() },
  menu: async () => { fireEvent.contextMenu(node(OTHER)); await settle() },
  form: async () => { fireEvent.contextMenu(node(OTHER)); await settle(); fireEvent.click(row('Rename')); await settle() },
  add: async () => { fireEvent.click(screen.getByTestId('canvas-add-to-model')); fireEvent.click(screen.getByRole('menuitem', { name: 'Add a figure' })); await settle() },
}
// The field a person is typing in when they press Escape, for each surface that has one.
const FIELD: Partial<Record<Name, () => HTMLElement>> = {
  form: () => screen.getByTestId('lane-edit-label'),
  add: () => screen.getByTestId('view-add-figure-name'),
}

describe('surfaces step 2: one thing open at a time', () => {
  it('ONE-1 opening any one closes whatever else was open: after each opening, exactly that one is open (every kind opened after every other)', async () => {
    await board()
    const order: Name[] = ['add', 'details', 'menu', 'details', 'form', 'add', 'menu', 'form', 'menu', 'details', 'add', 'form', 'details']
    for (const k of order) { await OPENERS[k](); expect(open(), `after opening ${k}`).toEqual([k]) }
  })

  it.each(['form', 'add', 'details', 'menu'] as Name[])('ONE-2a Escape closes the open %s, pressed where a person presses it: in its field when it has one, else on the board', async (k) => {
    await board()
    await OPENERS[k]()
    expect(open()).toEqual([k])
    fireEvent.keyDown(FIELD[k]?.() ?? document.body, { key: 'Escape' })
    await settle()
    expect(open(), `Escape with ${k} open`).toEqual([])
  })

  it.each(['form', 'add'] as Name[])('ONE-2b Escape closes the open %s from anywhere, not only from inside it (focus on the board)', async (k) => {
    await board()
    await OPENERS[k]()
    expect(open()).toEqual([k])
    ;(document.activeElement as HTMLElement | null)?.blur()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    await settle()
    expect(open(), `Escape on the board with ${k} open`).toEqual([])
  })

  it.each(['form', 'add', 'details', 'menu'] as Name[])('ONE-3 a press on empty canvas closes the open %s', async (k) => {
    await board()
    await OPENERS[k]()
    expect(open()).toEqual([k])
    fireEvent.click(pane())
    await settle()
    expect(open(), `empty-canvas press with ${k} open`).toEqual([])
  })

  it('ONE-4 the card\'s preview (step A: the one box, previewing) is not up while any of the five is open, and the old pop-up is never drawn for a card on the lane. CONTRAST: the same hover with none open shows the preview', async () => {
    await board()
    const hover = (id: string): { peek: string | null; old: boolean } => {
      vi.useFakeTimers()
      fireEvent.mouseEnter(node(id).querySelector('[role="group"]')!)
      act(() => { vi.advanceTimersByTime(HOVER_CARD_OPEN_DELAY_MS + 50) })
      const seen = { peek: document.querySelector('[data-testid="lane-peek"]')?.getAttribute('data-box-card') ?? null, old: document.querySelector('[data-testid="node-hover-card"]') !== null }
      fireEvent.mouseLeave(node(id).querySelector('[role="group"]')!)
      act(() => { vi.advanceTimersByTime(500) })
      vi.useRealTimers()
      return seen
    }
    expect(open()).toEqual([])
    expect(hover(FIG2), 'contrast: nothing open, the preview shows this card').toEqual({ peek: FIG2, old: false })
    expect(document.querySelector('[data-testid="lane-peek"]'), 'left, the preview is gone').toBeNull()
    for (const k of ['details', 'menu', 'add'] as Name[]) {
      await OPENERS[k]()
      expect(open()).toEqual([k])
      expect(hover(FIG2), `preview while ${k} is open`).toEqual({ peek: null, old: false })
      expect(open(), `the hover changed nothing while ${k} is open`).toEqual([k])
    }
  })

  it.each(['add', 'menu'] as Name[])('ONE-5 Escape order with a waiting challenge: the first press closes the open %s and leaves the challenge waiting; the next press cancels it', async (k) => {
    await board(true)
    act(() => { useViewChat.setState({ armed: 'opposite' }) })
    // The menu on the empty board: right-clicking a card selects it, and a waiting challenge goes to the selected card.
    if (k === 'menu') { fireEvent.contextMenu(pane()); await settle() } else await OPENERS[k]()
    expect(open()).toEqual([k])
    fireEvent.keyDown(FIELD[k]?.() ?? document.body, { key: 'Escape' })
    await settle()
    expect(open(), 'first Escape closes the canvas surface').toEqual([])
    expect(useViewChat.getState().armed, 'first Escape leaves the challenge waiting').toBe('opposite')
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(useViewChat.getState().armed, 'second Escape cancels it').toBeNull()
  })

  it('ONE-7 Escape typed in another text field (an on-card rename, the message box) is that field\'s own: the open surface stays', async () => {
    await board()
    await OPENERS.details()
    const other = document.body.appendChild(document.createElement('input'))
    other.focus()
    fireEvent.keyDown(other, { key: 'Escape' })
    await settle()
    expect(open()).toEqual(['details'])
    other.remove()
  })

  it('ONE-8 a "Your figure" save in flight holds the details panel open: empty-canvas press, Escape and another surface leave it; core\'s refusal then lands in it', async () => {
    await board()
    await OPENERS.details()
    act(() => { useLaneInspector.getState().open({ kind: 'card', id: FIG }) })
    let release: (r: Response) => void = () => {}
    const held = new Promise<Response>((r) => { release = r })
    // Hold only core's POST; everything else answers as the harness stub does.
    const calls: string[] = []
    setTeamFetch((async (u: unknown, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      calls.push(`${method} ${String(u)}`)
      if (method === 'POST') return held
      return new Response(JSON.stringify(useViewStore.getState().view), { status: 200 })
    }) as unknown as typeof fetch)
    fireEvent.change(screen.getByTestId('inspector-figure-typed'), { target: { value: '1200' } })
    fireEvent.click(screen.getByTestId('inspector-figure-set'))
    await settle()
    expect(calls.some((c) => c.startsWith('POST')), 'the save is in flight').toBe(true)
    fireEvent.click(pane()); await settle()
    expect(open(), 'empty-canvas press while saving').toEqual(['details'])
    fireEvent.keyDown(document.body, { key: 'Escape' }); await settle()
    expect(open(), 'Escape while saving').toEqual(['details'])
    fireEvent.contextMenu(node(OTHER)); await settle()
    expect(open(), 'right-click while saving').toEqual(['details'])
    fireEvent.click(screen.getByTestId('canvas-add-to-model')); fireEvent.click(screen.getByRole('menuitem', { name: 'Add a figure' })); await settle()
    expect(open(), 'opening another surface while saving').toEqual(['details'])
    await act(async () => { release(new Response(JSON.stringify({ error: 'That figure is outside what the model allows.' }), { status: 409 })); await new Promise((r) => setTimeout(r, 60)) })
    expect(screen.getByTestId('inspector-figure-note'), 'core\'s refusal is shown in the panel').toHaveTextContent('That figure is outside what the model allows.')
    expect(open()).toEqual(['details'])
  })

  it('ONE-9 Escape in the message box with a canvas surface open closes the surface and leaves the waiting challenge waiting (S4 press: it used to leave the surface open); the next Escape, with none open, cancels the challenge', async () => {
    await board(true)
    act(() => { useViewChat.setState({ armed: 'opposite' }) })
    // Opened from the store: pressing a card would pick it for the waiting challenge.
    act(() => { useLaneInspector.getState().open({ kind: 'card', id: OPT }) }); await settle()
    expect(open()).toEqual(['details'])
    const field = document.getElementById('view-chat-text') as HTMLElement
    field.focus()
    fireEvent.keyDown(field, { key: 'Escape' }); await settle()
    expect(useViewChat.getState().armed, 'surface was open: the challenge keeps waiting').toBe('opposite')
    expect(open(), 'the surface is closed by the first press').toEqual([])
    fireEvent.keyDown(field, { key: 'Escape' }); await settle()
    expect(useViewChat.getState().armed, 'contrast: nothing open, Escape cancels it').toBeNull()
  })

  it('ONE-10 a press on an option card\'s pencil opens its details with the Value row\'s field focused, and the press is the control\'s own (the card\'s "open details" does not run a second time over it)', async () => {
    const base = approved()
    const quantity = base.model!.cards.find((c) => c.id === FIG)!
    const view = { ...base, model: { ...base.model!, cards: base.model!.cards.map((c) => (c.id === OPT ? { ...c, figure: quantity.figure } : c)) } } as View
    await board(false, view)
    fireEvent.click(screen.getByTestId(`view-figure-edit-${OPT}`)); await settle()
    expect(open(), 'the details are open, and no pop-over under the card').toEqual(['details'])
    expect(useLaneInspector.getState().current, 'asked for the figure, not just opened').toMatchObject({ kind: 'details', edit: 'value', target: { kind: 'card', id: OPT } })
    expect(document.activeElement).toBe(screen.getByTestId('inspector-figure-typed'))
  })

  it('ONE-11 a risk card\'s pencil opens its details with the Value row (its chance field focused); Escape closes it; a waiting challenge is not cancelled while it is open', async () => {
    await board(true)
    const pencil = () => within(node('slow_ramp')).getByTestId('view-figure-edit-slow_ramp')
    fireEvent.click(pencil()); await settle()
    expect(open(), 'the pencil opens the details, never the small form').toEqual(['details'])
    expect(document.activeElement).toBe(screen.getByTestId('inspector-figure-chance'))
    fireEvent.keyDown(screen.getByTestId('inspector-figure-chance'), { key: 'Escape' }); await settle()
    expect(open(), 'Escape closes it').toEqual([])
    fireEvent.click(pencil()); await settle()
    expect(open()).toEqual(['details'])
    act(() => { useViewChat.setState({ armed: 'opposite' }) })
    fireEvent.keyDown(document.body, { key: 'Escape' }); await settle()
    expect(open()).toEqual([])
    expect(useViewChat.getState().armed, 'the first Escape closed the details and left the challenge waiting').toBe('opposite')
  })

  it('ONE-12 "Your figure" is per card: typed on card A and the panel retargeted to card B, B starts from its own (empty) draft, A\'s words are kept for A, and Change on B never posts A\'s number', async () => {
    await board()
    const calls: string[] = []
    setTeamFetch((async (u: unknown, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      calls.push(`${method} ${String(u)} ${String(init?.body ?? '')}`)
      return new Response(JSON.stringify(useViewStore.getState().view), { status: 200 })
    }) as unknown as typeof fetch)
    act(() => { useLaneInspector.getState().open({ kind: 'card', id: FIG }) }); await settle()
    fireEvent.change(screen.getByTestId('inspector-figure-typed'), { target: { value: '777' } })
    act(() => { useLaneInspector.getState().open({ kind: 'card', id: FIG2 }) }); await settle()
    expect((screen.getByTestId('inspector-figure-typed') as HTMLInputElement).value, 'card B starts from its own draft').toBe('')
    expect(screen.queryByTestId('inspector-figure-set'), 'B\'s empty field has no Set to press (S4 details)').toBeNull()
    fireEvent.submit(screen.getByTestId('inspector-your-figure')); await settle()
    expect(calls.filter((c) => c.startsWith('POST')), 'nothing of A\'s is posted for B').toEqual([])
    act(() => { useLaneInspector.getState().open({ kind: 'card', id: FIG }) }); await settle()
    expect((screen.getByTestId('inspector-figure-typed') as HTMLInputElement).value, 'back on A: A\'s words').toBe('777')
  })

  it('ONE-13 the older look is unchanged: where the core lane is off, a press on a card\'s own control still reaches "open details" (the exclusion list is the lane\'s)', async () => {
    const base = approved()
    const quantity = base.model!.cards.find((c) => c.id === FIG)!
    const view = { ...base, model: { ...base.model!, cards: base.model!.cards.map((c) => (c.id === OPT ? { ...c, figure: quantity.figure } : c)) } } as View
    await board(false, view)
    lane.on = false
    fireEvent.click(screen.getByTestId(`view-figure-edit-${OPT}`)); await settle()
    expect(open(), 'older look: the press on the pencil also opens the details, as before').toEqual(['details'])
    lane.on = true
    fireEvent.click(pane()); await settle()
    fireEvent.click(screen.getByTestId(`view-figure-edit-${OPT}`)); await settle()
    expect(open(), 'contrast, lane on: the pencil asks for the figure in the details (the one place), no pop-over').toEqual(['details'])
    expect(useLaneInspector.getState().current).toMatchObject({ kind: 'details', edit: 'value' })
  })

  it('ONE-6 (kept as today) words typed in the edit form survive another surface opening, and are there when it is opened again', async () => {
    await board()
    await OPENERS.form()
    fireEvent.change(screen.getByTestId('lane-edit-label'), { target: { value: 'My new name' } })
    fireEvent.click(screen.getByTestId(`view-figure-edit-${FIG}`)); await settle()
    expect(open()).toEqual(['details'])
    await OPENERS.form()
    expect((screen.getByTestId('lane-edit-label') as HTMLInputElement).value).toBe('My new name')
  })
})

// SURFACES STEP 3 (18 Nov): the details open beside their card. Boxes are mocked as the hover-card specs do (jsdom lays nothing out): each card's box
// from a table, the panel's from where it was placed (its two position properties; the old fixed corner, 76 x 112, where it set none).
describe('surfaces step 3: details beside their card', () => {
  type Box = { left: number; top: number; width: number; height: number }
  const cards: Record<string, Box> = {}
  const PANEL = { width: 280, height: 300 }
  const rectOf = (b: Box) => ({ ...b, x: b.left, y: b.top, right: b.left + b.width, bottom: b.top + b.height, toJSON: () => ({}) }) as DOMRect
  // The panel's box from where it was placed and the height it was capped to (its two position properties and its cap; the old fixed corner, 76 x 112, where it set none).
  const panelBox = (el: Element): Box => {
    const s = (el as HTMLElement).style
    return { left: parseFloat(s.getPropertyValue('--lane-details-x')) || 76, top: parseFloat(s.getPropertyValue('--lane-details-y')) || 112, width: PANEL.width, height: Math.min(PANEL.height, parseFloat(s.getPropertyValue('--lane-details-h')) || PANEL.height) }
  }
  const FORM_HEIGHT = 420
  const formBox = (el: Element): Box => {
    const s = (el as HTMLElement).style
    return { left: parseFloat(s.getPropertyValue('--lane-form-x')) || parseFloat(s.left) || 8, top: parseFloat(s.getPropertyValue('--lane-form-y')) || parseFloat(s.top) || 8, width: 280, height: Math.min(formHeight.now, parseFloat(s.getPropertyValue('--lane-form-h')) || formHeight.now) }
  }
  const formHeight = { now: PANEL.height }
  // The window's chrome, as boxes by selector (the left rail, the top bar, the outputs dock), for a small free canvas.
  const chrome: Array<[string, Box]> = []
  const extras: HTMLElement[] = []
  const withChrome = (): void => {
    for (const [tag, label, role] of [['nav', 'Canvas tools', null], ['aside', 'Outputs dock', null], ['div', null, 'banner']] as const) {
      const el = document.createElement(tag); if (label !== null) el.setAttribute('aria-label', label); if (role !== null) el.setAttribute('role', role)
      document.body.appendChild(el); extras.push(el)
    }
    chrome.push(['nav[aria-label="Canvas tools"]', { left: 0, top: 112, width: 76, height: 400 }], ['aside[aria-label="Outputs dock"]', { left: 536, top: 112, width: 24, height: 400 }], ['[role="banner"]', { left: 0, top: 0, width: 560, height: 112 }])
  }
  const mockBoxes = () => vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const node = this.closest('.react-flow__node')
    if (node !== null) return rectOf(cards[node.getAttribute('data-id') ?? ''] ?? { left: 0, top: 0, width: 0, height: 0 })
    if (this.matches('[data-testid="lane-inspector"]')) return rectOf(panelBox(this))
    if (this.matches('[data-testid="lane-edit-form"]')) return rectOf(formBox(this))
    for (const [sel, box] of chrome) if (this.matches(sel)) return rectOf(box)
    return rectOf({ left: 0, top: 0, width: 0, height: 0 })
  })
  const area = (a: DOMRect, b: DOMRect) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  const inspector = () => document.querySelector<HTMLElement>('[data-testid="lane-inspector"]')!
  const win = { w: window.innerWidth, h: window.innerHeight }
  afterEach(() => { vi.restoreAllMocks(); for (const k of Object.keys(cards)) delete cards[k]; chrome.length = 0; for (const e of extras.splice(0)) e.remove(); formHeight.now = PANEL.height; Object.assign(window, { innerWidth: win.w, innerHeight: win.h }); lane.on = true })

  it('S3-a the panel stands beside its own card and never over it, wherever the card is (on the old corner, mid-board, near the dock), and follows when the board moves; no fixed corner', async () => {
    mockBoxes()
    await board()
    for (const [label, box] of [['on the old corner', { left: 100, top: 130, width: 220, height: 120 }], ['mid-board', { left: 400, top: 300, width: 220, height: 120 }], ['near the dock', { left: 760, top: 300, width: 220, height: 120 }]] as const) {
      cards[OPT] = box
      act(() => { useLaneInspector.getState().close() })
      fireEvent.click(node(OPT)); await settle()
      const mine = rectOf(box), panel = rectOf(panelBox(inspector()))
      expect(area(panel, mine), `${label}: the panel's box over its own card`).toBe(0)
      expect(panel.left, `${label}: inside the window`).toBeGreaterThanOrEqual(0)
      expect(panel.right, `${label}: inside the window`).toBeLessThanOrEqual(window.innerWidth)
      expect(inspector().className, 'no fixed corner').not.toMatch(/left-\[76px\]|top-\[112px\]/)
    }
    // It follows: the card moves (a pan), the panel is placed again beside the card's new place.
    cards[OPT] = { left: 300, top: 400, width: 220, height: 120 }; await settle()
    expect(area(rectOf(panelBox(inspector())), rectOf(cards[OPT])), 'after the board moved').toBe(0)
    expect(panelBox(inspector()).left, 'it moved with the card').toBeGreaterThan(300)
  })

  it('S3-b a press on a card that is not an option (a quantity card) opens its details on the lane, the card\'s own pencil does not, and the older look opens them for an option only', async () => {
    await board()
    fireEvent.click(node(FIG)); await settle()
    expect(open()).toEqual(['details'])
    expect(useLaneInspector.getState().current).toMatchObject({ kind: 'details', target: { kind: 'card', id: FIG } })
    act(() => { useLaneInspector.getState().close() })
    fireEvent.click(screen.getByTestId(`view-figure-edit-${FIG}`)); await settle()
    expect(open(), 'the pencil opens the details too, for the figure').toEqual(['details'])
    expect(useLaneInspector.getState().current).toMatchObject({ kind: 'details', edit: 'value', target: { kind: 'card', id: FIG } })
    act(() => { useLaneInspector.getState().dismiss(true) })
    lane.on = false
    fireEvent.click(node(FIG)); await settle()
    expect(open(), 'older look: a quantity card still opens nothing').toEqual([])
    fireEvent.click(node(OPT)); await settle()
    expect(open(), 'contrast, older look: an option still opens its details').toEqual(['details'])
  })

  it('S3-c the panel holds, drawn open, the card\'s own authorship and, for an option with a result, its headline basis sentence; each by its card, none of another\'s', async () => {
    const base = approved()
    const BASIS = 'In this model, on current information, the chance of meeting your goal rests on Olumi’s assumption that each link might not hold.'
    const view = { ...base, model: { ...base.model!, cards: base.model!.cards.map((c) => (c.id === OPT
      ? { ...c, author: { text: 'Your option', by: 'you', title: 'You wrote this' }, headline: { ...(c.headline ?? {}), title: BASIS } }
      : c.id === OTHER ? { ...c, author: { text: 'Olumi’s estimate', by: 'olumi', title: 'Olumi estimated this' } } : c)) } } as unknown as View
    await board(false, view)
    fireEvent.click(node(OPT)); await settle()
    expect(screen.getByTestId('lane-inspector-author')).toHaveTextContent('Your option')
    expect(screen.getByTestId('lane-inspector-basis')).toHaveTextContent(BASIS)
    fireEvent.click(node(OTHER)); await settle()
    expect(screen.getByTestId('lane-inspector-author'), 'the other card\'s own authorship').toHaveTextContent('Olumi’s estimate')
    expect(screen.getByTestId('lane-inspector-author').className, 'Olumi\'s in Olumi\'s blue').toMatch(/text-info/)
    expect(screen.queryByTestId('lane-inspector-basis'), 'no result, no basis sentence').toBeNull()
  })

  it('S3-d the one form opened from the panel takes the panel\'s place: at the panel\'s own position, not a fixed corner', async () => {
    mockBoxes()
    await board()
    cards[FIG] = { left: 500, top: 350, width: 220, height: 120 }
    fireEvent.click(node(FIG)); await settle()
    const at = { x: parseFloat(inspector().style.getPropertyValue('--lane-details-x')), y: parseFloat(inspector().style.getPropertyValue('--lane-details-y')) }
    expect(at.x, 'the panel is not on the old corner').not.toBe(76)
    const button = OPEN_EDIT()
    fireEvent.click(button); await settle()
    expect(open(), 'the form replaced the panel').toEqual(['form'])
    const form = document.querySelector<HTMLElement>('[data-testid="lane-edit-form"]')!
    expect({ x: parseFloat(form.style.getPropertyValue('--lane-form-x')), y: parseFloat(form.style.getPropertyValue('--lane-form-y')) }, 'the form stands where the panel stood').toEqual(at)
  })

  const ownCard = (id: string) => rectOf(cards[id]!)
  // Step A: the box's edit rows (Rename, add a risk, …) open from its "More" press; the first one core offers is pressed here.
  const OPEN_EDIT = () => {
    if (document.querySelector('[data-testid="lane-inspector"] [role="group"][aria-label="Edit"]') === null) fireEvent.click(screen.getByTestId('lane-inspector-more'))
    return document.querySelector<HTMLElement>('[data-testid="lane-inspector"] [role="group"][aria-label="Edit"] button:not([aria-disabled])')!
  }

  it('S3-e a card where no side holds the whole panel: the panel is cut to the room on the roomiest side (its body scrolls, its header and close stay), never over its own card, and inside the free canvas', async () => {
    mockBoxes(); withChrome()
    Object.assign(window, { innerWidth: 560, innerHeight: 512 })      // free canvas: 76..536 x 112..512, 460 x 400, with the rail and the dock
    await board()
    cards[OPT] = { left: 230, top: 270, width: 220, height: 120 }      // mid-board: 154 left, 86 right, 126 below, 142 above: no side holds 280 x 300
    fireEvent.click(node(OPT)); await settle()
    const panel = rectOf(panelBox(inspector())), mine = ownCard(OPT)
    expect(area(panel, mine), 'the panel over its own card').toBe(0)
    expect(panel.left, 'inside the free canvas').toBeGreaterThanOrEqual(76); expect(panel.right).toBeLessThanOrEqual(536)
    expect(panel.top).toBeGreaterThanOrEqual(112); expect(panel.bottom).toBeLessThanOrEqual(512)
    expect(inspector().style.getPropertyValue('--lane-details-h'), 'cut to the roomiest side (above: 142)').toBe('142px')
    expect(inspector().querySelector('[data-testid="lane-inspector-title"]'), 'the header is outside the scrolling body').not.toBeNull()
    expect(inspector().querySelector('.overflow-y-auto [data-testid="lane-inspector-title"]')).toBeNull()
    expect(screen.getByLabelText('Close details').closest('.overflow-y-auto'), 'the close stays').toBeNull()
  })

  it('S3-f the older look keeps the fixed corner, no new lines and the old form anchor (372, 112)', async () => {
    const base = approved()
    const view = { ...base, model: { ...base.model!, cards: base.model!.cards.map((c) => (c.id === OPT ? { ...c, author: { text: 'Your option', by: 'you', title: 'You wrote this' }, headline: { ...(c.headline ?? {}), title: 'Basis sentence' } } : c)) } } as unknown as View
    lane.on = false
    await board(false, view)
    fireEvent.click(node(OPT)); await settle()
    expect(inspector().className).toMatch(/left-\[76px\]/); expect(inspector().className).toMatch(/top-\[112px\]/)
    expect(inspector().style.getPropertyValue('--lane-details-x'), 'no placement written').toBe('')
    expect(screen.queryByTestId('lane-inspector-author')).toBeNull(); expect(screen.queryByTestId('lane-inspector-basis')).toBeNull()
    fireEvent.click(OPEN_EDIT()); await settle()
    const form = document.querySelector<HTMLElement>('[data-testid="lane-edit-form"]')!
    expect({ x: form.style.left, y: form.style.top }, 'the old anchor').toEqual({ x: '372px', y: '112px' })
  })

  it('S3-g the form opened from a panel that stands above its card: taller than the panel, it still never covers the card (same rule, same card), inside the free canvas', async () => {
    mockBoxes()
    await board()
    cards[FIG] = { left: 40, top: 560, width: 940, height: 120 }   // no side but above holds a panel
    fireEvent.click(node(FIG)); await settle()
    expect(parseFloat(inspector().style.getPropertyValue('--lane-details-y')), 'the panel is above its card').toBeLessThan(560)
    formHeight.now = FORM_HEIGHT
    fireEvent.click(OPEN_EDIT()); await settle()
    const form = document.querySelector<HTMLElement>('[data-testid="lane-edit-form"]')!
    const box = rectOf(formBox(form))
    expect(area(box, ownCard(FIG)), 'the form over its own card').toBe(0)
    expect(box.top).toBeGreaterThanOrEqual(0); expect(box.bottom).toBeLessThanOrEqual(window.innerHeight)
  })

  it('S3-h a link\'s anchor is the middle of its drawn line, not of its box; the box middle where the line cannot be measured', () => {
    const ID = 'a->b:causal'
    const edge = document.createElement('div'); edge.className = 'react-flow__edge'; edge.setAttribute('data-id', ID)
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('class', 'react-flow__edge-path'); edge.appendChild(path)
    edge.getBoundingClientRect = () => rectOf({ left: 0, top: 0, width: 200, height: 200 })
    document.body.appendChild(edge); extras.push(edge)
    expect(anchorOf({ kind: 'link', id: ID }).anchor, 'no line to measure: the box middle').toEqual({ left: 100, top: 100, right: 100, bottom: 100 })
    Object.assign(path, { getTotalLength: () => 100, getPointAtLength: (l: number) => ({ x: l, y: 0 }), getScreenCTM: () => ({ a: 1, b: 0, c: 0, d: 1, e: 10, f: 20 }) })
    expect(anchorOf({ kind: 'link', id: ID }).anchor, 'half way along the line, on screen').toEqual({ left: 60, top: 20, right: 60, bottom: 20 })
  })

  it('S3-i a card panned off the free canvas: the panel stays visible and focusable, inside the free canvas, and a press on Escape closes it as a normal visible surface', async () => {
    mockBoxes()
    await board()
    cards[OPT] = { left: 400, top: 300, width: 220, height: 120 }
    fireEvent.click(node(OPT)); await settle()
    const shown = inspector()
    cards[OPT] = { left: -2000, top: 300, width: 220, height: 120 }; await settle()
    expect(inspector(), 'the same panel, still mounted').toBe(shown)
    expect(shown.getAttribute('aria-hidden')).toBeNull(); expect(shown.hasAttribute('inert')).toBe(false); expect(shown.hasAttribute('data-off')).toBe(false)
    const close = screen.getByLabelText('Close details'); close.focus()
    expect(document.activeElement, 'focusable').toBe(close)
    const box = rectOf(panelBox(shown))
    expect(box.left).toBeGreaterThanOrEqual(0); expect(box.right).toBeLessThanOrEqual(window.innerWidth)
    expect(box.top).toBeGreaterThanOrEqual(0); expect(box.bottom).toBeLessThanOrEqual(window.innerHeight)
    expect(shown.style.getPropertyValue('--lane-details-x'), 'placed, not left hidden').not.toBe('')
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(open(), 'Escape closes it').toEqual([])
  })

  it('S3-j capped to 120px, the form keeps Save, Cancel and its error line outside the scrolling element, visible', async () => {
    mockBoxes(); withChrome()
    Object.assign(window, { innerWidth: 560, innerHeight: 512 })
    await board()
    cards[OPT] = { left: 230, top: 270, width: 220, height: 120 }
    fireEvent.click(node(OPT)); await settle()
    formHeight.now = FORM_HEIGHT
    fireEvent.click(OPEN_EDIT()); await settle()
    const form = document.querySelector<HTMLElement>('[data-testid="lane-edit-form"]')!
    form.style.setProperty('--lane-form-h', '120px')
    for (const id of ['lane-edit-go', 'lane-edit-cancel']) {
      const b = screen.getByTestId(id)
      expect(form.contains(b), id).toBe(true)
      expect(b.closest('.overflow-y-auto'), `${id} outside the scrolling element`).toBeNull()
    }
    expect(form.querySelector('.overflow-y-auto [data-testid="lane-edit-label"]'), 'the fields scroll').not.toBeNull()
    expect(form.getAttribute('aria-hidden')).toBeNull(); expect(form.hasAttribute('inert')).toBe(false)
  })

  it('S3-k with nothing moving, a further frame performs no style write on a capped panel', async () => {
    mockBoxes(); withChrome()
    Object.assign(window, { innerWidth: 560, innerHeight: 512 })
    await board()
    cards[OPT] = { left: 230, top: 270, width: 220, height: 120 }
    fireEvent.click(node(OPT)); await settle()
    const el = inspector()
    expect(el.style.getPropertyValue('--lane-details-h'), 'capped').not.toBe('')
    const writes: string[] = []
    const set = vi.spyOn(CSSStyleDeclaration.prototype, 'setProperty').mockImplementation(function (this: CSSStyleDeclaration, k: string) { if (this === el.style) writes.push(`set ${k}`) })
    const rem = vi.spyOn(CSSStyleDeclaration.prototype, 'removeProperty').mockImplementation(function (this: CSSStyleDeclaration, k: string) { if (this === el.style) writes.push(`remove ${k}`); return '' })
    await settle()
    set.mockRestore(); rem.mockRestore()
    expect(writes).toEqual([])
  })

  it('S3-l a target with no drawn card: the panel and the form stand at the free canvas top-left fallback, not the previous card\'s place and not 8, 8', async () => {
    mockBoxes()
    await board()
    cards[OPT] = { left: 500, top: 350, width: 220, height: 120 }; cards[OTHER] = { left: 100, top: 400, width: 220, height: 120 }
    fireEvent.click(node(OPT)); await settle()
    const prev = { x: inspector().style.getPropertyValue('--lane-details-x'), y: inspector().style.getPropertyValue('--lane-details-y') }
    expect(prev.x).not.toBe('')
    node(OTHER).setAttribute('data-id', 'undrawn')      // OTHER's card is in the model, but not drawn on the canvas
    act(() => { useLaneInspector.getState().open({ kind: 'card', id: OTHER }) }); await settle()
    const at = { x: inspector().style.getPropertyValue('--lane-details-x'), y: inspector().style.getPropertyValue('--lane-details-y') }
    expect(at, 'not the previous card\'s place').not.toEqual(prev)
    const free = freeCanvas()
    expect(at, 'exactly the free canvas top-left, one gap in').toEqual({ x: `${free.left + HOVER_CARD_GAP}px`, y: `${free.top + HOVER_CARD_GAP}px` })
    fireEvent.click(OPEN_EDIT()); await settle()
    const form = document.querySelector<HTMLElement>('[data-testid="lane-edit-form"]')!
    expect({ x: form.style.getPropertyValue('--lane-form-x'), y: form.style.getPropertyValue('--lane-form-y') }, 'the form uses the same fallback').toEqual(at)
  })

  it('S3-n a target with no drawn card and a form taller than the free canvas: the form is capped to the free canvas\'s height (Save stays reachable), never left to run below the window (Codex 008 item 4)', async () => {
    mockBoxes()
    await board()
    cards[OPT] = { left: 500, top: 350, width: 220, height: 120 }; cards[OTHER] = { left: 100, top: 400, width: 220, height: 120 }
    node(OTHER).setAttribute('data-id', 'undrawn')
    act(() => { useLaneInspector.getState().open({ kind: 'card', id: OTHER }) }); await settle()
    formHeight.now = freeCanvas().bottom - freeCanvas().top + 300   // taller than the free canvas, whatever this window is
    fireEvent.click(OPEN_EDIT()); await settle(); await settle()
    const form = document.querySelector<HTMLElement>('[data-testid="lane-edit-form"]')!
    const free = freeCanvas(), cap = parseFloat(form.style.getPropertyValue('--lane-form-h'))
    expect(Number.isFinite(cap), 'the form carries a height cap').toBe(true)
    expect(parseFloat(form.style.getPropertyValue('--lane-form-y')) + cap).toBeLessThanOrEqual(free.bottom)
    expect(form.querySelector('[data-testid="lane-edit-save"], button[type="submit"]'), 'Save is drawn').not.toBeNull()
  })

  it('S3-o the panel never covers a foot control (the "N more cards below" cue): it is cut to end a gap above it; CONTRAST without the cue it keeps its height', () => {
    const free = { left: 0, top: 0, right: 900, bottom: 700 }, card = { left: 100, top: 300, right: 320, bottom: 420 }
    const cueBox = { left: 340, top: 620, right: 520, bottom: 656 }
    const without = placeBeside(card, null, { width: 280, height: 360 }, free)
    const cue = document.createElement('div'); cue.setAttribute('data-testid', 'view-below-cue'); const btn = document.createElement('button'); cue.appendChild(btn); document.body.appendChild(cue)
    const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      return (this === btn ? { ...cueBox, x: cueBox.left, y: cueBox.top, width: 180, height: 36, toJSON: () => ({}) } : { left: 0, top: 0, right: 0, bottom: 0, x: 0, y: 0, width: 0, height: 0, toJSON: () => ({}) }) as DOMRect
    })
    try {
      const p = placeBeside(card, null, { width: 280, height: 360 }, free)
      const bottom = p.top + (p.maxHeight ?? 360)
      const coversCue = p.left < cueBox.right && p.left + 280 > cueBox.left && p.top < cueBox.bottom && bottom > cueBox.top
      expect(coversCue, `panel ${p.left},${p.top} h ${p.maxHeight}`).toBe(false)
      expect(p.left + 280 <= card.left || p.left >= card.right || bottom <= card.top || p.top >= card.bottom, 'still clear of its own card').toBe(true)
    } finally { spy.mockRestore(); cue.remove() }
    expect(without.maxHeight, 'CONTRAST: with no cue the same place keeps its full height').toBeNull()
  })

  it('S3-p (Codex 30422 hold) lifting the panel off a foot control never puts it on its own card: with a clear place above the card, that place is chosen', () => {
    const free = { left: 0, top: 0, right: 600, bottom: 400 }, card = { left: 180, top: 80, right: 420, bottom: 300 }
    const cueBox = { left: 190, top: 340, right: 470, bottom: 376 }
    const cue = document.createElement('div'); cue.setAttribute('data-testid', 'view-below-cue'); const btn = document.createElement('button'); cue.appendChild(btn); document.body.appendChild(cue)
    const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      return (this === btn ? { ...cueBox, x: cueBox.left, y: cueBox.top, width: 280, height: 36, toJSON: () => ({}) } : { left: 0, top: 0, right: 0, bottom: 0, x: 0, y: 0, width: 0, height: 0, toJSON: () => ({}) }) as DOMRect
    })
    try {
      const p = placeBeside(card, null, { width: 280, height: 360 }, free)
      const box = { left: p.left, top: p.top, right: p.left + 280, bottom: p.top + (p.maxHeight ?? 360) }
      const ov = (b: { left: number; top: number; right: number; bottom: number }, c: { left: number; top: number; right: number; bottom: number }) => Math.max(0, Math.min(b.right, c.right) - Math.max(b.left, c.left)) * Math.max(0, Math.min(b.bottom, c.bottom) - Math.max(b.top, c.top))
      expect(ov(box, card), `own card, panel ${p.left},${p.top} h ${p.maxHeight}`).toBe(0)
      expect(ov(box, cueBox), 'foot cue').toBe(0)
      expect(box.bottom <= card.top, 'the clear place above the card').toBe(true)
    } finally { spy.mockRestore(); cue.remove() }
  })

  it('S3-r (Paul 19 Nov) a card at the board\'s foot with a card row above it: the box is not slid up onto that row; it stands beside the card at the card\'s own top, cut to the room below (its body scrolls). CONTRAST with no row above the hover rule\'s own place is kept', () => {
    const free = { left: 0, top: 0, right: 1000, bottom: 700 }, card = { left: 400, top: 560, right: 620, bottom: 680 }
    const row = [{ left: 640, top: 300, right: 900, bottom: 420 }, { left: 120, top: 300, right: 380, bottom: 420 }]
    const size = { width: 280, height: 360 }
    const nodes = row.map(() => { const n = document.createElement('div'); n.className = 'react-flow__node'; document.body.appendChild(n); return n })
    const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const i = nodes.indexOf(this as HTMLDivElement), r = i >= 0 ? row[i]! : { left: 0, top: 0, right: 0, bottom: 0 }
      return { ...r, x: r.left, y: r.top, width: r.right - r.left, height: r.bottom - r.top, toJSON: () => ({}) } as DOMRect
    })
    try {
      const p = placeBeside(card, null, size, free)
      const box = { left: p.left, top: p.top, right: p.left + size.width, bottom: p.top + (p.maxHeight ?? size.height) }
      const on = (b: typeof box, c: { left: number; top: number; right: number; bottom: number }) => b.left < c.right && b.right > c.left && b.top < c.bottom && b.bottom > c.top
      expect(row.some((c) => on(box, c)), `box ${JSON.stringify(box)} on the row above`).toBe(false)
      expect(p.top, 'at the card\'s own top, not lifted').toBe(card.top)
      expect(p.maxHeight, 'cut to the room below, its body scrolls').not.toBeNull()
    } finally { spy.mockRestore(); nodes.forEach((n) => n.remove()) }
    const free2 = placeBeside(card, null, size, free)
    expect(free2.top, 'CONTRAST: with the row gone the same card keeps the hover rule\'s lifted place').toBeLessThan(card.top)
  })

  it('S3-s (Paul 19 Nov, "pop-overs cover the risk cards") a pinned box on a FULL board, where every side of its card has another card: the board slides once so the card and its box both stand in the window, and after the slide no card is under the box; CONTRAST with no board to slide the box still lands on a card', () => {
    // A 3 x 3 board filling the window (1024 x 768 in jsdom), 30 px between cards: the middle card has a card on every side, closer than the box is wide.
    const grid = [20, 350, 680].flatMap((x) => [40, 290, 540].map((y) => ({ left: x, top: y, right: x + 300, bottom: y + 200 })))
    const mid = 4, size = { width: 280, height: 300 }
    const nodes = grid.map((_, i) => { const n = document.createElement('div'); n.className = 'react-flow__node'; n.setAttribute('data-id', `g${i}`); document.body.appendChild(n); return n })
    const el = document.createElement('aside'); document.body.appendChild(el)
    const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const i = nodes.indexOf(this as HTMLDivElement), r = this === el ? { left: 0, top: 0, right: size.width, bottom: size.height } : i >= 0 ? grid[i]! : { left: 0, top: 0, right: 0, bottom: 0 }
      return { ...r, x: r.left, y: r.top, width: r.right - r.left, height: r.bottom - r.top, toJSON: () => ({}) } as DOMRect
    })
    const vars = { x: '--t-x', y: '--t-y', h: '--t-h' }
    const boxAt = () => { const left = parseFloat(el.style.getPropertyValue(vars.x)), top = parseFloat(el.style.getPropertyValue(vars.y)), h = parseFloat(el.style.getPropertyValue(vars.h)) || size.height; return { left, top, right: left + size.width, bottom: top + h } }
    const on = (b: { left: number; top: number; right: number; bottom: number }, c: typeof b) => Math.min(b.right, c.right) - Math.max(b.left, c.left) > 2 && Math.min(b.bottom, c.bottom) - Math.max(b.top, c.top) > 2
    const slides: BoardView[] = []
    try {
      const off = registerBoxCamera({ get: () => ({ x: 0, y: 0, zoom: 1 }), set: (v) => { slides.push(v) } })
      const stop = stayBeside(() => el, { kind: 'card', id: `g${mid}` }, vars, 280, undefined, () => 0, () => true)
      stop(); off()
      expect(slides.length, 'the board slides once').toBe(1)
      const { x: dx, y: dy } = slides[0]!, b = boxAt(), card = grid[mid]!
      const moved = grid.map((c) => ({ left: c.left + dx, top: c.top + dy, right: c.right + dx, bottom: c.bottom + dy }))
      expect(moved.filter((c) => on(b, c)).length, `box ${JSON.stringify(b)} after a slide of ${dx},${dy}: no card under it, its own included`).toBe(0)
      expect(b.left >= 0 && b.right <= window.innerWidth && b.top >= 0 && b.bottom <= window.innerHeight, 'the box is inside the window').toBe(true)
      const c = moved[mid]!
      expect(c.left >= 0 && c.right <= window.innerWidth && c.top >= 0 && c.bottom <= window.innerHeight, `its card ${JSON.stringify(card)} is still whole in the window after the slide`).toBe(true)
      // CONTRAST: no camera (nothing can slide), the same press: the box can only stand beside its card, on another one.
      const stop2 = stayBeside(() => el, { kind: 'card', id: `g${mid}` }, vars, 280, undefined, () => 0, () => true)
      stop2()
      expect(grid.some((g, i) => i !== mid && on(boxAt(), g)), 'CONTRAST: with nothing to slide the box is on a card').toBe(true)
    } finally { spy.mockRestore(); nodes.forEach((n) => n.remove()); el.remove() }
  })

  // A full board driven frame by frame: a fake clock and animation frames, and a camera that moves every card by the slide (or, `cut`, lets a slide go
  // nowhere, as when another move of the board interrupts it).
  const slideRig = (boxH: number) => {
    const grid = [20, 350, 680].flatMap((x) => [40, 290, 540].map((y) => ({ left: x, top: y, right: x + 300, bottom: y + 200 })))
    const nodes = grid.map((_, i) => { const n = document.createElement('div'); n.className = 'react-flow__node'; n.setAttribute('data-id', `g${i}`); document.body.appendChild(n); return n })
    const el = document.createElement('aside'); document.body.appendChild(el)
    const box = { h: boxH }
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const i = nodes.indexOf(this as HTMLDivElement), r = this === el ? { left: 0, top: 0, right: 280, bottom: box.h } : i >= 0 ? grid[i]! : { left: 0, top: 0, right: 0, bottom: 0 }
      return { ...r, x: r.left, y: r.top, width: r.right - r.left, height: r.bottom - r.top, toJSON: () => ({}) } as DOMRect
    })
    let t = 1000, frames: FrameRequestCallback[] = []
    vi.spyOn(performance, 'now').mockImplementation(() => t)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { frames.push(cb); return frames.length })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => { frames = [] })
    const view = { x: 0, y: 0 }, slides: BoardView[] = [], camera = { cut: false }
    const off = registerBoxCamera({ get: () => ({ ...view, zoom: 1 }), set: (v) => {
      slides.push(v)
      if (camera.cut) return
      const dx = v.x - view.x, dy = v.y - view.y
      for (const g of grid) { g.left += dx; g.right += dx; g.top += dy; g.bottom += dy }
      view.x = v.x; view.y = v.y
    } })
    const vars = { x: '--t-x', y: '--t-y', h: '--t-h' }
    const frame = (n = 1, ms = 50) => { for (let k = 0; k < n; k += 1) { t += ms; const f = frames; frames = []; f.forEach((cb) => cb(t)) } }
    const shown = () => { const left = parseFloat(el.style.getPropertyValue(vars.x)), top = parseFloat(el.style.getPropertyValue(vars.y)), cap = parseFloat(el.style.getPropertyValue(vars.h)), h = Number.isNaN(cap) ? box.h : Math.min(cap, box.h); return { left, top, right: left + 280, bottom: top + h, h } }
    const under = () => { const b = shown(); return grid.filter((c) => Math.min(b.right, c.right) - Math.max(b.left, c.left) > 2 && Math.min(b.bottom, c.bottom) - Math.max(b.top, c.top) > 2).length }
    const inWindow = () => { const b = shown(); return b.left >= 0 && b.top >= 0 && b.right <= window.innerWidth && b.bottom <= window.innerHeight }
    const start = () => stayBeside(() => el, { kind: 'card', id: 'g4' }, vars, 280, undefined, () => 0, () => true)
    const done = () => { off(); nodes.forEach((n) => n.remove()); el.remove() }
    return { el, box, camera, slides, frame, shown, under, inWindow, start, done }
  }

  it('S3-t (pair check 19 Nov, 1.33 scale) a tall box on a full board gets a slide for its whole height: it is never cut shorter to save sliding the board', () => {
    const rig = slideRig(300)
    try {
      const stop = rig.start()
      rig.frame(12)
      stop()
      expect([rig.slides.length, rig.under(), rig.shown().h], 'one slide, no card under the box, and the whole box').toEqual([1, 0, 300])
      expect(rig.inWindow(), 'inside the window').toBe(true)
    } finally { rig.done() }
  })

  it('S3-u (pair check 19 Nov) a slide another move of the board cut short is checked once the board is still: the board slides again and no card is under the box. CONTRAST with nothing cut, one slide', () => {
    const cut = slideRig(300)
    try {
      cut.camera.cut = true
      const stop = cut.start()
      cut.frame(3)
      cut.camera.cut = false
      cut.frame(20)
      stop()
      expect(cut.slides.length, 'the slide that went nowhere, then one that landed').toBe(2)
      expect(cut.under(), `no card under the box (${JSON.stringify(cut.shown())})`).toBe(0)
      expect(cut.inWindow(), 'inside the window').toBe(true)
    } finally { cut.done() }
    const clean = slideRig(300)
    try {
      const stop = clean.start()
      clean.frame(20)
      stop()
      expect([clean.slides.length, clean.under()], 'CONTRAST: a slide that lands is the only one').toEqual([1, 0])
    } finally { clean.done() }
  })

  it('S3-m a capped form is never cut below its least useful height (Save stays whole): with 100 px of room on every side a form keeps FORM_MIN_SHOWN; CONTRAST a panel may be cut lower', () => {
    const free = { left: 0, top: 0, right: 600, bottom: 340 }, card = { left: 180, top: 110, right: 420, bottom: 230 }
    const form = placeBeside(card, null, { width: 280, height: 420 }, free, FORM_MIN_SHOWN)
    expect(form.maxHeight === null || form.maxHeight >= FORM_MIN_SHOWN, `form cap ${form.maxHeight}`).toBe(true)
    const panel = placeBeside(card, null, { width: 280, height: 420 }, free)
    expect(panel.maxHeight).not.toBeNull()
    expect(panel.maxHeight!).toBeLessThan(FORM_MIN_SHOWN)
  })
})

describe('surfaces step A: the card\'s one box previews on hover and pins on press', () => {
  const rest = (id: string): void => { fireEvent.mouseEnter(node(id).querySelector('[role="group"]')!); act(() => { vi.advanceTimersByTime(HOVER_CARD_OPEN_DELAY_MS + 50) }) }
  const box = () => document.querySelector<HTMLElement>('[data-box-card]')
  const CONTROLS = 'button, input, textarea, select, a[href], summary, [tabindex]'

  it('A-1 resting on a card shows its preview: the box, read only (no control in it, the pointer passes through), and it is NOT an open surface. Pressing the card pins THE SAME element: it gains its close and its actions, and stays when the pointer leaves', async () => {
    await board()
    vi.useFakeTimers()
    rest(FIG2)
    const peek = box()!
    expect([peek.getAttribute('data-testid'), peek.getAttribute('data-state'), peek.getAttribute('data-box-card')]).toEqual(['lane-peek', 'peek', FIG2])
    expect(open(), 'a preview is never counted as the open details').toEqual([])
    expect(useLaneInspector.getState().current, 'nor held in the one slot').toBeNull()
    expect(peek.querySelectorAll(CONTROLS).length, 'nothing to press in a preview').toBe(0)
    expect(peek.className).toMatch(/pointer-events-none/)
    vi.useRealTimers()
    fireEvent.click(node(FIG2)); await settle()
    const pinned = box()!
    expect(pinned === peek, 'the same element, not a second box').toBe(true)
    expect([pinned.getAttribute('data-testid'), pinned.getAttribute('data-state'), pinned.getAttribute('data-box-card')]).toEqual(['lane-inspector', 'pinned', FIG2])
    expect(open()).toEqual(['details'])
    expect(pinned.className).not.toMatch(/pointer-events-none/)
    expect(within(pinned).getByRole('button', { name: 'Close details' })).toBeInTheDocument()
    expect(within(pinned).getByTestId('lane-inspector-actions')).toBeInTheDocument()
    // Closed with the pointer still resting on the card, the box is gone: it does not fall back to a preview of the card it was just closed on.
    fireEvent.keyDown(document.body, { key: 'Escape' }); await settle()
    expect([box(), useLaneInspector.getState().peek], 'Escape closes the box').toEqual([null, null])
    fireEvent.click(node(FIG2)); await settle()
    const again = box()!
    fireEvent.mouseLeave(node(FIG2).querySelector('[role="group"]')!); await settle()
    expect(box() === again && again.getAttribute('data-state') === 'pinned', 'pinned, it stays when the pointer leaves').toBe(true)
    expect(document.querySelectorAll('[data-box-card]').length, 'one box').toBe(1)
  })

  it('A-2 the preview follows the pointer from card to card, and a card that is left never clears the next card\'s preview (the leave lands after the enter)', async () => {
    await board()
    vi.useFakeTimers()
    rest(FIG2)
    expect(box()!.getAttribute('data-box-card')).toBe(FIG2)
    // The next card's preview is named BEFORE the first card's leave is handled.
    act(() => { useLaneInspector.getState().setPeek({ kind: 'card', id: OPT }) })
    expect(box()!.getAttribute('data-box-card')).toBe(OPT)
    fireEvent.mouseLeave(node(FIG2).querySelector('[role="group"]')!); act(() => { vi.advanceTimersByTime(500) })
    expect(box()?.getAttribute('data-box-card'), 'the left card let go of its own preview only').toBe(OPT)
    act(() => { useLaneInspector.getState().clearPeek(OPT) })
    expect(box()).toBeNull()
    vi.useRealTimers()
  })

  it('A-3 the same order in both states, exactly: name and kind, value, what it is connected to; pinned adds the Value row\'s field after the value, the fold after the connections and the actions last, outside the scrolling body', async () => {
    await board()
    const order = (el: HTMLElement, ids: string[]): string[] => ids.map((t) => ({ t, n: el.querySelector(`[data-testid="${t}"]`) })).filter((x) => x.n !== null)
      .sort((a, b) => (a.n!.compareDocumentPosition(b.n!) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)).map((x) => x.t)
    const ALL = ['lane-inspector-title', 'lane-inspector-kind', 'lane-inspector-value', 'inspector-your-figure', 'lane-inspector-committed', 'lane-differ', 'lane-differ-line', 'lane-inspector-connections', 'lane-inspector-from', 'lane-inspector-actions']
    expect(approved().model!.cards.find((c) => c.id === FIG)!.detail, 'precondition: core sends this card a detail, so its fold is drawn').not.toBe('')
    vi.useFakeTimers(); rest(FIG); const peeked = order(box()!, ALL); vi.useRealTimers()
    expect(peeked).toEqual(['lane-inspector-title', 'lane-inspector-kind', 'lane-inspector-value', 'lane-inspector-connections'])
    fireEvent.click(node(FIG)); await settle()
    expect(order(box()!, ALL)).toEqual(['lane-inspector-title', 'lane-inspector-kind', 'lane-inspector-value', 'inspector-your-figure', 'lane-inspector-connections', 'lane-inspector-from', 'lane-inspector-actions'])
    const body = box()!.querySelector('.overflow-y-auto')!
    expect(body.contains(screen.getByTestId('lane-inspector-value')) && !body.contains(screen.getByTestId('lane-inspector-actions')) && !body.contains(screen.getByTestId('lane-inspector-title')), 'header and actions never scroll away').toBe(true)
  })

  it('A-4 what a card is connected to comes from the links the board draws, by core\'s names and each card\'s own drawn shape: an option "Changes" what its links lead to; a factor "Affects" and is "Driven by" non-option cards only; a reason link lists nothing; three names, then the count', async () => {
    await board()
    const model = currentModel({ view: approved(), error: null, stale: false })!
    const bears = useCanvasStore.getState().edges.filter((e) => (e.data as { link?: { kind?: string } } | undefined)?.link?.kind !== 'reason')
    const card = (id: string) => model.cards.find((c) => c.id === id)
    const name = (id: string) => card(id)!.heading
    const notOption = (id: string) => card(id) !== undefined && card(id)!.family !== 'option'
    // (A card that feeds itself, drawn as a loop, is not listed as its own driver or effect.)
    const out = (id: string) => [...new Set(bears.filter((e) => e.source === id).map((e) => e.target))].filter((t) => t !== id && notOption(t))
    const into = (id: string) => [...new Set(bears.filter((e) => e.target === id).map((e) => e.source))].filter((t) => t !== id && notOption(t))
    const groups = () => [...box()!.querySelectorAll('[data-connections]')].map((g) => ({ heading: g.getAttribute('data-connections'), names: [...g.querySelectorAll('[data-connected]')].map((e) => e.textContent), kinds: [...g.querySelectorAll('[data-connected]')].map((e) => e.getAttribute('data-connected-kind')), more: Number(g.querySelector('[data-connections-more]')?.getAttribute('data-connections-more') ?? 0) }))
    const want = (heading: string, ids: string[]) => ({ heading, names: ids.slice(0, 3).map(name), kinds: ids.slice(0, 3).map((id) => drawKindOf(card(id)!, model)), more: Math.max(0, ids.length - 3) })
    expect(out(OPT).length, 'precondition: the option has drawn links').toBeGreaterThan(0)
    fireEvent.click(node(OPT)); await settle()
    expect(groups(), 'an option: "Changes" alone').toEqual([want('Changes', out(OPT))])
    const wanted = (id: string) => [...(out(id).length > 0 ? [want('Affects', out(id))] : []), ...(into(id).length > 0 ? [want('Driven by', into(id))] : [])]
    // A factor an option leads into: the option is not one of its drivers. And a factor with drivers of its own: they are listed, after what it affects.
    const fed = model.cards.find((c) => c.family !== 'option' && bears.some((e) => e.target === c.id && card(e.source)?.family === 'option'))!
    const driven = model.cards.find((c) => c.family !== 'option' && into(c.id).length > 0 && root.querySelector(`.react-flow__node[data-id="${c.id}"]`) !== null)!
    expect([fed, driven].map((c) => c !== undefined), 'precondition: both kinds of factor are in the fixture').toEqual([true, true])
    for (const c of [fed, driven]) {
      fireEvent.click(node(c.id)); await settle()
      expect(box()!.getAttribute('data-box-card')).toBe(c.id)
      expect(groups(), c.id).toEqual(wanted(c.id))
      expect(groups().flatMap((x) => x.names).some((n) => model.cards.some((o) => o.family === 'option' && o.heading === n)), `${c.id}: no option is listed`).toBe(false)
    }
    expect(wanted(driven.id).some((x) => x.heading === 'Driven by'), 'the drivers were really asserted').toBe(true)
    // The cap and the count, and a reason link, on a model built for them (the same function the box calls).
    const many = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ ...fed, id, heading: `Card ${id}` }))
    const m2 = { ...model, cards: [fed, ...many] } as typeof model
    const g = connectionsOf(m2, fed, [...many.map((c) => ({ source: fed.id, target: c.id, data: { link: { kind: 'influence' } } })), { source: 'e', target: fed.id, data: { link: { kind: 'reason' } } }])
    expect(g.map((x) => [x.heading, x.items.map((i) => i.name), x.more])).toEqual([['Affects', ['Card a', 'Card b', 'Card c'], 2]])
  })

  it('A-5 a box that only changed size (a preview pinned, a fold opened) keeps its corner, cut to the room below. CONTRAST: placed afresh the taller box moves; and a kept corner that would sit on its own card is not kept', () => {
    const free = { left: 0, top: 0, right: 900, bottom: 700 }, card = { left: 100, top: 400, right: 320, bottom: 520 }
    const small = placeBeside(card, null, { width: 280, height: 160 }, free)
    const afresh = placeBeside(card, null, { width: 280, height: 420 }, free)
    expect([afresh.left, afresh.top], 'CONTRAST: without its place the taller box moves').not.toEqual([small.left, small.top])
    const kept = placeBeside(card, null, { width: 280, height: 420 }, free, undefined, { left: small.left, top: small.top })
    expect([kept.left, kept.top]).toEqual([small.left, small.top])
    expect(kept.top + (kept.maxHeight ?? 420), 'inside the free canvas').toBeLessThanOrEqual(free.bottom)
    const onCard = placeBeside(card, null, { width: 280, height: 420 }, free, undefined, { left: card.left + 8, top: card.top - 40 })
    const b = { left: onCard.left, top: onCard.top, right: onCard.left + 280, bottom: onCard.top + (onCard.maxHeight ?? 420) }
    expect(b.left >= card.right || b.right <= card.left || b.top >= card.bottom || b.bottom <= card.top, `never on its own card: ${JSON.stringify(b)}`).toBe(true)
  })

  it('A-6 the older look is unchanged: off the lane the same hover draws the old pop-up, names no preview and the box is not drawn', async () => {
    lane.on = false
    await board()
    vi.useFakeTimers(); rest(FIG2)
    expect(document.querySelector('[data-testid="node-hover-card"]'), 'the hover did open: the older look\'s pop-up').not.toBeNull()
    vi.useRealTimers()
    expect(useLaneInspector.getState().peek).toBeNull()
    expect(box()).toBeNull()
  })

  it('A-7 on the mounted board a press on a previewed card does not move the box, though pinned it is taller and the pressed card itself grows (its quick actions). CONTRAST: the same taller box opened with no preview first stands elsewhere', async () => {
    const CARD = { left: 100, top: 400, width: 220, height: 120 }, H = { peek: 160, pinned: 420 }
    // The pressed (selected) card is 30 px taller while its box is pinned, as Detailed draws it.
    const cardNow = () => (document.querySelector('[data-box-card][data-state="pinned"]') === null ? CARD : { ...CARD, height: CARD.height + 30 })
    const rectOf = (b: { left: number; top: number; width: number; height: number }) => ({ ...b, x: b.left, y: b.top, right: b.left + b.width, bottom: b.top + b.height, toJSON: () => ({}) }) as DOMRect
    const at = (el: HTMLElement) => [parseFloat(el.style.getPropertyValue('--lane-details-x')), parseFloat(el.style.getPropertyValue('--lane-details-y'))]
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this.closest('.react-flow__node')?.getAttribute('data-id') === FIG2) return rectOf(cardNow())
      if (this.matches('[data-box-card]')) { const el = this as HTMLElement, full = H[el.getAttribute('data-state') as 'peek' | 'pinned'], cap = parseFloat(el.style.getPropertyValue('--lane-details-h')); const [x, y] = at(el); return rectOf({ left: x || 0, top: y || 0, width: 280, height: Number.isNaN(cap) ? full : Math.min(full, cap) }) }
      return rectOf({ left: 0, top: 0, width: 0, height: 0 })
    })
    const win = { w: window.innerWidth, h: window.innerHeight }; Object.assign(window, { innerWidth: 900, innerHeight: 700 })
    try {
      await board()
      vi.useFakeTimers(); rest(FIG2); vi.useRealTimers(); await settle()
      const previewed = at(box()!)
      expect(previewed.every((n) => Number.isFinite(n)), `the preview was placed: ${previewed}`).toBe(true)
      fireEvent.click(node(FIG2)); await settle()
      expect(box()!.getAttribute('data-state')).toBe('pinned')
      expect(at(box()!), 'pinned where it was previewed').toEqual(previewed)
      // CONTRAST: closed, then pinned with no preview before it (the right-click row's route: the store, no hover).
      act(() => { useLaneInspector.getState().dismiss(true) }); fireEvent.mouseLeave(node(FIG2).querySelector('[role="group"]')!); await settle()
      expect(box()).toBeNull()
      act(() => { useLaneInspector.getState().open({ kind: 'card', id: FIG2 }) }); await settle()
      expect(at(box()!), 'placed afresh at its full height, the taller box stands elsewhere').not.toEqual(previewed)
    } finally { vi.restoreAllMocks(); Object.assign(window, { innerWidth: win.w, innerHeight: win.h }) }
  })

  it('A-9 the board lifts a pressed card clear of the foot controls (27 px on Detailed at 1232): the box moves WITH its card by the same 27 px, and is not placed afresh. CONTRAST: a far move of the card places it afresh, beside the card\'s new place', async () => {
    const CARD = { left: 100, top: 400, width: 220, height: 120 }, H = { peek: 160, pinned: 420 }
    const shift = { y: 0, far: false }
    const cardNow = () => (shift.far ? { left: 500, top: 150, width: 220, height: 120 } : { ...CARD, top: CARD.top + shift.y })
    const rectOf = (b: { left: number; top: number; width: number; height: number }) => ({ ...b, x: b.left, y: b.top, right: b.left + b.width, bottom: b.top + b.height, toJSON: () => ({}) }) as DOMRect
    const at = (el: HTMLElement) => [parseFloat(el.style.getPropertyValue('--lane-details-x')), parseFloat(el.style.getPropertyValue('--lane-details-y'))]
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this.closest('.react-flow__node')?.getAttribute('data-id') === FIG2) return rectOf(cardNow())
      if (this.matches('[data-box-card]')) { const el = this as HTMLElement, full = H[el.getAttribute('data-state') as 'peek' | 'pinned'], cap = parseFloat(el.style.getPropertyValue('--lane-details-h')); const [x, y] = at(el); return rectOf({ left: x || 0, top: y || 0, width: 280, height: Number.isNaN(cap) ? full : Math.min(full, cap) }) }
      return rectOf({ left: 0, top: 0, width: 0, height: 0 })
    })
    const win = { w: window.innerWidth, h: window.innerHeight }; Object.assign(window, { innerWidth: 900, innerHeight: 700 })
    try {
      await board()
      vi.useFakeTimers(); rest(FIG2); vi.useRealTimers(); await settle()
      const previewed = at(box()!)
      shift.y = -27
      fireEvent.click(node(FIG2)); await settle()
      expect(box()!.getAttribute('data-state')).toBe('pinned')
      expect(at(box()!), 'with its card: the same 27 px, nothing else').toEqual([previewed[0], previewed[1]! - 27])
      // A MOVE ALONE NEVER SHORTENS THE BOX: the card pans towards the window's foot in small steps (each one near enough to carry the box). Carried, its
      // corner would have less room below and the box would be cut shorter each step; it is placed afresh instead and shows no less than before.
      const shown = () => { const cap = parseFloat(box()!.style.getPropertyValue('--lane-details-h')); return Number.isNaN(cap) ? H.pinned : Math.min(H.pinned, cap) }
      const before = shown()
      for (const y of [13, 53, 93, 133]) { shift.y = y; await settle(); expect(shown(), `card ${y - -27} px lower than at the press: the box shows no less`).toBeGreaterThanOrEqual(before) }
      const b = at(box()!), cNow = cardNow()
      expect(b[0]! >= cNow.left + cNow.width || b[0]! + 280 <= cNow.left || b[1]! >= cNow.top + cNow.height || b[1]! + shown() <= cNow.top, `still beside its card, not on it: ${b}`).toBe(true)
      shift.far = true; await settle()
      const far = at(box()!), c = cardNow()
      expect(Math.abs(far[0]! - b[0]!) + Math.abs(far[1]! - b[1]!), `a far move: placed afresh (was ${b}, now ${far})`).toBeGreaterThan(64)
      expect(far[0]! >= c.left + c.width || far[0]! + 280 <= c.left || far[1]! >= c.top + c.height, `beside the card's new place, not on it: ${far}`).toBe(true)
    } finally { vi.restoreAllMocks(); Object.assign(window, { innerWidth: win.w, innerHeight: win.h }) }
  })

  it('A-8 a preview stands where its pinned box will fit, not merely where the small preview fits: with room above for the preview only, it is placed below (where the pinned box goes), and the press does not move it', async () => {
    // The card spans the board (no room at its sides); 200 px above it (the preview alone would fit), 400 px below (the pinned box fits), and another card stands just below it.
    const CARD = { left: 20, top: 200, width: 860, height: 100 }, BELOW = { left: 20, top: 320, width: 300, height: 100 }, H = { peek: 160, pinned: 340 }
    const rectOf = (b: { left: number; top: number; width: number; height: number }) => ({ ...b, x: b.left, y: b.top, right: b.left + b.width, bottom: b.top + b.height, toJSON: () => ({}) }) as DOMRect
    const at = (el: HTMLElement) => [parseFloat(el.style.getPropertyValue('--lane-details-x')), parseFloat(el.style.getPropertyValue('--lane-details-y'))]
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const id = this.closest('.react-flow__node')?.getAttribute('data-id')
      if (id === FIG2) return rectOf(CARD)
      if (id === OPT) return rectOf(BELOW)
      if (this.matches('[data-box-card]')) { const el = this as HTMLElement, full = H[el.getAttribute('data-state') as 'peek' | 'pinned'], cap = parseFloat(el.style.getPropertyValue('--lane-details-h')); const [x, y] = at(el); return rectOf({ left: x || 0, top: y || 0, width: 280, height: Number.isNaN(cap) ? full : Math.min(full, cap) }) }
      return rectOf({ left: 0, top: 0, width: 0, height: 0 })
    })
    const win = { w: window.innerWidth, h: window.innerHeight }; Object.assign(window, { innerWidth: 900, innerHeight: 700 })
    try {
      await board()
      vi.useFakeTimers(); rest(FIG2); vi.useRealTimers(); await settle()
      const previewed = at(box()!)
      expect(previewed[1], `the preview is below its card, where the pinned box fits (placed ${previewed})`).toBeGreaterThanOrEqual(CARD.top + CARD.height)
      fireEvent.click(node(FIG2)); await settle()
      expect(box()!.getAttribute('data-state')).toBe('pinned')
      expect(at(box()!), 'pinned where it was previewed').toEqual(previewed)
    } finally { vi.restoreAllMocks(); Object.assign(window, { innerWidth: win.w, innerHeight: win.h }) }
  })
})

describe('surfaces step B: one of each', () => {
  const LEGEND = '[role="dialog"][aria-labelledby="keyboard-legend-title"]'
  it('B-1 "?" opens ONE keyboard legend (the canvas mounted a second with its own listener, so two dialogs opened), and Escape closes it', async () => {
    await board()
    expect(document.querySelectorAll(LEGEND).length).toBe(0)
    fireEvent.keyDown(window, { key: '?' }); await settle()
    expect(document.querySelectorAll(LEGEND).length).toBe(1)
    fireEvent.keyDown(window, { key: 'Escape' }); await settle()
    expect(document.querySelectorAll(LEGEND).length).toBe(0)
  })

  it('B-2 every menu over the canvas wears the one shell, and its rows the one row: the right-click menu, the "+" menu and the Lenses menu (bound by each menu\'s own element)', async () => {
    await board()
    const shell = MENU_SHELL.split(/\s+/), rowCls = MENU_ROW.split(/\s+/)
    const wears = (el: Element, cls: string[]) => cls.filter((c) => !el.classList.contains(c))
    const radius = (el: Element) => [...el.classList].filter((c) => /^rounded(-|$)/.test(c))
    const seen: Array<[string, Element]> = []
    fireEvent.contextMenu(node(OTHER)); await settle()
    seen.push(['right-click', document.querySelector('[role="menu"][aria-label="Canvas context menu"]')!])
    act(() => { useLaneInspector.getState().dismiss(true) })
    fireEvent.click(screen.getByTestId('canvas-add-to-model')); await settle()
    seen.push(['add', screen.getByRole('menuitem', { name: 'Add a figure' }).parentElement!])
    fireEvent.keyDown(document.body, { key: 'Escape' }); await settle()
    fireEvent.click(screen.getByTestId(LENSES_TESTID).querySelector('button[aria-haspopup="menu"]')!); await settle()
    seen.push(['lenses', screen.getByTestId(`${LENSES_TESTID}-menu`)])
    for (const [name, el] of seen) {
      expect(el, name).not.toBeNull()
      expect(wears(el, shell), `${name}: shell classes missing`).toEqual([])
      expect(radius(el), `${name}: one radius`).toEqual(['rounded-md'])
      const rows = [...el.querySelectorAll('[role="menuitem"], [role="menuitemradio"]')]
      expect(rows.length, `${name}: has rows`).toBeGreaterThan(0)
      for (const r of rows) expect(wears(r, rowCls), `${name}: a row's classes missing`).toEqual([])
    }
  })
})
