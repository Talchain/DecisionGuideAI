// src/lib/__tests__/resultsInstrumentationRoute.spec.ts
// =============================================================================
// ROADMAP 2.150 · S4 — the RE-ROUTE pin, and the negative control that would
// have caught the defect years ago.
// =============================================================================
//
// THE DEFECT
// ----------
// Every sender in `src/lib/resultsInstrumentation.ts` used to read
// `(window as any).posthog` and fire only `if (posthog?.capture)`.
// `window.posthog` NEVER EXISTS on this app — proven at the bytes:
//
//   * `posthog-js@1.369.1` has no `exports` map, so Vite (browser ESM) resolves
//     `dist/module.js`, which contains ZERO assignments to any `.posthog`
//     property and zero `init_from_snippet`.
//     POSITIVE CONTROL: the same grep on the *snippet* build
//     `dist/array.full.js` DOES match (`…Yn.posthog=rm…`), so the search can
//     see a presence before reporting an absence.
//   * `src/` never assigns `window.posthog`, and `index.html` loads no PostHog
//     snippet.
//
// So the whole run-lifecycle spine — `run_started`, `run_completed`,
// `run_failed`, `compare_opened`, `retry_clicked`, `remediation_clicked`,
// `cta_clicked`, `plot.empty_computed_results` — was wired into live product
// code (`OutputsDock.tsx`, `useV2Run.ts`) and could never fire. Guarantee
// theatre: machinery that reads as working telemetry and never executes.
//
// WHAT THIS SPEC CLAIMS — two different claim types, deliberately
// ---------------------------------------------------------------
//   1. POSITIVE: each sender reaches the IMPORTED `trackEvent` from
//      `src/lib/posthog.ts` (the only module that calls `posthog.init`), with
//      its event name and payload unchanged.
//   2. NEGATIVE CONTROL: with a fake `window.posthog = { capture: spy }`
//      installed — i.e. the one world in which the OLD code would have looked
//      alive — that spy is NEVER called. This is the assertion whose absence
//      let the defect live. A green positive test alone does not exclude a
//      module that ALSO still sniffs the global.
//
// The sender list is DERIVED from the module's own exports (trap 12: derive,
// don't mirror). A newly-added `track*` export with no entry in ARGS reds this
// spec by name rather than slipping through uninstrumented.
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const trackEventSpy = vi.fn()
vi.mock('../posthog', () => ({
  trackEvent: (...args: unknown[]) => trackEventSpy(...args),
}))

const captureMessageSpy = vi.fn()
vi.mock('@sentry/react', () => ({
  captureMessage: (...args: unknown[]) => captureMessageSpy(...args),
}))

import * as instrumentation from '../resultsInstrumentation'

/**
 * Synthetic arguments per sender. The KEYS are checked against the module's
 * derived export list below, so this table cannot silently fall behind.
 */
const ARGS: Record<string, unknown[]> = {
  trackRunStarted: [{ option_count: 3, node_count: 9, edge_count: 12 }],
  trackRunCompleted: [{ confidence_level: 'high', drivers_informative: true, duration_ms: 1234 }],
  trackRunFailed: [{ error_code: 'E_TIMEOUT' }],
  trackEmptyComputedResults: [{ anomalies: [{ field: 'drivers', status: 'empty', message: 'none' }] }],
}

/** The expected event NAME per sender — the transport changed, the taxonomy did not. */
const EVENT_NAMES: Record<string, string> = {
  trackRunStarted: 'run_started',
  trackRunCompleted: 'run_completed',
  trackRunFailed: 'run_failed',
  trackEmptyComputedResults: 'plot.empty_computed_results',
}

const SENDERS = Object.keys(instrumentation)
  .filter((k) => k.startsWith('track'))
  .sort()

/**
 * The count after the ROADMAP 1.68 review pass. It was 8; it is now 4, and the
 * reduction is DELIBERATE — recorded here because the assertion below asks for
 * exactly that justification rather than a silent edit:
 *
 *   · trackRetryClicked, trackRemediationClicked, trackCTAClicked — DELETED.
 *     Zero product call sites repo-wide. Dead exports that read as
 *     instrumentation are the defect this module exists to remove, not a
 *     placeholder to keep warm.
 *   · trackCompareOpened — MOVED to canvas/utils/sandboxTelemetry.ts, which is
 *     where the real compare-open actions already call a same-named twin
 *     (OutputsDock.tsx:1698, CompactOptionSpread.tsx:86). Two same-named
 *     senders with different sinks is the hazard; one function driving both
 *     sinks is the fix. Pinned by runSpineSingleEmission.spec.ts.
 *
 * A walker that sees fewer than 4 has BROKEN, not shrunk.
 */
const EXPECTED_SENDER_FLOOR = 4

let fakeGlobalCapture: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  trackEventSpy.mockClear()
  captureMessageSpy.mockClear()
  // THE NEGATIVE CONTROL'S WORLD: install the global the old code sniffed for.
  fakeGlobalCapture = vi.fn()
  ;(window as unknown as Record<string, unknown>).posthog = { capture: fakeGlobalCapture }
  ;(window as unknown as Record<string, unknown>).Sentry = { captureMessage: vi.fn() }
})

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).posthog
  delete (window as unknown as Record<string, unknown>).Sentry
})

describe('2.150 · resultsInstrumentation routes through the imported trackEvent', () => {
  it('ANTI-VACUITY — the derived sender list is not empty and has not shrunk', () => {
    expect(
      SENDERS.length,
      'the export walk found fewer track* senders than existed at tip 4709d4f0 — ' +
        'either senders were deleted (say so deliberately) or this derivation has broken ' +
        'and every per-sender assertion below is running over nothing',
    ).toBeGreaterThanOrEqual(EXPECTED_SENDER_FLOOR)
    // Every derived sender must have a synthetic-args entry — a new sender with
    // no entry is an UNTESTED sender, and must fail loudly rather than pass.
    const missing = SENDERS.filter((s) => !(s in ARGS) || !(s in EVENT_NAMES))
    expect(
      missing,
      'these senders exist in resultsInstrumentation.ts but have no entry in this ' +
        'spec\'s ARGS/EVENT_NAMES table — add one rather than letting them go unpinned',
    ).toEqual([])
  })

  for (const sender of SENDERS) {
    it(`${sender} reaches the IMPORTED trackEvent`, () => {
      const fn = (instrumentation as unknown as Record<string, (...a: unknown[]) => void>)[sender]
      fn(...(ARGS[sender] ?? []))

      expect(
        trackEventSpy,
        `${sender} did not call the imported trackEvent — it is still dark, exactly as ` +
          'it was when it sniffed window.posthog',
      ).toHaveBeenCalledTimes(1)
      expect(trackEventSpy.mock.calls[0][0]).toBe(EVENT_NAMES[sender])
    })

    it(`${sender} NEVER touches window.posthog (negative control)`, () => {
      const fn = (instrumentation as unknown as Record<string, (...a: unknown[]) => void>)[sender]
      fn(...(ARGS[sender] ?? []))

      // Precondition: the control world is real. Without this, "the fake was
      // never called" could be true because the fake was never installed.
      expect(
        (window as unknown as { posthog?: { capture?: unknown } }).posthog?.capture,
        'the fake window.posthog was not installed — the negative assertion below ' +
          'would pass by testing nothing',
      ).toBe(fakeGlobalCapture)

      expect(
        fakeGlobalCapture,
        `${sender} called window.posthog.capture. That global does not exist on the ` +
          'real app (posthog-js resolves dist/module.js, which never assigns it), so a ' +
          'sender that still reads it is a sender that never fires in production.',
      ).not.toHaveBeenCalled()
    })
  }

  it('payload shape is carried through unchanged — this was a transport fix, not a taxonomy change', () => {
    instrumentation.trackRunStarted({ option_count: 3, node_count: 9, edge_count: 12 })
    expect(trackEventSpy).toHaveBeenCalledWith('run_started', {
      option_count: 3,
      node_count: 9,
      edge_count: 12,
    })
  })

  it('the two Sentry sites use the IMPORTED captureMessage, not window.Sentry', () => {
    const fakeGlobalSentry = vi.fn()
    ;(window as unknown as Record<string, unknown>).Sentry = { captureMessage: fakeGlobalSentry }

    instrumentation.trackRunFailed({ error_code: 'E_TIMEOUT' })
    instrumentation.trackEmptyComputedResults({ anomalies: [] })

    expect(
      captureMessageSpy,
      'neither Sentry site reached the imported @sentry/react captureMessage — the ' +
        'channel src/lib/monitoring.ts already uses correctly',
    ).toHaveBeenCalledTimes(2)
    expect(
      fakeGlobalSentry,
      'a Sentry site still sniffs window.Sentry — nothing in src/ ever assigns it',
    ).not.toHaveBeenCalled()
  })
})
