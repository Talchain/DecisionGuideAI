/**
 * ⭐ PAUL'S FIRST SCREEN, THE READING CARD (27 Oct, a program board). Two rows:
 *   1. NO BLANKET CARD: the reading card offers no "Yes, that's what I meant" (its whole-card approve), no "Not now" and no
 *      "Change something first"; the reading list stands in their place.
 *   2. THE READING LIST, FOLDED: the heading, the counted marks, the top 3 rows to check (the card's own rows in its own
 *      order, Olumi's first, then the person's) and "Show all (N)". Hovering a row whose record is a card on the canvas
 *      highlights that card; clicking it opens the card's panel. A note (no card) has no highlight; a click opens CEE's
 *      words for it in place.
 *
 * Real path: the served European first-draft turn (`served-acceptance-european-draft-turn-20261026.json`, `reading: true`,
 * 42 rows, every row grouped; its `_source` names the run) through the production parser into the real `SuggestedChips`.
 * The board is the real saved-graph read with only `fetch` stubbed: the same run's served read
 * (`served-acceptance-european-read-20261026.json`, `living_model.model_program` "v1"); the contrast strips the program
 * flag. The canvas holds the turn's own graph, mapped by the production mapper (`mapDraftNodeToCanvas`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))

import { SuggestedChips } from '../zones/SuggestedChips'
import { readTurnProposalFields, READING_HEADING, AMEND_PROPOSAL_ACTION, type ProposalChange } from '../proposalFields'
import { buildSuggestedActionChips } from '../../../v5/blocks/suggestedActionChips'
import { parseV5Response } from '../../../v5/responseParser'
import { mapDraftNodeToCanvas } from '../../utils/applyDraftResult'
import { OPEN_FULL_INSPECTOR_EVENT } from '../../utils/openEdgeStrengthEditor'
import { useCanvasStore } from '../../store'
import european from './fixtures/served-acceptance-european-draft-turn-20261026.json'
import europeanRead from '../../nodes/__tests__/fixtures/served-acceptance-european-read-20261026.json'

type Json = Record<string, any>
const body = european.body as Json
const card = body.cards[0] as Json
const PID: string = card.proposal_id
const changes = card.changes as ProposalChange[]

let read: Json = europeanRead as Json
let n = 0
/** The board on screen: the served read (a program board), or the same read with no program flag; `pending` never answers. */
function board(kind: 'program' | 'not_program' | 'pending') {
  n += 1
  const graph = europeanRead.graph as Json
  read = { ...europeanRead, graph_hash: `${'35bd2bd1f79'}${String(n).padStart(5, '0')}`,
    graph: kind === 'not_program' ? { ...graph, living_model: { aims: [], links: [], factors: [], options: [] } } : graph }
  useCanvasStore.setState({ currentScenarioId: europeanRead.scenario_id, lastServerGraphHash: read.graph_hash,
    nodes: (body.model.graph.nodes as Json[]).map(mapDraftNodeToCanvas), edges: [], highlightedNodes: new Set<string>() } as never)
  vi.stubGlobal('fetch', vi.fn(async (url: string) => (
    kind === 'pending' ? new Promise(() => {})
      : /\/scenarios\/[^/]+\/graph$/.test(String(url)) ? new Response(JSON.stringify(read), { status: 200, headers: { 'Content-Type': 'application/json' } })
        : new Response('{}', { status: 404 })
  )))
}

async function mount() {
  const parsed = await parseV5Response(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }), { coreRoute: true })
  if (parsed.kind !== 'response') throw new Error(`the served body did not parse: ${parsed.kind}`)
  render(<SuggestedChips chips={buildSuggestedActionChips(parsed.response.blocks, parsed.response.suggested_actions)}
    onChipClick={vi.fn(async () => {})} proposalFields={readTurnProposalFields(parsed.response)} />)
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
}
const rowIds = () => [...screen.getByTestId(`proposal-change-notes-${PID}`).querySelectorAll('li')].map((li) => li.getAttribute('data-testid'))
const highlighted = () => [...useCanvasStore.getState().highlightedNodes]

beforeEach(() => {
  window.history.replaceState(null, '', '/?ai=core-route')
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/') })

describe('1. no blanket card', () => {
  it('on a program board the reading card offers no whole-card approve, "Not now" or "Change something first": the reading list stands instead', async () => {
    board('program')
    await mount()
    expect(card.reading).toBe(true)
    expect(screen.queryByTestId(`suggested-chip-${card.approve_action.id}`)).toBeNull()
    expect(screen.queryByTestId(`suggested-chip-${card.decline_action.id}`)).toBeNull()
    expect(screen.queryByTestId(`suggested-chip-${AMEND_PROPOSAL_ACTION.id}`)).toBeNull()
    // The reply offered only the card's three, so it has no chip row at all; the list's own "Confirm (0)" waits for a tick.
    expect(screen.queryByTestId('suggested-chips')).toBeNull()
    expect(screen.getByTestId(`proposal-change-summary-${PID}`).textContent).toBe(READING_HEADING)
    expect(screen.getByTestId(`reading-confirm-${PID}`).textContent).toBe('Confirm (0)')
  })

  it('CONTRAST: on a board the read says is not a program board the card is as before; while the read is out, no whole-card approve shows', async () => {
    board('not_program')
    await mount()
    expect(screen.getByTestId(`suggested-chip-${card.approve_action.id}`).textContent).toBe(card.approve_action.label)
    expect(screen.getByTestId(`suggested-chip-${card.decline_action.id}`).textContent).toBe('Not now')
    expect(screen.queryByTestId(`reading-confirm-${PID}`)).toBeNull()
    cleanup()
    // A reading card is only ever a program card: a press here would approve all 42 rows, so it never shows unread.
    board('pending')
    await mount()
    expect(screen.queryByTestId(`suggested-chip-${card.approve_action.id}`)).toBeNull()
    expect(screen.getByTestId(`reading-confirm-${PID}`)).toBeTruthy()
  })
})

describe('2. the reading list, folded', () => {
  it('the heading, the counted marks, the top 3 rows to check (Olumi’s first, in the card’s order) and "Show all (42)"; unfolded, all 42 in check order', async () => {
    board('program')
    await mount()
    expect(changes).toHaveLength(42)
    // The counted marks, from the card's own groups (12 from the brief, 12 Olumi's to check, 2 left out).
    expect(screen.getByTestId(`reading-group-${PID}-used`).getAttribute('aria-label')).toBe('From your brief: 12')
    expect(screen.getByTestId(`reading-group-${PID}-inferred`).getAttribute('aria-label')).toBe('Olumi’s, for you to check: 12')
    expect(screen.getByTestId(`reading-group-${PID}-left_out`).getAttribute('aria-label')).toBe('Left out of the calculation: 2')
    // The card's first three Olumi rows, by identity: the card itself opens with four of the person's rows.
    expect(changes.slice(0, 4).map((c) => c.author)).toEqual(['person', 'person', 'person', 'person'])
    expect(rowIds()).toEqual(['proposal-change-option:limited_european_pilot', 'proposal-change-option:no_european_expansion',
      'proposal-change-left_out:profitability_not_established'])
    const showAll = screen.getByTestId(`reading-show-all-${PID}`)
    expect(showAll.textContent).toBe(' Show all (42)')
    fireEvent.click(showAll)
    // Olumi's (author olumi and not a fixed part of the structure, or CEE's Olumi group), then the person's, then the rest.
    const olumis = changes.filter((c) => (c.author === 'olumi' && c.structure !== true) || c.group === 'inferred')
    const persons = changes.filter((c) => !olumis.includes(c) && c.author === 'person')
    const rest = changes.filter((c) => !olumis.includes(c) && !persons.includes(c))
    expect([olumis.length, persons.length, rest.length]).toEqual([24, 15, 3])
    expect(rowIds()).toEqual([...olumis, ...persons, ...rest].map((c) => `proposal-change-${c.kind}:${c.id}`))
    expect(rest.map((c) => c.id)).toEqual(['expansion_scale', 'percentage_scale', 'european_expansion__expansion_scale'])
    // Every row Olumi's still wears the Olumi mark (#3038), the person's and the structure's never do.
    const marked = changes.filter((c) => screen.queryByTestId(`proposal-change-olumi-${c.kind}:${c.id}`) !== null).map((c) => c.id)
    expect(marked).toEqual(changes.filter((c) => c.author === 'olumi' && c.structure !== true).map((c) => c.id))
    expect(marked).toHaveLength(24)
    expect(marked).not.toContain('reach_customer_target')
    expect(screen.getByTestId('proposal-change-open-option:limited_european_pilot').textContent).toBe('Limited European pilot · Olumi’s')
  })

  it('a row on the canvas highlights its card on hover and opens its panel on a click; a note has no highlight and opens CEE’s words', async () => {
    board('program')
    await mount()
    const opened = vi.fn()
    window.addEventListener(OPEN_FULL_INSPECTOR_EVENT, opened)
    const option = screen.getByTestId('proposal-change-option:limited_european_pilot')
    fireEvent.mouseEnter(option)
    expect(highlighted()).toEqual(['limited_european_pilot'])
    fireEvent.mouseLeave(option)
    expect(highlighted()).toEqual([])
    fireEvent.click(screen.getByTestId('proposal-change-open-option:limited_european_pilot'))
    expect([...useCanvasStore.getState().selection.nodeIds]).toEqual(['limited_european_pilot'])
    expect(opened).toHaveBeenCalledTimes(1)
    // The left-out row is no card on the canvas: no highlight, and its click opens CEE's words in place, not a panel.
    const leftOut = changes.find((c) => c.id === 'profitability_not_established')!
    expect(useCanvasStore.getState().nodes.some((nd) => nd.id === leftOut.id)).toBe(false)
    fireEvent.mouseEnter(screen.getByTestId('proposal-change-left_out:profitability_not_established'))
    expect(highlighted()).toEqual([])
    fireEvent.click(screen.getByTestId('proposal-change-open-left_out:profitability_not_established'))
    expect(screen.getByTestId('proposal-change-detail-left_out:profitability_not_established').textContent)
      .toBe(`Leaves out ‘${leftOut.label}’ (${leftOut.after})`)
    expect(opened).toHaveBeenCalledTimes(1)
    window.removeEventListener(OPEN_FULL_INSPECTOR_EVENT, opened)
  })
})
