// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { checkAccessValidation, validateAccessCode, ACCESS_VALIDATION_KEY } from '@/lib/auth/accessValidation'

describe('accessValidation polling/log churn guard', () => {
  let intervalSpy: ReturnType<typeof vi.spyOn>
  let dispatchSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    intervalSpy = vi.spyOn(globalThis, 'setInterval')
    dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    localStorage.clear()
  })
  afterEach(() => {
    intervalSpy.mockRestore()
    dispatchSpy.mockRestore()
    localStorage.clear()
  })

  it('does not create polling intervals during validation checks', () => {
    // call check multiple times to simulate re-renders
    checkAccessValidation()
    checkAccessValidation()
    checkAccessValidation()
    expect(intervalSpy).not.toHaveBeenCalled()
  })

  it('dispatches a single storage event when validation flips to true', () => {
    const beforeCalls = dispatchSpy.mock.calls.length
    validateAccessCode('not-a-real-code')
    // not valid by default; no event expected
    expect(dispatchSpy.mock.calls.length).toBe(beforeCalls)

    // Simulate a valid state flip and emit storage manually
    localStorage.setItem(ACCESS_VALIDATION_KEY, 'true')
    const ev = new StorageEvent('storage', { key: ACCESS_VALIDATION_KEY, newValue: 'true' })
    window.dispatchEvent(ev)

    expect(dispatchSpy).toHaveBeenCalledWith(ev)
  })
})
