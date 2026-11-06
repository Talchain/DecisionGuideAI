/**
 * "Write mine first" as core now gates it (core 2.x R19, `session.pre_mortem`; API.md v1.21): per member and typed. While `state` is 'closed' the key
 * draws core's entry: its question, a box for the person's own reasons, "Show me Olumi's now" and its note. Sending posts their reasons
 * (`POST …/pre-mortem { reasons }`, one per line, 1 to 5) or the choice (`POST …/pre-mortem/show {}`); the View is read again and the stories open.
 * A tap on the pre-mortem move while the gate is closed is core's 409 with its sentence: it opens this entry instead. Core's words below are
 * premortem.ts WORDS, verbatim. Bound by identity: the request path and body, the exact words, the lens.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { setTeamFetch } from '../../olumiCore/team/api'
import type { View, ViewCard } from '../client'
import { useViewStore } from '../store'
import { askMethod, useViewChat } from '../ViewChat'
import { usePreMortemGate, useViewLens } from '../lens'
import { ViewPreMortemKey } from '../ViewPreMortemKey'

const proposal = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/proposal.view.json'), 'utf8')) as View
const WORDS = {
  heading: 'If it failed: your reasons first',
  gate: "Write your own reasons it could fail first; Olumi's stories show after yours.",
  question: 'Imagine it is a year from now and this has failed. What went wrong? Write each reason you can think of, in your own words.',
  show: "Show me Olumi's now",
  after: "Olumi's stories are shown after yours, marked as Olumi's. Yours stay yours.",
  held: "Olumi's reply about how this could fail is shown once you have written your own reasons it could fail, or chosen to see Olumi's now.",
}
const S1 = 'The new specialist could take longer to reach full speed than the model allows.'
const OLUMI = { glyph: '◆', title: 'Olumi proposed this; check it' }
const gate = (state: 'closed' | 'wrote' | 'chose', held = false, mine: { id: number; at: string; reasons: string[] }[] = []) => ({
  state, held, heading: WORDS.heading, gate: WORDS.gate, question: WORDS.question, show: WORDS.show, after: WORDS.after, held_text: WORDS.held, max_reasons: 5, max_chars: 400, mine,
})
/** What core serves: with the gate closed the cards carry no story; once open they do. */
const viewIn = (state: 'closed' | 'wrote' | 'chose', held = false): View => ({
  ...proposal,
  session: { ...proposal.session, pre_mortem: gate(state, held, state === 'wrote' ? [{ id: 7, at: '2026-11-06T17:00:00.000Z', reasons: ['The hire never ramps up.'] }] : []) },
  model: { ...proposal.model!, cards: proposal.model!.cards.map((c) => (state !== 'closed' && c.id === 'per_specialist' ? { ...c, failed: [{ n: 1, title: S1, olumi: OLUMI }] } : c)) as ViewCard[] },
})

const SID = 's_pm_gate_01'
let UUID = '', row = 0
let posts: { url: string; body: unknown }[] = []
/** Core on the wire: each POST is recorded and answered by `respond`; a View read answers the current `next()`. */
function core(next: () => View, respond: (url: string) => Response = () => new Response('{}', { status: 201 })) {
  setTeamFetch((async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') { posts.push({ url, body: JSON.parse(String(init.body)) }); return respond(url) }
    return new Response(JSON.stringify(next()), { status: 200 })
  }) as unknown as typeof fetch)
}
const show = (v: View) => { useViewStore.setState({ uuid: UUID, sid: SID, view: v, error: null, status: 'ready', stale: false, at: null }); useViewLens.setState({ lens: 'premortem' }) }
const q = (c: ParentNode, s: string) => c.querySelector<HTMLElement>(s)
const click = (el: Element) => act(async () => { fireEvent.click(el) })

beforeEach(() => { posts = []; UUID = `00000000-0000-4000-8000-0000000000${String(++row).padStart(2, '0')}`; usePreMortemGate.setState({ text: '', said: null }) })
afterEach(() => {
  cleanup(); setTeamFetch(null)
  useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none', stale: false, at: null })
  useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null, gone: null })
  useViewLens.setState({ lens: 'full' })
})

describe('the entry while the gate is closed: core\'s words, nothing of Olumi\'s stories', () => {
  it('catch: core\'s heading, question, box, "Show me Olumi\'s now" and note are drawn; no story word, no "Write mine first" press', () => {
    core(() => viewIn('closed')); show(viewIn('closed'))
    const c = render(<ViewPreMortemKey />).container
    expect(q(c, '[data-view="session.pre_mortem.heading"]')!.textContent).toBe(WORDS.heading)
    expect(q(c, '[data-view="session.pre_mortem.question"]')!.textContent).toBe(WORDS.question)
    expect(q(c, '[data-view="session.pre_mortem.show"]')!.textContent).toBe(WORDS.show)
    expect(q(c, '[data-view="session.pre_mortem.after"]')!.textContent).toBe(WORDS.after)
    expect(q(c, '[data-testid="view-premortem-reasons"]')).not.toBeNull()
    expect(c.textContent).not.toContain(S1)
    expect(q(c, '[data-testid="view-premortem-write-mine"]')).toBeNull()
    expect(q(c, '[data-testid="view-premortem-gate"]')).toBeNull()               // nothing is being withheld, so no gate note
  })
  it('catch: while a reply is being withheld (`held`) core\'s gate sentence is drawn, once', () => {
    show(viewIn('closed', true))
    const c = render(<ViewPreMortemKey />).container
    expect(q(c, '[data-testid="view-premortem-gate"]')!.textContent).toBe(WORDS.gate)
    expect(c.textContent!.split(WORDS.gate).length - 1).toBe(1)
  })
})

describe('writing their own reasons, and asking for Olumi\'s now', () => {
  it('catch: send posts exactly `{ reasons }`, one per non-empty line, to …/pre-mortem; then the View is read again and Olumi\'s stories show, the entry gone and the box cleared', async () => {
    let state: 'closed' | 'wrote' = 'closed'
    core(() => viewIn(state), (url) => { if (url.endsWith('/pre-mortem')) state = 'wrote'; return new Response('{"pre_mortem":7,"state":"wrote"}', { status: 201 }) })
    show(viewIn('closed'))
    const c = render(<ViewPreMortemKey />).container
    fireEvent.change(q(c, '[data-testid="view-premortem-reasons"]')!, { target: { value: 'The hire never ramps up.\n\n  The backlog grows faster.  \n' } })
    await click(q(c, '[data-testid="view-premortem-send"]')!)
    await waitFor(() => expect(q(c, '[data-testid="view-premortem-stories"]')).not.toBeNull())
    expect(posts).toEqual([{ url: `/api/scenarios/${SID}/pre-mortem`, body: { reasons: ['The hire never ramps up.', 'The backlog grows faster.'] } }])
    expect(q(c, '[data-testid="view-premortem-entry"]')).toBeNull()
    expect(q(c, '[data-testid="view-premortem-story-text"]')!.textContent).toBe(S1)
    expect(usePreMortemGate.getState().text).toBe('')
  })
  it('catch: "Show me Olumi\'s now" posts `{}` to …/pre-mortem/show and writes no reasons; the stories then show', async () => {
    let state: 'closed' | 'chose' = 'closed'
    core(() => viewIn(state), (url) => { if (url.endsWith('/pre-mortem/show')) state = 'chose'; return new Response('{"state":"chose"}', { status: 200 }) })
    show(viewIn('closed'))
    const c = render(<ViewPreMortemKey />).container
    await click(q(c, '[data-testid="view-premortem-show"]')!)
    await waitFor(() => expect(q(c, '[data-testid="view-premortem-stories"]')).not.toBeNull())
    expect(posts).toEqual([{ url: `/api/scenarios/${SID}/pre-mortem/show`, body: {} }])
  })
  it('negative: nothing to send while the box is empty; a reason core refuses is said in its own words in the entry and the box keeps what was typed', async () => {
    core(() => viewIn('closed'), () => new Response(JSON.stringify({ error: 'each reason is at most 400 characters' }), { status: 400 }))
    show(viewIn('closed'))
    const c = render(<ViewPreMortemKey />).container
    expect((q(c, '[data-testid="view-premortem-send"]') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(q(c, '[data-testid="view-premortem-reasons"]')!, { target: { value: 'too long' } })
    await click(q(c, '[data-testid="view-premortem-send"]')!)
    await waitFor(() => expect(q(c, '[data-testid="view-premortem-said"]')!.textContent).toBe('each reason is at most 400 characters'))
    expect((q(c, '[data-testid="view-premortem-reasons"]') as HTMLTextAreaElement).value).toBe('too long')
    expect(q(c, '[data-testid="view-premortem-stories"]')).toBeNull()
  })
  it('an open gate shows no entry: after they wrote, and after they chose, with or without stories', () => {
    for (const state of ['wrote', 'chose'] as const) {
      show(viewIn(state)); const c = render(<ViewPreMortemKey />).container
      expect(q(c, '[data-testid="view-premortem-entry"]')).toBeNull()
      expect(q(c, '[data-testid="view-premortem-stories"]')).not.toBeNull(); cleanup()
    }
  })
})

describe('a tap on the pre-mortem move while the gate is closed opens the entry (core\'s 409 with its sentence, no AI call)', () => {
  it('catch: the menu press (…/method) refused with 409 puts the lens on, the entry shows, and the composer says nothing', async () => {
    core(() => viewIn('closed'), () => new Response(JSON.stringify({ error: WORDS.gate }), { status: 409 }))
    show(viewIn('closed')); useViewLens.setState({ lens: 'full' })
    expect(await act(async () => askMethod('pre_mortem'))).toBe(false)
    expect(posts.map((p) => p.url)).toEqual([`/api/scenarios/${SID}/method`])
    expect(useViewLens.getState().lens).toBe('premortem')
    expect(useViewChat.getState().said).toBeNull()
    const c = render(<ViewPreMortemKey />).container
    expect(q(c, '[data-view="session.pre_mortem.question"]')!.textContent).toBe(WORDS.question)
  })
  it('contrast: a 409 on any other method does not open it, and says core\'s words in the composer as before', async () => {
    core(() => viewIn('closed'), () => new Response(JSON.stringify({ error: 'not now' }), { status: 409 }))
    show(viewIn('closed')); useViewLens.setState({ lens: 'full' })
    await act(async () => { await askMethod('go_wrong') })
    expect(useViewLens.getState().lens).toBe('full')
    expect(useViewChat.getState().said).toBe('not now')
  })
  it('contrast: a 409 for a gate that has opened since (another tab) does not open the entry: the View read again shows the stories', async () => {
    core(() => viewIn('wrote'), () => new Response(JSON.stringify({ error: WORDS.gate }), { status: 409 }))
    show(viewIn('closed')); useViewLens.setState({ lens: 'full' })
    await act(async () => { await askMethod('pre_mortem') })
    expect(useViewLens.getState().lens).toBe('full')
    expect(useViewStore.getState().view!.session.pre_mortem!.state).toBe('wrote')
  })
})
