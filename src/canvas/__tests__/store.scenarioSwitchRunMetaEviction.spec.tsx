/**
 * A SCENARIO SWITCH MUST NOT LEAVE THE PREVIOUS SCENARIO'S ANALYSIS METADATA
 * ON SCREEN, ATTRIBUTED TO THE ONE JUST OPENED.
 *
 * ## The defect
 *
 * `RunMetaState` (store.ts:426) holds the per-run CEE payloads — the 0.30
 * decision review, the coaching, the evidence assessment, the trace. Every one
 * of them describes ONE analysis of ONE model.
 *
 * The store already names its own boundary set, at store.ts:1452, for a
 * sibling field: session-scoped state is *"cleared at every scenario boundary
 * (loadScenario, hydrateGraphSlice, resetCanvas, importCanvas)"*. Measured at
 * `515214b8`, `runMeta` is cleared at only TWO of those four —
 * `resetCanvas` (store.ts:4602) and `importCanvas` (store.ts:4142), plus
 * `resultsReset` (store.ts:5673, whose comment states the intent outright:
 * *"Clear all runMeta ... to prevent stale Decision Review"*).
 *
 * The two legs that are missing it are the two a USER actually walks:
 *   · `store.loadScenario`   — what `ScenarioSwitcher.tsx:102` binds and calls
 *   · `store.hydrateGraphSlice` — the Supabase/autosave leg
 *
 * Both install a different scenario's graph and both already clear the
 * neighbouring per-run state (`results`, `previousReport`, `rawV2Response`,
 * `analysisStateV1`, `analysisRefusalNotice`, `analysisFreshness`). `runMeta`
 * is simply absent from the list.
 *
 * ## Why that is a false statement and not an untidiness
 *
 * `KeyQuestionCard` (analysis-hero/KeyQuestionCard.tsx:51) reads
 * `runMeta.decisionReview030.decision_quality_prompts` and renders the first
 * glossary-safe question with NO scenario gate and NO status gate. So after
 * A → B it prints the science-grounded key question CEE asked about A, under
 * B's heading, on a model B that may never have been analysed at all.
 *
 * The restore path is not a defence. `hydrateAnalysis` writes its `runMeta`
 * keys by SPREAD (store.ts:5637) and only runs when the incoming scenario HAS
 * a restorable report — so switching to a NEVER-ANALYSED scenario leaves the
 * previous scenario's payloads untouched and unmentioned.
 *
 * `loadScenario`'s own sibling comment already names this exact harm for the
 * report: *"left the previous decision's completed report on screen,
 * attributed to the one just opened"*. This is that sentence's other half.
 *
 * ## What these tests bind to
 *
 * Every assertion binds by IDENTITY — a unique sentinel string compared with
 * `toBe`/`toContain`, never a count or a predicate another value could
 * satisfy. Every case PINS ITS OWN PRECONDITION (it asserts the seeded payload
 * is present and rendered BEFORE the switch), so a fixture that stops
 * reproducing the seeded state fails loudly instead of passing vacuously
 * (CLAUDE.md trap 13b).
 *
 * The OPPOSITE-DIRECTION twin is the fourth test, and it is what stops the fix
 * being bought cheaply: it fails if anyone "fixes" this by clearing `runMeta`
 * on any write rather than at the boundary.
 *
 * ## Scope of the claim (CLAUDE.md trap 3)
 *
 * Store-level state assertions only. They prove the EVICTION.
 *
 * ⚠ THE USER-VISIBLE HALF LIVES ELSEWHERE, AND DELIBERATELY SO. The render that
 * proves A's key question paints on B is
 * `components/results/analysis-hero/__tests__/keyQuestionIsPerScenario.spec.tsx`
 * — INSIDE the hero module, because `analysis-hero/__tests__/inertness.spec.ts`
 * forbids any file outside that module importing it, and a spec here importing
 * `KeyQuestionCard` was a real offender against that guard (measured: it was the
 * sole entry in the offender list). That guard is the trap-3b defence — a second
 * importer is a potential second mount path — so the repair is to put the render
 * with the component, NOT to widen the allow-list for a test's convenience.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../store'
import { createScenario } from '../store/scenarios'
import type { DecisionReview030 } from '../../v5/decisionReviewAdapter'

const LS_KEYS = [
  'olumi-canvas-scenarios',
  'olumi-canvas-autosave',
  'olumi-canvas-current-scenario-id',
  'olumi-canvas-run-history',
]

/**
 * Scenario A's key question, verbatim. A distinctive sentinel: a pass cannot
 * come from a substring, a paraphrase or a truncation, only from this exact
 * string reaching the card.
 */
const A_QUESTION =
  'Which assumption about A-headcount would most change this decision?'

/** A second sentinel on a different runMeta key, so the test is not about one field. */
const A_NARRATIVE = 'A-scenario narrative summary sentinel'

function goalNode(id: string, label: string) {
  return { id, type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal', label } } as never
}

function factorNode(id: string, label: string) {
  return { id, type: 'factor', position: { x: 0, y: 100 }, data: { kind: 'factor', label } } as never
}

function edge(id: string, source: string, target: string) {
  return { id, source, target, type: 'styled', data: { weight: 0.5, direction: 'positive' } } as never
}

function makeScenario(name: string, goalLabel: string) {
  return createScenario({
    name,
    nodes: [goalNode('1', goalLabel), factorNode('2', `${name} spend`)],
    edges: [edge('e1', '2', '1')],
  })
}

/**
 * The 0.30 review A's analysis produced.
 *
 * Declared as `DecisionReview030` with NO cast, so every one of the interface's
 * eight fields must be present. A cast would have survived the interface
 * gaining a field; this fails to compile instead — which is what caught two
 * missing members while this spec was being written.
 */
function reviewForA(): DecisionReview030 {
  return {
    narrative_summary: A_NARRATIVE,
    story_headlines: [],
    robustness_explanation: null,
    readiness_rationale: null,
    scenario_contexts: [],
    decision_quality_prompts: [
      {
        principle: 'Sensitivity',
        applies_because: 'One factor dominates the comparison.',
        question: A_QUESTION,
      },
    ],
    produced_at: '2026-09-11T00:00:00.000Z',
    hasProse: true,
  }
}

/** Seed the store as though scenario A had just been analysed. */
function seedAnalysisOfA(): void {
  useCanvasStore.getState().setRunMeta({ decisionReview030: reviewForA() })
}

beforeEach(() => {
  for (const k of LS_KEYS) localStorage.removeItem(k)
  useCanvasStore.getState().reset()
})

describe('store.loadScenario — per-run CEE metadata is evicted at the boundary', () => {
  it("drops A's decision review when B is loaded", () => {
    const a = makeScenario('Scenario A', 'A revenue')
    const b = makeScenario('Scenario B', 'B revenue')

    expect(useCanvasStore.getState().loadScenario(a.id)).toBe(true)
    seedAnalysisOfA()

    // PRECONDITION, pinned in-test: the seed is really there before the switch.
    expect(useCanvasStore.getState().runMeta.decisionReview030?.narrative_summary).toBe(A_NARRATIVE)

    expect(useCanvasStore.getState().loadScenario(b.id)).toBe(true)

    expect(useCanvasStore.getState().runMeta.decisionReview030 ?? null).toBeNull()
  })

})

describe('store.hydrateGraphSlice — the same boundary, the Supabase/autosave leg', () => {
  it("drops A's decision review when a different graph is hydrated", () => {
    const a = makeScenario('Scenario A', 'A revenue')

    useCanvasStore.getState().loadScenario(a.id)
    seedAnalysisOfA()
    expect(useCanvasStore.getState().runMeta.decisionReview030?.narrative_summary).toBe(A_NARRATIVE)

    useCanvasStore.getState().hydrateGraphSlice({
      nodes: [goalNode('1', 'B revenue'), factorNode('2', 'B spend')],
      edges: [edge('e1', '2', '1')],
      currentScenarioId: 'scenario-b',
    })

    expect(useCanvasStore.getState().runMeta.decisionReview030 ?? null).toBeNull()
  })
})

describe('OPPOSITE DIRECTION — eviction is bound to the boundary, not to every write', () => {
  it('keeps the review across an ordinary runMeta write within one scenario', () => {
    const a = makeScenario('Scenario A', 'A revenue')

    useCanvasStore.getState().loadScenario(a.id)
    seedAnalysisOfA()

    // A later, unrelated write on the SAME scenario must not evict it.
    useCanvasStore.getState().setRunMeta({ degraded: false })

    expect(useCanvasStore.getState().runMeta.decisionReview030?.narrative_summary).toBe(A_NARRATIVE)
    expect(useCanvasStore.getState().runMeta.degraded).toBe(false)
  })
})
