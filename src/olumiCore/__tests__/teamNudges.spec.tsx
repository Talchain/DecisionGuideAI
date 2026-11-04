/**
 * The Team tab's nudges and sharing one's own view early (DL, R2): whom the round waits for, the reveal once everyone has given, and each
 * next action with no outcome yet, every word core's (`collab.waiting`, `can_reveal`, `commitments[].outcomes`); and a member's own
 * private view shown to the team before the reveal, offered only where core says it can be (`collab.mine[].can_share`, github-3c).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import golden from '../../olumiView/golden/european.view.json'
import type { View } from '../../olumiView/client'
import { useViewStore } from '../../olumiView/store'
import { setTeamFetch } from '../team/api'
import { resetDrafts } from '../team/drafts'
import { resetWrites } from '../team/writes'
import { TeamTab } from '../team/TeamTab'
import { useMe } from '../me'

const SID = 's_0123456789ab'
const base = golden as unknown as View
const twoPeople = (over: Partial<View['collab']> = {}, view: Partial<View> = {}): View => ({
  ...base, id: SID, you: 'Ada', you_id: 'p_1',
  members: [{ id: 'p_1', name: 'Ada' }, { id: 'p_2', name: 'Bea' }],
  collab: {
    alone: false, heading: 'Team views · 2', open: true,
    shared: [{ id: 3, by: 'Bea', by_id: 'p_2', text: 'Hold until the pilot reports.', skip: false }],
    mine: [{ id: 4, text: 'Enter one country first.', shared: false, skip: false }],
    placeholder: 'Your own view, private until revealed', can_reveal: false, waiting: 'waiting for Bea',
    commitments: [{ id: 9, at: '2026-11-03T10:00:00Z', by: 'Ada', by_id: 'p_1', action: 'Pilot in Germany', owner: 'Bea', owner_id: 'p_2', expect: 'Ten customers by March', reconsider: 'Fewer than five by February', keeps: ['d_1'],
      outcomes: [{ id: 2, at: '2026-11-03T11:00:00Z', by: 'Bea', by_id: 'p_2', happened: 'Seven customers.', versus: 'worse', reconsider_triggered: false, note: null }] }],
    owners: [{ id: 'p_1', name: 'Ada' }, { id: 'p_2', name: 'Bea' }],
    records: [...base.collab.records, { id: 'd_1', family: 'dissent', label: 'Bea: wait for the pilot' }, { id: 'gone', family: 'quantity', label: null }],
    dissent: [{ id: 'd_1', holder: 'Bea', position: 'Wait for the pilot before entering a second country.' }],
    ...over,
  },
  evidence: [{ id: 5, at: '2026-11-03T09:00:00Z', by: 'Bea', by_id: 'p_2', text: 'Churn in DACH was 2 in 100.', source: 'https://example.org/churn', link: 'https://example.org/churn', concerns: [base.collab.records[0]!.id], stance: 'challenges', version: 1 }],
  ...view,
})

let calls: Array<{ method: string; path: string; body: unknown }> = []
let served: View
let invites: unknown[] = []
beforeEach(() => {
  calls = []
  invites = []
  served = twoPeople()
  setTeamFetch((async (u: unknown, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push({ method, path: String(u), body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (String(u).endsWith('/invites')) return new Response(JSON.stringify(method === 'GET' ? { invites } : { id: 'p_9', link: '/k/tok123?to=' + encodeURIComponent('/#/scenario/00000000-0000-4000-8000-0123456789ab') }), { status: method === 'GET' ? 200 : 201 })
    return new Response(JSON.stringify(method === 'GET' ? served : { ok: 1 }), { status: method === 'GET' ? 200 : 201 })
  }) as unknown as typeof fetch)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: SID, view: served, status: 'ready', error: null, stale: false })
  useMe.setState({ me: { id: 'p_1', name: 'Ada' }, status: 'ready' })
})
afterEach(() => { cleanup(); setTeamFetch(null); resetDrafts(); resetWrites(); useMe.setState({ me: null, status: 'none' }) })

const posts = () => calls.filter((c) => c.method === 'POST')
const reread = () => calls.filter((c) => c.method === 'GET' && c.path === `/api/scenarios/${SID}/view?schema=3`).length

const show = (v: View) => { served = v; useViewStore.setState({ view: v }) }
const withShare = (can: unknown, skip = false): View => twoPeople({ mine: [{ id: 4, text: 'Enter one country first.', shared: false, skip, ...(can === undefined ? {} : { can_share: can }) } as View['collab']['mine'][number]] })
const open9 = (over: Partial<View['collab']['commitments'][number]> = {}) => ({ ...twoPeople().collab.commitments[0]!, outcomes: [], ...over })

describe('the nudges at the top of the Team tab are core\'s team state', () => {
  it('whom the round waits for, in core\'s words, and no reveal yet', () => {
    show(twoPeople({ commitments: [] }))
    render(<TeamTab />)
    expect(screen.getByTestId('team-nudges').contains(screen.getByTestId('team-waiting'))).toBe(true)
    expect(screen.getByTestId('team-waiting').textContent).toBe('waiting for Bea')
    expect(screen.queryByTestId('team-reveal-go')).toBeNull()
  })
  it('everyone has given: the reveal is offered there, once, and goes to core\'s reveal route', async () => {
    show(twoPeople({ commitments: [], can_reveal: true, waiting: null }))
    render(<TeamTab />)
    expect(screen.getAllByTestId('team-reveal-go')).toHaveLength(1)
    expect(screen.getByTestId('team-nudges').contains(screen.getByTestId('team-reveal-go'))).toBe(true)
    expect(screen.getByTestId('team-nudge-reveal').textContent).toContain('Everyone has given their view.')
    expect(screen.queryByTestId('team-waiting')).toBeNull()
    fireEvent.click(screen.getByTestId('team-reveal-go'))
    await waitFor(() => expect(posts().map((c) => c.path)).toEqual([`/api/scenarios/${SID}/reveal`]))
  })
  it('a next action with no outcome yet is nudged with its action and owner as core holds them, and opens its outcome form', async () => {
    show(twoPeople({ waiting: null, commitments: [open9(), open9({ id: 10, action: 'Ask two customers', owner: 'Ada', owner_id: 'p_1', outcomes: twoPeople().collab.commitments[0]!.outcomes })] }))
    render(<TeamTab />)
    expect(screen.getByTestId('team-nudge-outcome-9').textContent).toContain('Pilot in Germany · Bea · no outcome yet')
    expect(screen.queryByTestId('team-nudge-outcome-10')).toBeNull() // it has its outcome
    expect(screen.queryByTestId('team-outcome-form-9')).toBeNull()
    await act(async () => { fireEvent.click(screen.getByTestId('team-nudge-outcome-9').querySelector('button')!) })
    expect(screen.getByTestId('team-outcome-form-9')).toBeTruthy()
  })
  it('nothing waiting, nothing to reveal, every action reviewed: no nudge at all', () => {
    show(twoPeople({ waiting: null }))
    render(<TeamTab />)
    expect(screen.queryByTestId('team-nudges')).toBeNull()
  })
})

describe('sharing one\'s own view before the reveal', () => {
  it('offered only where core says it can be: the view goes to core\'s share route, then the View is read again', async () => {
    show(withShare(true))
    render(<TeamTab />)
    fireEvent.click(screen.getByTestId('team-share-4'))
    await waitFor(() => expect(posts().map((c) => c.path)).toEqual([`/api/scenarios/${SID}/views/4/reveal`]))
    await waitFor(() => expect(reread()).toBeGreaterThan(0))
  })
  it('a core without `can_share`, or one that says false (a skip, alone, not this round: core\'s rule), offers nothing', () => {
    for (const v of [withShare(undefined), withShare(false), withShare(false, true)]) {
      show(v)
      const { unmount } = render(<TeamTab />)
      expect(screen.queryByTestId('team-share-4')).toBeNull()
      unmount()
    }
  })
  it('a share core refuses says so in core\'s words, and nothing else changes', async () => {
    show(withShare(true))
    setTeamFetch((async (u: unknown, init?: RequestInit) => {
      calls.push({ method: init?.method ?? 'GET', path: String(u), body: undefined })
      return (init?.method ?? 'GET') === 'POST' ? new Response(JSON.stringify({ error: 'a view is shared early only once a second person has joined' }), { status: 409 }) : new Response(JSON.stringify(served), { status: 200 })
    }) as unknown as typeof fetch)
    render(<TeamTab />)
    fireEvent.click(screen.getByTestId('team-share-4'))
    expect((await screen.findByTestId('team-views-error')).textContent).toContain('a view is shared early only once a second person has joined')
    expect(screen.getByTestId('team-mine-4')).toBeTruthy()
  })
  it('a share whose answer was lost is not sent again', async () => {
    show(withShare(true))
    setTeamFetch((async (u: unknown, init?: RequestInit) => { calls.push({ method: init?.method ?? 'GET', path: String(u), body: undefined }); if ((init?.method ?? 'GET') === 'POST') throw new TypeError('network'); return new Response(JSON.stringify(served), { status: 200 }) }) as unknown as typeof fetch)
    render(<TeamTab />)
    fireEvent.click(screen.getByTestId('team-share-4'))
    await screen.findByTestId('team-views-error') // the answer was lost: said, and the write settled
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect((screen.getByTestId('team-share-4') as HTMLButtonElement).disabled).toBe(true)
  })
})
