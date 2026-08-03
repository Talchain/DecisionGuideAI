/**
 * useServerGraphHydration — the hook's own guarantees (adversarial review A2/A6).
 *
 * Every claim pinned here was COMMENT-ONLY before: the once-per-scenario guard,
 * the abort on dependency change, and the StrictMode double-mount fix. A
 * docstring is not a test.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StrictMode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { useServerGraphHydration } from '../useServerGraphHydration'
import * as hydration from '../../hydrate/serverGraphHydration'

const A = '11111111-2222-4333-8444-555555555555'
const B = '22222222-3333-4444-8555-666666666666'

let user: { id: string } | null = { id: 'guest' }
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user }),
}))

/**
 * Typed through a factory rather than `ReturnType<typeof vi.spyOn>`, which
 * widens to `MockInstance<unknown[], unknown>` and does not accept the real
 * spy — the typecheck gate caught that as a genuine new error.
 */
function spyOnHydrate() {
  return vi.spyOn(hydration, 'hydrateCanvasFromServer').mockResolvedValue('merged')
}

let spy: ReturnType<typeof spyOnHydrate>

beforeEach(() => {
  user = { id: 'guest' }
  spy = spyOnHydrate()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useServerGraphHydration — once per scenario', () => {
  it('hydrates once for a scenario id and not again on re-render', async () => {
    const { rerender } = renderHook(({ id }) => useServerGraphHydration(id), {
      initialProps: { id: A },
    })
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))
    rerender({ id: A })
    rerender({ id: A })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('hydrates AGAIN when the scenario id changes', async () => {
    const { rerender } = renderHook(({ id }) => useServerGraphHydration(id), {
      initialProps: { id: A },
    })
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))
    rerender({ id: B })
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
    expect(spy.mock.calls[1][0]).toBe(B)
  })

  it('makes NO call without a scenario id', () => {
    renderHook(() => useServerGraphHydration(null))
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('useServerGraphHydration — cancellation', () => {
  it('ABORTS the in-flight read when the scenario id changes', async () => {
    const { rerender } = renderHook(({ id }) => useServerGraphHydration(id), {
      initialProps: { id: A },
    })
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))
    const firstSignal = (spy.mock.calls[0][1] as any).signal as AbortSignal
    expect(firstSignal.aborted).toBe(false)

    rerender({ id: B })
    expect(firstSignal.aborted).toBe(true)
  })

  it('aborts on unmount', async () => {
    const { unmount } = renderHook(() => useServerGraphHydration(A))
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))
    const signal = (spy.mock.calls[0][1] as any).signal as AbortSignal
    unmount()
    expect(signal.aborted).toBe(true)
  })
})

describe('useServerGraphHydration — StrictMode (A6)', () => {
  /**
   * The defect this pins: the ref was marked "attempted" BEFORE the async call,
   * so StrictMode's dev double-mount aborted the first attempt and the second
   * effect early-returned on that same ref. Hydration therefore NEVER ran in
   * development, while production was fine — so a manual dev check would have
   * observed "no hydration" and drawn exactly the wrong conclusion about
   * shipped code.
   */
  it('still hydrates under StrictMode double-mount', async () => {
    renderHook(() => useServerGraphHydration(A), { wrapper: StrictMode })
    await waitFor(() => expect(spy).toHaveBeenCalled())
    // The surviving mount's read must not be an aborted one.
    const live = spy.mock.calls.some(
      (c) => !((c[1] as any).signal as AbortSignal).aborted,
    )
    expect(live).toBe(true)
  })
})

describe('useServerGraphHydration — identity', () => {
  it('passes the auth user id through', async () => {
    user = { id: 'user-42' }
    renderHook(() => useServerGraphHydration(A))
    await waitFor(() => expect(spy).toHaveBeenCalled())
    expect((spy.mock.calls[0][1] as any).userId).toBe('user-42')
  })
})
