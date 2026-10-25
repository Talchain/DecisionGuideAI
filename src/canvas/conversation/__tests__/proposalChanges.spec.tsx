/**
 * ⭐ THE APPROVAL CARD SHOWS THE SUBSTANCE OF EVERY CHANGE (DL 23 Oct; Paul: simplify). CEE's `changes[]` on a program
 * proposal names each item the approval writes: `{ id, kind, action, label, before, after, author }`, with `before` and
 * `after` in CEE's own rendered words. The card lists EVERY item, whole, in CEE's order:
 *   · add:    "Adds ‘label’: after"
 *   · change: "Changes ‘label’: before → after"
 *   · remove: "Removes ‘label’ (was: before)"
 * Olumi's items are marked "Olumi’s"; the person's are not. The summary counts by kind, and so does the ghost's "+N".
 * With no `changes[]` the card shows CEE's notes, as before (row below); the interim plain heads for a program card
 * without it (#2956) are retired now that CEE sends `changes[]` on every program proposal (#3715).
 *
 * Fixture: the served funding card (CEE b8afd1c2) with `changes[]` in the shape CEE is about to send (values written for
 * these rows; see the fixture's `_source`). Real path: the real `SuggestedChips`, the real saved-graph read for the
 * program flag (only `fetch` stubbed, the served funding read).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))

import { CHANGE_LIST_UNREAD, SuggestedChips } from '../zones/SuggestedChips'
import { AMEND_PROPOSAL_ACTION, otherChangeCountOf, readProposalFields } from '../proposalFields'
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
const onChipClick = vi.fn(async (_chip: { id?: string }) => {})
/** The card as the core turn offers it: its approve, "Change something first" and "Not now". */
async function mount(card: Json = fixture.card, open = true) {
  const fields = { version: 1, graph_hash: fixture.graph_hash, proposals: [card] }
  const actions = [card.approve_action, AMEND_PROPOSAL_ACTION, card.decline_action] as never[]
  render(<SuggestedChips chips={buildSuggestedActionChips([], actions)} onChipClick={onChipClick} proposalFields={fields} />)
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
  if (open) fireEvent.click(screen.getByTestId(`proposal-change-details-${PID}`))
}
const summary = () => screen.getByTestId(`proposal-change-summary-${PID}`).textContent
const item = (kindId: string) => screen.getByTestId(`proposal-change-${kindId}`)
const listed = () => [...screen.getByTestId(`proposal-change-notes-${PID}`).querySelectorAll('li')]
const approveChip = () => screen.getByTestId(`suggested-chip-${fixture.card.approve_action.id}`) as HTMLButtonElement

beforeEach(() => {
  onChipClick.mockClear()
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

describe('Codex r1 on #2957: the list is CEE’s, whole and exact', () => {
  const [goal, relation, figure] = [fixture.card.changes[0], fixture.card.changes[1], fixture.card.changes[6]]
  const withChanges = (changes: unknown[]): Json => ({ ...fixture.card, changes })
  const of = (card: Json) => readProposalFields({ version: 1, graph_hash: fixture.graph_hash, proposals: [card] })!.proposals[0]

  it('(a) a long `after` is shown whole', async () => {
    const after = Array.from({ length: 12 }, (_, i) => `part ${i + 1} of the worked-out funding received, in GBP per month`).join('; ')
    expect(after.length).toBeGreaterThan(400)
    board(true)
    await mount(withChanges([{ ...relation, after }]))
    expect(item(`relation:${relation.id}`).textContent).toBe(`Adds ‘${relation.label}’: ${after} · Olumi’s`)
  })

  it('(b) a malformed entry between two valid ones: the 2 readable shown, and NO approve (buddy on #2957)', async () => {
    board(true)
    await mount(withChanges([goal, { ...figure, id: 'bad', kind: 'mystery' }, figure]))
    expect(listed().map((li) => li.getAttribute('data-testid'))).toEqual([`proposal-change-goal:${goal.id}`, `proposal-change-quantity:${figure.id}`])
    expect(summary()).toBe('Also changes 1 goal and 1 figure')
    // Approve is shown disabled, described by why; a press sends nothing. "Change something first" stays the remedy.
    const reason = screen.getByTestId('suggested-chips-change-unread-reason')
    expect(reason.textContent).toBe(CHANGE_LIST_UNREAD)
    expect(approveChip().disabled).toBe(true)
    expect(approveChip().getAttribute('aria-describedby')).toBe(reason.id)
    fireEvent.click(approveChip())
    expect(onChipClick).not.toHaveBeenCalled()
    const amend = screen.getByTestId(`suggested-chip-${AMEND_PROPOSAL_ACTION.id}`) as HTMLButtonElement
    expect(amend.disabled).toBe(false)
    fireEvent.click(amend)
    expect(onChipClick).toHaveBeenCalledTimes(1)
    expect(onChipClick.mock.calls[0][0]).toMatchObject({ id: AMEND_PROPOSAL_ACTION.id })
  })

  it('(b2) the same card opened for changes: the panel’s own approve is disabled too, and sends nothing', async () => {
    const field = { field_id: 'factor_value:angel_raise_amount', kind: 'factor_value', node_id: 'angel_raise_amount', label: 'Amount sought from angels',
      unit: 'GBP', current: { value: 150000, unit: 'GBP', source: 'yours' }, filled_missing: false, editable: true }
    board(true)
    await mount({ ...withChanges([goal, { ...figure, id: 'bad', kind: 'mystery' }, figure]), fields: [field] }, false)
    fireEvent.click(screen.getByTestId(`suggested-chip-${AMEND_PROPOSAL_ACTION.id}`))
    const apply = screen.getByRole('button', { name: 'Apply this reading' }) as HTMLButtonElement
    expect(apply.disabled).toBe(true)
    fireEvent.click(apply)
    expect(onChipClick).not.toHaveBeenCalled()
  })

  it('CONTRAST: a list read in full, and an absent list on a board that is not a program board, keep Approve live with no reason line', async () => {
    board(true)
    await mount(withChanges([goal, figure]))
    expect(approveChip().disabled).toBe(false)
    expect(screen.queryByTestId('suggested-chips-change-unread-reason')).toBeNull()
    fireEvent.click(approveChip())
    expect(onChipClick).toHaveBeenCalledTimes(1)
    cleanup()
    // An absent list on a program board cannot be shown in full (U-W1 (c), `servedProgramCard.spec.tsx`).
    board(false)
    const { changes: _absent, ...legacy } = fixture.card
    await mount(legacy)
    expect(approveChip().disabled).toBe(false)
    expect(screen.queryByTestId('suggested-chips-change-unread-reason')).toBeNull()
  })

  it('(c) two entries for one item count once, in the summary and the ghost’s "+N"', async () => {
    const twice = [figure, { ...figure, action: 'change', before: '0.05 / month', after: '0.1 / month' }, goal]
    expect(otherChangeCountOf(of(withChanges(twice)))).toBe(2)
    board(true)
    await mount(withChanges(twice))
    expect(summary()).toBe('Also changes 1 figure and 1 goal')
  })

  it('(d) a present, empty `changes: []` is zero changes: no panel, no notes, "+N" 0', async () => {
    expect(otherChangeCountOf(of(withChanges([])))).toBe(0)
    board(true)
    await mount(withChanges([]), false)
    expect(screen.queryByTestId(`proposal-change-notes-${PID}`)).toBeNull()
    expect(document.body.textContent).not.toContain(fixture.card.adds[0].text.slice(0, 40))
  })
})

describe('the ghost’s "+N" counts the card’s other changes', () => {
  it('from changes[] when present (14 items); from the notes when absent (13 items)', () => {
    const { changes: _dropped, ...withoutChanges } = fixture.card
    const of = (card: Json) => readProposalFields({ version: 1, graph_hash: fixture.graph_hash, proposals: [card] })!.proposals[0]
    expect(otherChangeCountOf(of(fixture.card))).toBe(14)
    expect(otherChangeCountOf(of(withoutChanges))).toBe(13)
  })
})

describe('no changes[]: the card keeps its change notes as before', () => {
  const { changes: _dropped, ...withoutChanges } = fixture.card

  it('a board that is not a program board: unchanged', async () => {
    board(false)
    await mount(withoutChanges)
    expect(summary()).toBe('Also changes 13 other changes')
    expect(listed().map((li) => li.textContent)).toEqual(fixture.card.adds.map((a) => a.text))
  })
})
