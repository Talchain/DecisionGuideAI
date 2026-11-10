/**
 * R2b TEAM FIELDS (DL 4 Nov; boards 15b, 20 and 21): the holder confirms or rewords their dissent; a commitment names the option and the
 * version it was made against, with a review date and the option's band frozen; an outcome takes a figure and the team's verdict on each
 * dissent the commitment keeps. The fields are core's (olumi.view/3, vendored at d1fe5e2), set on core's european golden by hand for each
 * case, in the View's own shape. Every word shown is core's or the person's.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import golden from '../../olumiView/golden/european.view.json'
import type { View } from '../../olumiView/client'
import { useViewStore } from '../../olumiView/store'
import { setPagePerson, setTeamFetch } from '../team/api'
import { resetDrafts } from '../team/drafts'
import { resetWrites } from '../team/writes'
import { TeamTab } from '../team/TeamTab'
import { NO_OPTION_YET, NO_OPTION_YET_WORDS } from '../team/CommitmentPanel'
import { useMe } from '../me'

const SID = 's_0123456789ab'
const base = golden as unknown as View
/** core's own words for each option's outcome band in version 1 (the golden's chance rows). */
const BAND = 'between 382 and 1,420 customers (middle 528)'
type Over = Record<string, unknown>
const teamView = (you: 'p_1' | 'p_2', over: Over = {}): View => ({
  ...base, id: SID, you: you === 'p_1' ? 'Ada' : 'Bea', you_id: you,
  members: [{ id: 'p_1', name: 'Ada' }, { id: 'p_2', name: 'Bea' }],
  collab: {
    ...base.collab, alone: false, heading: 'Team views · 2', open: true, shared: [], mine: [], can_reveal: false, waiting: null,
    commitments: [],
    owners: [{ id: 'p_1', name: 'Ada' }, { id: 'p_2', name: 'Bea' }],
    records: [...base.collab.records, { id: 'd_1', family: 'dissent', label: 'Bea: wait for the pilot' }],
    dissent: [{ id: 'd_1', holder: 'Bea', holder_id: 'p_2', position: 'Wait for the pilot before entering a second country.', confirmed: null }],
    ...over,
  },
  evidence: [],
} as unknown as View)
const commitment = (over: Over = {}) => ({
  id: 9, at: '2026-11-04T10:00:00Z', by: 'Ada', by_id: 'p_1', action: 'Pilot in Germany', owner: 'Bea', owner_id: 'p_2', expect: 'Ten customers by March', reconsider: 'Fewer than five by February', keeps: ['d_1'], outcomes: [],
  option: { id: 'single_country_test', heading: 'Test one country before broader commitment' }, version: 1, review_on: '2026-12-01',
  expect_band: { low: 382, median: 528, high: 1420, unit: 'customers', text: BAND }, ...over,
})

let calls: Array<{ method: string; path: string; body: unknown }> = []
let answer: { status: number; body: unknown } | null = null
const serve = (v: View) => {
  setTeamFetch((async (u: unknown, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push({ method, path: String(u), body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (String(u) === '/api/me') return new Response(JSON.stringify({ me: { id: v.you_id, name: v.you } }), { status: 200 })
    if (String(u).endsWith('/invites')) return new Response(JSON.stringify({ invites: [] }), { status: 200 })
    if (method === 'POST' && answer) return new Response(JSON.stringify(answer.body), { status: answer.status })
    return new Response(JSON.stringify(method === 'GET' ? v : { ok: 1 }), { status: method === 'GET' ? 200 : 201 })
  }) as unknown as typeof fetch)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: SID, view: v, status: 'ready', error: null, stale: false })
  useMe.setState({ me: { id: v.you_id, name: v.you }, status: 'ready' })
}
beforeEach(() => { calls = []; answer = null })
afterEach(() => { cleanup(); setTeamFetch(null); setPagePerson(null); resetDrafts(); resetWrites(); useMe.setState({ me: null, status: 'none' }); useViewStore.setState({ at: null }) })
const posts = () => calls.filter((c) => c.method === 'POST' && c.path !== '/api/me')
const reread = () => calls.filter((c) => c.method === 'GET' && c.path === `/api/scenarios/${SID}/view?schema=3`).length

const fillCommitment = () => {
  fireEvent.click(screen.getByTestId('team-commitment-open'))
  fireEvent.change(screen.getByTestId('team-c-action'), { target: { value: 'Run the pilot' } })
  fireEvent.change(screen.getByTestId('team-c-owner'), { target: { value: 'p_2' } })
  fireEvent.change(screen.getByTestId('team-c-reconsider'), { target: { value: 'Under five' } })
}

describe('a commitment names its option and version, with a review date and the option\'s band (board 20)', () => {
  it('the option is the person\'s choice among the model\'s options, unset; nothing is saved until one is chosen', () => {
    serve(teamView('p_1'))
    render(<TeamTab />)
    fillCommitment()
    fireEvent.change(screen.getByTestId('team-c-expect'), { target: { value: 'Ten by March' } })
    const select = screen.getByTestId('team-c-option') as HTMLSelectElement
    expect(select.value).toBe('')
    // DL 10 Nov: the model's options, then the team's own "no option yet" (gathering evidence); none is preset.
    expect([...select.options].filter((o) => !o.disabled).map((o) => o.textContent)).toEqual([...base.model!.cards.filter((c) => c.family === 'option').map((c) => c.heading), NO_OPTION_YET_WORDS])
    expect((screen.getByTestId('team-commitment-save') as HTMLButtonElement).disabled).toBe(true)
  })

  it('an option the model no longer holds live is not offered (core refuses a commitment to it)', () => {
    const cards = base.model!.cards.map((c) => (c.id === 'no_new_european_entry' ? { ...c, status: 'Set aside in version 1' } : c))
    serve({ ...teamView('p_1'), model: { ...base.model!, cards } } as View)
    render(<TeamTab />)
    fillCommitment()
    const offered = [...(screen.getByTestId('team-c-option') as HTMLSelectElement).options].map((o) => o.value)
    expect(offered).toContain('single_country_test')
    expect(offered).not.toContain('no_new_european_entry')
  })

  it('the model\'s band for the option appears only after what the team expects is written, in core\'s words', () => {
    serve(teamView('p_1'))
    render(<TeamTab />)
    fillCommitment()
    fireEvent.change(screen.getByTestId('team-c-option'), { target: { value: 'single_country_test' } })
    expect(screen.queryByTestId('team-c-band')).toBeNull()
    fireEvent.change(screen.getByTestId('team-c-expect'), { target: { value: 'Ten by March' } })
    expect(screen.getByTestId('team-c-band').textContent).toContain(BAND)
  })

  it('it is saved with the option, the version on screen and the review date', async () => {
    serve(teamView('p_1'))
    render(<TeamTab />)
    fillCommitment()
    fireEvent.change(screen.getByTestId('team-c-option'), { target: { value: 'single_country_test' } })
    fireEvent.change(screen.getByTestId('team-c-expect'), { target: { value: 'Ten by March' } })
    fireEvent.change(screen.getByTestId('team-c-review-on'), { target: { value: '2026-12-01' } })
    fireEvent.click(screen.getByTestId('team-commitment-save'))
    await waitFor(() => expect(reread()).toBe(1))
    expect(posts()[0]).toEqual({ method: 'POST', path: `/api/scenarios/${SID}/commitments`, body: { action: 'Run the pilot', owner: 'p_2', expect: 'Ten by March', reconsider: 'Under five', keeps: [], option: 'single_country_test', version: 1, review_on: '2026-12-01' } })
  })

  it('a version that is no longer the latest is refused in core\'s words, and nothing is cleared', async () => {
    serve(teamView('p_1'))
    answer = { status: 409, body: { error: 'This was made against version 1; the latest is version 2. Review version 2 first.' } }
    render(<TeamTab />)
    fillCommitment()
    fireEvent.change(screen.getByTestId('team-c-option'), { target: { value: 'single_country_test' } })
    fireEvent.change(screen.getByTestId('team-c-expect'), { target: { value: 'Ten by March' } })
    fireEvent.click(screen.getByTestId('team-commitment-save'))
    await waitFor(() => expect(screen.getByTestId('team-commitment-error').textContent).toBe('This was made against version 1; the latest is version 2. Review version 2 first.'))
    expect((screen.getByTestId('team-c-action') as HTMLTextAreaElement).value).toBe('Run the pilot')
  })

  it('a saved commitment shows its option, version, review date and frozen band as core holds them; absent, nothing', () => {
    serve(teamView('p_1', { commitments: [commitment(), commitment({ id: 10, option: null, version: null, review_on: null, expect_band: null })] }))
    render(<TeamTab />)
    const k = screen.getByTestId('team-commitment-9')
    expect(within(k).getByTestId('team-commitment-option-9').textContent).toBe('Test one country before broader commitment · version 1')
    expect(within(k).getByTestId('team-commitment-review-9').textContent).toContain('2026-12-01')
    expect(within(k).getByTestId('team-commitment-band-9').textContent).toContain(BAND)
    const old = screen.getByTestId('team-commitment-10')
    for (const id of ['option', 'review', 'band']) expect(within(old).queryByTestId(`team-commitment-${id}-10`)).toBeNull()
  })
})

describe('a View from a core before R2b (no R2b keys at all): the Team tab draws what it has and never crashes (R2 cut, the EvidencePanel twin)', () => {
  it('a commitment, its outcome and a dissent with none of the R2b keys: no option, review day, band, figure or verdict line, and the dissent reads as unconfirmed', () => {
    const older = { id: 9, at: '2026-11-04T10:00:00Z', by: 'Ada', by_id: 'p_1', action: 'Pilot in Germany', owner: 'Bea', owner_id: 'p_2', expect: 'Ten customers by March', reconsider: 'Fewer than five by February', keeps: ['d_1'],
      outcomes: [{ id: 2, at: '2026-11-04T11:00:00Z', by: 'Bea', by_id: 'p_2', happened: 'Seven.', versus: 'worse', reconsider_triggered: false, note: null }] }
    serve(teamView('p_2', { commitments: [older], dissent: [{ id: 'd_1', holder: 'Bea', position: 'Wait for the pilot before entering a second country.' }] }))
    render(<TeamTab />)
    const k = screen.getByTestId('team-commitment-9')
    expect(k.textContent).toContain('Pilot in Germany')
    for (const id of ['team-commitment-option-9', 'team-commitment-review-9', 'team-commitment-band-9', 'team-outcome-figure-2']) expect(screen.queryByTestId(id)).toBeNull()
    expect(screen.queryAllByTestId(/^team-outcome-verdict-2-/)).toHaveLength(0)
    expect(screen.getByTestId('team-dissent-state-d_1').textContent).toBe('Not yet confirmed. No member is named as its holder, so no one can confirm it.')
    expect(screen.queryByTestId('team-dissent-confirm-d_1')).toBeNull()
    // Its outcome form opens and asks for no figure (no band) and no verdict a core before R2b cannot take.
    fireEvent.click(screen.getByTestId('team-outcome-open-9'))
    expect(screen.getByTestId('team-outcome-form-9')).toBeTruthy()
    expect(screen.queryByTestId('team-o-9-figure')).toBeNull()
  })
})

describe('R2 review P1-2: the option and its band are the APPROVED model\'s, never a held proposal\'s', () => {
  it('while Olumi holds a proposal, its options and bands are not offered as version n\'s: the choice and the save wait, and say why', () => {
    // The View's model while a proposal is held is the proposal's (store.ts currentModel): a different heading and band here.
    const held = { ...base.model!, cards: base.model!.cards.map((x) => (x.family === 'option' ? { ...x, heading: `PROPOSED ${x.heading}`, rows: x.rows.map((r) => (r.kind === 'chance' && r.outcome ? { ...r, outcome: { ...r.outcome, text: 'PROPOSED BAND' } } : r)) } : x)) }
    serve({ ...teamView('p_1'), model: held, proposal: { id: 7 } } as unknown as View)
    render(<TeamTab />)
    fillCommitment()
    fireEvent.change(screen.getByTestId('team-c-expect'), { target: { value: 'Ten by March' } })
    expect(screen.queryByTestId('team-c-option')).toBeNull()
    expect(screen.queryByTestId('team-c-band')).toBeNull()
    expect(screen.getByTestId('team-commitment-form').textContent).not.toContain('PROPOSED')
    expect(screen.getByTestId('team-c-pending').textContent).toBe('The option is chosen from the approved model. Approve or set aside the proposal in the chat first.')
    expect((screen.getByTestId('team-commitment-save') as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('R2 review P1-4: a dissent its holder confirmed is read in their confirmed words, as the Disagreements panel reads it', () => {
  it('beside the choice to keep it open, and in the outcome\'s verdict on it', () => {
    const confirmed = { at: '2026-11-04T09:00:00Z', by_id: 'p_2', words: 'Wait for the German pilot to report first.', tell: null }
    serve(teamView('p_1', { dissent: [{ id: 'd_1', holder: 'Bea', holder_id: 'p_2', position: 'Wait for the pilot before entering a second country.', confirmed }], commitments: [commitment()] }))
    render(<TeamTab />)
    fillCommitment()
    expect(screen.getByTestId('team-c-keeps').textContent).toContain('Bea: Wait for the German pilot to report first.')
    expect(screen.getByTestId('team-c-keeps').textContent).not.toContain('Wait for the pilot before entering a second country.')
    fireEvent.click(screen.getByTestId('team-outcome-open-9'))
    const v = screen.getByTestId('team-o-9-verdict-d_1')
    expect(v.textContent).toContain('Bea: Wait for the German pilot to report first.')
    expect(v.textContent).not.toContain('Wait for the pilot before entering a second country.')
  })
})

describe('a kept dissent carries its holder\'s tell, word for word (board 20; DL 4 Nov)', () => {
  const confirmed = [{ id: 'd_1', holder: 'Bea', holder_id: 'p_2', position: 'Wait for the pilot before entering a second country.',
    confirmed: { at: '2026-11-04T09:00:00Z', by_id: 'p_2', words: 'Wait for the pilot before entering a second country.', tell: 'Five customers in the first month.' } }]
  it('beside the dissent offered to keep open, and beside the commitment that keeps it', () => {
    serve(teamView('p_1', { dissent: confirmed, commitments: [commitment()] }))
    render(<TeamTab />)
    expect(screen.getByTestId('team-commitment-keeps-tell-9-d_1').textContent).toBe('Bea: what would tell them they are wrong: Five customers in the first month.')
    fillCommitment()
    expect(screen.getByTestId('team-c-keep-tell-d_1').textContent).toBe('What would tell Bea they are wrong: Five customers in the first month.')
  })
  it('no tell given (or not yet confirmed): nothing is drawn for it', () => {
    serve(teamView('p_1', { commitments: [commitment()] }))
    render(<TeamTab />)
    expect(screen.queryByTestId('team-commitment-keeps-tell-9-d_1')).toBeNull()
    fillCommitment()
    expect(screen.queryByTestId('team-c-keep-tell-d_1')).toBeNull()
  })
})

describe('an outcome takes a figure and the team\'s verdict on each dissent kept open (board 21)', () => {
  it('one verdict per kept dissent, none preset and all needed; the figure is optional; both are sent', async () => {
    serve(teamView('p_2', { commitments: [commitment()] }))
    render(<TeamTab />)
    fireEvent.click(screen.getByTestId('team-outcome-open-9'))
    fireEvent.change(screen.getByTestId('team-o-9-happened'), { target: { value: 'Eight.' } })
    fireEvent.click(screen.getAllByLabelText('Mixed')[0]!)
    fireEvent.click(screen.getAllByLabelText('No, it did not')[0]!)
    const v = screen.getByTestId('team-o-9-verdict-d_1')
    expect(v.textContent).toContain('Bea: Wait for the pilot before entering a second country.')
    expect(within(v).getAllByRole('radio').every((r) => !(r as HTMLInputElement).checked)).toBe(true)
    expect((screen.getByTestId('team-o-9-save') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(within(v).getByLabelText('Partly right'))
    fireEvent.change(screen.getByTestId('team-o-9-figure'), { target: { value: '8' } })
    fireEvent.click(screen.getByTestId('team-o-9-save'))
    await waitFor(() => expect(reread()).toBe(1))
    expect(posts()[0]).toMatchObject({ path: `/api/scenarios/${SID}/commitments/9/outcomes`, body: { happened: 'Eight.', versus: 'mixed', reconsider_triggered: false, figure: 8, dissent: [{ id: 'd_1', verdict: 'partly_right' }], op: expect.any(String) } })
  })

  it('a commitment with no band frozen asks for no figure (core takes none without one), and no figure typed sends none', async () => {
    serve(teamView('p_2', { commitments: [commitment({ expect_band: null })] }))
    render(<TeamTab />)
    fireEvent.click(screen.getByTestId('team-outcome-open-9'))
    expect(screen.queryByTestId('team-o-9-figure')).toBeNull()
  })

  it('no figure typed: none is sent; a commitment keeping no dissent asks for no verdict', async () => {
    serve(teamView('p_2', { commitments: [commitment({ keeps: [] })] }))
    render(<TeamTab />)
    fireEvent.click(screen.getByTestId('team-outcome-open-9'))
    expect(screen.queryByTestId('team-o-9-verdict-d_1')).toBeNull()
    fireEvent.change(screen.getByTestId('team-o-9-happened'), { target: { value: 'Eight.' } })
    fireEvent.click(screen.getAllByLabelText('Mixed')[0]!)
    fireEvent.click(screen.getAllByLabelText('No, it did not')[0]!)
    fireEvent.click(screen.getByTestId('team-o-9-save'))
    await waitFor(() => expect(reread()).toBe(1))
    const body = posts()[0]!.body as Record<string, unknown>
    expect('figure' in body || 'dissent' in body).toBe(false)
  })

  it('a recorded outcome shows its figure and each verdict in core\'s words, by whom', () => {
    const outcomes = [{ id: 2, at: '2026-11-04T11:00:00Z', by: 'Bea', by_id: 'p_2', happened: 'Seven customers.', versus: 'worse', reconsider_triggered: false, note: null,
      figure: { value: 7, unit: 'customers', text: '7 customers' }, dissent: [{ id: 'd_1', verdict: 'resolved', by: 'Bea' }] }]
    serve(teamView('p_1', { commitments: [commitment({ outcomes })] }))
    render(<TeamTab />)
    expect(screen.getByTestId('team-outcome-figure-2').textContent).toContain('7 customers')
    expect(screen.getByTestId('team-outcome-verdict-2-d_1').textContent).toBe('Bea: wait for the pilot · Resolved · Bea')
  })
})

describe('the holder confirms or rewords their dissent; only the holder (board 15b)', () => {
  it('every member sees each disagreement in the holder\'s words, and whether its holder has confirmed them', () => {
    serve(teamView('p_1', { dissent: [
      { id: 'd_1', holder: 'Bea', holder_id: 'p_2', position: 'Wait for the pilot before entering a second country.', confirmed: null },
      { id: 'd_2', holder: 'Ada', holder_id: 'p_1', position: 'Enter both now.', confirmed: { at: '2026-11-04T09:00:00Z', by_id: 'p_1', words: 'Enter both now.', tell: 'Churn above 5 in 100 in the first quarter.' } },
    ] }))
    render(<TeamTab />)
    expect(screen.getByTestId('team-dissent-d_1').textContent).toContain('Bea: Wait for the pilot before entering a second country.')
    expect(screen.getByTestId('team-dissent-state-d_1').textContent).toBe('Not yet confirmed by Bea. Only Bea can confirm it.')
    expect(screen.getByTestId('team-dissent-state-d_2').textContent).toBe('Confirmed by Ada')
    expect(screen.getByTestId('team-dissent-tell-d_2').textContent).toContain('Churn above 5 in 100 in the first quarter.')
  })

  it('someone else\'s dissent offers no confirm or reword; nor does one whose holder core does not name', () => {
    serve(teamView('p_1', { dissent: [{ id: 'd_1', holder: 'Bea', holder_id: 'p_2', position: 'Wait.', confirmed: null }, { id: 'd_3', holder: 'Ada', holder_id: null, position: 'Go.', confirmed: null }] }))
    render(<TeamTab />)
    for (const id of ['d_1', 'd_3']) {
      expect(screen.queryByTestId(`team-dissent-confirm-${id}`)).toBeNull()
      expect(screen.queryByTestId(`team-dissent-reword-${id}`)).toBeNull()
    }
  })

  it('the holder confirms their words as they stand, with what would tell them they are wrong', async () => {
    serve(teamView('p_2'))
    render(<TeamTab />)
    fireEvent.change(screen.getByTestId('team-dissent-tell-input-d_1'), { target: { value: 'Five customers in the first month.' } })
    fireEvent.click(screen.getByTestId('team-dissent-confirm-d_1'))
    await waitFor(() => expect(reread()).toBe(1))
    expect(posts()[0]).toEqual({ method: 'POST', path: `/api/scenarios/${SID}/dissent/d_1/confirm`, body: { words: 'Wait for the pilot before entering a second country.', tell: 'Five customers in the first month.' } })
  })

  it('the holder rewords it: their new words, exactly as typed, and no tell when none is given', async () => {
    serve(teamView('p_2'))
    render(<TeamTab />)
    fireEvent.click(screen.getByTestId('team-dissent-reword-d_1'))
    const box = screen.getByTestId('team-dissent-words-d_1') as HTMLTextAreaElement
    expect(box.value).toBe('Wait for the pilot before entering a second country.')
    fireEvent.change(box, { target: { value: 'Wait for the German pilot to report first.' } })
    fireEvent.click(screen.getByTestId('team-dissent-confirm-d_1'))
    await waitFor(() => expect(reread()).toBe(1))
    expect(posts()[0]!.body).toEqual({ words: 'Wait for the German pilot to report first.' })
  })

  it('while a past version is drawn the holder\'s confirm is held, as every Team write is (R1 review 1), and nothing is sent', async () => {
    serve(teamView('p_2'))
    useViewStore.setState({ at: 1 })
    render(<TeamTab />)
    expect(screen.getByTestId('team-dissent-confirm-d_1').matches(':disabled')).toBe(true)
    expect(screen.getByTestId('team-dissent-tell-input-d_1').matches(':disabled')).toBe(true)
    fireEvent.click(screen.getByTestId('team-dissent-confirm-d_1'))
    await new Promise((r) => setTimeout(r, 30))
    expect(posts()).toEqual([])
  })
})

describe('a next action can gather evidence before any option is chosen (DL 10 Nov, two-person rehearsal on 55c0c03f: never choose for them)', () => {
  const INVESTIGATE = "Sample next week's interruption log before taking a staffing position"
  const fill = (expectText: string | null, owner: string | null) => {
    fireEvent.click(screen.getByTestId('team-commitment-open'))
    fireEvent.change(screen.getByTestId('team-c-action'), { target: { value: INVESTIGATE } })
    if (owner !== null) fireEvent.change(screen.getByTestId('team-c-owner'), { target: { value: owner } })
    fireEvent.change(screen.getByTestId('team-c-reconsider'), { target: { value: 'Interruptions under an hour a day' } })
    fireEvent.change(screen.getByTestId('team-c-option'), { target: { value: NO_OPTION_YET } })
    if (expectText !== null) fireEvent.change(screen.getByTestId('team-c-expect'), { target: { value: expectText } })
  }
  const save = () => screen.getByTestId('team-commitment-save') as HTMLButtonElement

  it('"No option yet: gathering evidence" records the action with its owner, expectation and trigger, and sends no option', async () => {
    serve(teamView('p_1'))
    render(<TeamTab />)
    fill('Interruptions logged every day for a week', 'p_2')
    expect(save().disabled).toBe(false)
    fireEvent.click(save())
    await waitFor(() => expect(reread()).toBe(1))
    expect(posts()[0]).toEqual({ method: 'POST', path: `/api/scenarios/${SID}/commitments`, body: { action: INVESTIGATE, owner: 'p_2', expect: 'Interruptions logged every day for a week', reconsider: 'Interruptions under an hour a day', keeps: [], version: 1 } })
  })

  it('no chosen-option marker anywhere: no band, no option trigger in the form; reopened cold, the saved action names no option', () => {
    const triggers = [{ option: 'single_country_test', fact: 'F7', text: 'If the pilot misses ten customers by March' }]
    serve(teamView('p_1', { suggested_triggers: triggers }))
    const first = render(<TeamTab />)
    fill('Interruptions logged every day for a week', 'p_2')
    expect(screen.queryByTestId('team-c-band')).toBeNull()
    expect(screen.queryByTestId('team-c-triggers')).toBeNull()
    first.unmount(); resetDrafts()
    const saved = commitment({ action: INVESTIGATE, option: null, version: 1, review_on: null, expect_band: null, keeps: [] })
    serve(teamView('p_1', { commitments: [saved] }))
    render(<TeamTab />)
    const li = screen.getByTestId(`team-commitment-${saved.id}`)
    expect(within(li).getByTestId(`team-commitment-action-${saved.id}`).textContent).toBe(INVESTIGATE)
    expect(within(li).queryByTestId(`team-commitment-option-${saved.id}`)).toBeNull()
    expect(within(li).queryByTestId(`team-commitment-band-${saved.id}`)).toBeNull()
    for (const o of base.model!.cards.filter((c) => c.family === 'option')) expect(li.textContent).not.toContain(o.heading)
  })

  it('CONTRAST: an option picked still shows its band and its suggested trigger, and is sent', async () => {
    const triggers = [{ option: 'single_country_test', fact: 'F7', text: 'If the pilot misses ten customers by March' }]
    serve(teamView('p_1', { suggested_triggers: triggers }))
    render(<TeamTab />)
    fill('Ten by March', 'p_2')
    fireEvent.change(screen.getByTestId('team-c-option'), { target: { value: 'single_country_test' } })
    expect(screen.getByTestId('team-c-band').textContent).toContain(BAND)
    expect(screen.getByTestId('team-c-trigger-F7')).toBeTruthy()
    fireEvent.click(save())
    await waitFor(() => expect(reread()).toBe(1))
    expect((posts()[0]!.body as { option?: string }).option).toBe('single_country_test')
  })

  it('must not change: with no option yet, Record stays disabled without an owner or without an expectation', () => {
    serve(teamView('p_1'))
    const a = render(<TeamTab />)
    fill(null, 'p_2')
    expect(save().disabled, 'no expectation').toBe(true)
    a.unmount(); resetDrafts()
    serve(teamView('p_1'))
    render(<TeamTab />)
    fill('Interruptions logged every day for a week', null)
    fireEvent.change(screen.getByTestId('team-c-owner'), { target: { value: '' } })
    expect(save().disabled, 'no owner').toBe(true)
  })
})
