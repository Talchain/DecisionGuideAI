/**
 * ANSWERS AS CHOICES (V11 #5, DL 9 Nov; core wip/coach-choices `chat[].answer.next.choices`). Fixtures are core's own View v3 on its scripted
 * path (zero provider calls, core 84422840): `newest` (the coach asked "Is the backlog growing because more tickets arrive, or because each one
 * takes longer?" with three answers) and `after-unsure` (the person tapped "Not sure"; Olumi's next reply has none).
 * UI lane conditions (9 Nov): every word is core's; no chip preselected or highlighted; 'own' sends nothing; chips neutral, never blue.
 *  VC1 core's words in core's order, all the same neutral chip, none marked; VC2 an answer and "Not sure" go as ordinary replies with their
 *  label; VC3 "Something else" sends nothing and puts the person in the composer; VC4 none once Olumi has replied without any, and never on
 *  an older reply; VC5 held while a write is in flight, Olumi is answering, or a past version is shown.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import newest from '../fixtures/choices/newest.view3.json'
import afterUnsure from '../fixtures/choices/after-unsure.view3.json'
import type { View } from '../client'
import { ViewChat, ViewComposer, useViewChat } from '../ViewChat'
import { useViewStore } from '../store'
import { setPagePerson, setTeamFetch } from '../../olumiCore/team/api'
import { VIEW_CHIP_CLASS } from '../../v5/blocks/chipClass'

const NEWEST = newest as unknown as View, AFTER = afterUnsure as unknown as View
const SID = NEWEST.id
const CORE = NEWEST.chat.at(-1)!.answer!.next.choices!

let calls: Array<{ method: string; path: string; body: Record<string, unknown> | undefined }> = []
let served: View
beforeEach(() => {
  calls = []; served = NEWEST
  setTeamFetch((async (u: unknown, init?: RequestInit) => {
    const method = init?.method ?? 'GET', path = String(u)
    calls.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (path === '/api/me') return new Response(JSON.stringify({ me: { id: served.you_id, name: served.you } }), { status: 200 })
    if (method === 'POST') return new Response(JSON.stringify({ scenario: SID, job: { id: 9, kind: 'turn', status: 'running', words: null }, proposal: null, discussion: null, status_url: null }), { status: 202 })
    return new Response(JSON.stringify(served), { status: 200 })
  }) as unknown as typeof fetch)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-441113f79584', sid: SID, view: served, status: 'ready', error: null, stale: false, at: null })
})
afterEach(() => { cleanup(); setTeamFetch(null); setPagePerson(null); useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null, gone: null }) })
const posts = () => calls.filter((c) => c.method === 'POST')
const chips = () => screen.queryAllByTestId('view-chat-choice') as HTMLButtonElement[]

describe('VC1 the newest reply\'s answers as choices: core\'s words, in core\'s order, all alike', () => {
  it('draws core\'s answers then its two exits exactly as given, in order, with their kinds', () => {
    expect(CORE.map((c) => [c.label, c.kind])).toEqual([['More tickets', 'answer'], ['Each takes longer', 'answer'], ['Both', 'answer'], ['Something else', 'own'], ['Not sure', 'unsure']])
    render(<ViewChat />)
    expect(chips().map((b) => [b.textContent, b.dataset['kind']])).toEqual(CORE.map((c) => [c.label, c.kind]))
    expect(chips().map((b) => b.getAttribute('data-view'))).toEqual(CORE.map((_c, i) => `chat.${NEWEST.chat.length - 1}.answer.next.choices.${i}.label`))
  })
  it('none is preselected, highlighted or blue: every chip is the same neutral chip, enabled, unpressed', () => {
    render(<ViewChat />)
    const classes = new Set(chips().map((b) => b.className))
    expect(classes.size).toBe(1)
    const [only] = [...classes]
    expect(only!.startsWith(VIEW_CHIP_CLASS)).toBe(true)
    expect(only).not.toMatch(/\b(bg-primary|bg-info|text-info|border-info|text-text-on-color)\b/)
    for (const b of chips()) expect([b.disabled, b.getAttribute('aria-pressed'), b.getAttribute('aria-selected'), b.getAttribute('aria-current')]).toEqual([false, null, null, null])
    expect(chips().some((b) => b === document.activeElement)).toBe(false)
  })
})

describe('VC2 an answer, or "Not sure", is an ordinary reply with its label', () => {
  for (const label of ['Each takes longer', 'Not sure']) {
    it(`"${label}" posts a message with exactly those words, once`, async () => {
      render(<ViewChat />)
      await act(async () => { fireEvent.click(chips().find((b) => b.textContent === label)!) })
      await waitFor(() => expect(posts()).toHaveLength(1))
      expect(posts()[0]).toEqual({ method: 'POST', path: `/api/scenarios/${SID}/messages`, body: { text: label, op: expect.any(String) } })
      expect(useViewChat.getState().text).toBe('') // the composer is left as it was
    })
  }
})

describe('VC3 "Something else" sends nothing and puts the person in the composer', () => {
  it('no request; the composer has focus, with nothing typed for them', async () => {
    render(<><ViewChat /><ViewComposer /></>)
    await act(async () => { fireEvent.click(chips().find((b) => b.dataset['kind'] === 'own')!) })
    await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
    expect(posts()).toEqual([])
    expect(document.activeElement?.id).toBe('view-chat-text')
    expect(useViewChat.getState().text).toBe('')
  })
})

describe('VC4 only on the newest reply', () => {
  it('after "Not sure", Olumi\'s reply has none and the older reply\'s are gone (core\'s own View)', () => {
    served = AFTER; useViewStore.setState({ view: AFTER })
    expect(AFTER.chat.filter((t) => t.answer !== null && 'choices' in t.answer.next)).toEqual([])
    render(<ViewChat />)
    expect(screen.queryByTestId('view-chat-choices')).toBeNull()
  })
  it('an older reply is never offered as choices, even if a View carried them on it', () => {
    const older = AFTER.chat.length - 2
    const v = { ...AFTER, chat: AFTER.chat.map((t, i) => (i === older ? { ...t, answer: { ...t.answer!, next: { ...t.answer!.next, choices: CORE } } } : t)) } as View
    served = v; useViewStore.setState({ view: v })
    render(<ViewChat />)
    expect(screen.queryByTestId('view-chat-choices')).toBeNull()
  })
})

describe('VC5 held as the composer\'s Send is', () => {
  const held: [string, () => void][] = [
    ['a write in flight', () => useViewChat.setState({ busy: true })],
    ['Olumi answering', () => useViewStore.setState({ view: { ...NEWEST, turn: { ...(NEWEST.turn ?? {}), status: 'answering' } } as unknown as View })],
    ['a past version shown', () => useViewStore.setState({ at: 1 } as never)],
  ]
  for (const [why, set] of held) {
    it(`${why}: every chip disabled, and a tap sends nothing`, async () => {
      set()
      render(<ViewChat />)
      expect(chips().length).toBe(CORE.length)
      expect(chips().every((b) => b.disabled)).toBe(true)
      await act(async () => { fireEvent.click(chips()[0]!) })
      expect(posts()).toEqual([])
    })
  }
})
