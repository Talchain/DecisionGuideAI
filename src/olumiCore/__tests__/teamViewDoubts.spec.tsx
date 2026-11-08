/**
 * A private view's links and factor (core `POST …/views/:id/doubts`, olumi-core wip/debate): the links offered are the View's own
 * `links[].remove`, sent verbatim with the new view's id; a refusal after the view is saved is said as such, never as the view failing.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { View } from '../../olumiView/client'
import { setPagePerson, setTeamFetch } from '../team/api'
import { resetDoubts, sendDoubts, ViewDoubts } from '../team/ViewDoubts'
import { resetDifferences, useDifferences, type Differences } from '../team/differences'
import { ViewsPanel } from '../team/ViewsPanel'

const fx: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/r5', 'effects.view3.json'), 'utf8'))
const remove = { record: 'total_def', part: 'existing_capacity' }
const link = { from: 'existing_capacity', to: 'total_capacity', kind: 'plain', label: '', doubt: false, alert: false, proposed: false, title: 't', effect: null, remove }
const view = (): View => ({ ...fx, proposal: null, model: { ...fx.model!, links: [link, { ...link, from: 'total_capacity', to: 'capacity_goal', remove: null }] } } as unknown as View)
type Sent = { method: string; url: string; body: unknown }
function serve(status: number, body: unknown): Sent[] {
  const sent: Sent[] = []
  setTeamFetch((async (url: string, init?: RequestInit) => {
    sent.push({ method: init?.method ?? 'GET', url, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    return new Response(JSON.stringify(url === '/api/me' ? { me: null } : body), { status: url === '/api/me' ? 200 : status, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof fetch)
  return sent
}
afterEach(() => { cleanup(); setTeamFetch(null); setPagePerson(null); resetDoubts(); resetDifferences() })
/** Core has the debate routes: its differences read answered for this scenario. */
const supported = () => useDifferences.setState({ sid: 's_x', key: 'k', data: { gated: true } as unknown as Differences, error: null })

describe('a private view\'s links and factor', () => {
  it('is not offered on a core without the debate routes (its differences read answered 404, so none is held)', () => {
    const { container } = render(<ViewDoubts sid="s_x" view={view()} disabled={false} />)
    expect(container.querySelector('[data-testid="team-view-doubts"]')).toBeNull()
  })

  it('offers only the links core can take out, and sends the picked one verbatim with the factor and the view id', async () => {
    const sent = serve(201, { doubt: 5 })
    supported()
    render(<ViewDoubts sid="s_x" view={view()} disabled={false} />)
    const boxes = screen.getByTestId('team-view-doubts').querySelectorAll('input[type="checkbox"]')
    expect(boxes).toHaveLength(1)
    fireEvent.click(screen.getByTestId('team-view-doubt-total_def|existing_capacity'))
    fireEvent.change(screen.getByTestId('team-view-missing'), { target: { value: 'staff absence' } })
    await sendDoubts('s_x', 7)
    expect(sent.find((s) => s.method === 'POST')).toEqual({ method: 'POST', url: '/api/scenarios/s_x/views/7/doubts', body: { links: [remove], missing: 'staff absence', stance: null } })
  })

  it('sends nothing when nothing was named; a refusal says the view is saved', async () => {
    const none = serve(201, { doubt: 5 })
    await sendDoubts('s_x', 7)
    expect(none.filter((s) => s.method === 'POST')).toHaveLength(0)
    serve(400, { error: 'each link must be one the model shows' })
    supported()
    render(<ViewDoubts sid="s_x" view={view()} disabled={false} />)
    fireEvent.change(screen.getByTestId('team-view-missing'), { target: { value: 'x' } })
    await sendDoubts('s_x', 7)
    expect((await screen.findByTestId('team-view-doubts-error')).textContent).toBe('Your view is saved; the links and factor were not: each link must be one the model shows')
  })

  it('sends a stance alone as { links: [], missing: null, stance }', async () => {
    const sent = serve(201, { doubt: 5 })
    render(<ViewDoubts sid="s_x" view={view()} disabled={false} />)
    await sendDoubts('s_x', 7, 'suspect')
    expect(sent.find((s) => s.method === 'POST')).toEqual({ method: 'POST', url: '/api/scenarios/s_x/views/7/doubts', body: { links: [], missing: null, stance: 'suspect' } })
  })

  it('draws a revealed view\'s stance as core\'s pill, verbatim, and no pill for a null or empty stance', () => {
    const shared = fx.collab.shared.slice(0, 3)
    expect(shared.length).toBeGreaterThanOrEqual(2)
    const stances = ['Knows from experience', null, '']
    const v = { ...fx, collab: { ...fx.collab, shared: shared.map((x, i) => ({ ...x, stance: stances[i] })) } } as unknown as View
    render(<ViewsPanel sid="s_x" view={v} onWrote={async () => true} />)
    expect(screen.getByTestId(`team-revealed-stance-${shared[0]!.id}`).textContent).toBe('Knows from experience')
    for (const x of shared.slice(1)) expect(screen.queryByTestId(`team-revealed-stance-${x.id}`)).toBeNull()
  })
})
