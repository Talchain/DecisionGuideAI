/**
 * SURFACES STEP 4 (18 Nov): the AI panel keeps the chip. While a card's details panel is open beside that same card (it holds the card's
 * authorship and basis), the composer's selection detail box folds away and the composer keeps ONE "About: <card>" chip line; when the card
 * is selected by another route (right-click) or its details are closed (Escape) the box is there, so the words are never one press away.
 * jsdom has no layout, so "the composer's height changes by at most one line" is counted in rendered blocks: the selection row holds the chip
 * and nothing else (no detail box, no author or basis line), and the details panel holds the card's author and basis instead.
 * Bound by the card's id and by core's words read back from the View. The draft in the message box and the chip survive every state.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { ViewCanvas } from '../../../ViewCanvas'
import { ViewComposer, useViewChat } from '../../../ViewChat'
import { currentModel } from '../../../store'
import { useCanvasStore } from '../../../../canvas/store'
import { drawViewCanvas } from '../../../canvas'
import { causalPlaces } from '../../../layout'
import { useLaneInspector } from '../inspectorStore'
import { approved, install, uninstall } from './harness'

vi.mock('../../../../canvas/components/OutputsDock', () => ({ OutputsDock: () => null }))
vi.mock('../../../../canvas/components/OlumiAttentionCard', () => ({ OlumiAttentionCard: () => null }))
const lane = vi.hoisted(() => ({ on: true }))
vi.mock('../../../../olumiCore/lane', async (real) => ({ ...(await real<object>()), isOlumiCoreLane: () => lane.on }))
vi.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: 'u1', accessToken: null }), supabase: {} }))
vi.mock('../../../../canvas/nodes/shared/savedGraph', () => ({ useSavedGraphRead: () => ({ status: 'none' }), useSavedGraph: () => null }))

beforeAll(() => { ;(window as unknown as { DOMMatrixReadOnly?: unknown }).DOMMatrixReadOnly ??= class { m22 = 1 } })
afterEach(() => { lane.on = true; cleanup(); useLaneInspector.getState().close(); uninstall(); useViewChat.setState({ armed: null, text: '' }); useCanvasStore.setState({ nodes: [], edges: [] }) })

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 60)) })
let root: HTMLElement
const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const node = (id: string) => root.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)!
async function board(): Promise<{ id: string; author: string; basis: string }> {
  // The fixture's cards carry no author line or basis, so one option is given core's two (verbatim words of the test's own, read back below).
  const base = approved(), CARD = 'broader_entry'
  const view = { ...base, model: { ...base.model!, cards: base.model!.cards.map((c) => (c.id === CARD ? { ...c, author: { by: 'olumi', text: 'Olumi\'s estimate', title: 'Olumi estimated this from your brief' }, headline: { ...(c.headline ?? {}), title: 'Rests on Olumi\'s assumption about entry speed' } } : c)) } } as typeof base
  install(view)
  const model = currentModel({ view, error: null, stale: false })!
  const card = model.cards.find((c) => c.id === CARD)!
  const places = await causalPlaces(model, new Map())
  act(() => { drawViewCanvas(model, places) })
  root = render(<div style={{ width: 1232, height: 704 }}><ViewCanvas /><ViewComposer /></div>).container
  await settle()
  return { id: card.id, author: card.author!.text, basis: card.headline!.title }
}

/** What the composer's selection row holds: the chip, the detail box, and any author or basis line inside the composer. */
const composerRow = () => {
  const c = q('view-composer')!
  return { pill: c.querySelector<HTMLElement>('[data-testid="ai-panel-selection-pill"]'), chip: q('selection-chip'), box: c.querySelector('[data-testid="selection-detail"]'),
    words: c.querySelectorAll('[data-testid="selected-author"], [data-testid="selected-headline-title"]').length }
}
const typeDraft = (t: string) => { const f = document.getElementById('view-chat-text') as HTMLTextAreaElement; fireEvent.change(f, { target: { value: t } }); return f }

describe('surfaces step 4: the AI panel keeps the chip', () => {
  it('S4-a pressing a card opens its details beside it and the composer shows the About chip and NO detail box (one block, not three); the panel holds the card\'s author and basis', async () => {
    const card = await board()
    fireEvent.click(node(card.id)); await settle()
    expect(useLaneInspector.getState().current).toMatchObject({ kind: 'details', target: { id: card.id } })
    expect(q('lane-inspector-author')!.textContent).toBe(card.author)
    expect(q('lane-inspector-basis')!.textContent).toBe(card.basis)
    const r = composerRow()
    expect(r.chip, 'the chip').not.toBeNull()
    expect(r.chip!.textContent).toContain('About:')
    expect(r.box, 'no detail box while the details are open').toBeNull()
    expect(r.words, 'no author or basis line in the composer').toBe(0)
    expect(q('selection-detail-toggle')).toBeNull()
    expect(r.pill!.children, 'the selection row is the chip alone').toHaveLength(1)
  })
  it('S4-b CONTRAST: the same card selected by right-click (no details open) keeps the box, with its author and basis, open', async () => {
    const card = await board()
    fireEvent.contextMenu(node(card.id)); await settle()
    expect(q('lane-inspector')).toBeNull()
    const r = composerRow()
    expect(r.chip).not.toBeNull()
    expect((r.box as HTMLDetailsElement).open).toBe(true)
    expect(q('selected-author')!.textContent).toBe(card.author)
    expect(q('selected-headline-title')!.textContent).toBe(card.basis)
  })
  it('S4-b2 CONTRAST: details open for ANOTHER card do not fold this selection\'s box (bound by id)', async () => {
    const card = await board()
    fireEvent.contextMenu(node(card.id)); await settle()
    const other = 'single_country_test'
    act(() => { useLaneInspector.getState().open({ kind: 'card', id: other }) }); await settle()
    expect(composerRow().box, 'the details are for another card: the box stays').not.toBeNull()
  })
  it('S4-c Escape closes the details and the box returns; opening them again folds it again', async () => {
    const card = await board()
    fireEvent.click(node(card.id)); await settle()
    expect(composerRow().box).toBeNull()
    fireEvent.keyDown(document.body, { key: 'Escape' }); await settle()
    expect(q('lane-inspector')).toBeNull()
    expect(composerRow().chip, 'Escape closed the details, not the selection').not.toBeNull()
    expect((composerRow().box as HTMLDetailsElement).open).toBe(true)
    expect(q('selected-author')!.textContent).toBe(card.author)
    act(() => { useLaneInspector.getState().open({ kind: 'card', id: card.id }) }); await settle()
    expect(composerRow().box).toBeNull()
  })
  it('S4-d the draft in the message box and the chip survive press, Escape and re-open', async () => {
    const card = await board()
    typeDraft('my own half-typed question')
    for (const step of [() => fireEvent.click(node(card.id)), () => fireEvent.keyDown(document.body, { key: 'Escape' }), () => act(() => { useLaneInspector.getState().open({ kind: 'card', id: card.id }) })]) {
      step(); await settle()
      expect((document.getElementById('view-chat-text') as HTMLTextAreaElement).value).toBe('my own half-typed question')
      expect(composerRow().chip!.textContent).toContain('About:')
    }
  })
  it('S4-e the chip keeps its clear and its Ask while the details are open', async () => {
    const card = await board()
    fireEvent.click(node(card.id)); await settle()
    expect(q('selection-pill-clear')).not.toBeNull()
    expect(q('selection-ask-chip')).not.toBeNull()
  })
})
