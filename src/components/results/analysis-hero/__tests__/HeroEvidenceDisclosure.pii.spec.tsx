/**
 * ROADMAP 1.68 · S2 — the RENDER-DRIVEN arm of the PII-leak guarantee, on the
 * host that emits `evidence_view_opened`.
 *
 * ⭐ WHY THIS FILE LIVES INSIDE THE HERO MODULE, and why that is forced rather
 * than chosen. This case used to sit in `telemetry/__tests__/
 * measurementEvents.pii.spec.tsx`. That file is telemetry-wide and covers many
 * emitters, but this one case must RENDER `HeroEvidenceDisclosure` — and
 * `__tests__/inertness.spec.ts` is a LIVE MOUNT GUARD that permits exactly two
 * importers of `analysis-hero/**` repo-wide and exempts no test file. Any file
 * outside the module that reaches the component IS the offender, so no
 * arrangement of helpers avoids it.
 *
 * The guard was NOT widened to accommodate the spec. The spec moved to where the
 * import is legitimate — the same relocation already applied to
 * `__fixtures__/heroEvidenceModel.ts` and `__tests__/helpers/heroEvidenceView.tsx`.
 * Widening a live mount guard to make a test pass trades a real product
 * invariant for a green tick.
 *
 * ⚠ WHAT MOVED, AND WHAT DID NOT. Only this arm moved. The detector, the canary
 * and the planted control are now SHARED from `telemetry/__tests__/helpers/
 * piiCanary.ts` — copying them would have put two divergible copies of the one
 * instrument the PII guarantee rests on into the tree. Everything else (the run
 * spine, FeedbackRow, the seam-level `evidence_view_opened` pin, the behavioural
 * completeness manifest) stayed in the telemetry spec, whose header now names
 * this file as the render-driven arm's new home.
 *
 * ⚠ THE CLAIM THIS FILE CARRIES, unchanged by the move: no user-authored text
 * ever reaches a measurement payload, and `evidence_view_opened` fires for every
 * present view — on open AND on each switch. It is the claim a seam-level pin
 * CANNOT make: that the COMPONENT, holding a model whose every authored string
 * is poisoned, picks `factorId` and never `label`.
 *
 * ⚠ ITS SIBLING IS NOT ITS DUPLICATE. `HeroEvidenceDisclosure.telemetry.spec.tsx`
 * pins WHEN the event fires and WHAT it says about the view; this file pins what
 * it must never carry. Both are needed — deleting either leaves a real defect
 * class unobserved.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

const trackEventSpy = vi.fn()
vi.mock('../../../../lib/posthog', () => ({
  trackEvent: (...args: unknown[]) => trackEventSpy(...args),
  initPostHog: vi.fn(),
  identifyUser: vi.fn(),
  resetPostHog: vi.fn(),
}))

import { HeroEvidenceDisclosure } from '../HeroEvidenceDisclosure'
import type { HeroEvidenceModel } from '../heroTypes'
// Clicks go through `helpers/heroEvidenceView`, which owns the `fireEvent`
// rationale (a raw `node.click()` escapes act() and reads a collapsed section)
// and binds the view chips by TESTID rather than by chip copy.
import { openDisclosureHeader, switchEvidenceView } from './helpers/heroEvidenceView'
import {
  CANARY,
  assertNoCanary,
  registerLeakDetectorPlantedControl,
} from '../../../../telemetry/__tests__/helpers/piiCanary'
import { useCanvasStore } from '@/canvas/store'

/**
 * Every user/model-authored string on the hero evidence model carries the
 * canary. `isEstimate` and `fragileEdgeRefs` are producer provenance/ids, not
 * authored text, so they carry none — the canary marks what a LEAK would look
 * like, and planting it on a non-text field would make the detector prove
 * something the surface never renders.
 *
 * ⚠ SPELT OUT IN FULL rather than built on `__fixtures__/heroEvidenceModel`'s
 * partial-over-defaults builder, and the difference is load-bearing: a builder
 * would give a NEWLY-ADDED authored field a clean default, so the detector would
 * silently stop covering it. A complete literal makes a new required field a
 * compile error here — loud, in the file whose job is to be a guarantee.
 */
function canaryEvidenceModel(): HeroEvidenceModel {
  return {
    drivers: [
      {
        rank: 1,
        label: `${CANARY} driver one`,
        targetId: 'node-1',
        direction: 'positive',
        influence: 0.9,
        isEstimate: 'estimated',
      },
      {
        rank: 2,
        label: `${CANARY} driver two`,
        targetId: null,
        direction: 'negative',
        influence: 0.4,
        isEstimate: 'undetermined',
      },
    ],
    flipRisks: [
      {
        text: `${CANARY} if capacity falls below 30%, the other option leads`,
        targetId: 'node-1',
        switchMeta: '48% switch',
        magnitude: 0.48,
      },
    ],
    fragileEdgeRefs: [{ fromId: 'node-1', toId: 'node-2', edgeId: 'edge-1' }],
    tradeOffs: [
      {
        option: `${CANARY} option label`,
        gain: `${CANARY} gain`,
        giveUp: `${CANARY} give up`,
        dependsOn: `${CANARY} depends on`,
        watch: `${CANARY} watch`,
      },
    ],
    resolveNext: {
      resolved: [
        { factorId: 'factor-rank1', label: `${CANARY} rank one`, canFocus: true, canReviewValue: false },
        { factorId: 'factor-rank2', label: `${CANARY} rank two`, canFocus: false, canReviewValue: false },
      ],
      belowResolution: [{ factorId: 'factor-low', label: `${CANARY} below`, canFocus: false, canReviewValue: false }],
      someFactorsUnassessed: true,
    },
    designationsWithheld: false,
    decisionVoi: 'not_computed',
    attributionSuppression: 'not_attested',
    assumedStrength: { selected: null, refusalReason: 'no_fragile_edges', assumedFragileCount: 0 },
  }
}

beforeEach(() => {
  trackEventSpy.mockClear()
})

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// § 1 — THE PLANTED CONTROL. Runs first, and on every CI pass.
//
// It proves the detector can SEE a leak THROUGH THIS FILE'S OWN WIRING — its
// `vi.mock` of `lib/posthog`, its spy. Without it the absence assertion in § 2
// is exactly the 0-byte capture: a guarantee that passes by testing nothing.
// ---------------------------------------------------------------------------

registerLeakDetectorPlantedControl(() => trackEventSpy.mock.calls)

// ---------------------------------------------------------------------------
// § 2 — THE SURFACE-DRIVEN absence assertion, with its presence-precondition
// ---------------------------------------------------------------------------

describe('1.68 · S2 — no user-authored content reaches a measurement payload', () => {
  /**
   * ⭐ THE RENDER-DRIVEN ARM, on the emitter's host.
   *
   * `HeroEvidenceDisclosure` is the ONLY emitter of `evidence_view_opened` in
   * the repo, and the disclosure a post-run user actually loads.
   *
   * ⚠ THE PRESENCE PRECONDITION RUNS FIRST, and the absence assertion is
   * worthless without it (CLAUDE.md trap 13). Before asserting the canary is
   * absent from the payloads, this proves the canary is PRESENT in the DOM —
   * i.e. that the component really did render the poisoned strings and really
   * did fire the event. A component that rendered nothing would satisfy every
   * absence assertion below by testing nothing at all.
   */
  it('HeroEvidenceDisclosure — every present view, opened and switched', () => {
    // A scenario id and a run id so the two id-bearing fields are exercised
    // rather than skipped: `run_id_prefix` is the one that must TRUNCATE.
    useCanvasStore.setState({ currentScenarioId: 'sc-42' } as never)
    useCanvasStore.setState((s) => ({
      results: { ...s.results, runId: 'run-abcdef0123456789' },
    }) as never)

    render(<HeroEvidenceDisclosure evidence={canaryEvidenceModel()} />)
    openDisclosureHeader()

    // PRESENCE PRECONDITION — the poisoned driver label is really on screen.
    expect(
      screen.getByText(`${CANARY} driver one`),
      'the disclosure did not render the poisoned driver label, so every absence ' +
        'assertion below would pass by testing nothing',
    ).toBeInTheDocument()

    // Drive every view the host offers. This model populates all four, so all
    // four chips exist; binding by testid, never by chip label.
    for (const view of ['flipRisks', 'tradeOffs', 'resolveNext'] as const) {
      switchEvidenceView(view)
    }

    // PRESENCE PRECONDITION — the resolve-next row label, the string that sits
    // one property from `rank1_factor_id`, is really rendered.
    expect(screen.getByText(`${CANARY} rank one`)).toBeInTheDocument()

    const opened = trackEventSpy.mock.calls.filter((c) => c[0] === 'evidence_view_opened')
    expect(
      opened.length,
      'evidence_view_opened did not fire on open + three view switches — the ' +
        'emitter is dark and this whole case is vacuous',
    ).toBe(4)

    // THE ABSENCE ASSERTION, now non-vacuous.
    assertNoCanary(trackEventSpy.mock.calls)

    // …and the POSITIVE half: the ids and counts the payload is FOR did survive.
    const resolveNext = opened.find(
      (c) => (c[1] as { view?: string }).view === 'resolveNext',
    )
    expect(resolveNext, 'no resolveNext opening was recorded').toBeTruthy()
    const props = resolveNext![1] as Record<string, unknown>
    expect(props.rank1_factor_id).toBe('factor-rank1')
    expect(props.ranked_count).toBe(2)
    expect(props.below_resolution_count).toBe(1)
    expect(props.some_factors_unassessed).toBe(true)
    expect(props.scenario_id).toBe('sc-42')
    // PREFIX ONLY — a full run id is a cross-session linking token.
    expect(props.run_id_prefix).toBe('run-abcd')
    expect(Object.keys(props)).not.toContain('factor_label')
    expect(Object.keys(props)).not.toContain('label')
  })
})
