import { describe, it, expect, beforeEach } from 'vitest'
import { useFloatingPanelState, canAutoDock } from '../useFloatingPanelState'

describe('useFloatingPanelState', () => {
  beforeEach(() => {
    useFloatingPanelState.getState().reset()
  })

  it('starts closed with default size and source=user', () => {
    const s = useFloatingPanelState.getState()
    expect(s.isOpen).toBe(false)
    expect(s.userRepositioned).toBe(false)
    expect(s.source).toBe('user')
    expect(s.size).toEqual({ width: 400, height: 550 })
    expect(s.position).toBeNull()
  })

  it('open() records source and clears userRepositioned', () => {
    useFloatingPanelState.getState().setPosition({ x: 100, y: 100 })
    expect(useFloatingPanelState.getState().userRepositioned).toBe(true)

    useFloatingPanelState.getState().open('system-first-use')
    const s = useFloatingPanelState.getState()
    expect(s.isOpen).toBe(true)
    expect(s.source).toBe('system-first-use')
    expect(s.userRepositioned).toBe(false)
  })

  it('setPosition flips userRepositioned to true', () => {
    useFloatingPanelState.getState().open('system-first-use')
    expect(useFloatingPanelState.getState().userRepositioned).toBe(false)
    useFloatingPanelState.getState().setPosition({ x: 50, y: 80 })
    expect(useFloatingPanelState.getState().userRepositioned).toBe(true)
    expect(useFloatingPanelState.getState().position).toEqual({ x: 50, y: 80 })
  })

  it('setSize flips userRepositioned to true', () => {
    useFloatingPanelState.getState().open('system-first-use')
    useFloatingPanelState.getState().setSize({ width: 600, height: 700 })
    expect(useFloatingPanelState.getState().userRepositioned).toBe(true)
    expect(useFloatingPanelState.getState().size).toEqual({ width: 600, height: 700 })
  })

  it('toggle() opens with source=user', () => {
    useFloatingPanelState.getState().toggle()
    const s = useFloatingPanelState.getState()
    expect(s.isOpen).toBe(true)
    expect(s.source).toBe('user')
  })

  it('toggle() closes when open', () => {
    useFloatingPanelState.getState().open('system-first-use')
    useFloatingPanelState.getState().toggle()
    expect(useFloatingPanelState.getState().isOpen).toBe(false)
  })
})

describe('performAutoReposition — lifecycle invariants (round-6)', () => {
  it('repeat calls cancel and replace prior rAF + clear timers', () => {
    useFloatingPanelState.getState().reset()
    const anchorA = { x: 100, y: 100 }
    const anchorB = { x: 600, y: 200 }

    const rafQueue: FrameRequestCallback[] = []
    const originalRaf = window.requestAnimationFrame
    const originalCancel = window.cancelAnimationFrame
    let cancelCount = 0
    window.requestAnimationFrame = (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    }
    window.cancelAnimationFrame = (id: number) => {
      cancelCount++
      void id
    }

    try {
      useFloatingPanelState.getState().performAutoReposition(anchorA, { reducedMotion: false })
      expect(cancelCount).toBe(0)
      expect(rafQueue.length).toBe(1)

      // Second call supersedes: prior rAF is cancelled before a new one
      // is scheduled. The prior clear timeout is also cancelled (via
      // clearTimeout, not cancelAnimationFrame — accounted for in the
      // cancelCount metric on the rAF channel only).
      useFloatingPanelState.getState().performAutoReposition(anchorB, { reducedMotion: false })
      expect(cancelCount).toBe(1)
      expect(rafQueue.length).toBe(2)

      // Even if both rAFs fire (our stub doesn't model cancellation), the
      // last-write-wins ordering lands the panel at anchorB.
      rafQueue.forEach((cb) => cb(performance.now()))
      expect(useFloatingPanelState.getState().position).toEqual(anchorB)
    } finally {
      window.requestAnimationFrame = originalRaf
      window.cancelAnimationFrame = originalCancel
    }
  })

  it('reset() cancels any in-flight transition timers', () => {
    useFloatingPanelState.getState().reset()
    let cancelCount = 0
    const originalRaf = window.requestAnimationFrame
    const originalCancel = window.cancelAnimationFrame
    window.requestAnimationFrame = (_cb: FrameRequestCallback) => 42
    window.cancelAnimationFrame = (id: number) => { cancelCount++; void id }

    try {
      useFloatingPanelState.getState().performAutoReposition({ x: 100, y: 100 }, { reducedMotion: false })
      expect(useFloatingPanelState.getState().isAutoRepositioning).toBe(true)

      // Reset before the rAF or clear timer fires.
      useFloatingPanelState.getState().reset()
      expect(cancelCount).toBe(1)
      expect(useFloatingPanelState.getState().isAutoRepositioning).toBe(false)
      expect(useFloatingPanelState.getState().position).toBeNull()
    } finally {
      window.requestAnimationFrame = originalRaf
      window.cancelAnimationFrame = originalCancel
    }
  })

  it('does NOT flip userRepositioned (auto-dock guard preserved)', () => {
    useFloatingPanelState.getState().reset()
    useFloatingPanelState.getState().open('system-first-use')
    expect(useFloatingPanelState.getState().userRepositioned).toBe(false)
    useFloatingPanelState.getState().performAutoReposition({ x: 600, y: 200 }, { reducedMotion: true })
    expect(useFloatingPanelState.getState().userRepositioned).toBe(false)
  })
})

describe('performAutoReposition (round-5: store-owned timers)', () => {
  it('writes the anchor synchronously under reducedMotion + clears isAutoRepositioning', () => {
    useFloatingPanelState.getState().reset()
    const anchor = { x: 600, y: 200 }
    useFloatingPanelState.getState().performAutoReposition(anchor, { reducedMotion: true })
    const s = useFloatingPanelState.getState()
    expect(s.position).toEqual(anchor)
    expect(s.isAutoRepositioning).toBe(false)
    // Direct setState must not flip userRepositioned — the auto-reposition
    // is system-initiated, not user-initiated.
    expect(s.userRepositioned).toBe(false)
  })

  it('arms isAutoRepositioning synchronously, defers the position write to rAF, owner-clears after the window', async () => {
    useFloatingPanelState.getState().reset()
    const anchor = { x: 600, y: 200 }

    // Stub rAF + setTimeout with fake-ish controllers so we can step through
    // the orchestration without relying on real frames.
    const rafCallbacks: FrameRequestCallback[] = []
    const originalRaf = window.requestAnimationFrame
    window.requestAnimationFrame = (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    }

    try {
      useFloatingPanelState.getState().performAutoReposition(anchor, { reducedMotion: false })

      // Phase 1 (synchronous): flag is set, position NOT yet written.
      let s = useFloatingPanelState.getState()
      expect(s.isAutoRepositioning).toBe(true)
      expect(s.position).toBeNull()

      // Phase 2: flush the rAF — position lands at the anchor.
      rafCallbacks.forEach((cb) => cb(performance.now()))
      s = useFloatingPanelState.getState()
      expect(s.position).toEqual(anchor)
      expect(s.isAutoRepositioning).toBe(true)

      // Phase 3: wait past the 450ms clear window. The clear is owned by
      // the store action (not by any component), so it fires even with no
      // FloatingOlumiPanel mounted in this unit test environment.
      await new Promise((r) => setTimeout(r, 500))
      s = useFloatingPanelState.getState()
      expect(s.isAutoRepositioning).toBe(false)
      // Position remains at the anchor — the clear only touches the flag.
      expect(s.position).toEqual(anchor)
    } finally {
      window.requestAnimationFrame = originalRaf
    }
  }, 10_000)
})

describe('canAutoDock', () => {
  it('returns true for system-first-use + not repositioned', () => {
    expect(canAutoDock({ source: 'system-first-use', userRepositioned: false })).toBe(true)
  })

  it('returns false when user opened (source=user)', () => {
    expect(canAutoDock({ source: 'user', userRepositioned: false })).toBe(false)
  })

  it('returns false when user has dragged/resized (userRepositioned=true)', () => {
    expect(canAutoDock({ source: 'system-first-use', userRepositioned: true })).toBe(false)
  })

  it('returns false when both conditions fail', () => {
    expect(canAutoDock({ source: 'user', userRepositioned: true })).toBe(false)
  })
})
