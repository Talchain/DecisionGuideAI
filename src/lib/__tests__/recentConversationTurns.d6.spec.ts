/**
 * D-6 (P2 train, 27 Sep 2026) — the conversation capture's identity and
 * truncation must come from CEE's typed fields and the trace store's own
 * record, not from a null `turn_kind` and a silent cap.
 *   i217: a build_model_from_brief turn whose automatic post-construction
 *         run produced the result (Paul's export 17d1cd3a) is analysis-producing.
 *   i107: a store that evicted V5 turns reports `truncated: true`.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import wire from '../../components/debug/__tests__/fixtures/paul-exports-20260927/d6-wire.json'
import { selectRecentConversationTurns } from '../recentConversationTurns'
import { usePayloadTraceStore } from '../payload-trace-store'

const V5 = 'https://cee-staging.onrender.com/proxy/v5/turn'

function served(id: string, request: unknown, response: unknown) {
  return {
    id,
    service: 'CEE' as const,
    endpoint: V5,
    method: 'POST',
    timestamp: 1,
    completed: true,
    status: 200,
    request: { headers: {}, body: request },
    response: { headers: {}, body: response },
  }
}

describe('D-6 i217 — analysis-producing from CEE\'s typed run identity', () => {
  it('E1: the brief turn whose post-construction run produced the result reads true', () => {
    const w = wire.e1
    // turn_kind is null on this turn (the request names no action type).
    const r = selectRecentConversationTurns([served('t1', w.cee_request, w.cee_response)] as never)
    expect(r.turns[0].turn_kind).toBeNull()
    expect(r.turns[0].is_analysis_producing).toBe(true)
    expect(r.turns[0].is_analysis_producing_source).toBe('cee_run_provenance')
  })

  it('a later turn re-sending the same run-provenanced analysis did not produce it', () => {
    const w = wire.e1
    const r = selectRecentConversationTurns([
      served('t2-newer', { kind: 'message', turn_id: 'later' }, w.cee_response),
      served('t1-older', w.cee_request, w.cee_response),
    ] as never)
    expect(r.turns.map((t) => t.is_analysis_producing)).toEqual([false, true])
  })

  it('control E2: a block with no run_provenance and no analysis action type stays false', () => {
    const w = wire.e2
    const request = { ...w.cee_request }
    const r = selectRecentConversationTurns([served('t1', request, w.cee_response)] as never)
    expect((w.cee_response.blocks[0] as { enrichment: Record<string, unknown> }).enrichment.run_provenance).toBeUndefined()
    expect(r.turns[0].carried_analysis_result).toBe(true)
    expect(r.turns[0].is_analysis_producing).toBe(false)
  })

  it('control: a typed Run still reads true from the request, as before', () => {
    const r = selectRecentConversationTurns([
      served('t1', { chip: { action_type: 'run_analysis' } }, { blocks: [] }),
    ] as never)
    expect(r.turns[0].is_analysis_producing).toBe(true)
    expect(r.turns[0].is_analysis_producing_source).toBe('request_turn_kind')
  })
})

describe('D-6 i107 — a capped store reports its truncation', () => {
  beforeEach(() => {
    usePayloadTraceStore.getState().clearPayloads()
  })

  function record(n: number) {
    const store = usePayloadTraceStore.getState()
    for (let i = 0; i < n; i++) {
      store.recordRequestPayload({ id: `turn-${i}`, endpoint: V5, method: 'POST', headers: {}, body: { turn_id: `t${i}` } })
    }
  }

  it('23 turns into a 20-entry store: 20 captured, truncated, 23 available', () => {
    record(23)
    const { payloads, evicted } = usePayloadTraceStore.getState()
    expect(payloads).toHaveLength(20)
    expect(evicted.map((e) => e.id)).toEqual(['turn-0', 'turn-1', 'turn-2'])
    const r = selectRecentConversationTurns(payloads as never, { evictedPayloads: evicted })
    expect(r.captured_count).toBe(20)
    expect(r.truncated).toBe(true)
    expect(r.total_available).toBe(23)
    expect(r.evicted_before_capture).toBe(3)
  })

  it('control: 20 turns fill the store without evicting, and nothing is truncated', () => {
    record(20)
    const { payloads, evicted } = usePayloadTraceStore.getState()
    expect(evicted).toEqual([])
    const r = selectRecentConversationTurns(payloads as never, { evictedPayloads: evicted })
    expect(r.truncated).toBe(false)
    expect(r.total_available).toBe(20)
  })

  it('clearing the store clears its eviction record', () => {
    record(21)
    expect(usePayloadTraceStore.getState().evicted).toHaveLength(1)
    usePayloadTraceStore.getState().clearPayloads()
    expect(usePayloadTraceStore.getState().evicted).toEqual([])
  })
})
