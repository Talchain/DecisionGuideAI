/**
 * The session goal and the menu of plain questions on the Olumi tab (canon wave step 1; core API `POST …/goal`, `POST …/method`, the View's
 * `session` block). Bound by identity: every drawn string is the View's own string at its `data-view` path, the order is core's order, and
 * each press posts exactly the body core takes. The Views are core's own answers, read from a scripted olumi-core (wip/r16-session-goal
 * 8c4fc92, no AI calls) after: a first model approved (`no-goal`), then `POST …/goal { goal: 'understand' }` (`goal-understand`), then
 * `POST …/method { method: 'find_first' }` (`after-find-first`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { setTeamFetch } from '../../olumiCore/team/api'
import type { View } from '../client'
import { useViewStore } from '../store'
import { ViewChat, ViewComposer, useViewChat } from '../ViewChat'
import { useCanvasStore } from '../../canvas/store'

const DIR = path.resolve('src/olumiView/fixtures/session')
const fixture = (n: string): View => JSON.parse(readFileSync(path.join(DIR, `${n}.view3.json`), 'utf8'))
type Session = { goal: { id: string; text: string } | null; set_by: string | null; goals: { id: string; text: string }[]; methods: { id: string; text: string; first: boolean }[] }
const sessionIn = (v: View): Session => (v as unknown as { session: Session }).session
const at = (v: unknown, p: string): unknown => p.split('.').reduce<unknown>((x, k) => (x === null || x === undefined ? undefined : (x as Record<string, unknown>)[k]), v)

const SID = 's_cb215d057b96'
const UUID = '00000000-0000-4000-8000-cb215d057b96'
const VIEW_PATH = `/api/scenarios/${SID}/view?schema=3`
const OP = expect.stringMatching(/^[A-Za-z0-9-]{8,64}$/)

let posts: { url: string; body: unknown }[] = [], reads: string[] = []
/** Core on the wire: each POST is recorded and answered by `respond`; each read answers `next()` (the View core would serve then). */
function core(next: () => View, respond: (url: string) => Response | Promise<Response> = () => new Response('{}', { status: 201 })) {
  setTeamFetch((async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') { posts.push({ url, body: JSON.parse(String(init.body)) }); return respond(url) }
    reads.push(url); return new Response(JSON.stringify(next()), { status: 200 })
  }) as unknown as typeof fetch)
}
const show = (view: View) => useViewStore.setState({ uuid: UUID, sid: SID, view, error: null, status: 'ready', stale: false, at: null })
const renderTab = () => render(<><ViewChat /><ViewComposer /></>).container
const press = (el: Element) => act(async () => { fireEvent.click(el) })
const goalOptions = (c: HTMLElement) => [...c.querySelectorAll<HTMLButtonElement>('[data-testid="view-session-goal-option"]')]
const methods = (c: HTMLElement) => [...c.querySelectorAll<HTMLButtonElement>('[data-testid="view-session-method"]')]
/** Every drawn session string is the View's own string at its path (design §3: identity, not a value found somewhere). */
const drawnExactly = (c: HTMLElement, v: View) => {
  const drawn = [...c.querySelectorAll<HTMLElement>('[data-view^="session."]')]
  for (const el of drawn) expect(el.textContent, el.dataset['view']).toBe(at(v, el.dataset['view']!))
  return drawn.length
}

beforeEach(() => { posts = []; reads = [] })
afterEach(() => {
  cleanup()
  setTeamFetch(null)
  useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none', stale: false, at: null })
  useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null, gone: null })
})

describe('with no goal: "What did you come here for?" and core\'s four goals', () => {
  const view = fixture('no-goal')
  const s = sessionIn(view)

  it('the four goals are drawn in core\'s order and words, under the question', () => {
    expect(s.goal).toBeNull()
    show(view)
    const c = renderTab()
    const picker = c.querySelector('[data-testid="view-session-goal"]')!
    expect(picker).not.toBeNull()
    expect(picker.textContent).toContain('What did you come here for?')
    expect(goalOptions(c).map((b) => b.dataset['goal'])).toEqual(['better_option', 'solve_problem', 'decide_fast', 'understand'])
    expect(goalOptions(c).map((b) => b.textContent)).toEqual(s.goals.map((g) => g.text))
    expect(c.querySelector('[data-testid="view-session-goal-chip"]')).toBeNull()
    expect(drawnExactly(c, view)).toBeGreaterThanOrEqual(4)
  })

  it('pressing "Decide quickly" posts exactly { goal: \'decide_fast\' } (with its op id) to the scenario\'s goal, then reads the View again', async () => {
    core(() => view)
    show(view)
    const c = renderTab()
    await press(goalOptions(c).find((b) => b.textContent === 'Decide quickly')!)
    await waitFor(() => expect(reads).toContain(VIEW_PATH))
    expect(posts).toEqual([{ url: `/api/scenarios/${SID}/goal`, body: { goal: 'decide_fast', op: OP } }])
  })
})

describe('with a goal: a compact chip in core\'s words, changeable and clearable', () => {
  const view = fixture('goal-understand')
  const s = sessionIn(view)

  it('the chip shows core\'s text for the goal, with who set it on hover; the row of goals is not drawn', () => {
    expect(s.goal).toEqual({ id: 'understand', text: 'Understand the situation' })
    show(view)
    const c = renderTab()
    const chip = c.querySelector('[data-testid="view-session-goal-chip"]')!
    expect(chip.querySelector('[data-view="session.goal.text"]')!.textContent).toBe(s.goal!.text)
    expect(s.set_by).toBe('Ana')
    expect(c.querySelector('[data-testid="view-session-goal-change"]')!.getAttribute('title')).toBe(`Set by ${s.set_by}`)
    expect(goalOptions(c)).toEqual([])
    drawnExactly(c, view)
  })

  it('clearing posts exactly { goal: null } (with its op id)', async () => {
    core(() => fixture('no-goal'))
    show(view)
    const c = renderTab()
    await press(c.querySelector('[data-testid="view-session-goal-clear"]')!)
    await waitFor(() => expect(reads).toContain(VIEW_PATH))
    expect(posts).toEqual([{ url: `/api/scenarios/${SID}/goal`, body: { goal: null, op: OP } }])
  })

  it('pressing the chip reopens core\'s goals to change it', async () => {
    show(view)
    const c = renderTab()
    await press(c.querySelector('[data-testid="view-session-goal-change"]')!)
    expect(goalOptions(c).map((b) => b.dataset['goal'])).toEqual(s.goals.map((g) => g.id))
  })
})

describe('reasoning first (R25, Paul 7 Nov, plan v3 item 4): Olumi\'s reply above the next step; every method behind one disclosure', () => {
  it('catch: the latest reply is drawn before the next step, and the goal and every method sit in a closed "More ways to think about this"', () => {
    const view = fixture('goal-understand')
    show(view)
    const c = renderTab()
    const reply = c.querySelector('[data-testid="view-chat-latest"]'), more = c.querySelector<HTMLDetailsElement>('[data-testid="view-more-ways"]')!
    expect(reply).not.toBeNull()
    const next = c.querySelector('[data-testid="view-next-step"]')
    if (next !== null) expect(reply!.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(more.open).toBe(false)
    expect(more.querySelector('summary')!.textContent).toBe('More ways to think about this')
    expect(methods(c).every((b) => more.contains(b))).toBe(true)
    expect(more.contains(c.querySelector('[data-testid="view-session-menu"]'))).toBe(true)
  })
})

describe('the menu: every question in the View\'s order, the goal\'s first quietly emphasised, none hidden', () => {
  it.each(['no-goal', 'goal-understand'])('%s: every question core sends is drawn, in core\'s order and words', (name) => {
    const view = fixture(name), s = sessionIn(view)
    show(view)
    const c = renderTab()
    expect(methods(c).map((b) => b.dataset['method'])).toEqual(s.methods.map((m) => m.id))
    expect(methods(c).map((b) => b.querySelector('[data-view]')!.textContent)).toEqual(s.methods.map((m) => m.text))
    expect(methods(c)).toHaveLength(11)
    drawnExactly(c, view)
  })

  it('with "Understand the situation", core\'s five questions for it lead and are emphasised; the other six follow, drawn, unemphasised', () => {
    const view = fixture('goal-understand'), s = sessionIn(view)
    // Core's order is not the canon's here: a page that re-sorted, or drew the canon's list, would differ.
    expect(s.methods.map((m) => m.id)).toEqual(['right_question', 'push', 'similar', 'rests', 'bias', 'differ', 'find_first', 'have_true', 'go_wrong', 'else_do', 'success'])
    show(view)
    const c = renderTab()
    const drawn = methods(c)
    expect(drawn.map((b) => b.hasAttribute('data-first'))).toEqual(s.methods.map((m) => m.first))
    expect(drawn.map((b) => b.querySelector('[data-testid="view-session-method-first"]') !== null)).toEqual(s.methods.map((m) => m.first))
    for (const b of drawn) expect(b.disabled, b.dataset['method']).toBe(false)
  })

  it('with no goal, no question is emphasised', () => {
    show(fixture('no-goal'))
    const c = renderTab()
    expect(methods(c)).toHaveLength(11)
    expect(methods(c).some((b) => b.hasAttribute('data-first'))).toBe(false)
  })
})

describe('a press asks that question as a discussion-only turn', () => {
  it('pressing "What should we find out first?" posts exactly { method: \'find_first\' } (with its op id), nothing else, and draws core\'s reply as the newest turn', async () => {
    const before = fixture('goal-understand'), after = fixture('after-find-first')
    core(() => after, () => new Response(JSON.stringify({ proposal: 6, discussion: true }), { status: 201 }))
    show(before)
    const scrolled: Element[] = []
    const scroll = vi.fn(function (this: Element) { scrolled.push(this) })
    const own = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView')
    Object.defineProperty(Element.prototype, 'scrollIntoView', { value: scroll, configurable: true, writable: true })
    const c = renderTab()
    await press(methods(c).find((b) => b.dataset['method'] === 'find_first')!)
    await waitFor(() => expect(reads).toContain(VIEW_PATH))
    expect(posts).toEqual([{ url: `/api/scenarios/${SID}/method`, body: { method: 'find_first', op: OP } }])
    // The reply as it arrives: core's newest turn, the question as said and Olumi's answer, drawn at its path.
    const last = after.chat.length - 1
    await waitFor(() => expect(c.querySelector(`[data-view="chat.${last}.said"]`)?.textContent).toBe('What should we find out first?'))
    expect(at(after, `chat.${last}.answer.answer.0.text`)).toBe('The model stays as it is. What a specialist adds is the figure that matters most here.')
    expect(c.querySelector(`[data-view="chat.${last}.answer.answer.0.text"]`)!.textContent).toBe(at(after, `chat.${last}.answer.answer.0.text`))
    // The reply is brought into view once drawn (it lands under the menu).
    await waitFor(() => expect(scrolled).toEqual([c.querySelector('[data-testid="view-chat-latest"]')]))
    if (own === undefined) delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
    else Object.defineProperty(Element.prototype, 'scrollIntoView', own)
    // Core's guarantee, as served: the model and the version are what they were.
    expect(after.model).toEqual(before.model)
    expect(after.version).toEqual(before.version)
  })

  it('while a turn is in flight the whole menu and the goal chip are held, and a press sends nothing', async () => {
    let release: (r: Response) => void = () => {}
    core(() => fixture('after-find-first'), () => new Promise<Response>((r) => { release = r }))
    show(fixture('goal-understand'))
    const c = renderTab()
    await press(methods(c).find((b) => b.dataset['method'] === 'find_first')!)
    expect(posts).toHaveLength(1)
    expect(methods(c)).toHaveLength(11)
    for (const b of methods(c)) expect(b.disabled, b.dataset['method']).toBe(true)
    expect(c.querySelector<HTMLButtonElement>('[data-testid="view-session-goal-clear"]')!.disabled).toBe(true)
    expect(c.querySelector<HTMLButtonElement>('[data-testid="view-session-goal-change"]')!.disabled).toBe(true)
    await press(methods(c).find((b) => b.dataset['method'] === 'go_wrong')!)
    expect(posts).toHaveLength(1)
    await act(async () => { release(new Response(JSON.stringify({ proposal: 6, discussion: true }), { status: 201 })) })
    await waitFor(() => expect(useViewChat.getState().busy).toBe(false))
    for (const b of methods(c)) expect(b.disabled, b.dataset['method']).toBe(false)
  })

  it('R17 D5: "What could go wrong?" sends the option the person has selected (only then); every other press sends none', async () => {
    core(() => fixture('goal-understand'))
    show(fixture('goal-understand'))
    const c = renderTab()
    useCanvasStore.setState({ selection: { nodeIds: new Set(['add_one']), edgeIds: new Set<string>(), anchorPosition: null } })
    await press(methods(c).find((b) => b.dataset['method'] === 'go_wrong')!)
    expect(posts[0]!.body).toEqual({ method: 'go_wrong', op: OP, option: 'add_one' })
    useCanvasStore.setState({ selection: { nodeIds: new Set(['add_one', 'hold']), edgeIds: new Set<string>(), anchorPosition: null } })
    await press(methods(c).find((b) => b.dataset['method'] === 'go_wrong')!)
    expect(posts[1]!.body).toEqual({ method: 'go_wrong', op: OP })
    useCanvasStore.setState({ selection: { nodeIds: new Set(['add_one']), edgeIds: new Set<string>(), anchorPosition: null } })
    await press(methods(c).find((b) => b.dataset['method'] === 'rests')!)
    expect(posts[2]!.body).toEqual({ method: 'rests', op: OP })
    useCanvasStore.setState({ selection: { nodeIds: new Set(), edgeIds: new Set<string>(), anchorPosition: null } })
  })

  it('the goal row is held while a turn is in flight too', () => {
    useViewChat.setState({ busy: true })
    show(fixture('no-goal'))
    const c = renderTab()
    expect(goalOptions(c)).toHaveLength(4)
    for (const b of goalOptions(c)) expect(b.disabled, b.dataset['goal']).toBe(true)
  })
})

describe('a View without the session block (a core before canon wave step 1) draws neither', () => {
  it('no picker, no chip, no menu', () => {
    const v = fixture('no-goal') as unknown as Record<string, unknown>
    delete v['session']
    show(v as unknown as View)
    const c = renderTab()
    expect(c.querySelector('[data-testid="view-session-goal"]')).toBeNull()
    expect(c.querySelector('[data-testid="view-session-menu"]')).toBeNull()
  })
})
