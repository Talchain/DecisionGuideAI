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

  it('must not change: Approve is still the whole proposal (`base` alone); a proposal held without a list has no ticks', async () => {
    show(golden)
    fireEvent.click(screen.getByTestId('view-change-tick-0'))
    fireEvent.click(screen.getByText('Approve'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toEqual({ path: `/api/proposals/${p.id}/approve`, body: { base: p.base } })
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
