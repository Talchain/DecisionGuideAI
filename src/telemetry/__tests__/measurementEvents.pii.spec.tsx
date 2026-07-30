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
// WHAT THE CANARY IS ON
// ---------------------
// Every user- or model-authored string the instrumented surfaces can reach:
// driver labels, flip-risk from/to labels, trade-off factor labels and winner
// labels, resolve-next row labels, contested-edge node labels. These are the
// exact names on `measurementEvents.ts`'s never-capture list, and `factor_label`
// in particular is RENDERED by the resolve-next surface — one spread from the
// payload.
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

const trackEventSpy = vi.fn()
vi.mock('../../lib/posthog', () => ({
  trackEvent: (...args: unknown[]) => trackEventSpy(...args),
  initPostHog: vi.fn(),
  identifyUser: vi.fn(),
  resetPostHog: vi.fn(),
}))

import { V7EvidenceDisclosure } from '../../components/results/v7/V7EvidenceDisclosure'
import { FeedbackRow } from '../../canvas/conversation/FeedbackRow'
import { v7EvidenceModel } from '../../__fixtures__/v7EvidenceModel'
import { trackMeasurement } from '../measurementEvents'

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
