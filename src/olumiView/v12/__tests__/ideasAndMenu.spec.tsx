/**
 * V12: "Keep as an idea" (the request body core takes, core's words on a 4xx, Olumi's own words kept) and the composer's ⋯ menu (one action
 * system: the same questions as the next step, the folded-in tools, the four icons kept, "More ways" gone).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { setTeamFetch } from '../../../olumiCore/team/api'
import { useUIStore } from '../../../stores/uiStore'
import type { View } from '../../client'
import { useViewStore } from '../../store'
import { ViewChat, ViewComposer, useViewChat } from '../../ViewChat'
import { leaveBriefPanel, useBriefPanelLeft } from '../../BriefPanel'
import { IDEA_MAX, ideaTextOf, keepIdea, keptIdeasOf } from '../ideas'
import { placeMenu } from '../actionsMenu'

const fixture = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/session', `${n}.view3.json`), 'utf8'))
const SID = 's_cb215d057b96', UUID = '00000000-0000-4000-8000-cb215d057b96'
const OP = expect.stringMatching(/^[A-Za-z0-9-]{8,64}$/)
let posts: { url: string; body: Record<string, unknown> }[] = []
function core(next: () => View, respond: (url: string) => Response = () => new Response('{}', { status: 201 })) {
  setTeamFetch((async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') { posts.push({ url, body: JSON.parse(String(init.body)) }); return respond(url) }
    return new Response(JSON.stringify(next()), { status: 200 })
  }) as unknown as typeof fetch)
}
const show = (view: View) => useViewStore.setState({ uuid: UUID, sid: SID, view, error: null, status: 'ready', stale: false, at: null })
const press = (el: Element) => act(async () => { fireEvent.click(el) })
beforeEach(() => { posts = [] })
afterEach(() => {
  cleanup(); setTeamFetch(null)
  useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none', stale: false, at: null })
  useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null, gone: null })
})

describe('keepIdea', () => {
  it('posts exactly the body core takes: kind idea, the text, the model version, the reply\'s turn and one op', async () => {
    core(() => fixture('after-find-first'))
    await keepIdea({ sid: SID, turn: 7, text: 'Try a part-time specialist first.', base: 4 })
    expect(posts).toHaveLength(1)
    expect(posts[0]!.url).toBe(`/api/scenarios/${SID}/strategy/items`)
    expect(posts[0]!.body).toEqual({ kind: 'idea', text: 'Try a part-time specialist first.', base: 4, from_turn: 7, op: OP })
  })
  it('takes the version from the View on screen (edit_base) when not given; with none (a proposal pending), it retains the idea on the scenario, never in the model', async () => {
    const v = fixture('after-find-first')
    core(() => v)
    show(v)
    await keepIdea({ sid: SID, turn: 2, text: 'x' })
    expect(posts[0]!.body['base']).toBe(v.model!.edit_base)
    posts = []
    show({ ...v, model: { ...v.model!, edit_base: null } })
    await keepIdea({ sid: SID, turn: 2, text: 'Try a part-time specialist first.' })
    expect(posts).toHaveLength(1)
    expect(posts[0]!.url).toBe(`/api/scenarios/${SID}/kept`)
    expect(posts[0]!.body).toEqual({ turn: 2, text: 'Try a part-time specialist first.' })   // no base, no op, no kind: never a model write
  })
  it('reads ideas retained before approval (View kept[]) after the model\'s own idea items, each once, as Olumi\'s with their keeper', () => {
    const v = fixture('after-find-first')
    const kept = [{ id: 41, turn: 14, text: 'Phone booked visitors first.', by: 'olumi', kept_by: { id: '10', name: 'Sam' }, at: '2026-11-16T12:00:00Z', concerns: [] }]
    const ideas = keptIdeasOf({ ...v, kept } as unknown as View)
    expect(ideas.at(-1)).toEqual({ id: 'kept:41', text: 'Phone booked visitors first.', olumis: true, sourceTurn: '14', keptBy: { id: '10', name: 'Sam' } })
    const twice = { ...v, kept, strategy: { items: [{ kind: 'idea', id: 'idea_1', text: 'Phone booked visitors first.', by_id: 'olumi', source_turn: 14 }] } } as unknown as View
    expect(keptIdeasOf(twice).filter((i) => i.text === 'Phone booked visitors first.')).toHaveLength(1)
  })
  it('a repeat of the same press after a failure reuses its op, so core keeps it once; a different idea has a different op', async () => {
    core(() => fixture('after-find-first'), () => new Response(JSON.stringify({ error: 'x' }), { status: 503 }))
    await keepIdea({ sid: SID, turn: 3, text: 'same', base: 1 }).catch(() => undefined)
    await keepIdea({ sid: SID, turn: 3, text: 'same', base: 1 }).catch(() => undefined)
    await keepIdea({ sid: SID, turn: 3, text: 'other', base: 1 }).catch(() => undefined)
    expect(posts[0]!.body['op']).toBe(posts[1]!.body['op'])
    expect(posts[2]!.body['op']).not.toBe(posts[0]!.body['op'])
  })
  it('keeps Olumi\'s own words, whole sentences only, inside core\'s limit', () => {
    const a = (t: string) => ({ answer: [{ text: t }], why: [], next: { label: '', text: [], about: [], at: null, newest: true, move: 'other_method' } }) as never
    expect(ideaTextOf(a('One idea.\n\nA second one.\n\nA third.'))).toBe('One idea. A second one. A third.')
    const long = 'First sentence. ' + 'word '.repeat(120) + 'ends here.'
    expect(ideaTextOf(a(long))).toBe('First sentence.')
    expect([...(ideaTextOf(a('P1 ' + 'a'.repeat(200) + '.\n\nP2 ' + 'b'.repeat(300) + '.')) ?? '')].length).toBeLessThanOrEqual(IDEA_MAX)
    expect(ideaTextOf(a('x'.repeat(IDEA_MAX + 5)))).toBeNull() // nothing is cut mid-sentence or reworded
  })
})

describe('Keep as an idea on a method reply', () => {
  it('is drawn on an Olumi method reply, marks it as Olumi\'s, and posts the reply\'s turn; success says it stays Olumi\'s', async () => {
    const v = fixture('after-find-first')
    core(() => v)
    show(v)
    const { container } = render(<ViewChat />)
    // The newest reply's own Keep (an earlier reply with an answer has its own, since Codex 008e #3).
    const b = container.querySelector<HTMLButtonElement>('[data-testid="view-chat-latest"] [data-testid="view-keep-idea-button"]')!
    expect(b).not.toBeNull()
    expect(b.title).toMatch(/recorded as Olumi’s/)
    await press(b)
    await waitFor(() => expect(container.querySelector('[data-testid="view-keep-idea-kept"]')).toHaveTextContent('Kept. It stays Olumi’s idea.'))
    expect(posts[0]!.body).toMatchObject({ kind: 'idea', from_turn: v.chat.at(-1)!.id, base: v.model!.edit_base })
  })
  it('a past version open: the button is off, says why, and nothing is posted', async () => {
    const v = fixture('after-find-first')
    core(() => v)
    show(v)
    useViewStore.setState({ at: 2 })
    const { container } = render(<ViewChat />)
    const b = container.querySelector<HTMLButtonElement>('[data-testid="view-keep-idea-button"]')!
    expect(b.disabled).toBe(true)
    expect(b.title).toMatch(/earlier version/)
    expect(posts).toHaveLength(0)
    await expect(keepIdea({ sid: SID, turn: 1, text: 'x' })).rejects.toThrow(/earlier version/)
  })
  it('core\'s 4xx is shown in core\'s words and nothing reads as kept', async () => {
    const v = fixture('after-find-first')
    core(() => v, () => new Response(JSON.stringify({ error: 'This idea is already kept.' }), { status: 409 }))
    show(v)
    const { container } = render(<ViewChat />)
    await press(container.querySelector('[data-testid="view-keep-idea-button"]')!)
    await waitFor(() => expect(container.querySelector('[data-testid="view-keep-idea-said"]')).toHaveTextContent('This idea is already kept.'))
    expect(container.querySelector('[data-testid="view-keep-idea-kept"]')).toBeNull()
  })
  it('Codex 008e #3: a reply with an answer to words the person typed has the action too; contrast: a turn with no answer has none', () => {
    const v = fixture('after-find-first')
    show({ ...v, chat: v.chat.map((t) => ({ ...t, said: 'Something I typed myself' })) })
    expect(render(<ViewChat />).container.querySelector('[data-testid="view-chat-latest"] [data-testid="view-keep-idea"]')).not.toBeNull()
    cleanup()
    show({ ...v, chat: v.chat.map((t) => ({ ...t, said: 'Something I typed myself', answer: null })) })
    expect(render(<ViewChat />).container.querySelector('[data-testid="view-keep-idea"]')).toBeNull()
  })
})

describe('the ⋯ menu in the composer', () => {
  const tab = () => render(<><ViewChat /><ViewComposer /></>).container
  it('sits beside the four icons, opens core\'s questions in core\'s order and the two tools; "More ways" is gone', async () => {
    const v = fixture('goal-understand')
    core(() => v)
    show(v)
    const c = tab()
    expect(c.querySelector('[data-testid="view-more-ways"]')).toBeNull()
    expect(c.querySelectorAll('[data-testid="view-composer-methods"] button')).toHaveLength(4) // the four icons stay
    expect(c.querySelector('[data-testid="view-actions-menu"]')).toBeNull()
    await press(c.querySelector('[data-testid="view-actions-button"]')!)
    const ids = [...c.querySelectorAll<HTMLElement>('[data-testid="view-session-method"]')].map((b) => b.dataset['method'])
    expect(ids).toEqual(v.session.methods.map((m) => m.id))
    expect([...c.querySelectorAll<HTMLElement>('[data-testid="view-actions-tools"] button')].map((b) => b.dataset['tool'])).toEqual(['edit_brief', 'review_inputs'])
    for (const el of c.querySelectorAll<HTMLElement>('[data-view^="session.methods"]')) {
      const [, i] = el.dataset['view']!.split('.').slice(1)
      expect(el.textContent).toBe(v.session.methods[Number(i)]!.text)
    }
    // the goal row is in the same menu
    expect(c.querySelector('[data-testid="view-actions-menu"] [data-testid="view-session-goal"]')).not.toBeNull()
  })
  it('a question press posts the same method write the next step does, and closes the menu', async () => {
    const v = fixture('goal-understand')
    core(() => v)
    show(v)
    const c = tab()
    await press(c.querySelector('[data-testid="view-actions-button"]')!)
    await press(c.querySelector('[data-method="else_do"]')!)
    expect(posts.map((p) => [p.url, p.body['method']])).toEqual([[`/api/scenarios/${SID}/method`, 'else_do']])
    expect(c.querySelector('[data-testid="view-actions-menu"]')).toBeNull()
  })
  it('an analysis-gated question says what it needs until there is an analysis', async () => {
    const v = fixture('goal-understand')
    core(() => v)
    show({ ...v, model: { ...v.model!, run: { ...v.model!.run!, aim: null } } })
    const c = tab()
    await press(c.querySelector('[data-testid="view-actions-button"]')!)
    expect(c.querySelector('[data-method="differ"] [data-testid="view-method-prerequisite"]')).not.toBeNull()
    expect(c.querySelector('[data-method="else_do"] [data-testid="view-method-prerequisite"]')).toBeNull()
  })
  it('"Review all inputs" opens the Model tab; "Your brief" opens the brief where it is held; neither writes', async () => {
    const v = fixture('goal-understand')
    core(() => v)
    show(v)
    useUIStore.setState({ activeOutputTab: 'olumi' } as never)
    const c = tab()
    await press(c.querySelector('[data-testid="view-actions-button"]')!)
    await press(c.querySelector('[data-testid="view-tool-review_inputs"]')!)
    expect(useUIStore.getState().activeOutputTab).toBe('diagnostics')
    // a first look: the brief's account is the dock's panel; the press brings it back (it was left for the tabs), and goes to no other tab
    leaveBriefPanel(SID)
    expect(useBriefPanelLeft.getState().left.has(SID)).toBe(true)
    useUIStore.setState({ activeOutputTab: 'olumi' } as never)
    await press(c.querySelector('[data-testid="view-actions-button"]')!)
    await press(c.querySelector('[data-testid="view-tool-edit_brief"]')!)
    expect(useBriefPanelLeft.getState().left.has(SID)).toBe(false)
    expect(useUIStore.getState().activeOutputTab).toBe('olumi')
    // later than a first look: the tab that holds the brief
    cleanup()
    const later: View = { ...v, chat: [...v.chat, ...v.chat] }
    show(later)
    const d = tab()
    await press(d.querySelector('[data-testid="view-actions-button"]')!)
    await press(d.querySelector('[data-testid="view-tool-edit_brief"]')!)
    expect(useUIStore.getState().activeOutputTab).toBe('analysisNew')
    expect(posts).toHaveLength(0)
  })
  it('no ⋯ before there is anything to ask: a brief still to be written', () => {
    useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none', stale: false, at: null })
    expect(tab().querySelector('[data-testid="view-actions-button"]')).toBeNull()
  })
})

describe('the next step card', () => {
  it('a reply with the filler move: the goal\'s first question is the one Next step, as a button that asks it (and the card carries no second step)', async () => {
    const v = fixture('goal-understand')
    const t = v.chat.at(-1)!
    const view: View = { ...v, chat: v.chat.map((x) => (x === t ? { ...x, answer: { ...x.answer!, next: { ...x.answer!.next, move: 'other_method' } } } : x)) }
    core(() => view)
    show(view)
    const c = render(<ViewChat />).container
    const step = c.querySelector('[data-testid="view-next-step"]')!
    expect(step.getAttribute('data-step')).toBe('method')
    expect(c.querySelectorAll('[data-testid="view-next-step"]')).toHaveLength(1)
    expect(c.querySelector('[data-testid="view-next-move"]')).toBeNull() // the filler draws no move tap
    await press(step.querySelector('[data-testid="view-next-method"]')!)
    expect(posts.map((p) => p.body['method'])).toEqual(['right_question'])
  })
  it('a real move stays the reply\'s own tap and the card adds nothing', () => {
    const v = fixture('goal-understand')
    core(() => v)
    show(v)
    const c = render(<ViewChat />).container
    expect(c.querySelectorAll('[data-testid="view-next-move"]')).toHaveLength(1)
    expect(c.querySelector('[data-testid="view-next-step"]')).toBeNull()
  })
})

describe('the ⋯ list stays inside its panel (Codex 006 #2)', () => {
  // Codex's measure at 1232 x 704: the chat panel spans x 885 to 1232, the ⋯ button's right edge is at 1052, its left at 1024, its top at 650.
  const button = { top: 650, left: 1024, right: 1052 }, panel = { left: 885, right: 1232 }, win = { width: 1232, height: 704 }
  it('at 1232 x 704 the whole list is inside the panel, 8 px from each edge at most', () => {
    const p = placeMenu(button, panel, win)
    const at = button.left + p.left
    expect(at).toBeGreaterThanOrEqual(panel.left + 8)
    expect(at + p.width).toBeLessThanOrEqual(panel.right - 8)
    expect(p.width).toBe(320)
  })
  it('CONTRAST: anchored to the button as before, it started at x 732, 153 px left of the panel', () => {
    expect(button.right - 320).toBe(732)
    expect(panel.left - (button.right - 320)).toBe(153)
  })
  it('a panel narrower than the list: the list narrows to the panel, never past it', () => {
    const p = placeMenu({ top: 650, left: 1180, right: 1208 }, { left: 1000, right: 1232 }, win)
    expect(p.width).toBe(216)
    expect(1180 + p.left).toBe(1008)
  })
})
