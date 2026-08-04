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
import { describe, it, expect, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { useCanvasStore } from '../store'
import { useAnalysisSnapshotStore } from '../stores/analysisSnapshotStore'
import { useComparisonStore } from '../stores/comparisonStore'
import { applyDraftResult } from '../utils/applyDraftResult'
import {
  AnalysisFreshnessNotice,
  FRESHNESS_COPY,
} from '../../components/results/AnalysisFreshnessNotice'
import { ReanalyseBar } from '../components/model-tab/ReanalyseBar'

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

function renderFreshnessSurfaces() {
  return render(
    <>
      <AnalysisFreshnessNotice />
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
    // Honest treatment: the model DID change since that analysis (the import),
    // so the composed trust semantic is 'changed' and the re-analyse bar shows.
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
    expect(screen.getByTestId('reanalyse-bar')).toBeInTheDocument()
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
    // Production scenario load replaces the graph — the import is gone.
    const exported = JSON.parse(EXPORT_ORIGINAL_JSON) as { nodes: never[]; edges: never[] }
    act(() => {
      useCanvasStore.getState().hydrateGraphSlice({
        nodes: exported.nodes,
        edges: exported.edges,
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
