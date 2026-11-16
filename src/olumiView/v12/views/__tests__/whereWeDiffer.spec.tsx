/**
 * V12 "Where we differ": grouping by core's own fields, pre-reveal privacy (no differences asked, no count drawn), the one-line summary
 * only after an authorised reveal and a valid comparison, step actions to core's routes, and the Views switch.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { View } from '../../../client'
import { setPagePerson, setTeamFetch } from '../../../../olumiCore/team/api'
import { resetWrites } from '../../../../olumiCore/team/writes'
import { differencesShape, resetDifferences, type Differences } from '../../../../olumiCore/team/differences'
import { resetDrafts } from '../../../../olumiCore/team/drafts'
import { countDifferences, groupDifferences, groupOf, summaryLine } from '../differGroups'
import { WhereWeDiffer } from '../WhereWeDiffer'
import { SimpleSummary } from '../SimpleSummary'
import { ViewsToggle } from '../ViewsToggle'
import { useViewsMarks } from '../viewsMarks'

const core = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/debate/differences.core.json'), 'utf8'))
const fx: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/r5/effects.view3.json'), 'utf8'))
const view = (over: Partial<View> = {}): View => ({ ...fx, gated: false, you_id: '1', ...over } as View)
const base = core.differences[0]
const figure = { ...base, status: 'changes', steps: [] }                                            // calculated: has chances
const link = { ...base, kind: 'link', record: 'link:a:b', cards: ['a', 'b'], status: 'pending', options: [], steps: [] } // not calculated
const factor = { ...base, kind: 'factor', record: 'factor:r1', cards: [], status: 'not_run', options: [], steps: [] }
const withheld = { ...base, record: 'wh', status: 'withheld', options: [], steps: [] }
const payload = (differences: unknown[]) => ({ ...core, differences })

type Sent = { method: string; url: string; body: unknown }
function serve(answer: (s: Sent) => { status: number; body: unknown }): Sent[] {
  const sent: Sent[] = []
  setTeamFetch((async (url: string, init?: RequestInit) => {
    const s = { method: init?.method ?? 'GET', url, body: init?.body ? JSON.parse(String(init.body)) : undefined }
    sent.push(s)
    const a = answer(s)
    return new Response(JSON.stringify(a.body), { status: a.status, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof fetch)
  return sent
}
afterEach(() => { cleanup(); setTeamFetch(null); setPagePerson(null); resetWrites(); resetDifferences(); resetDrafts(); useViewsMarks.setState({ on: true }) })

describe('grouping', () => {
  const data = differencesShape(payload([figure, link, factor, withheld])) as Differences
  it('puts each difference in a group by core\'s kind, status and supplied chances', () => {
    expect(groupOf(data.differences[0]!)).toBe('consequence')
    expect(groupOf(data.differences[1]!)).toBe('reasoning')
    expect(groupOf(data.differences[2]!)).toBe('question')
    expect(groupOf(data.differences[3]!)).toBe('reasoning') // not computable stays visible, never dropped
    expect(groupDifferences(data).map((g) => [g.id, g.rows.map((r) => r.record)])).toEqual([['question', ['factor:r1']], ['reasoning', ['link:a:b', 'wh']], ['consequence', ['per_specialist']]])
  })
  it('a calculated status with no chance from core is not drawn as a consequence', () => {
    const none = { ...figure, options: figure.options.map((o: { chances: unknown[] }) => ({ ...o, chances: [] })) }
    expect(groupOf(none)).toBe('reasoning')
  })
  it('counts distinct records, and says "changes the answer" only for core\'s `changes`', () => {
    const twoAims = { ...link, goal: 'other' }
    const d = differencesShape(payload([figure, link, twoAims, factor])) as Differences
    expect(countDifferences(d)).toEqual({ places: 3, changes: 1 })
    expect(summaryLine({ places: 3, changes: 1 })).toBe('3 places you differ; 1 changes the answer')
    expect(summaryLine({ places: 1, changes: 0 })).toBe('1 place you differ')
    expect(summaryLine({ places: 0, changes: 0 })).toBeNull()
  })
})

describe('before a reveal', () => {
  it('asks core for no differences and draws no count or summary, only the own-view entry and core\'s reveal state', async () => {
    const sent = serve(() => ({ status: 200, body: payload([figure]) }))
    const gated = view({ gated: true, collab: { ...fx.collab, shared: [], can_reveal: true, waiting: null } })
    render(<WhereWeDiffer sid="s_x" view={gated} onWrote={async () => true} />)
    expect(screen.getByTestId('differ-before')).toBeTruthy()
    expect(screen.getByTestId('team-view-text')).toBeTruthy()            // the member's own private-view entry
    expect(screen.getByTestId('team-reveal-go')).toBeTruthy()            // core says everyone has contributed: reveal together
    expect(screen.queryByTestId('differ-after')).toBeNull()
    expect(screen.queryByTestId('differ-summary')).toBeNull()
    expect(document.body.textContent).not.toMatch(/\d+ places? you differ/)
    await act(async () => { await Promise.resolve() })
    expect(sent.filter((s) => s.url.includes('/differences'))).toHaveLength(0)
  })
  it('the summary alone draws nothing before a reveal, and nothing when only one person has given a view', async () => {
    serve(() => ({ status: 200, body: payload([figure]) }))
    const { container, rerender } = render(<SimpleSummary sid="s_x" view={view({ gated: true, collab: { ...fx.collab, shared: [] } })} />)
    expect(container.textContent).toBe('')
    rerender(<SimpleSummary sid="s_x" view={view({ collab: { ...fx.collab, shared: fx.collab.shared.slice(0, 1) } })} />)
    await act(async () => { await Promise.resolve() })
    expect(container.textContent).toBe('')
  })
})

describe('after an authorised reveal', () => {
  it('lists the groups in core\'s words with the one-line summary', async () => {
    serve(() => ({ status: 200, body: payload([figure, link, factor]) }))
    render(<WhereWeDiffer sid="s_x" view={view()} onWrote={async () => true} />)
    expect((await screen.findByTestId('differ-summary')).textContent).toBe('3 places you differ; 1 changes the answer')
    expect(['question', 'reasoning', 'consequence'].map((g) => !!screen.getByTestId(`differ-group-${g}`))).toEqual([true, true, true])
    expect(screen.getByTestId('differ-row-per_specialist-capacity_goal-status').textContent).toBe(base.status_text)
    expect(document.body.textContent).not.toMatch(/\b(best|recommend|winner|should)\b/i)
  })
  it('a step posts core\'s body to core\'s route, once; commit opens the commitment form', async () => {
    const sent = serve((s) => (s.method === 'POST' ? { status: 201, body: { step: 5 } } : { status: 200, body: payload([figure]) }))
    render(<WhereWeDiffer sid="s_x" view={view()} onWrote={async () => true} />)
    fireEvent.click(await screen.findByTestId('differ-row-per_specialist-capacity_goal-research'))
    await waitFor(() => expect(sent.filter((s) => s.method === 'POST')).toHaveLength(1))
    expect(sent.find((s) => s.method === 'POST')).toMatchObject({ url: '/api/scenarios/s_x/differences/per_specialist/steps', body: { step: 'research' } })
    fireEvent.click(screen.getByTestId('differ-row-per_specialist-capacity_goal-dissent'))
    await waitFor(() => expect(sent.filter((s) => s.method === 'POST')).toHaveLength(2))
    expect(sent.filter((s) => s.method === 'POST')[1]!.body).toEqual({ step: 'dissent' })
  })
  it('a link\'s step keeps the colons in its record', async () => {
    const sent = serve((s) => (s.method === 'POST' ? { status: 201, body: { step: 6 } } : { status: 200, body: payload([{ ...link, status: 'not_run' }]) }))
    render(<WhereWeDiffer sid="s_x" view={view()} onWrote={async () => true} />)
    fireEvent.click(await screen.findByTestId('differ-row-link:a:b-capacity_goal-dissent'))
    await waitFor(() => expect(sent.some((s) => s.method === 'POST')).toBe(true))
    expect(sent.find((s) => s.method === 'POST')!.url).toBe('/api/scenarios/s_x/differences/link:a:b/steps')
  })
})

describe('Views toggle', () => {
  it('is drawn only after a reveal, and flips the one marks switch', () => {
    const { rerender } = render(<ViewsToggle view={view({ gated: true, collab: { ...fx.collab, shared: [] } })} />)
    expect(screen.queryByTestId('views-toggle')).toBeNull()
    rerender(<ViewsToggle view={view()} />)
    const b = screen.getByTestId('views-toggle')
    expect(b.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(b)
    expect(useViewsMarks.getState().on).toBe(false)
    expect(screen.getByTestId('views-toggle').getAttribute('aria-pressed')).toBe('false')
  })
})

describe('the member\'s own entry stays whatever the differences do', () => {
  const revealed = () => view()   // shared views present and not gated: a reveal is authorised for this viewer
  it('is drawn while the differences are still loading', () => {
    serve(() => ({ status: 200, body: {} }))
    render(<WhereWeDiffer sid="s_x" view={revealed()} onWrote={async () => true} />)
    expect(screen.getByTestId('differ-after')).toBeTruthy()
    expect(document.querySelectorAll('[data-testid="team-views"]').length).toBeLessThanOrEqual(1)
  })
  it('is drawn when the read fails, with the failure said and no differences', async () => {
    serve(() => ({ status: 500, body: { error: 'the differences could not be read' } }))
    render(<WhereWeDiffer sid="s_x" view={revealed()} onWrote={async () => true} />)
    expect((await screen.findByTestId('differ-error')).textContent).toMatch(/could not be read/)
    expect(screen.getByTestId('differ-after')).toBeTruthy()
    expect(screen.queryByTestId('differ-empty')).toBeNull()
  })
  it('takes the group headings from core when it sends them', async () => {
    serve(() => ({ status: 200, body: { ...core, headings: { ...core.headings, groups: { framing: 'F', reasoning: 'R', consequence: 'C' } }, differences: [figure, link] } }))
    render(<WhereWeDiffer sid="s_x" view={revealed()} onWrote={async () => true} />)
    expect((await screen.findByTestId('differ-group-consequence-heading')).textContent).toBe('C')
    expect(screen.getByTestId('differ-group-reasoning-heading').textContent).toBe('R')
  })
})
