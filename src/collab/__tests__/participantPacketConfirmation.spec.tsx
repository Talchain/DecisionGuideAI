/**
 * COLLAB — the PARTICIPANT's post-submit truth (W-F3), the derived link reader
 * (N1) and the honest credential-failure affordance (N3).
 *
 * ── WHAT THE WITNESS FOUND (two-person run, 12 Aug, leg 2) ────────────────
 * After a participant submitted their private estimate, the card silently
 * reset: the post-submit reload remounts every `TargetCard`, the card-local
 * "saved" flash died with it, and a real participant could not tell their
 * contribution had landed. The fix holds a confirmation at PAGE level, builds
 * it from the server's 201 RECEIPT, and binds it to the round it was accepted
 * for. This file pins each of those clauses separately.
 *
 * ── RED-FIRST LEDGER (named signatures at pristine `d4c9326d`) ────────────
 * RED at pristine: the five W-F3 tests (no `packet-confirmation-*` /
 * `packet-already-answered-*` testid exists there) and the N3 credential test
 * (`packet-retry` renders unconditionally there).
 * GREEN at pristine, deliberately: the N1 loop (both spellings were in the
 * hand copy — the guard's bite is proven by the drift MUTANT, not by history)
 * and the N3 different-object twin (it pins the direction the fix must NOT
 * change; without it, deleting the retry button everywhere would pass).
 *
 * ── BINDING ───────────────────────────────────────────────────────────────
 * Every assertion selects by IDENTITY (testid carrying the target id, exact
 * round context notes, exact wire codes) — never a value predicate another
 * object could satisfy. Wrong-object twins are asserted alongside each
 * positive (trap 19).
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'

/**
 * The elicitation hook is mocked (importOriginal spread — trap 12: a
 * hand-listed factory replaces the module and every other export vanishes).
 * The REAL hook debounces into a CEE call; this suite is about what happens
 * AFTER a value is accepted, so the mock always offers 0.25 and the test
 * drives the field's own "Use this" button — the page's real commit path.
 */
vi.mock('../../canvas/hooks/useBeliefElicitation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../canvas/hooks/useBeliefElicitation')>()
  return {
    ...actual,
    useBeliefElicitation: vi.fn(() => ({
      suggestion: {
        suggested_value: 0.25,
        reasoning: 'reads as unlikely',
        confidence: 'medium',
        needs_clarification: false,
      },
      loading: false,
      error: null,
      request: vi.fn(),
      reset: vi.fn(),
    })),
  }
})

import ParticipantPacketPage, { readAccessCode } from '../../pages/ParticipantPacketPage'
import type { OpenPacket } from '../collabService'
import {
  __resetParticipantTokenForTests,
  setParticipantToken,
  TOKEN_PARAM_NAMES,
} from '../participantToken'

const ROUND_A = 'rnd-participant-ux-aaaa-1111'
const ROUND_B = 'rnd-participant-ux-bbbb-2222'
const PACKET_URL_A = `/bff/collab/packet/${ROUND_A}`
const PACKET_URL_B = `/bff/collab/packet/${ROUND_B}`
const EVENTS_URL_A = `/bff/collab/packet/${ROUND_A}/events`

const TARGET_X = 'factor-churn-risk'
const TARGET_Y = 'factor-margin-hit'
const LABEL_X = 'Churn risk after a price rise'
const LABEL_Y = 'Margin hit if we discount'

/** Distinctive on purpose — an assertion naming these cannot be met by chance. */
const GOOD_CODE = 'CODE-THAT-WORKS-participant-ux'
const SELF_ID = 'p-grace-4444'
const SELF_NAME = 'Grace'
const WORDS = 'quite unlikely — most customers are locked in'
/** The producer's receipt timestamp (CEE sends `created_at` on every 201). */
const RECEIPT_CREATED_AT = '2026-08-12T18:02:21.000Z'

/** Context notes double as ROUND IDENTITY on screen — the page renders them
 *  verbatim, and no other fixture text could satisfy the assertion. */
const NOTE_A = 'Round A: we are deciding whether to raise the price.'
const NOTE_B = 'Round B: same question, fresh panel.'

type StubResponse = Pick<Response, 'ok' | 'status' | 'json'>

let fetchMock: Mock<[input: RequestInfo | URL, init?: RequestInit], Promise<StubResponse>>

function jsonResponse(body: unknown, status = 200): StubResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

function makePacket(args: {
  roundId: string
  note: string
  completed: string[]
  targets?: Array<{ id: string; label: string }>
}): OpenPacket {
  const targets = args.targets ?? [
    { id: TARGET_X, label: LABEL_X },
    { id: TARGET_Y, label: LABEL_Y },
  ]
  return {
    round_id: args.roundId,
    status: 'open',
    context_note: args.note,
    graph_version_ref: 'gv-1',
    targets: targets.map((t) => ({
      target: { kind: 'factor' as const, id: t.id },
      label: t.label,
      description: null,
      unit: null,
    })),
    self: {
      participant_id: SELF_ID,
      display_name: SELF_NAME,
      completed_target_ids: args.completed,
    },
  }
}

/**
 * A truthful little wire: GETs serve the packet with `completed_target_ids`
 * re-derived from what has been POSTed (exactly what CEE's fold does), and a
 * POST answers 201 with the producer's receipt shape
 * (`collab.v1.packet.ts`: event_id / round_id / target / kind / event_version
 * / authored_by / created_at).
 */
function stubWire(opts?: {
  receiptOverride?: Record<string, unknown>
  packetB?: boolean
}): { completed: string[] } {
  const completed: string[] = []
  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === EVENTS_URL_A && init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as {
        kind: string
        target: { id: string }
      }
      completed.push(body.target.id)
      const receipt = opts?.receiptOverride ?? {
        event_id: 'evt-0001',
        round_id: ROUND_A,
        target: body.target,
        kind: body.kind,
        event_version: 1,
        authored_by: SELF_ID,
        created_at: RECEIPT_CREATED_AT,
      }
      return jsonResponse(receipt, 201)
    }
    if (url === PACKET_URL_A) {
      return jsonResponse(makePacket({ roundId: ROUND_A, note: NOTE_A, completed: [...completed] }))
    }
    if (opts?.packetB === true && url === PACKET_URL_B) {
      return jsonResponse(makePacket({ roundId: ROUND_B, note: NOTE_B, completed: [] }))
    }
    return jsonResponse({ code: 'not_stubbed', message: url }, 404)
  })
  return { completed }
}

function renderAtRoundA(): void {
  render(
    <MemoryRouter initialEntries={[`/panel/${ROUND_A}`]}>
      <Routes>
        <Route path="/panel/:round_id" element={<ParticipantPacketPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

/**
 * Keeps the page MOUNTED across a round change — the SPA hazard under test.
 * React Router re-renders the same element on a param change; component state
 * (including held confirmations) survives, which is exactly why the round_id
 * binding must be checked rather than assumed.
 */
function NavHarness(): JSX.Element {
  const navigate = useNavigate()
  return (
    <>
      <ParticipantPacketPage />
      <button data-testid="test-nav-round-b" onClick={() => void navigate(`/panel/${ROUND_B}`)} />
      <button data-testid="test-nav-round-a" onClick={() => void navigate(`/panel/${ROUND_A}`)} />
    </>
  )
}

function renderWithNav(): void {
  render(
    <MemoryRouter initialEntries={[`/panel/${ROUND_A}`]}>
      <Routes>
        <Route path="/panel/:round_id" element={<NavHarness />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Type the participant's own words, then accept the elicited value (0.25). */
async function submitOn(targetId: string, label: string, words: string): Promise<void> {
  const card = screen.getByTestId(`packet-target-${targetId}`)
  fireEvent.change(within(card).getByLabelText(`Describe ${label} in words`), {
    target: { value: words },
  })
  fireEvent.click(within(card).getByRole('button', { name: `Use about 25% for ${label}` }))
  await waitFor(() =>
    expect(screen.getByTestId(`packet-confirmation-${targetId}`)).toBeInTheDocument(),
  )
}

beforeEach(() => {
  __resetParticipantTokenForTests()
  fetchMock = vi.fn(async (input: RequestInfo | URL) =>
    jsonResponse({ code: 'not_stubbed', message: String(input) }, 404),
  )
  vi.stubGlobal('fetch', fetchMock)
  setParticipantToken(GOOD_CODE)
})

afterEach(() => {
  vi.unstubAllGlobals()
  __resetParticipantTokenForTests()
})

/* ══ W-F3 — a submission leaves a LASTING, truthful confirmation ═══════════ */

describe('W-F3: the participant can tell their contribution landed', () => {
  it('after a submit, a lasting confirmation names what was recorded — and it survives the post-submit reload', async () => {
    stubWire()
    renderAtRoundA()
    await waitFor(() => expect(screen.getByTestId('participant-packet-page')).toBeInTheDocument())

    await submitOn(TARGET_X, LABEL_X, WORDS)

    // THE DEFECT: the confirmation used to die in the post-submit remount.
    // Prove the reload actually happened (the packet was re-fetched and now
    // carries the completion) and that the confirmation is STILL on screen.
    const packetGets = fetchMock.mock.calls.filter((c) => String(c[0]) === PACKET_URL_A)
    expect(packetGets.length).toBeGreaterThanOrEqual(2)

    const confirmation = screen.getByTestId(`packet-confirmation-${TARGET_X}`)
    expect(confirmation).toHaveTextContent('Your answer is in.')
    // WHAT: the value and the participant's own words, verbatim.
    expect(screen.getByTestId(`packet-confirmation-value-${TARGET_X}`)).toHaveTextContent('0.25')
    expect(screen.getByTestId(`packet-confirmation-value-${TARGET_X}`)).toHaveTextContent(WORDS)
    // PRIVACY: the clause the witness said was missing.
    expect(confirmation).toHaveTextContent(/private until the round closes/i)
    // WHEN and WHOSE: from the receipt (created_at + authored_by === self).
    const recorded = screen.getByTestId(`packet-confirmation-recorded-${TARGET_X}`)
    expect(recorded).toHaveTextContent(/Recorded at \d/)
    expect(recorded).toHaveTextContent(`as ${SELF_NAME}`)

    // WRONG-OBJECT TWIN (trap 19): the sibling card gets NO confirmation.
    expect(screen.queryByTestId(`packet-confirmation-${TARGET_Y}`)).toBeNull()

    // And the wire got the words verbatim on a first-submission kind.
    const post = fetchMock.mock.calls.find(
      (c) => String(c[0]) === EVENTS_URL_A && c[1]?.method === 'POST',
    )
    expect(post).toBeDefined()
    const body = JSON.parse(String(post![1]!.body)) as {
      kind: string
      belief: { expression_raw: string | null }
    }
    expect(body.kind).toBe('belief_submitted')
    expect(body.belief.expression_raw).toBe(WORDS)
  })

  it('makes no "when"/"whose" claim the receipt did not carry — nothing is fabricated', async () => {
    // The producer sends created_at/authored_by today; this pins the page's
    // honesty if a receipt ever arrives without them (and it is the RED line
    // for the fabricated-timestamp mutant: a client clock would render a
    // Recorded claim here).
    stubWire({
      receiptOverride: {
        event_id: 'evt-0002',
        round_id: ROUND_A,
        target: { kind: 'factor', id: TARGET_X },
        kind: 'belief_submitted',
        event_version: 1,
      },
    })
    renderAtRoundA()
    await waitFor(() => expect(screen.getByTestId('participant-packet-page')).toBeInTheDocument())

    await submitOn(TARGET_X, LABEL_X, WORDS)

    expect(screen.getByTestId(`packet-confirmation-${TARGET_X}`)).toHaveTextContent(
      'Your answer is in.',
    )
    expect(screen.queryByTestId(`packet-confirmation-recorded-${TARGET_X}`)).toBeNull()
  })

  it('does not claim a foreign authored_by as this participant', async () => {
    // A receipt attributed to someone else must not be rendered "as Grace".
    // (The server stamps authored_by from the token, so this should be
    // unreachable — but the claim is the page's, and the page must not make
    // it on evidence it does not hold.)
    stubWire({
      receiptOverride: {
        event_id: 'evt-0003',
        round_id: ROUND_A,
        target: { kind: 'factor', id: TARGET_X },
        kind: 'belief_submitted',
        event_version: 1,
        authored_by: 'p-somebody-else',
        created_at: RECEIPT_CREATED_AT,
      },
    })
    renderAtRoundA()
    await waitFor(() => expect(screen.getByTestId('participant-packet-page')).toBeInTheDocument())

    await submitOn(TARGET_X, LABEL_X, WORDS)

    const recorded = screen.getByTestId(`packet-confirmation-recorded-${TARGET_X}`)
    expect(recorded).toHaveTextContent(/Recorded at \d/)
    expect(recorded).not.toHaveTextContent(`as ${SELF_NAME}`)
  })

  it("a fresh round re-asking the same factor gets a fresh form, never last round's confirmation — and going back restores it", async () => {
    stubWire({ packetB: true })
    renderWithNav()
    await waitFor(() => expect(screen.getByTestId('packet-context-note')).toHaveTextContent(NOTE_A))

    await submitOn(TARGET_X, LABEL_X, WORDS)

    // NEW ROUND, same target id, page kept mounted (the SPA hazard).
    fireEvent.click(screen.getByTestId('test-nav-round-b'))
    await waitFor(() => expect(screen.getByTestId('packet-context-note')).toHaveTextContent(NOTE_B))

    // BOUND BY round_id: round B must not inherit round A's confirmation,
    // and the server says B is unanswered, so no fallback either.
    expect(screen.queryByTestId(`packet-confirmation-${TARGET_X}`)).toBeNull()
    expect(screen.queryByTestId(`packet-already-answered-${TARGET_X}`)).toBeNull()

    // OPPOSITE LIMB: back on round A the confirmation is still the truth.
    fireEvent.click(screen.getByTestId('test-nav-round-a'))
    await waitFor(() => expect(screen.getByTestId('packet-context-note')).toHaveTextContent(NOTE_A))
    expect(screen.getByTestId(`packet-confirmation-${TARGET_X}`)).toHaveTextContent(
      'Your answer is in.',
    )
  })

  it('a participant who re-opens their link mid-round is told the server holds their response', async () => {
    // No confirmation is held (fresh mount) — the packet's own
    // completed_target_ids is the surviving evidence, and it covers declines
    // too, so the copy says "responded", not "answered".
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input) === PACKET_URL_A) {
        return jsonResponse(makePacket({ roundId: ROUND_A, note: NOTE_A, completed: [TARGET_X] }))
      }
      return jsonResponse({ code: 'not_stubbed', message: String(input) }, 404)
    })
    renderAtRoundA()
    await waitFor(() => expect(screen.getByTestId('participant-packet-page')).toBeInTheDocument())

    const fallback = screen.getByTestId(`packet-already-answered-${TARGET_X}`)
    expect(fallback).toHaveTextContent(/already responded/i)
    expect(fallback).toHaveTextContent(/private until the round closes/i)
    // It does NOT invent what/when — that evidence died with the token.
    expect(screen.queryByTestId(`packet-confirmation-${TARGET_X}`)).toBeNull()
    // WRONG-OBJECT TWIN: the unanswered sibling carries no such notice.
    expect(screen.queryByTestId(`packet-already-answered-${TARGET_Y}`)).toBeNull()
  })

  it('declining leaves an honest record of the choice — not "Answer recorded"', async () => {
    stubWire()
    renderAtRoundA()
    await waitFor(() => expect(screen.getByTestId('participant-packet-page')).toBeInTheDocument())

    const card = screen.getByTestId(`packet-target-${TARGET_X}`)
    fireEvent.click(within(card).getByRole('button', { name: 'I would rather not answer this' }))
    await waitFor(() =>
      expect(screen.getByTestId(`packet-confirmation-${TARGET_X}`)).toBeInTheDocument(),
    )

    const confirmation = screen.getByTestId(`packet-confirmation-${TARGET_X}`)
    expect(confirmation).toHaveTextContent(/choice not to answer/i)
    expect(confirmation).not.toHaveTextContent('Your answer is in.')
    // The wire saw a decline, by exact kind.
    const post = fetchMock.mock.calls.find(
      (c) => String(c[0]) === EVENTS_URL_A && c[1]?.method === 'POST',
    )
    const body = JSON.parse(String(post![1]!.body)) as { kind: string }
    expect(body.kind).toBe('declined')
  })
})

/* ══ N1 — the link reader is DERIVED from the single authority ═════════════ */

describe('N1: every token spelling the boot path accepts, the link reader accepts', () => {
  it('accepts a pasted link for EVERY name in TOKEN_PARAM_NAMES, in both link shapes', () => {
    // Non-vacuity control (trap 13): a loop over an empty authority would
    // pass while testing nothing.
    expect(TOKEN_PARAM_NAMES.length).toBeGreaterThanOrEqual(2)

    for (const name of TOKEN_PARAM_NAMES) {
      // Real query string (the shape participantLink writes).
      expect(readAccessCode(`https://app.example.com/?${name}=${GOOD_CODE}#/panel/rnd-1`)).toEqual({
        code: GOOD_CODE,
      })
      // Hash query (what a HashRouter user actually sees and re-pastes).
      expect(readAccessCode(`https://app.example.com/#/panel/rnd-1?${name}=${GOOD_CODE}`)).toEqual({
        code: GOOD_CODE,
      })
    }
    // ⚠ This proves AGREEMENT with the authority, never that the authority is
    // complete (trap 12d) — completeness lives with TOKEN_PARAM_NAMES itself.
    // CONTRAST CONTROL: a name outside the authority is still refused, so the
    // derived pattern discriminates rather than matching anything.
    const foreign = readAccessCode(`https://app.example.com/?token=${GOOD_CODE}#/panel/rnd-1`)
    expect('problem' in foreign).toBe(true)
  })

  it('the collab_token spelling works end-to-end through the entry form', async () => {
    // The sibling suite drives `ct`; this drives the OTHER spelling through
    // the same DOM path, so a regression that keeps the loop above green by
    // exporting a narrowed list still fails a user-shaped test.
    __resetParticipantTokenForTests()
    stubWire()
    renderAtRoundA()

    fireEvent.change(screen.getByTestId('packet-manual-token'), {
      target: { value: `https://app.example.com/?collab_token=${GOOD_CODE}#/panel/${ROUND_A}` },
    })
    fireEvent.click(screen.getByTestId('packet-manual-continue'))

    await waitFor(() => expect(screen.getByTestId('participant-packet-page')).toBeInTheDocument())
    const packetCall = fetchMock.mock.calls.find((c) => String(c[0]) === PACKET_URL_A)
    const header = new Headers((packetCall![1] ?? {}).headers).get('x-collab-participant-token')
    expect(header).toBe(GOOD_CODE)
  })
})

/* ══ N3 — no futile retry on a credential refusal ══════════════════════════ */

describe('N3: the failure card offers only affordances that can work', () => {
  it('a credential refusal has NO "Try again" — re-entry and a fresh link are the honest moves', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input) === PACKET_URL_A) {
        return jsonResponse(
          { code: 'collab_token_invalid', message: 'That token could not be verified.' },
          401,
        )
      }
      return jsonResponse({ code: 'not_stubbed', message: String(input) }, 404)
    })
    renderAtRoundA()
    await waitFor(() => expect(screen.getByTestId('packet-error')).toBeInTheDocument())

    // Retrying re-sends the very token the server just refused; the button
    // was a promise the page could not keep.
    expect(screen.queryByTestId('packet-retry')).toBeNull()
    expect(screen.getByTestId('packet-reenter-code')).toBeInTheDocument()
    // What the user should actually do, including the #672 recovery path:
    // ask the owner for a fresh link.
    const guidance = screen.getByTestId('packet-error-guidance')
    expect(guidance).toHaveTextContent(/whoever invited you/i)
    expect(guidance).toHaveTextContent(/fresh link/i)
  })

  it('DIFFERENT OBJECT: an ordinary failure keeps "Try again" — and it genuinely retries', async () => {
    // The opposite-direction twin: without it, deleting the retry button on
    // EVERY branch would satisfy the test above while removing a working
    // affordance from recoverable failures.
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input) === PACKET_URL_A) {
        return jsonResponse({ code: 'collab_upstream_unavailable', message: 'Upstream error.' }, 503)
      }
      return jsonResponse({ code: 'not_stubbed', message: String(input) }, 404)
    })
    renderAtRoundA()
    await waitFor(() => expect(screen.getByTestId('packet-error')).toBeInTheDocument())

    expect(screen.getByTestId('packet-retry')).toBeInTheDocument()
    expect(screen.getByTestId('packet-reenter-code')).toBeInTheDocument()

    // The retry is real: once the wire recovers, clicking it loads the panel.
    stubWire()
    fireEvent.click(screen.getByTestId('packet-retry'))
    await waitFor(() => expect(screen.getByTestId('participant-packet-page')).toBeInTheDocument())
  })
})
