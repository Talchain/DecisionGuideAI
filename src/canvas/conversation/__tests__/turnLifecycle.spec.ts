/**
 * `turnLifecycle.ts` — the pure machine. Ownership is the property that matters: an event naming a turn that is not
 * the current one changes nothing, so a superseded turn can never end the turn that replaced it.
 */
import { describe, it, expect } from 'vitest'
import { turnReducer, TURN_IDLE, isTurnInFlight, withSessionReadTimeout, SessionReadTimeoutError } from '../turnLifecycle'

describe('turnReducer', () => {
  it('idle → pending → streaming → complete', () => {
    let s = turnReducer(TURN_IDLE, { type: 'start', turnId: 'a' })
    expect(s.phase).toBe('pending')
    expect(isTurnInFlight(s)).toBe(true)
    s = turnReducer(s, { type: 'stream', turnId: 'a' })
    expect(s.phase).toBe('streaming')
    s = turnReducer(s, { type: 'settle', turnId: 'a', failure: null })
    expect(s).toEqual({ phase: 'complete', turnId: 'a', failure: null })
    expect(isTurnInFlight(s)).toBe(false)
  })

  it('a failure settles to failed(kind)', () => {
    const s = turnReducer(turnReducer(TURN_IDLE, { type: 'start', turnId: 'a' }), { type: 'settle', turnId: 'a', failure: 'transport' })
    expect(s).toEqual({ phase: 'failed', turnId: 'a', failure: 'transport' })
  })

  it('OWNED: a superseded turn settling or streaming does not touch the current one', () => {
    let s = turnReducer(TURN_IDLE, { type: 'start', turnId: 'a' })
    s = turnReducer(s, { type: 'start', turnId: 'b' }) // preempt
    const before = s
    expect(turnReducer(s, { type: 'settle', turnId: 'a', failure: null })).toBe(before)
    expect(turnReducer(s, { type: 'stream', turnId: 'a' })).toBe(before)
    expect(isTurnInFlight(before)).toBe(true)
  })

  it('a settled turn cannot be settled again (the timer and the finally both exit)', () => {
    let s = turnReducer(TURN_IDLE, { type: 'start', turnId: 'a' })
    s = turnReducer(s, { type: 'settle', turnId: 'a', failure: 'timeout' })
    expect(turnReducer(s, { type: 'settle', turnId: 'a', failure: null })).toBe(s)
  })

  it('stop ends only an in-flight turn; reset always returns to idle', () => {
    const pending = turnReducer(TURN_IDLE, { type: 'start', turnId: 'a' })
    expect(turnReducer(pending, { type: 'stop' }).phase).toBe('stopped')
    expect(turnReducer(TURN_IDLE, { type: 'stop' })).toBe(TURN_IDLE)
    expect(turnReducer(pending, { type: 'reset' })).toBe(TURN_IDLE)
  })
})

describe('withSessionReadTimeout', () => {
  it('passes a prompt read through', async () => {
    await expect(withSessionReadTimeout(Promise.resolve(42), 50)).resolves.toBe(42)
  })
  it('rejects a read that never returns with SessionReadTimeoutError', async () => {
    await expect(withSessionReadTimeout(new Promise(() => {}), 20)).rejects.toBeInstanceOf(SessionReadTimeoutError)
  })
})
