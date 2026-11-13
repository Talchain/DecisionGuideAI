/**
 * The Team tab while the View is read again on its own (DL, R2: each person sees the other's input arrive without pressing check). A
 * re-read brings another member's input onto the tab, and NEVER resets or loses what this person is typing in any Team form.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import golden from '../../olumiView/golden/european.view.json'
import type { View } from '../../olumiView/client'
import { useViewStore } from '../../olumiView/store'
import { POLL_MS, useViewPoll } from '../../olumiView/poll'
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
    shared: [{ id: 3, by: 'Bea', by_id: 'p_2', text: 'Hold until the pilot reports.', skip: false, figures: [], effects: [] }],
    mine: [{ id: 4, text: 'Enter one country first.', shared: false, skip: false, figures: [], can_share: false, earlier: false }],
    placeholder: 'Your own view, private until revealed', can_reveal: false, waiting: 'waiting for Bea',
    commitments: [{ id: 9, at: '2026-11-03T10:00:00Z', by: 'Ada', by_id: 'p_1', action: 'Pilot in Germany', owner: 'Bea', owner_id: 'p_2', expect: 'Ten customers by March', reconsider: 'Fewer than five by February', keeps: ['d_1'], option: null, version: null, expect_band: null, review_on: null, trigger: null,
      outcomes: [{ id: 2, at: '2026-11-03T11:00:00Z', by: 'Bea', by_id: 'p_2', happened: 'Seven customers.', versus: 'worse', reconsider_triggered: false, note: null, figure: null, dissent: [] }] }],
    owners: [{ id: 'p_1', name: 'Ada' }, { id: 'p_2', name: 'Bea' }],
    records: [...base.collab.records, { id: 'd_1', family: 'dissent', label: 'Bea: wait for the pilot' }, { id: 'gone', family: 'quantity', label: null }],
    dissent: [{ id: 'd_1', holder: 'Bea', position: 'Wait for the pilot before entering a second country.', holder_id: 'p_2', confirmed: null }],
    effect_headings: base.collab.effect_headings,
    suggested_triggers: [], suggested_triggers_caption: base.collab.suggested_triggers_caption, max_view_figures: base.collab.max_view_figures, view_figures_limit_text: base.collab.view_figures_limit_text, private_view_prompt: null,
    ...over,
  },
  evidence: [{ id: 5, at: '2026-11-03T09:00:00Z', by: 'Bea', by_id: 'p_2', text: 'Churn in DACH was 2 in 100.', source: 'https://example.org/churn', link: 'https://example.org/churn', concerns: [base.collab.records[0]!.id], stance: 'challenges', version: 1, considered: null,
    // N3: core's own words for this evidence (olumi-core src/view/screen-words.ts evidenceWordsOf).
    stance_text: 'Bea: Challenges it', switch_text: 'Bea’s evidence', mark_label: 'Bea · Churn in DACH was 2 in 100.', mark_title: 'Bea · Churn in DACH was 2 in 100. · https://example.org/churn',
    bears_on_text: `Bears on: ${base.collab.records[0]!.label}` }],
  gated: false, // a member who has given their own view: core holds them no longer
  ...view,
})

// `reads` counts the View's own re-reads (what this spec is about), bound to the View's path: the Team panels' own reads (where
// explanations differ, the strategy vocabulary) are not re-reads of the View.
let served: View, reads = 0
beforeEach(() => {
  vi.useFakeTimers()
  reads = 0
  served = twoPeople({ commitments: [{ ...twoPeople().collab.commitments[0]!, outcomes: [] }] })
  setTeamFetch((async (u: unknown, init?: RequestInit) => {
    if ((init?.method ?? 'GET') !== 'GET') return new Response('{}', { status: 201 })
    if (String(u).endsWith('/invites')) return new Response(JSON.stringify({ invites: [] }), { status: 200 })
    if (/\/view\?schema=/.test(String(u))) reads += 1
    return new Response(JSON.stringify(served), { status: 200 })
  }) as unknown as typeof fetch)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: SID, view: served, status: 'ready', error: null, stale: false })
  useMe.setState({ me: { id: 'p_1', name: 'Ada' }, status: 'ready' })
})
afterEach(() => { cleanup(); vi.useRealTimers(); setTeamFetch(null); resetDrafts(); resetWrites(); useMe.setState({ me: null, status: 'none' }) })

function Page() { useViewPoll(true); return <TeamTab /> }
const tick = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }
const type = (id: string, text: string) => fireEvent.change(screen.getByTestId(id), { target: { value: text } })
const value = (id: string) => (screen.getByTestId(id) as HTMLInputElement | HTMLTextAreaElement).value

describe('a re-read on its own, on the Team tab', () => {
  it('Bea\'s evidence, written after Ada\'s last read, is on Ada\'s tab within one interval, with no press', async () => {
    render(<Page />)
    expect(screen.queryByText('Absence doubled last quarter.')).toBeNull()
    served = { ...served, evidence: [...served.evidence, { ...served.evidence[0]!, id: 6, text: 'Absence doubled last quarter.' }] }
    await tick(POLL_MS + 10)
    expect(reads).toBe(1)
    expect(screen.getByText('Absence doubled last quarter.')).toBeTruthy()
  })
  it('never resets or loses what Ada is typing in any Team form: her view, evidence, the next action, an outcome, an invitation', async () => {
    render(<Page />)
    type('team-view-text', 'My view, half written')
    fireEvent.click(screen.getByTestId('team-evidence-open')); type('team-evidence-body', 'Evidence, half written')
    fireEvent.click(screen.getByTestId('team-commitment-open')); type('team-c-action', 'An action, half written')
    fireEvent.click(screen.getByTestId('team-outcome-open-9')); type('team-o-9-happened', 'What happened, half written')
    type('team-invite-name', 'Cy')
    served = { ...served, evidence: [...served.evidence, { ...served.evidence[0]!, id: 6, text: 'Absence doubled last quarter.' }], collab: { ...served.collab, shared: [...served.collab.shared, { id: 7, by: 'Bea', by_id: 'p_2', text: 'A second view.', skip: false, figures: [], effects: [] }] } }
    await tick(POLL_MS + 10)
    await tick(POLL_MS + 10)
    expect(reads).toBe(2)
    expect(screen.getByText('Absence doubled last quarter.')).toBeTruthy() // the re-read landed
    expect(value('team-view-text')).toBe('My view, half written')
    expect(value('team-evidence-body')).toBe('Evidence, half written')
    expect(value('team-c-action')).toBe('An action, half written')
    expect(value('team-o-9-happened')).toBe('What happened, half written')
    expect(value('team-invite-name')).toBe('Cy')
  })
})
