/**
 * v10 design review items 6, 10, 11, 12 (17 Nov 2026), bound by test id and by core's own words read back from the View.
 * 6.  A reply's bookkeeping is ONE icon row: one "N on the canvas" chip, icon buttons whose words stay in the page, core's status line behind an icon.
 * 10. No strip above the thread; the popout lives in the composer's icon row; the thread's top edge fades.
 * 11. "Ask this again" on an unanswered floor entry and on an unanswered chat turn copies that message's words into the composer draft; sends nothing.
 * 12. "Record what you will do" is an icon in the panel's top row; "Use as my action" puts a kept idea's words verbatim into the first box.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { setTeamFetch } from '../../../../olumiCore/team/api'
import { resetDrafts } from '../../../../olumiCore/team/drafts'
import { useUIStore } from '../../../../stores/uiStore'
import type { View } from '../../../client'
import { useViewStore } from '../../../store'
import { ViewChat, ViewComposer, useViewChat } from '../../../ViewChat'
import { aboutCountWords } from '../AboutChip'

// Show in the workspace needs a canvas camera this scene has none of; the row's ORDER is what is bound here, so its control stands in as a button.
vi.mock('../../showInWorkspace/ShowInWorkspace', () => ({ ShowInWorkspace: () => <button type="button" data-testid="show-in-workspace-button">Show</button> }))

const session = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/session', `${n}.view3.json`), 'utf8'))
const q = (c: ParentNode, id: string) => c.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const qa = (c: ParentNode, id: string) => [...c.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)]
const press = (el: Element) => act(async () => { fireEvent.click(el); await new Promise((r) => setTimeout(r, 5)) })
let posts = 0
const mount = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null })
  return render(<><ViewChat /><ViewComposer /></>).container
}
beforeEach(() => { posts = 0; useUIStore.setState({ activeOutputTab: 'olumi' } as never); setTeamFetch((async (_u: string, init?: RequestInit) => { if (init?.method === 'POST') posts++; return new Response('{}', { status: 201 }) }) as unknown as typeof fetch) })
afterEach(() => {
  cleanup(); setTeamFetch(null); resetDrafts()
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null, at: null })
  useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null, gone: null })
})

// CHANGED BY DESIGN (17 Nov, the calm panel): the chip now reads "2 cards" (icon, count, hover list) and the version stamp sits in the same row (calmPanel.spec).
describe('6. reply bookkeeping is one icon row', () => {
  it('the newest reply draws one tools row holding ONE "N on the canvas" chip ; CONTRAST: no per-card chip', () => {
    const c = mount(session('after-find-first'))
    const latest = q(c, 'view-chat-latest')!
    const row = q(latest, 'view-reply-tools')!
    expect(row).not.toBeNull()
    const chips = qa(row, 'view-about-chip')
    expect(chips).toHaveLength(1)
    const n = (chips[0]!.dataset['cards'] ?? '').split(' ').length
    expect(chips[0]).toHaveTextContent(aboutCountWords(n))
    // The show control needs a canvas camera, which this scene has none of; where it is drawn it is in the row (its words are asserted by showInWorkspace.spec).
    const show = q(latest, 'show-in-workspace-button')
    if (show !== null) expect(row.contains(show)).toBe(true)
    expect(latest.textContent).not.toMatch(/About .* on the canvas/)
  })
  it('P4: the row runs cards, rests-on, Keep, then Show in the workspace, then the version (Keep before Show)', () => {
    const c = mount(session('after-find-first'))
    const row = q(q(c, 'view-chat-latest')!, 'view-reply-tools')!
    const at = (id: string) => [...row.querySelectorAll('[data-testid]')].findIndex((e) => e.getAttribute('data-testid') === id)
    const keep = at('view-keep-idea-button'), show = at('show-in-workspace-button'), version = at('view-chat-version')
    expect([keep, show, version].every((i) => i >= 0), 'all three are drawn in this fixture').toBe(true)
    expect(keep).toBeLessThan(show)
    expect(show).toBeLessThan(version)
  })
  it('core\'s "A next step" label is kept for readers but not drawn when the pointer line is the whole step', () => {
    const v = session('after-find-first')
    const c = mount(v)
    const label = q(c, 'view-chat-latest')!.querySelector('[data-view$=".answer.next.label"]')
    if (label !== null) expect(label.className).toContain('sr-only')
  })
})

describe('10. no strip above the thread; the popout sits in the composer row; no fade over the thread', () => {
  // CHANGED BY DESIGN (17 Nov, the calm panel): the thread's top fade existed to soften a proposal card pinned ABOVE the thread. The proposal is now one line
  // at the thread's foot, so nothing sticks above it and the fade (a clipped-looking edge Paul asked to lose) is gone. Reverting puts the fade back and fails this row.
  it('the popout is in the composer\'s icon row, not in the thread; the thread has no top fade', () => {
    const c = mount(session('after-find-first'))
    const pop = q(c, 'view-chat-popout')!
    expect(q(c, 'view-composer-actions')!.contains(pop)).toBe(true)
    expect(q(c, 'view-chat')!.contains(pop)).toBe(false)
    expect(q(c, 'view-chat-fade')).toBeNull()
  })
})

describe('11. "Ask this again" copies the words into the composer and sends nothing', () => {
  const floorOf = (said: string, job: number) => ({ job, at: '2026-11-17T10:00:00Z', by: 'Ben', by_id: 'x', said, text: '', unanswered: { status: 'failed', words: 'Olumi could not answer this time.' } })
  it('an unanswered floor entry: pressing it puts that message\'s words in the box; CONTRAST: an answered entry has none; nothing was sent', async () => {
    const v = { ...session('after-find-first'), floor: [floorOf('Could the second workshop share the van?', 11), { ...floorOf('How many repairs a week?', 12), text: 'About forty.', unanswered: undefined, prose: ['About forty.'] }] } as unknown as View
    const c = mount(v)
    const turns = qa(c, 'view-floor-turn')
    const failed = turns.find((t) => t.getAttribute('data-floor-job') === '11')!, answered = turns.find((t) => t.getAttribute('data-floor-job') === '12')
    expect(qa(failed, 'view-ask-again')).toHaveLength(1)
    if (answered !== undefined) expect(qa(answered, 'view-ask-again')).toHaveLength(0)
    await press(q(failed, 'view-ask-again')!)
    expect((c.querySelector('#view-chat-text') as HTMLTextAreaElement).value).toBe('Could the second workshop share the van?')
    expect(posts).toBe(0)
  })
  it('an unanswered chat turn with core\'s failure: the same; a draft already typed is kept, the words follow it', async () => {
    const v = session('after-find-first')
    const failed = { ...v.chat[0]!, id: 999, said: 'What if the rent doubles?', answer: null, problem: 'Olumi could not finish this turn. Please try again in a moment.' } as unknown as View['chat'][number]
    const c = mount({ ...v, chat: [failed, ...v.chat] })
    const btn = qa(c, 'view-ask-again')
    expect(btn).toHaveLength(1)
    useViewChat.setState({ text: 'My own draft' })
    await press(btn[0]!)
    expect((c.querySelector('#view-chat-text') as HTMLTextAreaElement).value).toBe('My own draft\n\nWhat if the rent doubles?')
    expect(posts).toBe(0)
  })
})

describe('12. committing is a step: an icon in the panel\'s top row, and "Use as my action"', () => {
  it('P5: the panel\'s top row holds a "Record what you will do" icon (its words are the hover and name); pressing opens the form blank, and nothing is sent', async () => {
    const c = mount(session('after-find-first'))
    const row = q(c, 'view-chat-top-row')!
    const b = q(row, 'view-next-record')!
    expect(b.getAttribute('aria-label')).toBe('Record what you will do')
    expect(b.hasAttribute('title'), 'no native title: the hover is the one Tip').toBe(false)
    // pointer: the Tip opens after its rest; keyboard: it opens on focus, so the words are reachable without a mouse
    fireEvent.pointerEnter(b)
    await waitFor(() => expect(document.querySelector('[role="tooltip"]')?.textContent).toBe('Record what you will do'))
    fireEvent.pointerLeave(b)
    await waitFor(() => expect(document.querySelector('[role="tooltip"]')).toBeNull())
    act(() => { b.focus() })
    await waitFor(() => expect(document.querySelector('[role="tooltip"]')?.textContent).toBe('Record what you will do'))
    act(() => { b.blur() })
    expect(b.querySelector('svg'), 'an icon, no visible words').not.toBeNull()
    expect(b.textContent).toBe('')
    expect(q(c, 'view-next-step')).toBeNull() // it is no longer the Next step card's button
    expect(q(c, 'commit-form-action')).toBeNull()
    await press(b)
    expect((q(c, 'commit-form-action') as HTMLTextAreaElement).value).toBe('')
    expect((q(c, 'commit-form-expect') as HTMLTextAreaElement).value).toBe('')
    expect(posts).toBe(0)
  })
  it('a kept idea\'s "Use as my action" puts its words verbatim in the first box as the person\'s draft, editable; expectation and reconsider stay blank', async () => {
    const v = { ...session('after-find-first'), kept: [{ id: 7, text: 'Keep a tally by the door for four Sundays.', turn: 1, by: 'olumi', kept_by: { id: 'me', name: 'Me' } }] } as unknown as View
    const c = mount(v)
    const use = q(c, 'view-kept-idea-use')
    expect(use).not.toBeNull()
    await press(use!)
    const action = q(c, 'commit-form-action') as HTMLTextAreaElement
    expect(action.value).toBe('Keep a tally by the door for four Sundays.')
    expect(q(c, 'commit-form-yours')).not.toBeNull()
    expect((q(c, 'commit-form-expect') as HTMLTextAreaElement).value).toBe('')
    expect((q(c, 'commit-form-reconsider') as HTMLTextAreaElement).value).toBe('')
    fireEvent.change(action, { target: { value: 'Keep a tally for two Sundays.' } })
    expect(action.value).toBe('Keep a tally for two Sundays.')
    expect(posts).toBe(0)
  })
})
