/**
 * A layout failure leaves evidence that survives a production build.
 *
 * ⭐⭐ THE DEFECT THIS CLOSES IS NOT THE FAILURE — IT IS THAT NOBODY CAN LEARN
 * FROM IT. `layoutFailureIsSurvivable.spec.ts` made the incident survivable and
 * states plainly that the cause is open: *"IT DOES NOT PIN WHY ELK THREW. That
 * cause is open and may stay open."* Bad graph input was refuted by execution;
 * the timing theory was refuted too.
 *
 * It has stayed open for a mundane reason. The catch held the rejection and
 * logged it under `import.meta.env.DEV` ONLY. The incident happens on staging,
 * which is a production build, so the single artefact that could name the cause
 * was discarded every time it occurred.
 *
 * ⚠ AND THE SECOND PATH HAD NO DIAGNOSTIC AT ALL, not even a DEV one. A
 * resolution reporting `laidOut: false` raises the SAME banner while meaning
 * something quite different — the attempt declined rather than threw. Reading
 * one as the other sends an investigation to the wrong place, which is the
 * cheapest way to keep a cause open for another week.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

import { handleLayoutWithRecovery } from '../handleLayoutWithRecovery'
import { useLayoutProgressStore } from '../../layoutProgressStore'

type Crumb = { t: number; m: string; data?: Record<string, unknown> }
const ring = (): Crumb[] =>
  (((globalThis as unknown as { __SAFE_DEBUG__?: { logs?: Crumb[] } }).__SAFE_DEBUG__?.logs) ??
    []) as Crumb[]
const failures = (): Crumb[] => ring().filter((l) => l.m === 'canvas:trace:layout:failed')

beforeEach(() => {
  ;(globalThis as unknown as { __SAFE_DEBUG__?: unknown }).__SAFE_DEBUG__ = { logs: [] }
  useLayoutProgressStore.setState({ status: 'idle', message: null, retry: null } as never)
})

describe('a rejection leaves its reason behind', () => {
  it('records the error NAME, MESSAGE and STACK — not just that something failed', async () => {
    const boom = new Error('elk: something specific went wrong')
    handleLayoutWithRecovery(() => Promise.reject(boom))
    await vi.waitFor(() => expect(failures()).toHaveLength(1))

    const [crumb] = failures()
    expect(crumb.data?.phase).toBe('rejected')
    const err = crumb.data?.err as Record<string, unknown>
    // The STACK is the point: the open question is which call path rejects, and
    // a bare message names nothing.
    expect(err.name).toBe('Error')
    expect(err.message).toBe('elk: something specific went wrong')
    expect(String(err.stack ?? '')).toContain('Error')
  })

  /**
   * ⚠ THE ARM THAT WOULD RED ON A REGRESSION TO THE OLD BEHAVIOUR. The previous
   * code recorded nothing outside DEV. Vitest runs with DEV truthy, so a test
   * that merely asserted "something was logged" could pass against the very code
   * this change replaces. This asserts the PRODUCTION-SAFE channel specifically —
   * the ring, not the console — which the old code never wrote to at all.
   */
  it('writes to the ring rather than only the console', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    handleLayoutWithRecovery(() => Promise.reject(new Error('x')))
    await vi.waitFor(() => expect(failures()).toHaveLength(1))
    spy.mockRestore()
  })

  it('still re-arms the banner, so the diagnostic did not change the behaviour', async () => {
    handleLayoutWithRecovery(() => Promise.reject(new Error('x')))
    await vi.waitFor(() => expect(useLayoutProgressStore.getState().status).toBe('error'))
    expect(typeof useLayoutProgressStore.getState().retry).toBe('function')
  })
})

describe('a DECLINED attempt is distinguishable from a rejection', () => {
  it('records phase "declined", not "rejected"', async () => {
    handleLayoutWithRecovery(() => Promise.resolve({ laidOut: false }))
    await vi.waitFor(() => expect(failures()).toHaveLength(1))
    expect(failures()[0].data?.phase).toBe('declined')
  })

  /**
   * ⭐ THE DISCRIMINATING PAIR. Both paths raise the same banner, so "a crumb
   * was written" proves nothing about which happened. Asserting the two produce
   * DIFFERENT phases is what makes the record worth reading.
   */
  it('the two failure paths do not look the same in the record', async () => {
    handleLayoutWithRecovery(() => Promise.reject(new Error('threw')))
    await vi.waitFor(() => expect(failures()).toHaveLength(1))
    handleLayoutWithRecovery(() => Promise.resolve({ laidOut: false }))
    await vi.waitFor(() => expect(failures()).toHaveLength(2))
    expect(new Set(failures().map((c) => c.data?.phase))).toEqual(new Set(['rejected', 'declined']))
  })
})

describe('a success leaves nothing', () => {
  it('does not write a failure crumb when the layout works', async () => {
    const onSuccess = vi.fn()
    handleLayoutWithRecovery(() => Promise.resolve(), { onSuccess })
    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalled())
    // Floor: a channel that records on success would drown the signal it exists
    // to carry, and the ring is capped at 2000.
    expect(failures()).toHaveLength(0)
  })
})
