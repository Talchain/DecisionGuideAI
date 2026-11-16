/**
 * What a person reads to approve (core `proposal.to_read`, additive, 16 Nov; olumi-core src/view/changes.ts ToRead, schema.ts ProposalV3):
 * the lines to read one by one, then the person's own points the proposal only notes, counted in ONE line of core's words that opens to
 * every one of them. Live round 1: the thing to approve was 19 lines, 14 of them the person's own sentences. Nothing leaves the list: the
 * same lines, the same ticks by the same ids, the same approval bodies. Absent (an older core, a gated viewer): the whole list, as before.
 *
 * Every row binds a line by its own id (`data-change`), never by its place or by words another line could carry. The Views are the repo's
 * golden proposal with lines added here to core's schema: `to_read` is not core's own output (wire rung UNVERIFIED).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useUIStore } from '../../stores/uiStore'
import { ViewChat, useViewChat } from '../ViewChat'
import { setTeamFetch } from '../../olumiCore/team/api'
import { setOpen } from './reviewRow'

const golden: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'proposal.view.json'), 'utf8'))
const p = golden.proposal!
type Change = (typeof p.changes)[number]
type ToRead = { lines: number[]; groups: { heading: string; lines: number[] }[] | null; noted: { text: string; lines: number[] } | null }

const line = (id: string, text: string, olumi: boolean): Change => ({ ...p.changes[0]!, id, text, detail: '', family: olumi ? 'option' : 'claim', olumi: olumi ? { glyph: '◆', title: 'Proposed by Olumi' } : null, together: null })
const olumis = (n: number): Change[] => Array.from({ length: n }, (_, i) => line(`o_${i + 1}`, `+ option: route ${i + 1}`, true))
const theirs = (n: number): Change[] => Array.from({ length: n }, (_, i) => line(`s_${i + 1}`, `+ claim: point ${i + 1}`, false))
/** A View holding these lines, with `to_read` as given (undefined: the key is absent, as from a core built before it). */
const viewOf = (changes: Change[], groups: { heading: string; lines: number[] }[] | null, to_read?: ToRead): View =>
  ({ ...golden, proposal: { ...p, changes, groups, ...(to_read === undefined ? {} : { to_read }) } }) as View
const idx = (changes: Change[], ids: string[]) => ids.map((id) => changes.findIndex((c) => c.id === id))

// Six lines (flat in core's whole list): two of Olumi's, then four of the person's own, one of Olumi's between them so the two sets interleave.
const six = [...olumis(1), ...theirs(2), line('o_mid', '+ assumption: what the dread is about', true), ...theirs(4).slice(2)]
const sixRead = ['o_1', 'o_mid'], sixNoted = ['s_1', 's_2', 's_3', 's_4']
// Core's words, verbatim: the count in them is NOT the number of noted lines here, so a screen that counted for itself would say "4".
const NOTED_WORDS = '14 of your own points noted'
const sixView = (extra: Partial<ToRead> = {}) => viewOf(six, null, { lines: idx(six, sixRead), groups: null, noted: { text: NOTED_WORDS, lines: idx(six, sixNoted) }, ...extra })

let posts: Array<{ path: string; body: unknown }> = []
const show = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false })
  const c = render(<ViewChat />).container
  // Contract 3: the proposal is drawn only once the person opens the one-row review; closed, every line is hidden and nothing here would bind.
  setOpen(screen.getByTestId('view-proposal-review'), true)
  return c
}
const at = (c: HTMLElement, id: string) => c.querySelector<HTMLElement>(`[data-change="rec:${id}"]`)
const tickOf = (c: HTMLElement, id: string) => at(c, id)!.querySelector<HTMLInputElement>('input[type="checkbox"]')!
const noted = (c: HTMLElement) => c.querySelector<HTMLDetailsElement>('[data-testid="view-changes-noted"]')
/** The ids of the lines drawn, in the order drawn. */
const drawn = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('[data-testid="view-changes"] [data-change]')].map((e) => e.getAttribute('data-change'))

beforeEach(() => {
  posts = []
  useUIStore.setState({ activeOutputTab: 'olumi' } as never)
  setTeamFetch((async (u: unknown, init?: RequestInit) => {
    if ((init?.method ?? 'GET') === 'POST') { posts.push({ path: String(u), body: JSON.parse(String(init!.body)) }); return new Response('{"version":9,"n":2,"receipt":"r"}', { status: 201 }) }
    return new Response(JSON.stringify(golden), { status: 200 })
  }) as unknown as typeof fetch)
})
afterEach(() => { cleanup(); setTeamFetch(null); useViewChat.setState({ busy: false, said: null }); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null }) })

describe('to_read present: the lines to read, then the person\'s own points in one line', () => {
  it('each line to read is in view, no noted line is, and core\'s one counted line is, once, in core\'s words', () => {
    const c = show(sixView())
    for (const id of sixRead) expect(at(c, id), id).toBeVisible()
    for (const id of sixNoted) { expect(at(c, id), `${id} is still in the list`).not.toBeNull(); expect(at(c, id), id).not.toBeVisible() }
    const said = c.querySelectorAll('[data-view="proposal.to_read.noted.text"]')
    expect(said).toHaveLength(1)
    expect(said[0]).toBeVisible()
    expect(said[0]!.textContent).toBe(NOTED_WORDS)
    // The lines to read come first, in core's order; the one counted line is the list's last item, inside the same list.
    const list = screen.getByTestId('view-changes')
    expect([...list.children].slice(0, sixRead.length).map((li) => li.getAttribute('data-change'))).toEqual(sixRead.map((id) => `rec:${id}`))
    expect(list.lastElementChild!.contains(noted(c))).toBe(true)
  })

  it('the counted line is a closed disclosure the keyboard reaches; opened, it shows every noted line with its own tick, and none is lost', () => {
    const c = show(sixView())
    const box = noted(c)!
    expect(box.tagName).toBe('DETAILS')
    expect(box.open).toBe(false)
    const summary = box.querySelector(':scope > summary')!
    expect(summary.contains(c.querySelector('[data-view="proposal.to_read.noted.text"]'))).toBe(true)
    expect(summary.getAttribute('tabindex')).toBeNull()
    box.open = true
    for (const id of sixNoted) { expect(at(c, id), id).toBeVisible(); expect(box.contains(at(c, id))).toBe(true); expect(tickOf(c, id)).toBeVisible() }
    // Every line of the proposal is drawn exactly once: the read lines, then the noted ones, each in core's order.
    expect(drawn(c)).toEqual([...sixRead, ...sixNoted].map((id) => `rec:${id}`))
  })

  it('Approve ticked sends the same ids as before: a read line and a noted line by their own ids, in core\'s order; Approve is still `base` alone', async () => {
    const c = show(sixView())
    noted(c)!.open = true
    fireEvent.click(tickOf(c, 'o_mid'))
    fireEvent.click(tickOf(c, 's_2'))
    expect(screen.getByTestId('view-approve-ticked')).toHaveTextContent('Approve ticked · 2')
    fireEvent.click(screen.getByTestId('view-approve-ticked'))
    await waitFor(() => expect(posts).toHaveLength(1))
    // `s_2` comes before `o_mid` in core's `changes`, though it is drawn after it.
    expect(posts[0]).toEqual({ path: `/api/proposals/${p.id}/approve`, body: { base: p.base, only: ['s_2', 'o_mid'], only_top: [] } })
    cleanup(); posts = []
    show(sixView())
    fireEvent.click(screen.getByTestId('view-approve'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toEqual({ path: `/api/proposals/${p.id}/approve`, body: { base: p.base } })
  })

  it('each line keeps the tick it had by its place in core\'s list (`view-change-tick-<index in changes>`), wherever it is drawn', () => {
    const c = show(sixView())
    for (const ch of six) expect(tickOf(c, ch.id).getAttribute('data-testid')).toBe(`view-change-tick-${six.indexOf(ch)}`)
  })

  it('the counted line\'s own tick chooses every noted line and no other, without opening it', async () => {
    const c = show(sixView())
    fireEvent.click(screen.getByTestId('view-changes-noted-tick'))
    expect(noted(c)!.open).toBe(false)
    for (const id of sixNoted) expect(tickOf(c, id).checked, id).toBe(true)
    for (const id of sixRead) expect(tickOf(c, id).checked, id).toBe(false)
    fireEvent.click(screen.getByTestId('view-approve-ticked'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]!.body).toEqual({ base: p.base, only: sixNoted, only_top: [] })
  })

  it('the live shape (19 lines, core\'s whole list grouped, 5 left to read): drawn flat under no heading, as `to_read.groups` is null', () => {
    const changes = [...olumis(5), ...theirs(14)]
    const whole = [{ heading: 'Options · 5 · 5 Olumi\'s', lines: [0, 1, 2, 3, 4] }, { heading: 'Reasoning records · 14 · 14 theirs', lines: changes.slice(5).map((_, i) => i + 5) }]
    const c = show(viewOf(changes, whole, { lines: [0, 1, 2, 3, 4], groups: null, noted: { text: NOTED_WORDS, lines: whole[1]!.lines } }))
    expect(c.querySelector('[data-testid^="view-change-group-box-"]')).toBeNull()
    for (const g of whole) expect(screen.queryByText(g.heading)).toBeNull()
    for (const ch of changes.slice(0, 5)) expect(at(c, ch.id), ch.id).toBeVisible()
    for (const ch of changes.slice(5)) expect(at(c, ch.id), ch.id).not.toBeVisible()
    expect(c.querySelector('[data-view="proposal.to_read.noted.text"]')!.textContent).toBe(NOTED_WORDS)
    expect(drawn(c)).toHaveLength(19)
  })

  it('over 12 left to read: under `to_read.groups` headings, core\'s words, never the whole list\'s headings; the counted line follows them', () => {
    const changes = [...olumis(13), ...theirs(2)]
    const whole = [{ heading: 'WHOLE LIST · 15', lines: changes.map((_, i) => i) }]
    const groups = [{ heading: 'Options · 7 · 7 Olumi\'s', lines: [0, 1, 2, 3, 4, 5, 6] }, { heading: 'Figures · 6 · 6 Olumi\'s', lines: [7, 8, 9, 10, 11, 12] }]
    const c = show(viewOf(changes, whole, { lines: changes.slice(0, 13).map((_, i) => i), groups, noted: { text: '2 of your own points noted', lines: [13, 14] } }))
    expect(screen.queryByText('WHOLE LIST · 15')).toBeNull()
    groups.forEach((g, gi) => {
      expect(c.querySelector(`[data-view="proposal.to_read.groups.${gi}.heading"]`)!.textContent).toBe(g.heading)
      const box = screen.getByTestId(`view-change-group-box-${gi}`)
      for (const i of g.lines) expect(box.contains(at(c, changes[i]!.id)), changes[i]!.id).toBe(true)
    })
    expect(noted(c)!.contains(at(c, 's_1'))).toBe(true)
    expect(noted(c)!.contains(at(c, 's_2'))).toBe(true)
    expect(at(c, 's_1')).not.toBeVisible()
    expect(c.querySelector('[data-view="proposal.to_read.noted.text"]')!.textContent).toBe('2 of your own points noted')
    expect(drawn(c)).toHaveLength(15)
  })

  it('nothing noted (`noted` null): the lines to read and no counted line', () => {
    const c = show(viewOf(six, null, { lines: six.map((_, i) => i), groups: null, noted: null }))
    expect(noted(c)).toBeNull()
    expect(drawn(c)).toEqual(six.map((ch) => `rec:${ch.id}`))
    for (const ch of six) expect(at(c, ch.id), ch.id).toBeVisible()
  })
})

describe('to_read absent, or not the whole list: exactly the list as before', () => {
  const whole = (c: HTMLElement) => {
    expect(noted(c)).toBeNull()
    expect(c.querySelector('[data-view^="proposal.to_read"]')).toBeNull()
    expect([...screen.getByTestId('view-changes').children].map((li) => li.getAttribute('data-change'))).toEqual(six.map((ch) => `rec:${ch.id}`))
    for (const ch of six) expect(at(c, ch.id), ch.id).toBeVisible()
  }
  it('absent: every line, in core\'s order, each a direct item of the list, and no counted line', () => whole(show(viewOf(six, null))))

  it('a `to_read` that leaves a line out, names one twice or names one that is not there is not drawn from: every line is shown, so none is lost', () => {
    const missing = sixView({ noted: { text: NOTED_WORDS, lines: idx(six, ['s_1', 's_2', 's_3']) } })
    const twice = sixView({ lines: idx(six, ['o_1', 'o_mid', 's_1']) })
    const beyond = sixView({ lines: [...idx(six, sixRead), 6] })
    for (const v of [missing, twice, beyond]) { whole(show(v)); cleanup() }
  })
})
