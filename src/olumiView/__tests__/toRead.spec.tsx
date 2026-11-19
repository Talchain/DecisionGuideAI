/**
 * The review reads core's `proposal.to_read` (olumi.view/3, additive 16 Nov; core src/view/changes.ts ToRead; test 019: "the 32-change review
 * makes finding the decisive changes laborious"). Where core sends it, the list is core's `lines` (or its `groups`) in core's order, and the person's
 * own points the proposal only notes are core's ONE sentence, folded until Show all. Ticks and approve keep the same ids: approve takes the whole
 * `changes`. Absent (an older core, a gated viewer), or not a whole split of `changes`, today's list is drawn.
 * Identity only: every line is bound by its index into `changes` (`data-view="proposal.changes.N.text"`), never by its words.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useUIStore } from '../../stores/uiStore'
import { NOTED_SHOW_ALL, NOTED_SHOW_FEWER, ViewChat, useViewChat } from '../ViewChat'
import { setTeamFetch } from '../../olumiCore/team/api'
import { setOpen } from './reviewRow'

const golden: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'proposal.view.json'), 'utf8'))
const p = golden.proposal!
type P = NonNullable<View['proposal']>
type C = P['changes'][number]
// Three lines: two of Olumi's changes and one of the person's own points (index 1). No `together` / `needs`, so each tick is its own line.
const changes: C[] = [p.changes[0]!, { ...p.changes[0]!, id: 'rec-noted-1', text: 'noted point', detail: '' }, p.changes[1]!]
const NOTED = 'a sentence core wrote'
const toRead = (t: unknown): View => ({ ...golden, proposal: { ...p, changes, groups: null, to_read: t } as unknown as P })
const withNoted = toRead({ lines: [2, 0], groups: null, noted: { text: NOTED, lines: [1] } })

let posts: Array<{ path: string; body: unknown }> = []
const showOpen = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false })
  const c = render(<ViewChat />).container
  const r = c.querySelector('[data-testid="view-proposal-review"]')
  if (r !== null) setOpen(r, true)
  return c
}
/** The change lines drawn, by their index into `changes`, in the order they are on the page. */
const drawn = (c: HTMLElement) => Array.from(c.querySelectorAll('[data-view^="proposal.changes."][data-view$=".text"]')).map((e) => Number(e.getAttribute('data-view')!.split('.')[2]))
beforeEach(() => {
  posts = []
  useUIStore.setState({ activeOutputTab: 'olumi' } as never)
  setTeamFetch((async (u: unknown, init?: RequestInit) => {
    if ((init?.method ?? 'GET') === 'POST') { posts.push({ path: String(u), body: JSON.parse(String(init!.body)) }); return new Response('{"version":9,"n":2,"receipt":"r"}', { status: 201 }) }
    return new Response(JSON.stringify(golden), { status: 200 })
  }) as unknown as typeof fetch)
})
afterEach(() => { cleanup(); setTeamFetch(null); useViewChat.setState({ busy: false, said: null }); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null }) })

describe('the review reads core\'s to_read', () => {
  it('core\'s lines in core\'s order; the noted points are core\'s one sentence, their lines folded until Show all, which opens them and folds them again', () => {
    const c = showOpen(withNoted)
    expect(drawn(c), 'core\'s `lines`, in its order; the noted line folded').toEqual([2, 0])
    expect(c.querySelector('[data-view="proposal.to_read.noted.text"]')?.textContent).toBe(NOTED)
    const more = screen.getByTestId('view-noted-show-all')
    expect(more).toHaveTextContent(NOTED_SHOW_ALL)
    expect(more).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(more)
    expect(drawn(c), 'Show all opens the noted lines, after core\'s lines').toEqual([2, 0, 1])
    expect(screen.getByTestId('view-noted-show-all')).toHaveTextContent(NOTED_SHOW_FEWER)
    expect(screen.getByTestId('view-noted-show-all')).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByTestId('view-noted-show-all'))
    expect(drawn(c)).toEqual([2, 0])
  })

  it('core\'s groups (where over 12 remain) are drawn from to_read, not proposal.groups; the noted line is still folded', () => {
    const c = showOpen({ ...toRead({ lines: [2, 0], groups: [{ heading: 'TR heading', lines: [2, 0] }], noted: { text: NOTED, lines: [1] } }), })
    expect(c.querySelector('[data-view="proposal.to_read.groups.0.heading"]')?.textContent).toBe('TR heading')
    expect(c.querySelector('[data-view^="proposal.groups."]'), 'proposal.groups is not drawn where to_read is').toBeNull()
    fireEvent.click(c.querySelector('[data-testid="view-change-group-box-0"] summary')!)
    expect(drawn(c)).toEqual([2, 0])
  })

  it('approve keeps the same ids: Approve is the whole proposal (`base` alone), noted lines included; Approve ticked sends every id ticked, a noted one too, in core\'s order', async () => {
    showOpen(withNoted)
    fireEvent.click(screen.getByTestId('view-approve'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toEqual({ path: `/api/proposals/${p.id}/approve`, body: { base: p.base } })
    cleanup(); posts = []
    showOpen(withNoted)
    fireEvent.click(screen.getByTestId('view-noted-show-all'))
    fireEvent.click(screen.getByTestId('view-change-tick-1'))
    fireEvent.click(screen.getByTestId('view-change-tick-2'))
    fireEvent.click(screen.getByTestId('view-approve-ticked'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]!.body).toEqual({ base: p.base, only: [changes[1]!.id, changes[2]!.id], only_top: [] })
  })

  it('a ticked noted line is never folded out of sight: the fold stays open and offers no fold while one of its lines is ticked', () => {
    const c = showOpen(withNoted)
    fireEvent.click(screen.getByTestId('view-noted-show-all'))
    fireEvent.click(screen.getByTestId('view-change-tick-1'))
    expect(screen.queryByTestId('view-noted-show-all'), 'no fold while a noted line is chosen').toBeNull()
    expect(drawn(c)).toEqual([2, 0, 1])
    fireEvent.click(screen.getByTestId('view-change-tick-1'))
    expect(screen.getByTestId('view-noted-show-all')).toHaveAttribute('aria-expanded', 'true')
  })

  it('absent to_read (an older core, a gated viewer) gives today\'s list: every change in index order, no noted sentence, no Show all', () => {
    const c = showOpen({ ...golden, proposal: { ...p, changes, groups: null } })
    expect(drawn(c)).toEqual([0, 1, 2])
    expect(c.querySelector('[data-view="proposal.to_read.noted.text"]')).toBeNull()
    expect(screen.queryByTestId('view-noted-show-all')).toBeNull()
  })

  it('a to_read that is not a whole split of `changes` (an index missing, repeated or out of range) gives today\'s list, so no change is ever hidden', () => {
    for (const bad of [
      { lines: [2], groups: null, noted: null },
      { lines: [2, 0, 1], groups: null, noted: { text: NOTED, lines: [1] } },
      { lines: [2, 0, 7], groups: null, noted: { text: NOTED, lines: [1] } },
      { lines: [2, 0], groups: [{ heading: 'x', lines: [2] }], noted: { text: NOTED, lines: [1] } },
    ]) {
      const c = showOpen(toRead(bad))
      expect(drawn(c), JSON.stringify(bad)).toEqual([0, 1, 2])
      expect(screen.queryByTestId('view-noted-show-all')).toBeNull()
      cleanup()
    }
  })
})
