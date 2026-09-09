/**
 * ⛔ P0 — THE CANVAS CAN BE POINTED AT AN OPTION THE PRODUCT MAY NOT NAME,
 *    AND SAY NOTHING ABOUT IT.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐⭐ REWORKED 8 Sep 2026 — PAUL'S RULING. THE GATE STANDS; THE CONSEQUENCE
 *    CHANGED. READ THIS BEFORE THE HISTORY BELOW.
 * ═══════════════════════════════════════════════════════════════════════════
 * PR #1284 suppressed the highlight. The diagnosis was accepted and the remedy
 * rejected:
 *
 *   > "Keep the highlight. Add on-screen text that admits the claim is being
 *   >  made and states its uncertainty. The caveat must be VISIBLE, not
 *   >  carried by the animation."
 *
 * So WITHHOLDING IS WRONG AND SILENT HIGHLIGHTING IS ALSO WRONG. Every
 * assertion in this file that read "…is withheld, not pulsed" now reads "…is
 * pulsed AND the caveat is recorded", and the licence derivation underneath is
 * untouched.
 *
 * ⚠ THIS FILE IS A GUARD, NOT A HISTORIC RECORD (trap 14b). Its fixtures are
 * constructed payloads that pin BEHAVIOUR, so they are updated when the ruled
 * behaviour changes. The one thing that is a record — the P0's measured
 * admission value and its wording — is unchanged.
 *
 * ⚠⚠ AND THE VACUITY THIS REWORK HAD TO AVOID, stated because it is the whole
 * risk of the change. Ten of the original assertions were
 * `expect(deferred.some(d => d.reason === DEFER_REASON)).toBe(false)`. The
 * remedy's reversal DELETES that reason from the product, so every one of them
 * would now pass BY TESTING NOTHING — ten green negatives about a string no
 * code can emit. They are re-bound to the new discriminating fact (the caveat
 * store's `caveatedOptionId`), and `RETIRED_DEFER_REASON` keeps ONE assertion
 * of its own, guarded by a positive control proving `deferred` is still a live
 * channel that CAN carry a reason.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE ORIGINAL DERIVATION, STILL LOAD-BEARING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Measured on deployed staging: inside ONE HTTP 200, the assistant text said
 * "No single option can be put forward yet" (twice) while a `ui_directive`
 * block told the UI to highlight the leading option — and the canvas obeyed.
 *
 * Every TEXTUAL leader designation already withholds correctly (the "Leading
 * option" pill, the robustness badge, "Leads via", "Behind:", the close-call
 * marker, the decision headline and bar). The HIGHLIGHT was the one un-ruled
 * hole, and it is the worst kind: **a silent visual claim, because nothing on
 * screen admits a claim is being made.** The correct silence of every textual
 * surface is exactly what made the highlight silent — so the fix is to give the
 * canvas ONE sentence, not to take the highlight away.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHICH QUESTION THIS SUITE'S GATE ANSWERS (trap 21 is live in this seam)
 * ═══════════════════════════════════════════════════════════════════════════
 * "MAY THIS TURN SINGLE OUT THE FRONT-RUNNING OPTION ON THE CANVAS WITHOUT
 *  SAYING SO?"
 *
 * The gate's INPUTS are unchanged from #1284; only the verb at the end moved,
 * because the answer is no longer "then do not point" but "then say you are".
 *
 * That is Q1 — the MODEL'S LICENCE (`licensesComparativeLeaderClaim`) — applied
 * to the IDENTITY case (this directive's target IS the front-runner).
 *
 * ⚠ IT DELIBERATELY DOES NOT CONSULT Q2 (`hasLeadingOption`), AND THE REASON IS
 * THE WHOLE DEFECT. `decisionVerdict.ts` states it directly: *"a non-null
 * `leaderId` does NOT license the phrase 'leading option' — identity and
 * entitlement are different questions."* `leaderId` is used here for IDENTITY
 * ONLY, which is exactly its documented purpose. Conjoining `hasLeadingOption`
 * into the GATE CONDITION would reopen the P0 through the other door: on a run
 * that did not separate the arms, Q2 is false, the gate would not fire, and the
 * front-runner would be pulsed while the panel withheld every designation.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * SCOPE — AND WHAT IS DELIBERATELY LEFT ALONE
 * ═══════════════════════════════════════════════════════════════════════════
 * ONLY `highlight` on the front-running OPTION NODE is gated. `focus` and
 * `open_inspector` are NAVIGATION — the assistant taking the user somewhere,
 * not asserting a ranking — and over-gating them would break legitimate
 * assistant behaviour, which is a worse defect than the one being fixed.
 * Those exclusions are asserted below as first-class cases, not fenced off
 * silently: a scope exclusion nobody can see is a judgement made unreviewable.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ENVELOPE-SCOPED, AND WHY (an ordering fact, derived at the bytes)
 * ═══════════════════════════════════════════════════════════════════════════
 * The `ui_directive` arm runs in STEP 2 (the block loop). `ceeAnalysisReady` is
 * written in STEP 4 and `results.report` in STEP 5 — BOTH AFTER. So reading the
 * store here would gate on the PREVIOUS turn's admission, which answers a
 * different question again. `V5ApplicatorStore` also exposes only WRITES for
 * those slices. Both of the gate's inputs therefore come from THE SAME
 * ENVELOPE: the admission from top-level `analysis_ready`, the leader identity
 * from this turn's `analysis_result` block.
 *
 * ⚠ KNOWN, DELIBERATE GAP, pinned by `KNOWN_UNGATED` below so it fails loud if
 * it ever grows or shrinks: a turn carrying a highlight but NO `analysis_result`
 * block has no in-envelope leader identity, so nothing is gated. Closing that
 * needs a readable admission/results slice on the applicator store — a separate,
 * larger change than this P0 fix.
 *
 * CORPUS: `quantified_provisional` is the exact value live in the measured P0
 * and appeared in NO canvas spec before this file.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { OlumiResponse } from '@talchain/schemas/boundary'
import type { AnalysisAdmissionV1 } from '../../adapters/cee/types'

const { pulseMock } = vi.hoisted(() => ({ pulseMock: vi.fn() }))
vi.mock('../../canvas/utils/appliedEditPulse', () => ({
  pulseAppliedTargets: pulseMock,
  __resetAppliedEditPulseForTests: vi.fn(),
  PULSE_COALESCE_MS: 100,
  PULSE_DURATION_MS: 2000,
}))

const { assistantFocusMock } = vi.hoisted(() => ({ assistantFocusMock: vi.fn() }))
vi.mock('../../canvas/utils/assistantFocusCamera', () => ({
  focusAssistantTarget: assistantFocusMock,
}))

import { applyV5State, type V5ApplicatorStore } from '../applyV5State'
import { useDirectiveDesignationStore } from '../../canvas/stores/directiveDesignationStore'

/** The one fact the rework turns on: which option this turn caveated. */
const caveat = (): string | null =>
  useDirectiveDesignationStore.getState().caveatedOptionId

// ── the graph under test ────────────────────────────────────────────────────
const LEADER = 'opt_mac'
const RIVAL = 'opt_dell'
const THIRD = 'opt_status_quo'

const MAC = 'Standardise on MacBook Pro'
const DELL = 'Standardise on Dell XPS'
const STATUS_QUO = 'Defer and Keep Current Machines (Status Quo)'

/** Label-keyed win_probabilities — the real staging shape. */
const WIN_PROBABILITIES: Record<string, number> = {
  [MAC]: 0.4276666666666667,
  [DELL]: 0.32341666666666663,
  [STATUS_QUO]: 0.24891666666666665,
}

function optionComparison(): Array<Record<string, unknown>> {
  return [
    { id: RIVAL, option_id: RIVAL, label: DELL, option_label: DELL, win_probability: 0.32341666666666663 },
    { id: LEADER, option_id: LEADER, label: MAC, option_label: MAC, win_probability: 0.4276666666666667 },
    { id: THIRD, option_id: THIRD, label: STATUS_QUO, option_label: STATUS_QUO, win_probability: 0.24891666666666665 },
  ]
}

/** A CLEARLY SEPARATED run: Q2 is true, so only Q1 can withhold. */
function analysisResultBlock(): unknown {
  return {
    type: 'analysis_result',
    summary: 'MacBook Pro leads on total cost of ownership.',
    win_probabilities: WIN_PROBABILITIES,
    enrichment: {
      option_comparison: optionComparison(),
      robustness: {
        recommended_option_id: LEADER,
        near_tie: { is_tie: false, top_option_id: LEADER, second_option_id: RIVAL, gap: 0.104, threshold: 0.1 },
      },
    },
  }
}

// ── admissions ──────────────────────────────────────────────────────────────
/** ⭐ THE EXACT VALUE LIVE IN THE MEASURED P0. */
const ADMISSION_QUANTIFIED_PROVISIONAL: AnalysisAdmissionV1 = {
  permitted_analysis_mode: 'quantified_provisional',
  reasons: [{ field: 'estimates', message: 'No single option can be put forward yet.' }],
} as AnalysisAdmissionV1
const ADMISSION_NONE: AnalysisAdmissionV1 = {
  permitted_analysis_mode: 'none',
  reasons: [{ field: 'estimates', message: 'Every estimate here is machine-invented.' }],
} as AnalysisAdmissionV1
const ADMISSION_EXPLORATORY: AnalysisAdmissionV1 = {
  permitted_analysis_mode: 'exploratory',
  reasons: [{ field: 'evidence', message: 'Not enough evidence to rank these.' }],
} as AnalysisAdmissionV1
const ADMISSION_PERMITTED: AnalysisAdmissionV1 = {
  permitted_analysis_mode: 'comparative_leader',
  reasons: [],
} as AnalysisAdmissionV1

function baseResponse(overrides: Record<string, unknown> = {}): OlumiResponse {
  return {
    response_version: 2,
    assistant_text: '',
    blocks: [],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'frame',
    ...overrides,
  } as OlumiResponse
}

function makeStore(): V5ApplicatorStore {
  return {
    setCurrentStage: vi.fn(),
    updateNode: vi.fn(),
    updateEdgeData: vi.fn(),
    setRunMeta: vi.fn(),
    setCeeAnalysisReady: vi.fn(),
    setGoalConstraints: vi.fn(),
    backfillGoalThreshold: vi.fn(),
    selectNodeWithoutHistory: vi.fn(),
    selectEdgeWithoutHistory: vi.fn(),
    goalConstraints: null,
    nodes: [
      { id: LEADER, data: { label: MAC } },
      { id: RIVAL, data: { label: DELL } },
      { id: THIRD, data: { label: STATUS_QUO } },
    ] as never,
    edges: [{ id: 'e1', source: LEADER, target: RIVAL }] as never,
    currentScenarioId: 'scenario-a',
  }
}

const directive = (
  verb: string,
  targets: Array<{ id: string; label: string; kind: string }>,
  extra: Record<string, unknown> = {},
) => ({ type: 'ui_directive', verb, targets, ...extra }) as never

/** One envelope: an admission, the separated run, and a directive. */
function envelope(
  admission: AnalysisAdmissionV1 | undefined,
  directiveBlock: unknown,
  opts: { withAnalysisResult?: boolean } = {},
): OlumiResponse {
  const withAnalysisResult = opts.withAnalysisResult !== false
  return baseResponse({
    assistant_text: 'No single option can be put forward yet.',
    blocks: withAnalysisResult
      ? [analysisResultBlock(), directiveBlock]
      : [directiveBlock],
    ...(admission
      ? { analysis_ready: { status: 'ready', options: [], goal_node_id: 'goal_1', analysis_admission: admission } }
      : {}),
  })
}

/**
 * ⚠ THE REASON #1284 EMITTED, KEPT ONLY TO ASSERT IT IS GONE.
 *
 * Nothing pushes it any more — the target is genuinely applied now, and a
 * `deferred` entry beside a target that DID render is the false-label defect
 * one level down. It is asserted absent EXACTLY ONCE, beside a positive
 * control proving `deferred` still carries reasons, because a negative
 * assertion about a string no code can emit is worth nothing on its own.
 */
const RETIRED_DEFER_REASON = 'ui_directive_leader_designation_withheld'

beforeEach(() => {
  pulseMock.mockClear()
  assistantFocusMock.mockClear()
  // The store is REAL, not mocked: the applicator's write is the behaviour
  // under test, so mocking it would leave the suite asserting its own fixture.
  useDirectiveDesignationStore.setState({ caveatedOptionId: null })
})

describe('applyV5State — a ui_directive may not visually designate a leader the model may not name', () => {
  // ══════════════════════════════════════════════════════════════════════════
  // THE P0 ITSELF
  // ══════════════════════════════════════════════════════════════════════════
  it('⛔ P0 (quantified_provisional): the FRONT-RUNNER is pulsed AND the caveat is recorded against it', () => {
    const result = applyV5State(
      envelope(
        ADMISSION_QUANTIFIED_PROVISIONAL,
        directive('highlight', [{ id: LEADER, label: MAC, kind: 'option' }]),
      ),
      makeStore(),
    )

    // PRECONDITION, PINNED IN-TEST: this payload's front-runner really is
    // LEADER, so a green result below is the gate's doing and not a fixture
    // that stopped reproducing the identity (trap 13b's third face).
    expect(optionComparison().some((o) => o.id === LEADER)).toBe(true)

    // ⭐ PAUL'S RULING, BOTH HALVES IN ONE TEST — they must never separate.
    // The highlight SURVIVES ...
    expect(pulseMock).toHaveBeenCalledTimes(1)
    expect(pulseMock.mock.calls[0][0].nodeIds).toContain(LEADER)
    expect(result.applied).toContain(`ui_directive:highlight:${LEADER}`)
    // ... and the claim is ADMITTED. Bound by IDENTITY — the option id — never
    // a value predicate another object could satisfy.
    expect(caveat()).toBe(LEADER)
  })

  it('THE CLAIM IS ADMITTED, NOT SILENT: the caveat names the exact option that was pointed at', () => {
    const result = applyV5State(
      envelope(
        ADMISSION_QUANTIFIED_PROVISIONAL,
        directive('highlight', [{ id: LEADER, label: MAC, kind: 'option' }]),
      ),
      makeStore(),
    )
    expect(caveat()).toBe(LEADER)
    expect(caveat()).not.toBe(RIVAL)
    // ⚠ AND THE RETIRED REASON IS GONE — asserted ONCE, and never on its own.
    expect(result.deferred.some((d) => d.reason === RETIRED_DEFER_REASON)).toBe(false)
  })

  it('POSITIVE CONTROL for the assertion above: `deferred` still carries reasons', () => {
    // Without this, "the retired reason is absent" could pass because
    // `deferred` is empty for an unrelated reason, or because the field was
    // renamed — an absence probe with no positive control (trap 13).
    const result = applyV5State(
      envelope(
        ADMISSION_QUANTIFIED_PROVISIONAL,
        directive('highlight', [{ id: 'opt_not_on_canvas', label: 'Ghost', kind: 'option' }]),
      ),
      makeStore(),
    )
    expect(result.deferred.some((d) => d.reason === 'ui_directive_target_not_found')).toBe(true)
    // ... and a target that never resolved cannot be a caveated designation.
    expect(caveat()).toBeNull()
  })

  // ══════════════════════════════════════════════════════════════════════════
  // THE OTHER REFUSING MODES — `!== 'none'` would leak both of these
  // ══════════════════════════════════════════════════════════════════════════
  it.each([
    ['none', ADMISSION_NONE],
    ['exploratory', ADMISSION_EXPLORATORY],
    ['quantified_provisional', ADMISSION_QUANTIFIED_PROVISIONAL],
  ])('mode %s pulses the front-runner AND caveats it', (_mode, admission) => {
    const result = applyV5State(
      envelope(admission, directive('highlight', [{ id: LEADER, label: MAC, kind: 'option' }])),
      makeStore(),
    )
    expect(pulseMock).toHaveBeenCalledTimes(1)
    expect(result.applied).toContain(`ui_directive:highlight:${LEADER}`)
    expect(caveat()).toBe(LEADER)
  })

  // ══════════════════════════════════════════════════════════════════════════
  // THE OPPOSITE-DIRECTION TWINS — a gate that suppresses everything is a
  // WORSE defect than the one being fixed (trap 22b: every case gets its twin)
  // ══════════════════════════════════════════════════════════════════════════
  it('LICENSED (comparative_leader): the front-runner highlight still pulses', () => {
    const result = applyV5State(
      envelope(ADMISSION_PERMITTED, directive('highlight', [{ id: LEADER, label: MAC, kind: 'option' }])),
      makeStore(),
    )
    expect(pulseMock).toHaveBeenCalledTimes(1)
    expect(pulseMock.mock.calls[0][0].nodeIds).toContain(LEADER)
    expect(result.applied).toContain(`ui_directive:highlight:${LEADER}`)
    // ⭐ THE OPPOSITE-DIRECTION TWIN OF THE P0. A licensed run must carry NO
    // caveat: a sentence saying "no single option can be put forward yet"
    // beside a card that IS wearing its designation would be the harm inverted.
    expect(caveat()).toBeNull()
  })

  it('ABSENCE ARM PRESERVED (pre-admission CEE): no analysis_admission ⇒ pulses, and says nothing', () => {
    const result = applyV5State(
      envelope(undefined, directive('highlight', [{ id: LEADER, label: MAC, kind: 'option' }])),
      makeStore(),
    )
    expect(pulseMock).toHaveBeenCalledTimes(1)
    expect(result.applied).toContain(`ui_directive:highlight:${LEADER}`)
    // A missing carrier must never become a silent CAVEAT either: an older
    // producer gets exactly today's canvas, unchanged in both directions.
    expect(caveat()).toBeNull()
  })

  it('SCOPED TO THE FRONT-RUNNER: a NON-leader option pulses UNCAVEATED under the same refusal', () => {
    const result = applyV5State(
      envelope(
        ADMISSION_QUANTIFIED_PROVISIONAL,
        directive('highlight', [{ id: RIVAL, label: DELL, kind: 'option' }]),
      ),
      makeStore(),
    )
    expect(pulseMock).toHaveBeenCalledTimes(1)
    expect(pulseMock.mock.calls[0][0].nodeIds).toContain(RIVAL)
    expect(result.applied).toContain(`ui_directive:highlight:${RIVAL}`)
    // Pointing at a rival asserts no ranking, so there is nothing to admit.
    expect(caveat()).toBeNull()
  })

  it('MIXED TARGETS: every target pulses, and ONLY the front-runner is caveated', () => {
    const result = applyV5State(
      envelope(
        ADMISSION_QUANTIFIED_PROVISIONAL,
        directive('highlight', [
          { id: LEADER, label: MAC, kind: 'option' },
          { id: RIVAL, label: DELL, kind: 'option' },
        ]),
      ),
      makeStore(),
    )
    expect(pulseMock).toHaveBeenCalledTimes(1)
    const arg = pulseMock.mock.calls[0][0]
    expect(arg.nodeIds).toContain(RIVAL)
    expect(arg.nodeIds).toContain(LEADER)
    expect(result.applied).toContain(`ui_directive:highlight:${RIVAL}`)
    expect(result.applied).toContain(`ui_directive:highlight:${LEADER}`)
    // ⭐ THE DISCRIMINATION, IN ONE PAYLOAD: two nodes lit by one directive,
    // one sentence, and it belongs to the front-runner only. A caveat that
    // attached to whatever was pointed at would pass every single-target test
    // in this file and fail here.
    expect(caveat()).toBe(LEADER)
  })

  /**
   * ⭐ THE DISCRIMINATING FIXTURE FOR `!isEdge`.
   *
   * Dropping `!isEdge` from the gate SURVIVED the ordinary corpus, because no
   * ordinary edge id can equal an option id. A survivor is a CLAIM either way
   * and must be demonstrated, never asserted — so this pins the one payload
   * that separates them: an edge whose id COLLIDES with the front-runner's.
   *
   * Node ids and edge ids are separate spaces and both are producer-supplied,
   * so a collision is possible. Without `!isEdge` the gate would compare an
   * edge id into the option identity space and silently withhold a perfectly
   * legitimate edge highlight. With it, the edge is untouched.
   */
  it('IDENTITY SPACES DO NOT MIX: an EDGE whose id collides with the front-runner still pulses', () => {
    const store = makeStore()
    // The collision, constructed deliberately.
    store.edges = [{ id: LEADER, source: RIVAL, target: THIRD }] as never
    applyV5State(
      envelope(
        ADMISSION_QUANTIFIED_PROVISIONAL,
        directive('highlight', [{ id: LEADER, label: 'Influence', kind: 'edge' }]),
      ),
      store,
    )
    // PRECONDITION PINNED IN-TEST: the collision really is present, so a green
    // result is the `!isEdge` conjunct's doing and not a fixture that stopped
    // reproducing the collision.
    expect(store.edges.some((e) => e.id === LEADER)).toBe(true)
    expect(pulseMock).toHaveBeenCalledTimes(1)
    expect(pulseMock.mock.calls[0][0].edgeIds).toContain(LEADER)
    // The edge is not an option, so there is no designation to admit. Without
    // `!isEdge` the caveat would name an EDGE id to an option card.
    expect(caveat()).toBeNull()
  })

  it('AN EDGE is never a leader designation: an edge target is untouched under refusal', () => {
    applyV5State(
      envelope(
        ADMISSION_QUANTIFIED_PROVISIONAL,
        directive('highlight', [{ id: 'e1', label: 'Influence', kind: 'edge' }]),
      ),
      makeStore(),
    )
    expect(pulseMock).toHaveBeenCalledTimes(1)
    expect(pulseMock.mock.calls[0][0].edgeIds).toContain('e1')
    expect(caveat()).toBeNull()
  })

  // ══════════════════════════════════════════════════════════════════════════
  // BOTH HIGHLIGHT SUB-PATHS. A highlight carrying a note routes to the HELD
  // attention channel — a persistent marker, so a MORE prominent designation
  // than the 2s pulse. Gating one and not the other would leave the louder
  // half open.
  // ══════════════════════════════════════════════════════════════════════════
  it('THE ATTENTION CHANNEL TOO: a NOTE-carrying highlight of the front-runner is caveated', () => {
    const result = applyV5State(
      envelope(
        ADMISSION_QUANTIFIED_PROVISIONAL,
        directive('highlight', [{ id: LEADER, label: MAC, kind: 'option' }], {
          note: { move: 'challenge', title: 'Look here', body: 'This one leads.' },
        }),
      ),
      makeStore(),
    )
    // The held-attention channel is the LOUDER of the two sub-paths (a
    // persistent marker, not a fading pulse), so it must carry the caveat too —
    // covering one and not the other would leave the louder half silent.
    expect(result.applied).toContain(`ui_directive:highlight:${LEADER}`)
    expect(caveat()).toBe(LEADER)
  })

  it('THE ATTENTION CHANNEL, LICENSED: a NOTE-carrying highlight of the front-runner is applied', () => {
    const result = applyV5State(
      envelope(
        ADMISSION_PERMITTED,
        directive('highlight', [{ id: LEADER, label: MAC, kind: 'option' }], {
          note: { move: 'challenge', title: 'Look here', body: 'This one leads.' },
        }),
      ),
      makeStore(),
    )
    expect(result.applied).toContain(`ui_directive:highlight:${LEADER}`)
    expect(caveat()).toBeNull()
  })

  // ══════════════════════════════════════════════════════════════════════════
  // ⭐ THE DELIBERATE EXCLUSIONS — asserted, never fenced off silently.
  // These are the GREEN arm of the discriminating mutant pair: a mutant that
  // ungates a DIFFERENT directive kind must leave these untouched.
  // ══════════════════════════════════════════════════════════════════════════
  const KNOWN_UNGATED = ['focus', 'open_inspector'] as const

  it('NAVIGATION IS NOT DESIGNATION: `focus` on the front-runner still executes under refusal', () => {
    const result = applyV5State(
      envelope(
        ADMISSION_QUANTIFIED_PROVISIONAL,
        directive('focus', [{ id: LEADER, label: MAC, kind: 'option' }]),
      ),
      makeStore(),
    )
    expect(assistantFocusMock).toHaveBeenCalledTimes(1)
    expect(assistantFocusMock.mock.calls[0][0].id).toBe(LEADER)
    expect(result.applied).toContain(`ui_directive:focus:${LEADER}`)
    // Navigation asserts no ranking, so it must not put a sentence on a card
    // either. Over-caveating is the mirror harm of over-gating: a disclosure
    // that appears where no claim was made teaches the user to ignore it.
    expect(caveat()).toBeNull()
  })

  it('NAVIGATION IS NOT DESIGNATION: `open_inspector` on the front-runner still executes under refusal', () => {
    const store = makeStore()
    const result = applyV5State(
      envelope(
        ADMISSION_QUANTIFIED_PROVISIONAL,
        directive('open_inspector', [{ id: LEADER, label: MAC, kind: 'option' }]),
      ),
      store,
    )
    expect(store.selectNodeWithoutHistory).toHaveBeenCalledWith(LEADER)
    expect(result.applied).toContain(`ui_directive:open_inspector:${LEADER}`)
    expect(caveat()).toBeNull()
  })

  it('the ungated set is EXACTLY {focus, open_inspector} — REDs if it grows OR shrinks', () => {
    expect([...KNOWN_UNGATED].sort()).toEqual(['focus', 'open_inspector'])
  })

  // ══════════════════════════════════════════════════════════════════════════
  // THE KNOWN GAP, PINNED. A honest gap recorded in the suite is honest; a gap
  // invisible to it is how a defect ships twice.
  // ══════════════════════════════════════════════════════════════════════════
  it('KNOWN GAP: with NO analysis_result block in the envelope there is no leader identity, so nothing is gated', () => {
    const result = applyV5State(
      envelope(
        ADMISSION_QUANTIFIED_PROVISIONAL,
        directive('highlight', [{ id: LEADER, label: MAC, kind: 'option' }]),
        { withAnalysisResult: false },
      ),
      makeStore(),
    )
    // Documents TODAY'S behaviour so a future change to it is visible, and
    // states why: the applicator cannot read the store's admission/results
    // slices at this point in the envelope (they are written in steps 4 and 5).
    expect(pulseMock).toHaveBeenCalledTimes(1)
    expect(result.applied).toContain(`ui_directive:highlight:${LEADER}`)
    // ⚠ AND THE GAP IS NOW ONE STEP WORSE, WHICH IS WHY IT IS RESTATED HERE
    // RATHER THAN INHERITED. Under #1284 this gap left a highlight UNGATED;
    // under the ruling it leaves a highlight UNCAVEATED — the very silent claim
    // the P0 is about. The trade is unchanged and still the right one (the
    // alternative is caveating turns whose leader identity is unknown, which
    // would put the sentence on cards no directive designated), but it is a
    // live hole and it is named, not hidden.
    expect(caveat()).toBeNull()
  })

  // ══════════════════════════════════════════════════════════════════════════
  // ⭐⭐ THE CAVEAT CANNOT OUTLIVE ITS TURN — the ONE GLOBAL SLOT objection
  // (PR #747). The canvas holds one set of marks while the transcript holds
  // every answer, so a sentence left by an older turn is read against a newer
  // one. These two cases are what make "it belongs to the turn on screen" a
  // property of the code rather than of the fixtures.
  // ══════════════════════════════════════════════════════════════════════════
  it('A LATER LICENSED TURN RETIRES THE CAVEAT — the applicator writes the slice every run', () => {
    applyV5State(
      envelope(
        ADMISSION_QUANTIFIED_PROVISIONAL,
        directive('highlight', [{ id: LEADER, label: MAC, kind: 'option' }]),
      ),
      makeStore(),
    )
    // PRECONDITION PINNED IN-TEST: the caveat really is set before the second
    // turn, so a null below is the retirement and not a fixture that never set
    // it (trap 13b — a guard whose discrimination depends on an unpinned
    // fixture is decorative).
    expect(caveat()).toBe(LEADER)

    applyV5State(
      envelope(ADMISSION_PERMITTED, directive('highlight', [{ id: LEADER, label: MAC, kind: 'option' }])),
      makeStore(),
    )
    expect(caveat()).toBeNull()
  })

  it('A TURN WITH NO DIRECTIVE AT ALL ALSO RETIRES IT — the write is unconditional', () => {
    applyV5State(
      envelope(
        ADMISSION_QUANTIFIED_PROVISIONAL,
        directive('highlight', [{ id: LEADER, label: MAC, kind: 'option' }]),
      ),
      makeStore(),
    )
    expect(caveat()).toBe(LEADER)

    // An ordinary conversational turn — no ui_directive anywhere in it.
    applyV5State(baseResponse({ assistant_text: 'Tell me more about cost.' }), makeStore())
    expect(caveat()).toBeNull()
  })

  it('A STALE TURN RETIRES NOTHING — all writes are dropped, this one included', () => {
    applyV5State(
      envelope(
        ADMISSION_QUANTIFIED_PROVISIONAL,
        directive('highlight', [{ id: LEADER, label: MAC, kind: 'option' }]),
      ),
      makeStore(),
    )
    expect(caveat()).toBe(LEADER)

    // A late-arriving older response. The stale guard returns before every
    // write; the caveat must be inside that protection, not outside it, or an
    // overtaken turn could strip the sentence off a highlight still on screen.
    const stale = applyV5State(
      envelope(ADMISSION_PERMITTED, directive('highlight', [{ id: LEADER, label: MAC, kind: 'option' }])),
      makeStore(),
      { turnClientId: 'turn-old', currentClientTurnId: 'turn-new' },
    )
    expect(stale.deferred.some((d) => d.reason === 'stale_turn_all_writes_skipped')).toBe(true)
    expect(caveat()).toBe(LEADER)
  })
})
