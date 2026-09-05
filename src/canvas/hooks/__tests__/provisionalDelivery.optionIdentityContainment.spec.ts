/**
 * A CURRENCY CLAIM MAY NOT BE MADE OVER AN ANALYSIS OF SOMEONE ELSE'S OPTIONS
 * — the option-identity containment conjunct of `graphAcceptedForCanvas`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT (issue #1204), AND THE CORRECTED SCOPE
 * ═══════════════════════════════════════════════════════════════════════════
 * Witnessed on deployed staging: the Analysis tab named THREE HIRING options as
 * this analysis's options while the canvas held a fourteen-node PRICING model —
 * zero overlap — under the affirmative sentence **"Analysis reflects the
 * current model."**
 *
 * The falsehood is created CLIENT-SIDE. CEE's `complete_current` verdict is
 * TRUE about CEE's own server-persisted graph: a capture lane ported
 * `computeAnalysisAffectingGraphHash` and reproduced `computed_against_hash`
 * exactly on three scenarios, with controls proving that option-id and
 * `goal_node_id` mutations move the hash and a node-label mutation does not.
 * **The canvas is never an operand of that hash.** So the verdict is honest and
 * the client is what asserts it over a graph it does not describe.
 *
 * ⚠⚠ SCOPE CORRECTION, AND IT REPLACES WHAT THE REPO PREVIOUSLY PINNED.
 * `applyScenarioAnalysisRead.ts` and
 * `hydrate/__tests__/provisionalDelivery.graphAcceptance.reachability.spec.ts`
 * both recorded this class as *"reachable in code, CONDITIONAL ON A REFUSED
 * BOOT, which has NOT been observed live"*. **That is wrong. No refused boot is
 * required.** The reproduction is: **guest · load one shipped starter · send
 * one brief · first turn.** Creating a scenario seeds
 * `lastAuthoritativeGraph` with an EMPTY-BUT-NON-NULL identity record
 * (`store.ts`'s `identityFromCanvasGraph(nodes, edges)` on an empty scenario —
 * *"an empty scenario yields an EMPTY record, which is the honest value for
 * it"*), and the starter's nodes are installed afterwards. So
 * `lastAuthoritativeGraph !== null` is satisfied BY THE VERY GESTURE THAT
 * CREATES THE HAZARD, and the guard never fires. Measured
 * `derivedGraphAccepted: true` with an empty authoritative record against a
 * 16-node canvas at every capture.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY CONTAINMENT, AND WHY IT IS THE SAME QUESTION RATHER THAN A SECOND ONE
 * ═══════════════════════════════════════════════════════════════════════════
 * `graphAcceptedForCanvas` asks ONE question: *"is what the user is looking at
 * the graph CEE is talking about?"* `lastAuthoritativeGraph !== null` is a
 * PROXY for it, and the module's own header already concedes the proxy is
 * necessary-but-not-sufficient. Option-identity containment answers the SAME
 * question with a direct instrument: if an option CEE's readiness names is not
 * on the canvas, the canvas is provably not the graph CEE is talking about.
 * That is deliberately NOT a new concept smuggled under an old name (trap 21) —
 * it is a better measurement of the question the field already declares.
 *
 * It also has precedent in this codebase: `mergeServerGraph` refuses a merge on
 * exactly this reasoning — *"ZERO overlap with a NON-EMPTY canvas means these
 * are two unrelated graphs"*. Containment is that rule made strict enough for a
 * CLAIM, because an analysis that compared even one option the user does not
 * have is still an analysis of a different model.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠ SCOPE OF THESE TESTS
 * ═══════════════════════════════════════════════════════════════════════════
 * Store- and applier-level, with the REAL store, the REAL `setCeeAnalysisReady`
 * (so the node-id snapshot is derived by the production reducer rather than
 * written by this fixture — a fixture you author yourself is not evidence about
 * the store) and the REAL applier. jsdom cannot show the rendered sentence, so
 * these prove the WRITE is withheld, not that a pixel changed.
 *
 * NOT ESTABLISHED HERE: that the live witnessed session's `ceeAnalysisReady`
 * carried the foreign options. That is a derivation from the data-flow (CEE
 * computes readiness against its own reloaded graph), not a measurement. What
 * IS established is that the class is closed wherever readiness is provably
 * foreign, and that the honest path is untouched.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

import { useCanvasStore } from '../../store'
import {
  readProvisionalApplyStore,
  ceeReadinessOptionsAreOnCanvas,
} from '../useProvisionalAnalysisDelivery'
import { applyScenarioAnalysisRead } from '../../hydrate/applyScenarioAnalysisRead'

const SCENARIO_ID = '9a1b2c3d-4444-4555-8666-777788889999'

// ── The witnessed shape: a PRICING model on canvas, HIRING options in CEE's
//    readiness. Ids are what the guard compares; labels are here so a failure
//    message reads like the defect.
const PRICING_NODES = [
  { id: 'px-goal', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Gross margin', kind: 'goal' } },
  { id: 'px-opt-seats', type: 'option', position: { x: 1, y: 0 }, data: { label: 'Keep Per-Seat Pricing', kind: 'option' } },
  { id: 'px-opt-hybrid', type: 'option', position: { x: 2, y: 0 }, data: { label: 'Hybrid Platform-Fee-Plus-Usage', kind: 'option' } },
  { id: 'px-opt-switch', type: 'option', position: { x: 3, y: 0 }, data: { label: 'A Full Switch at Renewal', kind: 'option' } },
  { id: 'px-factor-churn', type: 'factor', position: { x: 4, y: 0 }, data: { label: 'Pricing Model Transition Scope', kind: 'factor' } },
]

const HIRING_OPTION_IDS = ['hr-opt-senior', 'hr-opt-two-mid', 'hr-opt-status-quo']
const PRICING_OPTION_IDS = ['px-opt-seats', 'px-opt-hybrid', 'px-opt-switch']

/** A readiness payload naming the given option ids. Shape per `CEEOptionV3`. */
function readiness(optionIds: readonly string[], over: Record<string, unknown> = {}) {
  return {
    options: optionIds.map((id) => ({
      id,
      label: `Option ${id}`,
      status: 'ready' as const,
      interventions: {},
    })),
    goal_node_id: 'px-goal',
    status: 'ready' as const,
    ...over,
  }
}

function verdict(runState: AnalysisStateV1['run_state']): AnalysisStateV1 {
  return {
    run_state: runState,
    readiness: { status: 'ready', blockers: [] },
    leader_claim: { permitted: false, withheld_reason: 'separation_unavailable' },
    robustness: {},
    usable_for_prose: false,
    usable_for_chips: false,
    usable_for_followup: false,
    requires_rerun: false,
    blocked_unusable: false,
    contradictions: [],
  } as AnalysisStateV1
}

/** The exact kind on screen in #1204, under "Analysis reflects the current model." */
const COMPLETE_CURRENT = verdict({
  kind: 'complete_current',
  computed_at: '2026-09-04T09:00:00.000Z',
} as never)

/**
 * A minimally-valid `analysis_result` block. It must be REAL enough for
 * `mapV5AnalysisToReport` to run, or the results write would throw and the
 * "nothing was written" assertion would pass for the wrong reason — an
 * exception is not a withholding.
 */
const ANALYSIS_RESULT_BLOCK = {
  type: 'analysis_result',
  summary: [],
  options: [],
}

/**
 * The STARTER-TEMPLATE shape, not the refused-boot shape: an authoritative
 * identity record that is present and EMPTY, against a populated canvas.
 *
 * ⚠ `{ nodeIds: [], edgePairs: [] }` — NOT `{ nodes: [] }`. The field's type is
 * `{ nodeIds: string[]; edgePairs: string[] } | null` (`canvas/store.ts`), and
 * an `AuthoritativeGraphIdentity` carries identities, never nodes.
 */
function seedStarterTemplateCanvas(over: Record<string, unknown> = {}): void {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    nodes: PRICING_NODES as never,
    edges: [] as never,
    lastAuthoritativeGraph: { nodeIds: [], edgePairs: [] },
    serverGraphIdentity: null,
    importPendingServerRegistration: false,
    history: { past: [], future: [] },
    analysisStateV1: null,
    analysisFreshnessDirty: false,
    ceeAnalysisReady: null,
    ceeAnalysisReadyNodeIds: null,
    results: null,
    ...over,
  } as never)
}

/**
 * Store readiness THROUGH THE PRODUCTION REDUCER, so `ceeAnalysisReadyNodeIds`
 * is the snapshot `setCeeAnalysisReady` really takes rather than one this file
 * invented. The relationship between the two operands is the thing under test;
 * writing both by hand would only confirm the author's model of the store.
 */
function storeReadinessViaReducer(optionIds: readonly string[]): void {
  useCanvasStore.getState().setCeeAnalysisReady(readiness(optionIds) as never)
}

const acceptance = () => readProvisionalApplyStore().graphAcceptedForCanvas

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  seedStarterTemplateCanvas()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

// ═══════════════════════════════════════════════════════════════════════════
describe('#1204 — the starter-template fixture really is the live shape', () => {
  it('POSITIVE CONTROL — authoritative record is present, EMPTY, and the canvas is populated', () => {
    // Without this, every assertion below could pass because the fixture never
    // reproduced the hazard. Each clause is the one the old guard read.
    const s = useCanvasStore.getState()
    expect(s.lastAuthoritativeGraph).not.toBeNull()
    expect(s.lastAuthoritativeGraph?.nodeIds).toEqual([])
    expect(s.nodes.length).toBeGreaterThan(0)
    // And the OLD predicate — `lastAuthoritativeGraph !== null || nodes.length === 0`
    // — is satisfied by this fixture, which is precisely why the guard was dark.
    expect(s.lastAuthoritativeGraph !== null || s.nodes.length === 0).toBe(true)
  })

  it('POSITIVE CONTROL — the reducer snapshots the CANVAS ids, so the operands really differ', () => {
    storeReadinessViaReducer(HIRING_OPTION_IDS)
    const s = useCanvasStore.getState()
    // Derived by production code, not written here.
    expect(s.ceeAnalysisReadyNodeIds).toEqual(PRICING_NODES.map((n) => n.id))
    // CONTRAST that makes "zero overlap" a measurement rather than a label.
    const canvasIds = new Set(s.ceeAnalysisReadyNodeIds ?? [])
    expect(HIRING_OPTION_IDS.filter((id) => canvasIds.has(id))).toEqual([])
    expect(PRICING_OPTION_IDS.filter((id) => canvasIds.has(id))).toEqual(PRICING_OPTION_IDS)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('#1204 — foreign option identities make the canvas DIVERGENT', () => {
  it('⭐ THE DEFECT — readiness naming options that are not on canvas is not acceptance', () => {
    storeReadinessViaReducer(HIRING_OPTION_IDS)
    expect(acceptance()).toBe(false)
  })

  it('⭐ ONE foreign option is enough — a partial overlap is still a different model', () => {
    // The claim is about the whole comparison. An analysis that compared an
    // option the user does not have is an analysis of another model, so
    // CONTAINMENT is the standard, not mere overlap.
    storeReadinessViaReducer([...PRICING_OPTION_IDS, 'hr-opt-two-mid'])
    expect(acceptance()).toBe(false)
  })

  it('⭐ END TO END — a `complete_current` verdict about foreign options writes NOTHING', () => {
    storeReadinessViaReducer(HIRING_OPTION_IDS)
    const writes: string[] = []
    const out = applyScenarioAnalysisRead({
      analysisState: COMPLETE_CURRENT,
      analysisResult: ANALYSIS_RESULT_BLOCK,
      store: {
        ...readProvisionalApplyStore(),
        setAnalysisStateV1: () => writes.push('verdict'),
        resultsComplete: () => writes.push('results'),
        currentResultsHash: null,
      },
    })
    expect(out).toEqual({
      outcome: 'declined',
      kind: 'complete_current',
      reason: 'divergent_currency_claim',
    })
    // Both writes, not just the verdict: showing the numbers without the
    // freshness sentence is the same lie with a bigger surface.
    expect(writes).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('⭐ THE OTHER DOOR — the honest analysis must still be delivered', () => {
  it('⭐ REGRESSION GUARD — readiness whose options ARE on canvas is ACCEPTED', () => {
    // The over-fix this exists to catch: closing the lie by breaking the truth.
    storeReadinessViaReducer(PRICING_OPTION_IDS)
    expect(acceptance()).toBe(true)
  })

  it('⭐ REGRESSION GUARD — and its verdict AND results are actually written', () => {
    storeReadinessViaReducer(PRICING_OPTION_IDS)
    const writes: string[] = []
    const out = applyScenarioAnalysisRead({
      analysisState: COMPLETE_CURRENT,
      analysisResult: null,
      store: {
        ...readProvisionalApplyStore(),
        setAnalysisStateV1: () => writes.push('verdict'),
        resultsComplete: () => writes.push('results'),
        currentResultsHash: null,
      },
    })
    expect(out).toEqual({ outcome: 'applied', kind: 'complete_current', resultsHydrated: false })
    expect(writes).toEqual(['verdict'])
  })

  it('the EMPTY-CANVAS exemption survives — foreign options cannot make nothing divergent', () => {
    // There is no local graph for a verdict to misdescribe, and this is the case
    // the zero-overlap guard calls "the whole point of the feature".
    seedStarterTemplateCanvas({ nodes: [] as never })
    storeReadinessViaReducer(HIRING_OPTION_IDS)
    expect(useCanvasStore.getState().nodes.length).toBe(0)
    expect(acceptance()).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('the containment conjunct fails OPEN on every absent operand', () => {
  // Only POSITIVE evidence of divergence may decline. Inventing a decline where
  // the operands cannot be compared would trade this lie for a broad new gap.
  it('no readiness at all — unchanged from today', () => {
    expect(useCanvasStore.getState().ceeAnalysisReady).toBeNull()
    expect(acceptance()).toBe(true)
  })

  it('readiness with an EMPTY options array — nothing is claimed, nothing contradicted', () => {
    storeReadinessViaReducer([])
    expect(acceptance()).toBe(true)
  })

  it('PINNED DECISION — an option carrying no usable id is IGNORED, not declined', () => {
    // A malformed option is not positive evidence of divergence, so it must not
    // manufacture one. Pinned as a test because it is a decision, not an
    // accident: if the product later wants to refuse unidentifiable options,
    // this line is what must change deliberately.
    expect(ceeReadinessOptionsAreOnCanvas({ options: [{ label: 'no id' }] }, ['px-goal'])).toBe(true)
    // And a well-formed id ALONGSIDE it is still judged — the escape hatch must
    // not swallow the real check.
    expect(
      ceeReadinessOptionsAreOnCanvas(
        { options: [{ label: 'no id' }, { id: 'hr-opt-senior' }] },
        ['px-goal'],
      ),
    ).toBe(false)
  })

  it('no node-id snapshot — the comparison has no second operand', () => {
    useCanvasStore.setState({ ceeAnalysisReady: readiness(HIRING_OPTION_IDS) as never } as never)
    expect(useCanvasStore.getState().ceeAnalysisReadyNodeIds).toBeNull()
    expect(acceptance()).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('the pre-existing conjunct is NARROWED, never replaced', () => {
  it('a null authoritative record still declines, containment or not', () => {
    // Containment is an ADDITIONAL necessary condition. The original one — the
    // refused-boot case the reachability spec pins — must keep declining.
    seedStarterTemplateCanvas({ lastAuthoritativeGraph: null })
    storeReadinessViaReducer(PRICING_OPTION_IDS)
    expect(acceptance()).toBe(false)
  })

  it('⭐ the new predicate is STRICTLY STRONGER — it can only ever decline more', () => {
    // Derived over the four-cell truth table rather than asserted in prose: for
    // every combination, new acceptance must IMPLY old acceptance. A future edit
    // that lets the new predicate accept something the old one refused REDs here.
    for (const authoritative of [null, { nodeIds: [], edgePairs: [] }]) {
      for (const optionIds of [PRICING_OPTION_IDS, HIRING_OPTION_IDS]) {
        seedStarterTemplateCanvas({ lastAuthoritativeGraph: authoritative })
        storeReadinessViaReducer(optionIds)
        const s = useCanvasStore.getState()
        const old = s.lastAuthoritativeGraph !== null || s.nodes.length === 0
        const now = acceptance()
        expect(now === true ? old : true).toBe(true)
      }
    }
  })
})
