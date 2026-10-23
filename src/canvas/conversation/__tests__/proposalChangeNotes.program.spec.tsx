/**
 * A PROGRAM CARD'S DETAILS SAY PLAIN WORDS ONLY (DL, 23 Oct; served on-screen pass, funding brief). CEE's held card for the
 * £100,000 measure carried 13 change notes written from the program's raw record fields: "kind was not stated, now
 * “define_goal_measure”; cmp was not stated, now “>=”…", "parts {"id":"firm_raise_amount","power":1}…", and four headed only
 * by an internal id ("Adds ‘firm_funding_inflow_definition’"). The summary read "Also changes 13 other changes".
 *
 * On a program board (`living_model.model_program` "v1", read through the real saved-graph read) the summary is in plain
 * nouns: "Also changes 1 goal, 4 calculations and 8 figures". A board that is not a program board says "13 other changes".
 * Details: CEE's `changes[]` on every program proposal since #3715 (`proposalChanges.spec.tsx`); the interim plain heads
 * for a program card without it (#2956) are retired, so an absent list shows CEE's notes as on any other board.
 *
 * Fixture: the served card (CEE b8afd1c2 core turn reply, cards[0] verbatim) and the served funding read (trimmed).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))

import { SuggestedChips } from '../zones/SuggestedChips'
import { buildSuggestedActionChips } from '../../../v5/blocks/suggestedActionChips'
import { useCanvasStore } from '../../store'
import served from './fixtures/served-funding-card-72300716.json'
import funding from '../../runView/__tests__/fixtures/pass-funding-72300716-read.json'

type Json = Record<string, unknown>
const PID = served.card.proposal_id
let read: Json = funding as Json
let n = 0
/** The funding board on screen, its saved read served as given (the program flag is read from it). */
function board(livingModel: Json | null) {
  n += 1
  const graph = funding.graph as Json
  read = { ...funding, graph_hash: `${funding.graph_hash.slice(0, 12)}${String(n).padStart(4, '0')}`,
    graph: livingModel === null ? graph : { ...graph, living_model: livingModel } }
  useCanvasStore.setState({ currentScenarioId: funding.scenario_id, lastServerGraphHash: read.graph_hash } as never)
}
async function mount() {
  const fields = { version: 1, graph_hash: served.graph_hash, proposals: [served.card] }
  render(<SuggestedChips chips={buildSuggestedActionChips([], [served.card.approve_action as never])} onChipClick={vi.fn(async () => {})} proposalFields={fields} />)
  // The saved-graph read (the program flag) answers before anything asserts.
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
}
const summary = () => screen.getByTestId(`proposal-change-summary-${PID}`).textContent
const details = () => {
  fireEvent.click(screen.getByTestId(`proposal-change-details-${PID}`))
  return [...screen.getByTestId(`proposal-change-notes-${PID}`).querySelectorAll('li')].map((li) => li.textContent)
}

beforeEach(() => {
  window.history.replaceState(null, '', '/?ai=core-route')
  vi.stubGlobal('fetch', vi.fn(async (url: string) => (
    /\/scenarios\/[^/]+\/graph$/.test(String(url))
      ? new Response(JSON.stringify(read), { status: 200, headers: { 'Content-Type': 'application/json' } })
      : new Response('{}', { status: 404 })
  )))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/') })

describe('the served funding card on a program board', () => {
  it('summary: "Also changes 1 goal, 4 calculations and 8 figures", never "13 other changes"', async () => {
    board(null)
    await mount()
    expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u).endsWith(`/scenarios/${funding.scenario_id}/graph`))).toBe(true)
    expect(summary()).toBe('Also changes 1 goal, 4 calculations and 8 figures')
  })

  it('Details with no `changes[]`: CEE’s notes as sent, every one, as on any other board (interim heads retired)', async () => {
    board(null)
    await mount()
    expect(details()).toEqual(served.card.adds.map((a) => a.text))
  })
})

describe('CONTROL: the same card on a board that is not a program board is unchanged', () => {
  it('no model_program: the summary and every note in CEE’s words, as before', async () => {
    board({ aims: [], links: [], factors: [], options: [] })
    await mount()
    expect(summary()).toBe('Also changes 13 other changes')
    const items = details()
    expect(items).toHaveLength(13)
    expect(items[0]).toBe(served.card.adds[0].text)
    expect(items[1]).toBe(served.card.adds[1].text)
  })
})
