/**
 * The saved-expectation card of the Olumi tab (v12/learning): the reader's own open expectation, whole and as typed, the review date where
 * one was saved, and one button that opens the EXISTING outcome form for that commitment in the Team tab. Every person's word below is
 * invented. The View is `golden/european.view.json` with its commitments set inline, as `olumiCore/__tests__/teamNudges.spec.tsx` does.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import golden from '../../../golden/european.view.json'
import type { View } from '../../../client'
import { useViewStore } from '../../../store'
import { useReveal } from '../../../reveal'
import { useUIStore } from '../../../../stores/uiStore'
import { setTeamFetch } from '../../../../olumiCore/team/api'
import { draftOf, resetDrafts } from '../../../../olumiCore/team/drafts'
import { resetWrites } from '../../../../olumiCore/team/writes'
import { TeamTab } from '../../../../olumiCore/team/TeamTab'
import { useMe } from '../../../../olumiCore/me'
import { EXPECTATION_WORDS, ExpectationEntry } from '../ExpectationEntry'

const SID = 's_0123456789ab'
const base = golden as unknown as View
type Commitment = View['collab']['commitments'][number]

const OUTCOME = { id: 2, at: '2026-11-20T11:00:00Z', by: 'Ada', by_id: 'p_1', happened: 'Twenty-two sign-ups.', versus: 'worse', reconsider_triggered: false, note: null, figure: null, dissent: [] } as unknown as Commitment['outcomes'][number]
/** One the reader (Ada, p_1) saved, with no outcome yet. */
const mine = (over: Partial<Commitment> = {}): Commitment => ({
  id: 9, at: '2026-11-03T10:00:00Z', by: 'Ada', by_id: 'p_1', action: 'Run the two-week pricing trial', owner: 'Ada', owner_id: 'p_1',
  expect: 'At least thirty sign-ups by the end of the trial', reconsider: 'Fewer than ten after the first week', keeps: [], outcomes: [],
  option: null, version: null, expect_band: null, review_on: '2027-03-01', trigger: null, ...over,
})
/** One a teammate saved, open too, and dated EARLIER than the reader's: only whose it is keeps it off the card. */
const beas = (over: Partial<Commitment> = {}): Commitment =>
  mine({ id: 11, by: 'Bea', by_id: 'p_2', action: 'Call the three lapsed accounts', expect: 'Two of them agree to a call', review_on: '2027-01-05', ...over })
const viewOf = (commitments: Commitment[], collab: Partial<View['collab']> = {}): View => ({
  ...base, id: SID, you: 'Ada', you_id: 'p_1', gated: false,
  members: [{ id: 'p_1', name: 'Ada' }, { id: 'p_2', name: 'Bea' }],
  collab: { ...base.collab, alone: false, waiting: null, can_reveal: false, owners: [{ id: 'p_1', name: 'Ada' }, { id: 'p_2', name: 'Bea' }], commitments, ...collab },
})

/** The dock's own rule (OutputsDock: Team is drawn only while it is the active tab), so "the tab is not drawn yet" is real in these rows. */
function Dock(): JSX.Element | null { return useUIStore((s) => s.activeOutputTab) === 'team' ? <TeamTab /> : null }

let calls: Array<{ method: string; path: string }> = []
let served: View
let scrolledTo: Element[] = []
const writes = () => calls.filter((c) => c.method !== 'GET')
const page = (v: View) => { served = v; useViewStore.setState({ view: v }); return render(<><ExpectationEntry sid={SID} view={v} /><Dock /></>) }
const press = async () => { await act(async () => { fireEvent.click(screen.getByTestId('expectation-entry-record')) }) }
const drawn = () => screen.queryByTestId('expectation-entry')

beforeEach(() => {
  calls = []; scrolledTo = []; served = viewOf([mine()])
  setTeamFetch((async (u: unknown, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push({ method, path: String(u) })
    if (String(u).endsWith('/invites')) return new Response(JSON.stringify({ invites: [] }), { status: 200 })
    return new Response(JSON.stringify(method === 'GET' ? served : { ok: 1 }), { status: method === 'GET' ? 200 : 201 })
  }) as unknown as typeof fetch)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: SID, view: served, status: 'ready', error: null, stale: false, at: null })
  useMe.setState({ me: { id: 'p_1', name: 'Ada' }, status: 'ready' })
  useUIStore.setState({ activeOutputTab: 'olumi' })
  useReveal.getState().select(null)
  // jsdom has no scrollIntoView: the row records WHICH element was brought into view.
  Element.prototype.scrollIntoView = function (this: Element) { scrolledTo.push(this) }
})
afterEach(() => {
  cleanup(); setTeamFetch(null); resetDrafts(); resetWrites(); useMe.setState({ me: null, status: 'none' })
  useViewStore.setState({ at: null }); useReveal.getState().select(null); useUIStore.setState({ activeOutputTab: 'results' })
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
})

describe('the saved-expectation card: what the person reads', () => {
  it('draws the reader\'s own open expectation: their action and expectation whole, the saved review date, one button', () => {
    const long = 'At least thirty sign-ups by the end of the trial,\nand no more than two refunds asked for in the same fortnight'
    page(viewOf([mine({ expect: long })]))
    const card = screen.getByTestId('expectation-entry')
    expect(card.getAttribute('data-commitment')).toBe('9')
    expect(screen.getByTestId('expectation-entry-action').textContent).toBe('Run the two-week pricing trial')
    expect(card.textContent).toContain(EXPECTATION_WORDS.expect)
    expect(EXPECTATION_WORDS.expect).toBe('What you expect to happen')
    expect(screen.getByTestId('expectation-entry-expect').textContent).toBe(long) // whole, never cut
    expect(screen.getByTestId('expectation-entry-review').textContent).toBe('Review on 2027-03-01') // the date as saved, as Team draws it
    expect(within(card).getAllByRole('button').map((b) => b.textContent)).toEqual(['Record what happened'])
    // No word judges it, and the reconsider point (the form's own business) is not repeated here.
    expect(card.textContent).not.toMatch(/due|late|overdue|on track|Fewer than ten/i)
  })

  it('a different expectation in the View changes what is drawn', () => {
    page(viewOf([mine({ expect: 'Fifty replies to the survey' })]))
    expect(screen.getByTestId('expectation-entry-expect').textContent).toBe('Fifty replies to the survey')
  })

  it('draws nothing when it has its outcome, when a teammate saved it (even one the reader owns), or when there is none', () => {
    const a = page(viewOf([mine({ outcomes: [OUTCOME] })])); expect(drawn()).toBeNull(); a.unmount()
    const b = page(viewOf([beas({ owner: 'Ada', owner_id: 'p_1' })])); expect(drawn()).toBeNull(); b.unmount()
    page(viewOf([])); expect(drawn()).toBeNull()
  })

  it('no review date saved: no date words and nothing in their place', () => {
    page(viewOf([mine({ review_on: null })]))
    expect(screen.getByTestId('expectation-entry-action').textContent).toBe('Run the two-week pricing trial')
    expect(screen.queryByTestId('expectation-entry-review')).toBeNull()
    expect(screen.getByTestId('expectation-entry').textContent).not.toContain('Review')
  })

  it('several open: the earliest review date is drawn, dated before undated, never a teammate\'s', () => {
    const a = page(viewOf([mine(), beas(), mine({ id: 12, action: 'Ask five customers about the annual plan', review_on: '2027-01-15' }), mine({ id: 13, action: 'Write up the trial', review_on: null })]))
    expect(screen.getByTestId('expectation-entry').getAttribute('data-commitment')).toBe('12')
    expect(screen.getByTestId('expectation-entry-action').textContent).toBe('Ask five customers about the annual plan')
    a.unmount()
    page(viewOf([mine({ id: 13, action: 'Write up the trial', review_on: null }), mine()]))
    expect(screen.getByTestId('expectation-entry').getAttribute('data-commitment')).toBe('9')
  })

  it('once the outcome is recorded and the View is read again, the card is gone', () => {
    const r = page(viewOf([mine()]))
    expect(drawn()).not.toBeNull()
    r.rerender(<><ExpectationEntry sid={SID} view={viewOf([mine({ outcomes: [OUTCOME] })])} /><Dock /></>)
    expect(drawn()).toBeNull()
  })
})

describe('the saved-expectation card: its button opens the existing outcome form for that commitment', () => {
  it('opens Team, draws THAT commitment\'s form once and no other, in view with its first field focused; the card itself writes nothing', async () => {
    page(viewOf([mine(), beas()]))
    const version = useUIStore.getState().activeOutputTabVersion
    expect(screen.queryByTestId('team-tab')).toBeNull() // the tab is not drawn yet
    expect(draftOf(`${SID}:outcome:9`)).toBeUndefined()
    await press()
    expect(useUIStore.getState().activeOutputTab).toBe('team')
    // The dock opens a collapsed dock and fronts the results panel on this version (OutputsDock's own consumer).
    expect(useUIStore.getState().activeOutputTabVersion).toBe(version + 1)
    expect((await screen.findAllByTestId('team-outcome-form-9')).length).toBe(1)
    expect(screen.queryByTestId('team-outcome-form-11')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('team-o-9-happened')))
    expect(scrolledTo).toEqual([screen.getByTestId('team-outcome-form-9')])
    expect(writes()).toEqual([])
    // The only write is the form's own, to the existing route.
    fireEvent.change(screen.getByTestId('team-o-9-happened'), { target: { value: 'Twenty-two sign-ups.' } })
    fireEvent.click(within(screen.getByTestId('team-o-9-versus')).getAllByRole('radio')[0]!)
    fireEvent.click(within(screen.getByTestId('team-o-9-triggered')).getAllByRole('radio')[1]!)
    await act(async () => { fireEvent.click(screen.getByTestId('team-o-9-save')) })
    await waitFor(() => expect(writes().length).toBe(1))
    expect(writes()[0]).toEqual({ method: 'POST', path: `/api/scenarios/${SID}/commitments/9/outcomes` })
  })

  it('with several open, the form opened is the one the card drew', async () => {
    page(viewOf([mine(), mine({ id: 12, action: 'Ask five customers about the annual plan', review_on: '2027-01-15' })]))
    await press()
    expect((await screen.findAllByTestId('team-outcome-form-12')).length).toBe(1)
    expect(screen.queryByTestId('team-outcome-form-9')).toBeNull()
  })

  it('a reveal panel filling the Team tab steps aside, and the form is reached', async () => {
    const v = viewOf([mine()], { shared: [{ id: 3, by: 'Bea', by_id: 'p_2', text: 'Hold the price until the trial reports.', skip: false, figures: [], effects: [] }] as unknown as View['collab']['shared'] })
    useUIStore.setState({ activeOutputTab: 'team' }); useReveal.getState().select(3)
    page(v)
    expect(screen.getByTestId('team-tab')).toBeTruthy()
    expect(screen.queryByTestId('team-commitments')).toBeNull() // the panel stands in place of Team's own panels
    await press()
    expect(useReveal.getState().selected).toBeNull()
    expect((await screen.findAllByTestId('team-outcome-form-9')).length).toBe(1)
  })

  it('while an earlier version is drawn, where Team holds its forms, nothing opens', async () => {
    page(viewOf([mine()]))
    useViewStore.setState({ at: 2 })
    await press()
    expect(useUIStore.getState().activeOutputTab).toBe('olumi')
    expect(draftOf(`${SID}:outcome:9`)).toBeUndefined()
  })
})
