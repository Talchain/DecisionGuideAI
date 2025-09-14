// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { FlagsProvider } from '@/lib/flags'
import { PresenceProvider } from '@/sandbox/presence/PresenceProvider'
import type { PresenceTransport, PresencePayload } from '@/sandbox/presence/service'
import { PresenceOverlay, __TEST__presenceOverlayTick } from '@/whiteboard/PresenceOverlay'

class FakeTransport implements PresenceTransport {
  room = ''
  subs = new Set<(p: PresencePayload) => void>()
  connect(roomId: string): () => void { this.room = roomId; return () => {} }
  publish(p: PresencePayload): void { for (const fn of this.subs) fn(p) }
  subscribe(fn: (p: PresencePayload) => void): () => void { this.subs.add(fn); return () => { this.subs.delete(fn) } }
}

describe('presence.idle.rtl', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0) })
  afterEach(() => { try { vi.runOnlyPendingTimers() } catch {}; vi.useRealTimers() })

  it('shows idle fade and tooltip; restores active on activity', async () => {
    const tx = new FakeTransport()
    const editor = {}

    await act(async () => {
      render(
        React.createElement(FlagsProvider as any, { value: { sandbox: true, sandboxPresence: true } },
          React.createElement(PresenceProvider as any, { decisionId: 'demo', user: { id: 'u1', name: 'Me', color: '#000' }, transport: tx },
            React.createElement('div', { style: { position: 'relative', width: 800, height: 600 } },
              React.createElement(PresenceOverlay as any, { getEditor: () => editor as any })
            )
          )
        )
      )
    })

    // Inject a remote participant
    await act(async () => { tx.publish({ userId: 'u2', name: 'Alice', color: '#3b82f6', cursor: { x: 100, y: 100 }, ts: Date.now() }) })

    // Not idle initially
    let chip = document.querySelector('[data-testid="presence-cursor-u2"] [data-dg-presence]') as HTMLElement
    expect(chip).toBeTruthy()
    expect(chip.getAttribute('data-dg-presence')).toBe('active')

    // Advance to idle
    await act(async () => { vi.advanceTimersByTime(45001); __TEST__presenceOverlayTick() })
    chip = document.querySelector('[data-testid="presence-cursor-u2"] [data-dg-presence]') as HTMLElement
    expect(chip.getAttribute('data-dg-presence')).toBe('idle')
    expect(chip.className).toMatch(/opacity-50/)
    expect((chip.getAttribute('title') || '')).toMatch(/Idle/i)
    expect(chip.textContent || '').toMatch(/\(idle\)/i)

    // Remote activity restores active
    await act(async () => { tx.publish({ userId: 'u2', name: 'Alice', color: '#3b82f6', cursor: { x: 101, y: 101 }, ts: Date.now() }) })
    await act(async () => { __TEST__presenceOverlayTick() })
    chip = document.querySelector('[data-testid="presence-cursor-u2"] [data-dg-presence]') as HTMLElement
    expect(chip.getAttribute('data-dg-presence')).toBe('active')
    expect(chip.textContent || '').not.toMatch(/\(idle\)/i)

    // Overlay remains non-blocking
    const overlay = document.querySelector('[data-dg-presence-overlay]') as HTMLElement
    expect(overlay).toBeTruthy()
    expect((overlay.className || '')).toMatch(/pointer-events-none/)
  })
})
