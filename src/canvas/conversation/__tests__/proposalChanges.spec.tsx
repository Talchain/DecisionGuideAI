/**
 * ⭐ THE APPROVAL CARD SHOWS THE SUBSTANCE OF EVERY CHANGE (DL 23 Oct; Paul: simplify). CEE's `changes[]` on a program
 * proposal names each item the approval writes: `{ id, kind, action, label, before, after, author }`, with `before` and
 * `after` in CEE's own rendered words. The card lists EVERY item, whole, in CEE's order:
 *   · add:    "Adds ‘label’: after"
 *   · change: "Changes ‘label’: before → after"
 *   · remove: "Removes ‘label’ (was: before)"
 * Olumi's items are marked "Olumi’s"; the person's are not. The summary counts by kind. With no `changes[]` (an older
 * CEE, or a board that is not a program board) the card keeps its change notes as before.
 *
 * Fixture: the served funding card (CEE b8afd1c2) with `changes[]` in the shape CEE is about to send (values written for
 * these rows; see the fixture's `_source`). Real path: the real `SuggestedChips`, the real saved-graph read for the
 * program flag (only `fetch` stubbed, the served funding read).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))

import { SuggestedChips } from '../zones/SuggestedChips'
import { buildSuggestedActionChips } from '../../../v5/blocks/suggestedActionChips'
import { useCanvasStore } from '../../store'
import fixture from './fixtures/program-card-changes.json'
import funding from '../../runView/__tests__/fixtures/pass-funding-72300716-read.json'

type Json = Record<string, any>
const PID = fixture.card.proposal_id
let read: Json = funding as Json
let n = 0
function board(program: boolean) {
  n += 1
  const graph = funding.graph as Json
  read = { ...funding, graph_hash: `${funding.graph_hash.slice(0, 12)}${String(n).padStart(4, '0')}`,
    graph: program ? graph : { ...graph, living_model: { aims: [], links: [], factors: [], options: [] } } }
  useCanvasStore.setState({ currentScenarioId: funding.scenario_id, lastServerGraphHash: read.graph_hash } as never)
}
async function mount(card: Json = fixture.card) {
  const fields = { version: 1, graph_hash: fixture.graph_hash, proposals: [card] }
  render(<SuggestedChips chips={buildSuggestedActionChips([], [card.approve_action as never])} onChipClick={vi.fn(async () => {})} proposalFields={fields} />)
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
  fireEvent.click(screen.getByTestId(`proposal-change-details-${PID}`))
}
const summary = () => screen.getByTestId(`proposal-change-summary-${PID}`).textContent
const item = (kindId: string) => screen.getByTestId(`proposal-change-${kindId}`)
const listed = () => [...screen.getByTestId(`proposal-change-notes-${PID}`).querySelectorAll('li')]

beforeEach(() => {
  window.history.replaceState(null, '', '/?ai=core-route')
  vi.stubGlobal('fetch', vi.fn(async (url: string) => (
    /\/scenarios\/[^/]+\/graph$/.test(String(url))
      ? new Response(JSON.stringify(read), { status: 200, headers: { 'Content-Type': 'application/json' } })
      : new Response('{}', { status: 404 })
  )))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/') })

describe('a program card with changes[] lists the substance of every item', () => {
  it('add, Olumi’s: "Adds ‘label’: after", marked Olumi’s', async () => {
    board(true)
    await mount()
    expect(item('quantity:firm_receipt_rate').textContent)
      .toBe('Adds ‘Share of the intended firm raise received per month’: 0.05 / month (0 to 0.5 / month) · Olumi’s')
    expect(item('quantity:firm_receipt_rate').getAttribute('data-author')).toBe('olumi')
  })

  it('change, the person’s: "Changes ‘label’: before → after", with no Olumi mark', async () => {
    board(true)
    await mount()
    expect(item('goal:secure_funding_sooner').textContent)
      .toBe('Changes ‘accelerate securing funding within the next 2 months’: no measure yet → Funding received at least £100,000 within two months')
    expect(screen.queryByTestId('proposal-change-olumi-goal:secure_funding_sooner')).toBeNull()
    // An add the person owns (an asked figure) is not marked Olumi’s either.
    expect(item('quantity:firm_raise_amount').textContent)
      .toBe('Adds ‘Amount sought through the existing investment-firm outreach’: waiting for your answer (GBP)')
  })

  it('remove: "Removes ‘label’ (was: before)"', async () => {
    board(true)
    await mount()
    expect(item('risk:founder_time_risk').textContent)
      .toBe('Removes ‘Founder time diverted from the investment-firm outreach’ (was: Olumi’s risk: the angel raise takes founder time from the main outreach) · Olumi’s')
  })

  it('every item is listed whole, in CEE’s order: no truncation, no dropped item (the calculations included)', async () => {
    board(true)
    await mount()
    const items = listed()
    expect(items).toHaveLength(fixture.card.changes.length)
    expect(items.map((li) => li.getAttribute('data-testid'))).toEqual(fixture.card.changes.map((c) => `proposal-change-${c.kind}:${c.id}`))
    expect(item('relation:firm_funding_inflow_definition').textContent)
      .toBe('Adds ‘Monthly funding received through existing outreach’: Amount sought through the existing investment-firm outreach × Share of the intended firm raise received per month · Olumi’s')
    // The notes are not shown beside them.
    expect(screen.getByTestId(`proposal-change-notes-${PID}`).textContent).not.toContain('define_goal_measure')
  })

  it('the summary counts by kind, in CEE’s order', async () => {
    board(true)
    await mount()
    expect(summary()).toBe('Also changes 1 goal, 4 calculations, 8 figures and 1 risk')
  })
})

describe('no changes[]: the card keeps its change notes as before', () => {
  const { changes: _dropped, ...withoutChanges } = fixture.card

  it('a program board (older CEE): today’s summary, and every note in CEE’s words, whole', async () => {
    board(true)
    await mount(withoutChanges)
    expect(summary()).toBe('Also changes 1 goal, 4 calculations and 8 figures')
    expect(listed().map((li) => li.textContent)).toEqual(fixture.card.adds.map((a) => a.text))
  })

  it('a board that is not a program board: unchanged', async () => {
    board(false)
    await mount(withoutChanges)
    expect(summary()).toBe('Also changes 13 other changes')
    expect(listed().map((li) => li.textContent)).toEqual(fixture.card.adds.map((a) => a.text))
  })
})
