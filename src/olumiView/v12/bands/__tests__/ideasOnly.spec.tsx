/**
 * Codex 008e items 1 and 2, on the real canvas: kept ideas stay on the main workspace with NO current model (after the first proposal is set aside,
 * and on a cold reopen), and an opened idea is usable for the next thought. Fixture: the in-repo after-find-first View, with `kept[]` rows added by
 * shape. Bound by test id and node type/id: the contrast (no kept ideas, nothing drawn) is in the same file.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import type { View } from '../../../client'
import { ViewCanvas } from '../../../ViewCanvas'
import { ideasOnlyOf, useViewCanvas, VIEW_CARD, VIEW_QUESTION } from '../../../canvas'
import { useViewStore } from '../../../store'
import { useViewChat } from '../../../ViewChat'
import { useMe } from '../../../../olumiCore/me'
import { useCanvasStore } from '../../../../canvas/store'
import { IDEA_PREFIX } from '../bands'
import { VIEW_FOLD, VIEW_IDEA } from '../BandNodes'
import { CHALLENGE_IDEA, DEVELOP_IDEA, IdeaPanel, ideaDetailOf } from '../IdeaPanel'
import { takesBrief } from '../../../ViewChat'
import { setLevel } from '../../simpleStore'
import { challengeQuestionOf, developQuestionOf, keptIdeasOf } from '../../ideas'

vi.mock('../../../../canvas/components/OutputsDock', () => ({ OutputsDock: () => null }))
vi.mock('../../../../canvas/components/OlumiAttentionCard', () => ({ OlumiAttentionCard: () => null }))
vi.mock('../../../../olumiCore/lane', async (real) => ({ ...(await real<object>()), isOlumiCoreLane: () => true }))
vi.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: 'u1', accessToken: null }), supabase: {} }))
vi.mock('../../../../canvas/nodes/shared/savedGraph', () => ({ useSavedGraphRead: () => ({ status: 'none' }), useSavedGraph: () => null }))

const base = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/session/after-find-first.view3.json'), 'utf8')) as View
const METHOD_TURN = 6, SAM = { id: '99', name: 'Sam' }
const row = (id: number, turn: number, text: string, kept_by: { id: string; name: string }) => ({ id, turn, text, by: 'olumi', kept_by, at: '2026-11-16T12:00:00Z', concerns: [] })
const KEPT = [row(41, METHOD_TURN, 'Phone booked visitors first.', { id: base.you_id, name: base.you }), row(42, 3, 'Offer a fixed weekly slot.', SAM)]
/** No current model: the first proposal set aside (or a cold reopen of such a scenario). */
const noModel = (kept: unknown[]): View => ({ ...base, model: null, version: null, proposal: null, kept } as unknown as View)
const show = (view: View) => useViewStore.setState({ uuid: 'u', sid: view.id, view, status: 'ready', error: null, stale: false, at: null })
/** The dock's hook (OutputsDock.tsx, mocked out here) draws the View on the canvas; mounted beside the real canvas. */
const Draws = () => { useViewCanvas(true); return null }
const mount = () => render(<div style={{ width: 1232, height: 704 }}><Draws /><ViewCanvas /></div>)
const kinds = () => useCanvasStore.getState().nodes.map((n) => n.type)

beforeEach(() => {
  useMe.setState({ me: { id: base.you_id, name: base.you }, status: 'ready' })
  useCanvasStore.setState({ nodes: [], edges: [], currentScenarioId: 'u' } as never)
})
afterEach(() => {
  cleanup()
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null, at: null })
  useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null, gone: null })
  useMe.setState({ me: null, status: 'none' })
  useCanvasStore.setState({ nodes: [], edges: [] })
  setLevel('working', base.id)
})

describe('008e 1: kept ideas with no current model', () => {
  it('draws the kept ideas band and only that: one idea node per kept idea, no question, no card, no link', () => {
    show(noModel(KEPT))
    mount()
    const nodes = useCanvasStore.getState().nodes
    expect(nodes.map((n) => n.id).sort()).toEqual(keptIdeasOf(noModel(KEPT)).map((i) => IDEA_PREFIX + i.id).sort())
    expect(nodes.every((n) => n.type === VIEW_IDEA)).toBe(true)
    expect(kinds()).not.toContain(VIEW_CARD); expect(kinds()).not.toContain(VIEW_QUESTION); expect(kinds()).not.toContain(VIEW_FOLD)
    expect(useCanvasStore.getState().edges).toEqual([])
    expect(screen.getAllByTestId('view-idea-card').map((c) => c.getAttribute('data-view-idea')).sort()).toEqual(['kept:41', 'kept:42'])
    expect(document.querySelector('[data-band-label="ideas"]')).toHaveTextContent('Ideas you kept')
  })
  it('the welcome does not stand over them, and the message box is still the dock\'s', () => {
    show(noModel(KEPT))
    mount()
    expect(screen.queryByTestId('view-welcome')).toBeNull()
  })
  it('contrast: no kept ideas and no model draws nothing, and the welcome is up', () => {
    show(noModel([]))
    mount()
    expect(useCanvasStore.getState().nodes).toEqual([])
    expect(screen.queryAllByTestId('view-idea-card')).toHaveLength(0)
    expect(document.querySelector('[data-band-label]')).toBeNull()
    expect(screen.getByTestId('view-welcome')).toBeTruthy()
    expect(ideasOnlyOf(noModel([]), base.id)).toEqual([])
  })
  it('contrast: with a model its own board draws the ideas (ideasOnlyOf is empty), so the band is never doubled', () => {
    expect(ideasOnlyOf({ ...base, kept: KEPT } as unknown as View, base.id)).toEqual([])
  })
  it('set aside after a model: the cards leave and the ideas stay (and a model drawn again replaces the ideas-only board)', async () => {
    show({ ...base, kept: KEPT } as unknown as View)
    renderHook(() => useViewCanvas(true))
    await waitFor(() => expect(kinds()).toContain(VIEW_CARD))
    await act(async () => { show(noModel(KEPT)) })
    expect(useCanvasStore.getState().nodes.every((n) => n.type === VIEW_IDEA)).toBe(true)
    expect(useCanvasStore.getState().nodes).toHaveLength(2)
    await act(async () => { show(noModel([])) })
    expect(useCanvasStore.getState().nodes).toEqual([])
  })
})

describe('008e 2: an idea card is usable for the next thought', () => {
  const open = () => {
    const node = useCanvasStore.getState().nodes.find((n) => n.id === `${IDEA_PREFIX}kept:41`)!
    act(() => { useCanvasStore.getState().onNodesChange([{ type: 'select', id: node.id, selected: true }]) })
    return screen.getByTestId('view-idea-panel')
  }
  it('no panel until an idea is selected; selecting shows its full text, its source reply, core\'s method question and who kept it', () => {
    show(noModel(KEPT)); mount()
    expect(screen.queryByTestId('view-idea-panel')).toBeNull()
    const panel = open()
    const turn = base.chat.find((c) => c.id === METHOD_TURN)!
    expect(within(panel).getByTestId('view-idea-panel-text')).toHaveTextContent('Phone booked visitors first.')
    expect(within(panel).getByTestId('view-idea-panel-source')).toHaveTextContent(`From Olumi’s reply to “${turn.said}”`)
    expect(within(panel).getByTestId('view-idea-panel-method')).toHaveTextContent(turn.said)
    expect(within(panel).getByTestId('view-idea-panel-keeper')).toHaveTextContent('Kept by you')
  })
  it('another person\'s idea names its keeper, and a reply that is not a menu question names no method', () => {
    const view = noModel(KEPT), sam = keptIdeasOf(view).find((i) => i.id === 'kept:42')!
    expect(ideaDetailOf(view, sam)).toEqual({ source: `From Olumi’s reply to “${base.chat.find((c) => c.id === 3)!.said}”`, method: null, keeper: 'Kept by Sam' })
    const lost = { ...sam, sourceTurn: '999' }
    expect(ideaDetailOf(view, lost).source).toBe('From a reply that is not in this conversation')
  })
  it('Develop and Challenge put a question with the idea\'s exact words in the message box, and send nothing', () => {
    show(noModel(KEPT)); mount()
    const panel = open()
    const idea = keptIdeasOf(noModel(KEPT)).find((i) => i.id === 'kept:41')!
    fireEvent.click(within(panel).getByRole('button', { name: DEVELOP_IDEA }))
    expect(useViewChat.getState().text).toBe(developQuestionOf(idea))
    expect(useViewChat.getState().text).toContain('Phone booked visitors first.')
    fireEvent.click(within(panel).getByRole('button', { name: CHALLENGE_IDEA }))
    // After what is already typed, never over it.
    expect(useViewChat.getState().text).toBe(`${developQuestionOf(idea)}\n${challengeQuestionOf(idea)}`)
    expect(useViewChat.getState().busy).toBe(false)
  })
  it('with no model and no proposal, a scenario holding kept ideas takes the question as a message (core answers it in words), never a new brief', () => {
    show(noModel(KEPT)); mount()
    const panel = open()
    expect(within(panel).queryByTestId('view-idea-panel-brief-note')).toBeNull()
    const { sid, view } = useViewStore.getState()
    expect(takesBrief(sid, view)).toBe(false)
  })
  it('with a model (Simple), the idea is selected on the model board, the panel shows, the prefill lands and there is no brief note', async () => {
    setLevel('simple', base.id)
    show({ ...base, kept: KEPT } as unknown as View)
    renderHook(() => useViewCanvas(true))
    await waitFor(() => expect(useCanvasStore.getState().nodes.some((n) => n.id === `${IDEA_PREFIX}kept:41`)).toBe(true))
    expect(kinds()).toContain(VIEW_CARD)
    render(<IdeaPanel />)
    act(() => { useCanvasStore.getState().onNodesChange([{ type: 'select', id: `${IDEA_PREFIX}kept:41`, selected: true }]) })
    const panel = screen.getByTestId('view-idea-panel')
    expect(within(panel).getByTestId('view-idea-panel-text')).toHaveTextContent('Phone booked visitors first.')
    expect(within(panel).queryByTestId('view-idea-panel-brief-note')).toBeNull()
    fireEvent.click(within(panel).getByRole('button', { name: DEVELOP_IDEA }))
    expect(useViewChat.getState().text).toContain('Phone booked visitors first.')
  })
  it('Close lets go of the selection', () => {
    show(noModel(KEPT)); mount()
    const panel = open()
    fireEvent.click(within(panel).getByTestId('view-idea-close'))
    expect(screen.queryByTestId('view-idea-panel')).toBeNull()
  })
})

describe('a kept idea draws its words as the conversation draws the reply (DL, pair v3: `**` and "## " showed raw on the card)', () => {
  const MARKED = [row(43, 3, '**An invented lead.** Then the invented words follow.', SAM), row(44, 3, '## An invented heading', SAM)]
  const card = (id: string) => document.querySelector<HTMLElement>(`[data-testid="view-idea-card"][data-view-idea="${id}"]`)!
  it('catch: the card draws a bold run as weight, a lead-in as a quiet heading, no marks; at the board\'s type size, with no size of its own', () => {
    show(noModel([...KEPT, ...MARKED])); mount()
    const lead = card('kept:43'), heading = card('kept:44')
    const text = (el: HTMLElement) => el.querySelector<HTMLElement>('[data-testid="view-idea-text"]')!
    expect(text(lead).textContent).toBe('An invented lead. Then the invented words follow.')
    expect([...text(lead).querySelectorAll('strong')].map((s) => s.textContent)).toEqual(['An invented lead.'])
    expect(text(heading).textContent).toBe('An invented heading')
    expect(text(heading).querySelector('[data-reply-lead-in]')?.textContent).toBe('An invented heading')
    expect(lead.style.fontSize).toBe('calc(12px * var(--o-s, 1))')
    expect([...text(lead).querySelectorAll('*')].filter((e) => /(^|\s)text-(xs|sm|base|lg)(\s|$)/.test(e.className))).toEqual([])
    expect(lead.title).not.toMatch(/\*\*|##/)
    expect(lead.title).toContain('An invented lead. Then the invented words follow.')
  })
  it('catch: the opened idea\'s panel draws the same words the same way', () => {
    show(noModel([...KEPT, ...MARKED])); mount()
    act(() => { useCanvasStore.getState().onNodesChange([{ type: 'select', id: `${IDEA_PREFIX}kept:43`, selected: true }]) })
    const panelText = within(screen.getByTestId('view-idea-panel')).getByTestId('view-idea-panel-text')
    expect(panelText.textContent).toBe('An invented lead. Then the invented words follow.')
    expect(panelText.querySelector('strong')?.textContent).toBe('An invented lead.')
  })
  it('contrast: plain words are drawn verbatim, with no weight added', () => {
    show(noModel([...KEPT, ...MARKED])); mount()
    const plain = card('kept:41').querySelector<HTMLElement>('[data-testid="view-idea-text"]')!
    expect(plain.textContent).toBe('Phone booked visitors first.')
    expect(plain.querySelector('strong')).toBeNull()
  })
})
