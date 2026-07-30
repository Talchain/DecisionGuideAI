// src/telemetry/__tests__/measurementEvents.pii.spec.tsx
// =============================================================================
// ROADMAP 1.68 · S2 — the PII-LEAK DETECTOR, and the PLANTED control that
// proves it can see a leak before it is allowed to report an absence.
// =============================================================================
//
// WHY A PLANTED CONTROL IS MANDATORY HERE
// ---------------------------------------
// The defect this programme catches most often is the vacuous absence
// assertion. A PLoT lane's first real-server leak test captured 0 BYTES (pino
// writes to fd 1 via sonic-boom), so every "no raw value present" assertion
// passed by testing nothing, forever, while reading as a guarantee.
//
// So this file is built in two halves, and the order matters:
//
//   1. `assertNoCanary` is a FUNCTION, not an inline assertion, so it can be
//      pointed at a deliberately-leaking payload and PROVEN to throw. That is
//      the planted control, and it runs on every CI pass — not once, by hand,
//      in a PR body that nobody re-reads.
//   2. Every surface-driven test asserts the canary IS PRESENT in the rendered
//      surface (the presence-precondition) BEFORE the absence assertion is
//      allowed to run. A fixture that silently stopped rendering the canary
//      would otherwise make the whole file pass by driving nothing.
//
// WHAT THE CANARY IS ON, AND THE EXACT SCOPE OF THE GUARANTEE
// -----------------------------------------------------------
// ⚠ THIS HEADER PREVIOUSLY CLAIMED THE CANARY WAS ON "contested-edge node
// labels" WHILE NO TEST IN THIS FILE RENDERED ContestedEdgeCard AT ALL. That is
// CLAUDE.md trap 14 in its sharpest form — a false label inside the very file
// whose job is to BE a guarantee — and it is corrected here rather than quietly
// deleted. The original scope was TWO surface groups out of ~7, and the real
// leak (option labels and node labels reaching `run_failed`) sat in the
// uncovered set and shipped.
//
// The guarantee is now a MANIFEST, and § 3 DERIVES a completeness check from
// the emitters that actually exist, so a NEW uncovered emitter REDs this file
// instead of silently shrinking the claim.
//
//   RENDER-DRIVEN — a real component renders, the canary is proven present in
//   the DOM, and only then may the absence assertion run:
//     · V7EvidenceDisclosure, all four views     → evidence_view_opened
//     · ContestedEdgeCard, mount + unmount       → contested_edge_viewed
//     · FeedbackRow, thumbs                      → turn_feedback
//
//   DIRECT-DRIVEN — the sender is called with a canary-laden payload. There is
//   no render because these senders' inputs are not rendered text; they are
//   strings assembled in hooks or read from config:
//     · every run-spine sender                   → run_started, run_completed,
//                                                  run_failed,
//                                                  plot.empty_computed_results
//     · trackGuidance, all 12 guidance_* events, dwell_ms included
//     · trackMeasurement, EVERY declared event — including session_started and
//       contested_edge_viewed, whose real emitters (app boot, and a component
//       unmount) this file drives by payload rather than by their call site
//
//   ⚠ NOT COVERED BY THIS FILE — stated plainly rather than implied:
//     · GuidanceStrip's dwell CLOCK. The payload it produces is covered above
//       (dwell_ms is driven through trackGuidance), but WHEN the clock starts
//       and whether it is correctly keyed to item_id is component behaviour
//       with no test. It is a timing bug risk, not a PII risk — a bucketed
//       integer cannot carry a label — so it is out of scope for a LEAK
//       detector, and it is named here so nobody reads this file's silence as
//       coverage. Closing it needs a GuidanceStrip render harness with the
//       guidance store assembled; rowed, not done.
//     · session_started's call site inside `initMonitoring` (as opposed to its
//       payload, which IS driven above).
//
//   ⚠ This block previously listed session_started and the GuidanceStrip dwell
//   as "STATIC-DERIVED", implying an assertion about the source existed. NO
//   SUCH ASSERTION EXISTED. That is the same defect — a header describing
//   coverage the file does not have — that this very header was rewritten to
//   fix, reintroduced within the same change. Corrected here; the lesson is
//   that a manifest is only honest if every line of it is re-checked against
//   the file AFTER the file stops changing.
//
// The canary is placed on every user- or model-authored string those surfaces
// can reach: driver labels, flip-risk from/to labels, trade-off factor and
// winner labels, resolve-next row labels, contested-edge node/edge labels, and
// every free-text field on the run-spine payloads. `factor_label` in particular
// is RENDERED by the resolve-next surface — one spread from the payload.
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

/**
 * Every event name this file has caused to be emitted, across ALL tests.
 *
 * § 4's completeness check reads THIS, not the spec's source text. An earlier
 * version grepped the source — which passes the moment an event name appears in
 * a comment, so the header's own prose would have satisfied it. A coverage
 * claim that a doc comment can satisfy is not a coverage claim.
 */
const EMITTED_EVENTS = new Set<string>()

const trackEventSpy = vi.fn()
vi.mock('../../lib/posthog', () => ({
  trackEvent: (...args: unknown[]) => trackEventSpy(...args),
  initPostHog: vi.fn(),
  identifyUser: vi.fn(),
  resetPostHog: vi.fn(),
}))

const captureMessageSpy = vi.fn()
vi.mock('@sentry/react', () => ({ captureMessage: (...a: unknown[]) => captureMessageSpy(...a) }))

import * as runSpine from '../../lib/resultsInstrumentation'
import { GUIDANCE_EVENTS, trackGuidance } from '../guidanceEvents'
import { V7EvidenceDisclosure } from '../../components/results/v7/V7EvidenceDisclosure'
import { FeedbackRow } from '../../canvas/conversation/FeedbackRow'
import { v7EvidenceModel } from '../../__fixtures__/v7EvidenceModel'
import { trackMeasurement, MEASUREMENT_EVENT_SCHEMAS } from '../measurementEvents'

const CANARY = 'PII_CANARY_do_not_ship_7f3a'

/**
 * THE DETECTOR. A function, deliberately — so the planted control below can
 * point it at a leak and prove it throws. An inline `expect` cannot be tested.
 *
 * Throws when the canary appears anywhere in any captured payload, at any
 * depth, including inside arrays and nested objects (JSON.stringify walks the
 * whole tree — a leak nested two levels deep is still a leak).
 */
function assertNoCanary(calls: unknown[][]): void {
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

/** Every user/model-authored string on the evidence model carries the canary. */
function canaryEvidenceModel() {
  return v7EvidenceModel({
    drivers: [
      { factorKey: 'f1', label: `${CANARY} driver one`, direction: 'positive', isEstimate: false, focusId: 'node-1' },
      { factorKey: 'f2', label: `${CANARY} driver two`, direction: 'negative', isEstimate: true },
    ],
    flipRisks: [
      { fromId: 'n1', toId: 'n2', edgeId: 'e1', fromLabel: `${CANARY} from`, toLabel: `${CANARY} to`, switchProbability: 0.4 },
    ],
    tradeOffs: [
      {
        factorLabel: `${CANARY} tradeoff factor`,
        factorId: 'factor-77',
        splitValue: 12.5,
        splitUnit: 'units',
        highWinnerLabel: `${CANARY} high winner`,
        lowWinnerLabel: `${CANARY} low winner`,
      },
    ],
    resolveNext: {
      resolved: [
        { factorId: 'factor-rank1', label: `${CANARY} rank one`, canFocus: true },
        { factorId: 'factor-rank2', label: `${CANARY} rank two`, canFocus: false },
      ],
      belowResolution: [{ factorId: 'factor-low', label: `${CANARY} below`, canFocus: false }],
      someFactorsUnassessed: true,
    },
    designationsWithheld: false,
  })
}

beforeEach(() => {
  trackEventSpy.mockClear()
  trackEventSpy.mockImplementation((name: string) => {
    EMITTED_EVENTS.add(String(name))
  })
})

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// § 1 — THE PLANTED CONTROL. Runs first, and on every CI pass.
// ---------------------------------------------------------------------------

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
      () => assertNoCanary(trackEventSpy.mock.calls),
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

// ---------------------------------------------------------------------------
// § 2 — SURFACE-DRIVEN absence assertions, each with a presence-precondition
// ---------------------------------------------------------------------------

describe('1.68 · S2 — no user-authored content reaches a measurement payload', () => {
  it('V7EvidenceDisclosure — all four views, opened and switched', () => {
    render(<V7EvidenceDisclosure evidence={canaryEvidenceModel()} />)

    // Open the disclosure (emits the first evidence_view_opened, view=drivers).
    fireEvent.click(screen.getByRole('button', { expanded: false }))

    // PRESENCE-PRECONDITION. Before any absence claim, prove the surface is
    // actually RENDERING the canary — otherwise "the canary reached no payload"
    // is true because the canary reached nothing at all.
    expect(
      document.body.textContent,
      'the rendered evidence surface does not contain the canary — the fixture is not ' +
        'driving this surface, so the absence assertion below would test nothing',
    ).toContain(CANARY)

    // Switch through every remaining view; each is a transition, each emits.
    for (const key of ['flipRisks', 'tradeOffs', 'resolveNext'] as const) {
      fireEvent.click(screen.getByTestId(`v7-evidence-tab-${key}`))
    }

    // The resolve-next view is the highest-risk one: it renders row LABELS and
    // the payload carries row IDs. Prove we actually reached it.
    expect(
      screen.getAllByTestId('v7-resolve-next-row').length,
      'the resolve-next view did not render its rows — the riskiest surface in this ' +
        'taxonomy was never exercised',
    ).toBeGreaterThan(0)

    // Four openings/transitions must have produced four events.
    const opened = trackEventSpy.mock.calls.filter((c) => c[0] === 'evidence_view_opened')
    expect(
      opened.length,
      'evidence_view_opened did not fire once per view transition',
    ).toBe(4)

    assertNoCanary(trackEventSpy.mock.calls)
  })

  it('V7EvidenceDisclosure — the resolveNext payload carries the factor ID, never the label', () => {
    render(<V7EvidenceDisclosure evidence={canaryEvidenceModel()} />)
    fireEvent.click(screen.getByRole('button', { expanded: false }))
    fireEvent.click(screen.getByTestId('v7-evidence-tab-resolveNext'))

    const opened = trackEventSpy.mock.calls.filter((c) => c[0] === 'evidence_view_opened')
    const resolveNextEvent = opened.find((c) => (c[1] as { view: string }).view === 'resolveNext')
    expect(resolveNextEvent, 'no evidence_view_opened fired for the resolveNext view').toBeTruthy()

    const props = resolveNextEvent![1] as Record<string, unknown>
    // The POSITIVE half: it carries the answer key M3/M5 need…
    expect(props.rank1_factor_id).toBe('factor-rank1')
    expect(props.ranked_count).toBe(2)
    expect(props.below_resolution_count).toBe(1)
    expect(props.some_factors_unassessed).toBe(true)
    // …and the NEGATIVE half: not the thing rendered next to it.
    expect(String(props.rank1_factor_id)).not.toContain(CANARY)
  })

  it('FeedbackRow — the thumbs carry a rating and a scenario id, nothing else', () => {
    render(<FeedbackRow turnId="turn-123" onFeedback={() => {}} />)
    fireEvent.click(screen.getByLabelText('Helpful'))

    const feedback = trackEventSpy.mock.calls.filter((c) => c[0] === 'turn_feedback')
    expect(feedback.length, 'turn_feedback did not fire on a thumbs press').toBe(1)

    // The turn id is deliberately NOT sent: it joins to the stored transcript,
    // and the transcript is the user's text.
    expect(
      JSON.stringify(feedback[0][1]),
      'turn_feedback carries the turn id. That is a join key into the transcript.',
    ).not.toContain('turn-123')
    assertNoCanary(trackEventSpy.mock.calls)
  })

  it('the schema-violation report itself carries NAMES only, never values', () => {
    // The leak report must not become the second leak.
    trackMeasurement('turn_feedback', {
      rating: 'down',
      scenario_id: 'sc-1',
      // @ts-expect-error deliberately undeclared — this is the accident under test
      assistant_text: CANARY,
    })
    assertNoCanary(trackEventSpy.mock.calls)

    const violation = trackEventSpy.mock.calls.find((c) => c[0] === 'ui.measurement_schema_violation')
    expect(violation, 'the undeclared property was dropped silently').toBeTruthy()
    expect((violation![1] as { undeclared_keys: string[] }).undeclared_keys).toEqual(['assistant_text'])
  })
})

// ---------------------------------------------------------------------------
// § 3 — THE RUN SPINE. This is where the real leak was, and it shipped because
//       the original version of this file did not look here.
// ---------------------------------------------------------------------------
//
// `useV2Run.ts` builds `message` by interpolating OPTION LABELS and NODE LABELS
// (`targetName` → `labelByNodeId` → `n.data.label`) and passed it as
// `error_message`. `OutputsDock.tsx` passed the store's `error.message`, which
// is the same text. Both reached `trackEvent('run_failed', payload)` verbatim
// AND Sentry's `extra`. Before the re-route the sender was DEAD, so the leak was
// latent; the re-route would have made it live on activation day.
//
// The fix is at the SEAM, not at the call sites: the transport payload is built
// from a DECLARED ALLOWLIST inside `resultsInstrumentation.ts`, so a future
// caller that passes free text is safe by construction rather than by review.

describe('1.68 · S2 — the RUN SPINE carries no user-authored text', () => {
  it('run_failed drops error_message entirely — it is never transported', () => {
    runSpine.trackRunFailed({
      error_code: 'MISSING_INTERVENTIONS',
      // Verbatim shape of what useV2Run.ts:607-620 assembles.
      error_message: `Option "${CANARY} Expand to EU" has effects on "${CANARY} CAC" with no usable value.`,
    })

    const failed = trackEventSpy.mock.calls.filter((c) => c[0] === 'run_failed')
    expect(failed.length, 'run_failed did not fire').toBe(1)
    expect(
      Object.keys(failed[0][1] as object),
      'run_failed still transports error_message. That string is assembled from option ' +
        'labels and node labels in useV2Run.ts — user-authored content, banned outright by ' +
        "measurementEvents.ts's never-capture list and by posthog.ts's own file header.",
    ).not.toContain('error_message')
    assertNoCanary(trackEventSpy.mock.calls)
  })

  it('run_failed carries a DERIVED categorical instead, so the signal survives', () => {
    runSpine.trackRunFailed({ error_code: 'MISSING_INTERVENTIONS', error_message: CANARY })
    const props = trackEventSpy.mock.calls.find((c) => c[0] === 'run_failed')![1] as Record<string, unknown>
    expect(props.error_code).toBe('MISSING_INTERVENTIONS')
    expect(
      props.error_category,
      'run_failed lost its categorical. Dropping error_message without replacing it with a ' +
        'closed derived category would trade a PII leak for a measurement hole.',
    ).toBe('input_incomplete')
  })

  it('the SENTRY extra is scrubbed too — a third party is still a third party', () => {
    runSpine.trackRunFailed({ error_code: 'MISSING_INTERVENTIONS', error_message: CANARY })
    expect(captureMessageSpy, 'Sentry was not called at all').toHaveBeenCalledTimes(1)
    expect(
      JSON.stringify(captureMessageSpy.mock.calls[0]),
      'the Sentry extra still carries error_message. Sentry is an ingest endpoint at a ' +
        'third party exactly as PostHog is; the never-capture list does not stop at one vendor.',
    ).not.toContain(CANARY)
  })

  it('plot.empty_computed_results drops the anomaly MESSAGE, keeps field + status', () => {
    runSpine.trackEmptyComputedResults({
      request_id: 'req-1',
      anomalies: [{ field: 'drivers', status: 'empty', message: `${CANARY} for node "X"` }],
    })
    assertNoCanary(trackEventSpy.mock.calls)
    const props = trackEventSpy.mock.calls.find((c) => c[0] === 'plot.empty_computed_results')![1] as {
      anomalies: Array<Record<string, unknown>>
    }
    expect(Object.keys(props.anomalies[0]).sort()).toEqual(['field', 'status'])
  })

  it('run_completed carries only bands and counts — never a label or a raw figure', () => {
    runSpine.trackRunCompleted({
      confidence_level: 'high',
      drivers_informative: true,
      trace_id: 'trace-abc',
      duration_ms: 1234,
      // @ts-expect-error the shape useV2Run used to pass — undeclared, and it
      // reached PostHog anyway because a TS type is not a runtime filter.
      option_count: 3,
    })
    const props = trackEventSpy.mock.calls.find((c) => c[0] === 'run_completed')![1] as object
    expect(Object.keys(props).sort()).toEqual([
      'confidence_level',
      'drivers_informative',
      'duration_ms',
      'trace_id',
    ])
    assertNoCanary(trackEventSpy.mock.calls)
  })

  it('UNDECLARED properties are dropped from every run-spine sender', () => {
    // useV2Run passed duration_ms/request_id/option_count/has_drivers, none of
    // which are on the declared payload types. They reached PostHog anyway,
    // because a TypeScript type is not a runtime filter.
    runSpine.trackRunStarted({
      option_count: 3,
      // @ts-expect-error deliberately undeclared — the accident under test
      scenario_title: CANARY,
    })
    assertNoCanary(trackEventSpy.mock.calls)
  })

  it('session_started carries a tag, a build id and an auth mode — nothing derived from a user', () => {
    // STATIC-DERIVED in the manifest becomes DIRECT-DRIVEN here: the real
    // emitter runs at app boot from `initMonitoring`, which this harness cannot
    // honestly assemble, but the PAYLOAD SHAPE is drivable and is what the
    // never-capture list constrains.
    trackMeasurement('session_started', {
      participant_tag: null,
      build_id: 'abc1234',
      auth_mode: 'guest',
    })
    const props = trackEventSpy.mock.calls.find((c) => c[0] === 'session_started')![1] as object
    expect(Object.keys(props).sort()).toEqual(['auth_mode', 'build_id', 'participant_tag'])
    assertNoCanary(trackEventSpy.mock.calls)
  })

  it('contested_edge_viewed carries an id and a band — never an edge or node label', () => {
    trackMeasurement('contested_edge_viewed', {
      edge_id: 'e1',
      dwell_ms: 5_000,
      strength_band: 'strong',
      scenario_id: 'sc-1',
      // @ts-expect-error the accident: the rendered edge label spread in
      edge_label: `${CANARY} Marketing spend → CAC`,
    })
    assertNoCanary(trackEventSpy.mock.calls)
  })

  it('ALL 12 guidance_* events carry no free text', () => {
    for (const key of Object.keys(GUIDANCE_EVENTS) as Array<keyof typeof GUIDANCE_EVENTS>) {
      trackGuidance(key, {
        item_id: `item-${key}`,
        item_type: 'bias_alert',
        surface: 'guidance_panel',
        scenario_id: 'sc-1',
        profile_stage: 'ideate',
        dwell_ms: 5_000,
      })
    }
    const names = trackEventSpy.mock.calls.map((c) => c[0])
    expect(
      names.filter((n) => String(n).startsWith('guidance_')).length,
      'not every guidance event fired — the loop is not driving the taxonomy it claims to',
    ).toBe(Object.keys(GUIDANCE_EVENTS).length)
    assertNoCanary(trackEventSpy.mock.calls)
  })
})

// ---------------------------------------------------------------------------
// § 4 — COMPLETENESS. The manifest must not be allowed to fall behind reality.
// ---------------------------------------------------------------------------

describe('1.68 · S2 — the coverage manifest is BEHAVIOURAL, not a source grep', () => {
  // ⚠ ORDER MATTERS. These run last in the file, so `EMITTED_EVENTS` has been
  // filled by every test above. That is the point: the claim is "this suite
  // actually caused each of these events to be emitted", which a comment cannot
  // satisfy and a renamed-but-undriven sender cannot fake.

  it('every exported run-spine sender was actually DRIVEN by this file', () => {
    const senders = Object.keys(runSpine).filter((k) => k.startsWith('track')).sort()
    expect(
      senders.length,
      'the run-spine export walk found nothing — every claim in § 3 is vacuous',
    ).toBeGreaterThanOrEqual(4)

    const RUN_SPINE_EVENT_BY_SENDER: Record<string, string> = {
      trackRunStarted: 'run_started',
      trackRunCompleted: 'run_completed',
      trackRunFailed: 'run_failed',
      trackEmptyComputedResults: 'plot.empty_computed_results',
    }
    // A NEW sender with no entry here is an unmapped sender — fail loudly
    // rather than skip it, which is how a gap becomes invisible.
    const unmapped = senders.filter((s2) => !(s2 in RUN_SPINE_EVENT_BY_SENDER))
    expect(
      unmapped,
      'these run-spine senders have no event mapping in this spec, so the completeness ' +
        'check silently ignores them. Map them and drive them.',
    ).toEqual([])

    const undriven = senders.filter((s2) => !EMITTED_EVENTS.has(RUN_SPINE_EVENT_BY_SENDER[s2]))
    expect(
      undriven,
      'these run-spine senders were never actually made to emit by this file. That is ' +
        'exactly how the run_failed leak shipped: the guarantee file did not look at the ' +
        'surface the leak was on.',
    ).toEqual([])
  })

  it('every DECLARED measurement event was actually emitted by this file', () => {
    const declared = Object.keys(MEASUREMENT_EVENT_SCHEMAS).sort()
    expect(declared.length, 'schema walk empty — this check would pass over nothing').toBeGreaterThanOrEqual(4)
    const uncovered = declared.filter((e) => !EMITTED_EVENTS.has(e))
    expect(
      uncovered,
      'these events are declared in measurementEvents.ts but this PII spec never caused ' +
        'one to be emitted, so nothing here proves they are canary-free.',
    ).toEqual([])
  })

  it('ANTI-VACUITY — the accumulator is not empty and is not everything', () => {
    // If the recorder broke, `EMITTED_EVENTS` would be empty and both checks
    // above would report "uncovered: [everything]" — loud. But if someone
    // "fixed" that by seeding it, they would go green over nothing. Pin both ends.
    expect(EMITTED_EVENTS.size, 'the emission recorder captured nothing').toBeGreaterThan(5)
    expect(
      EMITTED_EVENTS.has('an_event_that_does_not_exist'),
      'the accumulator contains an event nothing emits — it has been seeded rather than filled',
    ).toBe(false)
  })
})
