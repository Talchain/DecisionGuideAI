/**
 * Every call to core is bounded: a request that never settles (a dropped connection with no reset, a stalled proxy) rejects with the same
 * error and words as one that could not reach Olumi, so each caller's existing error path runs and its busy state clears. Without it the
 * page's busy flag and the View poll's reading counter, which clear only in `finally`, stay set for good.
 * Real path: `call` (the one function every core route goes through) and the View store's own refresh, with fake timers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { call, setTeamFetch, TeamApiError, READ_FAILED, UNCERTAIN_WRITE, CALL_TIMEOUT_MS } from '../team/api'
import { isReading, useViewStore } from '../../olumiView/store'

/** A fetch that never answers and ignores any signal (the worst case: nothing the page passes can end it). */
const never = (() => new Promise<Response>(() => {})) as unknown as typeof fetch
const SID = 's_0123456789ab'
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers(); setTeamFetch(null); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null } as never) })

const settle = async (p: Promise<unknown>) => { const out = p.then(() => 'resolved', (e: unknown) => e); await vi.advanceTimersByTimeAsync(CALL_TIMEOUT_MS + 1); return out }

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
    const e = await settle(call('POST', '/api/scenarios/s_0123456789ab/reveal'))
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
