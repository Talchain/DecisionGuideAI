import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ASSISTANT_FOCUS_DEFAULT_DURATION_MS,
  activateAssistantFocus,
  dismissAssistantFocus,
  normaliseAssistantFocusDuration,
  useAssistantFocusStore,
} from '../assistantFocusStore'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-15T01:00:00Z'))
  dismissAssistantFocus()
})

afterEach(() => {
  dismissAssistantFocus()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('assistantFocusStore — independent bounded lifetime', () => {
  it('uses the bounded default and expires without touching another store', () => {
    activateAssistantFocus({ id: 'n1', kind: 'node', label: 'Demand' })
    const target = useAssistantFocusStore.getState().target
    expect(target).toMatchObject({ id: 'n1', kind: 'node', label: 'Demand' })
    expect(target?.expiresAt).toBe(Date.now() + ASSISTANT_FOCUS_DEFAULT_DURATION_MS)

    vi.advanceTimersByTime(ASSISTANT_FOCUS_DEFAULT_DURATION_MS - 1)
    expect(useAssistantFocusStore.getState().target?.id).toBe('n1')
    vi.advanceTimersByTime(1)
    expect(useAssistantFocusStore.getState().target).toBeNull()
  })

  it('identity swap: an old queued expiry cannot clear the newer focus', () => {
    const queued: Array<() => void> = []
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: TimerHandler) => {
      queued.push(callback as () => void)
      return queued.length as unknown as ReturnType<typeof setTimeout>
    }) as unknown as typeof setTimeout)
    // Model the hard race: cancellation has no effect because the old callback
    // is already queued at the event-loop boundary.
    vi.spyOn(globalThis, 'clearTimeout').mockImplementation(() => undefined)

    activateAssistantFocus({ id: 'node-a', kind: 'node', label: 'A', durationMs: 500 })
    activateAssistantFocus({ id: 'node-b', kind: 'node', label: 'B', durationMs: 10_000 })
    expect(queued).toHaveLength(2)

    queued[0]!()
    expect(useAssistantFocusStore.getState().target?.id).toBe('node-b')
    queued[1]!()
    expect(useAssistantFocusStore.getState().target).toBeNull()
  })

  it('defensively clamps bypass callers to the published 500–10,000 ms bounds', () => {
    expect(normaliseAssistantFocusDuration(-50)).toBe(500)
    expect(normaliseAssistantFocusDuration(801.6)).toBe(802)
    expect(normaliseAssistantFocusDuration(90_000)).toBe(10_000)
    expect(normaliseAssistantFocusDuration(Number.NaN)).toBe(10_000)
  })

  it('is session-memory only: activation writes neither local nor session storage', () => {
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
    activateAssistantFocus({ id: 'n1', kind: 'node', label: 'Demand' })
    expect(storageWrite).not.toHaveBeenCalled()
  })
})
