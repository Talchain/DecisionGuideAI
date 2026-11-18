/**
 * THE TEAM TAB IS ONE FLOW (overnight 18 Nov): the current step is read from the View's own fields (`collab.alone`, `gated`, `mine`,
 * `can_reveal`, `waiting`, `shared`, `commitments`), only it is open, with one green press; the others are one line; a press opens any
 * step; a write that moves the flow opens the new current step; a step opened from elsewhere (an outcome form) opens. Each row is bound by
 * the step's id and the View field that decides it, with a contrast that differs in that field alone.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import golden from '../../olumiView/golden/european.view.json'
import type { View } from '../../olumiView/client'
import { useViewStore } from '../../olumiView/store'
import { setTeamFetch } from '../team/api'
import { putDraft, resetDrafts } from '../team/drafts'
import { resetWrites } from '../team/writes'
import { TeamTab } from '../team/TeamTab'
import { inviteNameKey } from '../team/InvitePanel'
import { currentStep, openStep, resetTeamFlow, stepDone, stepSummary, STEP_WORDS, type StepId } from '../team/flow'
import { goToOutcome } from '../team/outcomeNav'
import { useMe } from '../me'

const SID = 's_0123456789ab'
const base = golden as unknown as View
type C = View['collab']
const mine4 = { id: 4, text: 'Enter one country first.', shared: false, skip: false, figures: [], can_share: false, earlier: false }
const bea3 = { id: 3, by: 'Bea', by_id: 'p_2', text: 'Hold until the pilot reports.', skip: false, figures: [], effects: [] }
const k9 = { id: 9, at: '2026-11-03T10:00:00Z', by: 'Ada', by_id: 'p_1', action: 'Pilot in Germany', owner: 'Bea', owner_id: 'p_2', expect: 'Ten customers by March', reconsider: 'Fewer than five by February', keeps: [], option: null, version: null, expect_band: null, review_on: null, trigger: null, outcomes: [] }
const done2 = { id: 2, at: '2026-11-03T11:00:00Z', by: 'Bea', by_id: 'p_2', happened: 'Seven customers.', versus: 'worse', reconsider_triggered: false, note: null, figure: null, dissent: [] }
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
const alone = (): View => team({ alone: true, mine: [], waiting: null, owners: [{ id: 'p_1', name: 'Ada' }] }, { members: [{ id: 'p_1', name: 'Ada' }], team_presence: { title: 'Ada (you)', label: 'Team: Ada (you)', members: [{ id: 'p_1', text: 'Ada (you)' }] } })

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
const isOpen = (id: StepId) => step(id).getAttribute('data-step-open') === '' && !screen.getByTestId(`team-step-${id}-body`).hidden

describe('the current step is the View\'s, field by field', () => {
  it('alone → invite; the same View with a colleague → not invite', () => {
    expect(currentStep(alone())).toBe('invite')
    expect(currentStep(team({ waiting: 'waiting for Bea' }))).not.toBe('invite')
  })
  it('held by core (`gated`) → your view; the same View not held → not your view', () => {
    expect(currentStep(team({}, { gated: true }))).toBe('view')
    expect(currentStep(team({}, { gated: false }))).toBe('reveal')
  })
  it('a view from an earlier round only is not this round\'s: your view is still to give', () => {
    expect(currentStep(team({ mine: [{ ...mine4, earlier: true }] }))).toBe('view')
    expect(currentStep(team({ mine: [{ ...mine4, earlier: false }] }))).toBe('reveal')
  })
  it('core can reveal (`can_reveal`) → reveal, even with views already shown; waiting → reveal', () => {
    expect(currentStep(team({ can_reveal: true, waiting: null, shared: [bea3] }))).toBe('reveal')
    expect(currentStep(team({ can_reveal: false, waiting: 'waiting for Bea', shared: [bea3] }))).toBe('reveal')
    expect(currentStep(team({ can_reveal: false, waiting: null, shared: [bea3] }))).toBe('differ')
  })
  it('a commitment with no outcome does not take over: after the reveal the current step stays "Where you differ" (Codex 008 #3)', () => {
    expect(currentStep(team({ waiting: null, shared: [bea3], commitments: [k9] }))).toBe('differ')
    expect(currentStep(team({ waiting: null, shared: [bea3], commitments: [{ ...k9, outcomes: [done2] }] }))).toBe('differ')
    // and "Where you differ" is never marked finished by a commitment
    expect(stepDone(team({ waiting: null, shared: [bea3], commitments: [k9] }), 'differ')).toBe(false)
  })
  it('a view of yours shown in an earlier round is not this round\'s while the round still waits; once nobody is waited for it is (Codex 008 #1)', () => {
    const mineShown = { ...bea3, id: 5, by: 'Ada', by_id: 'p_1' }
    expect(currentStep(team({ mine: [], shared: [mineShown], waiting: 'waiting for Ada, Bea' }))).toBe('view')
    expect(currentStep(team({ mine: [], shared: [mineShown, bea3], waiting: null }))).toBe('differ')
    // a skip is a contribution this round
    expect(currentStep(team({ mine: [{ ...mine4, skip: true }], waiting: 'waiting for Bea' }))).toBe('reveal')
  })
  it('done marks: commit once a commitment exists, outcome once each has its outcome', () => {
    const one = team({ waiting: null, shared: [bea3], commitments: [k9] })
    expect(stepDone(one, 'commit')).toBe(true)
    expect(stepDone(one, 'outcome')).toBe(false)
    expect(stepDone(team({ waiting: null, shared: [bea3], commitments: [{ ...k9, outcomes: [done2] }] }), 'outcome')).toBe(true)
    expect(stepDone(team({ waiting: null, shared: [bea3] }), 'commit')).toBe(false)
  })
  it('summaries are core\'s words where core has them: the team\'s title, whom the round waits for, the action as written', () => {
    const v = team({ waiting: 'waiting for Bea', commitments: [k9] })
    expect(stepSummary(v, 'invite', null)).toBe('Ada (you), Bea')
    expect(stepSummary(v, 'reveal', null)).toBe('waiting for Bea')
    expect(stepSummary(v, 'commit', null)).toBe('Pilot in Germany')
    expect(stepSummary(alone(), 'invite', null)).toBe(STEP_WORDS.alone)
    expect(stepSummary(team({}, { gated: true }), 'view', null)).toBe(STEP_WORDS.viewToGive)
  })
})

describe('the tab: only the current step open, one green press, any row opens', () => {
  it('a person alone sees the invite open with its lead line and one green press; every other step is one line', () => {
    show(alone())
    render(<TeamTab />)
    expect(isOpen('invite')).toBe(true)
    expect(screen.getByTestId('team-alone').textContent).toBe(STEP_WORDS.aloneLead)
    expect(screen.getByTestId('team-invite-go').className).toContain('bg-success')
    for (const id of ['view', 'reveal', 'differ', 'commit', 'outcome'] as const) {
      expect(isOpen(id)).toBe(false)
      expect(screen.getByTestId(`team-step-${id}-summary`).textContent).not.toBe('')
    }
  })
  it('a member core holds sees their view open first (the private box and its green press), the reveal one line', () => {
    show(team({ mine: [] }, { gated: true }))
    render(<TeamTab />)
    expect(isOpen('view')).toBe(true)
    expect(screen.getByTestId('team-view-give').className).toContain('bg-success')
    expect(isOpen('reveal')).toBe(false)
    expect(screen.queryByTestId('team-step-view-summary')).toBeNull() // an open step shows its body, not its one line
  })
  it('pressing a closed row opens it and closes the current one; pressing it again closes it', () => {
    show(team())
    render(<TeamTab />)
    expect(isOpen('reveal')).toBe(true)
    fireEvent.click(screen.getByTestId('team-step-invite-row'))
    expect(isOpen('invite')).toBe(true)
    expect(isOpen('reveal')).toBe(false)
    expect(screen.getByTestId('team-step-invite-row').getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(screen.getByTestId('team-step-invite-row'))
    expect(isOpen('invite')).toBe(false)
  })
  it('a closed step stays mounted: a name typed in the invite form survives opening another step', () => {
    show(team())
    render(<TeamTab />)
    fireEvent.click(screen.getByTestId('team-step-invite-row'))
    fireEvent.change(screen.getByTestId('team-invite-name'), { target: { value: 'Cara' } })
    fireEvent.click(screen.getByTestId('team-step-commit-row'))
    expect(isOpen('invite')).toBe(false)
    expect((screen.getByTestId('team-invite-name') as HTMLInputElement).value).toBe('Cara')
  })
  it('when the View moves the flow on, the new current step opens (the person\'s earlier choice was under the old one)', () => {
    show(team({ mine: [] }, { gated: true }))
    const r = render(<TeamTab />)
    expect(isOpen('view')).toBe(true)
    fireEvent.click(screen.getByTestId('team-step-invite-row'))
    expect(isOpen('invite')).toBe(true)
    // Their view is in, and core now says everyone's is: the current step is the reveal, and it opens.
    act(() => { show(team({ can_reveal: true, waiting: null })) })
    r.rerender(<TeamTab />)
    expect(isOpen('reveal')).toBe(true)
    expect(isOpen('invite')).toBe(false)
    expect(screen.getByTestId('team-reveal-go')).toBeTruthy()
  })
  it('the header\'s "named in the brief" notice (a name put in the invite draft) opens the invite step', () => {
    show(team())
    render(<TeamTab />)
    expect(isOpen('invite')).toBe(false)
    act(() => { putDraft<string>(inviteNameKey(SID), () => 'Cara') })
    expect(isOpen('invite')).toBe(true)
  })
  it('an outcome form opened from elsewhere (goToOutcome) opens "What happened" with that form', async () => {
    show(team({ waiting: null, shared: [bea3], commitments: [{ ...k9, outcomes: [done2] }, { ...k9, id: 10, action: 'Ask two customers' }] }))
    render(<TeamTab />)
    expect(isOpen('differ')).toBe(true)
    expect(isOpen('outcome')).toBe(false)
    await act(async () => { goToOutcome(SID, 10) })
    await waitFor(() => expect(isOpen('outcome')).toBe(true))
    expect(screen.getByTestId('team-outcome-form-10')).toBeTruthy()
  })
  it('openStep from the comparison\'s Commit opens the Commit step', () => {
    show(team({ waiting: null, shared: [bea3] }))
    render(<TeamTab />)
    expect(isOpen('differ')).toBe(true)
    act(() => { openStep('commit') })
    expect(isOpen('commit')).toBe(true)
  })
  it('whose view is in: yours once given (a mark on your initial), another member\'s once revealed to you, nobody else\'s', () => {
    show(team({ waiting: null, shared: [bea3] }))
    const r = render(<TeamTab />)
    expect(screen.getByTestId('team-member-p_1').hasAttribute('data-view-in')).toBe(true)
    expect(screen.getByTestId('team-member-p_2').hasAttribute('data-view-in')).toBe(true)
    r.unmount()
    show(team({ shared: [] }, { gated: true }))
    render(<TeamTab />)
    expect(screen.getByTestId('team-member-p_1').hasAttribute('data-view-in')).toBe(false)
    expect(screen.getByTestId('team-member-p_2').hasAttribute('data-view-in')).toBe(false)
  })
  it('the reveal step\'s green press goes to core\'s reveal route, and nothing else is written', async () => {
    show(team({ can_reveal: true, waiting: null }))
    render(<TeamTab />)
    fireEvent.click(screen.getByTestId('team-reveal-go'))
    await waitFor(() => expect(calls.filter((c) => c.method === 'POST').map((c) => c.path)).toEqual([`/api/scenarios/${SID}/reveal`]))
  })
})
