/**
 * THE PROPERTY, not the mechanism: a streamed cold draft that was ANSWERED
 * must be counted by the conversation ledger as a TURN.
 *
 * ── Why this spec exists ─────────────────────────────────────────────────
 * Until DRAFT-CAPTURE-0919, `recordStreamedTerminalIngest` filed its record
 * under the BUFFERED endpoint, and the only guard on that choice was a
 * Canvas-side assertion that the endpoint string did not end in
 * `/turn/stream` (`useConversation.streamedTerminalIngestTrace.spec.tsx`).
 * That assertion pinned the MECHANISM of the disclosure, not the property it
 * served — trap 19: it would have passed on any endpoint that is not the
 * stream sibling, including one the ledger drops entirely.
 *
 * DRAFT-CAPTURE replaced the endpoint-borne disclosure with a structured one
 * (`capture: { kind: 'streamed_terminal_ingest' }`) and taught
 * `readTransportKind` to read it FIRST. The record now files at its real
 * stream endpoint, which is the accurate transport fact, and the ledger still
 * counts it. Both halves are true only together — so this spec asserts the
 * JOINT outcome by running the REAL recorder into the REAL store and through
 * the REAL selector. Nothing here is a fixture of our own model of the store.
 *
 * ── What would have to be true for this to pass while the property fails ──
 * The selector would have to count a record it did not classify as a turn.
 * `transport_leg_count` is asserted at zero alongside, and the turn is bound
 * BY IDENTITY to the recorded trace id — so a second, unrelated record
 * cannot satisfy it.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { usePayloadTraceStore } from '../payload-trace-store'
import { selectRecentConversationTurns } from '../recentConversationTurns'
import type { ConversationTurnSourcePayload } from '../recentConversationTurns'
import { recordStreamedTerminalIngest } from '../../v5/streamedTurnTransport'
import type { OrchestratorTurnPayload } from '../../v5/types'

// Shape taken from the PRODUCER (`v5/buildPayload.ts` — `MessageTurnPayload`),
// not from this file's model of it. `message` and `scenario_id` are the two
// fields the ledger reads (`readUserMessage`, and the pairing key), so a
// hand-invented shape here would make the assertions below vacuous.
const TURN_PAYLOAD = {
  kind: 'message',
  turn_id: 'turn-ledger-1',
  scenario_id: 'scen-ledger-1',
  stage: 'FRAME',
  turn_class: 'user_message',
  message: 'Draft me a first model.',
  source: 'composer',
} as unknown as OrchestratorTurnPayload

function parsedAnsweredTurn() {
  return {
    kind: 'response' as const,
    response: {
      response_version: '5.0',
      assistant_text: 'Here is a first draft.',
      blocks: [],
    } as never,
  }
}

function storePayloads(): ConversationTurnSourcePayload[] {
  return usePayloadTraceStore.getState()
    .payloads as unknown as ConversationTurnSourcePayload[]
}

describe('streamed terminal ingest → conversation ledger', () => {
  beforeEach(() => {
    usePayloadTraceStore.setState({ payloads: [], selectedId: null })
    vi.stubEnv('VITE_ENABLE_PAYLOAD_INSPECTION', 'true')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('PRECONDITION: the real store accepted the record (else every assertion below is vacuous)', () => {
    recordStreamedTerminalIngest({
      payload: TURN_PAYLOAD,
      parsed: parsedAnsweredTurn(),
      statusCode: 200,
      startedAt: 1_000,
      completedAt: 62_000,
      headers: { 'x-request-id': 'req-ledger-1' },
    })
    expect(storePayloads().length).toBeGreaterThan(0)
  })

  it('counts an ANSWERED streamed cold draft as a turn, not as a transport leg', () => {
    recordStreamedTerminalIngest({
      payload: TURN_PAYLOAD,
      parsed: parsedAnsweredTurn(),
      statusCode: 200,
      startedAt: 1_000,
      completedAt: 62_000,
      headers: { 'x-request-id': 'req-ledger-1' },
    })

    const payloads = storePayloads()
    expect(payloads.length).toBe(1)
    const recordedId = payloads[0].id

    const result = selectRecentConversationTurns(payloads)

    // The property the old endpoint assertion was a proxy for.
    expect(result.turn_record_count).toBe(1)
    expect(result.transport_leg_count).toBe(0)

    // Bound BY IDENTITY to the record we just wrote — not to "a turn exists".
    const turn = result.turns.find((t) => t.trace_id === recordedId)
    expect(turn).toBeDefined()
    expect(turn!.transport_kind).toBe('streamed_terminal_ingest')
    expect(turn!.outcome).not.toBe('transport_leg')
    // The propagated request identity reaches the ledger, which is what makes
    // the open/terminal pairing below possible at all.
    expect(turn!.request_id).toBe('req-ledger-1')
  })

  it('CONTRAST: the SSE open marker on the same endpoint is still a transport leg', () => {
    // Discriminating control. The stream endpoint alone must NOT be enough to
    // be counted — otherwise the test above would pass for the wrong reason
    // and a genuine open-marker regression would be invisible.
    const { recordRequestPayload, recordResponsePayload } =
      usePayloadTraceStore.getState()
    recordRequestPayload({
      id: 'open-marker-1',
      timestamp: 500,
      capture: { kind: 'stream_open', requestId: 'req-ledger-1' },
      endpoint: 'https://cee.test/proxy/v5/turn/stream',
      method: 'POST',
      headers: { Accept: 'text/event-stream' },
      body: TURN_PAYLOAD,
    })
    recordResponsePayload({
      id: 'open-marker-1',
      status: 200,
      headers: {},
      body: { __trace_record_kind__: 'stream_open' },
      duration: 10,
    })

    const result = selectRecentConversationTurns(storePayloads())
    expect(result.turn_record_count).toBe(0)
    expect(result.transport_leg_count).toBe(1)
  })

  it('an open and its terminal receipt are ONE request, counted once', () => {
    // The integration property neither lane guarded: without the propagated
    // request id the ledger cannot tell a paired open from a real buffered
    // retry, and the same user message is counted twice.
    const { recordRequestPayload, recordResponsePayload } =
      usePayloadTraceStore.getState()
    recordRequestPayload({
      id: 'open-marker-2',
      timestamp: 500,
      capture: { kind: 'stream_open', requestId: 'req-ledger-1' },
      endpoint: 'https://cee.test/proxy/v5/turn/stream',
      method: 'POST',
      headers: { Accept: 'text/event-stream' },
      body: TURN_PAYLOAD,
    })
    recordResponsePayload({
      id: 'open-marker-2',
      status: 200,
      headers: {},
      body: { __trace_record_kind__: 'stream_open' },
      duration: 10,
    })
    recordStreamedTerminalIngest({
      payload: TURN_PAYLOAD,
      parsed: parsedAnsweredTurn(),
      statusCode: 200,
      startedAt: 1_000,
      completedAt: 62_000,
      headers: { 'x-request-id': 'req-ledger-1' },
    })

    const result = selectRecentConversationTurns(storePayloads())
    // PRECONDITION: user prose capture is ON, else `user_authored_count` is
    // zero for BOTH records and the dedup assertion below proves nothing.
    expect(result.user_message_omitted_reason).toBeUndefined()
    expect(result.captured_count).toBe(2)
    expect(result.turn_record_count).toBe(1)
    expect(result.transport_leg_count).toBe(1)
    // The pairing: one request observed twice is ONE user message.
    expect(result.user_authored_count).toBe(1)
  })
})
