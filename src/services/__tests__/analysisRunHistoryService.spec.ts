/**
 * analysisRunHistoryService — the RLS read seam. ROADMAP 2.113a slice 1.
 *
 * The mock is at the SUPABASE CLIENT seam, so these tests pin the QUERY this
 * module actually issues. Ownership itself is enforced by Postgres RLS
 * (`USING (auth.uid() = user_id)`) and is NOT re-implemented here — the
 * `owner filter` test below asserts that absence deliberately: a client-side
 * `.eq('user_id', …)` would be a second, drift-prone copy of an invariant the
 * DB already owns.
 *
 * Grant + policy were derived at the live staging DB on 2026-07-29
 * (`has_table_privilege('authenticated','public.v5_handler_facts','SELECT')`
 * → true; policy present). Evidence:
 * PHASE0-EVIDENCE-2026-07-28/compare-slice1.md §0.1.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

interface Recorded {
  table: string
  select: string
  eq: Array<[string, unknown]>
  order: Array<[string, unknown]>
  limit: number | null
}

let recorded: Recorded
let response: { data: unknown; error: { message: string } | null }

vi.mock('../../lib/supabase', () => {
  const builder: Record<string, unknown> = {}
  const chain = {
    select(cols: string) { recorded.select = cols; return chain },
    eq(col: string, val: unknown) { recorded.eq.push([col, val]); return chain },
    order(col: string, opts: unknown) { recorded.order.push([col, opts]); return chain },
    limit(n: number) { recorded.limit = n; return Promise.resolve(response) },
  }
  builder.from = (table: string) => { recorded.table = table; return chain }
  return { supabase: builder }
})

import { listPersistedAnalysisRuns, MAX_PERSISTED_RUNS } from '../analysisRunHistoryService'

beforeEach(() => {
  recorded = { table: '', select: '', eq: [], order: [], limit: null }
  response = { data: [], error: null }
})

describe('listPersistedAnalysisRuns — the query', () => {
  it('reads non-noop run_analysis facts for one scenario, newest-first, capped', async () => {
    await listPersistedAnalysisRuns('scenario-1')
    expect(recorded.table).toBe('v5_handler_facts')
    expect(recorded.select).toBe('id, created_at, payload, v5_conversation_turn_id')
    expect(recorded.eq).toEqual([
      ['scenario_id', 'scenario-1'],
      ['handler_id', 'run_analysis'],
      // `noop` is a real COLUMN, not a payload key — a noop fact carries no
      // enrichment and must be filtered in SQL, not silently dropped later.
      ['noop', false],
    ])
    expect(recorded.order).toEqual([['created_at', { ascending: false }]])
    expect(recorded.limit).toBe(MAX_PERSISTED_RUNS)
  })

  it('does NOT filter by user_id — RLS is the authorisation boundary, not a client copy of it', async () => {
    await listPersistedAnalysisRuns('scenario-1')
    expect(recorded.eq.map(([col]) => col)).not.toContain('user_id')
    expect(recorded.eq.map(([col]) => col)).not.toContain('owner_user_id')
  })

  it('makes no query at all for an empty scenario id', async () => {
    expect(await listPersistedAnalysisRuns('')).toEqual([])
    expect(recorded.table).toBe('')
  })
})

describe('listPersistedAnalysisRuns — the result', () => {
  it('returns rows OLDEST-first (every Compare derivation walks chronologically)', async () => {
    response = {
      data: [
        { id: 'c', created_at: '2026-07-20T12:00:00.000Z', payload: { n: 3 }, v5_conversation_turn_id: 't3' },
        { id: 'b', created_at: '2026-07-20T11:00:00.000Z', payload: { n: 2 }, v5_conversation_turn_id: 't2' },
        { id: 'a', created_at: '2026-07-20T10:00:00.000Z', payload: { n: 1 }, v5_conversation_turn_id: 't1' },
      ],
      error: null,
    }
    const rows = await listPersistedAnalysisRuns('scenario-1')
    expect(rows.map(r => r.id)).toEqual(['a', 'b', 'c'])
    expect(rows[0].turnId).toBe('t1')
  })

  it('an owner with no runs, and a guest (RLS returns nothing), both get []', async () => {
    response = { data: [], error: null }
    expect(await listPersistedAnalysisRuns('scenario-1')).toEqual([])
    response = { data: null, error: null }
    expect(await listPersistedAnalysisRuns('scenario-1')).toEqual([])
  })

  it('THROWS on a read error so the caller decides how to degrade — never returns [] for a failure', async () => {
    // Returning [] here would make a revoked grant indistinguishable from
    // "this scenario has no history" — the tab would state the second while
    // the first was true.
    response = { data: null, error: { message: 'permission denied for table v5_handler_facts' } }
    await expect(listPersistedAnalysisRuns('scenario-1')).rejects.toThrow(/permission denied/)
  })

  it('drops a row with no usable id or timestamp rather than defaulting one', async () => {
    response = {
      data: [
        { id: 'ok', created_at: '2026-07-20T10:00:00.000Z', payload: {}, v5_conversation_turn_id: 't' },
        { id: null, created_at: '2026-07-20T11:00:00.000Z', payload: {} },
        { id: 'no-ts', created_at: null, payload: {} },
      ],
      error: null,
    }
    const rows = await listPersistedAnalysisRuns('scenario-1')
    expect(rows.map(r => r.id)).toEqual(['ok'])
  })

  it('honours an explicit limit', async () => {
    await listPersistedAnalysisRuns('scenario-1', 5)
    expect(recorded.limit).toBe(5)
  })
})
