/**
 * Where your explanations differ (core `GET …/differences`, olumi-core wip/debate 38cb4377): the panel draws core's read verbatim, each
 * holder's chance in that holder's column by id, and posts a step as core's route takes it. A core without the route (404), or a gated
 * viewer, draws nothing. Fixture: core's own output for the capacity case (debate.test.ts row 3), Paul and Sam on `per_specialist`.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { View } from '../../olumiView/client'
import { setPagePerson, setTeamFetch } from '../team/api'
import { resetWrites } from '../team/writes'
import { resetDifferences } from '../team/differences'
import { draftOf, resetDrafts } from '../team/drafts'
import { DifferencesPanel } from '../team/DifferencesPanel'
import { useWhatIf } from '../../olumiView/whatif'
import { useViewLens } from '../../olumiView/lens'

const core = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/debate/differences.core.json'), 'utf8'))
const fx: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/r5', 'effects.view3.json'), 'utf8'))
const view = (over: Partial<View> = {}): View => ({ ...fx, gated: false, you_id: '1', ...over } as View)
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
afterEach(() => { cleanup(); setTeamFetch(null); setPagePerson(null); resetWrites(); resetDifferences(); resetDrafts() })

describe('where your explanations differ', () => {
  it('draws core\'s words and each holder\'s chance in that holder\'s column, by id', async () => {
    serve(() => ({ status: 200, body: core }))
    render(<DifferencesPanel sid="s_x" view={view()} onWrote={async () => true} />)
    const card = await screen.findByTestId('team-difference-per_specialist-capacity_goal')
    const d = core.differences[0]
    expect(screen.getByTestId('team-differences-heading').textContent).toBe(core.heading)
    expect(screen.getByTestId('team-difference-per_specialist-capacity_goal-status').textContent).toBe(d.status_text)
    expect([...card.querySelectorAll('[data-difference-side] [data-difference-figure]')].map((e) => e.textContent)).toEqual(['Paul: 5 to 19 tickets/week/specialist', 'Sam: 22 to 40 tickets/week/specialist'])
    const row = card.querySelector('[data-difference-option="add_one"]')!
    expect(row.querySelector('[data-difference-chance="1"]')!.textContent).toBe('about 7%')
    expect(row.querySelector('[data-difference-chance="2"]')!.textContent).toBe('about 94%')
    expect(row.querySelector('[data-difference-model]')!.textContent).toBe(d.options.find((o: { option: string }) => o.option === 'add_one').model)
    expect([...card.querySelectorAll('[data-settle]')].map((e) => [e.getAttribute('data-settle'), e.textContent])).toEqual(d.settle.map((s: { kind: string; text: string }) => [s.kind, s.text]))
    expect([...card.querySelectorAll('[data-step]')].map((e) => e.textContent)).toEqual(d.steps.map((s: { text: string }) => s.text))
    // Never a side named right, never a recommendation (core's words, drawn as given).
    expect(card.textContent).not.toMatch(/\b(best|recommend|winner|should)\b/i)
  })

  it('a step posts core\'s body to core\'s route; "Commit to a next step" opens the commitment form for the viewer', async () => {
    const fresh = { ...core, differences: [{ ...core.differences[0], steps: [] }] }
    const sent = serve((s) => (s.method === 'POST' ? { status: 201, body: { step: 42 } } : { status: 200, body: fresh }))
    render(<DifferencesPanel sid="s_x" view={view()} onWrote={async () => true} />)
    fireEvent.click(await screen.findByTestId('team-difference-per_specialist-capacity_goal-research'))
    await waitFor(() => expect(sent.filter((s) => s.method === 'POST')).toHaveLength(1))
    expect(sent.find((s) => s.method === 'POST')).toMatchObject({ url: '/api/scenarios/s_x/differences/per_specialist/steps', body: { step: 'research' } })
    fireEvent.click(screen.getByTestId('team-difference-per_specialist-capacity_goal-commit'))
    expect(draftOf<{ open: boolean; owner: string }>('s_x:commitment')).toMatchObject({ open: true, owner: '1' })
  })

  it('a step on a link difference posts its record with the colons core\'s route takes', async () => {
    const link = { ...core.differences[0], kind: 'link', record: 'link:total_def:existing_capacity', label: "'existing capacity' → 'total capacity'", cards: ['existing_capacity', 'total_capacity'], steps: [] }
    const sent = serve((s) => (s.method === 'POST' ? { status: 201, body: { step: 7 } } : { status: 200, body: { ...core, differences: [link] } }))
    render(<DifferencesPanel sid="s_x" view={view()} onWrote={async () => true} />)
    fireEvent.click(await screen.findByTestId('team-difference-link:total_def:existing_capacity-capacity_goal-dissent'))
    await waitFor(() => expect(sent.filter((s) => s.method === 'POST')).toHaveLength(1))
    expect(sent.find((s) => s.method === 'POST')!.url).toBe('/api/scenarios/s_x/differences/link:total_def:existing_capacity/steps')
  })

  it('"Preview on the canvas" runs that person\'s figure as core\'s what-if (nothing saved) and turns the What if lens on', async () => {
    const fig = { quantity: 'per_specialist', label: 'per specialist', text: '22 to 40 tickets/week/specialist', title: 't', unit: 'ticket/week/specialist', version: 1, low: 22, high: 40, range_kind: 'plausible' }
    const v = view({ version: { ...fx.version!, id: 6 }, collab: { ...fx.collab, shared: [{ ...fx.collab.shared[0]!, id: core.differences[0].sides[1].view, figures: [fig] }] } } as Partial<View>)
    const variant = { hypothetical: true, edits: [], blocked: null, stopped: null, moved: true, why_not: null, rows: [], most_likely: null }
    const sent = serve((s) => (s.url.endsWith('/whatif') ? { status: 200, body: { scenario: 's_x', version: { id: 6, n: 1 }, hypothetical: true, saved: false, variants: [variant] } } : { status: 200, body: core }))
    render(<DifferencesPanel sid="s_x" view={v} onWrote={async () => true} />)
    fireEvent.click(await screen.findByTestId('team-difference-per_specialist-capacity_goal-preview-2'))
    await waitFor(() => expect(useWhatIf.getState().shown).not.toBeNull())
    expect(sent.find((s) => s.url.endsWith('/whatif'))!.body).toEqual({ base: 6, variants: [{ edits: [{ quantity: 'per_specialist', value: { kind: 'interval', low: 22, high: 40 } }] }] })
    expect(useViewLens.getState().lens).toBe('what_if')
    useWhatIf.setState({ shown: null }); useViewLens.setState({ lens: 'full' })
  })

  it('draws nothing on a core without the route, or for a gated viewer', async () => {
    const sent = serve(() => ({ status: 404, body: { error: 'not found' } }))
    const { container } = render(<DifferencesPanel sid="s_x" view={view()} onWrote={async () => true} />)
    await waitFor(() => expect(sent).toHaveLength(1))
    expect(container.querySelector('[data-testid="team-differences"]')).toBeNull()
    cleanup(); resetDifferences()
    serve(() => ({ status: 200, body: { ...core, gated: true, differences: [] } }))
    const again = render(<DifferencesPanel sid="s_x" view={view({ gated: true })} onWrote={async () => true} />)
    await new Promise((r) => setTimeout(r, 20))
    expect(again.container.querySelector('[data-testid="team-differences"]')).toBeNull()
  })
})
