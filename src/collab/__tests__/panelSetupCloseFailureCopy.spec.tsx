/**
 * COLLAB — what the owner is TOLD when a close fails (W-F2).
 *
 * ── THE LIE THIS PINS (witnessed fresh 12 Aug 2026, leg 6) ─────────────────
 * After an out-of-band close, the owner clicked "Close the round…" and the
 * error card said "The round is still open." — while the round was CLOSED at
 * the wire. The copy asserted a state it could not know: it was the fallback
 * for EVERY non-credential failure (500 INTERNAL included), not a fact derived
 * from the wire's answer.
 *
 * ── THE HONEST MAPPING, derived from the codes the wire actually returns ───
 * • `collab_round_closed` (409, close): NOT a failure — the call site falls
 *   through to the reveal (pinned by panelSetupRoundRecovery.spec.tsx, "a
 *   round already closed elsewhere is NOT a dead end").
 * • `collab_round_open` (409, reveal): the ONE code that PROVES the round is
 *   still open — only this branch may say so.
 * • Everything else (500 INTERNAL, unknown codes, non-JSON bodies): the state
 *   is UNKNOWN. The copy must not assert it either way, and the detail names
 *   the server's own code so the failure is diagnosable.
 *
 * Assertions bind to the rendered surface (`panel-error-guidance` /
 * `panel-error-detail`) — the exact card the witness photographed lying.
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../../lib/supabase', async (importOriginal) => {
  // Spread the real module rather than hand-list its exports (trap 12).
  const actual = await importOriginal<typeof import('../../lib/supabase')>()
  return { ...actual, getSessionIdentity: vi.fn() }
})

import { getSessionIdentity } from '../../lib/supabase'
import PanelSetupPage from '../../pages/PanelSetupPage'
import { recallOpenRound, rememberOpenRound } from '../openRoundRecord'

const SCENARIO_ID = 'scn-closecopy-1111'
const ROUND_ID = 'rnd-closecopy-2222'
const OWNER_TOKEN = 'owner-access-token-closecopy'

type StubResponse = Pick<Response, 'ok' | 'status' | 'json'>

let fetchMock: Mock<[input: RequestInfo | URL, init?: RequestInit], Promise<StubResponse>>

function jsonResponse(body: unknown, status = 200): StubResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

const HEALTHY_REVEAL = {
  round_id: ROUND_ID,
  status: 'closed',
  graph_version_ref: 'gv-1',
  per_target: [],
}

function renderOwnerPanel(): void {
  render(
    <MemoryRouter initialEntries={[`/scenario/${SCENARIO_ID}/panel`]}>
      <Routes>
        <Route path="/scenario/:id/panel" element={<PanelSetupPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function seedRecord(): void {
  rememberOpenRound({
    roundId: ROUND_ID,
    scenarioId: SCENARIO_ID,
    participants: [{ participant_id: 'p-a', display_name: 'Ada' }],
  })
}

/** Stub close + reveal by status/code; everything else 404s loudly. */
function stubWire(args: {
  close: StubResponse
  reveal: StubResponse
}): void {
  fetchMock.mockImplementation(async (input, init) => {
    const url = String(input)
    if (url === `/bff/collab/rounds/${ROUND_ID}/close` && init?.method === 'POST') {
      return args.close
    }
    if (url === `/bff/collab/rounds/${ROUND_ID}/reveal`) {
      return args.reveal
    }
    return jsonResponse({ code: 'not_stubbed', message: url }, 404)
  })
}

beforeEach(() => {
  localStorage.clear()
  fetchMock = vi.fn(async (input: RequestInfo | URL) =>
    jsonResponse({ code: 'not_stubbed', message: String(input) }, 404),
  )
  vi.stubGlobal('fetch', fetchMock)
  vi.mocked(getSessionIdentity).mockResolvedValue({ userId: 'user-abc', accessToken: OWNER_TOKEN })
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('close failure copy tells the truth about round state (W-F2)', () => {
  it('an unexplained failure (500 INTERNAL) does NOT claim the round is still open, and names the code', async () => {
    seedRecord()
    // The witnessed shape: CEE flattened the refusal to 500 INTERNAL. The
    // reveal is stubbed HEALTHY so the only way this test passes is the copy
    // itself being honest — not the flow accidentally never rendering it.
    stubWire({
      close: jsonResponse({ code: 'INTERNAL', message: 'Internal server error' }, 500),
      reveal: jsonResponse(HEALTHY_REVEAL),
    })

    renderOwnerPanel()
    fireEvent.click(screen.getByTestId('panel-resume-close'))

    await waitFor(() => expect(screen.getByTestId('panel-error')).toBeInTheDocument())
    // The card must not paint success…
    expect(screen.queryByTestId('collab-reveal')).toBeNull()
    // …and must not assert a state the wire did not establish. This is the
    // sentence the witness photographed lying about a CLOSED round.
    expect(screen.getByTestId('panel-error-guidance')).not.toHaveTextContent(
      /the round is still open/i,
    )
    // Honest unknown instead — and still actionable.
    expect(screen.getByTestId('panel-error-guidance')).toHaveTextContent(
      /could not confirm/i,
    )
    // The server's own code is named, so the failure is diagnosable.
    expect(screen.getByTestId('panel-error-detail')).toHaveTextContent(/INTERNAL/)
    // The recovery record survives an unexplained failure.
    expect(recallOpenRound(SCENARIO_ID)?.round_id).toBe(ROUND_ID)
  })

  it('collab_round_open — the one code that PROVES the round is open — may say so, and names the code', async () => {
    seedRecord()
    // A reachable race: the close lands (200) but the reveal is refused with
    // `collab_round_open`. The wire has POSITIVELY said the round is open —
    // here, and only here, "still open" is the truth.
    stubWire({
      close: jsonResponse({ round_id: ROUND_ID, status: 'closed' }),
      reveal: jsonResponse(
        { code: 'collab_round_open', message: 'The round has not been closed.' },
        409,
      ),
    })

    renderOwnerPanel()
    fireEvent.click(screen.getByTestId('panel-resume-close'))

    await waitFor(() => expect(screen.getByTestId('panel-error')).toBeInTheDocument())
    expect(screen.getByTestId('panel-error-guidance')).toHaveTextContent(
      /the round is still open/i,
    )
    expect(screen.getByTestId('panel-error-detail')).toHaveTextContent(/collab_round_open/)
  })

  it('DIFFERENT OBJECT: an unknown wire code is treated as unknown state, not as "still open"', async () => {
    seedRecord()
    stubWire({
      close: jsonResponse({ code: 'collab_store_unavailable', message: 'Store fell over.' }, 503),
      reveal: jsonResponse(HEALTHY_REVEAL),
    })

    renderOwnerPanel()
    fireEvent.click(screen.getByTestId('panel-resume-close'))

    await waitFor(() => expect(screen.getByTestId('panel-error')).toBeInTheDocument())
    expect(screen.getByTestId('panel-error-guidance')).not.toHaveTextContent(
      /the round is still open/i,
    )
    expect(screen.getByTestId('panel-error-detail')).toHaveTextContent(/collab_store_unavailable/)
  })

  it('POSITIVE CONTROL: the happy path still routes to the reveal, no error card', async () => {
    seedRecord()
    stubWire({
      close: jsonResponse({ round_id: ROUND_ID, status: 'closed' }),
      reveal: jsonResponse(HEALTHY_REVEAL),
    })

    renderOwnerPanel()
    fireEvent.click(screen.getByTestId('panel-resume-close'))

    await waitFor(() => expect(screen.getByTestId('collab-reveal')).toBeInTheDocument())
    expect(screen.queryByTestId('panel-error')).toBeNull()
  })
})
