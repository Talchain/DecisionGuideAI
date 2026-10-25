/**
 * ⭐ THE PROGRAM CARD ON REAL SERVED BODIES (lease U-W1, 25 Oct): the card shows the complete proposed change, Olumi's
 * items marked Olumi's and the person's never, and its Approve is offered only while that change is readable and current.
 *
 * Real path for every row: a served core-route body (fixtures `served-card-*-20261025.json`, each `_source` names its run
 * and served commits) → `parseV5Response` (the core contract, `coreTurnContract.ts`) → the reply's chips and card as the
 * conversation builds them (`buildSuggestedActionChips`, `readTurnProposalFields`) → the real `SuggestedChips`. The program
 * flag is the real saved-graph read (only `fetch` stubbed: the served funding read, `living_model.model_program` "v1"; the
 * legacy contrast strips it). The negative rows are synthetic mutations of a real body, named in each row.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))

import { CHANGE_LIST_UNREAD, SuggestedChips } from '../zones/SuggestedChips'
import { readTurnProposalFields } from '../proposalFields'
import { buildSuggestedActionChips } from '../../../v5/blocks/suggestedActionChips'
import { parseV5Response } from '../../../v5/responseParser'
import { useCanvasStore } from '../../store'
import readingTurn from './fixtures/served-card-european-reading-20261025.json'
import repairTurn from './fixtures/served-card-european-repair-20261025.json'
import reviewTurn from './fixtures/served-card-qualitative-review-20261025.json'
import capacityTurn from './fixtures/served-card-capacity-leftout-20261025.json'
import funding from '../../runView/__tests__/fixtures/pass-funding-72300716-read.json'

type Json = Record<string, any>
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

let read: Json = funding as Json
let n = 0
/** A saved board on screen: a program board (the served funding read) or, `false`, the same read with no program flag. */
function board(program: boolean) {
  n += 1
  const graph = funding.graph as Json
  read = { ...funding, graph_hash: `${funding.graph_hash.slice(0, 11)}${String(n).padStart(5, '0')}`,
    graph: program ? graph : { ...graph, living_model: { aims: [], links: [], factors: [], options: [] } } }
  useCanvasStore.setState({ currentScenarioId: funding.scenario_id, lastServerGraphHash: read.graph_hash } as never)
}
const onChipClick = vi.fn(async (_chip: { id?: string }) => {})

/** The reply as the conversation builds it from a served body: its chips and its card, through the production parser. */
async function replyOf(body: Json) {
  const parsed = await parseV5Response(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }), { coreRoute: true })
  if (parsed.kind !== 'response') throw new Error(`the served body did not parse: ${parsed.kind}`)
  return { chips: buildSuggestedActionChips(parsed.response.blocks, parsed.response.suggested_actions), proposalFields: readTurnProposalFields(parsed.response) }
}
async function mount(body: Json) {
  const { chips, proposalFields } = await replyOf(body)
  render(<SuggestedChips chips={chips} onChipClick={onChipClick} proposalFields={proposalFields} />)
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
  return chips
}
const card = (body: Json): Json => body.cards[0]
const listed = (pid: string) => [...(screen.queryByTestId(`proposal-change-notes-${pid}`)?.querySelectorAll('li') ?? [])]
const chipEl = (id: string) => screen.getByTestId(`suggested-chip-${id}`) as HTMLButtonElement
const openList = (pid: string) => {
  const toggle = screen.getByTestId(`proposal-change-details-${pid}`)
  if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle)
}
/** Approve is shown, never pressable, with the card's one explanation; a press sends nothing. */
function expectApproveRefused(approveId: string) {
  expect(chipEl(approveId).disabled).toBe(true)
  expect(screen.getByTestId('suggested-chips-change-unread-reason').textContent).toBe(CHANGE_LIST_UNREAD)
  fireEvent.click(chipEl(approveId))
  expect(onChipClick).not.toHaveBeenCalled()
}
/** Approve is live, with no explanation line, and a press sends CEE's own approve. */
function expectApproveLive(approveId: string) {
  expect(chipEl(approveId).disabled).toBe(false)
  expect(screen.queryByTestId('suggested-chips-change-unread-reason')).toBeNull()
  fireEvent.click(chipEl(approveId))
  expect(onChipClick).toHaveBeenCalledTimes(1)
  expect(onChipClick.mock.calls[0][0]).toMatchObject({ id: approveId })
}

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

describe('served cards: the complete change, in CEE’s words, Olumi’s items marked', () => {
  it('the European reading card (`reading: true`): all 38 adds open under the reading heading, in CEE’s order; 25 Olumi’s, 13 the person’s', async () => {
    board(true)
    const c = card(readingTurn.body)
    await mount(readingTurn.body)
    expect(screen.getByTestId(`proposal-change-summary-${c.proposal_id}`).textContent).toBe('Your situation as I understood it')
    const items = listed(c.proposal_id)
    expect(items.map((li) => li.getAttribute('data-testid'))).toEqual(c.changes.map((e: Json) => `proposal-change-${e.kind}:${e.id}`))
    // CEE's label and rendered `after` verbatim in every entry; nothing shortened or reworded.
    c.changes.forEach((e: Json, i: number) => {
      expect(items[i].textContent).toContain(`‘${e.label}’`)
      expect(items[i].textContent).toContain(e.after)
    })
    expect(items[0].textContent).toBe('Adds ‘The target is 800.’: "Total customers" at least "Customer target" 800 customer, at its highest over '
      + '"Expansion timeframe" 6–12 month, the measure you named, resting on "The expansion timeframe is provisionally also the window for '
      + 'reaching the total customer target; the stated timeframe remains a range rather than a single chosen deadline.", in your words "The target is 800."')
    expect(screen.getByTestId('proposal-change-left_out:profitability_not_modelled').textContent)
      .toBe('Leaves out ‘Actual profitability and investment payback are not calculated.’ (Customer revenue, margins and operating costs are absent, '
        + 'so the churn guardrail is not a profit forecast. It concerns If it goes beyond 12%, we\'re in danger of losing money. and The investment budget is up to £500k.) · Olumi’s')
    // Whose each item is, by identity: Olumi's carry the mark, the person's never do.
    const marked = c.changes.filter((e: Json) => screen.queryByTestId(`proposal-change-olumi-${e.kind}:${e.id}`) !== null).map((e: Json) => e.id)
    expect(marked).toHaveLength(25)
    expect(c.changes.filter((e: Json) => !marked.includes(e.id)).map((e: Json) => e.id)).toEqual(['reach_customer_target', 'churn_guardrail',
      'investment_guardrail', 'competition_context', 'regulatory_context', 'starting_customers', 'customer_target', 'decision_horizon',
      'baseline_monthly_joins', 'baseline_churn', 'churn_ceiling', 'investment_budget', 'launch_delay'])
    expect(chipEl(c.approve_action.id).textContent).toBe('Yes, that’s what I meant')
    expectApproveLive(c.approve_action.id)
  })

  it('the European repair card: 31 entries with add, change and remove, each worded as CEE renders it', async () => {
    board(true)
    const c = card(repairTurn.body)
    await mount(repairTurn.body)
    expect(screen.getByTestId(`proposal-change-summary-${c.proposal_id}`).textContent)
      .toBe('Also changes 14 figures, 4 calculations, 1 goal, 2 options, 9 other items and 1 left-out item')
    openList(c.proposal_id)
    expect(listed(c.proposal_id)).toHaveLength(31)
    expect(screen.getByTestId('proposal-change-quantity:target_deadline').textContent)
      .toBe('Adds ‘Time allowed to reach the customer target’: no figure yet (in month), a fact, still to be given, Olumi asks "By when do you want to reach 800 customers?"')
    expect(screen.getByTestId('proposal-change-quantity:launch_delay').textContent)
      .toBe('Changes ‘Months until pilot launch readiness’: named "Months until European launch readiness" → named "Months until pilot launch readiness"')
    expect(screen.getByTestId('proposal-change-relation:acquisition_effect').textContent)
      .toBe('Removes ‘New customers per month’ (was: an effect on "New customers per month", starting from "New customers per month without European expansion" '
        + '(still to be given), changes by "Additional monthly customers per pound invested" (no figure yet customer/month/GBP) for each "Total committed '
        + 'European expansion investment" 0 GBP) · Olumi’s')
    const unmarked = c.changes.filter((e: Json) => screen.queryByTestId(`proposal-change-olumi-${e.kind}:${e.id}`) === null).map((e: Json) => e.id)
    expect(unmarked).toEqual(['launch_delay', 'target_deadline', 'larger_launch_delay', 'reach_customer_target'])
    expectApproveLive(c.approve_action.id)
  })

  it('the capacity card: the person’s two records unmarked, Olumi’s two left-out items marked and worded "Leaves out"', async () => {
    board(true)
    const c = card(capacityTurn.body)
    await mount(capacityTurn.body)
    expect(screen.getByTestId(`proposal-change-summary-${c.proposal_id}`).textContent).toBe('Also changes 2 other items and 2 left-out items')
    openList(c.proposal_id)
    expect(screen.getByTestId('proposal-change-record:staff_absence').textContent)
      .toBe('Adds ‘Staff absence’: about "Weekly support capacity", in your words "Add a factor called "Staff absence" that reduces weekly support capacity."')
    expect(screen.getByTestId('proposal-change-left_out:staff_absence_measurement_open').textContent)
      .toBe('Leaves out ‘The measurement of Staff absence remains open.’ (No measurement or unit has been chosen, so no numerical absence input has been '
        + 'introduced. Olumi asks: “How would you measure Staff absence?”. It concerns Staff absence and Staff absence reduces weekly support capacity.) · Olumi’s')
    expect(screen.queryByTestId('proposal-change-olumi-record:staff_absence')).toBeNull()
    expect(screen.queryByTestId('proposal-change-olumi-record:staff_absence_reduces_capacity')).toBeNull()
    expect(screen.getByTestId('proposal-change-olumi-left_out:staff_absence_effect_open')).toBeTruthy()
    expectApproveLive(c.approve_action.id)
  })
})

describe('a card kept for review offers no approve (verify: served qualitative 05-edit, CEE `review_action`)', () => {
  it('🔴 the live core turn offers "Review this change", as a reopen does, never the card’s approve', async () => {
    board(true)
    const c = card(reviewTurn.body)
    expect(c.review_action.id).toBe(`agent-review-proposal:${c.proposal_id}`)
    const chips = await mount(reviewTurn.body)
    // The reopen path (`reconcileRestoredProposalFields`) offers `review_action ?? approve_action`; the live turn must match.
    expect(chips.map((k) => k.id)).toContain(c.review_action.id)
    expect(chips.map((k) => k.id)).not.toContain(c.approve_action.id)
    expect(screen.queryByTestId(`suggested-chip-${c.approve_action.id}`)).toBeNull()
  })
})

describe('🔴 (a) a present `changes` that is not a list: nothing can be shown, so nothing can be approved (any board)', () => {
  // On a board that is not a program board, so the row turns on the reading of `changes` alone, never on the board.
  for (const [name, value] of [['an object', { 0: {} }], ['a string', 'changes'], ['a number', 3], ['null', null]] as const) {
    it(`served repair card, \`changes\` replaced by ${name}: Approve disabled with its explanation`, async () => {
      board(false)
      const body = clone(repairTurn.body) as Json
      body.cards[0].changes = value
      await mount(body)
      expectApproveRefused(card(body).approve_action.id)
    })
  }
})

describe('🔴 (b) a program board: an approve whose card cannot be read is not offered', () => {
  it('served repair card with a malformed digest (the card fails the held-card schema): Approve disabled with its explanation', async () => {
    board(true)
    const body = clone(repairTurn.body) as Json
    body.cards[0].digest = 'not-a-digest'
    await mount(body)
    expect(listed(card(body).proposal_id)).toHaveLength(0)
    expectApproveRefused(card(body).approve_action.id)
  })

  it('an approve whose card is not in the held set this reply carries: Approve disabled with its explanation', async () => {
    board(true)
    const { chips } = await replyOf(repairTurn.body)
    const other = await replyOf(capacityTurn.body)
    render(<SuggestedChips chips={chips} onChipClick={onChipClick} proposalFields={other.proposalFields} />)
    await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
    expectApproveRefused(card(repairTurn.body).approve_action.id)
  })

  it('CONTRAST: the same malformed card on a board that is not a program board keeps today’s behaviour (Approve live)', async () => {
    board(false)
    const body = clone(repairTurn.body) as Json
    body.cards[0].digest = 'not-a-digest'
    await mount(body)
    expectApproveLive(card(body).approve_action.id)
  })
})

describe('🔴 (c) a program board: a card with no `changes[]` cannot be shown in full', () => {
  it('served repair card with `changes` removed: Approve disabled with its explanation (CEE’s notes still on view)', async () => {
    board(true)
    const body = clone(repairTurn.body) as Json
    delete body.cards[0].changes
    await mount(body)
    expect(screen.getByTestId(`proposal-change-notes-${card(body).proposal_id}`)).toBeTruthy()
    expectApproveRefused(card(body).approve_action.id)
  })

  it('CONTRAST: the same card on a board that is not a program board keeps its change notes and a live Approve', async () => {
    board(false)
    const body = clone(repairTurn.body) as Json
    delete body.cards[0].changes
    await mount(body)
    const pid = card(body).proposal_id
    openList(pid)
    expect(listed(pid).map((li) => li.textContent)).toEqual(card(body).adds.map((a: Json) => a.text))
    expectApproveLive(card(body).approve_action.id)
  })
})
