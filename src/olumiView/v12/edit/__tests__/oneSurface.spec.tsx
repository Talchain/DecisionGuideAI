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
import { currentModel } from '../../../store'
import { useCanvasStore } from '../../../../canvas/store'
import { drawViewCanvas } from '../../../canvas'
import { causalPlaces } from '../../../layout'
import { HOVER_CARD_OPEN_DELAY_MS } from '../../../../canvas/components/hoverCard/hoverCardPlacement'
import { useLaneInspector } from '../inspectorStore'
import { approved, install, uninstall } from './harness'

vi.mock('../../../../canvas/components/OutputsDock', () => ({ OutputsDock: () => null }))
vi.mock('../../../../canvas/components/OlumiAttentionCard', () => ({ OlumiAttentionCard: () => null }))
vi.mock('../../../../olumiCore/lane', async (real) => ({ ...(await real<object>()), isOlumiCoreLane: () => true }))
vi.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: 'u1', accessToken: null }), supabase: {} }))
vi.mock('../../../../canvas/nodes/shared/savedGraph', () => ({ useSavedGraphRead: () => ({ status: 'none' }), useSavedGraph: () => null }))

beforeAll(() => { ;(window as unknown as { DOMMatrixReadOnly?: unknown }).DOMMatrixReadOnly ??= class { m22 = 1 } })
afterEach(() => { cleanup(); useLaneInspector.getState().close(); vi.useRealTimers(); uninstall(); useViewChat.setState({ armed: null, text: '' }); useCanvasStore.setState({ nodes: [], edges: [] }) })

const FIG = 'starting_customers', FIG2 = 'customer_target', OPT = 'broader_entry', OTHER = 'single_country_test'
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 60)) })
let root: HTMLElement
async function board(withComposer = false): Promise<void> {
  install()
  const model = currentModel({ view: approved(), error: null, stale: false })!
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
