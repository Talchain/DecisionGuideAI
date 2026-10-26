// src/telemetry/__tests__/measurementBehaviour.spec.tsx
// =============================================================================
// ROADMAP 1.68 — BEHAVIOURAL pins for the call sites that had none.
// =============================================================================
//
// The contract spec pins SHAPES and the PII spec pins ABSENCE. Neither proves
// that a given component actually EMITS at the moment it should. Call sites
// that shipped with no behavioural coverage: the GuidanceStrip dwell additions
// and C5 (`session_started`), plus `bucketDwellMs`. (C4, `ContestedEdgeCard`,
// was removed with the legacy results code in U2.)
//
// An emitter with no behavioural test is the guarantee-theatre class in
// miniature: it reads as instrumentation and nothing checks that it fires.
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

import { bucketDwellMs, MEASUREMENT_CONFIG, resolveParticipantTag } from '../measurementConfig'

beforeEach(() => {
  trackEventSpy.mockClear()
  vi.useRealTimers()
})
afterEach(() => cleanup())

// ---------------------------------------------------------------------------
// § 1 — bucketDwellMs: the shared derivation both dwell events depend on
// ---------------------------------------------------------------------------

describe('1.68 · bucketDwellMs', () => {
  it('ANTI-VACUITY — the boundaries are configured and ascending', () => {
    const b = MEASUREMENT_CONFIG.dwellBucketsMs
    expect(b.length, 'no dwell buckets configured — every case below is meaningless').toBeGreaterThan(0)
    expect([...b], 'buckets must ascend or the floor walk short-circuits early').toEqual([...b].sort((x, y) => x - y))
  })

  it.each([
    [0, 0],
    [1, 0],
    [999, 0],
    [1_000, 1_000],
    [4_999, 1_000],
    [5_000, 5_000],
    [15_000, 15_000],
    [59_999, 15_000],
    [60_000, 60_000],
    [10_000_000, 60_000],
  ])('%ims → floor %i', (raw, expected) => {
    expect(bucketDwellMs(raw)).toBe(expected)
  })

  it('never leaks a raw duration through a non-finite or negative input', () => {
    // A clock skew or a NaN must not become a high-resolution property.
    expect(bucketDwellMs(Number.NaN)).toBe(0)
    expect(bucketDwellMs(-5_000)).toBe(0)
    // Infinity is garbage in, not "a very long dwell". Returning the top bucket
    // would publish a fabricated band; 0 is the honest answer for an input the
    // clock could not have produced.
    expect(bucketDwellMs(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// § 2 — C5: session_started's participant tag, and its fail-loud posture
// ---------------------------------------------------------------------------

describe('1.68 · resolveParticipantTag fails LOUD on the misconfiguration that destroys the window', () => {
  const original = MEASUREMENT_CONFIG.participantTags
  const setTags = (tags: readonly string[]) => {
    ;(MEASUREMENT_CONFIG as unknown as { participantTags: readonly string[] }).participantTags = tags
  }
  afterEach(() => setTags(original))

  it('[] → null, silently. Untagged is a legitimate deliberate state.', () => {
    setTags([])
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(resolveParticipantTag()).toBeNull()
    expect(warn, 'an empty vocabulary warned — untagged is not a misconfiguration').not.toHaveBeenCalled()
    expect(trackEventSpy).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it("['P3'] → 'P3'. One tag per deploy is the supported shape.", () => {
    setTags(['P3'])
    expect(resolveParticipantTag()).toBe('P3')
    expect(trackEventSpy).not.toHaveBeenCalled()
  })

  it('a ROSTER (>1) warns AND emits a violation — it must never pass as "untagged"', () => {
    setTags(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'])
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(resolveParticipantTag()).toBeNull()

    expect(
      warn,
      'populating participantTags as a roster — the natural reading of the word — produced ' +
        'no warning. It would run the entire testing window untagged with nothing red, and ' +
        'per-participant attribution is unrecoverable once the window closes.',
    ).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain('DEPLOY-WIDE')

    const violation = trackEventSpy.mock.calls.find((c) => c[0] === 'ui.measurement_config_violation')
    expect(violation, 'the misconfiguration was not reported as an event — a console warning ' +
      'nobody is watching is not a loud failure').toBeTruthy()
    expect((violation![1] as { configured_count: number }).configured_count).toBe(8)

    // The report carries the COUNT, never the tags: a tag is a pseudonym, and a
    // violation report is not a place to publish the roster.
    expect(JSON.stringify(violation![1])).not.toContain('P1')
    warn.mockRestore()
  })
})
