/**
 * Interim 2.467 mitigation — an import must never leave a pre-import analysis
 * renderable-as-current (P0 trust, live-witnessed 2026-08-04).
 *
 * Reproduces the exact shape of the witnessed walk
 * (PHASE0-EVIDENCE-2026-07-28/rewalk-2459b-2026-08-04.md, "ATTEMPT 2" +
 * FAIL frame rewalk-2459b-raw/attempt2/probe-c/2c-10-verdict-analysis-tab.png):
 *
 *   1. analysis completed + "Analysis reflects the current model." affirmative;
 *   2. canvas IMPORT (full graph replacement, same node ids, one relabelled
 *      option — the walk's "ZZZ IMPORTED OPTION" sentinel);
 *   3. the pre-import analysis stayed fully rendered, re-bound by node id to
 *      the imported labels, every staleness indicator read clean;
 *   4. after one Rerun, CEE (which never saw the import — zero server-side
 *      graph persistence, walk VERDICT 3) returned a 'fresh' verdict computed
 *      against ITS OWN pre-import graph, and the affirmative badge RETURNED
 *      against an analysis of the wrong graph.
 *
 * The fixtures are the walk's own captured graphs, byte-identical
 * (export-original.json / import-modified.json from attempt2/probe-c).
 *
 * Contract pinned here (interim until the atomic import→reset→registration
 * train, ROADMAP 2.467, supersedes):
 *   (a) importCanvas clears the analysis-results cluster — no pre-import
 *       results body is renderable, and re-binding old rows to new labels is
 *       impossible by construction (no rows survive);
 *   (b) the freshness affirmative is gone after import AND cannot return
 *       against a rerun of the unregistered graph: while the imported graph is
 *       pending server registration, a server 'fresh' verdict displays as
 *       cannot-confirm (the existing dirty-overlay downgrade — never an
 *       affirmative, never a fabricated 'stale');
 *   (c) the hold RELEASES when the canvas is replaced by a server-known graph
 *       (hydrate / scenario load / reset / CEE draft) — no permanent
 *       suppression.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { useCanvasStore } from '../store'
import { useAnalysisSnapshotStore } from '../stores/analysisSnapshotStore'
import { useComparisonStore } from '../stores/comparisonStore'
import {
  applyDraftResult,
  mapDraftNodeToCanvas,
  mapDraftEdgeToCanvas,
} from '../utils/applyDraftResult'
import { createScenario } from '../store/scenarios'
import {
  clearImportRegistrationMarkers,
  graphImportDigest,
  markGraphImported,
  isGraphPendingImportRegistration,
  __readImportRegistrationMarkers,
} from '../store/importRegistrationMarker'
import {
  AnalysisFreshnessNotice,
  FRESHNESS_COPY,
} from '../../components/results/AnalysisFreshnessNotice'
import { ReanalyseBar } from '../components/model-tab/ReanalyseBar'
import { V7FreshnessStrip } from '../../components/results/v7/V7FreshnessStrip'
import { classifyFreshnessForDisplay } from '../store/analysisFreshness'

// Spy on the completion toast. `importOriginal` spread so the mock cannot rot
// as the module gains exports (trap 12: a vi.mock factory REPLACES the module).
const showToast = vi.fn()
vi.mock('@/canvas/ToastContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/canvas/ToastContext')>()),
  useShowToastSafe: () => showToast,
}))

const EXPORT_ORIGINAL_JSON = readFileSync(
  path.resolve(__dirname, '__fixtures__', 'rewalk2459b-export-original.json'),
  'utf8',
)
const IMPORT_MODIFIED_JSON = readFileSync(
  path.resolve(__dirname, '__fixtures__', 'rewalk2459b-import-modified.json'),
  'utf8',
)

// Identity anchors from the walk (trap 19: assertions bind by identity, never
// by a value predicate another object could satisfy).
const PRE_IMPORT_HASH = 'rewalk2459b-pre-import-response-hash'
const PRE_IMPORT_OPTION_ID = 'opt_alpha'
const PRE_IMPORT_OPTION_LABEL = 'Alpha Hall' // opt_alpha's label in export-original
const IMPORTED_SENTINEL_LABEL = 'ZZZ IMPORTED OPTION' // opt_alpha's label in import-modified
const PRE_IMPORT_COMPUTED_AT = '2026-08-04T22:00:00.000Z'
const POST_RERUN_COMPUTED_AT = '2026-08-04T23:00:00.000Z'

/** The walk's rerun verdict: CEE's own (pre-import) graph hashes agree, so it
 *  says 'fresh' — about a graph the canvas no longer shows. */
const SERVER_FRESH_VERDICT_AFTER_RERUN = {
  freshness: 'fresh',
  freshness_reason: 'graph_hash_match',
  graph_hash_at_run: 'server-side-pre-import-graph-hash',
  current_graph_hash: 'server-side-pre-import-graph-hash',
  computed_at: POST_RERUN_COMPUTED_AT,
}

function seedPreImportAnalysedState() {
  const exported = JSON.parse(EXPORT_ORIGINAL_JSON) as {
    nodes: unknown[]
    edges: unknown[]
  }
  useCanvasStore.setState({
    nodes: exported.nodes,
    edges: exported.edges,
    results: {
      status: 'complete',
      progress: 100,
      hash: PRE_IMPORT_HASH,
      report: {
        model_card: { response_hash: PRE_IMPORT_HASH },
        options: [
          {
            id: PRE_IMPORT_OPTION_ID,
            label: PRE_IMPORT_OPTION_LABEL,
            win_probability: 0.62,
          },
        ],
      },
    },
    analysisStateReady: true,
    hasCompletedFirstRun: true,
    rawV2Response: {
      options: [{ id: PRE_IMPORT_OPTION_ID, label: PRE_IMPORT_OPTION_LABEL }],
    },
    v5AnalysisFact: {
      scenarioId: null,
      analysisHash: PRE_IMPORT_HASH,
      hasRunAnalysisFact: true,
      freshness: 'fresh',
      freshnessReason: null,
      rawBlocks: [],
      writtenAt: Date.now(),
    },
    analysisFreshness: {
      freshness: 'fresh',
      freshnessReason: 'graph_hash_match',
      graphHashAtRun: 'pre-import-graph-hash',
      currentGraphHash: 'pre-import-graph-hash',
      computedAt: PRE_IMPORT_COMPUTED_AT,
    },
    analysisFreshnessDirty: false,
  } as never)
  // The pre-import analysis also lives in the Compare-tab snapshot store and
  // the comparison store — seed both so their post-import absence assertions
  // are non-vacuous (trap 13: an absence check must first see a presence).
  useAnalysisSnapshotStore.setState({
    snapshots: [
      {
        runId: 'rewalk2459b-run-1',
        responseHash: PRE_IMPORT_HASH,
        options: [{ id: PRE_IMPORT_OPTION_ID, label: PRE_IMPORT_OPTION_LABEL }],
      },
    ],
  } as never)
  useComparisonStore.setState({
    comparisonMode: {
      active: true,
      scenarios: [],
      labels: [PRE_IMPORT_OPTION_LABEL],
      comparison: null,
      apiResponse: {
        option_comparison: [
          { option_id: PRE_IMPORT_OPTION_ID, option_label: PRE_IMPORT_OPTION_LABEL },
        ],
      },
    },
  } as never)
}

/**
 * The COMPLETE reviewed manifest for the absence claim "no pre-import analysis
 * artefact survives the import" — every store slice a results/driving surface
 * renders from. Scope: useCanvasStore results cluster + the analysis snapshot
 * store (Compare tab). Nodes/edges deliberately excluded (the imported graph
 * legitimately reuses the walk's node ids — that reuse is the re-bind bait).
 */
function analysisResultsCluster() {
  const s = useCanvasStore.getState()
  return {
    results: s.results,
    previousReport: s.previousReport,
    runMeta: s.runMeta,
    rawV2Response: s.rawV2Response,
    v5AnalysisFact: s.v5AnalysisFact,
    ceeAnalysisReady: s.ceeAnalysisReady,
    needleMovers: s.needleMovers,
    graphHealth: s.graphHealth,
    nodeRationales: s.nodeRationales,
    preAnalysisSensitivity: s.preAnalysisSensitivity,
    lastAnalysisSeed: s.lastAnalysisSeed,
    compareSnapshots: useAnalysisSnapshotStore.getState().snapshots,
    comparisonMode: useComparisonStore.getState().comparisonMode,
  }
}

/**
 * A graph that is STRUCTURALLY different from the walk's fixtures (different
 * node ids), for the release-side controls.
 *
 * ⚠ The walk's two fixtures are NOT structurally different from each other:
 * `import-modified` only RELABELS `opt_alpha`. The import marker's identity is
 * node ids + edge endpoint pairs — deliberately label-independent, because
 * including labels would let a user rename one node on an imported graph and
 * silently release the hold, which is the P0 returning. So a control that needs
 * "a graph this session never imported" must differ structurally.
 */
function structurallyUnrelatedGraph() {
  return {
    nodes: [
      { id: 'unrelated_goal', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Other goal' } },
      { id: 'unrelated_opt', type: 'option', position: { x: 0, y: 80 }, data: { label: 'Other option' } },
    ],
    edges: [],
  }
}

/**
 * EVERY surface that renders a freshness claim, mounted together.
 *
 * ⚠ `V7FreshnessStrip` was added after a review found it was the FOURTH
 * surface and had no behavioural spec anywhere in the tree: dropping its
 * `importHold` argument left this file 24/24 GREEN while the strip flipped back
 * to asserting "Model changed since this analysis." A claim-bearing surface
 * that no spec mounts is a claim nobody is checking.
 */
function renderFreshnessSurfaces() {
  return render(
    <>
      <AnalysisFreshnessNotice />
      <V7FreshnessStrip />
      <ReanalyseBar onReanalyse={() => {}} />
    </>,
  )
}

beforeEach(() => {
  cleanup()
  useCanvasStore.getState().reset()
  // reset() restores only the graph slice — restore the analysis cluster and
  // freshness machinery to their initial-state values explicitly.
  useCanvasStore.setState({
    results: { status: 'idle', progress: 0 },
    runMeta: {},
    previousReport: null,
    rawV2Response: null,
    v5AnalysisFact: null,
    ceeAnalysisReady: null,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    analysisStateReady: false,
    hasCompletedFirstRun: false,
    graphEditedSinceLastRun: false,
    pendingEmittedEdits: 0,
    needleMovers: [],
    graphHealth: null,
    nodeRationales: {},
    preAnalysisSensitivity: null,
    lastAnalysisSeed: null,
    currentScenarioId: null,
  } as never)
  useAnalysisSnapshotStore.getState().clearSnapshots()
  useComparisonStore.getState().resetComparison()
  clearImportRegistrationMarkers()
})

describe('interim 2.467 — import invalidates pre-import analysis (rewalk-2459b attempt 2)', () => {
  it('positive control (trap 13): pre-import state renders the affirmative badge and holds the results cluster', () => {
    seedPreImportAnalysedState()

    // The absence assertions below can only be trusted if this presence is seen.
    const before = JSON.stringify(analysisResultsCluster())
    expect(before).toContain(PRE_IMPORT_HASH)
    expect(before).toContain(PRE_IMPORT_OPTION_LABEL)
    expect(before).toContain(PRE_IMPORT_OPTION_ID)

    renderFreshnessSurfaces()
    const notice = screen.getByTestId('analysis-freshness-notice')
    expect(notice).toHaveAttribute('data-freshness', 'fresh')
    expect(notice).toHaveTextContent(FRESHNESS_COPY.fresh) // "Analysis reflects the current model."
  })

  it('(a)+(c-rebind) importCanvas clears the analysis-results cluster — no pre-import row survives to re-bind to imported labels', () => {
    seedPreImportAnalysedState()

    let ok = false
    act(() => {
      ok = useCanvasStore.getState().importCanvas(IMPORT_MODIFIED_JSON)
    })
    expect(ok).toBe(true)

    const s = useCanvasStore.getState()
    // The re-bind bait is live: the imported graph reuses the walk's node id
    // with the sentinel label (identity-bound to the walk's modification).
    const baitNode = s.nodes.find((n) => n.id === PRE_IMPORT_OPTION_ID)
    expect(baitNode).toBeTruthy()
    expect(
      (baitNode as unknown as { data: { label: string } }).data.label,
    ).toBe(IMPORTED_SENTINEL_LABEL)

    // (a) No results body is renderable from the pre-import run.
    expect(s.results.status).toBe('idle')
    expect(s.results.report ?? null).toBeNull()
    expect(s.results.hash ?? null).toBeNull()
    expect(s.previousReport).toBeNull()
    expect(s.rawV2Response).toBeNull()
    expect(s.v5AnalysisFact).toBeNull()
    expect(s.analysisStateReady).toBe(false)
    expect(s.hasCompletedFirstRun).toBe(false)

    // (c) Re-bind impossible by construction: the complete results cluster
    // holds NO reference to the pre-import run's identity — its hash, its row
    // label, or any row bound to the shared node id.
    const after = JSON.stringify(analysisResultsCluster())
    expect(after).not.toContain(PRE_IMPORT_HASH)
    expect(after).not.toContain(PRE_IMPORT_OPTION_LABEL)
    expect(after).not.toContain(PRE_IMPORT_OPTION_ID)

    // (b) The affirmative badge is gone (walk frame 2c-07: indicators must
    // not read clean-with-results; with no verdict and no results the badge
    // renders nothing).
    renderFreshnessSurfaces()
    expect(screen.queryByTestId('analysis-freshness-notice')).toBeNull()
  })

  it("(b) a post-import rerun's server 'fresh' verdict cannot re-attach the affirmative (walk frame 2c-10)", () => {
    seedPreImportAnalysedState()
    act(() => {
      useCanvasStore.getState().importCanvas(IMPORT_MODIFIED_JSON)
    })

    // The walk's rerun, in applyV5State's live order (setAnalysisFreshness at
    // step 998, clearAnalysisFreshnessDirty at step ~1166 after the
    // analysis_result lands): CEE never saw the import, its own hashes agree,
    // verdict says 'fresh'.
    act(() => {
      useCanvasStore.getState().setAnalysisFreshness(SERVER_FRESH_VERDICT_AFTER_RERUN)
      useCanvasStore.getState().clearAnalysisFreshnessDirty()
    })

    renderFreshnessSurfaces()
    const notice = screen.getByTestId('analysis-freshness-notice')
    // The verbatim CEE verdict is held (debug attribute) — but it must NOT
    // display as the affirmative: the graph it affirms is not on the canvas.
    expect(notice).toHaveAttribute('data-cee-freshness', 'fresh')
    expect(notice).not.toHaveAttribute('data-freshness', 'fresh')
    expect(notice).not.toHaveTextContent(FRESHNESS_COPY.fresh)
    // Honest treatment, settled in round 4: every claim-bearing surface reads
    // cannot-confirm, and the re-analyse AFFORDANCE still renders — with copy
    // that states uncertainty instead of asserting a change.
    //
    // ⚠ Round 1 asserted the "Model changed" bar; round 3 asserted its ABSENCE.
    // Both were wrong, in opposite directions. The bar is simultaneously an
    // assertion and the Model tab's ONLY re-analyse control, so removing it
    // reproduced ROADMAP 2.129 (a). (The sticky AnalysisFooter Rerun is not a
    // substitute: it sits in OutputsDock's RESULTS branch, while this bar's
    // ModelTabBody is a sibling under `diagnostics`.)
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
    expect(notice).toHaveTextContent(FRESHNESS_COPY.unknown)
    expect(screen.getByTestId('v7-freshness-strip')).toHaveTextContent(FRESHNESS_COPY.unknown)
    const bar = screen.getByTestId('reanalyse-bar')
    expect(bar).toHaveAttribute('data-reason', 'import-unregistered')
    expect(bar).toHaveTextContent("Can't confirm this analysis matches the current model.")
    expect(bar).not.toHaveTextContent('Model changed')
    expect(screen.getByTestId('reanalyse-button')).toBeInTheDocument()
  })

  it("(b, order-independence) clear-then-verdict also cannot re-attach the affirmative", () => {
    seedPreImportAnalysedState()
    act(() => {
      useCanvasStore.getState().importCanvas(IMPORT_MODIFIED_JSON)
    })
    act(() => {
      useCanvasStore.getState().clearAnalysisFreshnessDirty()
      useCanvasStore.getState().setAnalysisFreshness(SERVER_FRESH_VERDICT_AFTER_RERUN)
    })
    renderFreshnessSurfaces()
    const notice = screen.getByTestId('analysis-freshness-notice')
    expect(notice).not.toHaveAttribute('data-freshness', 'fresh')
    expect(notice).not.toHaveTextContent(FRESHNESS_COPY.fresh)
  })

  it('(b) a verdictless rerun completion keeps the overlay dirty while the import is unregistered', () => {
    seedPreImportAnalysedState()
    act(() => {
      useCanvasStore.getState().importCanvas(IMPORT_MODIFIED_JSON)
    })
    // applyV5State's other branch: the rerun landed an analysis_result but the
    // response carried NO freshness verdict → noteRunCompletedWithoutVerdict.
    // The run consumed CEE's own graph, not the imported canvas — the overlay
    // must stay dirty (a false "resolved" record here would let any later
    // clean path re-affirm).
    act(() => {
      useCanvasStore.getState().noteRunCompletedWithoutVerdict()
    })
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
    // And a later echoed 'fresh' verdict still cannot re-attach the affirmative.
    act(() => {
      useCanvasStore.getState().setAnalysisFreshness(SERVER_FRESH_VERDICT_AFTER_RERUN)
    })
    renderFreshnessSurfaces()
    const notice = screen.getByTestId('analysis-freshness-notice')
    expect(notice).not.toHaveAttribute('data-freshness', 'fresh')
    expect(notice).not.toHaveTextContent(FRESHNESS_COPY.fresh)
  })

  it('(c) the hold releases when a server-known graph replaces the canvas: hydrateGraphSlice', () => {
    seedPreImportAnalysedState()
    act(() => {
      useCanvasStore.getState().importCanvas(IMPORT_MODIFIED_JSON)
    })
    // A load of a structurally unrelated graph replaces the import.
    const other = structurallyUnrelatedGraph()
    act(() => {
      useCanvasStore.getState().hydrateGraphSlice({
        nodes: other.nodes as never,
        edges: other.edges as never,
        currentScenarioId: 'scn_after_import',
      })
    })
    act(() => {
      useCanvasStore.getState().setAnalysisFreshness(SERVER_FRESH_VERDICT_AFTER_RERUN)
    })
    renderFreshnessSurfaces()
    // A fresh verdict on a server-loaded graph may affirm again — the interim
    // hold must not become a permanent suppression.
    expect(screen.getByTestId('analysis-freshness-notice')).toHaveAttribute(
      'data-freshness',
      'fresh',
    )
  })

  it('(c) the hold releases on loadScenario (the production scenario-switch path)', () => {
    const scenario = createScenario({
      name: 'Scenario after import',
      nodes: [
        { id: 'scn_goal', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Scenario goal' } },
      ] as never,
      edges: [],
    })
    seedPreImportAnalysedState()
    act(() => {
      useCanvasStore.getState().importCanvas(IMPORT_MODIFIED_JSON)
    })
    act(() => {
      const ok = useCanvasStore.getState().loadScenario(scenario.id)
      expect(ok).toBe(true)
    })
    act(() => {
      useCanvasStore.getState().setAnalysisFreshness(SERVER_FRESH_VERDICT_AFTER_RERUN)
    })
    renderFreshnessSurfaces()
    expect(screen.getByTestId('analysis-freshness-notice')).toHaveAttribute(
      'data-freshness',
      'fresh',
    )
  })

  it('(c) the hold releases on resetCanvas', () => {
    seedPreImportAnalysedState()
    act(() => {
      useCanvasStore.getState().importCanvas(IMPORT_MODIFIED_JSON)
      useCanvasStore.getState().resetCanvas()
    })
    act(() => {
      useCanvasStore.getState().setAnalysisFreshness(SERVER_FRESH_VERDICT_AFTER_RERUN)
    })
    renderFreshnessSurfaces()
    expect(screen.getByTestId('analysis-freshness-notice')).toHaveAttribute(
      'data-freshness',
      'fresh',
    )
  })

  it('(c) the hold releases when a CEE draft replaces the canvas (applyDraftResult)', () => {
    seedPreImportAnalysedState()
    act(() => {
      useCanvasStore.getState().importCanvas(IMPORT_MODIFIED_JSON)
    })
    act(() => {
      applyDraftResult({
        nodes: [
          { id: 'd_goal', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Drafted goal' } },
        ],
        edges: [],
      } as never)
    })
    // applyDraftResult marks the overlay dirty for the draft mutation itself;
    // the draft's accompanying verdict then resolves it (existing behaviour) —
    // the import hold must not pin it.
    act(() => {
      useCanvasStore.getState().setAnalysisFreshness(SERVER_FRESH_VERDICT_AFTER_RERUN)
    })
    renderFreshnessSurfaces()
    expect(screen.getByTestId('analysis-freshness-notice')).toHaveAttribute(
      'data-freshness',
      'fresh',
    )
  })
})

/**
 * Round 2 — the three blockers from the adversarial review of PR #592.
 *
 * The first cut cleared an in-memory boolean at six named sites on the premise
 * that they replace the canvas "with a server-known graph". Two of them do not:
 * `hydrateGraphSlice`'s live callers pass the localStorage AUTOSAVE, and
 * `loadScenario` reads localStorage. `useAutosave` debounces 500 ms on a
 * graph-hash dirty check, so the imported graph is in localStorage ~0.5 s after
 * the import, and a reload re-installs it through a RELEASE site — restoring
 * the witnessed FAIL frame after one Rerun.
 *
 * The hold is now DERIVED at every graph-replacement site from a
 * sessionStorage marker keyed to imported-graph identity, so "which sites
 * release" is no longer a list anyone has to maintain. Per trap 12d, derivation
 * proves agreement and never completeness — so EVERY replacement site below
 * carries its own case, and each has its own mutant.
 */
describe('interim 2.467 round 2 — the hold is derived from the graph, not from a release list', () => {
  /** The reload: the autosave carries the imported graph back in via hydrateGraphSlice. */
  function simulateSameTabReloadRestoringAutosave() {
    const imported = JSON.parse(IMPORT_MODIFIED_JSON) as { nodes: never[]; edges: never[] }
    // A reload starts from a cold store; only sessionStorage survives.
    useCanvasStore.getState().reset()
    act(() => {
      useCanvasStore.getState().hydrateGraphSlice({
        nodes: imported.nodes,
        edges: imported.edges,
        // ReactFlowGraph's init effect preserves the scenario id across the
        // reload so the in-flight CEE conversation keeps its scenario_id —
        // which is exactly why CEE still holds its own pre-import graph.
        currentScenarioId: 'scn_preserved_across_reload',
      })
    })
  }

  it('BLOCKER A: after import → autosave → reload, a rerun\'s server "fresh" still cannot affirm', () => {
    seedPreImportAnalysedState()
    act(() => {
      useCanvasStore.getState().importCanvas(IMPORT_MODIFIED_JSON)
    })

    simulateSameTabReloadRestoringAutosave()

    // The graph on the canvas is the imported one, restored from localStorage;
    // the server has still never seen it.
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(true)

    act(() => {
      useCanvasStore.getState().setAnalysisFreshness(SERVER_FRESH_VERDICT_AFTER_RERUN)
      useCanvasStore.getState().clearAnalysisFreshnessDirty()
    })
    renderFreshnessSurfaces()
    const notice = screen.getByTestId('analysis-freshness-notice')
    expect(notice).toHaveAttribute('data-cee-freshness', 'fresh')
    expect(notice).not.toHaveAttribute('data-freshness', 'fresh')
    expect(notice).not.toHaveTextContent(FRESHNESS_COPY.fresh)
  })

  it('BLOCKER A control: a reload restoring a DIFFERENT (never-imported) graph does NOT hold', () => {
    // The same reload machinery, on a graph this session never imported: the
    // hold must not be a blanket suppression of every hydrate.
    seedPreImportAnalysedState()
    act(() => {
      useCanvasStore.getState().importCanvas(IMPORT_MODIFIED_JSON)
    })
    const other = structurallyUnrelatedGraph()
    useCanvasStore.getState().reset()
    act(() => {
      useCanvasStore.getState().hydrateGraphSlice({
        nodes: other.nodes as never,
        edges: other.edges as never,
        currentScenarioId: 'scn_other',
      })
    })
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(false)
    act(() => {
      useCanvasStore.getState().setAnalysisFreshness(SERVER_FRESH_VERDICT_AFTER_RERUN)
    })
    renderFreshnessSurfaces()
    expect(screen.getByTestId('analysis-freshness-notice')).toHaveAttribute(
      'data-freshness',
      'fresh',
    )
  })

  it('BLOCKER D: undoDraft back onto the imported graph RE-ARMS the hold', () => {
    const imported = JSON.parse(IMPORT_MODIFIED_JSON) as { nodes: never[]; edges: never[] }
    seedPreImportAnalysedState()
    act(() => {
      useCanvasStore.getState().importCanvas(IMPORT_MODIFIED_JSON)
    })
    // A CEE draft replaces the imported graph — the hold releases (CEE's own graph).
    act(() => {
      applyDraftResult({
        nodes: [
          { id: 'd_goal', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Drafted goal' } },
        ],
        edges: [],
      } as never)
    })
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(false)

    // ...and undo puts the IMPORTED graph back. The server has still never seen it.
    useCanvasStore.setState({
      draftChatPreDraftSnapshot: { nodes: imported.nodes, edges: imported.edges },
    } as never)
    act(() => {
      useCanvasStore.getState().undoDraft()
    })
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(true)

    act(() => {
      useCanvasStore.getState().setAnalysisFreshness(SERVER_FRESH_VERDICT_AFTER_RERUN)
      useCanvasStore.getState().clearAnalysisFreshnessDirty()
    })
    renderFreshnessSurfaces()
    expect(screen.getByTestId('analysis-freshness-notice')).not.toHaveAttribute(
      'data-freshness',
      'fresh',
    )
  })

  it('BLOCKER D control: undoDraft onto a never-imported pre-draft graph does NOT arm the hold', () => {
    const other = structurallyUnrelatedGraph()
    seedPreImportAnalysedState()
    act(() => {
      useCanvasStore.getState().importCanvas(IMPORT_MODIFIED_JSON)
      applyDraftResult({
        nodes: [
          { id: 'd_goal', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Drafted goal' } },
        ],
        edges: [],
      } as never)
    })
    useCanvasStore.setState({
      draftChatPreDraftSnapshot: { nodes: other.nodes, edges: other.edges },
    } as never)
    act(() => {
      useCanvasStore.getState().undoDraft()
    })
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(false)
  })

  it('the hold is LABEL-INDEPENDENT: relabelling a node on the imported graph cannot release it', () => {
    // The unsafe direction of the identity choice, pinned. If the digest
    // included labels, a user renaming one node on the imported canvas would
    // drop the hold and the next server 'fresh' would affirm — the P0,
    // reachable by an ordinary edit.
    seedPreImportAnalysedState()
    act(() => {
      useCanvasStore.getState().importCanvas(IMPORT_MODIFIED_JSON)
    })
    const relabelled = JSON.parse(IMPORT_MODIFIED_JSON) as {
      nodes: Array<{ id: string; data: { label: string } }>
      edges: never[]
    }
    const target = relabelled.nodes.find((n) => n.id === PRE_IMPORT_OPTION_ID)!
    target.data.label = 'Renamed after import'
    act(() => {
      useCanvasStore.getState().hydrateGraphSlice({
        nodes: relabelled.nodes as never,
        edges: relabelled.edges,
      })
    })
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(true)
  })

  it('BLOCKER E: loadScenario RESTORING the imported graph holds (localStorage is not the server)', () => {
    const imported = JSON.parse(IMPORT_MODIFIED_JSON) as { nodes: never[]; edges: never[] }
    // `loadScenario` reads scenarios.getScenario — localStorage, not the server.
    // A scenario saved while the imported graph was on the canvas restores an
    // unregistered graph exactly as the autosave does.
    const scenario = createScenario({
      name: 'Saved while imported',
      nodes: imported.nodes,
      edges: imported.edges,
    })
    seedPreImportAnalysedState()
    act(() => {
      useCanvasStore.getState().importCanvas(IMPORT_MODIFIED_JSON)
    })
    act(() => {
      expect(useCanvasStore.getState().loadScenario(scenario.id)).toBe(true)
    })
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(true)
  })

  // ⚠ The next two cases, and `(c) the hold releases on resetCanvas`, assert
  // release at sites where the derivation is CONSTANT `false` by construction
  // (empty/initial graph + the empty-graph null rule). They pin that the sites
  // release — they do NOT demonstrate derivation there, and a hardcoded `false`
  // satisfies them, which is exactly what the source now says those lines are.
  // The property that actually protects them is the empty-graph rule, pinned
  // separately above.
  it('resetCanvas EMPTY-GRAPH early-return branch releases the hold (constant site)', () => {
    seedPreImportAnalysedState()
    act(() => {
      useCanvasStore.getState().importCanvas(IMPORT_MODIFIED_JSON)
    })
    // Empty the graph without going through resetCanvas's main branch, so the
    // early return is the code under test (the branch whose mutant survived).
    useCanvasStore.setState({ nodes: [], edges: [] } as never)
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(true)
    act(() => {
      useCanvasStore.getState().resetCanvas()
    })
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(false)
  })

  it('reset() releases the hold (constant site — initialNodes/initialEdges are [])', () => {
    seedPreImportAnalysedState()
    act(() => {
      useCanvasStore.getState().importCanvas(IMPORT_MODIFIED_JSON)
    })
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(true)
    act(() => {
      useCanvasStore.getState().reset()
    })
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(false)
  })

  it('the marker lives in localStorage — the SAME scope as the autosave it defends', () => {
    // ⚠ THIS IS THE ONLY THING PINNING THE STORAGE MEDIUM, and a mutation probe
    // measured exactly that: swapping the medium left every behavioural test
    // below GREEN (a module-level variable would pass them too) — only this
    // key read went red. The behavioural tests prove independence from the
    // STORE INSTANCE, not from the page or the tab, because jsdom never
    // reloads. The real proof of the reload fix is a LIVE same-tab-reload
    // witness on staging.
    //
    // The medium matters twice over: `sessionStorage` (the second cut) dies
    // with the TAB while the autosave it defends is `localStorage` and does
    // not — so a fresh tab booted the imported graph with no marker and one
    // Rerun restored the FAIL frame. Same governing sentence as blocker A, one
    // level up: match the scope of the artefact you are defending.
    seedPreImportAnalysedState()
    act(() => {
      useCanvasStore.getState().importCanvas(IMPORT_MODIFIED_JSON)
    })
    const raw = globalThis.localStorage.getItem('olumi.import.pendingServerRegistration.v1')
    expect(raw).toBeTruthy()
    expect(raw).toContain(PRE_IMPORT_OPTION_ID) // the imported graph's own node id
    expect(
      globalThis.sessionStorage.getItem('olumi.import.pendingServerRegistration.v1'),
    ).toBeNull()
  })

  it('THE OVER-HOLD MUST NOT LIE: a held import renders cannot-confirm, never "Model changed"', () => {
    // The walk's OWN flow (export → relabel → import) yields a digest equal to
    // CEE's own graph, because identity is label-independent. Every later
    // install of the GENUINE server graph therefore re-derives the hold. In
    // that state the analysis really is current, so asserting "Model changed.
    // Results may be out of date." is factually FALSE — and a warning that
    // cries wolf trains users to ignore the one that matters. Cannot-confirm
    // is the honest reading: we cannot confirm the server analysed this graph.
    const imported = JSON.parse(IMPORT_MODIFIED_JSON) as { nodes: never[]; edges: never[] }
    seedPreImportAnalysedState()
    act(() => {
      useCanvasStore.getState().importCanvas(IMPORT_MODIFIED_JSON)
    })
    // The genuine server graph comes back (structurally identical → held).
    act(() => {
      useCanvasStore.getState().hydrateGraphSlice({
        nodes: imported.nodes,
        edges: imported.edges,
        currentScenarioId: 'scn_server_known',
      })
    })
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(true)
    act(() => {
      useCanvasStore.getState().setAnalysisFreshness(SERVER_FRESH_VERDICT_AFTER_RERUN)
    })

    renderFreshnessSurfaces()
    const notice = screen.getByTestId('analysis-freshness-notice')
    expect(notice).toHaveTextContent(FRESHNESS_COPY.unknown) // "Cannot confirm…"
    expect(notice).not.toHaveTextContent(FRESHNESS_COPY.stale) // never "Model changed…"
    // FOURTH SURFACE — the V7 strip must agree, not flip to "Model changed".
    const v7 = screen.getByTestId('v7-freshness-strip')
    expect(v7).toHaveAttribute('data-freshness-semantic', 'cannot_confirm')
    expect(v7).toHaveTextContent(FRESHNESS_COPY.unknown)
    expect(v7).not.toHaveTextContent(FRESHNESS_COPY.stale)
    // The bar keeps the AFFORDANCE while withholding the assertion.
    const bar = screen.getByTestId('reanalyse-bar')
    expect(bar).toHaveAttribute('data-reason', 'import-unregistered')
    expect(bar).not.toHaveTextContent('Model changed')
  })

  it('a CEE-STATED stale OUTRANKS the hold: all surfaces say "Model changed", bar keeps its assertion', () => {
    // A first-hand server statement is a strictly stronger TRUE claim than our
    // uncertainty. The first cut returned cannot-confirm ABOVE the stale
    // branch, which suppressed it AND — because the bar gated on 'changed' —
    // removed the Model tab's only re-analyse control: ROADMAP 2.129 (a),
    // live-proved on staging `98aae72e`, reproduced by the fix for a different
    // defect.
    seedPreImportAnalysedState()
    act(() => {
      useCanvasStore.getState().importCanvas(IMPORT_MODIFIED_JSON)
    })
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(true)
    act(() => {
      useCanvasStore.getState().setAnalysisFreshness({
        freshness: 'stale',
        freshness_reason: 'graph_hash_mismatch',
        graph_hash_at_run: 'server-at-run',
        current_graph_hash: 'server-current-different',
        computed_at: POST_RERUN_COMPUTED_AT,
      })
    })
    renderFreshnessSurfaces()
    expect(screen.getByTestId('analysis-freshness-notice')).toHaveAttribute(
      'data-freshness',
      'stale',
    )
    expect(screen.getByTestId('v7-freshness-strip')).toHaveAttribute(
      'data-freshness-semantic',
      'changed',
    )
    const bar = screen.getByTestId('reanalyse-bar')
    expect(bar).toHaveAttribute('data-reason', 'model-changed')
    expect(bar).toHaveTextContent('Model changed. Results may be out of date.')
  })

  it('the COMPLETION TOAST cannot claim "with the current model" under an import hold', () => {
    // The strip and the toast must claim the same thing (the acceptance the
    // notice's own docs state). A mutation probe caught this uncovered: the
    // toast took the un-held classification, so a rerun on an unregistered
    // import announced "completed with the current model" — the affirmative
    // the badge is forbidden to show, delivered by a different surface.
    seedPreImportAnalysedState()
    act(() => {
      useCanvasStore.getState().importCanvas(IMPORT_MODIFIED_JSON)
    })
    act(() => {
      useCanvasStore.getState().setAnalysisFreshness(SERVER_FRESH_VERDICT_AFTER_RERUN)
    })
    showToast.mockClear()
    // Drive a running → complete transition, which is what fires the toast.
    useCanvasStore.setState({ results: { status: 'streaming', progress: 50 } } as never)
    renderFreshnessSurfaces()
    act(() => {
      useCanvasStore.setState({ results: { status: 'complete', progress: 100 } } as never)
    })
    expect(showToast).toHaveBeenCalled()
    const said = showToast.mock.calls.map((c) => String(c[0])).join(' | ')
    expect(said).not.toContain('with the current model')
  })

  it('THE AFFIRMATIVE GATE IS SELF-SUFFICIENT: (fresh, dirty=false, hold) is cannot-confirm', () => {
    // Executed, not read: with the hold check placed below the
    // `fresh → 'current'` line, this combination returned 'current' — the
    // affirmative this PR exists to make unreachable — and was safe only
    // because setAnalysisFreshness forces dirty=true one module away. This
    // test asserts the classifier is fail-safe ON ITS OWN, with the overlay
    // explicitly CLEAN, so the guarantee cannot be refactored away elsewhere.
    expect(
      classifyFreshnessForDisplay(
        { freshness: 'fresh', freshnessReason: 'graph_hash_match' },
        false, // dirty — deliberately clean
        true, // importHold
      ),
    ).toBe('cannot_confirm')
    // Control: same inputs without the hold still affirm (the gate is not a
    // blanket suppression).
    expect(
      classifyFreshnessForDisplay(
        { freshness: 'fresh', freshnessReason: 'graph_hash_match' },
        false,
        false,
      ),
    ).toBe('current')
  })

  it('a draft REPRODUCING the imported graph identity still releases (M7b discriminator)', () => {
    // Written because a probe measured my claim FALSE: I said a mutant swapping
    // the draft site's literal `false` for the derivation would bite, but every
    // applyDraftResult call in this spec passed a structurally UNRELATED
    // payload, so nothing could tell the two apart. This is the missing
    // discriminating fixture: a WIRE-shaped draft (`from`/`to`, which is what
    // mapDraftEdgeToCanvas reads) carrying the imported graph's own node ids and
    // edge endpoints, so the mapped canvas graph has the SAME identity as the
    // marker. The derivation would hold here; the literal releases — which is
    // the deliberate behaviour (scope boundary: this interim defends
    // import-originated staleness only).
    seedPreImportAnalysedState()
    act(() => {
      useCanvasStore.getState().importCanvas(IMPORT_MODIFIED_JSON)
    })
    const landedNodes = useCanvasStore.getState().nodes
    const landedEdges = useCanvasStore.getState().edges
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(true)
    const draftPayload = {
      nodes: landedNodes.map((n) => ({
        id: n.id,
        type: (n as unknown as { type?: string }).type,
        label: (n.data as { label?: string } | undefined)?.label,
      })),
      edges: landedEdges.map((e, i) => ({
        id: e.id ?? `e-${i}`,
        from: e.source,
        to: e.target,
      })),
    }
    // ⚠ PIN THE FIXTURE'S DISCRIMINATING PROPERTY — without this line the test
    // cannot detect its own fixture rotting. The closing assertion
    // (`...toBe(false)`) is satisfied by TWO different worlds: the one this
    // test is about (the draft genuinely reproduces the imported identity, so
    // only the literal can explain the release) and the one where the fixture
    // has quietly stopped reproducing it (nothing to discriminate, and the
    // assertion passes anyway). MEASURED at 2.494: changing `id: n.id` above to
    // `id: n.id + '_ROTPROBE'` — so the draft reproduces NOTHING — left the
    // previous version of this test GREEN. Its discriminating power was real
    // but unguarded at rest, one refactor of `mapDraftNodeToCanvas` /
    // `mapDraftEdgeToCanvas` or one tidy-up of this builder away from decaying
    // into exactly the non-discriminating shape it was written to replace.
    //
    // So assert, through the SAME mappers `applyDraftResult` runs the payload
    // through, that the graph we are about to install WOULD hold. The release
    // below is then provably the literal's doing and not the fixture's failure.
    expect(
      isGraphPendingImportRegistration(
        draftPayload.nodes.map((n) => mapDraftNodeToCanvas(n)),
        draftPayload.edges.map((e, i) => mapDraftEdgeToCanvas(e, i)),
      ),
    ).toBe(true)
    act(() => {
      applyDraftResult(draftPayload as never)
    })
    // Same identity on the canvas, hold RELEASED — the discriminating outcome.
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(false)
  })

  it('INVARIANT that makes the toast safe: under a hold, a fresh verdict always leaves dirty=true', () => {
    // This is the DEMONSTRATION that mutant M14 (dropping `importHold` from the
    // notice's toast classification) is equivalent, rather than an assertion
    // that it is. With dirty forced true, `resolveDisplayedFreshness` already
    // downgrades 'fresh' → 'unknown', so the toast classification lands on
    // 'changed' with or without importHold, and BOTH produce the neutral
    // "Analysis rerun completed" line — never the affirmative. The only state
    // where the argument would change the toast is (hold ∧ ¬dirty ∧ fresh), and
    // the three writers below make that state unreachable. The argument is kept
    // as defence-in-depth: if this invariant ever weakens, the toast stays
    // honest without a second fix.
    seedPreImportAnalysedState()
    act(() => {
      useCanvasStore.getState().importCanvas(IMPORT_MODIFIED_JSON)
    })
    // 1. ingestion of a fresh verdict forces the overlay on
    act(() => {
      useCanvasStore.getState().setAnalysisFreshness(SERVER_FRESH_VERDICT_AFTER_RERUN)
    })
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
    // 2. the explicit clearer refuses under a hold
    act(() => {
      useCanvasStore.getState().clearAnalysisFreshnessDirty()
    })
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
    // 3. a verdictless run completion also keeps it
    act(() => {
      useCanvasStore.getState().noteRunCompletedWithoutVerdict()
    })
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
  })

  it('digest .sort() is load-bearing: a REORDERED hydrate of the imported graph still holds', () => {
    // A hydrate or a persistence round-trip can reorder nodes/edges without
    // changing the model. An order-sensitive digest would miss the match and
    // drop the hold — the P0, reached by a reordering that changes nothing.
    const imported = JSON.parse(IMPORT_MODIFIED_JSON) as {
      nodes: unknown[]
      edges: unknown[]
    }
    seedPreImportAnalysedState()
    act(() => {
      useCanvasStore.getState().importCanvas(IMPORT_MODIFIED_JSON)
    })
    useCanvasStore.getState().reset()
    act(() => {
      useCanvasStore.getState().hydrateGraphSlice({
        nodes: [...imported.nodes].reverse() as never,
        edges: [...imported.edges].reverse() as never,
      })
    })
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(true)
  })

  it('the empty-graph rule: an EMPTY import arms nothing (it is what makes the three constant sites safe)', () => {
    // graphImportDigest returns null for an empty graph. Three release sites
    // (resetCanvas's two branches and reset()) are constant `false` BECAUSE of
    // this rule — break it and an empty import would make every later reset
    // match the marker and hold forever.
    expect(graphImportDigest([], [])).toBeNull()
    markGraphImported([], [])
    expect(isGraphPendingImportRegistration([], [])).toBe(false)
    expect(__readImportRegistrationMarkers()).toEqual([])
  })

  it('the marker is scoped to the TAB, not to the store instance (what makes the reload case work)', () => {
    seedPreImportAnalysedState()
    act(() => {
      useCanvasStore.getState().importCanvas(IMPORT_MODIFIED_JSON)
    })
    // A cold store (what a reload produces) still knows the graph is unregistered.
    useCanvasStore.getState().reset()
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(false) // initial graph
    const imported = JSON.parse(IMPORT_MODIFIED_JSON) as { nodes: never[]; edges: never[] }
    act(() => {
      useCanvasStore.getState().hydrateGraphSlice({
        nodes: imported.nodes,
        edges: imported.edges,
      })
    })
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(true)
  })
})
