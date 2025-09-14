// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { PresenceProvider, __TEST__getPresenceControls } from '@/sandbox/presence/PresenceProvider'
import type { PresenceTransport, PresencePayload } from '@/sandbox/presence/service'
import { FlagsProvider } from '@/lib/flags'

// Hoisted mock for analytics
const trackSpy = vi.fn()
vi.mock('@/lib/analytics', () => ({ track: (...args: any[]) => trackSpy(...args) }))

class FakeTransport implements PresenceTransport {
  room = ''
  subs = new Set<(p: PresencePayload) => void>()
  connect(roomId: string): () => void { this.room = roomId; return () => {} }
  publish(p: PresencePayload): void { for (const fn of this.subs) fn(p) }
  subscribe(fn: (p: PresencePayload) => void): () => void { this.subs.add(fn); return () => { this.subs.delete(fn) } }
}

describe('presence.telemetry.unit', () => {

  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); trackSpy.mockReset() })
  afterEach(() => { try { vi.runOnlyPendingTimers() } catch {}; vi.useRealTimers(); trackSpy.mockReset() })

  it('emits sandbox_presence_idle then sandbox_presence_active (rate-limited 60s)', async () => {
    const tx = new FakeTransport()
    await act(async () => {
      render(
        React.createElement(FlagsProvider as any, { value: { sandbox: true, sandboxPresence: true } },
          React.createElement(PresenceProvider as any, { decisionId: 'demo', user: { id: 'me', name: 'Me', color: '#000' }, transport: tx },
            React.createElement('div', null)
          )
        )
      )
    })

    // deterministically ensure timer is armed
    const ctl = __TEST__getPresenceControls('demo')
    ctl?.resetIdleTimer()

    // Advance 45s -> idle emit
    await act(async () => { vi.advanceTimersByTime(45001) })
    const names1 = trackSpy.mock.calls.map((c: any[]) => c[0])
    expect(names1).toContain('sandbox_presence_idle')

    // Activity immediately emits active
    await act(async () => {
      document.dispatchEvent(new Event('pointermove'))
    })
    const names2 = trackSpy.mock.calls.map((c: any[]) => c[0])
    expect(names2).toContain('sandbox_presence_active')

    // Within 60s no repeat
    trackSpy.mockClear()
    await act(async () => { vi.advanceTimersByTime(45001); document.dispatchEvent(new Event('pointermove')) })
    const names3 = trackSpy.mock.calls.map((c: any[]) => c[0])
    expect(names3).toEqual([])

    // After 60s, emits again
    await act(async () => { vi.advanceTimersByTime(60001 + 45001) })
    expect(trackSpy.mock.calls.map((c: any[]) => c[0])).toContain('sandbox_presence_idle')
  })
})
