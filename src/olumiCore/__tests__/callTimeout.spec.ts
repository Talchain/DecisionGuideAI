/**
 * Every call to core is bounded: a request that never settles (a dropped connection with no reset, a stalled proxy) rejects with the same
 * error and words as one that could not reach Olumi, so each caller's existing error path runs and its busy state clears. Without it the
 * page's busy flag and the View poll's reading counter, which clear only in `finally`, stay set for good.
 * Real path: `call` (the one function every core route goes through) and the View store's own refresh, with fake timers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { call, setTeamFetch, TeamApiError, READ_FAILED, UNCERTAIN_WRITE, CALL_TIMEOUT_MS, WRITE_CALL_TIMEOUT_MS } from '../team/api'
import { isReading, useViewStore } from '../../olumiView/store'

/** A fetch that never answers and ignores any signal (the worst case: nothing the page passes can end it). */
const never = (() => new Promise<Response>(() => {})) as unknown as typeof fetch
const SID = 's_0123456789ab'
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers(); setTeamFetch(null); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null } as never) })


describe('a call to core that never settles', () => {
  it('T1 a never-settling read rejects after the timeout with the existing read error and words, and not before', async () => {
    setTeamFetch(never)
    let done = false
    const p = call('GET', '/api/me').then(() => 'resolved', (e: unknown) => { done = true; return e })
    await vi.advanceTimersByTimeAsync(CALL_TIMEOUT_MS - 1)
    expect(done, 'still waiting just before the timeout').toBe(false)
    await vi.advanceTimersByTimeAsync(2)
    const e = await p
    expect(e).toBeInstanceOf(TeamApiError)
    expect([(e as TeamApiError).status, (e as TeamApiError).message, (e as TeamApiError).uncertain]).toEqual([0, READ_FAILED, false])
  })
  it('T2 a never-settling write is uncertain, in the existing words (it may have been saved), never "nothing was sent"', async () => {
    setTeamFetch((async (u: unknown) => (String(u) === '/api/me' ? new Response(JSON.stringify({ me: { id: 'p_1' } }), { status: 200 }) : new Promise<Response>(() => {}))) as unknown as typeof fetch)
    const e = await settleAfter(call('POST', '/api/scenarios/s_0123456789ab/reveal'), WRITE_CALL_TIMEOUT_MS + 1)
    expect(e).toBeInstanceOf(TeamApiError)
    expect([(e as TeamApiError).status, (e as TeamApiError).message, (e as TeamApiError).uncertain]).toEqual([0, UNCERTAIN_WRITE, true])
  })
  it('T3 the View poll\'s reading counter clears and the store reports the read error (the page is not frozen)', async () => {
    setTeamFetch(never)
    useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: SID, view: null, status: 'loading', error: null } as never)
    const r = useViewStore.getState().refresh()
    await vi.advanceTimersByTimeAsync(10)
    expect(isReading(), 'reading while it waits').toBe(true)
    await vi.advanceTimersByTimeAsync(CALL_TIMEOUT_MS + 1)
    expect(await r).toBe(false)
    expect([isReading(), useViewStore.getState().status, useViewStore.getState().error]).toEqual([false, 'error', READ_FAILED])
  })
  it('T4 CONTRAST: a normal response is unaffected, and its timer is gone (nothing fires later)', async () => {
    setTeamFetch((async () => new Response(JSON.stringify({ ok: 1 }), { status: 200 })) as unknown as typeof fetch)
    expect(await call('GET', '/api/x')).toEqual({ ok: 1 })
    expect(vi.getTimerCount(), 'no timer left behind').toBe(0)
    setTeamFetch((async () => new Response(JSON.stringify({ error: 'Pick a name.' }), { status: 400 })) as unknown as typeof fetch)
    const e = await call('GET', '/api/x').catch((x: unknown) => x)
    expect([(e as TeamApiError).status, (e as TeamApiError).message]).toEqual([400, 'Pick a name.'])
    await vi.advanceTimersByTimeAsync(CALL_TIMEOUT_MS + 1)
  })
})

/** /api/me answers; the write's own response is whatever the spec hands in. */
const withMe = (write: () => Promise<Response>) => setTeamFetch((async (u: unknown) => (String(u) === '/api/me' ? new Response(JSON.stringify({ me: { id: 'p_1' } }), { status: 200 }) : write())) as unknown as typeof fetch)
/** 2xx headers, then a body that never settles. */
const stalledBody = () => ({ ok: true, status: 200, json: () => new Promise<never>(() => {}) }) as unknown as Response
const settleAfter = async (p: Promise<unknown>, ms: number) => { const out = p.then((v) => ({ resolved: v }), (e: unknown) => e); await vi.advanceTimersByTimeAsync(ms); return out }

describe('a write answered 2xx whose body never arrives, and the write limit', () => {
  it('T5 a 2xx POST whose body never settles rejects uncertain at the write limit, NOT as an empty success', async () => {
    withMe(async () => stalledBody())
    const e = await settleAfter(call('POST', '/api/scenarios/s_0123456789ab/invites', { name: 'Cara' }), WRITE_CALL_TIMEOUT_MS + 1)
    expect(e, 'not resolved with {}').toBeInstanceOf(TeamApiError)
    expect([(e as TeamApiError).message, (e as TeamApiError).uncertain]).toEqual([UNCERTAIN_WRITE, true])
  })
  it('T6 a 2xx POST whose body is unreadable (not JSON) is uncertain at once, not {}', async () => {
    withMe(async () => new Response('<html>proxy</html>', { status: 200 }))
    const e = await settleAfter(call('POST', '/api/scenarios/s_0123456789ab/invites', { name: 'Cara' }), 1)
    expect(e).toBeInstanceOf(TeamApiError)
    expect([(e as TeamApiError).message, (e as TeamApiError).uncertain]).toEqual([UNCERTAIN_WRITE, true])
  })
  it('T7 CONTRAST: a 2xx POST with a readable body resolves normally', async () => {
    withMe(async () => new Response(JSON.stringify({ id: 'i_1', link: 'http://x/l' }), { status: 200 }))
    const r = await settleAfter(call('POST', '/api/scenarios/s_0123456789ab/invites', { name: 'Cara' }), 1)
    expect(r).toEqual({ resolved: { id: 'i_1', link: 'http://x/l' } })
  })
  it('T8 a GET still times out at 20 s, and a POST is not cut at 20 s', async () => {
    setTeamFetch(never)
    const g = await settleAfter(call('GET', '/api/x'), CALL_TIMEOUT_MS + 1)
    expect([(g as TeamApiError).message, (g as TeamApiError).uncertain]).toEqual([READ_FAILED, false])
    expect([CALL_TIMEOUT_MS, WRITE_CALL_TIMEOUT_MS]).toEqual([20_000, 120_000])
    let done = false
    withMe(() => new Promise<Response>(() => {}))
    const p = call('POST', '/api/scenarios/s_0123456789ab/reveal').then(() => 'resolved', (e: unknown) => { done = true; return e })
    await vi.advanceTimersByTimeAsync(CALL_TIMEOUT_MS + 5_000)
    expect(done, 'a write is still waiting after the read limit').toBe(false)
    await vi.advanceTimersByTimeAsync(WRITE_CALL_TIMEOUT_MS)
    expect((await p as TeamApiError).uncertain).toBe(true)
  })
})
