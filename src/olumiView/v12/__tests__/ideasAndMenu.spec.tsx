/**
 * V12: "Keep as an idea" (the request body core takes, core's words on a 4xx, Olumi's own words kept) and the composer's ⋯ menu (one action
 * system: the same questions as the next step, the folded-in tools, the four icons kept, "More ways" gone).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
import { ActionsMenu, FIRST_FOR_YOUR_GOAL } from '../actionsMenu'
import { IdeaPanel } from '../bands/IdeaPanel'
import { IDEA_PREFIX } from '../bands/bands'
import { tipOf } from '../../__tests__/tipHelpers'
import { VIEW_IDEA } from '../bands/BandNodes'
import { useCanvasStore } from '../../../canvas/store'
import type { Menu } from '../actions'

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
  it('UI-E (18 Nov): "Challenge this idea" on an idea kept on the model runs core\'s typed challenge on THAT record and types nothing. CONTRAST: an idea kept before approval (kept: row) puts its question in the box and sends nothing', async () => {
    const v = fixture('after-find-first')
    const kept = [{ id: 41, turn: 14, text: 'Ring the two biggest customers.', by: 'olumi', kept_by: null, at: '2026-11-16T12:00:00Z', concerns: [] }]
    const view = { ...v, kept, strategy: { items: [{ kind: 'idea', id: 'idea_1', text: 'Phone booked visitors first.', by_id: 'olumi', source_turn: 14 }] } } as unknown as View
    core(() => view, () => new Response(JSON.stringify({ job: 9, status_url: null }), { status: 202 }))
    show(view)
    const open = (id: string) => useCanvasStore.setState({ nodes: [{ id: IDEA_PREFIX + id, type: VIEW_IDEA, selected: true, position: { x: 0, y: 0 }, data: {} }] } as never)
    open('idea_1')
    const c = render(<IdeaPanel />).container
    await press(c.querySelector('[data-testid="view-idea-challenge"]')!)
    await waitFor(() => expect(posts).toHaveLength(1))
    expect([posts[0]!.url, posts[0]!.body['kind'], posts[0]!.body['record'], useViewChat.getState().text]).toEqual([`/api/scenarios/${SID}/challenge`, 'opposite', 'idea_1', ''])
    await waitFor(() => expect(useViewChat.getState().busy).toBe(false))
    cleanup(); posts = []
    open('kept:41')
    const k = render(<IdeaPanel />).container
    await press(k.querySelector('[data-testid="view-idea-challenge"]')!)
    expect([posts.length, useViewChat.getState().text]).toEqual([0, 'What would challenge this idea? “Ring the two biggest customers.”'])
    useCanvasStore.setState({ nodes: [] } as never)
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
    expect(ideaTextOf(Object.assign(a('Prose.'), { history: { heading: 'H', lines: ['L'] } }))).toBe('Prose.')
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
    expect(b.hasAttribute('title'), 'no native title').toBe(false)
    expect(await tipOf(b)).toMatch(/recorded as Olumi’s/)
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
    // Held, not removed: aria-disabled and still focusable, so its reason shows on hover and on keyboard focus; pressing does nothing.
    expect(b).toHaveAttribute('aria-disabled', 'true')
    expect(await tipOf(b)).toMatch(/earlier version/)
    await press(b)
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
  const tab = () => render(<><ViewChat /><ViewComposer /></>).baseElement
  it('sits beside the four icons, opens core\'s questions in core\'s order and the two tools; "More ways" is gone', async () => {
    const v = fixture('goal-understand')
    core(() => v)
    show(v)
    const c = tab()
    expect(c.querySelector('[data-testid="view-more-ways"]')).toBeNull()
    expect(c.querySelectorAll('[data-testid="view-composer-methods"] button')).toHaveLength(4) // the four icons stay
    // Paul's paperclip (audit F14): first in the footer, a real file input (the file is read in this browser), then the four icons.
    const footer = c.querySelector('[data-testid="view-composer-footer"]')!
    expect(footer.firstElementChild?.getAttribute('data-testid')).toBe('view-composer-attach')
    expect(footer.querySelector('[data-testid="brief-document-input"]')?.getAttribute('type')).toBe('file')
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
    // 18 Nov (menu review): only what core calculates says it needs an analysis: "rests" does; "differ" (not grounded yet) and a qualitative
    // question do not.
    expect(c.querySelector('[data-method="rests"] [data-testid="view-method-prerequisite"]')).not.toBeNull()
    expect(c.querySelector('[data-method="differ"] [data-testid="view-method-prerequisite"]')).toBeNull()
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

describe('the reply\'s next step (system spec P2: no card at the top)', () => {
  it('a reply with the filler move draws no tap and no step: the goal\'s first question stays in the ⋯ list, where it asks', async () => {
    const v = fixture('goal-understand')
    const t = v.chat.at(-1)!
    const view: View = { ...v, chat: v.chat.map((x) => (x === t ? { ...x, answer: { ...x.answer!, next: { ...x.answer!.next, move: 'other_method' } } } : x)) }
    core(() => view)
    show(view)
    const c = render(<><ViewChat /><ViewComposer /></>).baseElement // the ⋯ list lives in the composer
    expect(c.querySelector('[data-testid="view-next-step"]')).toBeNull() // CHANGED BY DESIGN: was the goal's first question as a card at the top
    expect(c.querySelector('[data-testid="view-next-move"]')).toBeNull() // the filler draws no move tap
    await press(c.querySelector('[data-testid="view-actions-button"]')!)
    await press(c.querySelector('[data-testid="view-session-method"][data-method="right_question"]')!)
    expect(posts.map((p) => p.body['method'])).toEqual(['right_question'])
  })
  // CHANGED BY DESIGN (system spec P2): the reply's real move is drawn once, at the end of the reply, filled. Was: the one Next step card's tap at the top.
  it('a real move is one tap at the end of the reply, drawn once', () => {
    const v = fixture('goal-understand')
    core(() => v)
    show(v)
    const c = render(<ViewChat />).container
    expect(c.querySelectorAll('[data-testid="view-next-move"]')).toHaveLength(1)
    expect(c.querySelector('[data-testid="view-next-step"]')).toBeNull()
    expect(c.querySelectorAll('[data-testid="view-chat-latest"] [data-testid="view-next-move"]')).toHaveLength(1)
  })
})

describe('the ⋯ list uses the conversation boundary', () => {
  it.each([
    ['Outputs dock', 347, 331],
    ['Olumi conversation', 232, 216],
  ])('measures the width of %s and keeps an 8px inset on either side', async (label, width, available) => {
    const left = window.innerWidth - width
    const action = <ActionsMenu menu={{ goal: null, methods: [], tools: ['edit_brief'] }} held={false} goal={null}
      onMethod={() => undefined} onTool={() => undefined} />
    const { getByTestId } = render(label === 'Outputs dock'
      ? <aside aria-label={label}>{action}</aside>
      : <div role="dialog" aria-label={label} data-testid="view-chat-float">{action}</div>)
    const button = getByTestId('view-actions-button')
    const panel = button.closest('[aria-label="' + label + '"]')!
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(new DOMRect(left, 100, width, 604))
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(new DOMRect(left + 100, 650, 28, 28))
    await press(button)
    const popup = getByTestId('view-actions-menu')
    await waitFor(() => expect(popup.style.maxWidth).toBe(`${available}px`))
  })
})

describe('core\'s offer to build a model is the menu\'s first row (pair v4 render: last in the tools it sat below the fold at 1232, 1.33 and 2000)', () => {
  const methods = Array.from({ length: 11 }, (_, i) => ({ id: `m${i}`, text: `An invented question ${i}`, first: false, prerequisite: null, i })) as unknown as Menu['methods']
  const menu: Menu = { goal: null, methods, tools: ['edit_brief', 'review_inputs'] }
  const BUILD = { label: 'An invented offer to build', title: 'An invented hover.', onPress: () => undefined }
  const open = async (build?: typeof BUILD) => {
    const c = render(<ActionsMenu menu={menu} held={false} goal={<div data-testid="view-session-goal">An invented goal row</div>} onMethod={() => undefined} onTool={() => undefined} build={build} />).baseElement
    await press(c.querySelector('[data-testid="view-actions-button"]')!)
    return c.querySelector<HTMLElement>('[data-testid="view-actions-menu"]')!
  }
  it('catch: the offer is the first press in the open menu, before the goal row and every question, and not among the tools', async () => {
    const m = await open(BUILD)
    const presses = [...m.querySelectorAll<HTMLElement>('button')]
    expect(presses[0]?.dataset['testid']).toBe('view-build-model')
    expect(presses[0]).toHaveFocus()
    expect(presses[0]?.querySelector('[data-testid="view-build-model-label"]')?.textContent).toBe(BUILD.label)
    expect(presses[0]?.textContent).toBe(BUILD.label)
    // The hover is the one Tip, never a native title.
    expect([presses[0]?.hasAttribute('title'), await tipOf(presses[0]!)]).toEqual([false, BUILD.title])
    const order = (sel: string) => [...m.querySelectorAll('*')].indexOf(m.querySelector(sel)!)
    expect(order('[data-testid="view-build-model"]')).toBeLessThan(order('[data-testid="view-session-goal"]'))
    expect(m.querySelector('[data-testid="view-actions-tools"] [data-testid="view-build-model"]')).toBeNull()
    expect(m.querySelectorAll('[data-testid="view-build-model"]')).toHaveLength(1)
  })
  it('contrast: with no offer from core the menu opens on the goal row, and the tools are as before', async () => {
    const m = await open()
    expect(m.querySelector('[data-testid="view-build-model"]')).toBeNull()
    expect(m.querySelector('[data-testid="view-build-model-row"]')).toBeNull()
    expect([...m.querySelectorAll<HTMLElement>('[data-testid="view-actions-tools"] button')].map((b) => b.dataset['tool'])).toEqual(['edit_brief', 'review_inputs'])
    expect(m.querySelector('[data-testid="view-tool-edit_brief"] [data-testid="brief"] svg')).toHaveAttribute('width', '14')
    expect(m.querySelector('[data-testid="view-tool-review_inputs"] [data-testid="review-inputs"] svg')).toHaveAttribute('width', '14')
  })
})

describe('question rows', () => {
  const draw = async (ids: string[], first = 0) => {
    const methods = ids.map((id, i) => ({ id, i, text: `An invented question ${i}`, first: i < first, prerequisite: null }))
    const { getByTestId } = render(
      <ActionsMenu menu={{ goal: null, methods, tools: [] }} held={false} goal={null} onMethod={() => undefined} onTool={() => undefined} />,
    )
    await press(getByTestId('view-actions-button'))
    return getByTestId('view-session-menu')
  }

  it('draws a decorative registry icon for every known method and one fallback for an unfamiliar method', async () => {
    const ids = ['differ', 'find_first', 'have_true', 'go_wrong', 'pre_mortem', 'else_do', 'right_question', 'push', 'similar', 'rests', 'success', 'bias', 'figure_first']
    const questions = await draw([...ids, 'future_question', 'outside'])
    const rows = [...questions.querySelectorAll('[data-method]')]
    expect(rows.map((row) => row.getAttribute('data-method'))).toEqual([...ids, 'future_question', 'outside'])
    const expectedIcons = [...ids.map((id) => `method-${id}`), 'method-other', 'method-other']
    for (const [index, row] of rows.entries()) {
      expect(row.querySelector(`[data-testid="${expectedIcons[index]}"][aria-hidden="true"].text-text-light svg`)).toHaveAttribute('width', '14')
    }
  })

  it('labels just the leading run when all questions suit the goal', async () => {
    const questions = await draw(['push', 'rests'], 2)
    expect([...questions.querySelectorAll('p')].map((label) => label.textContent)).toEqual(['Ask Olumi', FIRST_FOR_YOUR_GOAL])
    expect([...questions.querySelectorAll('[data-method]')].map((row) => row.getAttribute('data-method'))).toEqual(['push', 'rests'])
  })

  it('skips native and aria-disabled rows during keyboard navigation and closes on outside press', async () => {
    const menu: Menu = { goal: null, methods: [], tools: ['edit_brief'] }
    const goal = <><button disabled>Unavailable goal</button><button aria-disabled="true">Held goal</button></>
    const { getByTestId, queryByTestId } = render(
      <ActionsMenu menu={menu} held={false} goal={goal} onMethod={() => undefined} onTool={() => undefined} build={{ label: 'Build', title: 'Build a model', onPress: () => undefined }} />,
    )
    await press(getByTestId('view-actions-button'))
    const build = getByTestId('view-build-model'), tool = getByTestId('view-tool-edit_brief')
    expect(build).toHaveFocus()
    fireEvent.keyDown(build, { key: 'ArrowDown' })
    expect(tool).toHaveFocus()
    fireEvent.keyDown(tool, { key: 'ArrowUp' })
    expect(build).toHaveFocus()
    fireEvent.pointerDown(document.body)
    expect(queryByTestId('view-actions-menu')).toBeNull()
  })
})

describe('the gated questions\' shared sentence is said once (DL 08:5xZ: under six rows on a words board)', () => {
  const SAID = 'An invented sentence every gated question shares.'
  const m = (id: string, i: number, prerequisite: string | null) => ({ id, i, text: `An invented question ${i}`, first: false, prerequisite })
  const draw = async (methods: unknown[]) => {
    const c = render(<ActionsMenu menu={{ goal: null, methods: methods as Menu['methods'], tools: [] }} held={false} goal={null} onMethod={() => undefined} onTool={() => undefined} />).baseElement
    await press(c.querySelector('[data-testid="view-actions-button"]')!)
    return c.querySelector<HTMLElement>('[data-testid="view-actions-menu"]')!
  }
  it('catch: two or more gated questions sharing it: drawn once at the head of the questions; each gated question carries the mark, with it as hover and name; the others none', async () => {
    const menu = await draw([m('a', 0, SAID), m('b', 1, null), m('c', 2, SAID), m('d', 3, SAID)])
    expect([...menu.querySelectorAll('[data-testid="view-method-prerequisite-once"]')].map((e) => e.textContent)).toEqual([SAID])
    expect(menu.textContent!.split(SAID).length - 1).toBe(1)
    const marks = [...menu.querySelectorAll<HTMLElement>('[data-testid="view-method-prerequisite"]')]
    expect(marks.map((e) => e.closest<HTMLElement>('[data-method]')?.dataset['method'])).toEqual(['a', 'c', 'd'])
    // The mark's hover is the one Tip (the icon inside its question's button), never a native title.
    act(() => { (document.activeElement as HTMLElement).blur() })
    for (const e of marks) {
      expect(e.closest('button')).toHaveAttribute('data-testid', 'view-session-method')
      expect(e.closest('button')?.lastElementChild).toContainElement(e)
      expect(e).toHaveClass('text-text-light')
      expect([e.getAttribute('aria-label'), e.hasAttribute('title'), await tipOf(e)]).toEqual([SAID, false, SAID])
    }
  })
  it('a single gated question keeps its prerequisite in the row tip and keeps its icon', async () => {
    const menu = await draw([m('a', 0, SAID), m('b', 1, null)])
    const row = menu.querySelector<HTMLElement>('[data-method="a"]')!
    expect(menu.querySelector('[data-testid="view-method-prerequisite-once"]')).toBeNull()
    expect(row.querySelector('[data-testid="view-method-prerequisite"]')).not.toBeNull()
    expect(row.textContent).toBe('An invented question 0')
    expect(await tipOf(row)).toBe(SAID)
  })
})
