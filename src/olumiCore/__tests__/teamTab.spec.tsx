/**
 * THE TEAM TAB IS CORE'S VIEW (spec §8 steps 1–7): every word and state it shows is the View's `collab`, `evidence` and `members`, and
 * every write goes to core's own route, after which the View is read again. The View here is core's golden (wip/v3.1-one 8d25761, API v1.9) with a
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
  ...base, id: SID, you: 'Ada', you_id: 'p_1',
  members: [{ id: 'p_1', name: 'Ada' }, { id: 'p_2', name: 'Bea' }],
  collab: {
    alone: false, heading: 'Team views · 2', open: true,
    shared: [{ id: 3, by: 'Bea', by_id: 'p_2', text: 'Hold until the pilot reports.', skip: false, figures: [] }],
    mine: [{ id: 4, text: 'Enter one country first.', shared: false, skip: false, figures: [], can_share: false }],
    placeholder: 'Your own view, private until revealed', can_reveal: false, waiting: 'waiting for Bea',
    commitments: [{ id: 9, at: '2026-11-03T10:00:00Z', by: 'Ada', by_id: 'p_1', action: 'Pilot in Germany', owner: 'Bea', owner_id: 'p_2', expect: 'Ten customers by March', reconsider: 'Fewer than five by February', keeps: ['d_1'], option: null, version: null, expect_band: null, review_on: null,
      outcomes: [{ id: 2, at: '2026-11-03T11:00:00Z', by: 'Bea', by_id: 'p_2', happened: 'Seven customers.', versus: 'worse', reconsider_triggered: false, note: null, figure: null, dissent: [] }] }],
    owners: [{ id: 'p_1', name: 'Ada' }, { id: 'p_2', name: 'Bea' }],
    records: [...base.collab.records, { id: 'd_1', family: 'dissent', label: 'Bea: wait for the pilot' }, { id: 'gone', family: 'quantity', label: null }],
    dissent: [{ id: 'd_1', holder: 'Bea', position: 'Wait for the pilot before entering a second country.', holder_id: 'p_2', confirmed: null }],
    ...over,
  },
  evidence: [{ id: 5, at: '2026-11-03T09:00:00Z', by: 'Bea', by_id: 'p_2', text: 'Churn in DACH was 2 in 100.', source: 'https://example.org/churn', link: 'https://example.org/churn', concerns: [base.collab.records[0]!.id], stance: 'challenges', version: 1, considered: null }],
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
  it('"(you)" is core\'s own answer (`you_id`), never a name: two members may share one', () => {
    useViewStore.setState({ view: { ...twoPeople(), members: [{ id: 'p_1', name: 'Ada' }, { id: 'p_2', name: 'Ada' }] } })
    render(<TeamTab />)
    expect(screen.getByTestId('team-member-p_1').textContent).toBe('AAda (you)')
    expect(screen.getByTestId('team-member-p_2').textContent).toBe('AAda')
  })
  it('the reveal is offered exactly when core says it can be made', () => {
    const { rerender } = render(<TeamTab />)
    expect(screen.queryByTestId('team-reveal-go')).toBeNull()
    useViewStore.setState({ view: twoPeople({ can_reveal: true, waiting: null }) })
    rerender(<TeamTab />)
    expect(screen.getByTestId('team-reveal-go')).toBeTruthy()
    expect(screen.queryByTestId('team-waiting')).toBeNull()
  })
  it('evidence, a commitment and its outcome, as core holds them; what evidence bears on and what a commitment keeps open are core\'s labels', () => {
    render(<TeamTab />)
    expect(screen.getByTestId('team-evidence-text-5').textContent).toBe('Churn in DACH was 2 in 100.')
    expect(screen.getByTestId('team-evidence-about-5').textContent).toBe(`Bears on: ${base.collab.records[0]!.label}`)
    expect(screen.getByTestId('team-commitment-keeps-9').textContent).toBe('Keeps open: Bea: wait for the pilot')
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
    const card = base.collab.records[1]!
    fireEvent.change(screen.getByTestId('team-evidence-bears'), { target: { value: card.id } })
    fireEvent.click(screen.getByLabelText('Supports it'))
    fireEvent.click(screen.getByTestId('team-evidence-add'))
    await waitFor(() => expect(reread()).toBe(1))
    expect(posts()[0]).toMatchObject({ path: `/api/scenarios/${SID}/evidence`, body: { text: 'Two pilots stalled.', concerns: [card.id], stance: 'supports', op: expect.stringMatching(/^[A-Za-z0-9-]{8,64}$/) } })
  })
  it('what evidence may bear on is the approved version\'s records, by core\'s label, held proposal or not; a record no longer in it is not offered', () => {
    useViewStore.setState({ view: twoPeople({}, { proposal: { id: 1, base: 1, heading: 'x', on: [], removed: [], problem: null, marks: [] } as unknown as View['proposal'] }) })
    render(<TeamTab />)
    fireEvent.click(screen.getByTestId('team-evidence-open'))
    const bears = screen.getByTestId('team-evidence-bears') as HTMLSelectElement
    expect(bears.disabled).toBe(false)
    const labelled = twoPeople().collab.records.filter((r) => r.label !== null)
    expect([...bears.options].map((o) => o.value)).toEqual(['', '__none__', ...labelled.map((r) => r.id)])
    expect([...bears.options].slice(2).map((o) => o.textContent)).toEqual(labelled.map((r) => r.label))
  })
  it('a commitment owned by a member core names (by id), and an outcome against it with its op', async () => {
    render(<TeamTab />)
    fireEvent.click(screen.getByTestId('team-commitment-open'))
    fireEvent.change(screen.getByTestId('team-c-action'), { target: { value: 'Run the pilot' } })
    fireEvent.change(screen.getByTestId('team-c-owner'), { target: { value: 'p_2' } })
    fireEvent.change(screen.getByTestId('team-c-expect'), { target: { value: 'Ten by March' } })
    fireEvent.change(screen.getByTestId('team-c-reconsider'), { target: { value: 'Under five' } })
    expect(screen.getByTestId('team-c-keeps').textContent).toContain('Bea: Wait for the pilot before entering a second country.')
    fireEvent.click(screen.getByTestId('team-c-keep-d_1'))
    fireEvent.click(screen.getByTestId('team-commitment-save'))
    await waitFor(() => expect(reread()).toBe(1))
    expect(posts()[0]).toEqual({ method: 'POST', path: `/api/scenarios/${SID}/commitments`, body: { action: 'Run the pilot', owner: 'p_2', expect: 'Ten by March', reconsider: 'Under five', keeps: ['d_1'] } })

    fireEvent.click(screen.getByTestId('team-outcome-open-9'))
    fireEvent.change(screen.getByTestId('team-o-9-happened'), { target: { value: 'Eight.' } })
    fireEvent.click(screen.getAllByLabelText('Mixed')[0]!)
    fireEvent.click(screen.getAllByLabelText('No, it did not')[0]!)
    fireEvent.click(screen.getByTestId('team-o-9-save'))
    await waitFor(() => expect(reread()).toBe(2))
    expect(posts()[1]).toMatchObject({ path: `/api/scenarios/${SID}/commitments/9/outcomes`, body: { happened: 'Eight.', versus: 'mixed', reconsider_triggered: false, op: expect.any(String) } })
  })
})

describe('the record and how the model moved (PL review 4 Nov: both on core)', () => {
  it('the printable record is core\'s own page for the scenario; compare is offered from a second version on', () => {
    render(<TeamTab />)
    expect(screen.getByTestId('team-record-link').getAttribute('href')).toBe(`/s/${SID}/record`)
    expect(screen.queryByTestId('team-compare')).toBeNull()
  })
  it('two versions: compare reads core\'s compare route for the pair chosen and draws its three lists in core\'s words', async () => {
    const two = { ...served, version: { ...served.version!, n: 2 } }
    useViewStore.setState({ view: two })
    const compared = {
      versions: [{ n: 2, at: '2026-11-04', proposedBy: 'Olumi', briefBy: null, approvedBy: 'Ada' }],
      changes: [{ text: '+ figure: staff absence', detail: '2 to 10 ticket/week', mark: { glyph: '◆', title: 'Olumi’s proposal' } }],
      results: [{ kind: 'chance', option: 'hire', optionLabel: 'Add one specialist', aim: 'At least 100 a week', condition: null,
        before: { value: 'about 50% chance', title: 't1', olumi: null }, after: { value: 'about 40% chance', title: 't2', olumi: null }, move: 'down' }],
    }
    setTeamFetch((async (u: unknown, init?: RequestInit) => {
      calls.push({ method: init?.method ?? 'GET', path: String(u), body: undefined })
      return new Response(JSON.stringify(String(u).includes('/compare') ? compared : two), { status: 200 })
    }) as unknown as typeof fetch)
    render(<TeamTab />)
    fireEvent.click(screen.getByTestId('team-compare-go'))
    await waitFor(() => expect(screen.getByTestId('team-compare-out')).toBeTruthy())
    expect(calls.at(-1)!.path).toBe(`/api/scenarios/${SID}/compare?from=1&to=2`)
    expect(screen.getByTestId('team-compare-versions').textContent).toBe('Version 2: proposed by Olumi · approved by Ada')
    expect(screen.getByTestId('team-compare-changes').textContent).toBe('+ figure: staff absence 2 to 10 ticket/week ◆')
    expect(screen.getByTestId('team-compare-results').textContent).toBe('‘Add one specialist’ on ‘At least 100 a week’: about 50% chance → about 40% chance (down)')
    fireEvent.change(screen.getByTestId('team-compare-from'), { target: { value: '2' } })
    fireEvent.click(screen.getByTestId('team-compare-go'))
    expect(screen.getByTestId('team-compare-error').textContent).toBe('Pick two different versions.')
  })
})

describe('bringing a colleague in (core API v1.8, any member, no admin key)', () => {
  it('makes their link through core\'s invites route, shows it once (it lands on this scenario in DGAI), and lists who was invited', async () => {
    render(<TeamTab />)
    fireEvent.change(screen.getByTestId('team-invite-name'), { target: { value: 'Cai' } })
    invites = [{ id: 'p_9', name: 'Cai', by: 'Ada', made: '2026-11-03', expires: '2026-12-03', status: 'live', revocable: true }]
    fireEvent.click(screen.getByTestId('team-invite-go'))
    await waitFor(() => expect(screen.getByTestId('team-invite-link')).toBeTruthy())
    expect(posts().find((p) => p.path.endsWith('/invites'))).toEqual({ method: 'POST', path: `/api/scenarios/${SID}/invites`, body: { name: 'Cai' } })
    expect((screen.getByTestId('team-invite-link') as HTMLInputElement).value).toBe(`${window.location.origin}/k/tok123?to=%2F%23%2Fscenario%2F00000000-0000-4000-8000-0123456789ab`)
    await waitFor(() => expect(screen.getByTestId('team-invite-p_9').textContent).toContain('Cai · invited by Ada · live'))
    fireEvent.click(screen.getByTestId('team-invite-revoke-p_9'))
    await waitFor(() => expect(posts().some((p) => p.path === `/api/scenarios/${SID}/invites/p_9/revoke`)).toBe(true))
  })
})
