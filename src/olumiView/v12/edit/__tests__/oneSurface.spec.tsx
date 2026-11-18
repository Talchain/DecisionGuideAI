/**
 * SURFACES STEP 2 (18 Nov): one thing open at a time. On the mounted lane canvas (the real ViewCanvas, its real figure editor, right-click menu,
 * edit form, details panel and add form), at most one of the five is open in every state; Escape closes the open one (from the focused field,
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
import { causalPlaces } from '../../../layout'
import { HOVER_CARD_OPEN_DELAY_MS } from '../../../../canvas/components/hoverCard/hoverCardPlacement'
import { useLaneInspector } from '../inspectorStore'
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
afterEach(() => { lane.on = true; cleanup(); useLaneInspector.getState().close(); vi.useRealTimers(); uninstall(); useViewChat.setState({ armed: null, text: '' }); useCanvasStore.setState({ nodes: [], edges: [] }) })

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

// The five surfaces, each by what it renders.
const SEEN = {
  editor: () => document.querySelector('[data-figure-edit-panel]'),
  form: () => document.querySelector('[data-testid="lane-edit-form"]'),
  details: () => document.querySelector('[data-testid="lane-inspector"]'),
  menu: () => document.querySelector('[role="menu"][aria-label="Canvas context menu"]'),
  add: () => document.querySelector('[data-testid="view-add-figure-form"]'),
}
type Name = keyof typeof SEEN
const open = (): Name[] => (Object.keys(SEEN) as Name[]).filter((k) => SEEN[k]() !== null)
const row = (label: string) => within(document.querySelector('[role="menu"][aria-label="Canvas context menu"]') as HTMLElement).getByText(label)

const OPENERS: Record<Name, () => Promise<void>> = {
  editor: async () => { fireEvent.click(screen.getByTestId(`view-figure-edit-${FIG}`)) },
  details: async () => { fireEvent.click(node(OPT)); await settle() },
  menu: async () => { fireEvent.contextMenu(node(OTHER)); await settle() },
  form: async () => { fireEvent.contextMenu(node(OTHER)); await settle(); fireEvent.click(row('Rename')); await settle() },
  add: async () => { fireEvent.click(screen.getByTestId('canvas-add-to-model')); fireEvent.click(screen.getByRole('menuitem', { name: 'Add a figure' })); await settle() },
}
// The field a person is typing in when they press Escape, for each surface that has one.
const FIELD: Partial<Record<Name, () => HTMLElement>> = {
  editor: () => screen.getByTestId(`view-figure-typed-${FIG}`),
  form: () => screen.getByTestId('lane-edit-label'),
  add: () => screen.getByTestId('view-add-figure-name'),
}

describe('surfaces step 2: one thing open at a time', () => {
  it('ONE-1 opening any one closes whatever else was open: after each opening, exactly that one is open (every kind opened after every other)', async () => {
    await board()
    const order: Name[] = ['editor', 'add', 'details', 'menu', 'editor', 'details', 'form', 'add', 'menu', 'form', 'editor', 'menu', 'details', 'add', 'form', 'details']
    for (const k of order) { await OPENERS[k](); expect(open(), `after opening ${k}`).toEqual([k]) }
  })

  it.each(['editor', 'form', 'add', 'details', 'menu'] as Name[])('ONE-2a Escape closes the open %s, pressed where a person presses it: in its field when it has one, else on the board', async (k) => {
    await board()
    await OPENERS[k]()
    expect(open()).toEqual([k])
    fireEvent.keyDown(FIELD[k]?.() ?? document.body, { key: 'Escape' })
    await settle()
    expect(open(), `Escape with ${k} open`).toEqual([])
  })

  it.each(['editor', 'form', 'add'] as Name[])('ONE-2b Escape closes the open %s from anywhere, not only from inside it (focus on the board)', async (k) => {
    await board()
    await OPENERS[k]()
    expect(open()).toEqual([k])
    ;(document.activeElement as HTMLElement | null)?.blur()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    await settle()
    expect(open(), `Escape on the board with ${k} open`).toEqual([])
  })

  it.each(['editor', 'form', 'add', 'details', 'menu'] as Name[])('ONE-3 a press on empty canvas closes the open %s', async (k) => {
    await board()
    await OPENERS[k]()
    expect(open()).toEqual([k])
    fireEvent.click(pane())
    await settle()
    expect(open(), `empty-canvas press with ${k} open`).toEqual([])
  })

  it('ONE-4 the hover pop-up is not up while any of the five is open. CONTRAST: the same hover with none open shows it', async () => {
    await board()
    const hover = (id: string): HTMLElement | null => {
      vi.useFakeTimers()
      fireEvent.mouseEnter(node(id).querySelector('[role="group"]')!)
      act(() => { vi.advanceTimersByTime(HOVER_CARD_OPEN_DELAY_MS + 50) })
      const pop = document.querySelector<HTMLElement>('[data-testid="node-hover-card"]')
      fireEvent.mouseLeave(node(id).querySelector('[role="group"]')!)
      act(() => { vi.advanceTimersByTime(500) })
      vi.useRealTimers()
      return pop
    }
    expect(open()).toEqual([])
    expect(hover(FIG2), 'contrast: nothing open, the pop-up shows').not.toBeNull()
    for (const k of ['details', 'menu', 'editor', 'add'] as Name[]) {
      await OPENERS[k]()
      expect(open()).toEqual([k])
      expect(hover(FIG2), `pop-up while ${k} is open`).toBeNull()
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

  it('ONE-9 Escape in the message box with a canvas surface open leaves the waiting challenge waiting and the surface open; with none open it cancels the challenge', async () => {
    await board(true)
    act(() => { useViewChat.setState({ armed: 'opposite' }) })
    // Opened from the store: pressing a card would pick it for the waiting challenge.
    act(() => { useLaneInspector.getState().open({ kind: 'card', id: OPT }) }); await settle()
    expect(open()).toEqual(['details'])
    const field = document.getElementById('view-chat-text') as HTMLElement
    field.focus()
    fireEvent.keyDown(field, { key: 'Escape' }); await settle()
    expect(useViewChat.getState().armed, 'surface open: the challenge keeps waiting').toBe('opposite')
    expect(open()).toEqual(['details'])
    act(() => { useLaneInspector.getState().close() })
    fireEvent.keyDown(field, { key: 'Escape' }); await settle()
    expect(useViewChat.getState().armed, 'contrast: nothing open, Escape cancels it').toBeNull()
  })

  it('ONE-10 a press on the figure editor\'s own label or padding on an option card does not open the details panel over it', async () => {
    const base = approved()
    const quantity = base.model!.cards.find((c) => c.id === FIG)!
    const view = { ...base, model: { ...base.model!, cards: base.model!.cards.map((c) => (c.id === OPT ? { ...c, figure: quantity.figure } : c)) } } as View
    await board(false, view)
    fireEvent.click(screen.getByTestId(`view-figure-edit-${OPT}`))
    expect(open(), 'the option card\'s figure editor is open').toEqual(['editor'])
    const panel = document.querySelector<HTMLElement>(`[data-figure-edit-panel="${OPT}"]`)!
    // The panel itself is the exclusion's subject: take away the wrapper's own card-action mark (WorkedSteps' wrapper has none), so only [data-figure-edit-panel] can exclude it.
    document.querySelectorAll('[data-figure-edit-wrap]').forEach((w) => w.removeAttribute('data-card-action'))
    expect(panel.closest('[data-card-action]'), 'no card-action mark above the panel').toBeNull()
    fireEvent.click(panel.querySelector('label')!); await settle()
    expect(open(), 'press on the editor\'s label').toEqual(['editor'])
    fireEvent.click(panel); await settle()
    expect(open(), 'press on the editor\'s padding').toEqual(['editor'])
  })

  it('ONE-11 the size forms are on the one store: the pencil on a risk card opens the size form; Escape closes it; opening the details closes it; a waiting challenge is not cancelled while it is open', async () => {
    await board(true)
    const pencil = () => within(node('slow_ramp')).getByTestId('lane-size-edit')
    fireEvent.click(pencil()); await settle()
    expect(open(), 'the pencil opens the size form').toEqual(['form'])
    expect(useLaneInspector.getState().current?.kind, 'held by the one store').toBe('form')
    fireEvent.keyDown(document.querySelector('[data-testid="lane-edit-form"] input')!, { key: 'Escape' }); await settle()
    expect(open(), 'Escape closes the size form').toEqual([])
    fireEvent.click(pencil()); await settle()
    expect(open()).toEqual(['form'])
    await OPENERS.details()
    expect(open(), 'opening details closes the size form').toEqual(['details'])
    fireEvent.click(pencil()); await settle()
    expect(open(), 'the size form takes the details\' place').toEqual(['form'])
    act(() => { useViewChat.setState({ armed: 'opposite' }) })
    fireEvent.keyDown(document.body, { key: 'Escape' }); await settle()
    expect(open()).toEqual([])
    expect(useViewChat.getState().armed, 'the first Escape closed the form and left the challenge waiting').toBe('opposite')
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
    fireEvent.click(screen.getByTestId('inspector-figure-set')); await settle()
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
    expect(open(), 'contrast, lane on: the pencil is the control\'s own').toEqual(['editor'])
  })

  it('ONE-6 (kept as today) words typed in the edit form survive another surface opening, and are there when it is opened again', async () => {
    await board()
    await OPENERS.form()
    fireEvent.change(screen.getByTestId('lane-edit-label'), { target: { value: 'My new name' } })
    await OPENERS.editor()
    expect(open()).toEqual(['editor'])
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
  const panelBox = (el: Element): Box => {
    const s = (el as HTMLElement).style
    return { left: parseFloat(s.getPropertyValue('--lane-details-x')) || 76, top: parseFloat(s.getPropertyValue('--lane-details-y')) || 112, ...PANEL }
  }
  const mockBoxes = () => vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const node = this.closest('.react-flow__node')
    if (node !== null) return rectOf(cards[node.getAttribute('data-id') ?? ''] ?? { left: 0, top: 0, width: 0, height: 0 })
    if (this.matches('[data-testid="lane-inspector"]')) return rectOf(panelBox(this))
    return rectOf({ left: 0, top: 0, width: 0, height: 0 })
  })
  const area = (a: DOMRect, b: DOMRect) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  const inspector = () => document.querySelector<HTMLElement>('[data-testid="lane-inspector"]')!
  afterEach(() => { vi.restoreAllMocks(); for (const k of Object.keys(cards)) delete cards[k] })

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
    expect(open(), 'the pencil is the control\'s own').toEqual(['editor'])
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
    const button = document.querySelector<HTMLElement>('[data-testid="lane-inspector"] [role="group"][aria-label="Edit"] button:not([aria-disabled])')!
    fireEvent.click(button); await settle()
    expect(open(), 'the form replaced the panel').toEqual(['form'])
    const form = document.querySelector<HTMLElement>('[data-testid="lane-edit-form"]')!
    expect({ x: parseFloat(form.style.left), y: parseFloat(form.style.top) }, 'the form stands where the panel stood').toEqual(at)
  })
})
