/**
 * COLLAB — THE DISAGREEMENT MOUNT, and the evidence that feeds it.
 *
 * ── WHAT WAS DARK, AND WHY A GREEN SUITE DID NOT NOTICE ───────────────────
 * `DisagreementBody`, `fetchParticipantDisagreement`, `fetchOwnerDisagreement`
 * and `attachEvidence` shipped complete, and shipped with ZERO product call
 * sites — each symbol had exactly one occurrence in `src/`, its own definition.
 * CEE was deployed and its table migrated, so every component witness was green
 * while no user could reach any of it. A component suite proves a component
 * renders; only a MOUNT test proves a user can get to it.
 *
 * ── THE SEQUENCE THIS FILE PINS, WHICH IS NOT THE OBVIOUS ONE ─────────────
 * Evidence is attached while the round is OPEN and read after it CLOSES. That
 * is forced by CEE and the two windows are disjoint: `elicitation-append.ts:368`
 * refuses every append once the round is not open, and `packet-read-model.ts:182`
 * refuses the reveal and the disagreement view while it is. So a participant
 * cannot "attach evidence to a position they disagree with" — no position is
 * visible until the moment nothing can be attached. They attach it beside their
 * own answer, blind, which is also the anchoring-free order.
 *
 * ── BINDING ───────────────────────────────────────────────────────────────
 * Every copy assertion uses a SENTINEL that no locally-composed sentence could
 * produce (trap 19 — an assertion that some plausible text appeared would pass
 * on exactly the defect being fixed). Every positive has its wrong-object or
 * absent twin.
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

vi.mock('../../canvas/hooks/useBeliefElicitation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../canvas/hooks/useBeliefElicitation')>()
  return {
    ...actual,
    useBeliefElicitation: vi.fn(() => ({
      suggestion: null,
      loading: false,
      error: null,
      request: vi.fn(),
      reset: vi.fn(),
    })),
  }
})

import ParticipantPacketPage, { RevealBody } from '../../pages/ParticipantPacketPage'
import type { DisagreementView, OpenPacket, RevealView } from '../collabService'
import {
  __resetParticipantTokenForTests,
  setParticipantToken,
} from '../participantToken'

const ROUND = 'rnd-disagreement-mount-1111'
const PACKET_URL = `/bff/collab/packet/${ROUND}`
const REVEAL_URL = `${PACKET_URL}/reveal`
const DISAGREEMENT_URL = `${PACKET_URL}/disagreement`
const EVENTS_URL = `${PACKET_URL}/events`

const TARGET = 'factor-churn-risk'
const LABEL = 'Churn risk after a price rise'
const GRACE = 'p-grace-4444'
const ADA = 'p-ada-5555'

/** Sentinels. Nothing this bundle could compose would satisfy these. */
const HEADLINE = 'SERVED-HEADLINE-SENTINEL'
const QUESTION = 'SERVED-QUESTION-SENTINEL'
const STANDING = 'SERVED-STANDING-NOTE-SENTINEL'
const GRACE_BASIS = 'GRACE-STATED-BASIS-SENTINEL'
const ADA_BASIS = 'ADA-STATED-BASIS-SENTINEL'
const EVIDENCE_BODY = 'SERVED-EVIDENCE-BODY-SENTINEL'

type StubResponse = Pick<Response, 'ok' | 'status' | 'json'>
let fetchMock: Mock<[input: RequestInfo | URL, init?: RequestInit], Promise<StubResponse>>

function jsonResponse(body: unknown, status = 200): StubResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

function openPacket(): OpenPacket {
  return {
    round_id: ROUND,
    status: 'open',
    context_note: null,
    graph_version_ref: 'gv-1',
    targets: [
      { target: { kind: 'factor', id: TARGET }, label: LABEL, description: null, unit: null },
    ],
    self: { participant_id: GRACE, display_name: 'Grace', completed_target_ids: [] },
  }
}

function revealView(): RevealView {
  return {
    round_id: ROUND,
    status: 'closed',
    graph_version_ref: 'gv-1',
    per_target: [
      {
        target: { kind: 'factor', id: TARGET },
        label: LABEL,
        model_value_at_version: 0.5,
        responses: [
          {
            participant_id: GRACE,
            display_label: 'Grace',
            value: 0.85,
            expression_raw: GRACE_BASIS,
            confidence: null,
            kind: 'belief_submitted',
          },
          {
            participant_id: ADA,
            display_label: 'Ada',
            value: 0.2,
            expression_raw: ADA_BASIS,
            confidence: null,
            kind: 'belief_submitted',
          },
        ],
      },
    ],
  }
}

function disagreementView(overrides: Partial<DisagreementView> = {}): DisagreementView {
  return {
    round_id: ROUND,
    graph_version_ref: 'gv-1',
    standing_note: STANDING,
    per_target: [
      {
        target: { kind: 'factor', id: TARGET },
        label: LABEL,
        model_value_at_version: 0.5,
        shape: 'split',
        answering_participants: 2,
        distinct_values: 2,
        spread: { low: 0.2, high: 0.85, width: 0.65 },
        positions: [
          {
            participant_id: GRACE,
            display_label: 'Grace',
            value: 0.85,
            stated_basis: GRACE_BASIS,
            confidence: null,
            kind: 'belief_submitted',
            pole: 'high',
          },
          {
            participant_id: ADA,
            display_label: 'Ada',
            value: 0.2,
            stated_basis: ADA_BASIS,
            confidence: null,
            kind: 'belief_submitted',
            pole: 'low',
          },
        ],
        positions_with_stated_basis: 2,
        evidence: [
          {
            event_id: 'evt-1',
            authored_by: ADA,
            author_label: 'Ada',
            stance: 'challenges',
            stance_phrase: 'challenges',
            kind: 'note',
            body: EVIDENCE_BODY,
            url: null,
            about_participant_id: null,
            about_label: null,
            created_at: '2026-08-14T11:00:00.000Z',
          },
        ],
        headline: HEADLINE,
        question: QUESTION,
      },
    ],
    ...overrides,
  }
}

/** A closed round: the packet refuses, the page falls through to the reveal. */
function stubClosedRound(opts: { disagreementStatus?: number } = {}): void {
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url === PACKET_URL) {
      return jsonResponse(
        { code: 'collab_round_closed', message: 'That round is closed.' },
        409,
      )
    }
    if (url === REVEAL_URL) return jsonResponse(revealView())
    if (url === DISAGREEMENT_URL) {
      const status = opts.disagreementStatus ?? 200
      return status === 200
        ? jsonResponse(disagreementView())
        : jsonResponse({ code: 'collab_request_failed', message: 'nope' }, status)
    }
    return jsonResponse({ code: 'not_stubbed', message: url }, 404)
  })
}

function renderParticipant(): void {
  render(
    <MemoryRouter initialEntries={[`/panel/${ROUND}`]}>
      <Routes>
        <Route path="/panel/:round_id" element={<ParticipantPacketPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  __resetParticipantTokenForTests()
  fetchMock = vi.fn(async (input: RequestInfo | URL) =>
    jsonResponse({ code: 'not_stubbed', message: String(input) }, 404),
  )
  vi.stubGlobal('fetch', fetchMock)
  setParticipantToken('CODE-THAT-WORKS-disagreement-mount')
})

afterEach(() => {
  vi.unstubAllGlobals()
  __resetParticipantTokenForTests()
  vi.restoreAllMocks()
})

/* ══════════════════════════════════════════════════════════════════════════
 * 1. THE PARTICIPANT REACHES IT.
 * ══════════════════════════════════════════════════════════════════════════ */

describe('a participant reaches the disagreement view after the round closes', () => {
  it('mounts it, with CEE’s reasoning copy rendered verbatim', async () => {
    stubClosedRound()
    renderParticipant()

    await waitFor(() => expect(screen.getByTestId('collab-disagreement')).toBeInTheDocument())

    // The served sentences, by sentinel. A component that composed its own
    // would render something plausible and fail here — the point of sentinels.
    expect(screen.getByTestId(`disagreement-headline-${TARGET}`)).toHaveTextContent(HEADLINE)
    expect(screen.getByTestId(`disagreement-question-${TARGET}`)).toHaveTextContent(QUESTION)
    expect(screen.getByTestId('disagreement-standing-note')).toHaveTextContent(STANDING)
  })

  it('shows EACH position’s stated basis verbatim, bound to its own author', async () => {
    stubClosedRound()
    renderParticipant()
    await waitFor(() => expect(screen.getByTestId('collab-disagreement')).toBeInTheDocument())

    // ⭐ BOUND BY IDENTITY. Two people, two DIFFERENT sentinels, each asserted
    // inside its own participant's node — so neither assertion can be satisfied
    // by the other person's basis (trap 19).
    expect(screen.getByTestId(`disagreement-basis-${GRACE}`)).toHaveTextContent(GRACE_BASIS)
    expect(screen.getByTestId(`disagreement-basis-${ADA}`)).toHaveTextContent(ADA_BASIS)
    expect(screen.getByTestId(`disagreement-basis-${GRACE}`)).not.toHaveTextContent(ADA_BASIS)
  })

  it('shows the evidence somebody attached, beside the positions', async () => {
    stubClosedRound()
    renderParticipant()
    await waitFor(() => expect(screen.getByTestId('collab-disagreement')).toBeInTheDocument())

    expect(screen.getByTestId('disagreement-evidence-body-evt-1')).toHaveTextContent(EVIDENCE_BODY)
    expect(screen.getByTestId('disagreement-evidence-evt-1')).toHaveAttribute(
      'data-stance',
      'challenges',
    )
  })

  it('requests the disagreement view for THIS round', async () => {
    stubClosedRound()
    renderParticipant()
    await waitFor(() => expect(screen.getByTestId('collab-disagreement')).toBeInTheDocument())

    const called = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(called).toContain(DISAGREEMENT_URL)
  })

  /**
   * ⭐ THE DISCRIMINATING TWIN. Without it, a mount that rendered the section
   * unconditionally — or one bound to the reveal rather than to the
   * disagreement payload — would pass every test above. It also pins the
   * deliberate trade: the reveal is what the participant came back for, and a
   * secondary view's failure must not cost it.
   */
  it('still renders the reveal when the disagreement request FAILS, and mounts no disagreement', async () => {
    stubClosedRound({ disagreementStatus: 500 })
    renderParticipant()

    await waitFor(() => expect(screen.getByTestId('collab-reveal')).toBeInTheDocument())
    expect(screen.getByTestId(`reveal-words-${GRACE}`)).toHaveTextContent(GRACE_BASIS)
    expect(screen.queryByTestId('collab-disagreement')).toBeNull()
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 * 2. THE OWNER REACHES THE SAME SURFACE — ONE MOUNT, TWO JOURNEYS.
 * ══════════════════════════════════════════════════════════════════════════ */

describe('the owner reaches the same disagreement surface', () => {
  it('RevealBody renders it for the owner shape (with an apply state present)', () => {
    render(
      <RevealBody
        reveal={revealView()}
        disagreement={disagreementView()}
        apply={{
          onApply: vi.fn(),
          applyingKey: null,
          appliedKey: null,
          applyError: null,
        }}
      />,
    )
    expect(screen.getByTestId('collab-disagreement')).toBeInTheDocument()
    expect(screen.getByTestId(`disagreement-headline-${TARGET}`)).toHaveTextContent(HEADLINE)
  })

  it('renders no disagreement section when none was passed (the absent twin)', () => {
    render(<RevealBody reveal={revealView()} />)
    expect(screen.getByTestId('collab-reveal')).toBeInTheDocument()
    expect(screen.queryByTestId('collab-disagreement')).toBeNull()
  })

  /**
   * ⚠ THE OWNER PAGE'S WIRING IS NOT REACHED BY THE RENDER TESTS ABOVE, and an
   * optional prop means deleting the call site keeps TYPECHECK GREEN. This is
   * the mount-path assertion that fails loud instead (trap 3b): the owner page
   * must fetch the owner view and hand it to the shared body. Comments are
   * stripped so a mention in prose cannot satisfy it.
   */
  it('PanelSetupPage fetches the OWNER view and passes it to RevealBody', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/pages/PanelSetupPage.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    expect(src).toContain('fetchOwnerDisagreement(')
    expect(src).toMatch(/<RevealBody[^>]*disagreement=\{disagreement\}/)
    // The wrong-credential twin: the owner page must NOT reach for the
    // participant fetcher, which would 401 with a Supabase token.
    expect(src).not.toContain('fetchParticipantDisagreement')
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 * 3. THE EVIDENCE THAT FEEDS IT — attached during the OPEN round.
 * ══════════════════════════════════════════════════════════════════════════ */

describe('a participant attaches evidence while the round is open', () => {
  function stubOpenRound(): { posted: Array<Record<string, unknown>> } {
    const posted: Array<Record<string, unknown>> = []
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === EVENTS_URL && init?.method === 'POST') {
        posted.push(JSON.parse(String(init.body)) as Record<string, unknown>)
        return jsonResponse({ authored_by: GRACE, event_id: 'evt-new' }, 201)
      }
      if (url === PACKET_URL) return jsonResponse(openPacket())
      return jsonResponse({ code: 'not_stubbed', message: url }, 404)
    })
    return { posted }
  }

  async function attach(body: string, opts: { url?: string; stance?: string } = {}): Promise<void> {
    const card = screen.getByTestId(`packet-target-${TARGET}`)
    fireEvent.click(within(card).getByTestId(`packet-evidence-open-${TARGET}`))
    fireEvent.change(within(card).getByTestId(`packet-evidence-body-${TARGET}`), {
      target: { value: body },
    })
    if (opts.url !== undefined) {
      fireEvent.change(within(card).getByTestId(`packet-evidence-url-${TARGET}`), {
        target: { value: opts.url },
      })
    }
    if (opts.stance !== undefined) {
      fireEvent.change(within(card).getByTestId(`packet-evidence-stance-${TARGET}`), {
        target: { value: opts.stance },
      })
    }
    fireEvent.click(within(card).getByTestId(`packet-evidence-submit-${TARGET}`))
  }

  it('sends the participant’s own words, the stance, and NO client-set attribution', async () => {
    const { posted } = stubOpenRound()
    renderParticipant()
    await waitFor(() => expect(screen.getByTestId(`packet-target-${TARGET}`)).toBeInTheDocument())

    await attach(EVIDENCE_BODY, { stance: 'challenges' })
    await waitFor(() => expect(posted).toHaveLength(1))

    const sent = posted[0]
    expect(sent.kind).toBe('evidence_attached')
    expect(sent.target).toEqual({ kind: 'factor', id: TARGET })
    expect(sent.belief).toBeNull()
    expect(sent.evidence).toEqual({
      kind: 'note',
      body: EVIDENCE_BODY,
      url: null,
      stance: 'challenges',
      // Blind round: the roster is withheld, so there is nobody to aim at.
      about_participant_id: null,
    })
    // ⚠ The server stamps authorship from the token. A payload offering one is
    // REFUSED by CEE, not ignored — so this bundle must never send it.
    expect(Object.keys(sent)).not.toContain('provenance')
    expect(JSON.stringify(sent)).not.toContain('authored_by')
  })

  it('derives kind=link from the URL field rather than offering a second control', async () => {
    const { posted } = stubOpenRound()
    renderParticipant()
    await waitFor(() => expect(screen.getByTestId(`packet-target-${TARGET}`)).toBeInTheDocument())

    await attach(EVIDENCE_BODY, { url: 'https://example.com/renewals' })
    await waitFor(() => expect(posted).toHaveLength(1))

    const evidence = posted[0].evidence as Record<string, unknown>
    expect(evidence.kind).toBe('link')
    expect(evidence.url).toBe('https://example.com/renewals')
  })

  it('confirms what was attached, in the person’s own words', async () => {
    stubOpenRound()
    renderParticipant()
    await waitFor(() => expect(screen.getByTestId(`packet-target-${TARGET}`)).toBeInTheDocument())

    await attach(EVIDENCE_BODY)
    await waitFor(() =>
      expect(screen.getByTestId(`packet-evidence-attached-${TARGET}`)).toHaveTextContent(
        EVIDENCE_BODY,
      ),
    )
  })

  it('sends nothing at all when there are no words (the empty twin)', async () => {
    const { posted } = stubOpenRound()
    renderParticipant()
    await waitFor(() => expect(screen.getByTestId(`packet-target-${TARGET}`)).toBeInTheDocument())

    const card = screen.getByTestId(`packet-target-${TARGET}`)
    fireEvent.click(within(card).getByTestId(`packet-evidence-open-${TARGET}`))
    fireEvent.click(within(card).getByTestId(`packet-evidence-submit-${TARGET}`))
    expect(posted).toHaveLength(0)
  })

  /**
   * The window rule, made visible in the product rather than only in CEE: once
   * the round is closed there is no attach affordance to press, so nobody meets
   * `collab_round_closed` by using the UI as designed.
   */
  it('offers NO attach affordance once the round has closed', async () => {
    stubClosedRound()
    renderParticipant()
    await waitFor(() => expect(screen.getByTestId('collab-disagreement')).toBeInTheDocument())
    expect(screen.queryByTestId(`packet-evidence-open-${TARGET}`)).toBeNull()
  })
})
