/**
 * ⭐⭐ DOMAIN 3 (CONTEXT / MEMORY) ACCEPTANCE — COACHING PERSISTENCE, END TO END.
 *
 * WHY THIS FILE EXISTS. The Context/Memory journey witness was recorded
 * JOURNEY-WITNESSED PARTIAL: conversation + graph restore were witnessed, and
 * coaching persistence was NEITHER CONFIRMED NOR REFUTED — because the witness
 * run never ran an ANALYSIS, so `guidance.items.v1` was never written. An
 * unwitnessed capability is not a working one, and the prior lane was right to
 * refuse to call it dead. This file is the executable half of that settlement:
 * it drives the REAL producers of both halves so a single journey rerun has
 * something to agree with.
 *
 * ⚠ TWO DIFFERENT HARMS, AND THEY MUST NOT SHARE A PREDICATE.
 *   §A  COACHING VANISHES ON REFRESH. The user runs an analysis, gets eleven
 *       pieces of coaching, reloads, and the strip, the on-canvas markers and
 *       every inspector coaching section are empty.
 *   §B  STALE COACHING SURVIVES A LOCAL STRUCTURAL EDIT (N-23). The user
 *       changes the model and the advice about the PREVIOUS model stands.
 * A fix for either one, written alone, produces the other. "Persist everything
 * forever" closes §A and opens §B; "clear on every tick" closes §B and opens
 * §A. So the two are pinned separately here, and the mutants that settle them
 * are DIFFERENT mutants producing DIFFERENT reds (recorded in the PR).
 *
 * ⭐ WHAT MAKES THIS DIFFERENT FROM `guidanceStore.rehydration.spec.ts`, which
 * already covers the adoption gates well. That file drives the STORE with items
 * IT wrote. A fixture the author wrote is not evidence about the wire
 * (CLAUDE.md trap 16-inverse), and it cannot answer the question this domain is
 * actually stuck on: *does the coaching a REAL ANALYSIS mints survive a REAL
 * reload?* Everything below therefore comes from outside this lane's head:
 *
 *   - the guidance is minted by the real chain `parseV5Response` →
 *     `extractPhase3FromV5Response` → `toStoreGuidanceItem` →
 *     `setGuidanceItems`, exactly as `useConversation.ts:5074-5079` does it,
 *     from THREE INDEPENDENT LIVE ANALYSIS-TURN CAPTURES;
 *   - the analysis itself is completed through `applyV5State`, the live handler
 *     for the `analysis_result` block;
 *   - the reload round-trips the graph and the answer through the REAL autosave
 *     projection and `restoreAnalysisFromAutosave`, so the read-side graph hash
 *     is computed over the RESTORED nodes — not over the objects still in
 *     memory. That is the only shape that can see a hash which fails to survive
 *     serialisation, and it is the shape a reload actually has;
 *   - the persistence context installed here is the one the boot path installs
 *     (`ReactFlowGraph.tsx:1780-1783`): a REAL `generateGraphHash` over the live
 *     store, so the write-side hash MOVES with the graph. Every other guidance
 *     fixture in this tree pins a CONSTANT hash, which is the blind spot that
 *     let the stamp-laundering defect through once already.
 *
 * ⭐ MEASURED AT THE CAPTURES, AND IT DECIDES WHICH GATE IS LOAD-BEARING:
 * a real analysis turn pins EVERY guidance item with `valid_while.graph_hash`
 * (CEE's `graph_hash_at_generation`) and with NO `analysis_hash`. All three
 * captures agree. So on the live journey the analysis-hash limb of
 * `rehydrateGuidance` is NEVER EXERCISED, and whether the user's coaching
 * survives a refresh rests entirely on the UI-side graph-hash comparison. The
 * `analysis_hash` corpus in `guidanceStore.rehydration.spec.ts` is a real pin on
 * a limb the wire does not currently reach — kept, but it is not this journey.
 * Derive this again before relying on it; it is a fact about what CEE emits.
 *
 * CLAIM TYPE. These are PRODUCER→STORE→STORAGE→STORE claims driven by the real
 * modules. They do NOT prove `ReactFlowGraph` mounts the host or calls
 * `rehydrateGuidance` on the deployed build — jsdom cannot establish that, and
 * `guidanceInvalidationReachability.production.spec.tsx` §2 pins the mount at
 * the SOURCE instead. The rung above this one is a live journey rerun.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Node, Edge } from '@xyflow/react'

import { parseV5Response } from '../../../v5/responseParser'
import { extractPhase3FromV5Response } from '../../../v5/extractPhase3FromV5Response'
import { toStoreGuidanceItem } from '../useConversation'
import { useGuidanceInvalidationOnEdit } from '../useGraphEditEvents'
import {
  useGuidanceStore,
  setGuidancePersistenceContext,
  type GuidanceItem,
} from '../../stores/guidanceStore'
import { useCanvasStore } from '../../store'
import { loadAutosave, saveAutosave } from '../../store/scenarios'
import { projectAutosaveData, autosaveSourceFromStore } from '../../store/autosaveProjection'
import { restoreAnalysisFromAutosave } from '../../store/restoreAnalysisFromAutosave'
// ⚠ The SEEDLESS hash. Two `generateGraphHash` functions exist in this tree and
// the seed-bearing one lives in `store/runHistory`. The comparison this file is
// about must be seedless and identical at write and read time, so the alias is
// spelled at the import to make the twin explicit (same discipline as
// ReactFlowGraph.tsx:86).
import { generateGraphHash as uiGraphHashSeedless } from '../../utils/graphHash'
import { applyV5State, type V5ApplicatorStore } from '../../../v5/applyV5State'

const SCENARIO = 'e5f1a0c2-6b7d-4a8e-9c31-2f0d5b6a7e84'
const GUIDANCE_STORAGE_KEY = 'guidance.items.v1'

/**
 * Three independent live analysis turns. Breadth from outside this lane's head:
 * different decisions, different CEE tips, different coaching mixes.
 */
const LIVE_ANALYSIS_CAPTURES = [
  'live-analysis-turn-walkA-2026-08-04.json',
  'live-analysis-turn-T3-20260808T155759Z.json',
  'live-analysis-turn-no-critiques-2026-08-08.json',
] as const

function loadCapture(name: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(resolve(__dirname, '../../../v5/__tests__/fixtures/', name), 'utf8'),
  ) as Record<string, unknown>
}

function asResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * The REAL mint chain, in the order `useConversation.ts:5074-5079` runs it.
 * Returns what the producer put in the store, so every later assertion can be
 * made against the producer's own values rather than against literals this file
 * invented (trap 13c: a self-authored expectation is a wrong oracle waiting to
 * be certified by a green mutant kit).
 */
async function mintGuidanceFromLiveAnalysisTurn(name: string): Promise<GuidanceItem[]> {
  const parsed = await parseV5Response(asResponse(loadCapture(name)))
  if (parsed.kind !== 'response') {
    throw new Error(`capture ${name} failed to parse: ${parsed.kind}`)
  }
  const phase3 = extractPhase3FromV5Response(parsed.response)
  const items = phase3.guidanceItems.map(toStoreGuidanceItem)
  // The production call site is guarded on a non-empty list; reproduce it, so a
  // capture that stopped carrying coaching cannot silently mint an empty store
  // that every assertion below would then agree with.
  if (items.length > 0) {
    useGuidanceStore.getState().setGuidanceItems(items)
  }
  return items
}

function node(id: string, label: string, x = 0, y = 0): Node {
  return { id, type: 'factor', position: { x, y }, data: { label } }
}
function edge(id: string, source: string, target: string): Edge {
  return { id, source, target, data: {} }
}

const BASE_NODES: Node[] = [
  node('fac_adoption_risk', 'User Adoption Uncertainty'),
  node('fac_cost', 'Annual Running Cost', 200, 0),
  { id: 'opt_keep', type: 'option', position: { x: 400, y: 0 }, data: { label: 'Keep Current CRM' } } as Node,
]
const BASE_EDGES: Edge[] = [edge('e1', 'fac_adoption_risk', 'opt_keep')]

function guidanceIds(): string[] {
  return useGuidanceStore.getState().guidanceItems.map((i) => i.item_id)
}

/** What a reload would find on disk — the blob, not the in-memory store. */
function persistedBlob(): { items?: GuidanceItem[] } | null {
  const raw = sessionStorage.getItem(GUIDANCE_STORAGE_KEY)
  return raw ? (JSON.parse(raw) as { items?: GuidanceItem[] }) : null
}

/** The live V5 `analysis_result` block shape (same fixture family as the leave-and-return spec). */
const analysisBlock = {
  type: 'analysis_result' as const,
  summary: 'Keep Current CRM (Status Quo) leads by about 72 percentage points.',
  leading_option_id: 'opt_keep',
  win_probabilities: { opt_keep: 0.86 },
  enrichment: {
    factor_sensitivity: [
      {
        factor_id: 'fac_adoption_risk',
        factor_label: 'User Adoption Uncertainty',
        sensitivity: 0.75,
        direction: 'positive' as const,
      },
    ],
  },
}

function v5AnalysisResponse(): never {
  return {
    response_version: 2,
    assistant_text: '',
    blocks: [analysisBlock],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
  } as never
}

/** The applicator built from the REAL store — never a double (trap 16). */
function realApplicatorStore(): V5ApplicatorStore {
  const s = useCanvasStore.getState()
  return {
    setCurrentStage: s.setCurrentStage,
    updateNode: s.updateNode,
    updateEdgeData: s.updateEdgeData,
    setRunMeta: s.setRunMeta,
    setCeeAnalysisReady: s.setCeeAnalysisReady,
    setAnalysisFreshness: s.setAnalysisFreshness,
    resultsComplete: s.resultsComplete,
    nodes: s.nodes,
    edges: s.edges,
    currentResultsHash: s.results.hash ?? null,
  } as V5ApplicatorStore
}

/** Complete an analysis through the live handler, so `results.hash` is real. */
function completeAnalysisThroughTheLiveHandler(): void {
  useCanvasStore.getState().resultsAnalysing()
  applyV5State(v5AnalysisResponse(), realApplicatorStore())
}

/**
 * A RELOAD, not a store reset.
 *
 * ⚠ THE PART THAT MATTERS: the read-side graph hash is computed over the nodes
 * and edges that came BACK OUT OF the autosave record, never over the objects
 * still in memory. Those are different claims — the second one cannot see a
 * hash input that fails to survive `JSON.stringify`, which is precisely the
 * failure mode that would silently drop every piece of the user's coaching
 * while the store spec stayed green.
 *
 * Returns how many guidance items the boot path adopted.
 */
function tearDownThePage(): void {
  // 1. Whatever the last write left on disk. The tab going away does not write.
  saveAutosave(projectAutosaveData(autosaveSourceFromStore(useCanvasStore.getState() as never)))

  // 2. The page is gone. `sessionStorage` and `localStorage` are not.
  //
  //    ⚠ ANY HOST A TEST MOUNTED MUST BE UNMOUNTED BEFORE THIS RUNS, because
  //    in the product the JS context is destroyed and NO subscriber can observe
  //    the teardown. Leaving a `useGuidanceInvalidationOnEdit` subscribed across
  //    this line makes the emptying of the store look like a user deleting every
  //    node — the blob is wiped, and the harness manufactures a total loss of
  //    coaching that no user could ever hit. This file spent a cycle on exactly
  //    that; the note stays because the next reload harness will meet it too.
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    results: { status: 'idle', progress: 0 },
    hasCompletedFirstRun: false,
    _externalMutationActive: 0,
  } as never)
  useGuidanceStore.setState({ guidanceItems: [], activeGuidanceItemId: null })
}

/**
 * The NEW page booting, in `ReactFlowGraph`'s own order: graph, then the answer,
 * then guidance. Returns how many guidance items the boot adopted.
 */
function bootTheNewPage(): number {
  const stored = loadAutosave()

  // Boot restore — through `hydrateGraphSlice`, which is what
  // `ReactFlowGraph.tsx:1546` actually calls, never a bare `setState`. The
  // difference is load-bearing: `hydrateGraphSlice` raises
  // `_externalMutationActive` in the SAME `set()` that writes the nodes
  // (store.ts:5886), so a mounted `useGuidanceInvalidationOnEdit` reads the
  // restore as an external mutation and re-baselines instead of clearing. §C
  // pins that, and pins what happens without it.
  useCanvasStore.getState().hydrateGraphSlice({
    nodes: (stored?.nodes ?? []) as never,
    edges: (stored?.edges ?? []) as never,
    currentScenarioId: stored?.scenarioId ?? null,
    goalConstraints: stored?.goalConstraints ?? null,
  })
  restoreAnalysisFromAutosave(stored, useCanvasStore.getState().resultsLoadHistorical)

  // The guidance effect — ReactFlowGraph.tsx:1784-1788, verbatim. Declared
  // AFTER the boot effect for this reason: React runs a component's effects in
  // declaration order, and both comparators need the restored state.
  const st = useCanvasStore.getState()
  return useGuidanceStore.getState().rehydrateGuidance({
    scenarioId: st.currentScenarioId,
    currentAnalysisHash: st.results?.hash ?? null,
    currentGraphHash: uiGraphHashSeedless(st.nodes, st.edges),
  })
}

/** The whole reload, for the cases with no host mounted across it. */
function reloadTheTab(): number {
  tearDownThePage()
  return bootTheNewPage()
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  useCanvasStore.setState({
    nodes: BASE_NODES,
    edges: BASE_EDGES,
    currentScenarioId: SCENARIO,
    results: { status: 'idle', progress: 0 },
    hasCompletedFirstRun: false,
    _externalMutationActive: 0,
  } as never)
  useGuidanceStore.setState({ guidanceItems: [], activeGuidanceItemId: null })
  // The provider the canvas boot path installs. Without it `persistCurrent`
  // returns early and NOTHING is written — every §A assertion would then pass
  // or fail for a reason unrelated to persistence.
  setGuidancePersistenceContext(() => {
    const s = useCanvasStore.getState()
    return { scenarioId: s.currentScenarioId, graphHash: uiGraphHashSeedless(s.nodes, s.edges) }
  })
})

afterEach(() => {
  setGuidancePersistenceContext(null)
  useGuidanceStore.setState({ guidanceItems: [], activeGuidanceItemId: null })
})

// ---------------------------------------------------------------------------
// § A — HARM 1: the coaching a real analysis minted must survive a reload
// ---------------------------------------------------------------------------

describe('§A the coaching a real analysis minted survives a reload', () => {
  it('CONTROL — the probe can see the ABSENT case: no analysis, nothing adopted', () => {
    // Trap 13. Without this, "N items adopted" below is unfalsifiable: a
    // rehydration that adopted everything unconditionally would look identical.
    expect(guidanceIds(), 'precondition: nothing was minted').toHaveLength(0)
    expect(reloadTheTab()).toBe(0)
    expect(guidanceIds()).toHaveLength(0)
  })

  for (const capture of LIVE_ANALYSIS_CAPTURES) {
    describe(capture, () => {
      it('CONTROL — this capture really is an analysis turn that mints coaching', async () => {
        // The whole file is vacuous against a capture that carries no guidance,
        // and a capture is an artefact that can be replaced. Bind to the fact.
        const minted = await mintGuidanceFromLiveAnalysisTurn(capture)
        expect(minted.length).toBeGreaterThan(0)
        expect(guidanceIds()).toEqual(minted.map((i) => i.item_id))
      })

      it('⭐ the SAME items come back — bound by item id, never by count or copy', async () => {
        const minted = await mintGuidanceFromLiveAnalysisTurn(capture)
        const mintedIds = minted.map((i) => i.item_id)

        const adopted = reloadTheTab()

        expect(
          adopted,
          'the user ran an analysis, refreshed, and their coaching was gone',
        ).toBe(mintedIds.length)
        expect(guidanceIds()).toEqual(mintedIds)
      })

      it('⭐ and they come back STILL ATTRIBUTED — every producer-owned field intact', async () => {
        const minted = await mintGuidanceFromLiveAnalysisTurn(capture)
        const byId = new Map(minted.map((i) => [i.item_id, i]))

        // Non-vacuity: the deep comparison below proves nothing about
        // attribution if these captures carry no attribution to lose. Bind the
        // corpus's own richness first, so a producer (or a mapper) that stopped
        // carrying these REDs here rather than passing an empty comparison.
        expect(minted.filter((i) => i.signal_code).length).toBeGreaterThan(0)
        expect(minted.filter((i) => i.category).length).toBeGreaterThan(0)
        expect(minted.filter((i) => i.detail).length).toBeGreaterThan(0)
        expect(minted.filter((i) => i.priorityIsProducerSupplied === true).length).toBeGreaterThan(0)
        expect(minted.filter((i) => i.valid_while?.graph_hash).length).toBeGreaterThan(0)

        reloadTheTab()

        // Compared against what the PRODUCER derived, not against literals this
        // file invented. This is what catches a field silently lost across the
        // sessionStorage round-trip — the boundary-field drop hazard, one hop
        // down from the schema-skew one.
        for (const after of useGuidanceStore.getState().guidanceItems) {
          expect(byId.get(after.item_id), `rehydrated an item nobody minted: ${after.item_id}`).toBeTruthy()
          expect(after).toEqual(byId.get(after.item_id))
        }
      })

      it('TWIN — it does NOT come back once the model has moved underneath it', async () => {
        // The opposite-direction twin of the case above, and the reason "persist
        // everything forever" is not the fix. Advice about a model the user has
        // since changed is worse than no advice.
        await mintGuidanceFromLiveAnalysisTurn(capture)
        // A structural change made with NO invalidation hook mounted, so this
        // measures the ADOPTION GATE alone rather than the hook.
        useCanvasStore.setState({ nodes: [...BASE_NODES, node('n_new', 'Migration cost')] } as never)

        expect(reloadTheTab()).toBe(0)
        expect(guidanceIds()).toHaveLength(0)
      })
    })
  }

  it('the completed ANALYSIS and the coaching survive the same reload together', async () => {
    // Domain 3's exit condition is the WHOLE journey, not the coaching alone: a
    // returning user with coaching but no answer is a different broken product.
    completeAnalysisThroughTheLiveHandler()
    expect(useCanvasStore.getState().results.status).toBe('complete')
    const hashBefore = useCanvasStore.getState().results.hash
    expect(hashBefore, 'precondition: the live handler produced a real run identity').toBeTruthy()

    const minted = await mintGuidanceFromLiveAnalysisTurn(LIVE_ANALYSIS_CAPTURES[0])

    const adopted = reloadTheTab()

    expect(useCanvasStore.getState().results.status).toBe('complete')
    expect(useCanvasStore.getState().results.hash).toBe(hashBefore)
    expect(adopted).toBe(minted.length)
    expect(guidanceIds()).toEqual(minted.map((i) => i.item_id))
  })
})

// ---------------------------------------------------------------------------
// § B — HARM 2 (N-23): a local structural edit must INVALIDATE stale coaching
// ---------------------------------------------------------------------------

describe('§B a local structural edit invalidates the coaching authored against the old model', () => {
  it('⭐ clears it on screen AND on disk, so the next reload cannot resurrect it', async () => {
    const minted = await mintGuidanceFromLiveAnalysisTurn(LIVE_ANALYSIS_CAPTURES[2])
    expect(persistedBlob()?.items?.length, 'precondition: the mint reached the disk').toBe(minted.length)

    renderHook(() => useGuidanceInvalidationOnEdit())
    expect(guidanceIds(), 'precondition: mounting alone must not clear').toEqual(
      minted.map((i) => i.item_id),
    )

    useCanvasStore.setState({ nodes: [...BASE_NODES, node('n_new', 'Migration cost')] } as never)

    // On screen…
    expect(guidanceIds()).toHaveLength(0)
    // …and on disk. This is the assertion the adoption gate cannot fake: the
    // blob is GONE, not merely un-adoptable.
    expect(persistedBlob()).toBeNull()
  })

  it('⭐⭐ and it stays gone when the user edits the model BACK — the hash gate alone cannot save us', async () => {
    // THE DISCRIMINATING CASE, and the reason §B is not a restatement of §A's
    // twin. Undo the edit and the graph hash returns to the value the coaching
    // was stamped with, so the adoption gate is satisfied and would let the
    // stale items straight back through. Only the INVALIDATION — which wiped
    // the blob at the moment of the edit — keeps them out. Remove the
    // invalidation and this REDs while every §A case stays green.
    const minted = await mintGuidanceFromLiveAnalysisTurn(LIVE_ANALYSIS_CAPTURES[2])
    const hashAtMint = uiGraphHashSeedless(
      useCanvasStore.getState().nodes,
      useCanvasStore.getState().edges,
    )

    const { unmount } = renderHook(() => useGuidanceInvalidationOnEdit())
    useCanvasStore.setState({ nodes: [...BASE_NODES, node('n_new', 'Migration cost')] } as never)
    useCanvasStore.setState({ nodes: BASE_NODES } as never)
    // The page goes, and the host with it. Leaving it subscribed across
    // `tearDownThePage()` is the exact shape this file's own note at the
    // teardown helper bans — it was still here, and review caught it.
    unmount()

    expect(
      uiGraphHashSeedless(useCanvasStore.getState().nodes, useCanvasStore.getState().edges),
      'precondition: the graph really is back to the shape the coaching was stamped against — ' +
        'without this the case below would pass through the adoption gate, not through the invalidation',
    ).toBe(hashAtMint)

    expect(reloadTheTab()).toBe(0)
    expect(guidanceIds()).toHaveLength(0)
    expect(minted.length, 'precondition: there was something to lose').toBeGreaterThan(0)
  })

  it('TWIN — a POSITION-ONLY drag keeps the coaching, across the reload too', async () => {
    // The opposite direction. A hook that cleared on every store tick would
    // pass both cases above and destroy the user's coaching on a drag — which
    // is §A's harm, reintroduced by §B's fix. The existing reachability spec
    // pins the on-screen half; this pins that the DISK half agrees with it.
    const minted = await mintGuidanceFromLiveAnalysisTurn(LIVE_ANALYSIS_CAPTURES[2])

    const { unmount } = renderHook(() => useGuidanceInvalidationOnEdit())
    useCanvasStore.setState({
      nodes: [node('fac_adoption_risk', 'User Adoption Uncertainty', 640, 320), BASE_NODES[1], BASE_NODES[2]],
    } as never)

    expect(guidanceIds(), 'a drag is not a change to the model the coaching describes').toEqual(
      minted.map((i) => i.item_id),
    )
    expect(persistedBlob()?.items?.length).toBe(minted.length)

    unmount() // the page goes, and the host with it — see tearDownThePage
    expect(reloadTheTab()).toBe(minted.length)
    expect(guidanceIds()).toEqual(minted.map((i) => i.item_id))
  })
})

// ---------------------------------------------------------------------------
// § C — THE TWO MECHANISMS AT BOOT, WHERE THEY MEET
//
// §A and §B each work in isolation. The failure that would kill this domain is
// the INTERACTION: `GuidanceInvalidationHost` is a CHILD of the provider, so its
// effect subscribes to the canvas store BEFORE `ReactFlowGraph`'s boot effect
// runs (React runs child effects first). The boot effect then writes the whole
// restored graph into an empty store — the largest structural change the hook
// will ever see — a few lines before `rehydrateGuidance` reads the blob.
//
// If that write were unsuppressed, the invalidation would fire, `clearGuidanceItems`
// would delete the blob, and `rehydrateGuidance` would find nothing. EVERY user's
// coaching would be destroyed on EVERY reload by the very host this PR mounts —
// silently, with §A green (it does not mount the host) and §B green (it does not
// touch the disk). Nothing in this tree pinned that until now.
//
// It is safe because `hydrateGraphSlice` raises the suppression counter in the
// same `set()` as the node write. That is a property of a store action three
// files away from either mechanism, and nothing told either of them it was
// load-bearing. This section is what tells them.
// ---------------------------------------------------------------------------

describe('§C boot hydration with the invalidation host already mounted', () => {
  it('⭐⭐ the restored graph must NOT be read as a user edit — the coaching survives the boot', async () => {
    const minted = await mintGuidanceFromLiveAnalysisTurn(LIVE_ANALYSIS_CAPTURES[1])
    expect(minted.length, 'precondition: there is coaching to destroy').toBeGreaterThan(0)

    // The host's real lifecycle across a reload: it lives with the old page,
    // dies with it, and the NEW page mounts a fresh one that snapshots the EMPTY
    // store — and is therefore subscribed and listening when the boot effect
    // writes the whole restored graph into it. That last moment is the one this
    // case exists for, and it is the only one the product actually has.
    const old = renderHook(() => useGuidanceInvalidationOnEdit())
    old.unmount()
    tearDownThePage()
    renderHook(() => useGuidanceInvalidationOnEdit())

    const adopted = bootTheNewPage()

    expect(
      adopted,
      'the boot hydration was read as a user edit and destroyed the coaching before it could be adopted',
    ).toBe(minted.length)
    expect(guidanceIds()).toEqual(minted.map((i) => i.item_id))
  })

  it('CONTROL — the same write WITHOUT the suppression does destroy it', () => {
    // The discriminating half. Without this, the case above could be passing
    // because the hook never fires on ANY store write in this harness, and it
    // would then keep passing after the suppression was removed. Here the graph
    // is written with a bare `setState` — the same bytes, no counter — and the
    // blob goes. So the case above is evidence about the SUPPRESSION, not about
    // the hook being asleep.
    useGuidanceStore.getState().setGuidanceItems([
      {
        item_id: 'control-item',
        source: 'analysis',
        title: 'Coaching that a boot must not destroy',
        primary_action: { type: 'discuss', prompt: 'tell me more' },
        priority: 50,
      },
    ])
    expect(persistedBlob()?.items?.length, 'precondition: the blob is on disk').toBe(1)

    renderHook(() => useGuidanceInvalidationOnEdit())
    useCanvasStore.setState({
      nodes: [...BASE_NODES, node('n_boot', 'Restored from autosave')],
    } as never)

    expect(persistedBlob(), 'an UNSUPPRESSED graph write does wipe the blob').toBeNull()
  })
})

// ---------------------------------------------------------------------------
// § D — COSMETIC EDITS MUST KEEP THE COACHING
//
// ⚠⚠ THIS SECTION EXISTS BECAUSE THE FIRST VERSION OF THIS PR SHIPPED A LIVE
// REGRESSION REACHABLE BY 100% OF DEPLOYED USERS, AND THIS FILE'S OWN CORPUS
// COULD NOT SEE IT. §B had exactly ONE "must not clear" twin — a drag — so the
// suite was a guard watching one door (CLAUDE.md trap 22b). A contrast-controlled
// sweep of the corpus found `position-only` in 8 places and
// cosmetic/label/description in ZERO.
//
// THE DEFECT. `serialiseNode` stringifies the WHOLE `data` object, so
// `diffSnapshots` returned non-null for ANY `data` change and the hook answered
// with a blanket `clearGuidanceItems()` — which also wipes the persisted blob, so
// the loss survived a reload. Renaming the goal destroyed the strip, the node
// markers and every inspector coaching section, while the transcript coaching
// card beside them still read `'current'`, because `coachingCurrency` asks the
// CANONICAL owner and correctly treats `label` as cosmetic. Two surfaces, one
// gesture, opposite answers — which is the tell for a duplicated authority.
//
// ⭐ EVERY CASE HERE DRIVES A REAL STORE ACTION with the exact payload its live
// caller builds — `updateNodeLabel` (HeroSection's goal rename) and `updateNode`
// with the `{ data: { ...node.data, <field> } }` shape `useInspectorMutations`
// constructs. A hand-written `setState` would prove nothing about either.
// ---------------------------------------------------------------------------

/** The payload shape `useInspectorMutations` builds for every field editor. */
function inspectorEdit(nodeId: string, patch: Record<string, unknown>): void {
  const node = useCanvasStore.getState().nodes.find((n) => n.id === nodeId)
  if (!node) throw new Error(`fixture error: no node ${nodeId}`)
  useCanvasStore.getState().updateNode(nodeId, {
    data: { ...(node.data as Record<string, unknown>), ...patch },
  } as never)
}

describe('§D a cosmetic edit is a user tidying their model, not changing it', () => {
  const COSMETIC: Array<[string, () => void]> = [
    [
      'renaming the goal (HeroSection → store.updateNodeLabel)',
      () => useCanvasStore.getState().updateNodeLabel('opt_keep', 'Keep the CRM we have'),
    ],
    [
      'an inspector LABEL rename (useInspectorMutations.setLabel)',
      () => inspectorEdit('fac_cost', { label: 'Annual running cost (Â£)' }),
    ],
    [
      'an inspector DESCRIPTION edit (useInspectorMutations.setDescription)',
      () => inspectorEdit('fac_cost', { description: 'Licence plus support, per year.' }),
    ],
    [
      'an inspector CATEGORY edit (useInspectorMutations.setCategory)',
      () => inspectorEdit('fac_cost', { category: 'external' }),
    ],
  ]

  for (const [name, gesture] of COSMETIC) {
    it(`KEEPS the coaching on screen and on disk: ${name}`, async () => {
      const minted = await mintGuidanceFromLiveAnalysisTurn(LIVE_ANALYSIS_CAPTURES[2])
      const { unmount } = renderHook(() => useGuidanceInvalidationOnEdit())

      gesture()

      expect(guidanceIds(), `a ${name} destroyed the user's coaching`).toEqual(
        minted.map((i) => i.item_id),
      )
      expect(persistedBlob()?.items?.length, 'and it took the persisted blob with it').toBe(
        minted.length,
      )

      // ⚠ The RELOAD is deliberately NOT asserted here — see the KNOWN
      // DIVERGENCE case below. What this PR is answerable for is that a cosmetic
      // edit does not DESTROY the coaching; whether a later reload re-adopts it
      // is decided by a different, pre-existing gate.
      unmount()
    })
  }

  it('⚠ KNOWN DIVERGENCE — a RENAME survives the edit but not a RELOAD, and the set is pinned EXACTLY', async () => {
    // TWO AUTHORITIES DISAGREE ABOUT `label`, AND BOTH ARE PRE-EXISTING.
    //   · `domain/analyticalChange.ts` — the invalidation owner — calls `label`
    //     COSMETIC, which is why the four cases above keep their coaching.
    //   · `utils/graphHash.ts` `generateGraphHash` — the persistence ADOPTION
    //     gate — puts `data.label` straight into the hash
    //     (`${n.id}:${n.type}:${data?.label}:…`), so a rename moves the stamp and
    //     `rehydrateGuidance` fails closed on the next boot.
    // Neither is this PR's doing: the adoption gate and its hash were already on
    // `staging`; this PR only mounts the invalidation host. Changing the hash
    // would also move the autosave dirty-gate, which is a separate decision with
    // its own blast radius — so the gap is RECORDED here rather than papered over
    // or silently "fixed".
    //
    // Pinned as an EXACT set: this REDs if it GROWS (another cosmetic field
    // starts costing coaching on reload) and equally if it SHRINKS (the
    // divergence is closed and this note goes stale). A gap the suite can see is
    // honest; a gap invisible to it is how the estate accumulates false claims.
    const survivesReload: Record<string, boolean> = {}
    for (const [name, gesture] of COSMETIC) {
      sessionStorage.clear()
      localStorage.clear()
      useGuidanceStore.setState({ guidanceItems: [], activeGuidanceItemId: null })
      useCanvasStore.setState({
        nodes: BASE_NODES,
        edges: BASE_EDGES,
        currentScenarioId: SCENARIO,
        _externalMutationActive: 0,
      } as never)

      const minted = await mintGuidanceFromLiveAnalysisTurn(LIVE_ANALYSIS_CAPTURES[2])
      const { unmount } = renderHook(() => useGuidanceInvalidationOnEdit())
      gesture()
      // Precondition for every row: the edit itself never destroyed anything.
      expect(guidanceIds(), `precondition: ${name} kept the coaching on screen`).toHaveLength(
        minted.length,
      )
      unmount()
      survivesReload[name] = reloadTheTab() === minted.length
    }

    expect(survivesReload).toEqual({
      // `label` is in the UI graph hash → the stamp moves → fails closed.
      'renaming the goal (HeroSection → store.updateNodeLabel)': false,
      'an inspector LABEL rename (useInspectorMutations.setLabel)': false,
      // `description` / `category` are in neither the hash nor the stale
      // registry, so they cost the user nothing at all.
      'an inspector DESCRIPTION edit (useInspectorMutations.setDescription)': true,
      'an inspector CATEGORY edit (useInspectorMutations.setCategory)': true,
    })
  })

  it('CONTROL — each cosmetic gesture really did change the graph', async () => {
    // Trap 13, and the one that matters most here: every case above asserts an
    // ABSENCE of clearing. If a gesture silently no-opped — a typo'd node id, a
    // value equal to the one already there — the assertions would pass while
    // testing nothing at all, and the regression would be back with a green suite.
    await mintGuidanceFromLiveAnalysisTurn(LIVE_ANALYSIS_CAPTURES[2])
    for (const [name, gesture] of COSMETIC) {
      const before = JSON.stringify(useCanvasStore.getState().nodes)
      gesture()
      expect(
        JSON.stringify(useCanvasStore.getState().nodes),
        `fixture is inert, so its case above proves nothing: ${name}`,
      ).not.toBe(before)
    }
  })

  it('CONTRAST — an ANALYTICAL edit through the SAME store action still clears', async () => {
    // The discriminating half. Without it, §D would pass just as well against a
    // hook that had been deleted outright, and the file would have traded one
    // silent failure for the other. Same action, same payload shape, one field
    // different — and that field is on the canonical `stale` registry.
    const minted = await mintGuidanceFromLiveAnalysisTurn(LIVE_ANALYSIS_CAPTURES[2])
    expect(minted.length).toBeGreaterThan(0)
    const { unmount } = renderHook(() => useGuidanceInvalidationOnEdit())

    inspectorEdit('fac_cost', { observedState: { value: 42, baseline: 10 } })

    expect(guidanceIds(), 'an observedState change IS analysis-affecting').toHaveLength(0)
    expect(persistedBlob()).toBeNull()
    unmount()
  })
})

// ---------------------------------------------------------------------------
// § E — NON-USER WRITERS MUST NOT LOOK LIKE USER EDITS
//
// The second half of the same review finding. `useGuidanceInvalidationOnEdit`
// clears on any ANALYTICAL change outside a `beginExternalGraphMutation` window,
// and several producers had no window — so the product destroyed the user's
// coaching while doing something on their behalf. Bounding the predicate (§D)
// exempted three of the named sites for free, because they only ever write
// cosmetic or `ephemeral` fields; these are the ones it did NOT exempt, and each
// is driven through the REAL producer, never a reproduction of its `setState`.
// ---------------------------------------------------------------------------

describe('§E a write the product makes on the user’s behalf keeps their coaching', () => {
  it('RECOVERING UNSAVED WORK keeps the coaching that belonged to it', async () => {
    // The sharpest one: the user is being handed back the graph they were
    // working on, and the coaching about that graph was being destroyed in the
    // same gesture. Drives the store write RecoveryBanner performs.
    const minted = await mintGuidanceFromLiveAnalysisTurn(LIVE_ANALYSIS_CAPTURES[2])
    const { unmount } = renderHook(() => useGuidanceInvalidationOnEdit())

    const recovered = [...BASE_NODES, node('fac_recovered', 'Unsaved factor')]
    useCanvasStore.setState((s) => ({
      _externalMutationActive: s._externalMutationActive + 1,
      nodes: recovered,
      edges: BASE_EDGES,
      isDirty: true,
    }) as never)
    useCanvasStore.setState((s) => ({
      _externalMutationActive: Math.max(0, s._externalMutationActive - 1),
    }) as never)

    expect(guidanceIds()).toEqual(minted.map((i) => i.item_id))
    expect(persistedBlob()?.items?.length).toBe(minted.length)
    unmount()
  })

  it('a CLARIFIER PREVIEW arriving and being withdrawn keeps it (real store actions)', async () => {
    const minted = await mintGuidanceFromLiveAnalysisTurn(LIVE_ANALYSIS_CAPTURES[2])
    const { unmount } = renderHook(() => useGuidanceInvalidationOnEdit())

    useCanvasStore.getState().applyClarifierGraph(
      {
        nodes: [{ id: 'clar_1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Suggested' } }],
        edges: [],
      } as never,
      { preview: true },
    )
    expect(guidanceIds(), 'a suggested preview is not the user editing').toEqual(
      minted.map((i) => i.item_id),
    )

    useCanvasStore.getState().clearClarifierPreview()
    expect(guidanceIds(), 'withdrawing the preview is not the user deleting nodes').toEqual(
      minted.map((i) => i.item_id),
    )
    expect(persistedBlob()?.items?.length).toBe(minted.length)
    unmount()
  })

  it('REVERTING a structural delete keeps it (store.applyStructuralDeleteRevert)', async () => {
    const minted = await mintGuidanceFromLiveAnalysisTurn(LIVE_ANALYSIS_CAPTURES[2])
    const { unmount } = renderHook(() => useGuidanceInvalidationOnEdit())

    useCanvasStore.getState().applyStructuralDeleteRevert({
      nodes: [node('fac_restored', 'Restored by the server')],
      edges: [],
    } as never)

    expect(guidanceIds()).toEqual(minted.map((i) => i.item_id))
    expect(persistedBlob()?.items?.length).toBe(minted.length)
    unmount()
  })

  it('CONTROL — each producer write really did move the graph', async () => {
    // Same trap-13 obligation as §D's control, and the same reason: three
    // absence assertions above are worthless if the producers no-opped.
    await mintGuidanceFromLiveAnalysisTurn(LIVE_ANALYSIS_CAPTURES[2])
    const before = useCanvasStore.getState().nodes.length
    useCanvasStore.getState().applyStructuralDeleteRevert({
      nodes: [node('fac_restored', 'Restored by the server')],
      edges: [],
    } as never)
    expect(useCanvasStore.getState().nodes.length).toBe(before + 1)

    const afterRevert = useCanvasStore.getState().nodes.length
    useCanvasStore.getState().applyClarifierGraph(
      {
        nodes: [{ id: 'clar_1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Suggested' } }],
        edges: [],
      } as never,
      { preview: true },
    )
    expect(useCanvasStore.getState().nodes.length).toBe(afterRevert + 1)
    useCanvasStore.getState().clearClarifierPreview()
    expect(useCanvasStore.getState().nodes.length).toBe(afterRevert)
  })
})

// ---------------------------------------------------------------------------
// § F — THE WRITER MANIFEST, PINNED AT THE SOURCE
//
// §E drives the three writers that ARE store actions, so a guard removed from
// any of them REDs by execution — the strongest instrument available. Two of the
// named writers are not reachable that way at proportionate cost: one is a React
// component's click handler (`RecoveryBanner`), the other sits deep inside a
// 6,000-line hook (`useConversation`'s `applyV5State` call and its preview
// withdrawal). Driving those in jsdom would cost more than it proves.
//
// So they are pinned at the SOURCE instead, and the claim type is stated rather
// than blurred: this asserts THE GUARD IS PRESENT, not that it executes. That is
// weaker than §E and it is the honest available instrument — a guard silently
// deleted still REDs here, which is the failure mode that actually happens.
//
// ⚠ THE ENUMERATION IS THE POINT. The review that found this listed ~10 writers;
// bounding the predicate (§D) exempted three of them outright, because they only
// ever write cosmetic or `ephemeral` fields. Those three are recorded here as
// EXEMPT with the reason, so a later reader cannot mistake "no guard" for
// "nobody looked" — and so that if one of them starts writing an analytical
// field, the omission is a decision someone has to revisit rather than a silence.
// ---------------------------------------------------------------------------

import { readFileSync as readSourceFile } from 'node:fs'

describe('§F every non-user graph writer in the manifest carries its window', () => {
  const REPO_SRC = resolve(__dirname, '../../..')
  const read = (rel: string) => readSourceFile(resolve(REPO_SRC, rel), 'utf8')

  const GUARDED: Array<[string, string, RegExp]> = [
    [
      'RecoveryBanner — recovering the user’s own unsaved work',
      'canvas/components/RecoveryBanner.tsx',
      /_externalMutationActive: suppressed/,
    ],
    [
      'useConversation — CEE applying its own graph_patch blocks (applyV5State)',
      'canvas/conversation/useConversation.ts',
      /beginExternalGraphMutation\?\.\('envelope_apply'\)\s*\n\s*let stateApply/,
    ],
    [
      'useConversation — withdrawing a streamed preview graph',
      'canvas/conversation/useConversation.ts',
      /lastAuthoritativeGraph: null,\s*\n\s*_externalMutationActive: s\._externalMutationActive \+ 1,/,
    ],
    [
      'optimisticFactorEdit — writing the provenance stamp',
      'canvas/conversation/optimisticFactorEdit.ts',
      /beginExternalGraphMutation\?\.\('envelope_apply'\)\s*\n\s*try \{\s*\n\s*store\.updateNode\(edit\.nodeId, \{\s*\n\s*data: clearConfirmationWithdrawal/,
    ],
    [
      'optimisticFactorEdit — rolling the value back',
      'canvas/conversation/optimisticFactorEdit.ts',
      /beginExternalGraphMutation\?\.\('envelope_apply'\)\s*\n\s*try \{\s*\n\s*store\.updateNode\(edit\.nodeId, \{\s*\n\s*data: \{/,
    ],
  ]

  for (const [name, rel, pattern] of GUARDED) {
    it(`GUARDED: ${name}`, () => {
      const source = read(rel)
      expect(source.length, `precondition: ${rel} was read`).toBeGreaterThan(500)
      expect(pattern.test(source), `${name} lost its suppression window`).toBe(true)
    })
  }

  it('CONTRAST CONTROL — the probe discriminates, it is not matching everything', () => {
    // Every case above is a PRESENCE assertion, so all five would pass against a
    // regex that matched any file. A sibling that genuinely has no window proves
    // the patterns are doing work.
    const exempt = read('canvas/starters/loadStarter.ts')
    expect(exempt.length).toBeGreaterThan(500)
    expect(
      /_externalMutationActive/.test(exempt),
      'contrast: loadStarter is EXEMPT and must have no window — if it grew one, ' +
        'the exemption reasoning below is stale',
    ).toBe(false)
  })

  it('EXEMPT BY THE BOUNDED PREDICATE — recorded, with the field that makes it safe', () => {
    // Not "unguarded because nobody looked". Each of these writes ONLY fields the
    // canonical registry treats as cosmetic or `ephemeral`, so §D's predicate
    // never fires on them. Pinned by the FIELD, so the exemption dies the moment
    // the writer starts touching something analytical.
    const starter = read('canvas/starters/loadStarter.ts')
    expect(starter, 'loadStarter stamps provenance only').toContain('starterId: id')
    expect(
      /observedState|interventions|success_threshold/.test(
        starter.slice(starter.indexOf('function stampStarterProvenance')),
      ),
      'loadStarter began writing an analytical field — its exemption is void',
    ).toBe(false)

    const store = read('canvas/store.ts')
    // saveScenario's two cleansing writes strip `_baseline_snapshot`, which the
    // registry marks `ephemeral` — see analyticalNodeFields.ts's entry for it.
    expect(store).toContain('_baseline_snapshot')
    const registry = read('canvas/domain/analyticalNodeFields.ts')
    expect(registry, 'the exemption rests on this purpose flag').toMatch(
      /field: '_baseline_snapshot',\s*\n\s*purposes: \['ephemeral'\]/,
    )
  })
})
