/**
 * A private view's links and factor (core `POST …/views/:id/doubts`, olumi-core wip/debate): the links offered are the View's own
 * `links[].remove`, sent verbatim with the new view's id; a refusal after the view is saved is said as such, never as the view failing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { View } from '../../olumiView/client'
import { setPagePerson, setTeamFetch } from '../team/api'
import { resetDoubts, sendDoubts, ViewDoubts } from '../team/ViewDoubts'
import { resetDifferences, useDifferences, type Differences } from '../team/differences'
import { ViewsPanel } from '../team/ViewsPanel'
import { draftOf, resetDrafts } from '../team/drafts'
import { signOutOfOlumi } from '../signout'
import { deleteMyData } from '../erase'
import { useMe } from '../me'
import { challenge, useViewChat, ViewChat, ViewComposer } from '../../olumiView/ViewChat'
import { useFigureFirst } from '../../olumiView/ViewFigureFirst'
import { usePreMortemGate, useViewLens } from '../../olumiView/lens'
import { ViewPreMortemKey } from '../../olumiView/ViewPreMortemKey'
import { useViewStore } from '../../olumiView/store'

const fx: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/r5', 'effects.view3.json'), 'utf8'))
const offer: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/figure-first', 'offer.view3.json'), 'utf8'))
const entry = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/figure-first', 'entry.json'), 'utf8'))
const FORM = { about: 'On', stance: 'You', text: 'What you hold about it, in your words', source: 'Source, if you have one', source_example: 'Source, if you have one (two rollouts, a report…)', send: 'Add my view', private: 'Private until the team’s views are revealed.' }
const VOCAB = { kinds: [{ id: 'claim', text: 'Claim' }], form: FORM, stances: [{ id: 'know', text: 'What I know', word: 'Observed' }, { id: 'suspect', text: 'What I suspect', word: 'Expects' }, { id: 'unsure', text: 'Unsure', word: 'Unsure' }, { id: 'would_try', text: 'What I would try', word: 'Would try' }, { id: 'others_may_miss', text: 'What others may miss', word: 'Others may miss' }], limits: { text: 400, source: 200, concerns: 8, items: 8 } }
const remove = { record: 'total_def', part: 'existing_capacity' }
const link = { from: 'existing_capacity', to: 'total_capacity', kind: 'plain', label: '', doubt: false, alert: false, proposed: false, title: 't', effect: null, remove }
// D3 (re-pinned): core's `collab.view_figure_cards` names the figure boxes (at most three); these three of the fixture's figure cards.
const view = (): View => ({ ...fx, proposal: null, collab: { ...fx.collab, view_figure_cards: ['existing_capacity', 'per_specialist', 'one_specialist'].map((id) => ({ id, label: id })) }, model: { ...fx.model!, links: [link, { ...link, from: 'total_capacity', to: 'capacity_goal', remove: null }] } } as unknown as View)
type Sent = { method: string; url: string; body: unknown }
function serve(status: number, body: unknown): Sent[] {
  const sent: Sent[] = []
  setTeamFetch((async (url: string, init?: RequestInit) => {
    sent.push({ method: init?.method ?? 'GET', url, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    return new Response(JSON.stringify(url === '/api/me' ? { me: null } : body), { status: url === '/api/me' ? 200 : status, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof fetch)
  return sent
}
afterEach(() => {
  cleanup(); setTeamFetch(null); setPagePerson(null); resetDrafts(); resetDoubts(); resetDifferences(); useMe.setState({ me: null, status: 'none' })
  useViewStore.setState(useViewStore.getInitialState(), true)
  useViewChat.setState(useViewChat.getInitialState(), true)
  usePreMortemGate.setState(usePreMortemGate.getInitialState(), true)
  useFigureFirst.setState(useFigureFirst.getInitialState(), true)
  useViewLens.setState({ lens: 'full' })
})
/** Core has the debate routes: its differences read answered for this scenario. */
const supported = () => useDifferences.setState({ sid: 's_x', key: 'k', data: { gated: true } as unknown as Differences, error: null })

describe('a private view\'s links and factor', () => {
  it('is not offered on a core without the debate routes (its differences read answered 404, so none is held)', () => {
    const { container } = render(<ViewDoubts sid="s_x" view={view()} disabled={false} />)
    expect(container.querySelector('[data-testid="team-view-doubts"]')).toBeNull()
  })

  it('offers only the links core can take out, and sends the picked one verbatim with the factor and the view id', async () => {
    const sent = serve(201, { doubt: 5 })
    supported()
    render(<ViewDoubts sid="s_x" view={view()} disabled={false} />)
    const boxes = screen.getByTestId('team-view-doubts').querySelectorAll('input[type="checkbox"]')
    expect(boxes).toHaveLength(1)
    fireEvent.click(screen.getByTestId('team-view-doubt-total_def|existing_capacity'))
    fireEvent.change(screen.getByTestId('team-view-missing'), { target: { value: 'staff absence' } })
    await sendDoubts('s_x', 7)
    expect(sent.find((s) => s.method === 'POST')).toEqual({ method: 'POST', url: '/api/scenarios/s_x/views/7/doubts', body: { links: [remove], missing: 'staff absence', stance: null } })
  })

  it('sends nothing when nothing was named; a refusal says the view is saved', async () => {
    const none = serve(201, { doubt: 5 })
    await sendDoubts('s_x', 7)
    expect(none.filter((s) => s.method === 'POST')).toHaveLength(0)
    serve(400, { error: 'each link must be one the model shows' })
    supported()
    render(<ViewDoubts sid="s_x" view={view()} disabled={false} />)
    fireEvent.change(screen.getByTestId('team-view-missing'), { target: { value: 'x' } })
    await sendDoubts('s_x', 7)
    expect((await screen.findByTestId('team-view-doubts-error')).textContent).toBe('Your view is saved; the links and factor were not: each link must be one the model shows')
  })


  it.each([
    { action: 'sign-out', forget: signOutOfOlumi, url: '/api/me/signout', body: {}, reply: { signedOut: true } },
    { action: 'deletion', forget: deleteMyData, url: '/api/me/delete', body: { confirm: 'delete my data' }, reply: { deleted: true } },
  ])('N2 blocker 1: $action clears Ada\'s private Team, chat, pre-mortem and figure-first drafts before Bob opens s_x', async ({ forget, url, body, reply }) => {
    const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No live requests in this row'))
    const sent: Sent[] = []
    const uuid = '00000000-0000-4000-8000-000000000001'
    const chat = 'Ada alone: question the capacity assumption'
    const refusal = 'Check the figure before challenging it.'
    const gate = {
      state: 'closed' as const, held: false, heading: 'If it failed: your reasons first',
      gate: "Write your own reasons it could fail first; Olumi's stories show after yours.",
      question: 'Imagine it is a year from now and this has failed. What went wrong? Write each reason you can think of, in your own words.',
      show: "Show me Olumi's now", after: "Olumi's stories are shown after yours, marked as Olumi's. Yours stay yours.",
      held_text: "Olumi's reply about how this could fail is shown once you have written your own reasons it could fail, or chosen to see Olumi's now.",
      max_reasons: 5, max_chars: 400, mine: [],
    }
    const asPerson = (id: string, name: string): View => ({ ...view(), you_id: id, you: name, chat: [], session: { ...offer.session, pre_mortem: gate } })
    const show = (v: View) => useViewStore.setState({ uuid, sid: 's_x', view: v, status: 'ready' })
    const panels = (v: View) => <><ViewsPanel sid="s_x" view={v} onWrote={async () => true} /><ViewChat /><ViewComposer /><ViewPreMortemKey /></>
    const openEntry = async () => {
      const button = screen.getByTestId('view-session-menu').querySelector('[data-method="figure_first"]')!
      expect(button.textContent).toBe('Let us give our figure first')
      await act(async () => { fireEvent.click(button) })
      expect(screen.getByTestId('view-figure-first-entry').querySelector('[data-ff="question"]')!.textContent).toBe(entry.question)
    }
    setTeamFetch((async (input, init) => {
      sent.push({ method: init?.method ?? 'GET', url: String(input), body: init?.body ? JSON.parse(String(init.body)) : undefined })
      if (String(input) === '/api/scenarios/s_x/strategy/vocabulary' && init?.method === 'GET') return new Response(JSON.stringify(VOCAB), { status: 200 })
      if (String(input) === '/api/me') return new Response(JSON.stringify({ me: { id: 'p_ada', name: 'Ada' } }), { status: 200 })
      if (String(input) === '/api/scenarios/s_x/figure-first' && init?.method === 'GET') return new Response(JSON.stringify(entry), { status: 200 })
      if (String(input) === '/api/scenarios/s_x/challenge' && init?.method === 'POST') return new Response(JSON.stringify({ error: refusal }), { status: 400 })
      if (String(input) === url && init?.method === 'POST') return new Response(JSON.stringify(reply), { status: 200 })
      throw new Error(`Unexpected request: ${String(input)}`)
    }) as typeof fetch)
    setPagePerson('p_ada')
    useMe.setState({ me: { id: 'p_ada', name: 'Ada' }, status: 'ready' })
    const adaView = asPerson('p_ada', 'Ada')
    show(adaView)
    useViewLens.setState({ lens: 'premortem' })
    supported() // ViewsPanel alone needs the debate capability that TeamTab normally reads.
    const ada = render(panels(adaView))
    // DL ruling 9 Nov: the view form opens on one box; the rest is behind "Add figures to your view".
    fireEvent.click(await screen.findByTestId('team-view-more'))
    fireEvent.change(await screen.findByTestId('team-view-about'), { target: { value: 'existing_capacity' } })
    fireEvent.change(screen.getByTestId('team-view-stance'), { target: { value: 'suspect' } })
    const privateTeamText = {
      'team-view-text': 'Ada alone: the plan depends on staffing',
      'team-view-missing': 'Ada alone: staff absence',
      'team-view-source': 'Ada alone: my confidential staffing report',
      'team-view-figure-existing_capacity': '10 to 20',
      'team-view-figure-per_specialist': '20 to 30',
      'team-view-figure-one_specialist': '1 to 2',
    }
    expect([...screen.getByTestId('team-views').querySelectorAll('textarea, input[type="text"]')].map((field) => field.getAttribute('data-testid')).sort())
      .toEqual(Object.keys(privateTeamText).sort())
    for (const [id, value] of Object.entries(privateTeamText)) {
      const field = screen.getByTestId(id) as HTMLInputElement | HTMLTextAreaElement
      expect(field.disabled).toBe(false)
      fireEvent.change(field, { target: { value } })
      expect(field.value).toBe(value)
    }
    fireEvent.click(screen.getByTestId('team-view-doubt-total_def|existing_capacity'))
    expect(draftOf('s_x:view')).toBe('Ada alone: the plan depends on staffing')
    fireEvent.change(screen.getByLabelText('Message Olumi'), { target: { value: chat } })
    await act(async () => { expect(await challenge('assumption', 'existing_capacity', chat)).toBe(false) })
    expect(screen.getByTestId('view-chat-said').textContent).toBe(refusal)
    expect(useViewChat.getState().held).toEqual({ text: chat, kind: 'assumption', record: 'existing_capacity', sid: 's_x', uuid })
    const opKey = `${uuid}\u0000challenge:assumption:existing_capacity\u0000${chat}`
    expect([...useViewChat.getState().ops.keys()]).toEqual([opKey])
    const op = useViewChat.getState().ops.get(opKey)
    expect(screen.getByTestId('view-premortem-entry').querySelector('[data-view="session.pre_mortem.question"]')!.textContent).toBe(gate.question)
    fireEvent.change(screen.getByTestId('view-premortem-reasons'), { target: { value: 'Ada alone: the hire never ramps up' } })
    await openEntry()
    fireEvent.change(screen.getByTestId('view-figure-first-typed'), { target: { value: '10 to 20' } })
    fireEvent.change(screen.getByTestId('view-figure-first-text'), { target: { value: 'Ada alone: my private estimate' } })
    expect({ chat: useViewChat.getState().text, preMortem: usePreMortemGate.getState().text, typed: useFigureFirst.getState().typed, text: useFigureFirst.getState().text })
      .toEqual({ chat, preMortem: 'Ada alone: the hire never ramps up', typed: '10 to 20', text: 'Ada alone: my private estimate' })
    ada.unmount()
    await act(async () => { await forget() })
    expect(sent).toEqual([
      { method: 'GET', url: '/api/scenarios/s_x/strategy/vocabulary', body: undefined },
      { method: 'GET', url: '/api/me', body: undefined },
      { method: 'POST', url: '/api/scenarios/s_x/challenge', body: { kind: 'assumption', record: 'existing_capacity', op } },
      { method: 'GET', url: '/api/scenarios/s_x/figure-first', body: undefined },
      { method: 'GET', url: '/api/me', body: undefined },
      { method: 'POST', url, body },
    ])
    const forgotten = { chat: useViewChat.getState(), preMortem: usePreMortemGate.getState(), figureFirst: useFigureFirst.getState() }
    setPagePerson('p_bob')
    useMe.setState({ me: { id: 'p_bob', name: 'Bob' }, status: 'ready' })
    const bobView = asPerson('p_bob', 'Bob')
    show(bobView)
    render(panels(bobView))
    // The form opens closed for Bob (nothing of Ada's is written in it); open it to check every field is empty.
    fireEvent.click(await screen.findByTestId('team-view-more'))
    const about = await screen.findByTestId('team-view-about') as HTMLSelectElement
    expect(about.value).toBe('')
    expect((screen.getByTestId('team-view-stance') as HTMLSelectElement).value).toBe('')
    // The source is conditional on a card: reopen it before checking that Ada's words are gone.
    fireEvent.change(about, { target: { value: 'existing_capacity' } })
    for (const id of Object.keys(privateTeamText)) {
      expect((screen.getByTestId(id) as HTMLInputElement | HTMLTextAreaElement).value).toBe('')
    }
    await openEntry()
    expect({
      stored: draftOf('s_x:view'),
      text: (screen.getByTestId('team-view-text') as HTMLTextAreaElement).value,
      missing: (screen.getByTestId('team-view-missing') as HTMLInputElement).value,
      link: (screen.getByTestId('team-view-doubt-total_def|existing_capacity') as HTMLInputElement).checked,
      chat: (screen.getByLabelText('Message Olumi') as HTMLTextAreaElement).value,
      preMortem: (screen.getByTestId('view-premortem-reasons') as HTMLTextAreaElement).value,
      figure: (screen.getByTestId('view-figure-first-typed') as HTMLInputElement).value,
      figureText: (screen.getByTestId('view-figure-first-text') as HTMLTextAreaElement).value,
      forgotten,
    }).toEqual({
      stored: undefined, text: '', missing: '', link: false, chat: '', preMortem: '', figure: '', figureText: '',
      forgotten: { chat: useViewChat.getInitialState(), preMortem: usePreMortemGate.getInitialState(), figureFirst: useFigureFirst.getInitialState() },
    })
    expect(network).not.toHaveBeenCalled()
  })

  it('sends a stance alone as { links: [], missing: null, stance }', async () => {
    const sent = serve(201, { doubt: 5 })
    render(<ViewDoubts sid="s_x" view={view()} disabled={false} />)
    await sendDoubts('s_x', 7, 'suspect')
    expect(sent.find((s) => s.method === 'POST')).toEqual({ method: 'POST', url: '/api/scenarios/s_x/views/7/doubts', body: { links: [], missing: null, stance: 'suspect' } })
  })

  it('draws a revealed view\'s stance as core\'s pill, verbatim, and no pill for a null or empty stance', () => {
    const shared = fx.collab.shared.slice(0, 3)
    expect(shared.length).toBeGreaterThanOrEqual(2)
    const stances = ['Knows from experience', null, '']
    const v = { ...fx, collab: { ...fx.collab, shared: shared.map((x, i) => ({ ...x, stance: stances[i] })) } } as unknown as View
    render(<ViewsPanel sid="s_x" view={v} onWrote={async () => true} />)
    expect(screen.getByTestId(`team-revealed-stance-${shared[0]!.id}`).textContent).toBe('Knows from experience')
    for (const x of shared.slice(1)) expect(screen.queryByTestId(`team-revealed-stance-${x.id}`)).toBeNull()
  })
})
