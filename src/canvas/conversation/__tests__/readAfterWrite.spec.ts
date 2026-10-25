/**
 * Read-after-write (DL ruling, contract v1.5): the scenario read must serve the saved model (its full identity) and,
 * after a Run, that Run, current. One retry; still not, or no graph read at all → a refresh line (DL, v1.6).
 */
import { describe, expect, it } from 'vitest'
import { readAfterWriteExpectation, checkReadAfterWrite, readAfterWriteNotice, STALE_MODEL_NOTICE, RUN_NOT_DELIVERED_NOTICE, READ_FAILED_NOTICE } from '../readAfterWrite'
import { parseV5Response } from '../../../v5/responseParser'

const SAVED = 'c57ba8f34f877fa3bcce4de5c6f40c527f8578e821e04b0b9f4237baf2184d9f'
const OLDER = 'a'.repeat(64)
const RUN = 'c253bb65588667a6213a562667f5ae728532b1a966adfa298cbf222d4673bb63'
const read = (identity: string, run?: { run_id: string; stale: boolean }) => ({
  status: 'graph', graph: {}, graphHash: '48e2a1babc59ccfd', contentHash: identity,
  canonicalAnalysisView: run ? { run: { run_id: run.run_id }, staleness: { stale: run.stale } } : null,
}) as never
const reads = (...answers: unknown[]) => {
  const calls: string[] = []
  const fn = async (scenarioId: string) => { calls.push(scenarioId); return answers[calls.length - 1] as never }
  return { calls, deps: { read: fn as never, wait: async () => {} } }
}
const model = { scenarioRevision: SAVED, runId: null }
const afterRun = { scenarioRevision: SAVED, runId: RUN }

describe('read-after-write after a core-route turn', () => {
  it('⭐ an older model is read once more: the saved one on the retry is confirmed', async () => {
    const r = reads(read(OLDER), read(SAVED))
    expect(await checkReadAfterWrite('scn', model, {}, r.deps)).toBe('confirmed')
    expect(r.calls).toHaveLength(2)
  })
  it('⭐ still an older model after the retry → the refresh notice, never shown as saved', async () => {
    const outcome = await checkReadAfterWrite('scn', model, {}, reads(read(OLDER), read(OLDER)).deps)
    expect([outcome, readAfterWriteNotice(outcome, { wrote: true })]).toEqual(['stale_model', STALE_MODEL_NOTICE])
  })
  it('⛔ the same stale read after a turn with no receipt never says "saved": the could-not-refresh line (U-W2)', async () => {
    const outcome = await checkReadAfterWrite('scn', model, {}, reads(read(OLDER), read(OLDER)).deps)
    expect([outcome, readAfterWriteNotice(outcome, { wrote: false })]).toEqual(['stale_model', READ_FAILED_NOTICE])
  })
  it('⭐ a Run degraded while the model matches → not delivered (stale, or another Run), never a pass', async () => {
    const stale = await checkReadAfterWrite('scn', afterRun, {}, reads(read(SAVED, { run_id: RUN, stale: true }), read(SAVED, { run_id: RUN, stale: true })).deps)
    const other = await checkReadAfterWrite('scn', afterRun, {}, reads(read(SAVED, { run_id: 'b'.repeat(64), stale: false }), read(SAVED)).deps)
    expect([stale, other, readAfterWriteNotice(stale, { wrote: true })]).toEqual(['run_not_delivered', 'run_not_delivered', RUN_NOT_DELIVERED_NOTICE])
  })
  it('CONTRAST: the saved model and this Run, current → confirmed in one read; no graph read at all → the could-not-refresh line', async () => {
    const once = reads(read(SAVED, { run_id: RUN, stale: false }))
    expect(await checkReadAfterWrite('scn', afterRun, {}, once.deps)).toBe('confirmed')
    expect(once.calls).toHaveLength(1)
    const none = await checkReadAfterWrite('scn', model, {}, reads({ status: 'unavailable' }, { status: 'unavailable' }).deps)
    expect([none, readAfterWriteNotice(none, { wrote: true }), readAfterWriteNotice('confirmed', { wrote: true })]).toEqual(['unknown', READ_FAILED_NOTICE, null])
  })
  it('a core-route turn names what to read back (with its Run after a Run); a legacy turn names nothing', async () => {
    const res = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json' } })
    const body = (run: unknown) => ({ turn_id: 't', assistant_text: 'ok', cards: [], notes: [], receipts: [], error: null, run,
      model: { revision: '48e2a1babc59ccfd', scenario_revision: SAVED, graph: { nodes: [], edges: [] } } })
    const plain = await parseV5Response(res(body(null)), { coreRoute: true })
    const ran = await parseV5Response(res(body({ run_key: '07b381d77a4ad439', run_id: RUN, computed_against: '48e2a1babc59ccfd',
      state: { kind: 'complete_current' } })), { coreRoute: true })
    expect(plain.kind === 'response' && readAfterWriteExpectation(plain.response)).toEqual(model)
    expect(ran.kind === 'response' && readAfterWriteExpectation(ran.response)).toEqual(afterRun)
    const legacy = await parseV5Response(res({ response_version: 2, assistant_text: 'hi', blocks: [], suggested_actions: [], insights: [], stage_indicator: 'frame' }))
    expect(legacy.kind === 'response' && readAfterWriteExpectation(legacy.response)).toBeNull()
  })
})
