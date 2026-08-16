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
// ⚠ THE DETECTOR, THE CANARY AND THE CONTROL NOW LIVE IN
// `helpers/piiCanary.ts`, NOT IN THIS FILE. They were extracted when the
// render-driven hero arm was relocated (see the manifest below): two spec files
// needed the same instrument, and two copies of a leak detector is the
// hand-maintained mirror (trap 12) applied to the one thing the whole PII
// guarantee rests on. This file registers the control via
// `registerLeakDetectorPlantedControl` in § 1, exactly as before — the control
// is per-file because it must prove the detector sees a leak through THIS
// file's own spy and mock, and a disconnected spy is the 0-byte failure mode.
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
//   RENDER-DRIVEN — a real component renders IN THIS FILE, the canary is proven
//   present in the DOM, and only then may the absence assertion run:
//     · FeedbackRow, thumbs                        → turn_feedback
//
//   ⚠⚠ `evidence_view_opened`'s RENDER-DRIVEN ARM IS NOT IN THIS FILE, and the
//   history matters because this line has been wrong in both directions before.
//   Its only emitter in the whole repo was `V7EvidenceDisclosure`, deleted with
//   the V7 retirement, which left the event with ZERO emitters while its schema
//   stayed declared in `measurementEvents.ts`. The interim pin was DIRECT-DRIVEN
//   at the seam and said so honestly. The emitter was then re-homed onto
//   `analysis-hero/HeroEvidenceDisclosure.tsx` — the disclosure a post-run user
//   actually loads — and the render-driven arm was restored against THAT host,
//   IN THIS FILE.
//
//   It has since MOVED OUT, to
//   `components/results/analysis-hero/__tests__/HeroEvidenceDisclosure.pii.spec.tsx`.
//   Not a preference: `analysis-hero/__tests__/inertness.spec.ts` is a LIVE
//   MOUNT GUARD permitting exactly two importers of that module repo-wide, and
//   it exempts no test file — so a telemetry-wide spec that renders the hero IS
//   the offender. The guard was not widened; the one arm that needed the import
//   went to where the import is legitimate, and the rest of this file stayed.
//   The two files share `helpers/piiCanary.ts`, so there is still exactly one
//   detector.
//
//   The SEAM-LEVEL `evidence_view_opened` pin REMAINS HERE (§ 2), and is not a
//   substitute for the moved arm: the seam pin proves the transport drops an
//   undeclared label; the render pin proves the component picks the right field
//   in the first place.
//
//   ⚠ THIS LIST PREVIOUSLY INCLUDED "ContestedEdgeCard, mount + unmount". THIS
//   FILE NEVER IMPORTS OR RENDERS THAT COMPONENT — the renders live in
//   `measurementBehaviour.spec.tsx` and `measurementEvents.neverThrow.spec.tsx`.
//   The line even contradicted the paragraph 15 lines above it, which says in
//   terms that no test here rendered it. That is trap 14's THIRD recurrence in
//   this one header: written false, corrected, and reintroduced by the
//   correction. Recorded rather than quietly deleted, because three occurrences
//   is no longer carelessness — it is evidence that prose describing coverage
//   drifts faster than anyone re-reads it, which is exactly why § 4's
//   completeness check is BEHAVIOURAL and this block is only navigation.
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
//       with no test. It is a timing-bug risk, not a PII risk — a bucketed
//       integer cannot carry a label — so it is out of scope for a LEAK
//       detector, and it is named here so nobody reads this file's silence as
//       coverage.
//     · session_started's call site inside `initMonitoring` (as opposed to its
//       payload, which IS driven above).
//     · OutputsDock's store-transition emit (run_completed / run_failed,
//       including the isErrorReport branch) — pinned SOURCE-DERIVED in
//       `src/lib/__tests__/runSettleClassification.spec.ts`, not behaviourally.
//
//   All three are **ROADMAP 2.192** (dwell-clock behavioural test + an
//   OutputsDock store-transition spec). An earlier version of this comment said
//   the first was "rowed" when no row existed — the row exists now, and it is
//   named here rather than gestured at.
//
//   ⚠ This block previously listed session_started and the GuidanceStrip dwell
//   as "STATIC-DERIVED", implying an assertion about the source existed. NO
//   SUCH ASSERTION EXISTED. That is the same defect — a header describing
//   coverage the file does not have — that this very header was rewritten to
//   fix, reintroduced within the same change. Corrected here; the lesson is
//   that a manifest is only honest if every line of it is re-checked against
//   the file AFTER the file stops changing.
//
// The canary is placed on every user- or model-authored string the surfaces
// THIS FILE drives can reach: the turn id behind FeedbackRow, contested-edge
// node/edge labels, the resolve-next row label a developer could spread into
// `factor_label`, and every free-text field on the run-spine payloads.
//
// ⚠ RE-DERIVED THREE TIMES, and this is the live one. The paragraph first
// described `V7EvidenceDisclosure`'s model (driver `label`, flip-risk
// `fromLabel`/`toLabel`, trade-off factor/winner labels); it was narrowed when
// that component was deleted; it was then restated against `HeroEvidenceModel`.
// It is now narrowed AGAIN, because the poisoned `HeroEvidenceModel` fixture
// left with the render-driven arm — it lives beside that arm, in
// `analysis-hero/__tests__/HeroEvidenceDisclosure.pii.spec.tsx`, where the
// component it poisons is importable. Nothing in THIS file builds a hero model
// any more, and a manifest claiming otherwise would be trap 14's fourth
// recurrence in one header. Read the model, not this comment.
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
import { FeedbackRow } from '../../canvas/conversation/FeedbackRow'
import { trackMeasurement, MEASUREMENT_EVENT_SCHEMAS } from '../measurementEvents'
// The detector, the canary and the planted control are SHARED with the hero's
// render-driven arm (see the manifest above). One instrument, not two copies.
import { CANARY, assertNoCanary, registerLeakDetectorPlantedControl } from './helpers/piiCanary'

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
//
// Registered from the shared helper so this file and the hero's render-driven
// arm run the SAME control against the SAME detector. It still proves the
// detector sees a leak through THIS file's own spy and mock — that is why it is
// registered per-file rather than run once somewhere central.
// ---------------------------------------------------------------------------

registerLeakDetectorPlantedControl(() => trackEventSpy.mock.calls)

// ---------------------------------------------------------------------------
// § 2 — SURFACE-DRIVEN absence assertions, each with a presence-precondition
// ---------------------------------------------------------------------------

describe('1.68 · S2 — no user-authored content reaches a measurement payload', () => {
  /**
   * The SEAM-LEVEL pin. It was written as the interim stand-in while
   * `evidence_view_opened` had no emitter at all, and its original note said —
   * correctly at the time — that it was deliberately weaker than the
   * render-driven case it replaced, because it proves the TRANSPORT drops an
   * undeclared label and not that any component picks the right field.
   *
   * ⚠ THAT SENTENCE IS WHY IT STAYS, AND WHY IT STAYS *HERE*. The two are not
   * redundant: the render-driven case — now in
   * `components/results/analysis-hero/__tests__/HeroEvidenceDisclosure.pii.spec.tsx`,
   * moved there because the hero's live mount guard admits no outside importer —
   * cannot exercise a developer spreading `factor_label` into the payload (the
   * component does not do it), and this one cannot exercise the component's own
   * field choice. Deleting either leaves a real defect class unobserved, and
   * this half needs no hero import, so it did not move.
   */
  it('evidence_view_opened — the rendered label is DROPPED, the factor ID survives', () => {
    trackMeasurement('evidence_view_opened', {
      view: 'resolveNext',
      scenario_id: 'sc-1',
      gated: false,
      rank1_factor_id: 'factor-rank1',
      ranked_count: 2,
      below_resolution_count: 1,
      some_factors_unassessed: true,
      // @ts-expect-error the accident under test: the surface renders `label`
      // one line from `factorId`, and a developer reaching for the wrong one
      // spreads it in here. It is UNDECLARED, so the seam must drop it.
      factor_label: `${CANARY} rank one`,
    })
    assertNoCanary(trackEventSpy.mock.calls)

    const opened = trackEventSpy.mock.calls.find((c) => c[0] === 'evidence_view_opened')
    expect(opened, 'evidence_view_opened did not fire — the assertions below are vacuous').toBeTruthy()
    const props = opened![1] as Record<string, unknown>
    // The POSITIVE half: the answer key M3/M5 need is declared and survives…
    expect(props.rank1_factor_id).toBe('factor-rank1')
    expect(props.ranked_count).toBe(2)
    expect(props.below_resolution_count).toBe(1)
    expect(props.some_factors_unassessed).toBe(true)
    // …and the NEGATIVE half: the thing rendered next to it does not.
    expect(Object.keys(props)).not.toContain('factor_label')

    const violation = trackEventSpy.mock.calls.find((c) => c[0] === 'ui.measurement_schema_violation')
    expect(violation, 'the undeclared property was dropped SILENTLY').toBeTruthy()
    expect((violation![1] as { undeclared_keys: string[] }).undeclared_keys).toEqual(['factor_label'])
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
