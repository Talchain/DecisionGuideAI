/**
 * modeFocusTrace — the diagnostic must be readable, bounded, safe and SILENT
 * about what the user typed.
 *
 * The defect it exists to catch repairs itself the moment anyone opens
 * devtools, so this channel is the only instrument that can see it. That makes
 * three properties load-bearing:
 *   · it RECORDS the answer (which element held focus, and whether the guard
 *     swallowed the gesture);
 *   · it NEVER leaks composer contents into a ring a support thread may quote;
 *   · it NEVER throws, because a diagnostic that breaks the surface it is
 *     diagnosing is worse than none.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  traceModeGesture,
  describeFocusTarget,
  isModeRelevantKey,
  __resetModeFocusTraceForTests,
} from '../modeFocusTrace'

type Ring = { logs: Array<{ m: string; data?: Record<string, unknown> }> }
const ring = () => (window as unknown as { __SAFE_DEBUG__?: Ring }).__SAFE_DEBUG__
const entries = () => (ring()?.logs ?? []).filter((l) => l.m === 'canvas:trace:mode-focus')

beforeEach(() => {
  ;(window as unknown as { __SAFE_DEBUG__?: Ring }).__SAFE_DEBUG__ = { logs: [] }
  __resetModeFocusTraceForTests()
  document.body.innerHTML = ''
})

describe('what it records', () => {
  it('names the focused element and whether the gesture was swallowed', () => {
    const ta = document.createElement('textarea')
    ta.setAttribute('data-testid', 'ai-input-bar-docked-textarea')
    document.body.appendChild(ta)
    ta.focus()

    traceModeGesture('keydown', { key: 'h', swallowed: true, target: ta })

    const [e] = entries()
    expect(e).toBeDefined()
    const active = e.data?.activeElement as Record<string, unknown>
    expect(active.tag).toBe('TEXTAREA')
    expect(active.testId).toBe('ai-input-bar-docked-textarea')
    expect(active.isTextEntry).toBe(true)
    expect(e.data?.swallowed).toBe(true)
    expect(e.data?.key).toBe('h')
  })

  it('records the container class so mode and focus can be read together', () => {
    const d = document.createElement('div')
    d.className = 'canvas-mode-hand'
    document.body.appendChild(d)
    traceModeGesture('canvas-pointerdown', { swallowed: false })
    expect(entries()[0].data?.containerClass).toBe('canvas-mode-hand')
  })
})

describe('what it must never record', () => {
  it('never captures the value or text of a focused field', () => {
    const ta = document.createElement('textarea')
    ta.value = 'my confidential decision brief'
    document.body.appendChild(ta)
    ta.focus()

    traceModeGesture('keydown', { key: 'v', swallowed: true, target: ta })

    const blob = JSON.stringify(entries())
    expect(blob).not.toContain('confidential')
    expect(blob).not.toContain('my confidential decision brief')
  })

  it('describeFocusTarget exposes no content-bearing field', () => {
    const ta = document.createElement('textarea')
    ta.value = 'secret'
    ta.textContent = 'secret'
    const described = describeFocusTarget(ta)
    expect(Object.keys(described).sort()).toEqual(
      ['cls', 'id', 'isTextEntry', 'present', 'tag', 'testId'].sort(),
    )
  })
})

describe('bounded and unbreakable', () => {
  it('stops recording after the opening gestures, rather than filling the ring', () => {
    for (let i = 0; i < 50; i++) traceModeGesture('keydown', { key: 'h', swallowed: false })
    expect(entries().length).toBe(16)
  })

  it('never throws when the ring is missing or hostile', () => {
    ;(window as unknown as { __SAFE_DEBUG__?: unknown }).__SAFE_DEBUG__ = undefined
    expect(() => traceModeGesture('keydown', { key: 'h' })).not.toThrow()
    ;(window as unknown as { __SAFE_DEBUG__?: unknown }).__SAFE_DEBUG__ = { logs: 'not-an-array' }
    expect(() => traceModeGesture('keydown', { key: 'h' })).not.toThrow()
  })

  it('handles a null target without throwing', () => {
    expect(() => traceModeGesture('keydown', { target: null })).not.toThrow()
    expect(describeFocusTarget(null)).toEqual({ present: false })
  })
})

describe('the key filter', () => {
  it('covers exactly the mode gestures and Escape', () => {
    for (const k of ['v', 'V', 'h', 'H', 'Escape']) expect(isModeRelevantKey(k)).toBe(true)
    for (const k of ['a', 'Delete', 'ArrowLeft', 'z', ' ']) expect(isModeRelevantKey(k)).toBe(false)
  })
})
