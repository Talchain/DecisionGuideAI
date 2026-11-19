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
import { ViewComposer, prefillComposer, useViewChat } from '../../../ViewChat'
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
async function board(plain = false): Promise<{ id: string; author: string; basis: string; add: string; option: boolean; set: string; premise: string }> {
  // The fixture's cards carry no author line or basis, so one option is given core's two (verbatim words of the test's own, read back below).
  const base = approved(), CARD = 'broader_entry'
  const view = { ...base, model: { ...base.model!, cards: base.model!.cards.map((c) => (c.id === CARD ? { ...c, author: { by: 'olumi', text: 'Olumi\'s estimate', title: 'Olumi estimated this from your brief' }, headline: { ...(c.headline ?? {}), title: 'Rests on Olumi\'s assumption about entry speed', add: 'Next: pilot the entry in one region' },
    ...(plain ? { family: 'factor', sets: [], premises: [] } : { sets: [{ id: 'single_country_test', label: 'Pilot regions', figure: { text: '3 regions', title: 'Three regions' }, author: 'Your figure', whose: 'person' }], premises: [{ id: 'p1', glyph: '◆', text: 'Entry is faster than the last launch', title: 'Olumi\'s assumption' }] }) } : c)) } } as typeof base
  install(view)
  const model = currentModel({ view, error: null, stale: false })!
  const card = model.cards.find((c) => c.id === CARD)!
  const places = await causalPlaces(model, new Map())
  act(() => { drawViewCanvas(model, places) })
  root = render(<div style={{ width: 1232, height: 704 }}><ViewCanvas /><ViewComposer /></div>).container
  await settle()
  return { id: card.id, author: card.author!.text, basis: card.headline!.title, add: card.headline!.add as string, option: card.family === 'option', set: 'Pilot regions', premise: 'Entry is faster than the last launch' }
}

/** What the composer's selection row holds: the chip, the detail box, and any author or basis line inside the composer. */
const composerRow = () => {
  const c = q('view-composer')!
  return { pill: c.querySelector<HTMLElement>('[data-testid="ai-panel-selection-pill"]'), chip: q('selection-chip'), box: c.querySelector('[data-testid="selection-detail"]'),
    words: c.querySelectorAll('[data-testid="selected-author"], [data-testid="selected-headline-title"]').length }
}
const typeDraft = (t: string) => { const f = document.getElementById('view-chat-text') as HTMLTextAreaElement; fireEvent.change(f, { target: { value: t } }); return f }

describe('surfaces step 4: the AI panel keeps the chip', () => {
  it('S4-a pressing a card opens its details beside it: the panel holds the card\'s author and basis, and the composer does NOT repeat them (the chip leads; what only the composer draws stays)', async () => {
    const card = await board()
    fireEvent.click(node(card.id)); await settle()
    expect(useLaneInspector.getState().current).toMatchObject({ kind: 'details', target: { id: card.id } })
    expect(q('lane-inspector-author')!.textContent).toBe(card.author)
    expect(q('lane-inspector-basis')!.textContent).toBe(card.basis)
    const r = composerRow()
    expect(r.chip, 'the chip').not.toBeNull()
    expect(r.chip!.textContent).toContain('About:')
    expect(r.words, 'no author or basis line in the composer').toBe(0)
  })
  it('S4-a2 an option\'s next step and explanation are drawn in its details panel verbatim (panel test ids), and the composer row is the chip alone', async () => {
    const card = await board()
    expect(card.option, 'the fixture card is an option').toBe(true)
    fireEvent.click(node(card.id)); await settle()
    const panel = q('lane-inspector')!
    expect(panel).not.toBeNull()
    expect(q('lane-inspector-add')!.textContent).toBe(card.add)
    expect(q('lane-inspector-explain-sets')!.textContent).toContain(card.set)
    expect(q('lane-inspector-explain-premises')!.textContent).toContain(card.premise)
    expect(panel.contains(q('lane-inspector-add')) && panel.contains(q('lane-inspector-explain'))).toBe(true)
    const r = composerRow()
    expect(r.chip).not.toBeNull()
    expect(r.box, 'no selection-detail box at all').toBeNull()
    expect(q('selected-headline-add')).toBeNull()
    expect(q('selected-explain')).toBeNull()
    expect(document.querySelectorAll('[data-testid="lane-inspector-add"]').length).toBe(1)
  })
  it('S4-a3 a non-option card (no next step, no explanation) opens its details and the row is still the chip alone', async () => {
    const card = await board(true)
    fireEvent.click(node(card.id)); await settle()
    expect(q('lane-inspector')).not.toBeNull()
    expect(q('lane-inspector-add')).toBeNull()
    expect(q('lane-inspector-explain')).toBeNull()
    expect(composerRow().box).toBeNull()
    expect(composerRow().chip).not.toBeNull()
  })
  it('S4-b CONTRAST: the same card selected by right-click (no details open) keeps the box behind its info icon, CLOSED (esc3), and its author and basis are there once the person opens it', async () => {
    const card = await board()
    fireEvent.contextMenu(node(card.id)); await settle()
    expect(q('lane-inspector')).toBeNull()
    const r = composerRow()
    expect(r.chip).not.toBeNull()
    expect((r.box as HTMLDetailsElement).open, 'a press never opens it').toBe(false)
    ;(r.box as HTMLDetailsElement).open = true; fireEvent(r.box!, new Event('toggle'))
    expect(q('selected-author')!.textContent).toBe(card.author)
    expect(q('selected-headline-title')!.textContent).toBe(card.basis)
    expect(q('selected-headline-add')!.textContent).toBe(card.add)
    expect(q('selected-explain-sets')!.textContent).toContain(card.set)
    expect(q('selected-explain-premises')!.textContent).toContain(card.premise)
    expect(q('lane-inspector-add')).toBeNull()
  })
  it('S4-b2 CONTRAST: details open for ANOTHER card do not fold this selection\'s box (bound by id)', async () => {
    const card = await board()
    fireEvent.contextMenu(node(card.id)); await settle()
    const other = 'single_country_test'
    act(() => { useLaneInspector.getState().open({ kind: 'card', id: other }) }); await settle()
    expect(composerRow().words, 'the details are for another card: its author and basis stay').toBe(2)
  })
  it('S4-c Escape clears the card\'s details box AND its selection chip together (esc3): nothing is left standing in the composer; opening the details again folds the box away as before', async () => {
    const card = await board()
    fireEvent.click(node(card.id)); await settle()
    expect(composerRow().words).toBe(0)
    expect(composerRow().chip).not.toBeNull()
    fireEvent.keyDown(document.body, { key: 'Escape' }); await settle()
    expect(q('lane-inspector')).toBeNull()
    expect(composerRow().chip, 'one Escape: the details and the chip go together').toBeNull()
    expect(composerRow().box).toBeNull()
    expect(useCanvasStore.getState().selection.nodeIds.size).toBe(0)
    expect(q('selected-author')).toBeNull()
    fireEvent.click(node(card.id)); await settle()
    expect(composerRow().words).toBe(0)
    expect(composerRow().box).toBeNull()
  })
  it('S4-c2 the composer does not grow on a card press: no detail drawer is drawn open (it was 377 px of 704 after Escape), and the box is CLOSED when a card is selected another way', async () => {
    const card = await board()
    fireEvent.click(node(card.id)); await settle()
    expect(composerRow().box).toBeNull()
    fireEvent.keyDown(document.body, { key: 'Escape' }); await settle()
    fireEvent.contextMenu(node(card.id)); await settle()
    expect((composerRow().box as HTMLDetailsElement).open).toBe(false)
  })
  it('S4-d the draft in the message box survives press, Escape and re-open (the chip goes with the details on Escape, never the words)', async () => {
    const card = await board()
    typeDraft('my own half-typed question')
    for (const step of [() => fireEvent.click(node(card.id)), () => fireEvent.keyDown(document.getElementById('view-chat-text')!, { key: 'Escape' }), () => act(() => { useLaneInspector.getState().open({ kind: 'card', id: card.id }) })]) {
      step(); await settle()
      expect((document.getElementById('view-chat-text') as HTMLTextAreaElement).value).toBe('my own half-typed question')
    }
  })
  it('esc3: Escape clears a composer that holds ONLY an untouched canvas prefill (the Frame question\'s "Ask Olumi to change it"); CONTRAST: the same words once edited are the person\'s draft and Escape never discards them', async () => {
    await board()
    const field = () => document.getElementById('view-chat-text') as HTMLTextAreaElement
    act(() => { prefillComposer('Is this the right question?') }); await settle()
    expect(field().value).toBe('Is this the right question?')
    fireEvent.keyDown(field(), { key: 'Escape' }); await settle()
    expect(field().value, 'untouched prefill: cleared by one Escape').toBe('')
    act(() => { prefillComposer('Is this the right question?') }); await settle()
    fireEvent.change(field(), { target: { value: 'Is this the right question for the Q3 plan?' } }); await settle()
    fireEvent.keyDown(field(), { key: 'Escape' }); await settle()
    expect(field().value, 'edited: the person\'s own words stay').toBe('Is this the right question for the Q3 plan?')
  })
  it('S4-e the chip keeps its clear and its Ask while the details are open', async () => {
    const card = await board()
    fireEvent.click(node(card.id)); await settle()
    expect(q('selection-pill-clear')).not.toBeNull()
    expect(q('selection-ask-chip')).not.toBeNull()
  })
})
