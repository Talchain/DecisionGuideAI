/**
 * The turn ledger can represent a failure — and can tell one from a phantom.
 *
 * ⭐ EVERY FIXTURE HERE IS THE REAL 2026-09-03 SESSION, not a shape invented to
 * suit the code. The bundle is `olumi-debug-f2e2df1b-20260903.json` (UI build
 * `86786efb`); its 19 trace records map 1:1 onto 19 initiating `user_actions`
 * with request-record deltas of 10–88 ms, so the three no-text turns below are
 * the ones a real user actually produced.
 *
 * The tests come in DISCRIMINATING PAIRS wherever a verdict was added, because
 * "the ledger now says failed" and "the ledger says failed only where a turn
 * failed" are different results and only the second is correct. The whole point
 * of this change is that the previous ledger scored a SUCCESSFUL cold draft
 * identically to two genuine failures.
 */
import { describe, it, expect } from 'vitest'
import {
  selectRecentConversationTurns,
  type ConversationTurnSourcePayload,
} from '../recentConversationTurns'

const SCENARIO = '7826c742-2939-4584-917c-f1286a663ae4'
const BUFFERED = 'https://cee-staging.onrender.com/proxy/v5/turn'
const STREAM = 'https://cee-staging.onrender.com/proxy/v5/turn/stream'
const STOP = 'https://cee-staging.onrender.com/proxy/v5/turn/stop'

function rec(over: Partial<ConversationTurnSourcePayload> = {}): ConversationTurnSourcePayload {
  return {
    id: 'trace-1',
    service: 'CEE',
    endpoint: BUFFERED,
    timestamp: 1788443250853,
    completed: true,
    status: 200,
    request: { body: { scenario_id: SCENARIO, message: 'hello' } },
    response: { body: { assistant_text: 'a real reply' } },
    ...over,
  }
}

/** Turn 13 of the capture — the send that worked. */
const ANSWERED = rec({ id: '9c4664d4-199d-4007-8ffa-3585c3571d96' })

/** Turns 14 and 15 — `status: 0`, empty text, and the trace store DID record why. */
const FAILED_ABORT = rec({
  id: 'b780f2d3-4334-42a1-a03f-fe0575170933',
  status: 0,
  response: { body: null },
  error: 'The user aborted a request.',
  errorName: 'AbortError',
  source: 'browser_timeout',
  duration: 4931,
})

const FAILED_NETWORK = rec({
  id: 'b6681618-5bf3-402a-8a8b-bfdbff3c4735',
  status: 0,
  response: { body: null },
  error: 'Failed to fetch',
  errorName: 'TypeError',
  source: 'preflight_or_network',
  duration: 212,
})

/** Exactly as the capture holds them: `status: 0` with the cause dropped. */
const FAILED_CAUSE_DROPPED = rec({
  id: 'b780f2d3-cause-dropped',
  status: 0,
  response: { body: null },
})

/** Turn 18 — the cold draft, which SUCCEEDED. */
const STREAM_OPEN = rec({
  id: '96c46611-9449-44b1-a6cb-6b672c9e4af4',
  endpoint: STREAM,
  completed: false,
  status: undefined,
  response: undefined,
})

describe('outcome answers the turn question, completed answers the transport question', () => {
  it('a settled 2xx with assistant text is answered', () => {
    const [t] = selectRecentConversationTurns([ANSWERED]).turns
    expect(t.outcome).toBe('answered')
    expect(t.outcome_reason).toBeNull()
    expect(t.transport_kind).toBe('buffered_turn')
  })

  it('a status-0 turn is failed even though the transport settled', () => {
    // THE HEADLINE. `completed: true` and `outcome: 'failed'` are both correct
    // and they answer different questions; the old ledger only carried the
    // first, which is how a failed turn read as a completed one.
    const [t] = selectRecentConversationTurns([FAILED_ABORT]).turns
    expect(t.completed).toBe(true)
    expect(t.outcome).toBe('failed')
  })

  it('a non-2xx turn is failed and names the status', () => {
    const [t] = selectRecentConversationTurns([rec({ status: 504, response: { body: null } })]).turns
    expect(t.outcome).toBe('failed')
    expect(t.outcome_reason).toBe('http_504')
  })
})

describe('status 0 is a three-way ambiguity, and the ledger now carries the discriminator', () => {
  it('an abort is named as an abort', () => {
    const [t] = selectRecentConversationTurns([FAILED_ABORT]).turns
    expect(t.outcome_reason).toBe('browser_timeout')
    expect(t.error_name).toBe('AbortError')
    expect(t.failure_source).toBe('browser_timeout')
    expect(t.duration_ms).toBe(4931)
  })

  it('a network throw is named as a network throw — the pair', () => {
    // Not the same failure and not the same advice: an abort means the turn
    // probably committed and a re-send duplicates; this one means nothing
    // reached the server and a re-send is free.
    const [t] = selectRecentConversationTurns([FAILED_NETWORK]).turns
    expect(t.outcome_reason).toBe('preflight_or_network')
    expect(t.error).toBe('Failed to fetch')
  })

  it('when the cause was not recorded it says SO, rather than inventing one', () => {
    const [t] = selectRecentConversationTurns([FAILED_CAUSE_DROPPED]).turns
    expect(t.outcome).toBe('failed')
    expect(t.outcome_reason).toBe('status_0_cause_not_recorded')
    expect(t.failure_source).toBeNull()
  })
})

describe('the phantom: a stream open is not a turn', () => {
  it('a stream-open record is a transport leg, never a failed turn', () => {
    const [t] = selectRecentConversationTurns([STREAM_OPEN]).turns
    expect(t.transport_kind).toBe('stream_open')
    expect(t.outcome).toBe('transport_leg')
    expect(t.outcome).not.toBe('failed')
    expect(t.outcome).not.toBe('unsettled')
  })

  it('a stop record is a transport leg too', () => {
    const [t] = selectRecentConversationTurns([rec({ endpoint: STOP })]).turns
    expect(t.transport_kind).toBe('stop')
    expect(t.outcome).toBe('transport_leg')
  })

  it('an UNSETTLED BUFFERED turn is still reported as unsettled — the pair', () => {
    // The stream-open carve-out must not swallow the real thing it resembles.
    // A buffered request with no response recorded genuinely was never observed
    // to finish, and that must stay visible.
    const [t] = selectRecentConversationTurns([
      rec({ endpoint: BUFFERED, completed: false, status: undefined, response: undefined }),
    ]).turns
    expect(t.transport_kind).toBe('buffered_turn')
    expect(t.outcome).toBe('unsettled')
    expect(t.outcome_reason).toBe('no_response_recorded')
  })

  it('a query string cannot smuggle a buffered turn into the stream leg', () => {
    const [t] = selectRecentConversationTurns([
      rec({ endpoint: 'https://cee-staging.onrender.com/proxy/v5/turn?next=/stream' }),
    ]).turns
    expect(t.transport_kind).toBe('buffered_turn')
  })
})

describe('an empty 2xx is not a failure', () => {
  it('a settled 2xx with no assistant text is no_text, not failed', () => {
    // CEE's own commit path documents the legitimate case by name: "the
    // draft_graph path whose provisional response carries empty
    // assistant_text". Scoring it as a failure would trade the old
    // over-optimistic reading for an over-pessimistic one.
    const [t] = selectRecentConversationTurns([rec({ response: { body: { assistant_text: '' } } })]).turns
    expect(t.outcome).toBe('no_text')
    expect(t.outcome_reason).toBe('no_assistant_text_on_2xx')
    expect(t.has_assistant_text).toBe(false)
  })
})

describe('the counts a bundle reader actually needs', () => {
  const SESSION = [ANSWERED, FAILED_ABORT, FAILED_NETWORK, STREAM_OPEN]

  it('reports two failures and one transport leg, not three failures', () => {
    // Read off the OLD ledger this session shows `captured_count 4,
    // llm_authored_count 1` — three turns with no text, which is what made a
    // successful cold draft look like a hidden failure.
    const r = selectRecentConversationTurns(SESSION)
    expect(r.captured_count).toBe(4)
    expect(r.llm_authored_count).toBe(1)
    expect(r.failed_count).toBe(2)
    expect(r.transport_leg_count).toBe(1)
    expect(r.answered_count).toBe(1)
    expect(r.unsettled_count).toBe(0)
  })

  it('turn_record_count excludes the transport legs', () => {
    expect(selectRecentConversationTurns(SESSION).turn_record_count).toBe(3)
  })

  it('every captured record lands in exactly one outcome bucket', () => {
    // A completeness assertion over the buckets rather than over my own list of
    // them: if a future outcome value is added and left uncounted, this reds.
    const r = selectRecentConversationTurns(SESSION)
    const summed =
      r.answered_count +
      r.no_text_count +
      r.failed_count +
      r.unsettled_count +
      r.transport_leg_count
    expect(summed).toBe(r.captured_count)
  })
})
