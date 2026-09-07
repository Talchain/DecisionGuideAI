/**
 * ⛔ P0 — THE CANVAS CAN BE POINTED AT AN OPTION THE PRODUCT MAY NOT NAME.
 *
 * Measured on deployed staging: inside ONE HTTP 200, the assistant text said
 * "No single option can be put forward yet" (twice) while a `ui_directive`
 * block told the UI to highlight the leading option — and the canvas obeyed.
 *
 * Every TEXTUAL leader designation already withholds correctly (the "Leading
 * option" pill, the robustness badge, "Leads via", "Behind:", the close-call
 * marker, the decision headline and bar). The HIGHLIGHT was the one un-ruled
 * hole, and it is the worst kind: **a silent visual claim, because nothing on
 * screen admits a claim is being made.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHICH QUESTION THIS SUITE'S GATE ANSWERS (trap 21 is live in this seam)
 * ═══════════════════════════════════════════════════════════════════════════
 * "MAY THIS TURN VISUALLY SINGLE OUT THE FRONT-RUNNING OPTION ON THE CANVAS?"
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

const DEFER_REASON = 'ui_directive_leader_designation_withheld'

beforeEach(() => {
  pulseMock.mockClear()
  assistantFocusMock.mockClear()
})

describe('applyV5State — a ui_directive may not visually designate a leader the model may not name', () => {
  // ══════════════════════════════════════════════════════════════════════════
  // THE P0 ITSELF
  // ══════════════════════════════════════════════════════════════════════════
  it('⛔ P0 (quantified_provisional): a highlight of the FRONT-RUNNER is withheld, not pulsed', () => {
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

    expect(pulseMock).not.toHaveBeenCalled()
    // Bind by IDENTITY, never a value predicate another object could satisfy.
    expect(result.applied).not.toContain(`ui_directive:highlight:${LEADER}`)
    expect(
      result.deferred.some((d) => d.reason === DEFER_REASON && d.detail === LEADER),
    ).toBe(true)
  })

  it('the withholding is STATED, not silent: the deferred record names the reason and the target', () => {
    const result = applyV5State(
      envelope(
        ADMISSION_QUANTIFIED_PROVISIONAL,
        directive('highlight', [{ id: LEADER, label: MAC, kind: 'option' }]),
      ),
      makeStore(),
    )
    const record = result.deferred.find((d) => d.reason === DEFER_REASON)
    expect(record).toBeDefined()
    expect(record?.detail).toBe(LEADER)
  })

  // ══════════════════════════════════════════════════════════════════════════
  // THE OTHER REFUSING MODES — `!== 'none'` would leak both of these
  // ══════════════════════════════════════════════════════════════════════════
  it.each([
    ['none', ADMISSION_NONE],
    ['exploratory', ADMISSION_EXPLORATORY],
    ['quantified_provisional', ADMISSION_QUANTIFIED_PROVISIONAL],
  ])('mode %s withholds the front-runner highlight', (_mode, admission) => {
    const result = applyV5State(
      envelope(admission, directive('highlight', [{ id: LEADER, label: MAC, kind: 'option' }])),
      makeStore(),
    )
    expect(pulseMock).not.toHaveBeenCalled()
    expect(result.deferred.some((d) => d.reason === DEFER_REASON)).toBe(true)
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
    expect(result.deferred.some((d) => d.reason === DEFER_REASON)).toBe(false)
  })

  it('ABSENCE ARM PRESERVED (pre-admission CEE): no analysis_admission ⇒ pulses exactly as before', () => {
    const result = applyV5State(
      envelope(undefined, directive('highlight', [{ id: LEADER, label: MAC, kind: 'option' }])),
      makeStore(),
    )
    expect(pulseMock).toHaveBeenCalledTimes(1)
    expect(result.applied).toContain(`ui_directive:highlight:${LEADER}`)
    expect(result.deferred.some((d) => d.reason === DEFER_REASON)).toBe(false)
  })

  it('SCOPED TO THE FRONT-RUNNER: a NON-leader option still pulses under the same refusal', () => {
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
    expect(result.deferred.some((d) => d.reason === DEFER_REASON)).toBe(false)
  })

  it('MIXED TARGETS: the front-runner is dropped, its rivals still pulse', () => {
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
    expect(arg.nodeIds).not.toContain(LEADER)
    expect(result.applied).toContain(`ui_directive:highlight:${RIVAL}`)
    expect(result.applied).not.toContain(`ui_directive:highlight:${LEADER}`)
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
    const result = applyV5State(
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
    expect(result.deferred.some((d) => d.reason === DEFER_REASON)).toBe(false)
  })

  it('AN EDGE is never a leader designation: an edge target is untouched under refusal', () => {
    const result = applyV5State(
      envelope(
        ADMISSION_QUANTIFIED_PROVISIONAL,
        directive('highlight', [{ id: 'e1', label: 'Influence', kind: 'edge' }]),
      ),
      makeStore(),
    )
    expect(pulseMock).toHaveBeenCalledTimes(1)
    expect(pulseMock.mock.calls[0][0].edgeIds).toContain('e1')
    expect(result.deferred.some((d) => d.reason === DEFER_REASON)).toBe(false)
  })

  // ══════════════════════════════════════════════════════════════════════════
  // BOTH HIGHLIGHT SUB-PATHS. A highlight carrying a note routes to the HELD
  // attention channel — a persistent marker, so a MORE prominent designation
  // than the 2s pulse. Gating one and not the other would leave the louder
  // half open.
  // ══════════════════════════════════════════════════════════════════════════
  it('THE ATTENTION CHANNEL TOO: a NOTE-carrying highlight of the front-runner is withheld', () => {
    const result = applyV5State(
      envelope(
        ADMISSION_QUANTIFIED_PROVISIONAL,
        directive('highlight', [{ id: LEADER, label: MAC, kind: 'option' }], {
          note: { move: 'challenge', title: 'Look here', body: 'This one leads.' },
        }),
      ),
      makeStore(),
    )
    expect(result.applied).not.toContain(`ui_directive:highlight:${LEADER}`)
    expect(result.deferred.some((d) => d.reason === DEFER_REASON)).toBe(true)
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
    expect(result.deferred.some((d) => d.reason === DEFER_REASON)).toBe(false)
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
    expect(result.deferred.some((d) => d.reason === DEFER_REASON)).toBe(false)
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
    expect(result.deferred.some((d) => d.reason === DEFER_REASON)).toBe(false)
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
  })
})
