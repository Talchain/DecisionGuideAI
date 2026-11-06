/**
 * D6 on the screen (core 5cdae21f, olumi.view/3, additive): the Run's "what would have to be true" lines under core's heading, and the
 * commitment's reconsider trigger. Olumi proposes, the person authors: core's suggestion for the option committed to is shown as optional,
 * `trigger: { fact }` is sent ONLY when the person tapped it, and a saved trigger shows core's words and, when its scope moved, core's
 * `stale.text`. Every word is core's (set by hand on the european golden in the View's own shape, API.md "D6 and the computed reconsider trigger").
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import golden from '../../olumiView/golden/european.view.json'
import type { View } from '../../olumiView/client'
import { useViewStore } from '../../olumiView/store'
import { ViewChances } from '../../olumiView/ViewChances'
import { setPagePerson, setTeamFetch } from '../team/api'
import { resetDrafts } from '../team/drafts'
import { resetWrites } from '../team/writes'
import { TeamTab } from '../team/TeamTab'
import { useMe } from '../me'

const SID = 's_0123456789ab'
const base = golden as unknown as View
const HEADING = 'What would have to be true'
const MARK = { glyph: '◆', title: 'Rests on Olumi’s proposals' }
const LINE = { id: 'F40', kind: 'chance', line: "'Test one country' · aim 'Reach 800 customers' · 'New customers' would have to be above about 41 (between 38 and 44)", hover: 'the Run\'s own text for F40', aim: 'reach_customer_target', option: 'single_country_test', olumi: MARK }
const LINE2 = { id: 'F41', kind: 'lead', line: "'Broader entry' · aim 'Reach 800 customers' · 'Churn' would have to be below about 3%", hover: 'F41 hover', aim: 'reach_customer_target', option: 'broader_entry', olumi: null }
const SUG = { option: 'single_country_test', aim: 'reach_customer_target', fact: 'F40', kind: 'chance', text: 'Reconsider if ‘New customers’ falls below about 41' }
const SUG_OTHER = { option: 'broader_entry', aim: 'reach_customer_target', fact: 'F41', kind: 'lead', text: 'Reconsider if ‘Churn’ rises above about 3%' }
const withTipping = (tipping: unknown[], tipping_heading: string | undefined): NonNullable<View['model']> => ({ ...base.model!, run: { ...base.model!.run!, tipping, tipping_aims: [], tipping_heading: tipping_heading as string } as never })

// A core before D6: no tipping fields at all (the golden now carries them, with silent lines for an aim that has no crossing).
const withoutTipping = ((): NonNullable<View['model']> => { const { tipping: _t, tipping_heading: _h, tipping_aims: _a, ...run } = base.model!.run!; return { ...base.model!, run } as never })()

const teamView = (over: Record<string, unknown> = {}): View => ({
  ...base, id: SID, you: 'Ada', you_id: 'p_1', members: [{ id: 'p_1', name: 'Ada' }, { id: 'p_2', name: 'Bea' }],
  collab: { ...base.collab, alone: false, heading: 'Team views · 2', open: true, shared: [], mine: [], can_reveal: false, waiting: null, commitments: [], dissent: [],
    owners: [{ id: 'p_1', name: 'Ada' }, { id: 'p_2', name: 'Bea' }], suggested_triggers: [SUG, SUG_OTHER], ...over },
  evidence: [],
} as unknown as View)
const saved = (trigger: unknown) => ({ id: 9, at: '2026-11-06T10:00:00Z', by: 'Ada', by_id: 'p_1', action: 'Pilot in Germany', owner: 'Bea', owner_id: 'p_2', expect: 'Ten by March', reconsider: 'Under five', keeps: [], outcomes: [],
  option: { id: 'single_country_test', heading: 'Test one country before broader commitment' }, version: 1, review_on: null, expect_band: null, trigger })
const TRIGGER = { fact: 'F40', kind: 'chance', option: 'single_country_test', aim: 'reach_customer_target', versus: null, figure: 'new_customers', text: SUG.text, finding: 'the finding', version: 1, stale: null }

let calls: Array<{ method: string; path: string; body: unknown }> = []
const serve = (v: View) => {
  setTeamFetch((async (u: unknown, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push({ method, path: String(u), body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (String(u) === '/api/me') return new Response(JSON.stringify({ me: { id: v.you_id, name: v.you } }), { status: 200 })
    if (String(u).endsWith('/invites')) return new Response(JSON.stringify({ invites: [] }), { status: 200 })
    return new Response(JSON.stringify(method === 'GET' ? v : { ok: 1 }), { status: method === 'GET' ? 200 : 201 })
  }) as unknown as typeof fetch)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: SID, view: v, status: 'ready', error: null, stale: false })
  useMe.setState({ me: { id: v.you_id, name: v.you }, status: 'ready' })
}
beforeEach(() => { calls = [] })
afterEach(() => { cleanup(); setTeamFetch(null); setPagePerson(null); resetDrafts(); resetWrites(); useMe.setState({ me: null, status: 'none' }); useViewStore.setState({ at: null }) })
const posts = () => calls.filter((c) => c.method === 'POST' && c.path !== '/api/me')
const openForm = (option = 'single_country_test') => {
  fireEvent.click(screen.getByTestId('team-commitment-open'))
  fireEvent.change(screen.getByTestId('team-c-action'), { target: { value: 'Run the pilot' } })
  fireEvent.change(screen.getByTestId('team-c-owner'), { target: { value: 'p_2' } })
  fireEvent.change(screen.getByTestId('team-c-option'), { target: { value: option } })
  fireEvent.change(screen.getByTestId('team-c-expect'), { target: { value: 'Ten by March' } })
  fireEvent.change(screen.getByTestId('team-c-reconsider'), { target: { value: 'Under five' } })
}

describe('the Run\'s "what would have to be true" lines (Analysis tab)', () => {
  it('each line verbatim under core\'s heading, core\'s hover and mark; drawn once; a line with no mark has none', () => {
    const { container } = render(<ViewChances model={withTipping([LINE, LINE2], HEADING)} />)
    const box = screen.getByTestId('view-run-tipping')
    expect(box.querySelector('[data-view="run.tipping_heading"]')?.textContent).toBe(HEADING)
    expect([...box.querySelectorAll('[data-view-fact]')].map((e) => e.textContent)).toEqual([`◆ ${LINE.line}`, LINE2.line])
    expect(box.querySelector('[data-view-fact="F40"]')!.getAttribute('title')).toBe(LINE.hover)
    expect(box.querySelector('[data-view-fact="F40"] [aria-label]')!.getAttribute('title')).toBe(MARK.title)
    expect(container.textContent!.split(LINE.line).length - 1).toBe(1)
    expect(container.textContent!.split(HEADING).length - 1).toBe(1)
  })
  it('CONTRAST: a core without the field, without a heading, or with no lines draws nothing', () => {
    for (const m of [withoutTipping, withTipping([LINE], undefined), withTipping([], HEADING)]) { const { container } = render(<ViewChances model={m} />); expect(container.querySelector('[data-testid="view-run-tipping"]')).toBeNull(); cleanup() }
  })
})

describe('the reconsider trigger on a commitment: Olumi proposes, the person authors', () => {
  it('the suggestion for the option chosen is offered, optional, and nothing is sent unless it is tapped', async () => {
    serve(teamView())
    render(<TeamTab />)
    openForm('')
    expect(screen.queryByTestId('team-c-triggers')).toBeNull() // no option chosen yet: nothing suggested
    fireEvent.change(screen.getByTestId('team-c-option'), { target: { value: 'single_country_test' } })
    const box = screen.getByTestId('team-c-triggers')
    expect(within(box).getByTestId('team-c-trigger-F40').textContent).toContain(SUG.text)
    expect(within(box).queryByTestId('team-c-trigger-F41')).toBeNull() // another option's trigger is never offered
    fireEvent.click(screen.getByTestId('team-commitment-save'))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0]!.body).not.toHaveProperty('trigger')
  })
  it('R17: the line over the suggestions is core\'s own caption, verbatim', async () => {
    serve({ ...teamView(), collab: { ...teamView().collab, suggested_triggers_caption: 'CAPTION from core' } } as View)
    render(<TeamTab />)
    openForm('')
    fireEvent.change(screen.getByTestId('team-c-option'), { target: { value: 'single_country_test' } })
    expect(screen.getByTestId('team-suggested-trigger-caption').textContent).toBe('CAPTION from core')
  })
  it('tapped: trigger { fact } goes with the commitment; tapped twice: it does not; the reconsider words stay the person\'s own', async () => {
    serve(teamView())
    render(<TeamTab />)
    openForm()
    const tap = () => fireEvent.click(screen.getByTestId('team-c-trigger-F40'))
    tap()
    expect(screen.getByTestId('team-c-trigger-F40').getAttribute('aria-pressed')).toBe('true')
    expect((screen.getByTestId('team-c-reconsider') as HTMLTextAreaElement).value).toBe('Under five')
    fireEvent.click(screen.getByTestId('team-commitment-save'))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0]!.body).toMatchObject({ option: 'single_country_test', version: 1, reconsider: 'Under five', trigger: { fact: 'F40' } })
    cleanup(); resetDrafts(); resetWrites(); calls = []
    serve(teamView())
    render(<TeamTab />)
    openForm(); tap(); tap()
    fireEvent.click(screen.getByTestId('team-commitment-save'))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0]!.body).not.toHaveProperty('trigger')
  })
  it('a trigger taken for one option is not sent after another option is chosen', async () => {
    serve(teamView())
    render(<TeamTab />)
    openForm()
    fireEvent.click(screen.getByTestId('team-c-trigger-F40'))
    fireEvent.change(screen.getByTestId('team-c-option'), { target: { value: 'broader_entry' } })
    expect(screen.queryByTestId('team-c-trigger-F40')).toBeNull()
    fireEvent.click(screen.getByTestId('team-commitment-save'))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0]!.body).toMatchObject({ option: 'broader_entry' })
    expect(posts()[0]!.body).not.toHaveProperty('trigger')
  })
  it('a core without suggested triggers offers none', () => {
    const v = teamView(); delete (v.collab as unknown as Record<string, unknown>)['suggested_triggers']
    serve(v)
    render(<TeamTab />)
    openForm()
    expect(screen.queryByTestId('team-c-triggers')).toBeNull()
  })
  it('a saved trigger shows core\'s words; stale.text is shown only when core gives it; a commitment without one shows none', () => {
    serve(teamView({ commitments: [saved({ ...TRIGGER, stale: { reasons: [], text: 'Out of date since version 2: ‘New customers’ changed' } }), { ...saved(null), id: 10 }, { ...saved({ ...TRIGGER }), id: 11 }] }))
    render(<TeamTab />)
    expect(screen.getByTestId('team-commitment-trigger-9').textContent).toContain(SUG.text)
    expect(screen.getByTestId('team-commitment-trigger-stale-9').textContent).toBe('Out of date since version 2: ‘New customers’ changed')
    expect(screen.queryByTestId('team-commitment-trigger-10')).toBeNull()
    expect(screen.getByTestId('team-commitment-trigger-11')).toBeTruthy()
    expect(screen.queryByTestId('team-commitment-trigger-stale-11')).toBeNull()
  })
})
