/**
 * The PII leak detector, and the PLANTED CONTROL that proves it can see a leak.
 *
 * ⭐ WHY THIS IS A SHARED MODULE RATHER THAN A COPY IN EACH SPEC.
 * `measurementEvents.pii.spec.tsx` used to hold the detector, its canary and its
 * planted control inline. The render-driven arm of that file drives
 * `analysis-hero/HeroEvidenceDisclosure`, and `analysis-hero/__tests__/
 * inertness.spec.ts` — a LIVE MOUNT GUARD — permits exactly two importers of
 * that module repo-wide. The honest fix is to move the hero arm INSIDE the
 * module (where the import is legitimate), not to widen a live guard to suit a
 * test. That split left two spec files needing the same detector.
 *
 * Two copies of a leak detector is the hand-maintained mirror (CLAUDE.md trap
 * 12) applied to the one instrument the PII guarantee rests on: the copies drift,
 * the drift reads as green, and a weakened copy still reports an absence. So the
 * detector, the canary string and the control live here, once.
 *
 * ⚠ THIS IS NOT A SPEC FILE and must never become one: vitest's include glob
 * collects only basenames ending in `.test.*` or `.spec.*`, and this basename
 * deliberately ends in neither. It nonetheless REGISTERS tests, via
 * `registerLeakDetectorPlantedControl`, so that every spec that consumes the
 * detector also runs its control.
 *
 * WHY A PLANTED CONTROL IS MANDATORY (kept verbatim from the original header,
 * because it is the reason the shape of this module is what it is):
 * The defect this programme catches most often is the vacuous absence
 * assertion. A PLoT lane's first real-server leak test captured 0 BYTES (pino
 * writes to fd 1 via sonic-boom), so every "no raw value present" assertion
 * passed by testing nothing, forever, while reading as a guarantee.
 *
 * Hence: `assertNoCanary` is a FUNCTION, not an inline assertion, so it can be
 * pointed at a deliberately-leaking payload and PROVEN to throw. That is the
 * planted control, and it runs on every CI pass — not once, by hand, in a PR
 * body that nobody re-reads.
 */
import { describe, it, expect } from 'vitest'
import { trackMeasurement } from '../../measurementEvents'

export const CANARY = 'PII_CANARY_do_not_ship_7f3a'

/**
 * THE DETECTOR. A function, deliberately — so the planted control below can
 * point it at a leak and prove it throws. An inline `expect` cannot be tested.
 *
 * Throws when the canary appears anywhere in any captured payload, at any
 * depth, including inside arrays and nested objects (JSON.stringify walks the
 * whole tree — a leak nested two levels deep is still a leak).
 */
export function assertNoCanary(calls: unknown[][]): void {
  const offenders: string[] = []
  for (const [name, props] of calls) {
    const serialised = JSON.stringify(props ?? {})
    if (serialised.includes(CANARY)) offenders.push(`${String(name)} → ${serialised}`)
  }
  if (offenders.length > 0) {
    throw new Error(
      `USER-AUTHORED CONTENT REACHED A TELEMETRY PAYLOAD. ${offenders.length} event(s):\n` +
        offenders.join('\n') +
        '\nEvery name on measurementEvents.ts\'s never-capture list is a real field at ' +
        'the tip, reachable from an instrumented surface. This is what that list is for.',
    )
  }
}

/**
 * Register THE PLANTED CONTROL into the calling spec file.
 *
 * ⚠ EVERY spec that calls `assertNoCanary` must call this too, and call it
 * FIRST, so the control runs before the absence assertions it licenses. The
 * control is per-file rather than global on purpose: it proves the detector can
 * see a leak *through this file's own transport wiring* (its `vi.mock` of
 * `lib/posthog`, its spy, its `beforeEach`). A control that ran once in some
 * other file would say nothing about a spec whose spy was never connected — and
 * a disconnected spy is exactly the 0-byte-capture failure mode.
 *
 * @param getCalls reads the calling file's captured transport calls, lazily —
 *   the spy is cleared per test, so this must be a getter and not an array.
 */
export function registerLeakDetectorPlantedControl(getCalls: () => unknown[][]): void {
  describe('1.68 · S2 PLANTED CONTROL — the detector can SEE a leak', () => {
    it('a deliberately-leaking payload makes assertNoCanary THROW', () => {
      // The realistic accident, not a strawman: `rank1_factor_id` is declared, so
      // it survives trackMeasurement's schema validation — and the resolve-next
      // surface renders BOTH `row.factorId` and `row.label` two lines apart. A
      // developer reaching for the wrong one produces exactly this payload, and
      // it typechecks.
      trackMeasurement('evidence_view_opened', {
        view: 'resolveNext',
        scenario_id: 'sc-1',
        gated: false,
        rank1_factor_id: `${CANARY} rank one`,
      })

      expect(
        () => assertNoCanary(getCalls()),
        'the leak detector did NOT throw on a payload that demonstrably contains the ' +
          'canary. Every absence assertion in this file is therefore vacuous — this is ' +
          'the 0-byte-capture failure mode, and it is why this control exists.',
      ).toThrow(/USER-AUTHORED CONTENT REACHED A TELEMETRY PAYLOAD/)
    })

    it('a leak NESTED inside an array or object is still caught', () => {
      // Guards the detector's own reach, not the product's: a shallow key scan
      // would miss this, and a future refactor to a shallow scan must red here.
      expect(() =>
        assertNoCanary([['some_event', { rows: [{ meta: { label: CANARY } }] }]]),
      ).toThrow(/USER-AUTHORED CONTENT REACHED/)
    })

    it('a clean payload does NOT throw (the detector is not simply always-red)', () => {
      expect(() => assertNoCanary([['some_event', { scenario_id: 'sc-1', ranked_count: 2 }]])).not.toThrow()
    })
  })
}
