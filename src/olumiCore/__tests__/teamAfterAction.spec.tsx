/**
 * After an action is recorded (Codex 008 finding 6, 18 Nov): the Commit step shows the saved action in the words core stores, with one direct
 * continuation into "What happened", which is no longer "Later"; and each dissent checkbox names its writer, never opening on a bare colon.
 * Rows bind to the commitment id and the dissent id.
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
import { resetTeamFlow, type StepId } from '../team/flow'
import { useMe } from '../me'

const SID = 's_0123456789ab'
const base = golden as unknown as View
type C = View['collab']
const mine4 = { id: 4, text: 'Enter one country first.', shared: false, skip: false, figures: [], can_share: false, earlier: false }
const bea3 = { id: 3, by: 'Bea', by_id: 'p_2', text: 'Hold until the pilot reports.', skip: false, figures: [], effects: [] }
const k9 = { id: 9, at: '2026-11-03T10:00:00Z', by: 'Ada', by_id: 'p_1', action: 'Pilot in Germany', owner: 'Bea', owner_id: 'p_2', expect: 'Ten customers by March', reconsider: 'Fewer than five by February', keeps: [], option: null, version: null, expect_band: null, review_on: null, trigger: null, outcomes: [] }
const team = (over: Partial<C> = {}, view: Partial<View> = {}): View => ({
  ...base, id: SID, you: 'Ada', you_id: 'p_1',
  members: [{ id: 'p_1', name: 'Ada' }, { id: 'p_2', name: 'Bea' }],
  team_presence: { title: 'Ada (you), Bea', label: 'Team: Ada (you), Bea', members: [{ id: 'p_1', text: 'Ada (you)' }, { id: 'p_2', text: 'Bea' }] },
  collab: {
    ...base.collab, alone: false, heading: 'Team views · 2', open: true, shared: [], mine: [mine4], placeholder: 'Your own view', can_reveal: false, waiting: 'waiting for Bea',
    commitments: [], owners: [{ id: 'p_1', name: 'Ada' }, { id: 'p_2', name: 'Bea' }], dissent: [], private_view_prompt: null, suggested_triggers: [],
    ...over,
  } as C,
  gated: false,
  ...view,
})

let calls: Array<{ method: string; path: string }> = []
let served: View
beforeEach(() => {
  calls = []
  served = team()
  setTeamFetch((async (u: unknown, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push({ method, path: String(u) })
    if (String(u).endsWith('/invites')) return new Response(JSON.stringify(method === 'GET' ? { invites: [] } : { id: 'p_9', link: '/k/tok?to=x' }), { status: method === 'GET' ? 200 : 201 })
    if (String(u).endsWith('/differences')) return new Response(JSON.stringify({ error: 'none' }), { status: 404 })
    if (String(u).endsWith('/api/me')) return new Response(JSON.stringify({ me: { id: 'p_1' } }), { status: 200 })
    return new Response(JSON.stringify(method === 'GET' ? served : { ok: 1 }), { status: method === 'GET' ? 200 : 201 })
  }) as unknown as typeof fetch)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: SID, view: served, status: 'ready', error: null, stale: false, at: null })
  useMe.setState({ me: { id: 'p_1', name: 'Ada' }, status: 'ready' })
})
afterEach(() => { cleanup(); setTeamFetch(null); resetDrafts(); resetWrites(); resetTeamFlow(); useMe.setState({ me: null, status: 'none' }) })

const show = (v: View) => { served = v; useViewStore.setState({ view: v }) }
const step = (id: StepId) => screen.getByTestId(`team-step-${id}`)
const dis1 = { id: 'd_1', holder: 'Bea', position: 'Hold until the pilot reports.', holder_id: 'p_2', confirmed: null }
const dis2 = { id: 'd_2', holder: '', position: 'Germany is too small.', holder_id: null, confirmed: null }
const dis3 = { id: 'd_3', holder: '', position: 'Wait a quarter.', holder_id: 'p_2', confirmed: null }
const after = (k: Record<string, unknown> = {}) => team({ waiting: null, shared: [bea3], dissent: [dis1], commitments: [{ ...k9, keeps: ['d_1'], ...k }] })

describe('the Commit step after an action is recorded', () => {
  it('shows that action by its id, in core\'s words, with one continuation into What happened; What happened is not Later', async () => {
    show(after())
    render(<TeamTab />)
    expect(screen.getByTestId('team-saved-action-words-9').textContent).toBe('Pilot in Germany')
    expect(screen.getByTestId('team-saved-action-expect-9').textContent).toBe('Ten customers by March')
    expect(screen.getByTestId('team-saved-action-reconsider-9').textContent).toBe('Fewer than five by February')
    expect(screen.getByTestId('team-saved-action-9').textContent).toContain('owner Bea')
    expect(screen.getByTestId('team-saved-action-keep-9-d_1').textContent).toContain('Bea: Hold until the pilot reports.')
    expect(step('commit').getAttribute('data-step-state')).toBe('done')
    expect(step('outcome').getAttribute('data-step-state')).not.toBe('later')
    const next = screen.getByTestId('team-saved-next')
    expect(next.getAttribute('data-commitment')).toBe('9')
    await act(async () => { fireEvent.click(next) })
    await waitFor(() => expect(step('outcome').getAttribute('data-step-open')).toBe(''))
    expect(screen.getByTestId('team-outcome-form-9')).toBeTruthy()
  })
  it('CONTRAST no action: the entry button as today, no saved card, What happened is Later', () => {
    show(team({ waiting: null, shared: [bea3] }))
    render(<TeamTab />)
    expect(screen.queryByTestId('team-saved-actions')).toBeNull()
    expect(screen.getByTestId('team-commitment-open')).toBeTruthy()
    expect(step('outcome').getAttribute('data-step-state')).toBe('later')
  })
})

describe('a dissent checkbox names its writer', () => {
  const open = async (v: View) => { show(v); render(<TeamTab />); await act(async () => { fireEvent.click(screen.getByTestId('team-step-commit-row')) }); fireEvent.click(screen.getByTestId('team-commitment-open')) }
  it('starts with the writer\'s name (stored, else the member core names) and carries the same dissent id', async () => {
    await open(team({ waiting: null, shared: [bea3], dissent: [dis1, dis3] }))
    expect(screen.getByTestId('team-c-keep-words-d_1').textContent).toBe('Bea: Hold until the pilot reports.')
    expect(screen.getByTestId('team-c-keep-words-d_3').textContent).toBe('Bea: Wait a quarter.')
    for (const id of ['d_1', 'd_3']) expect(screen.getByTestId(`team-c-keep-${id}`).closest('label')!.textContent!.startsWith('Bea: ')).toBe(true)
  })
  it('CONTRAST a dissent no one is named for shows its words with no leading colon', async () => {
    await open(team({ waiting: null, shared: [bea3], dissent: [dis2] }))
    expect(screen.getByTestId('team-c-keep-words-d_2').textContent).toBe('Germany is too small.')
    expect(screen.getByTestId('team-c-keep-d_2').closest('label')!.textContent!.trimStart().startsWith(':')).toBe(false)
  })
})
