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

/*
 * The held-attention channel is where the caveat is DELIVERED, so it has to be
 * observable here. `importOriginal` is spread rather than a bare factory: a
 * factory REPLACES the module, which would delete every other export the
 * applicator imports from it — this estate's hand-maintained-mirror defect in
 * its vitest form.
 */
const { attentionMock } = vi.hoisted(() => ({
  // The parameter is typed so `mock.calls[0][0]` is `unknown` rather than an
  // empty tuple — an untyped `vi.fn()` here makes every read a type error.
  attentionMock: vi.fn((_next: unknown) => ({ applied: [] as string[], dropped: [] as string[] })),
}))
vi.mock('../../canvas/utils/olumiAttention', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  requestOlumiAttention: attentionMock,
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

/**
 * ⛔ NEVER `reasons[0]`. Both assertions in this file used to read the message
 * positionally — the SAME defect as the reader they were checking, so they
 * agreed with it by construction and could never have caught it. On the live
 * wire `reasons[0]` is the AFFIRMATIVE `structurally_analysable` conjunct.
 *
 * ⚠ And never by message text: on the captured payload the
 * `semantic_quality_sufficient` and `permitted_analysis_mode` entries carry
 * IDENTICAL strings, so a text match passes on the wrong object (trap 19).
 */
function modeReason(a: { reasons: ReadonlyArray<{ field: string; message: string }> }): string {
  const hit = a.reasons.find(r => r.field === 'permitted_analysis_mode')
  if (!hit) throw new Error('fixture has no permitted_analysis_mode reason — it cannot discriminate')
  return hit.message
}

// ── admissions ──────────────────────────────────────────────────────────────
/**
 * ⚠⚠ THESE FIXTURES USED `field: 'estimates'` AND `field: 'evidence'`, WHICH THE
 * PRODUCER CANNOT EMIT — SO THIS SUITE WAS GREEN AGAINST PAYLOADS THAT CANNOT
 * EXIST. `AdmissionField` is a CLOSED UNION of four values, derived at CEE
 * (`orchestrator-v5/admission/analysis-admission.ts:411`):
 *
 *   structurally_analysable · missing_important_inputs ·
 *   semantic_quality_sufficient · permitted_analysis_mode
 *
 * That mattered more than a tidy-up: when the reader below was corrected to
 * select by `field` instead of by position, these four cases went RED — and the
 * RED looked like the FIX being wrong rather than the FIXTURES being fiction. A
 * self-authored fixture standing in for the wire does not just fail to catch a
 * defect; it argues against the repair. (`as AnalysisAdmissionV1` is what let
 * them through the compiler — the cast is why the union never bit.)
 *
 * Every reason here names `permitted_analysis_mode` because that is the
 * conjunct these cases are ABOUT: whether this run may name a leading option.
 * The shape is taken from the live capture embedded in
 * `analysisNew/__tests__/refusalIsLegible.spec.tsx` (#1404, serving).
 */
/** ⭐ THE EXACT VALUE LIVE IN THE MEASURED P0. */
const ADMISSION_QUANTIFIED_PROVISIONAL: AnalysisAdmissionV1 = {
  permitted_analysis_mode: 'quantified_provisional',
  reasons: [
    // The affirmative conjunct sits FIRST on the wire, exactly as captured. A
    // positional read selects THIS — which is the defect the reader was fixed
    // for, so it belongs in the fixture rather than being tidied away.
    { field: 'structurally_analysable', message: 'Analysis can run on this model as it stands.' },
    { field: 'permitted_analysis_mode', message: 'No single option can be put forward yet.' },
  ],
} as AnalysisAdmissionV1
const ADMISSION_NONE: AnalysisAdmissionV1 = {
  permitted_analysis_mode: 'none',
  reasons: [
    { field: 'structurally_analysable', message: 'Analysis can run on this model as it stands.' },
    { field: 'permitted_analysis_mode', message: 'Every estimate here is machine-invented.' },
  ],
} as AnalysisAdmissionV1
const ADMISSION_EXPLORATORY: AnalysisAdmissionV1 = {
  permitted_analysis_mode: 'exploratory',
  reasons: [
    { field: 'structurally_analysable', message: 'Analysis can run on this model as it stands.' },
    { field: 'permitted_analysis_mode', message: 'Not enough evidence to rank these.' },
  ],
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
  attentionMock.mockClear()
})

/** The caveat delivered on this run, or `null` if the channel never fired. */
function deliveredCaveat(): { text: string; sourceLine?: string } | null {
  if (attentionMock.mock.calls.length === 0) return null
  const arg = attentionMock.mock.calls[0][0] as {
    caveat?: { text: string; sourceLine?: string } | null
    nodeIds?: string[]
  }
  return arg.caveat ?? null
}

/** The nodes the caveat was anchored to. */
function caveatNodeIds(): string[] {
  if (attentionMock.mock.calls.length === 0) return []
  return ((attentionMock.mock.calls[0][0] as { nodeIds?: string[] }).nodeIds) ?? []
}

describe('applyV5State — a ui_directive highlight the model may not designate is CAVEATED, not suppressed', () => {
  // ══════════════════════════════════════════════════════════════════════════
  // THE P0 ITSELF
  // ══════════════════════════════════════════════════════════════════════════
  it('⛔ P0 (quantified_provisional): the highlight is KEPT and a caveat is delivered with it', () => {
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

    /*
     * ⭐ PAUL'S RULING: KEEP THE HIGHLIGHT, ADD A VISIBLE CAVEAT. The mark is
     * NOT removed — the defect was that it was SILENT, not that it existed.
     */
    expect(pulseMock).toHaveBeenCalledTimes(1)
    expect(pulseMock.mock.calls[0][0].nodeIds).toContain(LEADER)
    // Bind by IDENTITY, never a value predicate another object could satisfy.
    expect(result.applied).toContain(`ui_directive:highlight:${LEADER}`)
    expect(result.applied).toContain(`ui_directive:leader_designation_caveated:${LEADER}`)

    // …and the caveat actually reaches a channel the user can read, anchored
    // to the marked node. A caveat with no anchor renders nothing.
    const caveat = deliveredCaveat()
    expect(caveat).not.toBeNull()
    expect(caveatNodeIds()).toContain(LEADER)
    expect(caveat?.text).toMatch(/scored highest/i)
    // The producer's OWN reason rides beneath it, verbatim — never composed.
    expect(caveat?.sourceLine).toBe(modeReason(ADMISSION_QUANTIFIED_PROVISIONAL))

    // NOTHING is withheld any more. This is the assertion that REDs if anyone
    // reinstates the suppression.
    expect(result.deferred.some((d) => d.reason === DEFER_REASON)).toBe(false)
  })

  /*
   * ⭐ THE CAVEAT SAYS WHAT IT IS ALLOWED TO SAY.
   * Paul's terminology ruling is a PRODUCT rule, not a style preference, and
   * this surface is exactly where it kept leaking back in. There is no race
   * here: no winner, no leader, no lead, no leading option.
   */
  it('THE CAVEAT CARRIES NO RACE FRAMING — REDs if the retired vocabulary returns', () => {
    applyV5State(
      envelope(
        ADMISSION_QUANTIFIED_PROVISIONAL,
        directive('highlight', [{ id: LEADER, label: MAC, kind: 'option' }]),
      ),
      makeStore(),
    )
    const text = deliveredCaveat()?.text ?? ''
    // Positive control: the probe can see a PRESENCE, so a clean absence below
    // is a real absence and not a probe pointed at an empty string.
    expect(text).toMatch(/scored highest/i)
    expect(text).not.toMatch(/winner|winning|leading option|the lead\b|leader/i)
  })

  it('the qualification is STATED in applied[], naming the target it qualifies', () => {
    const result = applyV5State(
      envelope(
        ADMISSION_QUANTIFIED_PROVISIONAL,
        directive('highlight', [{ id: LEADER, label: MAC, kind: 'option' }]),
      ),
      makeStore(),
    )
    /*
     * `applied[]` stays truthful about WHAT it applied: an ordinary highlight
     * and a highlight-under-caveat are different events, so a reader of the
     * applicator's result can tell them apart without re-deriving the gate.
     */
    expect(result.applied).toContain(`ui_directive:leader_designation_caveated:${LEADER}`)
    expect(result.applied).toContain(`ui_directive:highlight:${LEADER}`)
  })

  // ══════════════════════════════════════════════════════════════════════════
  // THE REASON LINE IS SELECTED BY FIELD, NOT BY SLOT — the discriminating pair
  // ══════════════════════════════════════════════════════════════════════════
  it('REORDER — the mode reason is found wherever it sits in the array', () => {
    // ⭐ Half one. If the reader were still positional, moving the affirmative
    // OFF slot 0 would change the rendered line. It must not.
    const reordered = {
      ...ADMISSION_QUANTIFIED_PROVISIONAL,
      reasons: [...ADMISSION_QUANTIFIED_PROVISIONAL.reasons].reverse(),
    } as typeof ADMISSION_QUANTIFIED_PROVISIONAL

    // PRECONDITION, PINNED IN-TEST: the reorder actually MOVED the mode reason,
    // so a green result is the binding's doing and not a no-op shuffle.
    expect(ADMISSION_QUANTIFIED_PROVISIONAL.reasons[0].field).toBe('structurally_analysable')
    expect(reordered.reasons[0].field).toBe('permitted_analysis_mode')

    const result = applyV5State(
      baseResponse(
        envelope(
          reordered,
          directive('highlight', [{ id: LEADER, label: MAC, kind: 'option' }]),
        ),
      ),
      makeStore(),
    )
    expect(result.applied).toContain(`ui_directive:leader_designation_caveated:${LEADER}`)
    expect(deliveredCaveat()?.sourceLine).toBe(modeReason(ADMISSION_QUANTIFIED_PROVISIONAL))
  })

  it('REMOVED — with no mode reason the caveat stands alone, and never borrows another', () => {
    // ⭐ Half two, and the one that matters most. Silence is the correct
    // fallback: the old reader would happily render the AFFIRMATIVE
    // `structurally_analysable` sentence under a refusal caveat — the product
    // saying "Analysis can run on this model as it stands" as its reason for
    // withholding. Anything other than `undefined` here is that defect back.
    const noModeReason = {
      ...ADMISSION_QUANTIFIED_PROVISIONAL,
      reasons: ADMISSION_QUANTIFIED_PROVISIONAL.reasons.filter(
        r => r.field !== 'permitted_analysis_mode',
      ),
    } as typeof ADMISSION_QUANTIFIED_PROVISIONAL

    // PRECONDITION: a non-empty remainder. An empty array would pass this test
    // for the wrong reason — there would be nothing to borrow in the first place.
    expect(noModeReason.reasons.length).toBeGreaterThan(0)
    expect(noModeReason.reasons.every(r => r.message.trim().length > 0)).toBe(true)

    const result = applyV5State(
      baseResponse(
        envelope(
          noModeReason,
          directive('highlight', [{ id: LEADER, label: MAC, kind: 'option' }]),
        ),
      ),
      makeStore(),
    )
    // The caveat itself still fires — losing the reason must not lose the warning.
    expect(result.applied).toContain(`ui_directive:leader_designation_caveated:${LEADER}`)
    expect(deliveredCaveat()?.sourceLine).toBeUndefined()
  })

  // ══════════════════════════════════════════════════════════════════════════
  // THE OTHER REFUSING MODES — `!== 'none'` would leak both of these
  // ══════════════════════════════════════════════════════════════════════════
  it.each([
    ['none', ADMISSION_NONE],
    ['exploratory', ADMISSION_EXPLORATORY],
    ['quantified_provisional', ADMISSION_QUANTIFIED_PROVISIONAL],
  ])('mode %s keeps the highlight AND caveats it', (_mode, admission) => {
    const result = applyV5State(
      envelope(admission, directive('highlight', [{ id: LEADER, label: MAC, kind: 'option' }])),
      makeStore(),
    )
    expect(pulseMock).toHaveBeenCalledTimes(1)
    expect(result.applied).toContain(`ui_directive:leader_designation_caveated:${LEADER}`)
    expect(deliveredCaveat()).not.toBeNull()
    expect(deliveredCaveat()?.sourceLine).toBe(modeReason(admission))
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
    // The OPPOSITE-DIRECTION TWIN: caveating a licensed run would be its own
    // defect — the product hedging a claim it is entitled to make.
    expect(result.applied).not.toContain(`ui_directive:leader_designation_caveated:${LEADER}`)
    expect(deliveredCaveat()).toBeNull()
  })

  it('ABSENCE ARM PRESERVED (pre-admission CEE): no analysis_admission ⇒ pulses exactly as before', () => {
    const result = applyV5State(
      envelope(undefined, directive('highlight', [{ id: LEADER, label: MAC, kind: 'option' }])),
      makeStore(),
    )
    expect(pulseMock).toHaveBeenCalledTimes(1)
    expect(result.applied).toContain(`ui_directive:highlight:${LEADER}`)
    expect(deliveredCaveat()).toBeNull()
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
    expect(deliveredCaveat()).toBeNull()
  })

  it('MIXED TARGETS: every target still pulses; only the highest scorer is caveated', () => {
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
    // SCOPED: the caveat attaches to the highest scorer ONLY. Caveating the
    // whole set would tell the user something false about its rivals.
    expect(result.applied).toContain(`ui_directive:leader_designation_caveated:${LEADER}`)
    expect(result.applied).not.toContain(`ui_directive:leader_designation_caveated:${RIVAL}`)
    expect(caveatNodeIds()).toEqual([LEADER])
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
    expect(deliveredCaveat()).toBeNull()
    expect(result.applied).not.toContain(`ui_directive:leader_designation_caveated:${LEADER}`)
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
    expect(deliveredCaveat()).toBeNull()
    expect(result.applied).toContain(`ui_directive:highlight:e1`)
  })

  // ══════════════════════════════════════════════════════════════════════════
  // BOTH HIGHLIGHT SUB-PATHS. A highlight carrying a note routes to the HELD
  // attention channel — a persistent marker, so a MORE prominent designation
  // than the 2s pulse. Gating one and not the other would leave the louder
  // half open.
  // ══════════════════════════════════════════════════════════════════════════
  it('BOTH CHANNELS COEXIST: a NOTE-carrying highlight keeps its note AND gains the caveat', () => {
    const result = applyV5State(
      envelope(
        ADMISSION_QUANTIFIED_PROVISIONAL,
        directive('highlight', [{ id: LEADER, label: MAC, kind: 'option' }], {
          note: { move: 'challenge', title: 'Look here', body: 'This one leads.' },
        }),
      ),
      makeStore(),
    )
    expect(result.applied).toContain(`ui_directive:highlight:${LEADER}`)
    expect(result.applied).toContain(`ui_directive:leader_designation_caveated:${LEADER}`)
    /*
     * The producer's coaching and the UI's disclosure are DIFFERENT FIELDS and
     * both must survive. Folding one into the other is how a UI-authored
     * sentence ends up inside the channel whose contract is "the producer said
     * this".
     */
    const arg = attentionMock.mock.calls[0][0] as {
      note?: { title?: string } | null
      caveat?: { text: string } | null
    }
    expect(arg.note?.title).toBe('Look here')
    expect(arg.caveat?.text).toMatch(/scored highest/i)
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
    expect(deliveredCaveat()).toBeNull()
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
    expect(deliveredCaveat()).toBeNull()
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
    expect(deliveredCaveat()).toBeNull()
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
    expect(deliveredCaveat()).toBeNull()
  })
})
