/**
 * COLLAB — request-body discipline on the `/bff/collab` seam.
 *
 * ── THE DEFECT THIS PINS (W-F1, witnessed fresh 12 Aug 2026) ───────────────
 * The deployed `closeRound` sent `Content-Type: application/json` with NO body.
 * Fastify refuses such a request BEFORE the route handler runs
 * (`FST_ERR_CTP_EMPTY_JSON_BODY`) and CEE flattens the refusal to 500 INTERNAL
 * — so the owner could not close a round from the UI at all, 100% of the time,
 * and the designed `collab_round_closed` → reveal fall-through was unreachable.
 * Discriminating pair at the live wire: no body → 500; body `'{}'` → 200.
 *
 * ── WHAT THIS SPEC ASSERTS, AND HOW IT BINDS ───────────────────────────────
 * The invariant is the CLASS, not the instance (a sibling call could grow the
 * same defect): **any request this module sends that declares
 * `Content-Type: application/json` must carry a body that parses as a JSON
 * object.** Every wire function in the module is exercised — the module is the
 * browser's ONLY path to the seam (pinned by panelSetupOwnerAuth's ratchets),
 * so this enumeration IS the class.
 *
 * It binds to the ACTUAL fetch payload — the captured `RequestInit` of the real
 * call — never to a mock's silence. A helper that could not fail would be
 * theatre, so the helper itself has a positive control: a synthetic bodyless
 * JSON request MUST be flagged.
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'

import {
  closeRound,
  declineTarget,
  fetchOpenPacket,
  fetchOwnerReveal,
  fetchParticipantReveal,
  mintRound,
  submitBelief,
} from '../collabService'
import { setParticipantToken, __resetParticipantTokenForTests } from '../participantToken'

const OWNER_TOKEN = 'owner-access-token-BODIES'
const ROUND_ID = 'rnd-bodies-1234'

type StubResponse = Pick<Response, 'ok' | 'status' | 'json'>

let fetchMock: Mock<[input: RequestInfo | URL, init?: RequestInit], Promise<StubResponse>>

function jsonResponse(body: unknown, status = 200): StubResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

/** The single captured init of the one call a test just made. */
function capturedInit(): RequestInit | undefined {
  expect(fetchMock.mock.calls).toHaveLength(1)
  return fetchMock.mock.calls[0][1]
}

/**
 * The class invariant, as a checker that RETURNS its finding rather than
 * asserting inline — so the positive-control test below can prove the checker
 * is capable of flagging a violation (an absence assertion that cannot see a
 * presence is vacuous).
 */
function jsonBodyViolation(init: RequestInit | undefined): string | null {
  const contentType = new Headers(init?.headers).get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) return null
  if (typeof init?.body !== 'string' || init.body === '') {
    return 'declares application/json but carries no body — Fastify refuses this pre-handler (FST_ERR_CTP_EMPTY_JSON_BODY)'
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(init.body)
  } catch {
    return 'declares application/json but the body is not valid JSON'
  }
  if (parsed === null || typeof parsed !== 'object') {
    return 'declares application/json but the body is not a JSON object'
  }
  return null
}

beforeEach(() => {
  fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    jsonResponse({}, 200),
  )
  vi.stubGlobal('fetch', fetchMock)
  setParticipantToken('participant-token-BODIES')
})

afterEach(() => {
  vi.unstubAllGlobals()
  __resetParticipantTokenForTests()
})

/* ══ Positive control: the checker can see a violation ═════════════════════ */

describe('the json-body checker itself', () => {
  it('POSITIVE CONTROL: flags a bodyless application/json request', () => {
    expect(
      jsonBodyViolation({ method: 'POST', headers: { 'Content-Type': 'application/json' } }),
    ).not.toBeNull()
  })

  it('POSITIVE CONTROL: flags an unparseable body', () => {
    expect(
      jsonBodyViolation({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      }),
    ).not.toBeNull()
  })
})

/* ══ W-F1: the owner close ═════════════════════════════════════════════════ */

describe('closeRound (W-F1)', () => {
  it('declares JSON and carries a body that parses as a JSON object', async () => {
    await closeRound(OWNER_TOKEN, ROUND_ID)
    expect(jsonBodyViolation(capturedInit())).toBeNull()
  })

  it('still sends the owner bearer and POSTs the round it was given', async () => {
    // The fix must not disturb what already worked: identity binding.
    await closeRound(OWNER_TOKEN, ROUND_ID)
    const [input, init] = fetchMock.mock.calls[0]
    expect(String(input)).toBe(`/bff/collab/rounds/${ROUND_ID}/close`)
    expect(init?.method).toBe('POST')
    expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${OWNER_TOKEN}`)
  })
})

/* ══ The class: every sibling on the seam ══════════════════════════════════ */

describe('json-body discipline across every wire function in the module', () => {
  it('mintRound', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ round_id: ROUND_ID, graph_version_ref: 'gv-1', participants: [] }, 201),
    )
    await mintRound(OWNER_TOKEN, {
      scenarioId: 'scn-1',
      contextNote: null,
      targets: [],
      participants: [{ display_name: 'Ada' }],
    })
    expect(jsonBodyViolation(capturedInit())).toBeNull()
  })

  it('submitBelief', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ authored_by: 'p-a', event_id: 'e-1' }, 201))
    await submitBelief(ROUND_ID, {
      targetId: 'factor-1',
      targetKind: 'factor',
      value: 0.4,
      expressionRaw: 'fairly likely',
      confidence: null,
      revision: false,
    })
    expect(jsonBodyViolation(capturedInit())).toBeNull()
  })

  it('declineTarget', async () => {
    await declineTarget(ROUND_ID, { targetId: 'factor-1', targetKind: 'factor' })
    expect(jsonBodyViolation(capturedInit())).toBeNull()
  })

  // The GETs must not declare a JSON content-type at all: a GET carrying the
  // header with no body is the same refusal class waiting to fire.
  it('fetchOpenPacket declares no JSON content-type', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        round_id: ROUND_ID,
        status: 'open',
        context_note: null,
        graph_version_ref: 'gv-1',
        targets: [],
        self: { participant_id: 'p-a', display_name: 'Ada', completed_target_ids: [] },
      }),
    )
    await fetchOpenPacket(ROUND_ID)
    expect(jsonBodyViolation(capturedInit())).toBeNull()
    expect(new Headers(capturedInit()?.headers).get('content-type')).toBeNull()
  })

  it('fetchParticipantReveal declares no JSON content-type', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ round_id: ROUND_ID, status: 'closed', graph_version_ref: 'gv-1', per_target: [] }),
    )
    await fetchParticipantReveal(ROUND_ID)
    expect(jsonBodyViolation(capturedInit())).toBeNull()
    expect(new Headers(capturedInit()?.headers).get('content-type')).toBeNull()
  })

  it('fetchOwnerReveal declares no JSON content-type', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ round_id: ROUND_ID, status: 'closed', graph_version_ref: 'gv-1', per_target: [] }),
    )
    await fetchOwnerReveal(OWNER_TOKEN, ROUND_ID)
    expect(jsonBodyViolation(capturedInit())).toBeNull()
    expect(new Headers(capturedInit()?.headers).get('content-type')).toBeNull()
  })
})
