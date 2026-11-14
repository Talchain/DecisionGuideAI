/**
 * Partial approval (core L8, View `proposal.changes` / `proposal.groups`; approve `only` / `only_top`, API v1.4/v1.8): core's change card,
 * each line ticked by its own id, and "Approve ticked" sends exactly the ticked lines, never more; Approve alone stays the whole proposal.
 * Core's golden (wip/v3.1-one e4b0bae): proposal.view3.json, two changed figures, no groups.
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

const golden: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'proposal.view.json'), 'utf8'))
const p = golden.proposal!

let posts: Array<{ path: string; body: unknown }> = []
const show = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false })
  return render(<ViewChat />).container
}
beforeEach(() => {
  posts = []
  useUIStore.setState({ activeOutputTab: 'olumi' } as never)
  setTeamFetch((async (u: unknown, init?: RequestInit) => {
    if ((init?.method ?? 'GET') === 'POST') { posts.push({ path: String(u), body: JSON.parse(String(init!.body)) }); return new Response('{"version":9,"n":2,"receipt":"r"}', { status: 201 }) }
    return new Response(JSON.stringify(golden), { status: 200 })
  }) as unknown as typeof fetch)
})
afterEach(() => { cleanup(); setTeamFetch(null); useViewChat.setState({ busy: false, said: null }); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null }) })

describe('partial approval', () => {
  it('each of core\'s lines, in order, with its tick and what a tap opens; Approve ticked sends exactly the ticked record in `only`', async () => {
    expect(p.changes.length).toBe(2)
    const c = show(golden)
    p.changes.forEach((ch, i) => {
      expect(c.querySelector(`[data-view="proposal.changes.${i}.text"]`)?.textContent).toBe(ch.text)
      expect(c.querySelector(`[data-view="proposal.changes.${i}.detail"]`)?.textContent).toBe(ch.detail)
      expect(screen.getByTestId(`view-change-tick-${i}`).getAttribute('aria-label')).toBe(`Choose ${ch.text}`)
    })
    expect(screen.getByTestId('view-approve-ticked')).toBeDisabled()
    fireEvent.click(screen.getByTestId('view-change-tick-1'))
    expect(screen.getByTestId('view-approve-ticked')).toHaveTextContent('Approve ticked · 1')
    fireEvent.click(screen.getByTestId('view-approve-ticked'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toEqual({ path: `/api/proposals/${p.id}/approve`, body: { base: p.base, only: [p.changes[1]!.id], only_top: [] } })
  })

  it('a top-level field goes in `only_top`, never `only`, even named like a record; a group\'s tick chooses every line under it', async () => {
    const changes = [p.changes[0]!, { ...p.changes[0]!, top: true, family: 'question', text: '↻ title', detail: '' }]
    const grouped = { ...golden, proposal: { ...p, changes, groups: [{ heading: 'Everything', lines: [0, 1] }] } }
    show(grouped)
    fireEvent.click(screen.getByTestId('view-change-group-0'))
    expect(screen.getByTestId('view-approve-ticked')).toHaveTextContent('Approve ticked · 2')
    fireEvent.click(screen.getByTestId('view-approve-ticked'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]!.body).toEqual({ base: p.base, only: [changes[0]!.id], only_top: [changes[0]!.id] })
  })

  it('DL 11 Nov (replacing PL 7 Nov\'s open groups): a grouped proposal rests with every group closed, its heading and tick in view; a group opens on press and shows each of core\'s lines', () => {
    const changes = [p.changes[0]!, { ...p.changes[0]!, top: true, family: 'question', text: '↻ title', detail: '' }]
    show({ ...golden, proposal: { ...p, changes, groups: [{ heading: 'Everything', lines: [0, 1] }] } })
    const box = screen.getByTestId('view-change-group-box-0') as HTMLDetailsElement
    expect(box.open).toBe(false)
    expect(screen.getByText('Everything')).toBeVisible()
    expect(screen.getByTestId('view-change-group-0'), 'the group\'s own tick is in the resting view').toBeVisible()
    box.open = true
    expect(screen.getByTestId('view-change-tick-0')).toBeVisible()
    expect(screen.getByTestId('view-change-tick-1')).toBeVisible()
  })
  it('must not change: Approve is still the whole proposal (`base` alone); one line, or none, has no ticks', async () => {
    show(golden)
    fireEvent.click(screen.getByTestId('view-change-tick-0'))
    fireEvent.click(screen.getByText('Approve'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toEqual({ path: `/api/proposals/${p.id}/approve`, body: { base: p.base } })
    cleanup()
    // One line is the whole proposal: the line is drawn, with no tick and no second Approve.
    const one = show({ ...golden, proposal: { ...p, changes: [p.changes[0]!] } })
    expect(one.querySelector('[data-view="proposal.changes.0.text"]')?.textContent).toBe(p.changes[0]!.text)
    expect(one.querySelector('[data-testid^="view-change-tick-"]')).toBeNull()
    expect(screen.queryByTestId('view-approve-ticked')).toBeNull()
    cleanup()
    const c = show({ ...golden, proposal: { ...p, changes: [], groups: null } })
    expect(c.querySelector('[data-testid^="view-change-tick-"]')).toBeNull()
    expect(screen.queryByTestId('view-approve-ticked')).toBeNull()
    cleanup()
    // A core before L8 serves no list at all: the card still draws, with Approve alone.
    const older: Record<string, unknown> = { ...p }
    delete older.changes; delete older.groups
    show({ ...golden, proposal: older as unknown as View['proposal'] })
    expect(screen.getByText('Approve')).toBeInTheDocument()
    expect(screen.queryByTestId('view-approve-ticked')).toBeNull()
  })
})

/**
 * R4 (DL 4 Nov, "never orphan Olumi's figure silently"; core 1dd2ca9, API v1.13): an added figure read only by other lines of its proposal is
 * approved only with one of them, and olumi.view/3 marks each such line `together: { ids, why }`. A tick on one ticks the lines it is marked
 * with; core's `why` is that line's hover. The View is core's own (fixtures/real/together.view3.json, from core's approve path).
 */
describe('a figure and the line that reads it are ticked together', () => {
  const pair: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', 'together.view3.json'), 'utf8'))
  const lines = pair.proposal!.changes
  const at = (id: string) => lines.findIndex((l) => l.id === id)
  const ticks = () => lines.map((_, i) => (screen.getByTestId(`view-change-tick-${i}`) as HTMLInputElement).checked)

  it('core marks the figure and its option, and nothing else (the fixture is the pair)', () => {
    expect(lines.map((l) => [l.id, l.together?.ids ?? null])).toEqual([['two_specialists', ['add_two']], ['add_two', ['two_specialists']], ['c_extra', null]])
  })

  it('ticking Olumi\'s figure ticks its option, untick either and both go; Approve ticked sends the two', async () => {
    show(pair)
    fireEvent.click(screen.getByTestId(`view-change-tick-${at('two_specialists')}`))
    expect(ticks()).toEqual([true, true, false])
    fireEvent.click(screen.getByTestId(`view-change-tick-${at('add_two')}`))
    expect(ticks()).toEqual([false, false, false])
    fireEvent.click(screen.getByTestId(`view-change-tick-${at('add_two')}`))
    expect(ticks()).toEqual([true, true, false])
    expect(screen.getByTestId('view-approve-ticked')).toHaveTextContent('Approve ticked · 2')
    fireEvent.click(screen.getByTestId('view-approve-ticked'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]!.body).toEqual({ base: pair.proposal!.base, only: ['two_specialists', 'add_two'], only_top: [] })
  })

  it('each marked line carries core\'s why as its hover, verbatim; an unmarked line has none', () => {
    const c = show(pair)
    lines.forEach((l, i) => {
      const hover = c.querySelector(`[data-view-hover="proposal.changes.${i}.together.why"]`)
      expect(hover?.getAttribute('title') ?? null, l.id).toBe(l.together?.why ?? null)
    })
  })

  it('CONTRAST: a line core marks with nothing is ticked alone', () => {
    show(pair)
    fireEvent.click(screen.getByTestId(`view-change-tick-${at('c_extra')}`))
    expect(ticks()).toEqual([false, false, true])
  })
})

describe('DL 06:57Z (4), old look: Approve and Set aside are reached without scrolling the thread', () => {
  it('SA1 the proposal\'s actions are one sticky foot, inside the thread\'s scroll, holding Approve and Set aside (bound by test id)', () => {
    show(golden)
    const row = screen.getByTestId('view-proposal-actions')
    expect(row.className.split(/\s+/)).toEqual(expect.arrayContaining(['sticky', 'bottom-0', 'bg-panel']))
    expect([!!row.querySelector('[data-testid="view-approve"]'), !!row.querySelector('[data-testid="view-set-aside"]'), !!row.closest('[data-testid="view-next-step"]')]).toEqual([true, true, true])
  })
})
