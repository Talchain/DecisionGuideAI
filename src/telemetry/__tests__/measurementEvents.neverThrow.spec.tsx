// src/telemetry/__tests__/measurementEvents.neverThrow.spec.tsx
// =============================================================================
// ROADMAP 1.68 — trackMeasurement must NEVER throw, proven from the site where
// a throw would do real damage.
// =============================================================================
//
// THE DEFECT
// ----------
// `trackMeasurement`'s own doc comment said *"telemetry must never break the
// product"* while the function was UNGUARDED. The measurement design had
// explicitly promised the deleted `metrics.ts`'s never-throw wrapper would
// reappear in the new schema module; it did not. A promise in a comment is not
// a guard.
//
// Its unmount-path row went with `ContestedEdgeCard` (U2, legacy results
// code removed); the direct-call rows remain.
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

const trackEventSpy = vi.fn()
vi.mock('../../lib/posthog', () => ({
  trackEvent: (...args: unknown[]) => trackEventSpy(...args),
  initPostHog: vi.fn(),
  identifyUser: vi.fn(),
  resetPostHog: vi.fn(),
}))

import { trackMeasurement } from '../measurementEvents'

const BOOM = 'posthog SDK exploded'

beforeEach(() => trackEventSpy.mockReset())

// ⚠ DISARM THE THROWING TRANSPORT BEFORE TEARDOWN.
//
// Every test here installs a mock that throws on EVERY call, and the global
// teardown in `tests/setup/rtl.ts` runs `cleanup()` — which unmounts whatever
// is still mounted and therefore re-enters the emit path. Leaving the throwing
// implementation installed makes a teardown-time throw surface as a failure of
// the test that armed it, which reads as "the never-throw guard does not work"
// when the guard is fine. File-local afterEach hooks run BEFORE the setup
// file's, so disarming here is what makes the teardown honest.
afterEach(() => {
  trackEventSpy.mockReset()
  cleanup()
})

describe('1.68 · trackMeasurement never throws', () => {
  it('POSITIVE CONTROL — the injected failure really does throw', () => {
    // Trap 13: if the mock did not actually throw, every "did not throw"
    // assertion below would pass by testing nothing.
    trackEventSpy.mockImplementation(() => {
      throw new Error(BOOM)
    })
    expect(() => trackEventSpy('x')).toThrow(BOOM)
  })

  it('a throwing transport does not propagate out of a direct call', () => {
    trackEventSpy.mockImplementation(() => {
      throw new Error(BOOM)
    })
    expect(() =>
      trackMeasurement('turn_feedback', { rating: 'up', scenario_id: 'sc-1' }),
    ).not.toThrow()
  })

  it('a throw in the VIOLATION report does not suppress the event either', () => {
    // The violation path runs first. If it threw and were unguarded, an
    // undeclared property would silently cost the real event too.
    let calls = 0
    trackEventSpy.mockImplementation((name: string) => {
      calls += 1
      if (name === 'ui.measurement_schema_violation') throw new Error(BOOM)
    })
    expect(() =>
      // @ts-expect-error deliberately undeclared property
      trackMeasurement('turn_feedback', { rating: 'up', scenario_id: 'sc-1', assistant_text: 'x' }),
    ).not.toThrow()
    expect(calls, 'the violation report was never attempted').toBeGreaterThan(0)
  })
})
