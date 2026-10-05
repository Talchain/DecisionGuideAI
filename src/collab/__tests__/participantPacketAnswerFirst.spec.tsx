/**
 * D2 / R8 (DL ruling 1: the UI-only anchor guard is accepted for the PoC). A colleague who is both
 * a member and a panellist could open the shared decision and see the model's own number before
 * answering, which breaks blindness for that person. The smallest guard: before the participant's
 * FIRST response, the packet page offers NO route to the shared decision, and it says to answer
 * first. (A server guard is out of scope: access state must not depend on round state.)
 *
 * Measured at staging 727c8afe: the packet page renders no links at all. The link half is therefore
 * a regression guard, with a selector self-check so its absence is not vacuous.
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../../canvas/hooks/useBeliefElicitation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../canvas/hooks/useBeliefElicitation')>()
  return {
    ...actual,
    useBeliefElicitation: vi.fn(() => ({ suggestion: null, loading: false, error: null, request: vi.fn(), reset: vi.fn() })),
  }
})

import ParticipantPacketPage, { ANSWER_FIRST_COPY } from '../../pages/ParticipantPacketPage'
import type { OpenPacket } from '../collabService'
import { __resetParticipantTokenForTests, setParticipantToken } from '../participantToken'

const ROUND = 'rnd-answer-first-r8'
const PACKET_URL = `/bff/collab/packet/${ROUND}`
const TARGET = 'factor-churn-risk-R8'

type StubResponse = Pick<Response, 'ok' | 'status' | 'json'>
let fetchMock: Mock<[input: RequestInfo | URL, init?: RequestInit], Promise<StubResponse>>

function packet(completed: string[]): OpenPacket {
  return {
    round_id: ROUND,
    status: 'open',
    context_note: null,
    graph_version_ref: 'gv-1',
    targets: [{ target: { kind: 'factor' as const, id: TARGET }, label: 'Churn risk', description: null, unit: null }],
    self: { participant_id: 'p-r8', display_name: 'Grace', completed_target_ids: completed },
  }
}

function renderWith(completed: string[]): void {
  fetchMock.mockImplementation(async (input: RequestInfo | URL) =>
    String(input) === PACKET_URL
      ? { ok: true, status: 200, json: async () => packet(completed) }
      : { ok: false, status: 404, json: async () => ({ code: 'not_stubbed' }) },
  )
  render(
    <MemoryRouter initialEntries={[`/panel/${ROUND}`]}>
      <Routes>
        <Route path="/panel/:round_id" element={<ParticipantPacketPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Every element that could route the participant to a decision on the canvas. */
const SCENARIO_ROUTE = 'a[href*="#/scenario"], a[href*="/scenario/"]'

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  setParticipantToken('CODE-R8-answer-first')
})

afterEach(() => {
  vi.unstubAllGlobals()
  __resetParticipantTokenForTests()
})

describe('R8: answer before you look at the model', () => {
  it('SELECTOR SELF-CHECK: the route selector does see a scenario link when one exists (absence below is not vacuous)', () => {
    const host = document.createElement('div')
    host.innerHTML = '<a href="#/scenario/3b241101-e2bb-4255-8caf-4136c566a962">open</a>'
    expect(host.querySelectorAll(SCENARIO_ROUTE)).toHaveLength(1)
  })

  it('before the first response: the page says to answer first and offers NO route to the shared decision', async () => {
    renderWith([])
    await waitFor(() => expect(screen.getByTestId('participant-packet-page')).toBeInTheDocument())
    expect(screen.getByTestId('packet-answer-first')).toHaveTextContent(ANSWER_FIRST_COPY)
    expect(ANSWER_FIRST_COPY).toBe('Answer before you look at the model.')
    expect(document.querySelectorAll(SCENARIO_ROUTE)).toHaveLength(0)
  })

  it('after a response (self.completed_target_ids non-empty): the answer-first line is gone', async () => {
    renderWith([TARGET])
    await waitFor(() => expect(screen.getByTestId('participant-packet-page')).toBeInTheDocument())
    expect(screen.queryByTestId('packet-answer-first')).toBeNull()
  })
})
