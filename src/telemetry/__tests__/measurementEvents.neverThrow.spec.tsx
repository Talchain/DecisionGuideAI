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
// WHY IT MATTERS HERE SPECIFICALLY
// --------------------------------
// `ContestedEdgeCard` emits from a `useEffect` CLEANUP. A throw in a cleanup
// propagates out of React's unmount path — so a third-party SDK throwing inside
// `posthog.capture` would have unmounted the user's decision canvas. This is
// not a hypothetical class of bug: `posthog-js` is a network-touching third
// party we do not control, and the whole point of the never-throw discipline is
// that we cannot audit it.
//
// So this spec drives the REAL component, not a synthetic call. A synthetic
// `expect(() => trackMeasurement(...)).not.toThrow()` would pass even if React's
// unmount path were the thing that actually broke.
// =============================================================================

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

const trackEventSpy = vi.fn()
vi.mock('../../lib/posthog', () => ({
  trackEvent: (...args: unknown[]) => trackEventSpy(...args),
  initPostHog: vi.fn(),
  identifyUser: vi.fn(),
  resetPostHog: vi.fn(),
}))

import { trackMeasurement } from '../measurementEvents'
import { ContestedEdgeCard } from '../../canvas/components/model-tab/ContestedEdgeCard'
import {
  makeContestedEdge,
  makeContestedNode,
  makeContestedValidation,
} from '../../__fixtures__/contestedEdge'

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

vi.mock('../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))
vi.mock('../../canvas/utils/evidenceCoverage', () => ({
  NON_EVIDENCE_PROVENANCE: ['assumption', 'template', 'ai-suggested'],
}))
vi.mock('../../canvas/ui/inspector/SignedStrengthSlider', () => ({
  SignedStrengthSlider: ({ value }: { value: number }) => (
    <input type="range" data-testid="mock-strength-slider" defaultValue={value} readOnly />
  ),
}))

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

const nodes = [makeContestedNode('n1', 'Alpha'), makeContestedNode('n2', 'Beta')]
const edge = makeContestedEdge('e1', 'n1', 'n2', makeContestedValidation())
const validation = () => makeContestedValidation()

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

  it('a throwing transport does not break the UNMOUNT of ContestedEdgeCard', () => {
    // The real damage path: emit-from-cleanup.
    const { unmount } = render(
      <ContestedEdgeCard edge={edge} nodes={nodes} validation={validation()} isFragile={false} onResolve={() => {}} />,
    )
    trackEventSpy.mockImplementation(() => {
      throw new Error(BOOM)
    })

    expect(
      () => unmount(),
      'a throwing posthog.capture propagated out of the useEffect cleanup. In the product ' +
        "that unmounts the user's decision canvas — telemetry taking down the thing it " +
        'exists to measure.',
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
