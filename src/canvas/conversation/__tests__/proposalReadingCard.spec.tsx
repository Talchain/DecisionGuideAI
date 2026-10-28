/**
 * ⭐ "CHECK WHAT I UNDERSTOOD", THE UI HALF (DL 23 Oct; Paul's design: one card after the first draft shows Olumi's reading
 * of the brief, each item beside the person's words, and what was left out; the person confirms or corrects it in one step).
 * CEE flags that card `reading: true` and the UI never infers it from what the card holds. On a reading card:
 *   · the heading is "Your situation as I understood it", in place of the "Also changes …" summary;
 *   · the change list starts open, in CEE's order as given;
 *   · the approve says what CEE sends (its own label), and "Not now" as on every card; "Change something first" is not
 *     shown (W4, Paul 27 Oct: the draft is saved and the card has no field to change, so it only sent a canned sentence).
 *     To change something the person types it. A change card (no reading flag) keeps it.
 *   · ON A PROGRAM BOARD the reading card whose changes can all be shown is the first screen's reading list instead, with
 *     no whole-card approve and no "Not now" (Paul, 27 Oct: `firstScreenReadingList.spec.tsx`). The first row here is
 *     therefore on a board the read says is not a program board; the unreadable card (row 3) is today's card on both.
 * A `left_out` entry is a readable kind on every card, worded "Leaves out ‘label’ (why)", so Approve stays live for it;
 * an unknown kind is still unreadable and still blocks Approve (#2958).
 *
 * The card is illustrative, in the shape CEE's #3715 renders (`postimage.ts` changeOf: each item's substance with the
 * person's words in quotes) plus the `reading` flag and the `left_out` kind its CEE half will send. Real path: the real
 * `SuggestedChips`, the real saved-graph read (only `fetch` stubbed, the served funding read).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))

import { CHANGE_LIST_UNREAD, SuggestedChips } from '../zones/SuggestedChips'
import { AMEND_PROPOSAL_ACTION } from '../proposalFields'
import { buildSuggestedActionChips } from '../../../v5/blocks/suggestedActionChips'
import { useCanvasStore } from '../../store'
import fixture from './fixtures/program-card-changes.json'
import funding from '../../runView/__tests__/fixtures/pass-funding-72300716-read.json'

type Json = Record<string, any>
const PID = fixture.card.proposal_id
/** The approve CEE sends on a reading card (its words, not the UI's). */
const CONFIRM = { id: `agent-approve-proposal:${PID}`, label: 'Yes, that’s what I meant', message: 'Yes, that’s what I meant.' }
const goal = { id: 'secure_funding', kind: 'goal', action: 'add', label: 'Secure funding within two months', before: null,
  after: 'Funding received at least £100,000, within 2 month ("raise £100k in the next two months")', author: 'person' }
const option = { id: 'angel_route', kind: 'option', action: 'add', label: 'Add an angel round', before: null,
  after: 'Angel route on → 1 from the start ("we could also try angels")', author: 'person' }
const leftOut = { id: 'team_morale', kind: 'left_out', action: 'add', label: 'Team morale during the raise', before: null,
  after: 'It has no measure in this model; asks: How would you know morale had dropped?', author: 'olumi' }
const figure = { id: 'firm_receipt_rate', kind: 'quantity', action: 'add', label: 'Share of the intended firm raise received per month', before: null,
  after: '0–0.5 / month, most likely 0.05 (plausible) (estimated)', author: 'olumi' }
const reading = (extra: Json = {}): Json => ({ ...fixture.card, approve_action: CONFIRM, adds: [], changes: [goal, option, leftOut, figure], reading: true, ...extra })

let read: Json = funding as Json
let n = 0
/** A saved board on screen: the served funding read (a program board) or, `false`, the same read with no program flag. */
function board(program = true) {
  n += 1
  read = { ...funding, graph_hash: `${funding.graph_hash.slice(0, 12)}${String(n).padStart(4, '0')}`,
    ...(program ? {} : { graph: { ...funding.graph, living_model: { aims: [], links: [], factors: [], options: [] } } }) }
  useCanvasStore.setState({ currentScenarioId: funding.scenario_id, lastServerGraphHash: read.graph_hash } as never)
}
const onChipClick = vi.fn(async (_chip: { id?: string }) => {})
/** The card as the core turn offers it: its approve, "Change something first" and "Not now". Details is never pressed here. */
async function mount(card: Json) {
  const fields = { version: 1, graph_hash: fixture.graph_hash, proposals: [card] }
  const actions = [card.approve_action, AMEND_PROPOSAL_ACTION, card.decline_action] as never[]
  render(<SuggestedChips chips={buildSuggestedActionChips([], actions)} onChipClick={onChipClick} proposalFields={fields} />)
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
}
const heading = () => screen.getByTestId(`proposal-change-summary-${PID}`).textContent
const listed = () => [...screen.getByTestId(`proposal-change-notes-${PID}`).querySelectorAll('li')]
const chip = (id: string) => screen.getByTestId(`suggested-chip-${id}`) as HTMLButtonElement

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

describe('a reading card (CEE `reading: true`): your situation as I understood it', () => {
  it('off a program board: renders open under its heading, in CEE’s order, left out worded, with CEE’s approve and Not now, and no Change chip', async () => {
    board(false)
    await mount(reading())
    expect(heading()).toBe('Your situation as I understood it')
    // Open with no press: every entry is on view, in the order CEE gave.
    expect(screen.getByTestId(`proposal-change-details-${PID}`).getAttribute('aria-expanded')).toBe('true')
    expect(listed().map((li) => li.textContent)).toEqual([
      'Adds ‘Secure funding within two months’: Funding received at least £100,000, within 2 month ("raise £100k in the next two months")',
      'Adds ‘Add an angel round’: Angel route on → 1 from the start ("we could also try angels")',
      'Leaves out ‘Team morale during the raise’ (It has no measure in this model; asks: How would you know morale had dropped?) · Olumi’s',
      'Adds ‘Share of the intended firm raise received per month’: 0–0.5 / month, most likely 0.05 (plausible) (estimated) · Olumi’s',
    ])
    expect(listed().map((li) => li.getAttribute('data-testid')))
      .toEqual(['proposal-change-goal:secure_funding', 'proposal-change-option:angel_route', 'proposal-change-left_out:team_morale', 'proposal-change-quantity:firm_receipt_rate'])
    // The approve is CEE's own words and "Not now" is every card's; the amend chip CEE sent is not rendered (W4).
    expect(chip(CONFIRM.id).textContent).toBe('Yes, that’s what I meant')
    expect(chip(fixture.card.decline_action.id).textContent).toBe('Not now')
    expect(screen.queryByTestId(`suggested-chip-${AMEND_PROPOSAL_ACTION.id}`)).toBeNull()
    expect([...screen.getByTestId('suggested-chips').querySelectorAll('button')].map((b) => b.getAttribute('data-testid')))
      .toEqual([`suggested-chip-${CONFIRM.id}`, `suggested-chip-${fixture.card.decline_action.id}`])
    // A left-out entry is readable: Approve is live, with no reason line, and a press sends CEE's approve.
    expect(screen.queryByTestId('suggested-chips-change-unread-reason')).toBeNull()
    expect(chip(CONFIRM.id).disabled).toBe(false)
    fireEvent.click(chip(CONFIRM.id))
    expect(onChipClick).toHaveBeenCalledTimes(1)
    expect(onChipClick.mock.calls[0][0]).toMatchObject({ id: CONFIRM.id })
  })

  it('CONTRAST: the same card with no reading flag (absent, false or the text "true") keeps the summary, a closed list and its Change chip', async () => {
    for (const flag of [undefined, false, 'true']) {
      board()
      const { reading: _none, ...card } = reading()
      await mount(flag === undefined ? card : { ...card, reading: flag })
      expect(heading()).toBe('Also changes 1 goal, 1 option, 1 left-out item and 1 figure')
      expect(screen.getByTestId(`proposal-change-details-${PID}`).getAttribute('aria-expanded')).toBe('false')
      expect(listed()).toHaveLength(0)
      // A change card keeps "Change something first", by its id, between the approve and "Not now".
      expect([...screen.getByTestId('suggested-chips').querySelectorAll('button')].map((b) => b.getAttribute('data-testid')))
        .toEqual([`suggested-chip-${CONFIRM.id}`, `suggested-chip-${AMEND_PROPOSAL_ACTION.id}`, `suggested-chip-${fixture.card.decline_action.id}`])
      expect(chip(AMEND_PROPOSAL_ACTION.id).textContent).toBe('Change something first')
      // Opened, a left-out entry reads the same on any card.
      fireEvent.click(screen.getByTestId(`proposal-change-details-${PID}`))
      expect(screen.getByTestId('proposal-change-left_out:team_morale').textContent)
        .toBe('Leaves out ‘Team morale during the raise’ (It has no measure in this model; asks: How would you know morale had dropped?) · Olumi’s')
      cleanup()
    }
  })

  it('an unknown kind is still unreadable on a reading card: dropped, Approve disabled with its reason', async () => {
    board()
    await mount(reading({ changes: [goal, { ...figure, id: 'odd', kind: 'mystery' }, leftOut] }))
    expect(listed().map((li) => li.getAttribute('data-testid'))).toEqual(['proposal-change-goal:secure_funding', 'proposal-change-left_out:team_morale'])
    expect(screen.getByTestId('suggested-chips-change-unread-reason').textContent).toBe(CHANGE_LIST_UNREAD)
    expect(chip(CONFIRM.id).disabled).toBe(true)
    fireEvent.click(chip(CONFIRM.id))
    expect(onChipClick).not.toHaveBeenCalled()
  })
})
