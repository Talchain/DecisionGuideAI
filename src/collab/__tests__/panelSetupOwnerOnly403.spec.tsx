/**
 * COLLAB — a 403 is NOT a credential refusal (REVIEW-674 finding 1).
 *
 * ── THE LIE THIS PINS ──────────────────────────────────────────────────────
 * `describeOwnerFailure` routed `err.status === 403` to the credential branch
 * ("Your session has ended. Sign in again…") on its own comment's premise that
 * 401/403 = "the server declining the bearer". At CEE's bytes that premise is
 * false for 403: `replyForRefusal` (route-support.ts) maps exactly ONE code to
 * 403 — `collab_owner_only` — and the service mints it AFTER the bearer was
 * accepted (`closeRound` fires it when the round does not exist OR the caller
 * is not its owner, deliberately indistinguishable; a bad bearer 401s earlier
 * in `requireOwnerUser`). Failure scenario: a stale recovery record (round
 * purged server-side, e.g. a staging DB reset) → close → 403 → told to sign
 * in → signing in changes nothing → loop.
 *
 * ── WHAT IS PINNED, per branch of the fixed predicate ─────────────────────
 * • 403 `collab_owner_only` (close AND open) → honest ownership copy, no
 *   sign-in affordance, detail naming the server's code + words verbatim.
 * • 401 (wire) → STILL the credential copy with the sign-in affordance — the
 *   DIFFERENT-OBJECT twin proving the fix did not swallow the true branch.
 * • 403 with any OTHER code (CEE caller-key plugin answers `FORBIDDEN`) →
 *   the honest-unknown fallback, NOT ownership copy, NOT sign-in — the copy
 *   binds to the CODE, never the transport status.
 *
 * Assertions bind to the rendered surface by identity (`panel-sign-in`,
 * `panel-error-guidance`, `panel-error-detail`) — the exact affordance the
 * defect rendered futilely.
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
import { rememberOpenRound } from '../openRoundRecord'

const SCENARIO_ID = 'scn-ownersonly-1111'
const ROUND_ID = 'rnd-ownersonly-2222'
const OWNER_TOKEN = 'owner-access-token-ownersonly'

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

/** Stub mint + close + reveal by route; everything else 404s loudly. */
function stubWire(args: {
  mint?: StubResponse
  close?: StubResponse
  reveal?: StubResponse
}): void {
  fetchMock.mockImplementation(async (input, init) => {
    const url = String(input)
    if (url === '/bff/collab/rounds' && init?.method === 'POST' && args.mint !== undefined) {
      return args.mint
    }
    if (
      url === `/bff/collab/rounds/${ROUND_ID}/close` &&
      init?.method === 'POST' &&
      args.close !== undefined
    ) {
      return args.close
    }
    if (url === `/bff/collab/rounds/${ROUND_ID}/reveal` && args.reveal !== undefined) {
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

describe('a 403 is not a credential refusal (REVIEW-674 finding 1)', () => {
  it('close → 403 collab_owner_only does NOT say "sign in again" and renders NO sign-in affordance', async () => {
    seedRecord()
    // The witnessed failure scenario: a stale recovery record whose round was
    // purged server-side. The reveal is stubbed HEALTHY so the only way this
    // test passes is the copy itself being honest — not the flow accidentally
    // never rendering it.
    stubWire({
      close: jsonResponse({ code: 'collab_owner_only', message: 'No round you own with that id.' }, 403),
      reveal: jsonResponse(HEALTHY_REVEAL),
    })

    renderOwnerPanel()
    fireEvent.click(screen.getByTestId('panel-resume-close'))

    await waitFor(() => expect(screen.getByTestId('panel-error')).toBeInTheDocument())
    expect(screen.queryByTestId('collab-reveal')).toBeNull()
    // The futile affordance the defect rendered: a sign-in link for a refusal
    // the bearer had already PASSED.
    expect(screen.queryByTestId('panel-sign-in')).toBeNull()
    expect(screen.getByTestId('panel-error-guidance')).not.toHaveTextContent(
      /your session has ended/i,
    )
    // The honest copy: whose the round is, and that signing in cannot fix it.
    expect(screen.getByTestId('panel-error-guidance')).toHaveTextContent(
      /no round you own with that id/i,
    )
    expect(screen.getByTestId('panel-error-guidance')).toHaveTextContent(
      /signing in again will not change that/i,
    )
  })

  it('close → 403 collab_owner_only names the server code and words verbatim in the detail', async () => {
    seedRecord()
    stubWire({
      close: jsonResponse({ code: 'collab_owner_only', message: 'No round you own with that id.' }, 403),
      reveal: jsonResponse(HEALTHY_REVEAL),
    })

    renderOwnerPanel()
    fireEvent.click(screen.getByTestId('panel-resume-close'))

    await waitFor(() => expect(screen.getByTestId('panel-error')).toBeInTheDocument())
    // The credential branch renders NO detail at all, so at the defective tip
    // this element does not exist — the pin fails loud, not by text-diff.
    expect(screen.getByTestId('panel-error-detail')).toHaveTextContent(/collab_owner_only/)
    expect(screen.getByTestId('panel-error-detail')).toHaveTextContent(
      /No round you own with that id\./,
    )
  })

  it('DIFFERENT-OBJECT TWIN: a wire 401 STILL renders the credential copy with the sign-in affordance', async () => {
    seedRecord()
    // A genuine bearer decline (requireOwnerUser at CEE). This test passes
    // BEFORE and AFTER the fix — it exists to prove the 403 fix did not
    // swallow the true credential branch.
    stubWire({
      close: jsonResponse(
        { code: 'expired_token', message: 'Your session has expired. Sign in again and retry.' },
        401,
      ),
      reveal: jsonResponse(HEALTHY_REVEAL),
    })

    renderOwnerPanel()
    fireEvent.click(screen.getByTestId('panel-resume-close'))

    await waitFor(() => expect(screen.getByTestId('panel-error')).toBeInTheDocument())
    expect(screen.getByTestId('panel-sign-in')).toBeInTheDocument()
    expect(screen.getByTestId('panel-error-guidance')).toHaveTextContent(
      /your session has ended\. sign in again/i,
    )
  })

  it('open → 403 collab_owner_only (someone else’s scenario) is not a credential refusal either', async () => {
    stubWire({
      mint: jsonResponse(
        { code: 'collab_owner_only', message: 'Only the scenario owner can open a round on it.' },
        403,
      ),
    })

    renderOwnerPanel()
    fireEvent.change(screen.getByTestId('panel-target-id'), {
      target: { value: 'factor-churn-risk' },
    })
    fireEvent.click(screen.getByTestId('panel-mint'))

    await waitFor(() => expect(screen.getByTestId('panel-error')).toBeInTheDocument())
    expect(screen.queryByTestId('panel-sign-in')).toBeNull()
    expect(screen.getByTestId('panel-error-guidance')).not.toHaveTextContent(
      /your session has ended/i,
    )
    expect(screen.getByTestId('panel-error-guidance')).toHaveTextContent(
      /belongs to a different account/i,
    )
    expect(screen.getByTestId('panel-error-detail')).toHaveTextContent(/collab_owner_only/)
  })

  it('a 403 that is NOT collab_owner_only (caller-key FORBIDDEN) gets the honest unknown fallback, not ownership copy, not sign-in', async () => {
    seedRecord()
    // CEE's caller-key plugin answers 403 {code: "FORBIDDEN"} when the
    // proxy-injected key is wrong — a deploy misconfiguration, not a session
    // problem and not an ownership answer. The copy must bind to the CODE:
    // this 403 may claim neither "sign in again" nor "no round you own".
    stubWire({
      close: jsonResponse({ code: 'FORBIDDEN', message: 'Invalid API key.' }, 403),
      reveal: jsonResponse(HEALTHY_REVEAL),
    })

    renderOwnerPanel()
    fireEvent.click(screen.getByTestId('panel-resume-close'))

    await waitFor(() => expect(screen.getByTestId('panel-error')).toBeInTheDocument())
    expect(screen.queryByTestId('panel-sign-in')).toBeNull()
    expect(screen.getByTestId('panel-error-guidance')).not.toHaveTextContent(
      /no round you own with that id/i,
    )
    expect(screen.getByTestId('panel-error-guidance')).toHaveTextContent(/could not confirm/i)
    expect(screen.getByTestId('panel-error-detail')).toHaveTextContent(/FORBIDDEN/)
  })
})
