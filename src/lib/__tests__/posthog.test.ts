import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    capture: vi.fn(),
  },
}))

import posthog from 'posthog-js'
import { initPostHog, identifyUser, resetPostHog, trackEvent } from '../posthog'

describe('posthog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initPostHog does nothing without VITE_POSTHOG_KEY', () => {
    initPostHog()
    expect(posthog.init).not.toHaveBeenCalled()
  })

  it('identifyUser does nothing when not initialised', () => {
    identifyUser('u1', 'a@b.com')
    expect(posthog.identify).not.toHaveBeenCalled()
  })

  it('resetPostHog does nothing when not initialised', () => {
    resetPostHog()
    expect(posthog.reset).not.toHaveBeenCalled()
  })

  it('trackEvent does nothing when not initialised', () => {
    trackEvent('test_event', { key: 'val' })
    expect(posthog.capture).not.toHaveBeenCalled()
  })
})
