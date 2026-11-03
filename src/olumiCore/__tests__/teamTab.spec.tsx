/**
 * THE TEAM TAB IS CORE'S VIEW (spec §8 steps 1–7): every word and state it shows is the View's `collab`, `evidence` and `members`, and
 * every write goes to core's own route, after which the View is read again. The View here is core's golden (wip/v3.1 cc0931a) with a
 * two-person round written in by hand, in the View's own shape.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  ...base, id: SID, you: 'Ada',
  members: [{ id: 'p_1', name: 'Ada' }, { id: 'p_2', name: 'Bea' }],
  collab: {
    alone: false, heading: 'Team views · 2', open: true,
    shared: [{ id: 3, by: 'Bea', text: 'Hold until the pilot reports.', skip: false }],
    mine: [{ id: 4, text: 'Enter one country first.', shared: false, skip: false }],
    placeholder: 'Your own view, private until revealed', can_reveal: false, waiting: 'waiting for Bea',
    commitments: [{ id: 9, at: '2026-11-03T10:00:00Z', by: 'Ada', action: 'Pilot in Germany', owner: 'Bea', owner_id: 'p_2', expect: 'Ten customers by March', reconsider: 'Fewer than five by February', keeps: [],
      outcomes: [{ id: 2, at: '2026-11-03T11:00:00Z', by: 'Bea', happened: 'Seven customers.', versus: 'worse', reconsider_triggered: false, note: null }] }],
    owners: [{ id: 'p_1', name: 'Ada' }, { id: 'p_2', name: 'Bea' }],
    ...over,
  },
  evidence: [{ id: 5, at: '2026-11-03T09:00:00Z', by: 'Bea', text: 'Churn in DACH was 2 in 100.', source: 'https://example.org/churn', concerns: [base.model!.cards[0]!.id], stance: 'challenges', version: 1 }],
  ...view,
})

let calls: Array<{ method: string; path: string; body: unknown }> = []
let served: View
beforeEach(() => {
  calls = []
  served = twoPeople()
  setTeamFetch((async (u: unknown, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push({ method, path: String(u), body: init?.body ? JSON.parse(String(init.body)) : undefined })
    return new Response(JSON.stringify(method === 'GET' ? served : { ok: 1 }), { status: method === 'GET' ? 200 : 201 })
  }) as unknown as typeof fetch)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: SID, view: served, status: 'ready', error: null, stale: false })
  useMe.setState({ me: { id: 'p_1', name: 'Ada' }, status: 'ready' })
})
afterEach(() => { cleanup(); setTeamFetch(null); resetDrafts(); resetWrites(); useMe.setState({ me: null, status: 'none' }) })

const posts = () => calls.filter((c) => c.method === 'POST')
const reread = () => calls.filter((c) => c.method === 'GET' && c.path === `/api/scenarios/${SID}/view`).length

describe('what the tab shows is the View, word for word', () => {
  it('the round: heading, members, the revealed views, your private one, whom the reveal waits for', () => {
    render(<TeamTab />)
    expect(screen.getByTestId('team-views-heading').textContent).toBe('Team views · 2')
    expect(screen.getByTestId('team-member-p_1').textContent).toContain('Ada (you)')
    expect(screen.getByTestId('team-member-p_2').textContent).not.toContain('(you)')
    expect(screen.getByTestId('team-revealed-3').textContent).toContain('Hold until the pilot reports.')
    expect(screen.getByTestId('team-mine-4').textContent).toContain('Enter one country first.')
    expect(screen.getByTestId('team-waiting').textContent).toBe('waiting for Bea')
    expect(screen.getByTestId('team-view-text').getAttribute('placeholder')).toBe('Your own view, private until revealed')
  })
  it('the reveal is offered exactly when core says it can be made', () => {
    const { rerender } = render(<TeamTab />)
    expect(screen.queryByTestId('team-reveal-go')).toBeNull()
    useViewStore.setState({ view: twoPeople({ can_reveal: true, waiting: null }) })
    rerender(<TeamTab />)
    expect(screen.getByTestId('team-reveal-go')).toBeTruthy()
    expect(screen.queryByTestId('team-waiting')).toBeNull()
  })
  it('evidence, a commitment and its outcome, as core holds them; what evidence bears on is the card\'s own heading', () => {
    render(<TeamTab />)
    expect(screen.getByTestId('team-evidence-text-5').textContent).toBe('Churn in DACH was 2 in 100.')
    expect(screen.getByTestId('team-evidence-about-5').textContent).toBe(`Bears on: ${base.model!.cards[0]!.heading}`)
    expect(screen.getByTestId('team-evidence-source-5').querySelector('a')?.getAttribute('href')).toBe('https://example.org/churn')
    expect(screen.getByTestId('team-commitment-action-9').textContent).toBe('Pilot in Germany')
    expect(screen.getByTestId('team-commitment-9').textContent).toContain('owner Bea · set by Ada')
    expect(screen.getByTestId('team-outcome-happened-2').textContent).toBe('Seven customers.')
  })
  it('a View for someone else (another private link opened in this browser) shows nothing of theirs', () => {
    useViewStore.setState({ view: { ...twoPeople(), you_id: 'p_2' } as View })
    render(<TeamTab />)
    expect(screen.getByTestId('team-not-for-page')).toBeTruthy()
    expect(screen.queryByTestId('team-views')).toBeNull()
  })
})

describe('every write goes to core\'s own route, and the View is read again after it', () => {
  it('a view exactly as typed, then a skip', async () => {
    render(<TeamTab />)
    fireEvent.change(screen.getByTestId('team-view-text'), { target: { value: '  wait a quarter ' } })
    fireEvent.click(screen.getByTestId('team-view-give'))
    await waitFor(() => expect(reread()).toBe(1))
    expect(posts()[0]).toEqual({ method: 'POST', path: `/api/scenarios/${SID}/views`, body: { text: '  wait a quarter ' } })
    fireEvent.click(screen.getByTestId('team-view-skip'))
    await waitFor(() => expect(reread()).toBe(2))
    expect(posts()[1]!.body).toEqual({ skip: true })
  })
  it('the reveal', async () => {
    useViewStore.setState({ view: twoPeople({ can_reveal: true, waiting: null }) })
    render(<TeamTab />)
    fireEvent.click(screen.getByTestId('team-reveal-go'))
    await waitFor(() => expect(reread()).toBe(1))
    expect(posts()[0]!.path).toBe(`/api/scenarios/${SID}/reveal`)
  })
  it('evidence on a card of the approved model, with its op', async () => {
    render(<TeamTab />)
    fireEvent.click(screen.getByTestId('team-evidence-open'))
    fireEvent.change(screen.getByTestId('team-evidence-body'), { target: { value: 'Two pilots stalled.' } })
    const card = base.model!.cards[1]!
    fireEvent.change(screen.getByTestId('team-evidence-bears'), { target: { value: card.id } })
    fireEvent.click(screen.getByLabelText('Supports it'))
    fireEvent.click(screen.getByTestId('team-evidence-add'))
    await waitFor(() => expect(reread()).toBe(1))
    expect(posts()[0]).toMatchObject({ path: `/api/scenarios/${SID}/evidence`, body: { text: 'Two pilots stalled.', concerns: [card.id], stance: 'supports', op: expect.stringMatching(/^[A-Za-z0-9-]{8,64}$/) } })
  })
  it('while a proposal is held, evidence can only be about the model generally (its cards may not be in the approved version)', () => {
    useViewStore.setState({ view: twoPeople({}, { proposal: { id: 1, base: 1, heading: 'x', on: [], removed: [], problem: null, marks: [] } as unknown as View['proposal'] }) })
    render(<TeamTab />)
    fireEvent.click(screen.getByTestId('team-evidence-open'))
    const bears = screen.getByTestId('team-evidence-bears') as HTMLSelectElement
    expect(bears.disabled).toBe(true)
    expect([...bears.options].map((o) => o.value)).toEqual(['', '__none__'])
  })
  it('a commitment owned by a member core names (by id), and an outcome against it with its op', async () => {
    render(<TeamTab />)
    fireEvent.click(screen.getByTestId('team-commitment-open'))
    fireEvent.change(screen.getByTestId('team-c-action'), { target: { value: 'Run the pilot' } })
    fireEvent.change(screen.getByTestId('team-c-owner'), { target: { value: 'p_2' } })
    fireEvent.change(screen.getByTestId('team-c-expect'), { target: { value: 'Ten by March' } })
    fireEvent.change(screen.getByTestId('team-c-reconsider'), { target: { value: 'Under five' } })
    fireEvent.click(screen.getByTestId('team-commitment-save'))
    await waitFor(() => expect(reread()).toBe(1))
    expect(posts()[0]).toEqual({ method: 'POST', path: `/api/scenarios/${SID}/commitments`, body: { action: 'Run the pilot', owner: 'p_2', expect: 'Ten by March', reconsider: 'Under five', keeps: [] } })

    fireEvent.click(screen.getByTestId('team-outcome-open-9'))
    fireEvent.change(screen.getByTestId('team-o-9-happened'), { target: { value: 'Eight.' } })
    fireEvent.click(screen.getAllByLabelText('Mixed')[0]!)
    fireEvent.click(screen.getAllByLabelText('No, it did not')[0]!)
    fireEvent.click(screen.getByTestId('team-o-9-save'))
    await waitFor(() => expect(reread()).toBe(2))
    expect(posts()[1]).toMatchObject({ path: `/api/scenarios/${SID}/commitments/9/outcomes`, body: { happened: 'Eight.', versus: 'mixed', reconsider_triggered: false, op: expect.any(String) } })
  })
})
