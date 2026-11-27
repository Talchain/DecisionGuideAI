/**
 * THE TEAM TAB IS ONE FLOW (overnight 18 Nov): the current step is read from the View's own fields (`collab.alone`, `gated`, `mine`,
 * `can_reveal`, `waiting`, `shared`, `commitments`), only it is open, with one green press; the others are one line; a press opens any
 * step; a write that moves the flow opens the new current step; a step opened from elsewhere (an outcome form) opens. Each row is bound by
 * the step's id and the View field that decides it, with a contrast that differs in that field alone.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import golden from '../../olumiView/golden/european.view.json'
import type { View } from '../../olumiView/client'
import { useViewStore } from '../../olumiView/store'
import { setTeamFetch } from '../team/api'
import { putDraft, resetDrafts } from '../team/drafts'
import { resetWrites } from '../team/writes'
import { TeamTab } from '../team/TeamTab'
import { inviteNameKey } from '../team/InvitePanel'
import { currentStep, openStep, resetTeamFlow, stepDone, stepSummary, STEP_ORDER, STEP_WORDS, type StepId } from '../team/flow'
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
const invite = () => screen.getByTestId('team-invite-menu-trigger')
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
  it('a new round that waits for others, with two people\'s views already revealed (core\'s TM-04 shape), leads with where you differ; contrast: one view revealed → reveal', () => {
    const adaShown = { ...bea3, id: 5, by: 'Ada', by_id: 'p_1' }
    expect(currentStep(team({ can_reveal: false, waiting: 'waiting for Bea', mine: [], shared: [bea3, adaShown] }))).toBe('differ')
    expect(currentStep(team({ can_reveal: false, waiting: 'waiting for Bea', mine: [], shared: [adaShown] }))).toBe('reveal')
    // a skip is not a view
    expect(currentStep(team({ can_reveal: false, waiting: 'waiting for Bea', mine: [], shared: [{ ...bea3, skip: true }, adaShown] }))).toBe('reveal')
    // the reveal step still says whom the round waits for, in core's words
    expect(stepSummary(team({ can_reveal: false, waiting: 'waiting for Bea', mine: [], shared: [bea3, adaShown] }), 'reveal', null)).toBe('waiting for Bea')
  })
  it('a commitment with no outcome does not take over: after the reveal the current step stays "Where you differ" (Codex 008 #3)', () => {
    expect(currentStep(team({ waiting: null, shared: [bea3], commitments: [k9] }))).toBe('differ')
    expect(currentStep(team({ waiting: null, shared: [bea3], commitments: [{ ...k9, outcomes: [done2] }] }))).toBe('differ')
    // and "Where you differ" is never marked finished by a commitment
    expect(stepDone(team({ waiting: null, shared: [bea3], commitments: [k9] }), 'differ')).toBe(false)
  })
  it('a view of yours shown early counts while the round still waits (core moves it out of `mine`, measured on 9ad89f81); one from an earlier round in `mine` does not (Codex 008 #1)', () => {
    const mineShown = { ...bea3, id: 5, by: 'Ada', by_id: 'p_1' }
    // Core's own sequence: after "show yours now" the view is in `shared`, `mine` is empty, the round still waits for Bea.
    expect(currentStep(team({ mine: [], shared: [mineShown], waiting: 'waiting for Bea' }))).toBe('reveal')
    expect(stepSummary(team({ mine: [], shared: [mineShown], waiting: 'waiting for Bea' }), 'view', null)).toBe(STEP_WORDS.viewShared)
    // Contrast: only an earlier round's view of yours, nothing shown: your view is still to give.
    expect(currentStep(team({ mine: [{ ...mine4, earlier: true }], shared: [], waiting: 'waiting for Ada, Bea' }))).toBe('view')
    // and an invited owner who has given nothing yet is on their own view, not the reveal
    expect(currentStep(team({ mine: [], shared: [], waiting: 'waiting for Ada, Bea' }))).toBe('view')
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
  it('a person alone can open the invite from the header; every other step is one line', () => {
    show(alone())
    render(<TeamTab />)
    expect(isOpen('invite')).toBe(true)
    expect(screen.getByTestId('team-alone').textContent).toBe(STEP_WORDS.aloneLead)
    expect(screen.queryByTestId('team-invite-name')).toBeNull()
    expect(screen.getByRole('button', { name: 'Invite a colleague' })).toBe(invite())
    fireEvent.click(invite())
    expect(screen.getByTestId('team-invite-go').className).toContain('bg-success')
    expect(document.activeElement).toBe(screen.getByTestId('team-invite-name'))
    for (const id of ['view', 'reveal', 'differ', 'commit', 'outcome'] as const) {
      expect(isOpen(id)).toBe(false)
      expect(screen.getByTestId(`team-step-${id}-summary`).textContent).not.toBe('')
      expect(screen.getByTestId(`team-step-${id}-summary`).className, `${id} summary is whole, never clipped`).not.toContain('truncate')
    }
  })
  it('the steps still to come are folded behind "Where this goes" (hidden, still mounted); the press shows them, and it is the only extra control', () => {
    show(alone())
    render(<TeamTab />)
    const row = (id: StepId) => step(id).closest('li')!
    for (const id of ['view', 'reveal', 'differ', 'commit', 'outcome'] as const) expect(row(id).hidden, `${id} folded`).toBe(true)
    expect(row('invite').hidden, 'CONTRAST: the current step is shown').toBe(false)
    const press = screen.getByTestId('team-steps-later')
    expect(press.textContent).toBe(STEP_WORDS.whereThisGoes); expect(press.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(press)
    for (const id of STEP_ORDER) expect(row(id).hidden, `${id} shown after the press`).toBe(false)
    expect(press.getAttribute('aria-expanded')).toBe('true')
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
  it('allows Tab through the invite form and Escape returns focus without losing the draft', async () => {
    show(team())
    render(<TeamTab />)
    fireEvent.click(invite())
    const name = screen.getByTestId('team-invite-name') as HTMLInputElement
    fireEvent.change(name, { target: { value: 'Cara' } })
    const keyboard = userEvent.setup()
    await keyboard.tab()
    expect(document.activeElement).toBe(screen.getByTestId('team-invite-go'))
    await keyboard.keyboard('{Escape}')
    expect(screen.queryByTestId('team-invite-name')).toBeNull()
    expect(document.activeElement).toBe(invite())
    fireEvent.click(invite())
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
  it('opens the invite menu when the header’s named colleague is put in the draft', () => {
    show(team())
    render(<TeamTab />)
    expect(invite().getAttribute('aria-expanded')).toBe('false')
    act(() => { putDraft<string>(inviteNameKey(SID), () => 'Cara') })
    expect(invite().getAttribute('aria-expanded')).toBe('true')
    expect((screen.getByTestId('team-invite-name') as HTMLInputElement).value).toBe('Cara')
  })
  it('keeps the one-time link through a View refresh and closing and reopening the invite menu', async () => {
    show(alone())
    render(<TeamTab />)
    fireEvent.click(invite())
    fireEvent.change(screen.getByTestId('team-invite-name'), { target: { value: 'Cara' } })
    fireEvent.click(screen.getByTestId('team-invite-go'))
    const link = () => (screen.getByTestId('team-invite-link') as HTMLInputElement).value
    await waitFor(() => expect(link()).toContain('/k/tok'))
    const originalLink = link()
    act(() => { show(team({ mine: [], waiting: 'waiting for Ada, Cara' })) })
    expect(isOpen('view')).toBe(true)
    expect(link()).toBe(originalLink)
    fireEvent.click(invite())
    expect(screen.queryByTestId('team-invite-link')).toBeNull()
    fireEvent.click(invite())
    expect(link()).toBe(originalLink)
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1)
  })
  it('opens the header invite menu with a name provided before Team mounts', () => {
    show(team())
    putDraft<string>(inviteNameKey(SID), () => 'Cara')
    render(<TeamTab />)
    expect(invite().getAttribute('aria-expanded')).toBe('true')
    expect((screen.getByTestId('team-invite-name') as HTMLInputElement).value).toBe('Cara')
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
  it('marks my private view and only contributions Core revealed to me', () => {
    const ada = () => within(screen.getByTestId('team-member-p_1'))
    const bea = () => within(screen.getByTestId('team-member-p_2'))
    show(team({ can_reveal: true, shared: [] }))
    render(<TeamTab />)
    expect(ada().getByTestId('team-contribution-private')).toBeTruthy()
    expect(bea().queryByTestId(/^team-contribution-/)).toBeNull()
    expect(screen.queryByText(bea3.text)).toBeNull()

    act(() => show(team({ mine: [{ ...mine4, shared: true, skip: false }], shared: [] })))
    expect(ada().getByTestId('team-contribution-given')).toBeTruthy()

    const heldFigure = {
      quantity: 'staff_absence', label: 'Staff absence', text: '42 weeks', title: '42 weeks', unit: 'week', version: 1,
      value: 42, mark_text: 'Bea: 42 weeks', mark_label: 'Bea: Staff absence, 42 weeks',
    }
    act(() => show(team({ mine: [], shared: [{ ...bea3, figures: [heldFigure] }] }, { gated: true })))
    expect(bea().queryByTestId(/^team-contribution-/)).toBeNull()
    expect(screen.queryByText(bea3.text)).toBeNull()
    expect(screen.queryByText(heldFigure.text)).toBeNull()

    act(() => show(team({ shared: [{ ...bea3, skip: true }] })))
    expect(bea().queryByTestId(/^team-contribution-/)).toBeNull()

    act(() => show(team({ mine: [], shared: [bea3, { ...bea3, id: 5, by_id: 'p_1' }] })))
    expect(ada().getByTestId('team-contribution-revealed')).toBeTruthy()
    expect(bea().getByTestId('team-contribution-revealed')).toBeTruthy()
  })
  it('after the reveal the finished steps before "Where you differ" are one line of names (Paul 18 Nov); each still opens; contrast: before the reveal there is no such line', () => {
    const after = team({ waiting: null, mine: [], shared: [bea3, { ...bea3, id: 5, by: 'Ada', by_id: 'p_1' }] })
    expect(currentStep(after)).toBe('differ')
    show(after)
    const r = render(<TeamTab />)
    const compact = () => [...document.querySelectorAll('[data-step-compact]')].map((s) => s.getAttribute('data-testid'))
    expect(compact()).toEqual(['team-step-invite', 'team-step-view', 'team-step-reveal'])
    expect(screen.getByTestId('team-step-differ').hasAttribute('data-step-open')).toBe(true)
    expect(screen.getByTestId('team-step-differ').hasAttribute('data-step-compact')).toBe(false)
    // A finished step still opens on a press, and then the steps are rows again.
    const body = screen.getByTestId('team-step-invite-body')
    fireEvent.click(screen.getByTestId('team-step-view-row'))
    expect(compact()).toEqual([])
    expect(screen.getByTestId('team-step-view').hasAttribute('data-step-open')).toBe(true)
    // Shrinking and growing never remounts a step's body (Codex review 2 #4: drafts stay in their step bodies): the same element.
    expect(screen.getByTestId('team-step-invite-body')).toBe(body)
    r.unmount(); resetTeamFlow()
    // Contrast: the same team before the reveal (the round still waits): every step is a row.
    show(team({ waiting: 'waiting for Bea' }))
    render(<TeamTab />)
    expect(compact()).toEqual([])
  })
  it('the reveal step\'s green press goes to core\'s reveal route, and nothing else is written', async () => {
    show(team({ can_reveal: true, waiting: null }))
    render(<TeamTab />)
    fireEvent.click(screen.getByTestId('team-reveal-go'))
    await waitFor(() => expect(calls.filter((c) => c.method === 'POST').map((c) => c.path)).toEqual([`/api/scenarios/${SID}/reveal`]))
  })
})
