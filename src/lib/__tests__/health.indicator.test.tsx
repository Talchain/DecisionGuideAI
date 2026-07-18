import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import React from 'react'

// Speed up polling by enabling E2E mode in this test only
vi.mock('../../flags', () => ({ isE2EEnabled: () => true, isCanvasEnabled: () => false, isScenariosEnabled: () => false }))

vi.mock('../config', () => ({ getGatewayBaseUrl: () => '' }))

import HealthIndicator from '../../components/HealthIndicator'

// Why `waitFor` and not `await new Promise((r) => setTimeout(r, 0))`:
//
// HealthIndicator probes /health on mount and calls setOk() from the async tail
// of that probe. React 18 does not commit that update synchronously — outside
// act() it hands the render to the Scheduler, which under Node + jsdom schedules
// via `setImmediate` (scheduler.development.js `localSetImmediate`), i.e. the
// event loop's CHECK phase. A `setTimeout(…, 0)` barrier resolves in the TIMERS
// phase.
//
// Node gives NO ordering guarantee between a 0ms timer and a setImmediate
// registered after it: the winner depends on which phase the test body resumed
// from and on whether the (1ms-clamped) timer has already expired by the time the
// loop reaches the timers phase. Measured locally: ~0.3% inversions idle and
// ~1.5% under CPU load when resuming from the check phase. When the timer wins,
// the assertion reads the DOM before React has committed and sees "Checking…" —
// which is exactly how this file failed in CI (shard 1/4, run 29662467861).
//
// `waitFor` removes the bet: it polls the assertion until it holds, so the test
// no longer depends on host-callback phase ordering. It is a synchronisation
// barrier, not a retry — the assertions are byte-for-byte as strict as before,
// and a genuinely wrong title still fails the run.
describe('HealthIndicator', () => {
  beforeEach(() => {})
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('success → Connected', async () => {
    const fetchSpy = vi.spyOn(globalThis as any, 'fetch').mockResolvedValue({ ok: true } as any)
    render(<HealthIndicator />)
    // First probe runs immediately on mount and succeeds; await the commit.
    await waitFor(() => {
      const dot = screen.getByTestId('health-dot')
      expect(dot.getAttribute('title') || '').toMatch(/^Connected — checked \d+s ago$/)
    })
    expect(fetchSpy).toHaveBeenCalled()
  })

  it('timeout/non-200 → Offline', async () => {
    const seq: Array<{ ok: boolean }> = [{ ok: false }]
    vi.spyOn(globalThis as any, 'fetch').mockImplementation(async () => {
      return seq.shift() ?? ({ ok: false } as any)
    })

    render(<HealthIndicator />)
    // First probe runs immediately and fails; await the commit.
    await waitFor(() => {
      const dot = screen.getByTestId('health-dot')
      expect(dot.getAttribute('title') || '').toMatch(/^Offline — checked \d+s ago$/)
    })
  })

  it('unmount mid-probe does not leave an orphaned poll loop', async () => {
    // Pins the component fix: tick()'s async tail must not re-arm the timer
    // after the unmount cleanup has already run clearTimer(). Before the fix the
    // resolved probe called schedule(), arming a timer nothing would ever clear.
    let releaseProbe: (v: any) => void = () => {}
    const fetchSpy = vi.spyOn(globalThis as any, 'fetch').mockImplementation(
      () => new Promise((resolve) => { releaseProbe = resolve }),
    )

    const { unmount } = render(<HealthIndicator />)
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))

    // Unmount while the probe is still in flight, then let it settle.
    unmount()
    releaseProbe({ ok: true })
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))

    // E2E backoff is 200ms; an orphaned timer would fire a second probe well
    // inside this window.
    await new Promise((r) => setTimeout(r, 600))
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
