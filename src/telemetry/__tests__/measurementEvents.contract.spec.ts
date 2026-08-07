// src/telemetry/__tests__/measurementEvents.contract.spec.ts
// =============================================================================
// ROADMAP 1.68 · S1 — the EVENT-SHAPE CONTRACT.
// =============================================================================
//
// WHAT IT CLAIMS
// --------------
// For every declared measurement event, the property set that reaches
// `trackEvent` EQUALS the declared schema's key set. Extras fail — not just
// missing ones. An extra property is the failure mode that matters here: the
// never-capture list in `measurementEvents.ts` names real fields that sit one
// careless spread away from an instrumented surface, and a schema that only
// checks for MISSING keys cannot see a leak.
//
// HOW THE TABLE IS BUILT — derived, never hand-listed
// --------------------------------------------------
// Every case below is generated from `MEASUREMENT_EVENT_SCHEMAS` itself: the
// module is the source of truth. A hand-listed table in this file would be the
// hand-maintained mirror (CLAUDE.md trap 12) that this programme keeps getting
// caught by — it would go stale the first time an event is added, and it would
// go stale GREEN.
//
// The interface↔schema tie-down is not repeated here because it is enforced at
// COMPILE time in `measurementEvents.ts` § 4 (`_AssertKeysMatch`,
// `_AssertRequiredMatch`). That is strictly stronger than a runtime check: it
// cannot be reached by a code path that happens not to run.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

const trackEventSpy = vi.fn()
vi.mock('../../lib/posthog', () => ({
  trackEvent: (...args: unknown[]) => trackEventSpy(...args),
}))

import {
  MEASUREMENT_EVENTS,
  MEASUREMENT_EVENT_SCHEMAS,
  MEASUREMENT_SCHEMA_VIOLATION_EVENT,
  trackMeasurement,
  type MeasurementEventName,
} from '../measurementEvents'

/**
 * ANTI-VACUITY FLOOR. The count of declared events at tip 4709d4f0 is 4
 * (evidence_view_opened, contested_edge_viewed, session_started,
 * turn_feedback). If the derivation ever sees fewer, it has BROKEN — and a
 * broken derivation would report green from an empty scan, which is the exact
 * pattern `scripts/ci/assert-bundle-env-allowlist.mjs` guards against in its
 * own walker. Raise this when events are added; never lower it silently.
 */
const DECLARED_EVENT_FLOOR = 4

const EVENT_NAMES = Object.keys(MEASUREMENT_EVENT_SCHEMAS) as MeasurementEventName[]

/**
 * Build a payload from the SCHEMA, not from a hand-written fixture — so a new
 * property is exercised the moment it is declared. Values are deliberately
 * type-shaped rather than type-correct; this spec pins the KEY SET, and the
 * value types are pinned at compile time by the interfaces.
 */
function payloadFromSchema(event: MeasurementEventName, includeOptional: boolean): Record<string, unknown> {
  const schema = MEASUREMENT_EVENT_SCHEMAS[event]
  const keys = includeOptional ? [...schema.required, ...schema.optional] : [...schema.required]
  const out: Record<string, unknown> = {}
  for (const key of keys) out[key] = `synthetic:${key}`
  return out
}

beforeEach(() => {
  trackEventSpy.mockClear()
})

describe('1.68 · measurement event-shape contract (derived from the module)', () => {
  it('ANTI-VACUITY — the derivation sees the declared events, and never zero', () => {
    expect(
      EVENT_NAMES.length,
      'the schema walk found fewer declared events than existed at tip 4709d4f0. ' +
        'Either events were deleted deliberately (raise/lower this floor in the same ' +
        'commit and say why) or this derivation has broken — in which case every ' +
        'per-event assertion below is running over an empty table and passing vacuously.',
    ).toBeGreaterThanOrEqual(DECLARED_EVENT_FLOOR)

    // The name CONSTANTS and the SCHEMA keys must be the same set. This is the
    // control that a renamed constant reds (see PR body control 2).
    expect(
      [...Object.values(MEASUREMENT_EVENTS)].sort(),
      'MEASUREMENT_EVENTS and MEASUREMENT_EVENT_SCHEMAS disagree about which events ' +
        'exist. A constant renamed without its schema entry produces an event nothing ' +
        'validates; a schema entry with no constant produces a schema nothing emits.',
    ).toEqual([...EVENT_NAMES].sort())
  })

  for (const event of EVENT_NAMES) {
    it(`${event} — emitted keys EQUAL the declared key set (required only)`, () => {
      trackMeasurement(event, payloadFromSchema(event, false) as never)

      expect(trackEventSpy, `${event} did not reach trackEvent at all`).toHaveBeenCalledTimes(1)
      const [name, props] = trackEventSpy.mock.calls[0]
      expect(name).toBe(event)
      expect(Object.keys(props as object).sort()).toEqual([...MEASUREMENT_EVENT_SCHEMAS[event].required].sort())
    })

    it(`${event} — emitted keys EQUAL the declared key set (required + optional)`, () => {
      trackMeasurement(event, payloadFromSchema(event, true) as never)

      const [, props] = trackEventSpy.mock.calls[0]
      const declared = [
        ...MEASUREMENT_EVENT_SCHEMAS[event].required,
        ...MEASUREMENT_EVENT_SCHEMAS[event].optional,
      ].sort()
      expect(
        Object.keys(props as object).sort(),
        `${event} emitted a key set that differs from its declaration. Extras are the ` +
          'dangerous direction: the never-capture list names real fields one spread away ' +
          'from this seam.',
      ).toEqual(declared)
    })

    it(`${event} — an UNDECLARED property is DROPPED and REPORTED, never emitted`, () => {
      const dirty = {
        ...payloadFromSchema(event, true),
        // The realistic accident: a spread that carries a rendered label along.
        factor_label: 'PII_CANARY_do_not_ship_7f3a',
      }
      trackMeasurement(event, dirty as never)

      const emitted = trackEventSpy.mock.calls.find((c) => c[0] === event)
      expect(emitted, `${event} was not emitted at all`).toBeTruthy()
      expect(
        Object.keys(emitted![1] as object),
        `${event} emitted the undeclared property 'factor_label'. trackMeasurement is ` +
          'no longer validating against MEASUREMENT_EVENT_SCHEMAS — every never-capture ' +
          'guarantee in this taxonomy rests on that validation.',
      ).not.toContain('factor_label')

      const violation = trackEventSpy.mock.calls.find((c) => c[0] === MEASUREMENT_SCHEMA_VIOLATION_EVENT)
      expect(
        violation,
        'the undeclared property was dropped SILENTLY. A guard that hides its own ' +
          'findings is the assume-good mirror — it must report.',
      ).toBeTruthy()
      expect((violation![1] as { undeclared_keys: string[] }).undeclared_keys).toEqual(['factor_label'])
      // The violation report must carry NAMES, never VALUES — otherwise the leak
      // report re-leaks the thing it is reporting.
      expect(
        JSON.stringify(violation![1]),
        'the schema-violation report contains the offending VALUE. It must carry key ' +
          'NAMES only, or the leak detector becomes a second leak.',
      ).not.toContain('PII_CANARY_do_not_ship_7f3a')
    })
  }
})
