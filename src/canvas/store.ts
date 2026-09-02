// Hardened store with timer cleanup, ID reseeding, edge debouncing
import { create } from 'zustand'
import { provenanceAfterHumanAuthoredLabel } from './domain/goalLabelProvenance'
import { Node, Edge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from '@xyflow/react'
import { saveSnapshot as persistSnapshot, importCanvas as persistImport, exportCanvas as persistExport } from './persist'
import { setsEqual, mapsEqual } from './store/utils'
import { assignStableOptionNumbers } from './store/stableOptionNumbers'
import { DEFAULT_EDGE_DATA, USER_EDGE_DEFAULTS, type EdgeData } from './domain/edges'
import { edgeValueSourcePatch, type CausalLensEdgeParams } from './domain/edgeValueProvenance'
import {
  NODE_REGISTRY,
  resolveNodeTypeLiteral,
  type NodeType,
  type NodeData,
} from './domain/nodes'
import { hasAnalyticalNodeChange, hasAnalyticalEdgeChange } from './domain/analyticalChange'
import { applyLayout, applyLayoutWithPolicy } from './layout'
import { mergePolicy } from './layout/policy'
import { policyToPreset, policyToSpacing } from './layout/adapters'
import { getInvalidNodes as getInvalidNodesUtil, getNextInvalidNode as getNextInvalidNodeUtil, type InvalidNodeInfo } from './utils/validateOutgoing'
import type { ReportV1 } from '../adapters/plot/types'
import type { V2RunResponse } from '../adapters/plot/v2/types'
import type { PLoTEnrichment } from '../adapters/plot/enrichment'
import {
  selectGoalProbability,
  type GoalProbabilityInput,
} from '../components/results/utils/selectGoalProbability'
import { trackResultsViewed, trackIssuesOpened, trackLayoutFallbackApplied } from './utils/sandboxTelemetry'
import { addRun, generateGraphHash, loadRuns, type StoredRun, type RestorableRun } from './store/runHistory'
// The "no analysis on screen" state, shared with the Supabase switch boundary in
// `hooks/useScenario`. See that module's header for why it is not defined here.
import { createIdleResults } from './store/idleResults'
import { RUN_COMPLETED_WITHOUT_VERDICT, VERDICT_ABSENT_FROM_PAYLOAD, deriveAnalysisFreshnessUpdate, type AnalysisFreshnessState } from './store/analysisFreshness'
import type { AnalysisRefusalNotice } from './store/analysisRefusalNotice'
import {
  captureStructuralDelete,
  mergeStructuralDeleteIntents,
  type StructuralDeleteIntent,
} from './mutations/structuralDelete'
import {
  captureStructuralRename,
  STRUCTURAL_RENAME_DEFERRED_NOTICE,
  STRUCTURAL_RENAME_LIFECYCLE_LIMIT,
  type StructuralRenameIntent,
  type StructuralRenameLifecycleRecord,
  type StructuralRenameTerminalStatus,
} from './mutations/structuralRename'
import {
  captureStructuralAdd,
  STRUCTURAL_ADD_DEFERRED_NOTICE,
  STRUCTURAL_ADD_LIFECYCLE_LIMIT,
  WIRE_ADDABLE_NODE_KINDS,
  type StructuralAddIntent,
  type StructuralAddLifecycleRecord,
  type StructuralAddTerminalStatus,
} from './mutations/structuralAdd'
import {
  EMPTY_DURABLE_DELETION_RECORD,
  addDurableDeletion,
  buildDurableDeletionNotice,
  reconcileDurableDeletions,
  withholdDurableDeletions,
  type DurableDeletionNotice,
  type DurableDeletionRecord,
} from './store/durableDeletionGuard'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'
import * as scenarios from './store/scenarios'
import type { ScenarioFraming } from './store/scenarios'
// Value import, and deliberately so: `resetCanvas` must forget the persisted
// transcript as well as the persisted graph, or "start fresh" is fresh only
// until the next reload. transcriptStore imports nothing but a type, so this
// cannot introduce a cycle.
import { clearTranscript } from './conversation/utils/transcriptStore'
import { projectAutosaveData, autosaveSourceFromStore, analysisSnapshotFromStore } from './store/autosaveProjection'
import { registerCrashSnapshotProvider } from './persist/crashFlush'
import type { GraphHealth, ValidationIssue, NeedleMover } from './validation/types'
import type { Document, Citation } from './share/types'
import type { ComparisonResult } from './snapshots/types'
import type { CeeDecisionReviewPayload, CeeTraceMeta, CeeErrorViewModel } from './decisionReview/types'
import type { CeeDecisionReviewPayloadV1, CeeTrace, CeeError, M1Review, M1Coaching, ErrorDetail } from '../types/cee'
import type { DecisionReview030 } from '../v5/decisionReviewAdapter'
import { sanitizeCeeReviewPayload, sanitizeM1Review } from './utils/ceeDataAdapter'
import type {
  CEEAnalysisReady,
  CEEGoalConstraint,
  CeePipelineTrace,
  CEEDraftWarning,
  CEEGoalConnectivity,
  CEEModelQualityFactors,
  CEEInterventionHint,
  PreAnalysisSensitivity,
  CEEDraftCoaching,
} from '../adapters/cee/types'
import type { LimitsV1 } from '../adapters/plot/types'
import type { ScenarioStage, ScenarioEvent } from '../types/scenario'
import type { CeeDebugHeaders } from './utils/ceeDebugHeaders'
import { identityFromCanvasGraph } from './utils/graphIdentity'
// Static import, deliberately: this runs in the LAYOUT FAILURE path, so it must
// not depend on a dynamic import that can fail alongside the layout engine it
// is rescuing (the `./utils/layout` import above is dynamic and is one of the
// things that can throw here).
import { placeNodesDeterministically } from './utils/fallbackPlacement'
import type { LayoutAttemptResult } from './layout/handleLayoutWithRecovery'
import { captureError } from '../lib/monitoring'
import { buildPersistedGraph, readPersistedGoalConstraints } from './utils/persistedGraph'
import {
  markGraphImported,
  isGraphPendingImportRegistration,
} from './store/importRegistrationMarker'
import { isCompareTabEnabled } from '../flags'
import { useAnalysisSnapshotStore } from './stores/analysisSnapshotStore'
import { buildAnalysisSnapshot } from './stores/analysisSnapshotFactory'
import { buildSnapshotFromV5Analysis } from './stores/v5RunSnapshotFactory'
import { handleLayoutWithRecovery } from './layout/handleLayoutWithRecovery'
import { useComparisonStore } from './stores/comparisonStore'
import { useDraftStore } from './stores/draftStore'
import { loadSearchQuery, loadSortPreferences, saveSearchQuery, saveSortPreferences, __test__ as docsTest } from './store/documents'
import { loadUIPreferences, saveUIPreference } from './store/uiPreferences'
import { validateCeeAnalysisReady } from './utils/ceeAnalysisReadyValidation'
import { recordCrossSurfaceEvent, recordUserAction } from '../lib/debug-state'
import {
  isSelfLoop,
  isDuplicateEdge,
  wouldCreateCycle,
  wouldExceedLimits,
  type LimitExceeded,
} from './validation/graphGuardrails'
// Task C: Panel coordination — opening one right panel closes others
import { useUIStore } from '../stores/uiStore'

/**
 * Main canvas store. Holds graph, history, CEE readiness, results,
 * scenario, and tightly coupled UI state (lens, panels, documents).
 *
 * Independent slices extracted:
 *   useComparisonStore — passive comparison state
 *   useDraftStore — model selection, draft status, generation state
 *
 * See also:
 *   useResultsStore — sandbox-guide results (separate surface, not synchronised)
 *   src/canvas/selectors/results.ts — named selectors for canvas-app results
 */

/** A1: Lightweight snapshot of key values for delta display between analysis runs */
export interface OptionSnapshot {
  winProbability?: number
  outcomeMean?: number
  goalProbability?: number
}

export interface PreviousReportSnapshot {
  options: Record<string, OptionSnapshot>
  rankingStability?: number
  driverInfluences?: Record<string, number>
}

/** Result of addEdge — indicates whether the edge was created and why it was blocked */
export type AddEdgeBlockReason = 'self_loop' | 'duplicate' | 'cycle' | 'node_not_found' | 'edge_limit'
export interface AddEdgeResult {
  created: boolean
  reason?: AddEdgeBlockReason
}

// Brief 37 Optimization: Stable empty array to prevent re-renders
// graphHealthFromQuality() returns this when no issues exist, avoiding new array allocation
const EMPTY_VALIDATION_ISSUES: ValidationIssue[] = []

// Graph Lens: Factory for fresh lens state (avoids shared mutable Set/Map references across resets)
function createDefaultLensState() {
  return {
    active: 'full' as const,
    selectedOptionId: null as string | null,
    _dimmedNodeIds: new Set<string>(),
    _dimmedEdgeIds: new Set<string>(),
    _sensitivityWeights: new Map<string, number>(),
    _sensitivityQuartiles: null as { q25: number; q75: number } | null,
    _fragileEdgeIds: new Set<string>(),
    // Expanded lenses (Brief 5)
    _hiddenNodeIds: new Set<string>(),
    _hiddenEdgeIds: new Set<string>(),
    _causalEdgeParams: new Map<string, CausalLensEdgeParams>(),
    _evidenceNodeClass: new Map<string, 'grounded' | 'assumed' | 'none' | 'na'>(),
    _evidenceEdgeClass: new Map<string, 'evidence' | 'assumed' | 'unknown'>(),
  }
}

/**
 * Generate deterministic content hash using FNV-1a algorithm
 * Fast, simple, and produces consistent hashes for content integrity checks
 */
function generateContentHash(content: string): string {
  let hash = 2166136261 // FNV offset basis
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i)
    hash = Math.imul(hash, 16777619) // FNV prime
  }
  // Convert to unsigned 32-bit hex string
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * Attempts to restore results from run history by hash.
 * Wrapped in try-catch since localStorage can throw.
 * Returns true if results were restored, false otherwise.
 */
function tryRestoreResultsFromHistory(
  resultHash: string | undefined,
  restoreFn: (run: StoredRun) => void
): boolean {
  if (!resultHash) return false
  try {
    const runs = loadRuns()
    const run = runs.find(r => r.hash === resultHash)
    if (run) {
      restoreFn(run)
      if (process.env?.NODE_ENV === 'development') {
        console.debug('[canvas] Restored results from history:', resultHash)
      }
      return true
    }
    if (process.env?.NODE_ENV === 'development') {
      console.debug('[canvas] Run not found in history:', resultHash)
    }
  } catch (e) {
    console.warn('[canvas] Failed to restore results from history:', e)
  }
  return false
}

// CEE quality dimensions from draft-graph response
// CEE quality sub-scores. Declared in `canvas/utils/ceeQualityDimensions.ts`
// beside `readCeeQualityDimensions`, the ONE reader — the shape and the rule
// that fills it must not be able to drift apart. Imported AND re-exported here
// because this is where every existing consumer already imports it from, and
// this file uses it in its own action signatures.
import type { CeeQualityDimensions } from './utils/ceeQualityDimensions'
export type { CeeQualityDimensions }

// Results panel state machine
export type ResultsStatus = 'idle' | 'preparing' | 'connecting' | 'streaming' | 'complete' | 'error' | 'cancelled'

export interface ResultsState {
  status: ResultsStatus
  progress: number              // 0..100 (cap 90 until COMPLETE)
  runId?: string
  isDuplicateRun?: boolean      // v1.2: true if this run hash already existed in history
  wasForced?: boolean           // v1.2: true if this was a forced rerun (suppresses duplicate toast)
  seed?: number
  hash?: string                 // response_hash
  report?: ReportV1 | null
  error?: { code: string; message: string; retryAfter?: number; request_id?: string; canRetry?: boolean; affectedOptions?: Array<{ id: string; label: string }> } | null
  startedAt?: number
  finishedAt?: number
  drivers?: Array<{ kind: 'node' | 'edge'; id: string }>
  // Phase 1B: PLoT enrichment data (ISL results bundled with PLoT response)
  // When VITE_USE_PLOT_ENRICHMENT is enabled, robustness/validation data comes from here
  enrichment?: PLoTEnrichment | null
  /**
   * A.9: Provenance of the current results — 'direct' (Play button) or 'conversation'
   * (arrived via orchestrator envelope). Used by the conversation indicator badge.
   */
  resultsSource?: 'direct' | 'conversation'
  /**
   * Lane 3 (SF2): true when the last transition to 'complete' was a
   * resultless SETTLE (the run ended and the PREVIOUS report was restored —
   * no new results arrived). The freshness strip's completion toast must not
   * claim "rerun completed" for this case. Cleared by every new run and by a
   * genuine completion.
   */
  settledWithoutNewReport?: boolean
  /**
   * ROADMAP 2.1127 — run identity, so a surface can PROVE whether the report it
   * is displaying belongs to the run that just failed or to an earlier one.
   *
   * `status === 'error'` alone cannot answer that. `useV2Run` calls
   * `resultsComplete` (`:991`) and then runs ~120 more lines UNGUARDED before
   * its success return: a synchronous throw in `generateGraphHash` (`:1038`),
   * `persistAnalysisSuccess` (`:1039`), `setRunMeta` (`:1056`), `setGate`
   * (`:1073`/`:1079`/`:1090`) or `updateRobustnessGateFromV2` (`:1098`) lands in
   * the catch at `:1150` and settles a failure with THIS run's report in the
   * store. A chip reading "showing results from previous analysis" off `isError`
   * is simply false there.
   *
   * The counter is stamped inside the store's own transitions, so every
   * producer (useV2Run, useResultsRun, useConversation, applyV5State) gets it
   * with no call-site change and none can forget to pass it.
   *
   * ⚠ Absent stamps mean UNKNOWN, never "previous" — a surface that cannot
   * prove the provenance must make no provenance claim.
   */
  runEpoch?: number
  /** The `runEpoch` of the run that produced the report currently held. */
  reportEpoch?: number
  /** The `runEpoch` of the run that produced the error currently held. */
  errorEpoch?: number
  /**
   * ⭐ THE SCENARIO A *RESTORED* REPORT WAS RECOVERED FOR — and the only field
   * on this slice that carries scenario identity at all.
   *
   * THE DEFECT IT CLOSES. `useScenario.loadScenario` (the Supabase leg, the only
   * one `/scenario/:id` runs) sets `results: createIdleResults()`
   * UNCONDITIONALLY on every load, including a RELOAD OF THE SAME SCENARIO. Its
   * only repopulator is gated on `analysis_status === 'ready' && analysis !=
   * null`, and those two columns have NO CURRENT WRITER — their writer
   * (`persistAnalysisSuccess` → `scenarioService.storeAnalysis`) was retired
   * with the direct browser→PLoT `/v2/run` path (ROADMAP 2.1229). And the
   * ordering is decisive: `ReactFlowGraph`'s init effect — where
   * `restoreAnalysisFromAutosave` runs — fires FIRST as a child effect, so the
   * Supabase load lands afterwards and wipes even a SUCCESSFUL restore. A
   * signed-in user who ran an analysis and refreshed got their graph,
   * constraints and conversation back, and lost only the answer.
   *
   * WHY IDENTITY AND NOT A BOOLEAN. The clear is CORRECT at a genuine scenario
   * SWITCH — without it, A's completed report is displayed under B's name and
   * the autosave projection can persist it there (pinned in
   * `useScenario.analysisResultsLeakOnSwitch.spec.ts`). One predicate therefore
   * guards two opposite harms, and only the scenario id can tell them apart
   * (CLAUDE.md trap 21/22b). A boolean "this was restored" would preserve
   * across a switch too, which is the worse of the two harms.
   *
   * ⚠ ONE WRITER — BUT TEN CARRIERS, AND THAT IS THE DANGEROUS HALF.
   * PRODUCED only by `resultsLoadHistorical`'s optional second argument, which
   * only `restoreAnalysisFromAutosave` supplies (from `autosave.scenarioId`,
   * the id the record was written under). It does NOT follow that every other
   * `results` write is free of it: enumerated at the bytes
   * (`rg -n 'results:\s*\{' src/canvas/store.ts` → 16 sites), TEN of them carry
   * the previous slice forward with `...s.results` — `resultsConnecting`,
   * `resultsProgress`, `resultsComplete` and its duplicate-run follow-up,
   * `resultsError`, `resultsCancelled`, `resultsAnalysing`, both arms of
   * `resultsSettle`, and `resultsHydrateFromSupabase`. An earlier version of
   * this comment claimed they all "replace the slice without it"; that was
   * FALSE at the bytes, and a stale stamp riding one of those spreads is worse
   * than the defect this field closes — it converts a lost answer into a
   * confidently wrong one. What actually makes the claim true is the shared
   * guard `createRestoreStampGuard`, which strips the stamp from every `set`
   * except the one authorised write. Pinned per-carrier in
   * `hooks/__tests__/useScenario.reloadPreservesRestoredResults.spec.ts`.
   *
   * ⚠ ABSENCE IS FAIL-CLOSED. A missing stamp is never read as "belongs to this
   * scenario" — `loadScenario` clears exactly as it did before.
   *
   * ⚠ NOT a currency claim. It says WHICH SCENARIO this answer belongs to, not
   * that the answer is still current. Currency is decided by the freshness
   * machinery, which marks every reloaded report `orphaned_plot_result` →
   * `results_stale` (`hooks/useAnalysisStateSource.ts`,
   * `state/analysisStateSelector.ts`) — because `v5AnalysisFact` is SESSION-ONLY
   * and is never restored: this store has no `persist()` middleware and
   * `AutosaveData` has no such field, so after a reload it is absent whatever
   * the load does. ⚠ An earlier version of this comment added "AND
   * `hydrateGraphSlice` nulls it on every load carrying nodes"; that is FALSE.
   * `hydrateGraphSlice` nulls `analysisFreshness`, `analysisFreshnessDirty`,
   * `analysisRefusalNotice` and `analysisStateV1` on a load carrying nodes, but
   * NOT `v5AnalysisFact` — the only writers of `v5AnalysisFact: null` are the
   * initial state, `importCanvas` and `resetCanvas` (enumerated with a contrast
   * control). The conclusion stands on session-only alone. Measured, with a
   * contrast control, in
   * `hooks/__tests__/useScenario.reloadPreservesRestoredResults.spec.ts`.
   * ⚠ Scoped to the deployed flag posture (`VITE_V5_CANONICAL_ANALYSIS=true`,
   * `netlify.toml`) — that posture is derived by a test, not asserted here.
   */
  restoredForScenarioId?: string | null
}


/**
 * ROADMAP 2.1127 — the `reportEpoch` stamped on a report RESTORED from history
 * rather than produced by a run in this session. `runEpoch` counts from 1, so
 * this can never equal a future `errorEpoch`: a restored report is provably not
 * the output of the run that fails next.
 */
export const HISTORICAL_REPORT_EPOCH = 0

/**
 * V5 analysis-fact state — written when a CEE V5 OlumiResponse carries an
 * `analysis_result` block plus the explicit run_analysis fact signals
 * (analysis_freshness, has_run_analysis_fact) emitted by Phase 3A.
 *
 * Per v5-canonical-analysis brief correction 3: this slice is the canonical
 * source-of-truth for "is there a successful V5 analysis fact for the
 * current scenario?". Generic `ceeAnalysisReady` readiness MUST NOT be used
 * as a substitute.
 *
 * Phase 3 blocks (coaching / review_card / evidence / exercise) are
 * preserved verbatim in `rawBlocks` so consumers can read freshness,
 * action_intent, priority_rank, target_refs, and graph_hash_at_generation
 * directly. The `source` discriminator tracks where the parser harvested
 * each block (sidecar / analysis_ready / enrichment / blocks[] via the
 * Phase 3 tolerance shim).
 */
export interface V5AnalysisFactState {
  /** The scenarioId this fact attaches to. Cleared when scenario changes. */
  scenarioId: string | null
  /** Hash of the analysis_result that produced this fact — matches results.hash. */
  analysisHash: string | null
  /** Strict CEE-emitted boolean when present; null when CEE did not emit it. */
  hasRunAnalysisFact: boolean | null
  /** CEE's freshness signal for the fact (fresh/stale/unknown/none). */
  freshness: 'fresh' | 'stale' | 'unknown' | 'none' | null
  /** Reason CEE gave alongside freshness (e.g. 'no_successful_run_analysis_fact'). */
  freshnessReason: string | null
  /** Raw Phase 3 blocks preserved verbatim — no field flattening. */
  rawBlocks: Array<{
    type: 'coaching' | 'review_card' | 'evidence' | 'exercise'
    raw: Record<string, unknown>
    id: string
    source: 'sidecar' | 'analysis_ready' | 'enrichment' | 'sidecar_blocks_array'
  }>
  /** When this slice was written (ms since epoch). Diagnostics only. */
  writtenAt: number
}

export type SseDiagnostics = {
  resumes: number
  trims: 0 | 1
  recovered_events: number
  correlation_id: string
}

export type RunMetaState = {
  diagnostics?: SseDiagnostics
  correlationIdHeader?: string
  degraded?: boolean
  // Legacy CEE types (deprecated - use ceeReviewV1, ceeTraceV1, ceeErrorV1)
  ceeReview?: CeeDecisionReviewPayload | null
  ceeTrace?: CeeTraceMeta | null
  ceeError?: CeeErrorViewModel | null
  // M1 CEE Orchestrator types (new contract)
  ceeReviewV1?: CeeDecisionReviewPayloadV1 | null
  ceeTraceV1?: CeeTrace | null
  ceeErrorV1?: CeeError | null
  /**
   * ROADMAP 2.154 — the 0.30 `enrichment.decision_review` view-model from a V5
   * analysis turn. A SEPARATE field from `ceeReviewV1` on purpose: the two are
   * different payloads with different producers (`ceeReviewV1` is the M1 REST
   * shape, still produced live by `synthesizeCeeReviewFromV2`), and
   * `sanitizeCeeReviewPayload` below is M1-specific, so putting a 0.30 object
   * in `ceeReviewV1` would both lie about the type and be mangled on ingest.
   * Written by `applyV5State` on every V5 analysis turn — value or null, never
   * left stale.
   */
  decisionReview030?: DecisionReview030 | null
  // M1 Review - CEE enrichment from /v2/run (rationale, robustness synthesis, etc.)
  m1Review?: M1Review | null
  // M1 Coaching - deterministic coaching fields from /v2/run (not LLM-generated)
  m1Coaching?: M1Coaching | null
  // V12: PLoT review_status — gates M2 progressive enrichment ('complete' enables M2 data)
  reviewStatus?: string
  // M1 Review assumptions + pre-mortem from PLoT /v2/run (V12: widened for M2 fields)
  m1ReviewAssumptions?: {
    key_assumptions: string[]
    pre_mortem?: { failure_scenario: string; warning_signs: string[]; mitigation: string } | null
    decision_quality_prompts?: unknown[]
    bias_findings?: unknown[]
    evidence_enhancements?: Record<string, unknown>
    narrative_summary?: string
  } | null
  ceeDebugHeaders?: CeeDebugHeaders // Phase 1 Section 4.1: Dev-only debug headers
  // Raw error data for debugging malformed responses
  rawErrorData?: {
    payload?: unknown             // Raw payload that failed validation (redacted)
    expectedShape?: string        // Description of expected structure
    validationErrors?: string[]   // Hard errors that blocked processing
    validationWarnings?: string[] // Soft warnings (processing continued)
    timestamp?: string            // ISO timestamp when error occurred
  }
  // Error details for Debug Panel (captures upstream service failures)
  errorDetails?: ErrorDetail[]
  /** CEE diagnostic trace from envelope._diagnostic_trace. Passthrough — UI must not transform. */
  ceeDiagnosticTrace?: Record<string, unknown> | null
}

const initialNodes: Node[] = []

const initialEdges: Edge<EdgeData>[] = []

interface ClipboardData {
  nodes: Node[]
  edges: Edge<EdgeData>[]
}

type ReconnectEnd = 'source' | 'target'

interface ReconnectState {
  edgeId: string
  end: ReconnectEnd
}

interface CanvasState {
  nodes: Node[]
  edges: Edge<EdgeData>[]
  /** Graph Editing Experience Task 8: history entries now carry optional labels for undo toast */
  history: { past: { nodes: Node[]; edges: Edge<EdgeData>[]; label?: string }[]; future: { nodes: Node[]; edges: Edge<EdgeData>[]; label?: string }[] }
  selection: { nodeIds: Set<string>; edgeIds: Set<string>; anchorPosition: { x: number; y: number } | null }
  clipboard: ClipboardData | null
  reconnecting: ReconnectState | null
  touchedNodeIds: Set<string>  // Nodes with edited probabilities
  outcomeNodeId: string | null  // Selected outcome node for analysis
  // Optional success threshold for probability_of_goal. UNIT CONTRACT: user
  // units (the goal_threshold_raw scale) — every writer (threshold editors,
  // CEE sync) stores raw values and every display reader treats it as raw.
  // The one normalised consumer (PLoT request goal_threshold, 0-1) converts
  // at the boundary in useV2Run (UI-SEM-058).
  goalThreshold: number | null
  // Lane 5 (Codex P0-1): explicit representation of the goalThreshold scalar.
  // The field usually holds RAW user units, but the CEE bare-sync can store a
  // value that is already NORMALISED 0-1 (CEE's goal_threshold with no raw/cap
  // of its own). Inferring "raw because a cap exists" divided a normalised 0.6
  // by the goal node's cap 100 → 0.006 on the wire. The request boundary
  // consults this tag: 'normalised' passes through iff ∈[0,1], never divided;
  // 'raw' (or null/legacy) keeps the cap-chain conversion.
  goalThresholdRepresentation: 'raw' | 'normalised' | null
  nextNodeId: number
  nextEdgeId: number
  _internal: { lastHistoryHash: string }
  /**
   * Analysis results panel state for the main canvas app.
   * Authoritative source for src/canvas/ and src/components/results/.
   * New code should use the named selectors in
   * src/canvas/selectors/results.ts rather than subscribing directly.
   * The sandbox-guide surfaces (src/pages/sandbox-guide/) use a
   * separate useResultsStore with the same schema. See the JSDoc on
   * useResultsStore for the split rationale.
   */
  results: ResultsState
  runMeta: RunMetaState
  /** A1: Snapshot of key values from the previous analysis run for delta display */
  previousReport: PreviousReportSnapshot | null
  // Scenario state
  currentScenarioId: string | null  // Active scenario ID
  /** True when the scenario has been confirmed to exist in Supabase (created or loaded from DB) */
  scenarioPersistedToDb: boolean
  currentScenarioFraming: ScenarioFraming | null
  // A.15: Decision lifecycle stage (hydrated from Supabase, updated by orchestrator)
  currentStage: ScenarioStage | null
  currentScenarioLastResultHash: string | null  // Most recent analysis hash for the active scenario
  currentScenarioLastRunAt: string | null  // ISO timestamp of last analysis run for the active scenario
  currentScenarioLastRunSeed: string | null  // Seed used for last analysis run (stringified)
  hasCompletedFirstRun: boolean  // True after at least one successful or restored run in this session
  graphEditedSinceLastRun: boolean  // True when graph has been structurally edited since last analysis run
  /**
   * True only after `resultsComplete` has fully written a fresh analysis
   * snapshot (hash + rawV2Response) to the store. Flipped to false by
   * `resultsStart` (new run begins — prior snapshot is no longer trustworthy)
   * and by any graph edit (via `pushToHistory`). Read by `buildRequest` in
   * useConversation to gate whether `analysis_state` is included in the CEE
   * turn payload, closing the race where a just-finished run's hash is
   * readable but the rawV2Response write hasn't settled. Belt-and-braces
   * over the existing `graphEditedSinceLastRun` + `status === 'complete'`
   * guards — see docs/open-issues-root-cause-investigation-2026-04-09.md.
   */
  analysisStateReady: boolean
  isDirty: boolean  // Has unsaved changes
  isSaving: boolean  // P0-2: Currently saving
  lastSavedAt: number | null  // P0-2: Timestamp of last successful save
  // Panel visibility
  showResultsPanel: boolean
  showInspectorPanel: boolean
  showTemplatesPanel: boolean
  templatesPanelInvoker: HTMLElement | null
  showDraftChat: boolean
  // Current brief textarea content (synced from ChatComposer for graph-readiness requests)
  currentBriefText: string | null
  // Draft composer text — persists across panel collapse/reopen so users don't
  // lose mid-typed messages. Scoped to the current scenario: cleared on send,
  // scenario switch (loadScenario / importCanvas), and explicit reset.
  // Distinct from currentBriefText, which is the readiness-signal mirror.
  draftComposerText: string | null
  // Draft slice extracted to useDraftStore as of C3-5:
  //   selectedGenerationModel, selectedRepairModel, selectedEnrichmentModel
  //   isGenerating, lastDraftDescription, lastDraftError, fullDraftAppliedAt
  // draftChatPreDraftSnapshot stays here because undoDraft writes it atomically
  // alongside nodes/edges/readiness/lens in a single set() call.
  draftChatPreDraftSnapshot: { nodes: Node[]; edges: Edge<EdgeData>[] } | null
  // V5 canonical analysis (v5-canonical-analysis brief): raw Phase 3 content
  // extracted from the last V5 OlumiResponse plus the explicit
  // run_analysis fact signals CEE emits alongside it. Held verbatim — no
  // field flattening — so downstream consumers (Inspector, AI panel,
  // diagnostics) can read freshness, action_intent, priority_rank,
  // target_refs, graph_hash_at_generation directly off the raw blocks.
  //
  // Source of truth for "do we have a real V5 analysis fact for the
  // current scenario" — NOT ceeAnalysisReady (which is generic model
  // readiness, not proof of a successful run_analysis fact).
  v5AnalysisFact: V5AnalysisFactState | null
  // CEE V3: analysis_ready payload from last draft
  // Used by useV2Run to build requests with resolved interventions
  ceeAnalysisReady: CEEAnalysisReady | null
  // Analysis freshness verdict from CEE analysis_ready.freshness — retained
  // across turns; sourced independently of ceeAnalysisReady / v5AnalysisFact.
  analysisFreshness: AnalysisFreshnessState | null
  // Local dirty overlay: set true by an analysis-affecting local edit (reusing
  // the existing invalidateAnalysisReady / delete / undo-redo recognition), so the
  // UI can downgrade a retained CEE 'fresh' verdict to cannot-confirm WITHOUT
  // fabricating 'stale'. Cleared when a new analysis_ready arrives or on
  // scenario switch/load/import/reset. NOT a graph hash; see analysisFreshness.ts.
  analysisFreshnessDirty: boolean
  // ROADMAP 2.1163 / EXT-2: CEE's TYPED analysis refusal (analysis_ready
  // status 'blocked' + a specific blocked_reason). Deliberately NOT the
  // readiness slice — the readiness normaliser rejects that carrier on
  // purpose, and that rejection is load-bearing. Session-local — never
  // persisted: a refusal is a fact about ONE turn, so restoring it into a
  // later session would assert a refusal that did not happen there.
  analysisRefusalNotice: AnalysisRefusalNotice | null
  /**
   * Analysis-state authority migration, STEP 5: CEE's ONE composed
   * `analysis_state` verdict for the current turn (`AnalysisStateV1`,
   * @talchain/schemas 0.46.0), parsed at the V5 ingest and held verbatim.
   *
   * Read ONLY through `canvas/state/analysisStateSelector.ts` — never directly.
   * The selector feature-detects on this field: non-null means CEE stated a
   * verdict and it OUTRANKS every local derivation; null means the turn carried
   * none and the legacy derivations answer. Nothing else selects that branch.
   *
   * SESSION-LOCAL, NEVER PERSISTED — the same rule and the same reason as
   * `analysisRefusalNotice` above: this is a fact about ONE turn, and restoring
   * it into a later session would assert a verdict CEE never gave there. It is
   * deliberately absent from `setCeeAnalysisReady`'s sessionStorage write and
   * from the autosave projection allow-list.
   */
  analysisStateV1: AnalysisStateV1 | null
  /**
   * Interim 2.467 mitigation (P0 trust, live-witnessed 2026-08-04,
   * rewalk-2459b attempt 2): true while the canvas graph came from a local
   * IMPORT that the server has never seen. An import replaces the whole graph
   * client-side only (zero server-side graph persistence — walk VERDICT 3), so
   * a subsequent rerun is computed by CEE against ITS OWN pre-import graph and
   * its `analysis_ready.freshness='fresh'` verdict is about the WRONG graph.
   * While this flag is set, the freshness machinery holds the dirty overlay
   * (a server 'fresh' displays as cannot-confirm — the existing downgrade,
   * never a fabricated 'stale') so the affirmative "Analysis reflects the
   * current model." is unreachable.
   *
   * DERIVED, never mirrored: `importCanvas` records the imported graph's
   * structural identity in a TAB-scoped marker
   * (`store/importRegistrationMarker.ts`), and every graph-replacement site
   * re-derives this flag from the graph it installs via
   * `isGraphPendingImportRegistration`. There is no hand-maintained list of
   * "release sites" to keep in sync.
   *
   * ⚠ The first cut of this mitigation DID keep such a list, on the premise
   * that its six sites replace the canvas "with a server-known graph". TWO DID
   * NOT — `hydrateGraphSlice`'s live callers pass the localStorage AUTOSAVE and
   * `loadScenario` reads localStorage — so ~0.5 s after an import (the autosave
   * debounce) a page reload re-installed the imported graph through a RELEASE
   * site and one Rerun restored the witnessed false affirmative. Hence both the
   * derivation and the marker's tab scope: the hazard outlives the page, so the
   * marker must too.
   *
   * The atomic import→reset→registration train (ROADMAP 2.467) supersedes this
   * flag; remove it and the marker module when that lands.
   */
  importPendingServerRegistration: boolean
  /**
   * How many model-changing edits have been COMMITTED locally and emitted, but
   * are still sitting undispatched in the conversation dispatcher's deferral
   * buffer (see `useConversation`'s in-flight lock).
   *
   * It exists to stop the freshness strip telling a lie. Without it, an edit
   * committed while a turn is in flight is deferred, and then the in-flight
   * turn's OWN `analysis_ready` verdict arrives and clears
   * `analysisFreshnessDirty` — so the strip affirms "reflects the current
   * model" over an edit the server has not seen yet. That is the exact
   * alarm→futile-action→false-reassurance sequence ROADMAP 1.346 exists to
   * kill, reappearing on the concurrent path.
   *
   * DERIVED, never incremented/decremented: the dispatcher owns the buffer and
   * writes this from the buffer's own length, so the two cannot drift (a
   * hand-balanced counter is the mirror defect, and an over-decrement here
   * would silently re-enable the false "fresh").
   */
  pendingEmittedEdits: number
  // CEE coaching payload from last /assist/v1/draft-graph response (build a555cf7b+).
  // Session-local — never persisted; cleared on new draft start and scenario reset.
  draftCoaching: CEEDraftCoaching | null
  // Node IDs that existed when ceeAnalysisReady was stored
  // Used to detect stale analysis_ready after graph edits
  ceeAnalysisReadyNodeIds: string[] | null
  // CEE goal constraints from draft-graph response root (for PLoT multi-constraint analysis)
  goalConstraints: CEEGoalConstraint[] | null
  /**
   * B2 (Codex deep review, 2026-07-18): the element identities of the most
   * recent AUTHORITATIVE graph the UI has seen from CEE — a fresh draft, an
   * applied-edit receipt, or a graph loaded from the DB (which is CEE's own
   * view of the scenario).
   *
   * This exists to make DELETION safe. An applied-edit receipt is a complete
   * post-state, so "absent from the receipt" means "deleted" — but CEE builds
   * that post-state from the PERSISTED graph, and the UI's save is debounced
   * 1500ms. A node the user added moments ago is therefore legitimately absent
   * from the receipt without having been deleted. Reconciling absence to
   * deletion unconditionally would trade B2's value-loss for a worse
   * node-loss. So the reconciler only removes an element that CEE has
   * previously ACKNOWLEDGED (present in this set) and that the new receipt
   * omits; anything CEE has never seen is local work and survives untouched.
   *
   * Null means "no authoritative graph seen yet" — the fail-safe state, in
   * which the reconciler removes nothing.
   */
  lastAuthoritativeGraph: { nodeIds: string[]; edgePairs: string[] } | null
  /**
   * ROADMAP 2.312 piece 3 — CEE's `identity.v1` token for the server graph this
   * canvas was last hydrated from, stored VERBATIM.
   *
   * ⚠ OPAQUE AND CEE-ISSUED. Compare CEE-to-CEE only, gated on
   * `projectionVersion`, and NEVER recompute it locally: the normalisation,
   * strip list and projection are CEE's and are versioned precisely so they can
   * move, so no client-side value can be the same thing. It is the staleness
   * anchor by ruling (there is deliberately no `updated_at` on the read route).
   */
  serverGraphIdentity: { value: string; projectionVersion: string } | null
  /**
   * schemas 0.48.0 — the last `graph_hash` CEE stamped on a turn (`aag_v1`,
   * 16 hex), held VERBATIM as the base for a `structural_delete`.
   *
   * ⚠ NOT `serverGraphIdentity` (the 64-hex `identity.v1` token) and NOT the
   * UI's own `generateGraphHash`. CEE's delete writer compares against
   * `computeAnalysisAffectingGraphHash`, whose only wire emitters are this
   * top-level `graph_hash` and `analysis_ready.current_graph_hash`; the identity
   * hash has no wire emitter, so a gate keyed on it could never match. The three
   * are same-shaped strings from three different algorithms — see
   * `canvas/mutations/structuralDelete.ts` for the full derivation.
   *
   * Null means "CEE has not stamped one this session", in which case a delete
   * stands down from the wire rather than asserting a base it does not hold.
   */
  lastServerGraphHash: string | null
  /**
   * Delete gestures captured but not yet sent, oldest first.
   *
   * Written SYNCHRONOUSLY inside the delete actions against the PRE-delete
   * graph, because `base_graph_hash` asserts the graph the user was looking at —
   * a hash read after a debounce describes a graph that may have moved. Drained
   * by `useStructuralDeleteEvents`, which is the ONE sender.
   */
  pendingStructuralDeletes: StructuralDeleteIntent[]
  /**
   * 0.50.0: rename gestures awaiting the wire, captured SYNCHRONOUSLY against
   * the PRE-rename node so `expected_label` and `base_graph_hash` both describe
   * the model the user was actually looking at. Drained by
   * `useStructuralRenameEvents`, which is the ONE sender.
   */
  pendingStructuralRenames: StructuralRenameIntent[]
  /**
   * 0.50.0 — ATTEMPT AND COMPLETION AUTHORITY FOR EVERY RENAME PUT ON THE WIRE.
   *
   * ⚠ THE QUEUE ABOVE IS NOT ENOUGH, and the gap is measured rather than
   * theoretical. The drain removes an intent from `pendingStructuralRenames` and
   * THEN awaits the server, so between those two moments the gesture lived only
   * in a closure owned by whichever component happened to be mounted.
   * `useConversation` gates its optimistic resolution on `!isAbort` and its abort
   * arm handles `factor_value_edit` ONLY, so an interrupted rename resolved
   * NEITHER way: no revert, no confirmation, no sentence, and nothing in state to
   * say an attempt had ever been made. The optimistic label simply stood.
   *
   * Three outcomes stay resolvable here — `committed` / `refused` /
   * `unconfirmed` — and the record survives a remount, a panel close and a route
   * change, because it is store state rather than a closure. Dropped on a
   * decision-context change (`DECISION_CONTEXT_CLEAR`), for the same reason the
   * queue is: a verdict about another decision is not ours to keep.
   */
  structuralRenameLifecycle: StructuralRenameLifecycleRecord[]
  /**
   * 0.50.0: add gestures awaiting the wire, captured against the POST-add graph
   * — the new node only exists after the write — in the SAME `set()` that
   * installs it. Drained by `useStructuralAddEvents`, which is the ONE sender.
   *
   * ─────────────────────────────────────────────────────────────────────────
   * ⭐⭐⭐ SCOPE — THE MEASURED TRUTH, AND IT IS NARROWER THAN "A NODE YOU ADD".
   * Every claim about this lane's coverage should be read against this block
   * rather than restated, because a restatement is how a caveat gets lost.
   *
   * `planStructuralAddIntent` has exactly ONE call site: `addNode`. So the
   * durable guarantee covers the gestures that reach `addNode` — the pane
   * context menu, the six Command Palette "Add …" commands, the pre-analysis
   * `AddRow` and the hero goal field.
   *
   * ⚠ THREE OTHER CREATION PATHS CAPTURE NOTHING, and they are NOT all
   * deliberate:
   *
   *   · `addNodeWithEdge` — FIVE user-reachable affordances: the four "Add
   *     connected …" context-menu items (`contextMenu/actions.ts:182, 285, 319,
   *     352`) and the inspector's Add option (`inspector-v2/panels/
   *     DecisionPanel.tsx:59`). DELIBERATE: `structural_add_edge` is
   *     `'reader_only_refusal'` in CEE — no writer — so emitting `structural_add`
   *     here would durably save the node and silently DROP the edge, trading one
   *     silent loss for a subtler one. It rides with that lane.
   *
   *     ⚠⚠ AND ON THIS PATH A NEW FACTOR **DOES RENDER A DIGIT**. It seeds
   *     `category: 'external'`, and `FactorNode.tsx:668-671` renders
   *     "Uncertainty here affects {N} outcome{s}." whenever
   *     `nodeCategory === 'external' && outcomesAffected > 0` — which an
   *     edge-creating add guarantees. So the explicit-unknown guarantee this
   *     lane pins holds for `addNode` and NOT for `addNodeWithEdge`.
   *     PRE-EXISTING and identical at base; `FactorNode.tsx` is untouched by
   *     this lane, which is why it is recorded here rather than fixed here.
   *
   *   · `duplicateSelected` (:3428) and `pasteClipboard` (:3472) — NOT
   *     deliberate. Simply not done. A duplicated or pasted node is local-only
   *     and vanishes on reload, exactly as an added one did before this lane.
   *
   * Bringing those three under the same guarantee is real, unfinished W2 work.
   * ─────────────────────────────────────────────────────────────────────────
   */
  pendingStructuralAdds: StructuralAddIntent[]
  /**
   * 0.50.0 — ATTEMPT AND COMPLETION AUTHORITY FOR EVERY ADD PUT ON THE WIRE.
   *
   * ⚠ THE QUEUE ABOVE IS NOT ENOUGH, and the gap is the same measured one the
   * rename lane closed: the drain removes an intent from `pendingStructuralAdds`
   * and THEN awaits the server, so between those two moments the gesture lived
   * only in a closure owned by whichever component happened to be mounted.
   * `useConversation` gates its optimistic resolution on `!isAbort` and its abort
   * arm handles `factor_value_edit` ONLY, so an interrupted add resolved NEITHER
   * way: no removal, no confirmation, no sentence, and nothing in state to say an
   * attempt had ever been made. The node simply stood, and vanished on reload.
   *
   * Three outcomes stay resolvable here — `committed` / `refused` /
   * `unconfirmed` — and the record survives a remount, a panel close and a route
   * change, because it is store state rather than a closure.
   */
  structuralAddLifecycle: StructuralAddLifecycleRecord[]
  /**
   * Canvas ids the server has PROVEN removed from the saved model — written
   * ONLY from a `'proven'` `structural_delete` receipt.
   *
   * ⚠ THIS IS NOT A SECOND DIVERGENCE AUTHORITY. It is the existing receipt's
   * verdict, recorded so the ONE consumer that was ignoring it — history
   * restoration — can honour it. Undo restored `history.past[n]` verbatim, so
   * Cmd+Z put back a node the server had durably deleted and the canvas
   * asserted a model state the server declined to hold. Nothing here decides
   * durability; `resolveStructuralDelete` does, and a refused or unconfirmed
   * delete records NOTHING (its elements are legitimately undoable).
   *
   * NEVER PERSISTED — the same discipline as `analysisRefusalNotice`. History
   * itself is session-local, so a record that outlived it would guard snapshots
   * that no longer exist.
   */
  durablyDeletedElements: DurableDeletionRecord
  /** What the guard last did, for the canvas to announce. Null = it did nothing. */
  durableDeletionNotice: DurableDeletionNotice | null
  // CEE Pipeline trace from last draft-graph response (for debug panel)
  ceePipelineTrace: CeePipelineTrace | null
  // CEE V3: Per-node LLM reasoning (node ID → why text) for rationale tooltips
  nodeRationales: Record<string, string>
  // CEE quality dimensions from draft-graph response (for pre-analysis readiness display)
  ceeQuality: CeeQualityDimensions | null
  // Phase 1b: Extended CEE warnings with dimension codes
  ceeExtendedWarnings: CEEDraftWarning[] | null
  // Phase 1b: Goal connectivity status
  ceeGoalConnectivity: CEEGoalConnectivity | null
  // Phase 1b: Model quality factors
  ceeModelQualityFactors: CEEModelQualityFactors | null
  // Phase 1b: Intervention hints keyed by factor node ID
  ceeInterventionHints: Record<string, CEEInterventionHint> | null
  // Pre-analysis sensitivity data from CEE (factor/edge influence on goal)
  preAnalysisSensitivity: PreAnalysisSensitivity | null
  // Engine limits (session-scoped singleton — NOT cleared in resetCanvas)
  engineLimits: LimitsV1 | null
  engineLimitsSource: 'live' | 'fallback' | null
  engineLimitsLoading: boolean
  engineLimitsError: Error | null
  engineLimitsFetchedAt: number | null
  // M4: Graph Health & Repair
  graphHealth: GraphHealth | null
  showIssuesPanel: boolean
  needleMovers: NeedleMover[]
  // Phase 3: Interaction enhancements (Set for O(1) lookup)
  highlightedNodes: Set<string>
  /**
   * Olumi attention — the AI holding the user's gaze on part of the model.
   * Distinct from `highlightedNodes` (a 2s acknowledgement that something
   * changed) because it must PERSIST while the user reads the sentence about
   * it. See `utils/olumiAttention.ts` for why the two are not merged.
   */
  olumiAttention: import('./utils/olumiAttention').OlumiAttention | null
  highlightedEdges: Set<string>
  /**
   * Analysis-graph projection — the "graph-as-explanation-surface" slice.
   * While the user views the V7 evidence disclosure's Flip-risks or Drivers
   * tab, the RESOLVABLE canvas elements named by that view are marked here so
   * edge/node components can render a projection marker. `source` names which
   * evidence view owns the marks; the id Sets hold canvas React-Flow ids
   * (never producer ids). Cleared when the disclosure closes or the view
   * switches away. Pure id projection — no fabricated values, no thresholds.
   */
  analysisHighlight: {
    source: 'flip_risks' | 'drivers' | null
    edgeIds: Set<string>
    nodeIds: Set<string>
  }
  dimmedNodeIds: Set<string>
  /** 6A (selection focus): edges NOT in the selected element's neighbourhood.
   * Peer of dimmedNodeIds — same producer (usePathHighlight), same lifetime,
   * same "attention only, never the model" rule. Kept as a separate top-level
   * field rather than reusing lens._dimmedEdgeIds because the lens owns that
   * one and composes independently (an edge can be lens-dimmed AND
   * selection-dimmed; StyledEdge takes the stronger of the two). */
  dimmedEdgeIds: Set<string>
  /** F3 (graph-visuals): non-null while a TRANSIENT focus dim owns
   * dimmedNodeIds — set by handleFocusNode (dim = non-neighbours of the
   * focused node), cleared on blur/deselect/manual pan/node removal. While
   * active, usePathHighlight must not overwrite dimmedNodeIds. */
  focusDimSourceId: string | null
  /** D2 (graph-visuals): level-of-detail — true when the main canvas zoom is
   * below the LOD threshold; nodes simplify (body hidden, only key labels). */
  lodActive: boolean
  /** N3 (graph-visuals): nodes edited since the last analysis run — computed
   * by useEditedSinceRun (device-local diff vs the latest run snapshot,
   * same mechanism class as the What-changed chip). Drives the amber
   * corner dot on canvas nodes. */
  editedSinceRunNodeIds: Set<string>
  // S.4: Session-only "user-reviewed" tracking — resets on page refresh
  confirmedNodeIds: Set<string>
  // Decision Graph Display v2 Task 11: Option hover state for intervention highlighting
  hoveredOptionId: string | null
  // Graph Lens: ephemeral canvas filtering state (post-analysis only)
  lens: {
    active: 'full' | 'option' | 'sensitivity' | 'fragile' | 'causal' | 'evidence' | 'robustness'
    selectedOptionId: string | null
    // Computed sets — written by useLensFilter, read by BaseNode/StyledEdge
    _dimmedNodeIds: Set<string>
    _dimmedEdgeIds: Set<string>
    _sensitivityWeights: Map<string, number>
    _sensitivityQuartiles: { q25: number; q75: number } | null
    _fragileEdgeIds: Set<string>
    // Expanded lenses (Brief 5)
    _hiddenNodeIds: Set<string>
    _hiddenEdgeIds: Set<string>
    _causalEdgeParams: Map<string, CausalLensEdgeParams>
    _evidenceNodeClass: Map<string, 'grounded' | 'assumed' | 'none' | 'na'>
    _evidenceEdgeClass: Map<string, 'evidence' | 'assumed' | 'unknown'>
  }
  // M5: Grounding & Provenance
  documents: Document[]
  citations: Citation[]
  showProvenanceHub: boolean
  showDocumentsDrawer: boolean
  provenanceRedactionEnabled: boolean
  // S7-FILEOPS: Document management state
  documentSearchQuery: string
  documentSortField: 'name' | 'date' | 'size' | 'type'
  documentSortDirection: 'asc' | 'desc'
  // M6: Compare — showComparePanel stays here (panel flag cluster in canvas store)
  showComparePanel: boolean
  // Comparison state (comparisonMode, selectedSnapshotsForComparison,
  // currentDecisionRationale) lives in src/canvas/stores/comparisonStore.ts
  // as of C3-3. enterComparisonMode/exitComparisonMode orchestrators remain
  // here because they write lens atomically alongside comparisonMode.
  // Week 3: AI Clarifier
  showAIClarifier: boolean
  clarifierSession: {
    prompt: string
    context: string
    answers: Array<{ question_id: string; answer: string }>
    round: number
    status: 'active' | 'complete' | 'error'
  } | null
  clarifierPreviewNodeIds: string[]
  clarifierPreviewEdgeIds: string[]
  // Layout lifecycle (D2 of layout-stabilisation brief).
  //
  //   pendingLayout    — call sites flip this to true after inserting nodes;
  //                      ReactFlowGraph runs layout once measurement completes.
  //   layoutInProgress — prevents re-entry while applyLayout is mid-flight.
  //   layoutVersion    — incremented at the end of every successful applyLayout
  //                      run; ReactFlowGraph fires fitView when this changes.
  //   layoutRequestId  — monotonic; setPendingLayout(true) bumps it. The
  //                      measurement hook captures the id when it starts
  //                      waiting, and applyLayout silently no-ops if the
  //                      stored id has moved on (stale-request guard).
  pendingLayout: boolean
  layoutInProgress: boolean
  layoutVersion: number
  layoutRequestId: number
  /**
   * WHO ASKED FOR THE LAST COMMITTED LAYOUT — `'user'` when a control the person
   * pressed dispatched it (Auto-arrange, the layout toolbar, a `/command`),
   * `'product'` when the canvas laid itself out on its own (the measure-then-
   * layout gate and its two corrective passes).
   *
   * ⚠ IT IS NOT `skipHistory` UNDER A SECOND NAME, and that is deliberate.
   * `skipHistory` answers "has this call site already pushed an undo entry?";
   * this answers "may an automatic re-fit take the camera off the user?". They
   * agree at every call site today, and one flag answering two questions is how
   * this estate's trap 21 defects start — the day a manual trigger needs to skip
   * history, the camera rule would silently invert with no test to notice.
   *
   * Consumed by `useFitViewOnLayoutVersion`'s layout trigger, as ONE HALF of a
   * conjunction: `layoutWasAutomatic && userOwnsCameraFor(currentModelKey())`.
   * The other half is the model-keyed camera claim, and the two are a genuine
   * pair — the KEY stops an automatic corrective pass stealing a frame the user
   * asked for, and THIS FIELD stops that same guard suppressing a frame the user
   * asked for by pressing Auto-arrange (same model, same key, claim live). Two
   * harms in opposite directions cannot share one predicate (CLAUDE.md trap 22b);
   * shipping either half alone re-opens the other, which is exactly what
   * happened across #1096 and #1097.
   *
   * Defaults to `'user'` so a call site that says nothing keeps the pre-existing
   * always-re-fit behaviour: the fail-safe direction is the old one.
   */
  lastLayoutInitiatedBy: 'user' | 'product'
  setPendingLayout: (value: boolean) => void
  // Track 3: Hydrated thread entries from scenario row (consumed once by useConversation, then cleared)
  _hydratedThread: unknown[] | null
  // Track 3: Hydrated scenario events from scenario row (consumed by Journey tab)
  _hydratedEvents: unknown[] | null
  // Phase 2A: Analysis metadata for Model Card Lite and trust surfaces
  lastAnalysisSeed: number | null
  lastQualityMode: string | null
  repairsApplied: V2RunResponse['repairs_applied'] | null
  /** Raw V2RunResponse from PLoT — preserved for debug, analysis_state construction, and typed field access */
  rawV2Response: V2RunResponse | null
  // fullDraftAppliedAt lives in useDraftStore as of C3-5.
  // Debug: Raw CEE output mode (bypasses post-processing repairs)
  // Set via URL param ?rawCee=1 or Debug Panel checkbox
  debugRawCeeOutput: boolean
  setDebugRawCeeOutput: (value: boolean) => void
  // Canvas view mode: 'standard' (actionable guidance) vs 'expert' (+ numeric overlays)
  viewMode: 'standard' | 'expert'
  setViewMode: (mode: 'standard' | 'expert') => void
  updateScenarioFraming: (partial: ScenarioFraming) => void
  /**
   * Create a node.
   *
   * ⭐⭐ `label` IS OPTIONAL AND ITS ADDITION FIXES A REAL DEFECT, not an
   * ergonomic wrinkle. Two callers — `YourDecisionSection.addNamedNode` and
   * `HeroSection.commitGoal` — previously did `addNode()` → scan the node list
   * → `updateNodeLabel()`. That is wrong twice over now that BOTH actions carry
   * durable writers: it puts TWO turns on the wire for ONE gesture, and the
   * second is doomed, because the rename's `expected_label` was read from the
   * node the add is still trying to create. Worse, the scan found the last node
   * OF A KIND (`nodes.filter(n => kindOf(n) === kind).at(-1)`) — a VALUE
   * PREDICATE another node satisfies the moment anything else adds one
   * (CLAUDE.md trap 19). Naming the node at creation removes both.
   *
   * ⚠ NO VALUE IS SEEDED, HERE OR ANYWHERE ON THIS PATH. A new node's data is
   * `{ label }` and nothing else. See `mutations/structuralAdd.ts`'s header for
   * why that is the load-bearing property of this whole lane and not a detail.
   */
  addNode: (
    pos?: { x: number; y: number },
    type?: NodeType,
    label?: string,
  ) => LimitExceeded | null
  /** Create a new node with an edge connecting it to an existing node. Returns the new node ID. */
  addNodeWithEdge: (
    pos: { x: number; y: number },
    type: NodeType,
    connectTo: string,
    edgeDirection: 'to-target' | 'from-target',
  ) => string | LimitExceeded
  updateNodeLabel: (id: string, label: string) => void
  updateNode: (id: string, updates: Partial<Node>) => void
  /**
   * Apply multiple node data updates as a single history entry. Diff-aware:
   * no-op (zero history entries) when no node actually changes. Preserves
   * identity for untouched nodes. Use for backfills / coordinated updates
   * that should undo/redo together.
   *
   * ⚠ `sourceTag` IS AN INTERNAL TAG AND MUST NEVER BE USED AS USER COPY. It
   * was named `label` and passed straight through to the history entry's label,
   * which `useHistoryToast` shows to the user verbatim — so the only caller's
   * tag, the literal string `'backfill-interventions'`, was being displayed as
   * a toast. This producer is, per the note at the implementation, exclusively
   * the CEE intervention backfill and NOT a user model edit, so it now pushes
   * an UNLABELLED entry: the state stays in history and undoes together, and
   * nothing is announced as though the user had done it.
   */
  batchUpdateNodes: (
    updates: Array<{ id: string; data: Partial<Node['data']> }>,
    sourceTag?: string,
  ) => { updatedCount: number }
  updateEdge: (id: string, updates: Partial<Edge<EdgeData>>) => void
  updateEdgeData: (id: string, data: Partial<EdgeData>) => void
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onSelectionChange: (params: { nodes: Node[]; edges: Edge<EdgeData>[] }) => void
  selectNodeWithoutHistory: (nodeId: string) => void
  selectEdgeWithoutHistory: (edgeId: string) => void
  selectNodes: (nodeIds: string[]) => void
  clearSelection: () => void
  addEdge: (edge: Omit<Edge<EdgeData>, 'id'>) => AddEdgeResult
  pushHistory: (debounced?: boolean) => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  deleteSelected: () => void
  deleteNodeById: (nodeId: string) => void
  deleteEdgeById: (edgeId: string) => void
  duplicateSelected: () => void
  copySelected: () => void
  pasteClipboard: () => void
  cutSelected: () => void
  selectAll: () => void
  nudgeSelected: (dx: number, dy: number) => void
  saveSnapshot: () => boolean
  importCanvas: (json: string) => boolean
  exportCanvas: () => string
  /**
   * ⚠ RESOLVES WITHOUT LAYING OUT ON THREE PATHS — the return says which.
   * `{laidOut:false}` means this call did nothing (superseded, or re-entered);
   * `{laidOut:true}` means it committed. `handleLayoutWithRecovery` needs the
   * distinction or it clears the failure banner over an unchanged graph.
   */
  applyLayout: (opts?: {
    skipHistory?: boolean
    requestId?: number
    /** See `lastLayoutInitiatedBy`. Omitted means `'user'` — the pre-existing behaviour. */
    initiatedBy?: 'user' | 'product'
  }) => Promise<LayoutAttemptResult>
  applySimpleLayout: (preset: 'grid' | 'hierarchy' | 'flow', spacing: 'small' | 'medium' | 'large') => void
  applyGuidedLayout: (policy?: Partial<import('./layout/policy').LayoutPolicy>) => void
  resetCanvas: () => void
  createNodeId: () => string
  createEdgeId: () => string
  reseedIds: (nodes: Node[], edges: Edge[]) => void
  deleteEdge: (id: string) => void
  updateEdgeEndpoints: (id: string, updates: { source?: string; target?: string }) => void
  beginReconnect: (edgeId: string, end: ReconnectEnd) => void
  completeReconnect: (nodeId: string) => void
  cancelReconnect: () => void
  reset: () => void
  cleanup: () => void
  // Outcome node
  setOutcomeNode: (nodeId: string | null, opts?: { rederiveThreshold?: boolean }) => void
  /** P0-1 (external review round 2): atomic goal-RESELECTION — invalidate the
   *  previous goal's producer target fields on readiness, select the new goal,
   *  and re-derive the scalar from it. The single transition the pre-analysis
   *  goal selector uses. */
  reselectGoalNode: (goalId: string) => void
  // Goal threshold for probability_of_goal
  setGoalThreshold: (
    threshold: number | null,
    opts?: { fromCeeSync?: boolean; representation?: 'raw' | 'normalised' },
  ) => void
  /**
   * Unified threshold + node data update. Prefer over calling setGoalThreshold + updateNode separately.
   * `opts.unit` records the unit the user's own input carried (currency symbol or '%',
   * UI-SEM-086) onto the goal node's goal_threshold_unit so every display surface
   * (GoalNode, Model tab, hero success field) can render the raw value honestly.
   */
  setGoalThresholdAndUpdateNode: (goalNodeId: string, value: number | null, opts?: { unit?: string }) => void
  // Results actions
  resultsStart: (params: { seed: number; wasForced?: boolean }) => void
  resultsConnecting: (runId: string) => void
  resultsProgress: (percent: number) => void
  resultsComplete: (params: {
    report: ReportV1
    hash: string
    drivers?: Array<{ kind: 'node' | 'edge'; id: string }>
    // Legacy CEE types (deprecated)
    ceeReview?: CeeDecisionReviewPayload | null
    ceeTrace?: CeeTraceMeta | null
    ceeError?: CeeErrorViewModel | null
    // M1 CEE Orchestrator types (new contract)
    ceeReviewV1?: CeeDecisionReviewPayloadV1 | null
    ceeTraceV1?: CeeTrace | null
    ceeErrorV1?: CeeError | null
    enrichment?: PLoTEnrichment | null // Phase 1B: ISL data bundled from PLoT
    /** A.9: Provenance — 'direct' (Play button) or 'conversation' (envelope path). Defaults to 'direct'. */
    resultsSource?: 'direct' | 'conversation'
    /** Raw V2RunResponse from PLoT — preserved for typed field access and debug */
    rawV2Response?: V2RunResponse | null
    /**
     * ROADMAP 2.350 — the V5 `analysis_result` block's OWN enrichment record.
     *
     * Read by ONE thing: the Compare-tab snapshot capture at the bottom of
     * this action. It is NOT written to any results slice, and it is
     * deliberately not folded into `enrichment` above (which is V2-shaped and
     * which the V5 path clears on purpose).
     */
    v5Enrichment?: unknown
  }) => void
  resultsError: (params: { code: string; message: string; retryAfter?: number; request_id?: string; canRetry?: boolean; affectedOptions?: Array<{ id: string; label: string }> }) => void
  /** Capture detailed error information for Debug Panel */
  captureErrorDetail: (detail: ErrorDetail) => void
  /** Clear all captured error details */
  clearErrorDetails: () => void
  resultsCancelled: () => void
  resultsReset: () => void
  /** Wave F-A (brief §6.4/§12.4): identity-anchored option ordinals —
   * assigned once per option id (first appearance), stable across reruns,
   * never reused. SESSION-scoped continuity: not persisted, and cleared at
   * every scenario boundary (loadScenario, hydrateGraphSlice, resetCanvas,
   * importCanvas). Read outside React via getAnalysisDisplaySnapshot(). */
  optionNumbering: Record<string, number>
  registerOptionNumbering: (optionIds: readonly string[]) => void
  /** 1.16i: authoritative analysing state for the live V5 run turn — sets
   * 'preparing' at dispatch while preserving the prior report/hash/seed/
   * drivers (unlike resultsStart, no seed is known yet). */
  resultsAnalysing: () => void
  /** 1.16i: every-exit cleanup for the V5 run turn — from 'preparing',
   * returns to 'complete' when a preserved report exists (restoring
   * analysisStateReady) or 'idle' when none does; no-op otherwise. A landed
   * analysis_result has already flipped 'complete' via resultsComplete. */
  resultsSettle: () => void
  /**
   * Put a previously-computed answer back on screen. Accepts `RestorableRun`
   * (widened from `StoredRun`) so the canonical autosave snapshot — which has
   * no seed on the live V5 path — can restore through the SAME action, with the
   * same honest `analysisFreshness: 'unknown'` semantics, rather than a second
   * restore path that could drift from this one.
   *
   * `restoredForScenarioId` — see `ResultsState.restoredForScenarioId`. Supplied
   * ONLY by `restoreAnalysisFromAutosave`, from the id the autosave record was
   * written under. Omitted by every other caller, and an omitted stamp is
   * fail-closed: `useScenario.loadScenario` still clears.
   */
  resultsLoadHistorical: (
    run: RestorableRun,
    restoredForScenarioId?: string | null,
  ) => void
  /** Hydrate results from Supabase row.analysis (V2RunResponse already mapped to store shape) */
  resultsHydrateFromSupabase: (hydrated: {
    results: Partial<ResultsState>
    runMeta: Partial<RunMetaState>
  }) => void
  setRunMeta: (meta: RunMetaState) => void
  // Scenario actions
  loadScenario: (id: string) => boolean
  saveCurrentScenario: (name?: string) => string | null
  createScenarioFromTemplate: (params: { templateId: string; templateVersion?: string; name: string }) => string
  duplicateCurrentScenario: (newName?: string) => string | null
  renameCurrentScenario: (name: string) => void
  deleteScenario: (id: string) => void
  markDirty: () => void
  markClean: () => void
  // Panel actions
  setShowResultsPanel: (show: boolean) => void
  setShowInspectorPanel: (show: boolean) => void
  openTemplatesPanel: (invoker?: HTMLElement) => void
  closeTemplatesPanel: () => void
  setShowDraftChat: (show: boolean) => void
  // Draft actions (setSelectedGenerationModel, setSelectedRepairModel,
  // setSelectedEnrichmentModel, resetModelToDefault, setIsGenerating,
  // setLastDraftDescription, setLastDraftError, setFullDraftAppliedAt)
  // live in useDraftStore as of C3-5.
  // A.15: Stage setter
  setCurrentStage: (stage: ScenarioStage | null) => void
  // A.5+: Draft snapshot + undo (draftChatPreDraftSnapshot stays here because
  // undoDraft writes it atomically alongside nodes/edges/readiness/lens).
  setDraftChatPreDraftSnapshot: (snapshot: { nodes: Node[]; edges: Edge<EdgeData>[] } | null) => void
  undoDraft: () => void
  setCeeAnalysisReady: (analysisReady: CEEAnalysisReady | null) => void
  /**
   * Write the V5 analysis-fact slice. Pass null to clear (e.g. on scenario
   * switch). Do NOT clear on every conversational turn — per
   * v5-canonical-analysis brief correction 4, only clear on explicit
   * no-analysis / orphan / reset states.
   */
  setV5AnalysisFact: (fact: V5AnalysisFactState | null) => void
  /** Update the freshness slice from a raw response.analysis_ready (retain / order-by-computed_at / never absence→fresh). */
  setAnalysisFreshness: (rawAnalysisReady: unknown) => void
  /** ROADMAP 2.1163 / EXT-2: set or clear CEE's typed analysis-refusal notice. Pass null to clear. Never persisted. */
  setAnalysisRefusalNotice: (notice: AnalysisRefusalNotice | null) => void
  /**
   * Step 5: set or clear the composed `AnalysisStateV1` verdict for this turn.
   * Pass null to clear. Never persisted.
   *
   * ⚠ Callers pass a value ONLY when the turn genuinely carried a parseable
   * `analysis_state`. Passing null on a turn that carried none is CORRECT and
   * is what keeps a previous turn's verdict from governing this one — silence
   * is not a verdict, and this field's whole contract is that non-null means
   * CEE spoke.
   */
  setAnalysisStateV1: (state: AnalysisStateV1 | null) => void
  /** Public dirty-overlay setter for external graph mutators (e.g. accepted CEE graph patches) that bypass the internal edit chokepoints. */
  markAnalysisFreshnessDirty: () => void
  /** Atomically set all three staleness flags — the entry point for external structural mutators. */
  markGraphStructurallyEdited: () => void
  /** F10: run completed (new analysis_result hash) with no freshness verdict on the response. */
  noteRunCompletedWithoutVerdict: () => void
  /** Clear the dirty overlay when a genuinely new analysis run completes (reliable run identity, e.g. a new analysis_result response_hash). No-op while an emitted edit is still undispatched. */
  clearAnalysisFreshnessDirty: () => void
  /** Publish how many emitted edits are still queued behind the dispatcher's in-flight lock. Derived from that buffer's length by its owner. */
  setPendingEmittedEdits: (count: number) => void
  setDraftCoaching: (coaching: CEEDraftCoaching | null) => void
  /**
   * Set the goal constraints. A USER edit (GoalPanel add/remove/change) is
   * analysis-affecting — the constraints are sent to PLoT (same class as the
   * goal threshold) — so a genuine content change dirties the freshness overlay
   * that every trust surface reads. Producer/reset paths (draft ingestion, V5
   * state apply, run reset) pass `{ fromProducerSync: true }` so an ingestion
   * write does NOT self-dirty (mirrors setGoalThreshold's `fromCeeSync`).
   */
  setGoalConstraints: (
    constraints: CEEGoalConstraint[] | null,
    opts?: { fromProducerSync?: boolean },
  ) => void
  /** B2: record the identities of an authoritative CEE graph (see the field). */
  setLastAuthoritativeGraph: (
    graph: { nodeIds: string[]; edgePairs: string[] } | null,
  ) => void
  /** 2.312: store CEE's opaque identity token verbatim (see the field). */
  setServerGraphIdentity: (
    identity: { value: string; projectionVersion: string } | null,
  ) => void
  /** 0.48.0: record CEE's `aag_v1` `graph_hash` for the next delete's stale gate. */
  setLastServerGraphHash: (hash: string | null) => void
  /**
   * 0.48.0: hand the drainer every queued delete gesture and empty the queue in
   * ONE atomic read — a peek-then-clear would re-send a gesture if a second
   * drain interleaved.
   */
  takePendingStructuralDeletes: () => StructuralDeleteIntent[]
  /** 0.50.0: the rename twin of the above — one atomic read-and-clear. */
  takePendingStructuralRenames: () => StructuralRenameIntent[]
  /** 0.50.0: the add twin — one atomic read-and-clear. */
  takePendingStructuralAdds: () => StructuralAddIntent[]
  /**
   * 0.50.0: move the HEAD of the add queue into the lifecycle as `in_flight`, in
   * ONE `set()`, and return it. Null when the queue is empty.
   *
   * ⭐ THE ATOMICITY IS THE POINT — the same review P1 the rename lane fixed.
   * Taking the whole batch and then awaiting each send left every gesture after
   * the first in neither the queue nor any record; an abort or a remount in that
   * window destroyed the only evidence the attempt existed.
   */
  beginStructuralAddSend: () => StructuralAddLifecycleRecord | null
  /**
   * 0.50.0: write the terminal verdict for one add attempt.
   *
   * IDEMPOTENT BY DESIGN — a record that already holds a terminal status is LEFT
   * ALONE. Two authorities can reach one attempt (the resolver inside `sendTurn`,
   * and the drain's every-exit settle), and a late arm rewriting a `committed`
   * verdict as `unconfirmed` would tell the user their saved node might not be
   * saved: a lie in the other direction.
   */
  settleStructuralAdd: (
    intentId: string,
    status: StructuralAddTerminalStatus,
  ) => void
  /**
   * 0.50.0: take back a node the server did not save.
   *
   * ⚠ DELIBERATELY NOT `deleteNodeById`. That action records a
   * `structural_delete` intent, which would tell the server to remove a node it
   * never held — a second, false write chasing a refused first one. This removes
   * the node and nothing else.
   *
   * ⚠ AND IT RAISES `_externalMutationActive` IN THE SAME `set()` AS THE WRITE,
   * exactly as `applyStructuralDeleteRevert` does and for the same measured
   * reason (mutant MUT-ORDER): a counter raised in a LATER `set()` arrives after
   * the differ's subscriber has already seen the change, so `useGraphEditEvents`
   * would emit a `direct_graph_edit` announcing a removal the user never made.
   *
   * Takes NO history entry: it is a correction of a write the user already saw,
   * and "Added factor" sitting in the undo stack for a node that is gone would
   * offer to restore something the model has refused.
   */
  applyStructuralAddRevert: (removal: { nodeId: string }) => void
  /**
   * 0.50.0: move the HEAD of the rename queue into the lifecycle as
   * `in_flight`, in ONE `set()`, and return it. Null when the queue is empty.
   *
   * ⭐ THE ATOMICITY IS THE POINT. Taking the whole batch and then awaiting each
   * send left every gesture after the first in neither the queue nor any record;
   * an abort or a remount in that window destroyed the only evidence the attempt
   * existed. One at a time means the gesture is always in exactly one place.
   */
  beginStructuralRenameSend: () => StructuralRenameLifecycleRecord | null
  /**
   * 0.50.0: write the terminal verdict for one attempt.
   *
   * IDEMPOTENT BY DESIGN — a record that already holds a terminal status is LEFT
   * ALONE. Two authorities can reach one attempt (the resolver inside `sendTurn`,
   * and the drain's every-exit settle), and a late arm rewriting a `committed`
   * verdict as `unconfirmed` would tell the user their saved name might not be
   * saved: a lie in the other direction.
   */
  settleStructuralRename: (
    intentId: string,
    status: StructuralRenameTerminalStatus,
  ) => void
  /**
   * 0.50.0: put back a label the server refused to take.
   *
   * ⚠ RESTORES **TWO** FIELDS. `updateNodeLabel` also stamps
   * `provenance: 'user_set'` on a GOAL (via `provenanceAfterHumanAuthoredLabel`),
   * which is what clears the "From your brief" pill. Restoring only the label
   * would leave a REFUSED rename having permanently cleared that pill — the
   * model still holds the brief's extract while the canvas claims the user
   * authored it. `provenanceWasPresent` distinguishes "the key was absent" from
   * "the key held undefined", which are different bytes.
   */
  applyStructuralRenameRevert: (restore: {
    nodeId: string
    label: string
    provenance?: unknown
    provenanceWasPresent: boolean
  }) => void
  /**
   * 0.48.0: put back elements the server refused to remove.
   *
   * A restore, never a generic add: it re-inserts the captured elements
   * VERBATIM (layout, size, data), which is the only way to undo a delete
   * faithfully — CEE has never seen the layout and can never return it. It is a
   * correction of a write the user already saw, so it deliberately takes no
   * history entry: `pushToHistory` here would put "Deleted 2 elements" back on
   * the redo stack as if the deletion had stood.
   */
  applyStructuralDeleteRevert: (restore: {
    nodes: readonly Node[]
    edges: readonly Edge<EdgeData>[]
  }) => void
  /**
   * 0.48.0: record that the server PROVED these elements gone from the saved
   * model, so history restoration stops bringing them back.
   *
   * ⚠ CALL THIS ONLY FROM A `'proven'` RECEIPT. It is the twin of
   * `applyStructuralDeleteRevert` — that one handles "the server did NOT remove
   * these", this one "the server DID". A refused or unconfirmed delete must
   * reach neither: its elements are legitimately undoable, and recording them
   * here would make the product refuse to restore something it still holds.
   */
  recordDurableDeletion: (removed: {
    readonly nodeIds: readonly string[]
    readonly edgeIds: readonly string[]
  }) => void
  /** Dismiss the durable-deletion notice once the canvas has shown it. */
  clearDurableDeletionNotice: () => void
  setCeePipelineTrace: (trace: CeePipelineTrace | null) => void
  setCeeQuality: (quality: CeeQualityDimensions | null) => void
  // Phase 1b actions
  setCeeExtendedWarnings: (warnings: CEEDraftWarning[] | null) => void
  setCeeGoalConnectivity: (connectivity: CEEGoalConnectivity | null) => void
  setCeeModelQualityFactors: (factors: CEEModelQualityFactors | null) => void
  setCeeInterventionHints: (hints: Record<string, CEEInterventionHint> | null) => void
  setPreAnalysisSensitivity: (sensitivity: PreAnalysisSensitivity | null) => void
  setEngineLimits: (limits: LimitsV1 | null, source: 'live' | 'fallback' | null, fetchedAt: number | null, error?: Error | null) => void
  setEngineLimitsLoading: (loading: boolean) => void
  // M4: Graph Health actions
  validateGraph: () => void
  setShowIssuesPanel: (show: boolean) => void
  applyRepair: (issueId: string) => void
  applyAllRepairs: () => void
  applyAutoFixChanges: (changes: { nodes?: Node[]; edges?: Edge<EdgeData>[] }) => void
  setNeedleMovers: (movers: NeedleMover[]) => void
  // Phase 3: Interaction actions
  setHighlightedNodes: (ids: string[]) => void
  /** Hold attention on part of the model. Replaces any previous attention. */
  setOlumiAttention: (a: import('./utils/olumiAttention').OlumiAttention) => void
  /** Release it. No state write when nothing is held (no Set-identity churn). */
  clearOlumiAttention: () => void
  setHighlightedEdges: (ids: string[]) => void
  /** Analysis-graph projection: mark the resolved canvas ids owned by an
   * evidence view. Replaces any previous projection wholesale. */
  setAnalysisHighlight: (
    source: 'flip_risks' | 'drivers',
    ids: { edgeIds?: string[]; nodeIds?: string[] },
  ) => void
  /** Analysis-graph projection: clear all projection marks. No-op (no state
   * write, no Set-identity churn) when nothing is currently projected. */
  clearAnalysisHighlight: () => void
  setDimmedNodes: (ids: string[]) => void
  /** 6A: replace the selection-dimmed edge set. Same idiom as setDimmedNodes. */
  setDimmedEdges: (ids: string[]) => void
  /** F3: start a transient focus dim — dims `dimmedIds` and marks the dim as
   * owned by the focus on `sourceId` until clearFocusDim(). */
  setFocusDim: (sourceId: string, dimmedIds: string[]) => void
  /** F3: end the focus dim (blur/deselect/manual pan/node removal). No-op
   * when no focus dim is active, so it never clobbers the selection
   * path-dim written via setDimmedNodes. */
  clearFocusDim: () => void
  /** N3: replace the edited-since-run set (called by the useEditedSinceRun effect). */
  setEditedSinceRunNodes: (ids: string[]) => void
  /** D2: set by the LodSync zoom watcher (skip-if-same). */
  setLodActive: (active: boolean) => void
  // S.4: Toggle "user-reviewed" confirmation on a node (session-only)
  toggleConfirmedNode: (nodeId: string) => void
  // Decision Graph Display v2 Task 11: Option hover for intervention highlighting
  setHoveredOption: (optionId: string | null) => void
  // Graph Lens actions
  setLens: (mode: LensMode, optionId?: string | null) => void
  cycleLensOption: (direction: 'next' | 'prev') => void
  resetLens: () => void
  /** Update computed lens visuals (called by useLensFilter effect) */
  setLensVisuals: (visuals: {
    dimmedNodeIds: Set<string>
    dimmedEdgeIds: Set<string>
    sensitivityWeights: Map<string, number>
    sensitivityQuartiles: { q25: number; q75: number } | null
    fragileEdgeIds: Set<string>
    hiddenNodeIds?: Set<string>
    hiddenEdgeIds?: Set<string>
    causalEdgeParams?: Map<string, CausalLensEdgeParams>
    evidenceNodeClass?: Map<string, 'grounded' | 'assumed' | 'none' | 'na'>
    evidenceEdgeClass?: Map<string, 'evidence' | 'assumed' | 'unknown'>
  }) => void
  // M5: Provenance actions
  addDocument: (document: Omit<Document, 'id' | 'uploadedAt'>) => string
  removeDocument: (id: string) => void
  renameDocument: (id: string, newName: string) => void  // S7-FILEOPS
  setDocumentSearchQuery: (query: string) => void  // S7-FILEOPS
  setDocumentSort: (field: 'name' | 'date' | 'size' | 'type', direction: 'asc' | 'desc') => void  // S7-FILEOPS
  addCitation: (citation: Omit<Citation, 'id' | 'createdAt'>) => void
  setShowProvenanceHub: (show: boolean) => void
  setShowDocumentsDrawer: (show: boolean) => void
  toggleProvenanceRedaction: () => void
  // M6: Compare panel flag + local export
  setShowComparePanel: (show: boolean) => void
  exportLocal: () => string
  // M6: Scenario Comparison Mode orchestrators — write lens atomically, stay here.
  // Simple comparison setters (setSelectedSnapshotsForComparison, setDecisionRationale,
  // setComparisonSelectedIndices) live in src/canvas/stores/comparisonStore.ts.
  enterComparisonMode: (
    scenariosOrScenarioA:
      | Array<{ nodes: Node[]; edges: Edge<EdgeData>[]; label: string; optionId?: string }>
      | { nodes: Node[]; edges: Edge<EdgeData>[]; label: string; optionId?: string },
    scenarioB?: { nodes: Node[]; edges: Edge<EdgeData>[]; label: string; optionId?: string } | null,
    comparison?: ComparisonResult | null,
    apiResponse?: { base_scenario?: { id: string; name: string; outcome_predictions: Record<string, number> }; alternative_scenarios?: Array<{ id: string; name: string; outcome_predictions: Record<string, number> }>; option_comparison?: Array<{ option_id: string; option_label: string; outcome?: { mean: number; p10: number; p50: number; p90: number }; expected_outcome?: number; win_probability?: number }>; analysis_status?: string } | null,
    meta?: { hasMoreOptions?: boolean; allOptionsCount?: number }
  ) => void
  exitComparisonMode: () => void
  // P2: Hydration hygiene
  hydrateGraphSlice: (loaded: {
    nodes?: Node[]
    edges?: Edge<EdgeData>[]
    currentScenarioId?: string | null
    /**
     * B3: the loaded scenario's persisted hard constraints. MUST be passed on
     * every full-context load — `undefined` and `null` both resolve to null so
     * an absent value CLEARS rather than inheriting the previous scenario's.
     */
    goalConstraints?: CEEGoalConstraint[] | null
  }) => void
  // A.7: External mutation suppression — prevents direct_graph_edit events firing
  // during patch-apply, envelope-applied changes, scenario hydration, etc.
  /** Reference count: >0 while a non-user graph mutation is in progress */
  _externalMutationActive: number
  /** When true, mutation methods skip pushToHistory calls (for batched operations) */
  _suppressHistory: boolean
  beginExternalGraphMutation: (source: 'envelope_apply' | 'patch_apply' | 'hydrate', opts?: { suppressHistory?: boolean }) => void
  endExternalGraphMutation: () => void
  // Week 3: AI Clarifier actions
  setShowAIClarifier: (show: boolean) => void
  startClarifierSession: (prompt: string, context: string) => void
  updateClarifierAnswers: (answers: Array<{ question_id: string; answer: string }>) => void
  completeClarifierSession: () => void
  applyClarifierGraph: (graph: { nodes: any[]; edges: any[] }, options: { preview: boolean }) => void
  clearClarifierPreview: () => void
}

let historyTimer: ReturnType<typeof setTimeout> | null = null
let nudgeTimer: ReturnType<typeof setTimeout> | null = null
const MAX_HISTORY = 50
export const HISTORY_DEBOUNCE_MS = 200

function clearTimers() {
  if (historyTimer) {
    clearTimeout(historyTimer)
    historyTimer = null
  }
  if (nudgeTimer) {
    clearTimeout(nudgeTimer)
    nudgeTimer = null
  }
}

// Derive a coarse GraphHealth view from engine-level graph_quality when
// structural validation has not yet run. This keeps health chips in sync
// with the latest analysis without overwriting validator results.
// Brief 37 Optimization: Accept existing health to return stable reference when unchanged
function graphHealthFromQuality(
  quality: ReportV1['graph_quality'] | undefined,
  existingHealth?: GraphHealth | null
): GraphHealth | null {
  if (!quality) return null

  const clampedScore = Math.max(0, Math.min(1, quality.score))
  const score = Math.round(clampedScore * 100)

  let status: GraphHealth['status']
  if (score >= 70) {
    status = 'healthy'
  } else if (score >= 40) {
    status = 'warnings'
  } else {
    status = 'errors'
  }

  // Brief 37 Optimization: Return existing object if score/status unchanged
  // This prevents unnecessary re-renders from new object references
  if (existingHealth &&
      existingHealth.score === score &&
      existingHealth.status === status &&
      existingHealth.issues.length === 0) {
    return existingHealth
  }

  return {
    status,
    score,
    issues: EMPTY_VALIDATION_ISSUES,
  }
}

function historyHash(nodes: Node[], edges: Edge[]): string {
  // P0-1 (external review 2026-07-14): the goal node's user target
  // (success_threshold + threshold_source) is decision-context data and MUST be
  // in the hash — otherwise a target-only edit (60 → 80) collides with the prior
  // hash, pushToHistory dedups it away, and Undo jumps past both edits instead of
  // stepping 80 → 60. Including it makes each target edit a distinct history entry
  // that undo/redo's deriveGoalThresholdFromNode then reconstructs correctly.
  // P0 2026-08-13: `position` is optional-chained for the same reason
  // `useAutosave.computeGraphHash` optional-chains it — a persisted graph that
  // reaches the store without geometry (CEE/GraphV3 carries none) would
  // otherwise make this `undefined.x` and throw on the FIRST edit after a load.
  // Defaulting to 0 matches the sibling projector exactly.
  const n = nodes.map(n => `${n.id}@${n.position?.x ?? 0},${n.position?.y ?? 0}:${n.type ?? ''}:${n.data?.label ?? ''}:${(n.data as { success_threshold?: unknown })?.success_threshold ?? ''}:${(n.data as { threshold_source?: unknown })?.threshold_source ?? ''}`).join('|')
  const e = edges.map(e => `${e.id}:${e.source}>${e.target}:${e.label ?? ''}:${(e.data as any)?.schemaVersion ?? ''}`).join('|')
  return `${n}#${e}`
}

function pushToHistory(get: () => CanvasState, set: (fn: (s: CanvasState) => Partial<CanvasState>) => void, label?: string) {
  // Skip history during batched external mutations (e.g. auto-apply patches)
  if (get()._suppressHistory) return

  const { nodes, edges, history, _internal } = get()

  // Guard: only push if state actually changed (unless history is empty - always push first snapshot)
  const h = historyHash(nodes, edges)
  if (history.past.length > 0 && h === _internal.lastHistoryHash) {
    // Even if no change, clear future (user took new action after undo)
    if (history.future.length > 0) {
      set(() => ({ history: { ...history, future: [] } }))
    }
    return
  }

  // Strip selection flags from history snapshots - selection is ephemeral UI state
  const cleanNodes = nodes.map(n => ({ ...n, selected: undefined }))
  const cleanEdges = edges.map(e => ({ ...e, selected: undefined }))

  const past = [...history.past, { nodes: cleanNodes, edges: cleanEdges, label }].slice(-MAX_HISTORY)
  set(() => ({
    history: { past, future: [] },
    _internal: { lastHistoryHash: h },
    graphEditedSinceLastRun: true,
    // Graph edit invalidates the cached analysis snapshot — any pending
    // CEE turn that reads the store before a new run finishes must NOT
    // include stale analysis_state.
    analysisStateReady: false,
    // Graph Lens: auto-reset on graph edit
    lens: createDefaultLensState(),
  }))
}

function scheduleHistoryPush(get: () => CanvasState, set: (fn: (s: CanvasState) => Partial<CanvasState>) => void) {
  if (historyTimer) clearTimeout(historyTimer)
  historyTimer = setTimeout(() => pushToHistory(get, set), HISTORY_DEBOUNCE_MS)
}

/**
 * Compute the inspector popover anchor for the current selection.
 * Single source of truth shared by onNodesChange, onEdgesChange, and onSelectionChange
 * so all code paths produce identical positions.
 */
function computeAnchorPosition(
  allNodes: Node[],
  selectedNodes: Node[],
  selectedEdges: Edge<EdgeData>[],
): { x: number; y: number } | null {
  if (selectedNodes.length === 1 && selectedEdges.length === 0) {
    const node = selectedNodes[0]
    const nodeWidth = node.measured?.width ?? node.width ?? 180
    const nodeHeight = node.measured?.height ?? node.height ?? 60
    return {
      x: node.position.x + nodeWidth,
      y: node.position.y + nodeHeight / 2,
    }
  }
  if (selectedEdges.length === 1 && selectedNodes.length === 0) {
    const edge = selectedEdges[0]
    const sourceNode = allNodes.find(n => n.id === edge.source)
    const targetNode = allNodes.find(n => n.id === edge.target)
    if (sourceNode && targetNode) {
      const sourceWidth = sourceNode.measured?.width ?? sourceNode.width ?? 180
      const sourceHeight = sourceNode.measured?.height ?? sourceNode.height ?? 60
      const targetWidth = targetNode.measured?.width ?? targetNode.width ?? 180
      const targetHeight = targetNode.measured?.height ?? targetNode.height ?? 60
      return {
        x: (sourceNode.position.x + sourceWidth / 2 + targetNode.position.x + targetWidth / 2) / 2,
        y: (sourceNode.position.y + sourceHeight / 2 + targetNode.position.y + targetHeight / 2) / 2,
      }
    }
  }
  return null
}

/**
 * Get all node IDs that are critical to ceeAnalysisReady.
 * Returns goal_node_id + all option intervention target IDs.
 */
function getCriticalNodeIds(analysisReady: CEEAnalysisReady | null): Set<string> {
  const ids = new Set<string>()
  if (!analysisReady) return ids

  // Goal node is critical
  if (analysisReady.goal_node_id) {
    ids.add(analysisReady.goal_node_id)
  }

  // All intervention targets are critical
  for (const option of analysisReady.options ?? []) {
    // Option node itself (if it exists as a node)
    if (option.id) {
      ids.add(option.id)
    }
    // All intervention target node IDs
    for (const nodeId of Object.keys(option.interventions ?? {})) {
      ids.add(nodeId)
    }
  }

  return ids
}

/**
 * Check if any deleted node IDs are critical to ceeAnalysisReady.
 * Only invalidates if goal, option, or intervention target nodes are deleted.
 */
function shouldInvalidateOnNodeDelete(
  deletedNodeIds: string[],
  analysisReady: CEEAnalysisReady | null
): boolean {
  if (!analysisReady) return false
  const criticalIds = getCriticalNodeIds(analysisReady)
  return deletedNodeIds.some(id => criticalIds.has(id))
}

/**
 * Clears ceeAnalysisReady and related CEE readiness fields.
 *
 * Call this when a graph mutation changes analytical meaning:
 * structural changes (add/remove/duplicate/paste/cut nodes and edges),
 * analytical field changes (weight, confidence, observedState,
 * interventions, is_baseline, kind, goal threshold, edge endpoints),
 * and repair/auto-fix operations that replace node/edge arrays.
 *
 * Do NOT call for cosmetic changes: label text, description,
 * position/drag, layout, selection, panel state.
 *
 * Undo/redo clear ceeAnalysisReady directly (not via this function)
 * because they replace the entire graph from the history stack.
 *
 * External producer paths (applyDraftResult, applyPatch,
 * ConversationPanel, DraftChat, TemplatesPanel) are exempt
 * because they set fresh ceeAnalysisReady as part of their
 * operation. Any new external producer must either set fresh
 * ceeAnalysisReady or call invalidateAnalysisReady().
 */
/** Canonical set of fields to clear when CEE readiness is invalidated. */
const READINESS_CLEAR_FIELDS = {
  ceeAnalysisReady: null,
  ceeAnalysisReadyNodeIds: null,
  ceeQuality: null,
  goalConstraints: null,
  ceeExtendedWarnings: null,
  ceeGoalConnectivity: null,
  ceeModelQualityFactors: null,
  ceeInterventionHints: null,
  preAnalysisSensitivity: null,
  draftCoaching: null,
} as const

/**
 * Lane 5 (Codex P0-2): the per-decision "goal context" — target, its
 * representation, the CEE readiness payload, and the outcome-node selection.
 * ANY full-context replacement (new scenario load, canvas import, reset)
 * must clear these, or the previous decision's target / goal node rides the
 * next decision's runs (the canonical default-attach now sends the store
 * threshold on every run, so a stale value corrupts the wire). Applied at
 * hydrateGraphSlice, importCanvas and resetCanvas (incl. the empty-graph
 * early return). Readiness is also re-restored by loaders that carry their
 * own analysis, so clearing first is safe.
 */
const DECISION_CONTEXT_CLEAR = {
  goalThreshold: null,
  goalThresholdRepresentation: null,
  ceeAnalysisReady: null,
  ceeAnalysisReadyNodeIds: null,
  outcomeNodeId: null,
  // B3 (Codex deep review, 2026-07-18): goalConstraints was the ONE member of
  // the goal context missing from this set, so it was the one that leaked.
  // A scenario's hard constraint ("stay under £50k") is per-decision state in
  // exactly the same sense as goalThreshold — READINESS_CLEAR_FIELDS and
  // resetCanvas both already cleared it; only the PRODUCTION scenario-load
  // path (useScenario.loadScenario → hydrateGraphSlice) did not. Switching
  // A→B therefore left A's cap in place and B's first run could ship it.
  // hydrateGraphSlice re-assigns the LOADED value (or null) immediately after
  // applying this set — see the `goalConstraints` handling there.
  goalConstraints: null,
  // B2: element identities are graph-specific. A previous scenario's set would
  // authorise deleting same-id nodes in the newly loaded graph.
  lastAuthoritativeGraph: null,
  // 2.312: the token identifies ONE scenario's server graph. Carrying it across
  // a decision-context change would make the next scenario's first read compare
  // equal to a graph it has nothing to do with, and skip its own hydration.
  serverGraphIdentity: null,
  // 0.48.0: the base hash names ONE scenario's persisted graph. Carrying it
  // across a decision-context change would send the previous decision's hash as
  // the stale gate — refused by CEE, but only by luck: it is a claim about a
  // graph this canvas is no longer showing.
  lastServerGraphHash: null,
  // 0.48.0: an undrained gesture belongs to the graph it was captured against.
  // Sending it after a context change would name ids in a decision the user
  // never edited. (Typed rather than left to `as const`, which would infer
  // `readonly []` and refuse to satisfy the mutable store field.)
  pendingStructuralDeletes: [] as StructuralDeleteIntent[],
  // 0.50.0: same rule for renames — an undrained gesture names a node id in the
  // graph it was captured against, and its `expected_label` describes that
  // graph's label. Both are meaningless once the context has been replaced.
  pendingStructuralRenames: [] as StructuralRenameIntent[],
  // 0.50.0: an attempt's verdict describes ONE decision's node. Carrying it
  // across a context replacement would let a late settle write a verdict about a
  // graph this canvas is no longer showing — the same argument as the queue
  // above, applied to the record of what happened to it.
  structuralRenameLifecycle: [] as StructuralRenameLifecycleRecord[],
  // 0.50.0: same rule for adds. An undrained add names an id minted into THIS
  // graph; replayed against a replaced context it would assert a node the user
  // never created there.
  pendingStructuralAdds: [] as StructuralAddIntent[],
  // 0.50.0: and the same for its verdict record, for the same reason as the
  // rename's — a late settle must not write a verdict about a graph this canvas
  // is no longer showing.
  structuralAddLifecycle: [] as StructuralAddLifecycleRecord[],
  // 0.48.0: the durable-delete record names ids in ONE decision's graph.
  // Carrying it across a context replacement would guard a new canvas against
  // deletions made in a decision the user has left — and could withhold a node
  // that merely shares an id.
  durablyDeletedElements: EMPTY_DURABLE_DELETION_RECORD as DurableDeletionRecord,
  durableDeletionNotice: null as DurableDeletionNotice | null,
} as const

/**
 * Lane 5 (review fold) — the goal/outcome node of a specific graph. On a
 * full-context replacement the outcome selection must be RE-DERIVED to the
 * NEW graph's goal node, not cleared to null (leaves the goal selector
 * empty) and not left stale (a previous scenario's id can collide with a
 * same-id node in the loaded graph, since reseedIds does not rewrite loaded
 * ids — resolveActiveGoalNodeId's existence check would then pass on the
 * wrong node). Returns null when the graph has no goal node.
 */
function firstGoalNodeId(
  nodes: ReadonlyArray<{ id: string; type?: string; data?: unknown }> | undefined,
): string | null {
  const goal = nodes?.find(
    (n) => n.type === 'goal' || (n.data as { type?: string } | undefined)?.type === 'goal',
  )
  return goal?.id ?? null
}

/**
 * P0-1 (external review 2026-07-14): re-derive the global goal-threshold scalar
 * (+ its representation tag) FROM a graph's goal node, so the scalar can never
 * outlive the node it describes. The goal node's `success_threshold`
 * (threshold_source === 'user') is the durable per-goal source of truth
 * (setGoalThresholdAndUpdateNode writes it and pushes it to history); the global
 * scalar is a derived cache. Whenever the graph or the goal selection changes
 * (undo/redo, in-session goal reselection) we recompute the scalar from the
 * resolved goal node rather than leaving a free-floating value that the run path
 * would still forward to PLoT.
 *
 * Prefers `preferredGoalId` when it exists in `nodes`, else the first goal node.
 * Returns {null, null} when no goal node carries a user target.
 */
function deriveGoalThresholdFromNode(
  nodes: ReadonlyArray<{ id: string; type?: string; data?: unknown }> | undefined,
  preferredGoalId?: string | null,
): { goalThreshold: number | null; goalThresholdRepresentation: 'raw' | null } {
  const goalId =
    preferredGoalId && nodes?.some((n) => n.id === preferredGoalId)
      ? preferredGoalId
      : firstGoalNodeId(nodes)
  const goalNode = goalId ? nodes?.find((n) => n.id === goalId) : undefined
  const data = goalNode?.data as
    | { threshold_source?: string; success_threshold?: number | null }
    | undefined
  if (data?.threshold_source === 'user' && typeof data.success_threshold === 'number') {
    // A user target on the node is always stored raw (setGoalThresholdAndUpdateNode).
    return { goalThreshold: data.success_threshold, goalThresholdRepresentation: 'raw' }
  }
  return { goalThreshold: null, goalThresholdRepresentation: null }
}

/**
 * The full goal CONTEXT (outcome selection + threshold scalar + its
 * representation) re-derived FROM a graph's own goal node, in ONE call. This
 * pairs `firstGoalNodeId` (the outcome selection) with
 * `deriveGoalThresholdFromNode` (the threshold that rides the node's
 * `success_threshold`) so the two can never drift apart — #457 was exactly one
 * half of this pair re-derived (outcomeNodeId) while the other (the scalar) was
 * left null, gating the V7 goal lens to 'no_target' after a refresh even though
 * the goal node carried a user target.
 *
 * Every full-graph-replacement path that RE-DERIVES the goal context from the
 * loaded/restored nodes (loadScenario, hydrateGraphSlice) MUST use this, not the
 * two helpers by hand. Paths that PRESERVE the existing outcome selection and
 * re-derive only the threshold (undo/redo, delete, in-session reselection), and
 * paths that deliberately CLEAR the target on a fresh context (importCanvas,
 * draft undo), keep calling `deriveGoalThresholdFromNode` directly — they are
 * not the same pairing.
 *
 * `outcomeNodeId` is null when the graph has no goal node;
 * `goalThreshold`/`goalThresholdRepresentation` are null when the goal node
 * carries no user target.
 */
function deriveGoalContext(
  nodes: ReadonlyArray<{ id: string; type?: string; data?: unknown }> | undefined,
): { outcomeNodeId: string | null; goalThreshold: number | null; goalThresholdRepresentation: 'raw' | null } {
  const outcomeNodeId = firstGoalNodeId(nodes)
  const { goalThreshold, goalThresholdRepresentation } = deriveGoalThresholdFromNode(nodes, outcomeNodeId)
  return { outcomeNodeId, goalThreshold, goalThresholdRepresentation }
}

/**
 * Observability hook for constraint passthrough investigation.
 * Logs when goalConstraints are about to be cleared so we can correlate
 * the clearing trigger with the downstream PLoT auto_goal_threshold symptom.
 */
function logConstraintClearIfPresent(
  get: () => CanvasState,
  trigger: string,
) {
  const prev = get().goalConstraints
  if (prev && prev.length > 0) {
    console.info('[constraint-trace] store-clear', {
      source: 'READINESS_CLEAR_FIELDS',
      cleared_count: prev.length,
      constraint_ids: prev.map((c) => c.id),
      trigger,
    })
  }
}

/**
 * Set the local freshness dirty overlay. Idempotent — only writes (and so only
 * triggers a re-render) on the false→true transition. Called from the proven
 * analysis-affecting edit recognition (invalidateAnalysisReady, the delete
 * chokepoints, setOutcomeNode/setGoalThreshold) and via the public store action
 * for external mutators — never an independent edit detector. (undo/redo/undoDraft
 * set the flag INLINE in their atomic graph-swap set(), not through this helper.)
 * The display rule (resolveDisplayedFreshness) uses it only to downgrade a
 * retained 'fresh' verdict to cannot-confirm; it never fabricates 'stale'.
 */
function markAnalysisFreshnessDirty(
  get: () => CanvasState,
  set: (fn: (s: CanvasState) => Partial<CanvasState>) => void,
) {
  if (!get().analysisFreshnessDirty) {
    set(() => ({ analysisFreshnessDirty: true }))
  }
}

/**
 * Has the current synchronous tick already recorded a delete intent?
 *
 * Module-level rather than store state because it is a scheduling fact, not
 * model state: it must be false again on the next macrotask whatever the store
 * does, and persisting it would make an undrained flag outlive the gesture it
 * describes. Cleared by a microtask, so every synchronous callback React Flow
 * fires for ONE keypress sees the same tick. See
 * `mergeStructuralDeleteIntents` for why the fold is only sound inside it.
 */
let structuralDeleteTickOpen = false

/**
 * Monotonic id for durable-deletion notices.
 *
 * ⚠ NOT DECORATION. The canvas announces the notice by SUBSCRIBING to this
 * field, and two identical outcomes in a row are value-equal — so without a
 * changing member the second press is swallowed and the user is told once for
 * two Cmd+Z's. Same defect shape as a toast keyed on a message string.
 */
let durableNoticeSeq = 0
function nextDurableNoticeSeq(): number {
  durableNoticeSeq += 1
  return durableNoticeSeq
}

/**
 * Record a user delete gesture for the wire, BEFORE the removal is applied.
 *
 * ⚠ THE CALL ORDER IS THE CONTRACT, not a style choice. `base_graph_hash`
 * asserts the graph the user was looking at, and every id/edge-endpoint in the
 * payload is resolved against that same pre-delete graph — so this must run
 * while `get()` still returns it.
 *
 * ⚠ THE COMPLETE MANIFEST OF DELETE PATHS IS SIX, NOT FOUR, and an earlier
 * version of this comment claimed four — corrected here rather than left as an
 * honest-sounding label that is wrong:
 *   1. `deleteSelected`   — the app's own Delete/Backspace shortcut and the
 *                           context menu's multi-select delete
 *   2. `deleteNodeById`   — the context menu's single-node delete
 *   3. `deleteEdgeById`   — the context menu's single-edge delete
 *   4. `deleteEdge`       — the edge inspector's Delete
 *   5. `onNodesChange`    — REACT FLOW'S BUILT-IN delete, node half
 *   6. `onEdgesChange`    — REACT FLOW'S BUILT-IN delete, edge half
 * 5 and 6 are not hypothetical: no `deleteKeyCode` prop is set on `<ReactFlow>`,
 * so its default Backspace/Delete binding is live, and `onEdgesChange`'s own
 * comment already records that built-in edge removals *"reach the store ONLY
 * through this handler — they never go through deleteEdgeById / deleteSelected"*.
 * The app's shortcut listener is on `window` (bubble phase) while React Flow's
 * is nearer the event target, so on a keypress React Flow's handler plausibly
 * runs FIRST and `deleteSelected` then finds nothing selected. Covering both
 * removes the need to be right about that ordering: whichever fires first
 * records, and the other stands down as `nothing_removed`.
 *
 * DELIBERATELY NOT CALLED from the producer-driven removal paths
 * (`applyPatch`, `graphRepair`, receipt reconciliation): those are CEE's own
 * writes coming back, and echoing them to CEE as user deletes would be a second
 * authority arguing with the first. `_externalMutationActive` is the estate's
 * existing name for that distinction and `captureStructuralDelete` reads it.
 *
 * Writes in its OWN `set()`, ahead of the removal's, so `useGraphEditEvents`
 * sees a populated queue when it diffs the removal and can stand its own
 * removal limb down — one gesture, one turn.
 */
function recordStructuralDeleteIntent(
  get: () => CanvasState,
  set: (fn: (s: CanvasState) => Partial<CanvasState>) => void,
  removed: { nodeIds: Iterable<string>; edgeIds: Iterable<string> },
): boolean {
  const state = get()
  const result = captureStructuralDelete({
    nodesBefore: state.nodes,
    edgesBefore: state.edges,
    removedNodeIds: removed.nodeIds,
    removedEdgeIds: removed.edgeIds,
    baseGraphHash: state.lastServerGraphHash,
    externalMutationActive: state._externalMutationActive > 0,
    makeId: () =>
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `sd-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  })
  if (!result.ok) {
    if (result.reason === 'no_server_graph_hash') {
      // A server-backed scenario with no current CAS base is the exact reload
      // branch that used to remove locally, show the changed canvas, and then
      // resurrect on reload. Fail before local removal and give every gesture
      // (pointer, keyboard, built-in React Flow and inspector) one visible
      // reason through the canvas's canonical toast bridge.
      const ownsServerGraph =
        state.currentScenarioId != null || state.lastAuthoritativeGraph != null
      if (ownsServerGraph) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('topbar:show-toast', {
            detail: {
              message: 'Sync the shared model before deleting. Nothing was removed.',
              level: 'warning',
            },
          }))
        }
        return false
      }
      // A genuinely local scratch graph has no server model to diverge from.
      // It remains editable, but records no false durability claim.
      return true
    }
    // Producer/reconciliation writes must still apply locally; empty or stale
    // ids are harmless no-ops at their existing call sites.
    return true
  }
  // Fold same-tick captures into ONE payload — see the manifest above (React
  // Flow splits one keypress across two callbacks) and
  // `mergeStructuralDeleteIntents` for why the tick is the sound window.
  const coalesce = structuralDeleteTickOpen
  if (!coalesce) {
    structuralDeleteTickOpen = true
    queueMicrotask(() => {
      structuralDeleteTickOpen = false
    })
  }
  set((s) => {
    const queued = s.pendingStructuralDeletes
    const last = queued.length > 0 ? queued[queued.length - 1] : undefined
    if (coalesce && last) {
      return {
        pendingStructuralDeletes: [
          ...queued.slice(0, -1),
          mergeStructuralDeleteIntents(last, result.intent),
        ],
      }
    }
    return { pendingStructuralDeletes: [...queued, result.intent] }
  })
  return true
}

/**
 * Record one rename gesture for the wire, against the PRE-rename node.
 *
 * DELIBERATELY NOT GATED ON SUCCESS. Unlike the delete twin — which refuses the
 * local removal outright when it cannot express it durably, because a locally
 * removed node that resurrects on reload is the P0 that lane closed — a rename
 * that cannot be sent still applies LOCALLY and simply claims no durability.
 * The asymmetry is deliberate and derived from the harms: an unsent delete makes
 * the product contradict itself on the next re-run; an unsent rename is a local
 * display name, which is what the product did for its entire history before
 * 0.50.0. Blocking it would be a regression bought for tidiness.
 *
 * ⚠ AND IT IS NOT CALLED from producer-driven writes: `captureStructuralRename`
 * reads `_externalMutationActive`, the estate's existing name for "this is CEE's
 * own write coming back". Echoing a server rename to the server as a user rename
 * would be a second authority arguing with the first — and, worse here than for
 * deletes, it would carry an `expected_label` the server itself just superseded.
 */
function recordStructuralRenameIntent(
  get: () => CanvasState,
  set: (fn: (s: CanvasState) => Partial<CanvasState>) => void,
  nodeId: string,
  label: string,
): void {
  const state = get()
  const result = captureStructuralRename({
    nodesBefore: state.nodes,
    nodeId,
    label,
    baseGraphHash: state.lastServerGraphHash,
    externalMutationActive: state._externalMutationActive > 0,
    makeId: () =>
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `sr-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  })
  if (!result.ok) return
  set((s) => ({ pendingStructuralRenames: [...s.pendingStructuralRenames, result.intent] }))

  // ⭐⭐ THE DEFERRED ARM — the P0 this lane closes. Before this, a rename made on
  // a RESTORED graph stood down on `no_server_graph_hash`, queued nothing, and
  // the local write below applied the label anyway: a local-only write that
  // looked committed and vanished on the next reload. It is now queued and will
  // be stamped with a real base hash by the drain, but until a turn supplies one
  // the model genuinely does not hold the name — and the queue is memory-only,
  // so a reload before that turn still loses it.
  //
  // ⚠ SAYING SO IS THE POINT. UI #1025 was reverted for shipping a control that
  // HID this loss; blocking the rename instead would regress a capability the
  // product has had since long before 0.50.0. The third option is the honest one:
  // apply it, queue it, and tell the user exactly where it stands.
  //
  // ⚠ ONLY WHERE THERE IS A MODEL TO FALL BEHIND. A scratch graph with no
  // scenario and no authoritative graph has no saved model, so there is nothing
  // to disclose and a notice would be noise. Same predicate the delete lane uses.
  if (!result.deferred) return
  const ownsServerGraph = state.currentScenarioId != null || state.lastAuthoritativeGraph != null
  if (!ownsServerGraph) return
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('topbar:show-toast', {
    detail: { message: STRUCTURAL_RENAME_DEFERRED_NOTICE, level: 'warning' },
  }))
}

/**
 * Plan one add gesture's durable intent, against the graph the caller is ABOUT
 * TO INSTALL.
 *
 * ⭐⭐⭐ IT RETURNS A PATCH INSTEAD OF CALLING `set()`, AND THAT IS THE FIX FOR A
 * MEASURED DEFECT — read this before "simplifying" it back.
 *
 * `useGraphEditEvents` SUBSCRIBES to the store. When the node write and the
 * intent capture were two separate `set()` calls, the subscriber fired on the
 * FIRST one, read `pendingStructuralAdds` as EMPTY, accumulated the add and
 * advanced its snapshot — so `removeStructuralAddClaims` never saw a populated
 * queue and the subtraction NEVER RAN. One gesture put `structural_add` AND a
 * `direct_graph_edit` on the wire, and the notification half is the
 * `'ack_and_commit'` path (turn row, NO graph write) the durable verb exists to
 * replace. Proven by driving the real subscriber:
 * `useGraphEditEvents.structuralAddClaims.spec.ts`.
 *
 * ⚠⚠ AND THE CAUSE IS AN INHERITANCE, NOT A TYPO — the reason this comment is
 * long. `recordStructuralDeleteIntent` captures BEFORE its mutation and says so
 * in terms: "Writes in its OWN `set()`, ahead of the removal's, so
 * `useGraphEditEvents` sees a populated queue when it diffs the removal." An ADD
 * must capture AFTER, because its subject does not exist until the node does.
 * That inversion is correct — but the SUBTRACTION was inherited without
 * inverting with it. Two mechanisms answering different questions under one
 * shared helper (CLAUDE.md trap 21).
 *
 * Returning a patch lets {@link CanvasState.addNode} install the node and its
 * intent in ONE `set()`, so both things are true at once: the capture reads a
 * graph that CONTAINS the new node, and the subscriber's very first observation
 * already sees the claim. **Any future caller must preserve that single
 * transaction.**
 *
 * DELIBERATELY NOT GATED ON SUCCESS, the same asymmetry the rename twin
 * documents. The DELETE twin refuses the local removal outright when it cannot
 * express it durably, because a locally removed node that resurrects on reload
 * is the P0 that lane closed. An add that cannot be sent still applies LOCALLY
 * and simply claims no durability — which is what the product did for its entire
 * history before 0.50.0. Blocking it would be a regression bought for tidiness.
 *
 * ⚠ AND IT STANDS DOWN on producer-driven writes: `captureStructuralAdd` reads
 * `_externalMutationActive`, the estate's existing name for "this is CEE's own
 * write coming back". Echoing a server-created node back as a user add would be
 * a second authority arguing with the first — and here it would mint a duplicate
 * id, the one collision `base_graph_hash` provably cannot catch.
 */
function planStructuralAddIntent(
  state: CanvasState,
  nodesAfter: Node[],
  nodeId: string,
): { patch: Partial<CanvasState>; deferred: boolean } {
  const result = captureStructuralAdd({
    nodesAfter,
    nodeId,
    baseGraphHash: state.lastServerGraphHash,
    externalMutationActive: state._externalMutationActive > 0,
    persistableKinds: WIRE_ADDABLE_NODE_KINDS,
    // THE DOMAIN'S ONE FALLBACK CHAIN, never a second copy — `resolveNodeTypeLiteral`
    // owns `node.type ?? data.kind ?? data.type` precisely so every surface gets
    // the same answer, and it returns null outside the taxonomy rather than
    // inventing a default.
    resolveKind: (n) => resolveNodeTypeLiteral(n),
    makeId: () =>
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `sa-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  })
  if (!result.ok) return { patch: {}, deferred: false }
  return {
    patch: { pendingStructuralAdds: [...state.pendingStructuralAdds, result.intent] },
    deferred: result.deferred,
  }
}

/**
 * Tell the user a captured add is on the canvas but not yet in the model.
 *
 * ⚠ FIRED AFTER THE `set()`, NEVER INSIDE IT. A side effect in a store updater
 * can re-enter, and the updater must stay a pure function of state.
 *
 * ⭐⭐ THE DEFERRED ARM. On a restored graph there is no `graph_hash` yet, so the
 * model genuinely does not hold this node and will not until the next turn. The
 * queue is memory-only, so a reload before then loses it — and SAYING SO IS THE
 * POINT. UI #1025 was reverted for shipping a control that HID exactly this
 * loss; blocking the add instead would regress a capability the product has
 * always had. The third option is the honest one: apply it, queue it, and tell
 * the user exactly where it stands.
 *
 * ⚠ ONLY WHERE THERE IS A MODEL TO FALL BEHIND. A scratch graph with no scenario
 * and no authoritative graph has no saved model, so there is nothing to disclose
 * and a notice would be noise. Same predicate as the rename lane's.
 */
function announceDeferredStructuralAdd(state: CanvasState): void {
  const ownsServerGraph = state.currentScenarioId != null || state.lastAuthoritativeGraph != null
  if (!ownsServerGraph) return
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('topbar:show-toast', {
    detail: { message: STRUCTURAL_ADD_DEFERRED_NOTICE, level: 'warning' },
  }))
}

/**
 * By-value equality for the goal-constraints array — used by setGoalConstraints
 * to honour the no-op discipline (a set whose content matches the current value
 * must not dirty freshness). Conservative: ANY structural content difference
 * (identity, operator, value, node binding, unit, probability, provenance)
 * counts as a change; one-null-one-array counts as a change. A null↔null or
 * same-reference set is a no-op.
 */
function goalConstraintsEqual(
  a: CEEGoalConstraint[] | null,
  b: CEEGoalConstraint[] | null,
): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  if (a.length !== b.length) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

function invalidateAnalysisReady(
  get: () => CanvasState,
  set: (fn: (s: CanvasState) => Partial<CanvasState>) => void,
  reason?: string
) {
  // Local dirty overlay: every analysis-affecting edit that reaches this
  // invalidation marks the retained CEE freshness verdict as no-longer-
  // confirmable. Set unconditionally (independent of whether ceeAnalysisReady is
  // currently present) — the display rule only acts on a retained 'fresh'
  // verdict, and a new analysis_ready clears the overlay.
  markAnalysisFreshnessDirty(get, set)
  const { ceeAnalysisReady } = get()
  if (ceeAnalysisReady) {
    if (import.meta.env.DEV) {
      console.warn('[Canvas] === INVALIDATE ANALYSIS_READY ===')
      console.warn('[Canvas] Reason:', reason ?? 'unspecified')
      console.warn('[Canvas] Had options:', ceeAnalysisReady.options?.length)
      console.trace('[Canvas] invalidateAnalysisReady call stack')
    }
    logConstraintClearIfPresent(get, `invalidateAnalysisReady:${reason ?? 'unspecified'}`)
    set(() => ({ ...READINESS_CLEAR_FIELDS }))
  }
}

/**
 * Conditionally invalidate ceeAnalysisReady if deleted nodes are critical.
 * Returns true if invalidated, false otherwise.
 */
function maybeInvalidateOnNodeDelete(
  get: () => CanvasState,
  set: (fn: (s: CanvasState) => Partial<CanvasState>) => void,
  deletedNodeIds: string[]
): boolean {
  // Dirty overlay fires on ANY structural node removal (taxonomy: "structural
  // node remove"), not just the critical subset that clears ceeAnalysisReady.
  // This only sets the dirty flag — it deliberately does NOT widen the existing
  // critical-gating of ceeAnalysisReady invalidation.
  if (deletedNodeIds.length > 0) markAnalysisFreshnessDirty(get, set)
  const { ceeAnalysisReady } = get()
  if (shouldInvalidateOnNodeDelete(deletedNodeIds, ceeAnalysisReady)) {
    invalidateAnalysisReady(get, set, `Deleted critical node(s): ${deletedNodeIds.join(', ')}`)
    return true
  }
  return false
}

/**
 * Check if deleting an edge should invalidate ceeAnalysisReady.
 * Invalidates if the edge connects critical nodes (goal, option, or intervention targets),
 * as this breaks the causal path from interventions to goal.
 */
function shouldInvalidateOnEdgeDelete(
  edge: { source: string; target: string },
  analysisReady: CEEAnalysisReady | null
): boolean {
  if (!analysisReady) return false
  const criticalIds = getCriticalNodeIds(analysisReady)
  // If either endpoint is critical, the edge is part of the causal path
  return criticalIds.has(edge.source) || criticalIds.has(edge.target)
}

/**
 * Conditionally invalidate ceeAnalysisReady if deleted edge connects critical nodes.
 * Returns true if invalidated, false otherwise.
 */
function maybeInvalidateOnEdgeDelete(
  get: () => CanvasState,
  set: (fn: (s: CanvasState) => Partial<CanvasState>) => void,
  edge: { source: string; target: string }
): boolean {
  // Dirty overlay fires on ANY structural edge removal (taxonomy: "structural
  // edge remove"), not just edges touching the critical subset.
  markAnalysisFreshnessDirty(get, set)
  const { ceeAnalysisReady } = get()
  if (shouldInvalidateOnEdgeDelete(edge, ceeAnalysisReady)) {
    invalidateAnalysisReady(get, set, `Deleted edge connecting critical nodes: ${edge.source} → ${edge.target}`)
    return true
  }
  return false
}

// hasAnalyticalEdgeChange / hasAnalyticalNodeChange — the "is this graph edit
// analysis-affecting?" taxonomy now lives in domain/analyticalChange.ts so the
// store edit chokepoints (updateNode/updateEdge) and the raw patch-apply path
// (applyAutoApplyPatch) share ONE definition with SEMANTIC (by-value) comparison.
// Imported at the top of this module.

function getMaxNumericId(ids: string[]): number {
  return ids.reduce((max, id) => {
    // P0 2026-08-13: `id` is NOT guaranteed to be a string here. CEE-written
    // `scenarios.graph` edges carry no `id` key at all, so a persisted graph
    // reaching `reseedIds` un-normalised made this `undefined.replace(...)` —
    // a TypeError thrown OUT of `hydrateGraphSlice`, swallowed by the
    // `.catch()` in CanvasMVP, which silently abandoned the REST of
    // `loadScenario` (framing, stage, analysis) after the graph had already
    // been set. `normalisePersistedGraph` now fixes the shape at the boundary;
    // this guard is defence in depth, because the crash is catastrophic and
    // this helper is reachable from several graph-replacement paths.
    if (typeof id !== 'string') return max
    const num = parseInt(id.replace(/\D/g, ''), 10)
    return isNaN(num) ? max : Math.max(max, num)
  }, 0)
}

// React #185 DEBUG: Check if stateDebug=1 is in URL (supports HashRouter)
function isStateDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const url = new URL(window.location.href)
    if (url.searchParams.get('stateDebug') === '1') return true
    // HashRouter: query params may be in hash fragment
    const hash = window.location.hash
    const queryIndex = hash.indexOf('?')
    if (queryIndex !== -1) {
      const hashParams = new URLSearchParams(hash.slice(queryIndex + 1))
      if (hashParams.get('stateDebug') === '1') return true
    }
  } catch { /* ignore */ }
  return false
}

// Check if rawCee=1 is in URL (supports HashRouter)
// Used to bypass CEE post-processing repairs for debugging
function getInitialRawCeeMode(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const url = new URL(window.location.href)
    if (url.searchParams.get('rawCee') === '1') return true
    // HashRouter: query params may be in hash fragment
    const hash = window.location.hash
    const queryIndex = hash.indexOf('?')
    if (queryIndex !== -1) {
      const hashParams = new URLSearchParams(hash.slice(queryIndex + 1))
      if (hashParams.get('rawCee') === '1') return true
    }
  } catch { /* ignore */ }
  return false
}

// React #185 DEBUG: Middleware to instrument internal set() calls
// This captures stack traces for ALL store updates, not just external setState
type SetState<T> = (
  partial: T | Partial<T> | ((state: T) => T | Partial<T>),
  replace?: boolean | undefined
) => void

function createDebugSet<T>(originalSet: SetState<T>, debugEnabled: boolean): SetState<T> {
  if (!debugEnabled) return originalSet

  // Debug logger enabled - check window.__SAFE_DEBUG__.logs for captured updates

  return (partial, replace) => {
    const win = window as unknown as { __SAFE_DEBUG__?: { logs: Array<{ t: number; m: string; data: unknown }> } }
    win.__SAFE_DEBUG__ ||= { logs: [] }
    const debug = win.__SAFE_DEBUG__
    const stack = new Error().stack?.split('\n').slice(1, 8).join('\n') || 'no stack'

    // Get keys being updated for easier filtering
    let keys: string[] = []
    if (typeof partial === 'function') {
      keys = ['<function>']
    } else if (partial && typeof partial === 'object') {
      keys = Object.keys(partial)
    }

    if (Array.isArray(debug.logs) && debug.logs.length < 5000) {
      debug.logs.push({
        t: Date.now(),
        m: 'canvas:set',
        data: { keys, stack },
      })
    }

    return originalSet(partial, replace)
  }
}

/**
 * ⭐ THE GUARD THAT KEEPS `ResultsState.restoredForScenarioId` OFF EVERY SLICE
 * IT WAS NOT COMPUTED FOR — one shared path, not a list of call sites.
 *
 * ⚠ ONE WRITER, TEN CARRIERS. `resultsLoadHistorical` is the only PRODUCER of
 * the stamp, and it is nowhere near the only writer of `results`. Enumerated at
 * the bytes (`rg -n 'results:\s*\{' src/canvas/store.ts` → 16 sites), TEN carry
 * the previous slice forward with `...s.results`: `resultsConnecting`,
 * `resultsProgress`, `resultsComplete` and its duplicate-run follow-up,
 * `resultsError`, `resultsCancelled`, `resultsAnalysing`, both arms of
 * `resultsSettle`, and `resultsHydrateFromSupabase`. Every one of them would
 * otherwise carry the stamp onto a slice holding a DIFFERENT answer.
 *
 * THE HARM THAT MAKES THIS LOAD-BEARING. A boot restore stamps A; the user runs
 * a NEW analysis in-session; the stamp rides `resultsComplete` onto the fresh
 * slice and still equals A. A later `loadScenario(A)` REPLACES the graph with
 * the server's, and would preserve that answer over a model it was not computed
 * on — and an in-session run DOES mint a `v5AnalysisFact`, so the orphan
 * classification that keeps a restored answer honest never fires and it renders
 * `complete`. That turns a LOST answer into a CONFIDENTLY WRONG one, which is
 * strictly worse than the defect the stamp exists to close.
 *
 * ⚠ WHY A GUARD AND NOT TEN `delete`s. Ten edits are a hand-maintained mirror
 * (CLAUDE.md trap 12): the eleventh carrier ships without one and nothing reds.
 * This intercepts the ONE path every in-store `results` write takes, so a new
 * carrier is covered the day it is written.
 *
 * ⚠ WHY AN EXPLICIT TOKEN AND NOT A PROPERTY OF THE SLICE. Authorising on
 * `reportEpoch === HISTORICAL_REPORT_EPOCH` was considered and REJECTED:
 * `resultsHydrateFromSupabase` writes that same sentinel BY SPREAD, so it would
 * have re-authorised a stale stamp onto a different report. The writer
 * announces itself instead, which is exact rather than a proxy.
 *
 * ⚠ SCOPE, STATED NARROWLY. This covers writes through the store's own `set`.
 * A `useCanvasStore.setState({ results })` from outside is not intercepted —
 * there is exactly one such site at this tip (`useScenario.ts`'s
 * `analysis_status === 'failed'` arm), and it REPLACES the slice rather than
 * spreading it, so it carries no stamp either way. `loadScenario`'s deliberate
 * preserve is also an outside `setState`, and must stay outside: it is the one
 * write whose whole purpose is to carry the stamped slice through.
 */
let restoreStampWriteAuthorised = false

/**
 * Announce the ONE authorised write. Consumed by the very next `set`, whatever
 * it carries — zustand's `set` is synchronous (functional partials included),
 * so the window is exactly that one call and cannot leak past it.
 */
function authoriseRestoreStampOnNextSet(): void {
  restoreStampWriteAuthorised = true
}

function stripUnauthorisedRestoreStamp<T>(partial: T, authorised: boolean): T {
  if (authorised) return partial
  if (!partial || typeof partial !== 'object') return partial
  const results = (partial as { results?: ResultsState }).results
  if (!results || typeof results !== 'object') return partial
  if (!('restoredForScenarioId' in results)) return partial
  const { restoredForScenarioId: _dropped, ...withoutStamp } = results
  return { ...partial, results: withoutStamp } as T
}

function createRestoreStampGuard(inner: SetState<CanvasState>): SetState<CanvasState> {
  return (partial, replace) => {
    const authorised = restoreStampWriteAuthorised
    restoreStampWriteAuthorised = false
    if (typeof partial === 'function') {
      const updater = partial as (state: CanvasState) => CanvasState | Partial<CanvasState>
      return inner((state) => stripUnauthorisedRestoreStamp(updater(state), authorised), replace)
    }
    return inner(stripUnauthorisedRestoreStamp(partial, authorised), replace)
  }
}

// Create the store with optional debugging middleware
// Enable via URL param ?stateDebug=1 to capture ALL set() calls with stack traces
const _stateDebugEnabled = isStateDebugEnabled()

export const useCanvasStore = create<CanvasState>((originalSet, get) => {
  // Wrap set with debugging if enabled.
  // Cast: Zustand's setState is overloaded (replace?: false vs replace: true),
  // local SetState declares a single signature with replace?: boolean. The
  // wrapper preserves runtime behaviour exactly — only the static signature
  // differs.
  // ⭐ The restore-stamp guard wraps the OUTERMOST `set`, so every in-store
  // `results` write passes through it — see `createRestoreStampGuard`.
  const set = createRestoreStampGuard(
    createDebugSet(originalSet as SetState<CanvasState>, _stateDebugEnabled),
  )

  return {
  nodes: initialNodes,
  edges: initialEdges,
  history: { past: [], future: [] },
  selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  _internal: { lastHistoryHash: '' },
  clipboard: null,
  reconnecting: null,
  touchedNodeIds: new Set(),
  outcomeNodeId: null,
  goalThreshold: null,
  goalThresholdRepresentation: null,
  nextNodeId: 1,
  nextEdgeId: 1,
  results: {
    status: 'idle',
    progress: 0
  },
  runMeta: {},
  previousReport: null,
  // Scenario state
  currentScenarioId: scenarios.getCurrentScenarioId(),
  scenarioPersistedToDb: false,
  currentScenarioFraming: null,
  currentStage: null,
  currentScenarioLastResultHash: null,
  currentScenarioLastRunAt: null,
  currentScenarioLastRunSeed: null,
  hasCompletedFirstRun: false,
  graphEditedSinceLastRun: false,
  analysisStateReady: false,
  isDirty: false,
  isSaving: false,  // P0-2: Initially not saving
  lastSavedAt: null,  // P0-2: No save yet
  // isGenerating lives in useDraftStore as of C3-5.
  // Phase 3: Panel visibility with persistence
  ...{
    showResultsPanel: false,
    showInspectorPanel: false,
    showTemplatesPanel: false,
    showDraftChat: false,
    currentBriefText: null,
    draftComposerText: null,
    // Model selection, lastDraftDescription, lastDraftError live in useDraftStore (C3-5)
    draftChatPreDraftSnapshot: null,
    showIssuesPanel: false,
    showProvenanceHub: false,
    showDocumentsDrawer: false,
    showComparePanel: false,
    ...loadUIPreferences(), // Override with persisted preferences
  },
  // CEE V3: analysis_ready payload
  ceeAnalysisReady: null,
  // Freshness verdict — null until CEE emits analysis_ready (UI shows nothing).
  analysisFreshness: null,
  // Local dirty overlay — false at cold start (no edits to invalidate a verdict).
  analysisFreshnessDirty: false,
  // ROADMAP 2.1163 / EXT-2: no analysis has been refused at cold start.
  analysisRefusalNotice: null,
  // Step 5: no turn has stated an analysis_state verdict at cold start. Null
  // means NOT STATED, which is what routes the selector to the legacy branch.
  analysisStateV1: null,
  // Interim 2.467: no import has happened at cold start.
  importPendingServerRegistration: false,
  // No edit can be awaiting dispatch before any edit has been made.
  pendingEmittedEdits: 0,
  ceeAnalysisReadyNodeIds: null,
  // V5 canonical analysis fact (v5-canonical-analysis brief)
  v5AnalysisFact: null,
  // CEE coaching payload (session-local; never persisted)
  draftCoaching: null,
  // CEE goal constraints from draft-graph response root
  goalConstraints: null,
  // B2: no authoritative graph seen yet — reconciler removes nothing.
  lastAuthoritativeGraph: null,
  // 2.312: no server graph read yet — nothing to compare against.
  serverGraphIdentity: null,
  // 0.48.0: no CEE turn seen yet — a delete stands down rather than assert a
  // base hash it does not hold.
  lastServerGraphHash: null,
  // 0.48.0: no delete gestures awaiting the wire.
  pendingStructuralDeletes: [],
  // 0.50.0: no rename gestures awaiting the wire.
  pendingStructuralRenames: [],
  // 0.50.0: no rename has been attempted at cold start, so there is no verdict
  // to hold — and an empty lifecycle is "nothing attempted", never "all fine".
  structuralRenameLifecycle: [],
  // 0.50.0: no add gestures awaiting the wire.
  pendingStructuralAdds: [],
  // 0.50.0: no add has been attempted at cold start — an empty lifecycle is
  // "nothing attempted", never "all fine".
  structuralAddLifecycle: [],
  // 0.48.0: no deletion has been proven durable yet, so undo is unconstrained.
  durablyDeletedElements: EMPTY_DURABLE_DELETION_RECORD,
  durableDeletionNotice: null,
  // CEE Pipeline trace from last draft
  ceePipelineTrace: null,
  // CEE V3: Per-node LLM reasoning for rationale tooltips
  nodeRationales: {},
  // CEE quality dimensions from draft-graph response
  ceeQuality: null,
  // Phase 1b: Extended CEE data
  ceeExtendedWarnings: null,
  ceeGoalConnectivity: null,
  ceeModelQualityFactors: null,
  ceeInterventionHints: null,
  preAnalysisSensitivity: null,
  // Engine limits (session-scoped singleton)
  engineLimits: null,
  engineLimitsSource: null,
  engineLimitsLoading: true,
  engineLimitsError: null,
  engineLimitsFetchedAt: null,
  // M6: Scenario Comparison Mode state lives in useComparisonStore as of C3-3.
  templatesPanelInvoker: null,
  // M4: Graph Health & Repair
  graphHealth: null,
  needleMovers: [],
  highlightedNodes: new Set<string>(),
  olumiAttention: null,
  highlightedEdges: new Set<string>(),
  analysisHighlight: { source: null, edgeIds: new Set<string>(), nodeIds: new Set<string>() },
  dimmedNodeIds: new Set<string>(),
  dimmedEdgeIds: new Set<string>(),
  focusDimSourceId: null,
  editedSinceRunNodeIds: new Set<string>(),
  lodActive: false,
  confirmedNodeIds: new Set<string>(),
  hoveredOptionId: null,
  // Graph Lens: ephemeral canvas filtering state.
  // Bug 6: previous inline init covered only 7 of the 12 LensState fields,
  // omitting _hiddenNodeIds, _hiddenEdgeIds, _causalEdgeParams,
  // _evidenceNodeClass, _evidenceEdgeClass (added in Brief 5 expanded
  // lenses). Use the canonical factory that returns the full shape — and
  // is already used at every reset call site in this file.
  lens: createDefaultLensState(),
  // M5: Grounding & Provenance
  documents: [],
  citations: [],
  provenanceRedactionEnabled: true, // M5: Redaction ON by default
  // S7-FILEOPS: Document management initial state.
  // Bug 5: loadSortPreferences returns { sortField, sortDirection } —
  // spreading those keys silently failed to initialise the canvas store's
  // documentSortField/Direction fields, so the documents list ignored
  // saved user preferences on initial load until the user interacted with
  // the sort controls. Map explicitly to the canonical names.
  documentSearchQuery: loadSearchQuery(),
  documentSortField: loadSortPreferences().sortField,
  documentSortDirection: loadSortPreferences().sortDirection,
  // A.7: External mutation suppression reference count (0 = inactive)
  _externalMutationActive: 0,
  _suppressHistory: false,
  // Week 3: AI Clarifier initial state
  showAIClarifier: false,
  clarifierSession: null,
  clarifierPreviewNodeIds: [],
  clarifierPreviewEdgeIds: [],
  // Canvas view mode: default to 'standard' (actionable guidance)
  viewMode: ((): 'standard' | 'expert' => {
    try {
      const v = sessionStorage.getItem('canvas.viewMode')
      if (v === 'standard' || v === 'expert') return v
      // Backward compat: migrate old values
      if (v === 'decision') return 'standard'
      if (v === 'model') return 'expert'
    } catch { /* noop */ }
    return 'standard'
  })(),
  // Layout lifecycle (D2 of layout-stabilisation brief)
  pendingLayout: false,
  layoutInProgress: false,
  layoutVersion: 0,
  layoutRequestId: 0,
  lastLayoutInitiatedBy: 'user',
  // Track 3: Hydrated thread/events (transient, consumed once)
  _hydratedThread: null,
  _hydratedEvents: null,
  // Phase 2A: Analysis metadata for Model Card Lite
  lastAnalysisSeed: null,
  lastQualityMode: null,
  repairsApplied: null,
  rawV2Response: null,
  // Debug: Raw CEE output mode (initialized from URL param ?rawCee=1)
  debugRawCeeOutput: getInitialRawCeeMode(),

  createNodeId: () => {
    const { nextNodeId } = get()
    set({ nextNodeId: nextNodeId + 1 })
    return String(nextNodeId)
  },

  createEdgeId: () => {
    const { nextEdgeId } = get()
    set({ nextEdgeId: nextEdgeId + 1 })
    return `e${nextEdgeId}`
  },

  reseedIds: (nodes, edges) => {
    const maxNodeId = getMaxNumericId(nodes.map(n => n.id))
    const maxEdgeId = getMaxNumericId(edges.map(e => e.id))
    set({ 
      nextNodeId: Math.max(maxNodeId + 1, 5),
      nextEdgeId: Math.max(maxEdgeId + 1, 5)
    })
  },

  addNode: (pos, type = 'decision', label) => {
    // Node limit check (PRD guardrail)
    const { nodes, edges, engineLimits } = get()
    const limitKind = wouldExceedLimits(nodes.length, edges.length, 1, 0, engineLimits)
    if (limitKind) return limitKind

    pushToHistory(get, set, `Added ${type}`)
    invalidateAnalysisReady(get, set, `add_node (${type})`)
    const id = get().createNodeId()
    // ⚠ `{ label }` AND NOTHING ELSE — no prior, no observedState, no category,
    // no value of any kind. The explicit-unknown guarantee starts here, and
    // `structuralAdd.explicitUnknown.spec.ts` fails loud if a key is ever added.
    const resolvedLabel =
      typeof label === 'string' && label.trim().length > 0 ? label.trim() : `Node ${id}`
    const created: Node = {
      id,
      type,
      position: pos || { x: 200, y: 200 },
      data: { label: resolvedLabel },
    }

    // ⭐⭐⭐ ONE `set()` — THE NODE AND ITS DURABLE INTENT, IN A SINGLE
    // TRANSACTION. ⚠ DO NOT SPLIT THIS BACK INTO TWO.
    //
    // Two `set()` calls is what the first cut of this lane shipped, and it made
    // `removeStructuralAddClaims` DEAD: `useGraphEditEvents` subscribes to the
    // store, so it fired on the node write, read `pendingStructuralAdds` as
    // EMPTY, accumulated the add and advanced its snapshot. The queue was
    // populated a moment later, with nothing left to subtract from. One gesture,
    // TWO turns — `structural_add` plus a `direct_graph_edit` describing the
    // same node, and the notification half is the 'ack_and_commit' path (turn
    // row, NO graph write) the durable verb exists to replace.
    //
    // ⚠⚠ THE ORDERING DEPENDENCY, NAMED HERE AND AT `planStructuralAddIntent`
    // AND AT `removeStructuralAddClaims`, because it is a TRAP-21 INHERITANCE
    // rather than a slip. `recordStructuralDeleteIntent` captures BEFORE its
    // mutation and its comment says why: "Writes in its OWN `set()`, ahead of
    // the removal's, so `useGraphEditEvents` sees a populated queue when it
    // diffs the removal." An ADD cannot capture before — its subject does not
    // exist until the node does. Inverting the capture without inverting the
    // subtraction is what broke it. The single transaction satisfies both
    // constraints at once: the capture reads a graph that CONTAINS the new node,
    // and the subscriber's first observation already carries the claim.
    //
    // The projected `nodesAfter` is exactly the array this `set()` installs —
    // not a guess about it — so the capture reads the graph its assertion is
    // about.
    //
    // ⭐⭐ THIS IS THE CHOKEPOINT FOR EVERY GESTURE THAT REACHES `addNode`: the
    // pane context menu, the six Command Palette "Add …" commands, the
    // pre-analysis AddRow and the hero goal field. Capturing at any one of them
    // would have left the others silent.
    //
    // ⚠⚠ IT IS **NOT** EVERY CREATION PATH IN THE CANVAS. `addNodeWithEdge`
    // (five user-reachable affordances), `duplicateSelected` and
    // `pasteClipboard` capture NOTHING — and on `addNodeWithEdge` a new factor
    // even renders a number. The measured scope, and which omissions are
    // deliberate, is on `pendingStructuralAdds`; read it there rather than
    // inferring coverage from this line.
    const nodesAfter: Node[] = [...get().nodes, created]
    const plan = planStructuralAddIntent(get(), nodesAfter, id)
    set(() => ({ nodes: nodesAfter, ...plan.patch }))

    // AFTER the transaction, never inside it — a store updater must stay a pure
    // function of state.
    if (plan.deferred) announceDeferredStructuralAdd(get())
    return null
  },

  addNodeWithEdge: (pos, type, connectTo, edgeDirection) => {
    // Limit check: adding 1 node + 1 edge
    const { nodes, edges, engineLimits } = get()
    const limitKind = wouldExceedLimits(nodes.length, edges.length, 1, 1, engineLimits)
    if (limitKind) return limitKind

    pushToHistory(get, set, `Added connected ${type}`)
    invalidateAnalysisReady(get, set, `add_node_with_edge (${type})`)
    const nodeId = get().createNodeId()
    const edgeId = get().createEdgeId()
    const [source, target] =
      edgeDirection === 'to-target' ? [nodeId, connectTo] : [connectTo, nodeId]
    set((s) => ({
      nodes: [
        ...s.nodes,
        {
          id: nodeId,
          type,
          position: pos,
          data: { label: `New ${type}`, kind: type, category: 'external' },
        },
      ],
      edges: [
        ...s.edges,
        {
          id: edgeId,
          source,
          target,
          type: 'styled' as const,
          data: { ...USER_EDGE_DEFAULTS },
        },
      ],
      selection: { nodeIds: new Set([nodeId]), edgeIds: new Set<string>(), anchorPosition: null },
    }))
    return nodeId
  },

  updateNodeLabel: (id, label) => {
    // 0.50.0 — CAPTURE BEFORE THE LOCAL WRITE, and that ordering is the whole
    // point. `expected_label` is an assertion about the label the user was
    // LOOKING AT; reading it after the local mutation would assert the label we
    // just wrote, which always matches nothing on the server and turns the
    // concurrency gate into a tautology that never fires.
    //
    // ⭐ THIS IS THE ONE CHOKEPOINT EVERY RENAME GESTURE CROSSES, which is the
    // same reason `recordStructuralDeleteIntent` lives inside the store's delete
    // actions rather than at a call site: the inspector title
    // (`InspectorRouter` → `EditableLabel`), the canvas double-click
    // (`requestNodeRename` → the same editor), the pre-analysis hero and
    // `YourDecisionSection` all land here. Capturing at any one of them would
    // have left the others silent — the defect `StructuralDeleteDrainHost`'s
    // header records as having shipped dark under a fully green suite.
    recordStructuralRenameIntent(get, set, id, label)
    pushToHistory(get, set)
    set((s) => ({
      nodes: s.nodes.map(n => {
        if (n.id !== id) return n
        // A person just authored this label. On a GOAL that supersedes CEE's
        // `from_brief` stamp, which is what stops the surfaces going on
        // saying the label was lifted from the brief after the user has
        // rewritten it (the second harm: the same predicate guards both
        // directions, so it has to be cleared by the act that falsifies it).
        // `provenanceAfterHumanAuthoredLabel` returns undefined for every
        // other kind, so a factor's VALUE provenance is left alone.
        const authored = provenanceAfterHumanAuthoredLabel(
          (n.data as { kind?: string } | undefined)?.kind ?? n.type,
        )
        return {
          ...n,
          data: { ...n.data, label, ...(authored ? { provenance: authored } : {}) },
        }
      }),
    }))
  },

  updateNode: (id, updates) => {
    // Validate node type if being updated
    if (updates.type && !NODE_REGISTRY[updates.type as NodeType]) {
      console.warn(`[Canvas] Invalid node type: ${updates.type}`)
      return
    }
    const oldNode = get().nodes.find(n => n.id === id)
    pushToHistory(get, set)
    set((s) => ({
      nodes: s.nodes.map(n => n.id === id ? { ...n, ...updates, data: { ...n.data, ...updates.data } } : n)
    }))
    if (oldNode && hasAnalyticalNodeChange(oldNode, updates)) {
      invalidateAnalysisReady(get, set, `update_node analytical field (${id})`)
    }
  },

  batchUpdateNodes: (updates, _sourceTag) => {
    if (!updates.length) return { updatedCount: 0 }
    const currentNodes = get().nodes
    // Build an index once; avoid nested find() and O(N*M) lookups.
    const updatesById = new Map<string, Partial<Node['data']>>()
    for (const u of updates) updatesById.set(u.id, u.data)

    let changedCount = 0
    const nextNodes = currentNodes.map(n => {
      const patch = updatesById.get(n.id)
      if (!patch) return n // preserve identity for untouched nodes
      // Shallow compare merged data vs existing to detect no-ops.
      const merged = { ...n.data, ...patch }
      let changed = false
      for (const k of Object.keys(patch)) {
        if ((n.data as any)?.[k] !== (merged as any)[k]) { changed = true; break }
      }
      if (!changed) return n
      changedCount += 1
      return { ...n, data: merged }
    })

    if (changedCount === 0) return { updatedCount: 0 }

    // UNLABELLED deliberately — `_sourceTag` is an internal tag, never user
    // copy, and this producer is not a user edit. See the interface note.
    // A labelled entry here surfaces in `useHistoryToast` verbatim.
    pushToHistory(get, set)
    set(() => ({ nodes: nextNodes }))
    // NOTE (freshness overlay): batchUpdateNodes is, today, exclusively the CEE
    // intervention-backfill producer (applyDraftResult / mirrorAnalysisReady). It
    // writes CEE's OWN analysis_ready data back onto option nodes for consistency
    // — NOT a user model edit — so it must NOT dirty/invalidate the freshness
    // verdict it was just ingested with (doing so wiped a fresh verdict). The
    // producer's real model change (the graph replace) is dirtied by
    // applyDraftResult/DraftChat. A future user-edit caller must route through
    // updateNode (gated by hasAnalyticalNodeChange) rather than dirtying here.
    return { updatedCount: changedCount }
  },

  updateEdge: (id, updates) => {
    const oldEdge = get().edges.find(e => e.id === id)
    pushToHistory(get, set)
    let confidenceChanged = false

    set((s) => {
      const touchedNodeIds = new Set(s.touchedNodeIds)

      const edges = s.edges.map(e => {
        if (e.id !== id) return e

        // Check if confidence changed
        const oldConfidence = e.data?.confidence
        const newConfidence = updates.data?.confidence

        // If confidence changed, mark source node as touched
        if (newConfidence !== undefined && oldConfidence !== newConfidence) {
          touchedNodeIds.add(e.source)
          confidenceChanged = true
        }

        // Merge updates, ensuring required EdgeData fields are preserved
        const updatedEdge: Edge<EdgeData> = {
          ...e,
          ...updates,
          data: updates.data ? { ...e.data, ...updates.data } : e.data
        }
        return updatedEdge
      })

      return { edges, touchedNodeIds }
    })

    if (oldEdge && hasAnalyticalEdgeChange(oldEdge, updates)) {
      invalidateAnalysisReady(get, set, `update_edge analytical field (${id})`)
    }

    // Phase 3: Re-validate graph when confidence changes to update ValidationPanel
    if (confidenceChanged) {
      // Debounce validation to avoid running on every keystroke
      setTimeout(() => get().validateGraph(), 100)
    }
  },

  updateEdgeData: (id, data) => {
    // Clamp weight to [0, 2] (UI domain) and belief to [0, 1]
    // Note: CEE expects strength in [-1, +1], adapter handles conversion
    const clampedData = {
      ...data,
      weight: data.weight !== undefined ? Math.max(0, Math.min(2, data.weight)) : undefined,
      belief: data.belief !== undefined ? Math.max(0, Math.min(1, data.belief)) : undefined
    }
    // Cast: updateEdge declares data: EdgeData but the implementation merges
    // partial-data updates (line 1405). Same partial-update contract observed
    // by every other call site that passes incomplete data.
    get().updateEdge(id, { data: clampedData as EdgeData })
  },

  onNodesChange: (changes) => {
    // Guard no-op changes
    if (!changes || changes.length === 0) return

    let acceptedChanges = changes

    // Only invalidate analysis_ready if deleted nodes are critical (goal, option, intervention targets)
    const removedChanges = changes.filter(c => c.type === 'remove')
    if (removedChanges.length > 0) {
      const deletedNodeIds = removedChanges.map(c => (c as { id: string }).id)
      // 0.48.0 — durable removal, path 5 of 6. React Flow's built-in delete
      // (default Backspace/Delete; no `deleteKeyCode` prop is set) removes nodes
      // through this handler, and its listener sits nearer the event target than
      // the app's window-level shortcut — so on a keypress this may well be the
      // path that actually runs. Incident edges are NOT enumerated: CEE's
      // `applyRemoveNode` owns that cascade. Recorded BEFORE the set() below,
      // against the pre-delete graph.
      const deleteAllowed = recordStructuralDeleteIntent(get, set, {
        nodeIds: deletedNodeIds,
        edgeIds: [],
      })
      if (!deleteAllowed) {
        acceptedChanges = changes.filter(c => c.type !== 'remove')
      } else {
        maybeInvalidateOnNodeDelete(get, set, deletedNodeIds)
      }
    }

    if (acceptedChanges.length === 0) return

    // Selection toggles are non-structural; skip history churn on pure select changes.
    const isSelectOnly = acceptedChanges.every(c => c.type === 'select' || c.type === 'dimensions')

    // Debounce history for drag operations
    const isDrag = acceptedChanges.some(c => c.type === 'position' && (c as any).dragging)

    const hasSelectChange = acceptedChanges.some(c => c.type === 'select')

    set((s) => {
      const updatedNodes = applyNodeChanges(acceptedChanges, s.nodes)

      let selection = s.selection

      // Reconcile Zustand selection (ids + anchor) from React Flow's `selected` flags
      // whenever a select change arrives. Single source of truth prevents drift.
      if (hasSelectChange) {
        const selectedNodes = updatedNodes.filter(n => n.selected)
        const nextNodeIds = new Set(selectedNodes.map(n => n.id))
        const selectedEdges = s.edges.filter(e => e.selected)
        const nextAnchor = computeAnchorPosition(updatedNodes, selectedNodes, selectedEdges)
        if (
          !setsEqual(nextNodeIds, selection.nodeIds)
          || nextAnchor?.x !== selection.anchorPosition?.x
          || nextAnchor?.y !== selection.anchorPosition?.y
        ) {
          selection = { ...selection, nodeIds: nextNodeIds, anchorPosition: nextAnchor }
        }
      }

      // Drag-tracking: single-selection anchor must follow the node position even
      // without a select change.
      if (isDrag && selection.nodeIds.size === 1) {
        const selectedId = selection.nodeIds.values().next().value as string | undefined
        if (selectedId) {
          const node = updatedNodes.find(n => n.id === selectedId)
          if (node) {
            const nodeWidth = node.measured?.width ?? node.width ?? 180
            const nodeHeight = node.measured?.height ?? node.height ?? 60
            selection = {
              ...selection,
              anchorPosition: {
                x: node.position.x + nodeWidth,
                y: node.position.y + nodeHeight / 2,
              },
            }
          }
        }
      }

      return { nodes: updatedNodes, selection }
    })

    if (isDrag) {
      scheduleHistoryPush(get, set)
    } else if (!isSelectOnly) {
      // Immediate push for structural changes (remove, add, replace, position commit)
      pushToHistory(get, set)
    }
  },

  onEdgesChange: (changes) => {
    // Guard no-op changes
    if (!changes || changes.length === 0) return

    let acceptedChanges = changes

    // Edge removals via React Flow's built-in delete (default deleteKeyCode =
    // Backspace/Delete) reach the store ONLY through this handler — they never go
    // through deleteEdgeById / deleteSelected. Route the removed edges through the
    // edge-delete chokepoint so they mark the freshness overlay dirty (and
    // invalidate readiness for critical edges), matching every other edge-delete
    // path. Resolve the removed edges from the PRE-change edge list.
    const removedEdgeChanges = changes.filter((c) => c.type === 'remove')
    if (removedEdgeChanges.length > 0) {
      const edgesBefore = get().edges
      // 0.48.0 — durable removal, path 6 of 6. The comment above is the reason
      // this line has to exist: built-in edge deletes reach the store ONLY here,
      // so without it the commonest keyboard gesture would stay local-only and
      // the connection would come back on the next re-run. Same tick as the node
      // half, so the two fold into ONE payload.
      const deleteAllowed = recordStructuralDeleteIntent(get, set, {
        nodeIds: [],
        edgeIds: removedEdgeChanges.map((c) => (c as { id: string }).id),
      })
      if (!deleteAllowed) {
        acceptedChanges = changes.filter(c => c.type !== 'remove')
      } else {
        for (const change of removedEdgeChanges) {
          const removed = edgesBefore.find((e) => e.id === (change as { id: string }).id)
          if (removed) maybeInvalidateOnEdgeDelete(get, set, removed)
        }
      }
    }

    if (acceptedChanges.length === 0) return

    const isSelectOnly = acceptedChanges.every(c => c.type === 'select')
    const hasSelectChange = acceptedChanges.some(c => c.type === 'select')

    set((s) => {
      const updatedEdges = applyEdgeChanges(acceptedChanges, s.edges) as Edge<EdgeData>[]
      let selection = s.selection
      if (hasSelectChange) {
        const selectedEdges = updatedEdges.filter(e => e.selected)
        const nextEdgeIds = new Set(selectedEdges.map(e => e.id))
        const selectedNodes = s.nodes.filter(n => n.selected)
        const nextAnchor = computeAnchorPosition(s.nodes, selectedNodes, selectedEdges)
        if (
          !setsEqual(nextEdgeIds, selection.edgeIds)
          || nextAnchor?.x !== selection.anchorPosition?.x
          || nextAnchor?.y !== selection.anchorPosition?.y
        ) {
          selection = { ...selection, edgeIds: nextEdgeIds, anchorPosition: nextAnchor }
        }
      }
      return { edges: updatedEdges, selection }
    })

    if (!isSelectOnly) {
      pushToHistory(get, set)
    }
  },

  onSelectionChange: ({ nodes, edges }) => {
    // Defensive backstop: onNodesChange/onEdgesChange already reconcile selection
    // from React Flow's `selected` flags. This handler covers paths where React Flow
    // invokes onSelectionChange without a matching change batch (rare, but guards
    // against upstream divergence).
    const newNodeIds = new Set(nodes.map(n => n.id))
    const newEdgeIds = new Set((edges as Edge<EdgeData>[]).map(e => e.id))

    const { selection, nodes: allNodes } = get()

    const nodeIdsChanged = !setsEqual(newNodeIds, selection?.nodeIds ?? new Set<string>())
    const edgeIdsChanged = !setsEqual(newEdgeIds, selection?.edgeIds ?? new Set<string>())
    if (!nodeIdsChanged && !edgeIdsChanged) return

    const anchorPosition = computeAnchorPosition(allNodes, nodes, edges as Edge<EdgeData>[])

    set({
      selection: { nodeIds: newNodeIds, edgeIds: newEdgeIds, anchorPosition },
    })
  },

  // Select a node without pushing to history (for focus/navigation)
  selectNodeWithoutHistory: (nodeId) => {
    const { nodes } = get()
    const node = nodes.find(n => n.id === nodeId)
    const anchorPosition = node ? computeAnchorPosition(nodes, [node], []) : null
    set(s => ({
      nodes: s.nodes.map(n => ({ ...n, selected: n.id === nodeId })),
      selection: { nodeIds: new Set([nodeId]), edgeIds: new Set(), anchorPosition },
    }))
  },

  selectEdgeWithoutHistory: (edgeId) => {
    set(s => {
      const edge = s.edges.find(e => e.id === edgeId)
      const anchorPosition = edge ? computeAnchorPosition(s.nodes, [], [edge]) : null
      return {
        nodes: s.nodes.map(n => ({ ...n, selected: false })),
        edges: s.edges.map(e => ({ ...e, selected: e.id === edgeId })),
        selection: { nodeIds: new Set(), edgeIds: new Set([edgeId]), anchorPosition },
      }
    })
  },

  // Select multiple nodes (for probability editor navigation)
  selectNodes: (nodeIds) => {
    set(s => {
      const selectedNodes = s.nodes.filter(n => nodeIds.includes(n.id))
      const anchorPosition = computeAnchorPosition(s.nodes, selectedNodes, [])
      return {
        nodes: s.nodes.map(n => ({ ...n, selected: nodeIds.includes(n.id) })),
        selection: { nodeIds: new Set(nodeIds), edgeIds: new Set(), anchorPosition },
      }
    })
  },

  // Clear all selection
  clearSelection: () => {
    set(s => ({
      nodes: s.nodes.map(n => ({ ...n, selected: false })),
      edges: s.edges.map(e => ({ ...e, selected: false })),
      selection: {
        nodeIds: new Set(),
        edgeIds: new Set(),
        anchorPosition: null,
      }
    }))
  },

  addEdge: (edge) => {
    // --- Structural guardrails (Brief: Graph Editing Experience Task 2b) ---
    const { nodes, edges } = get()
    const nodeIdSet = new Set(nodes.map(n => n.id))

    // Validate source/target nodes exist
    if (!nodeIdSet.has(edge.source)) {
      if (import.meta.env.DEV) console.warn(`[Canvas] addEdge: source node "${edge.source}" not found`)
      return { created: false, reason: 'node_not_found' as const }
    }
    if (!nodeIdSet.has(edge.target)) {
      if (import.meta.env.DEV) console.warn(`[Canvas] addEdge: target node "${edge.target}" not found`)
      return { created: false, reason: 'node_not_found' as const }
    }

    // Self-loop prevention
    if (isSelfLoop(edge.source, edge.target)) {
      return { created: false, reason: 'self_loop' as const }
    }

    // Duplicate edge prevention
    if (isDuplicateEdge(edges, edge.source, edge.target)) {
      return { created: false, reason: 'duplicate' as const }
    }

    // Cycle detection
    const nodeIds = nodes.map(n => n.id)
    if (wouldCreateCycle(nodeIds, edges, edge.source, edge.target)) {
      return { created: false, reason: 'cycle' as const }
    }

    // Edge limit check (PRD guardrail)
    const limitKind = wouldExceedLimits(nodes.length, edges.length, 0, 1, get().engineLimits)
    if (limitKind === 'edge_limit') {
      return { created: false, reason: 'edge_limit' as const }
    }

    // Build label from node labels for undo toast
    const sourceLabel = (nodes.find(n => n.id === edge.source)?.data as Record<string, unknown>)?.label as string ?? edge.source
    const targetLabel = (nodes.find(n => n.id === edge.target)?.data as Record<string, unknown>)?.label as string ?? edge.target
    pushToHistory(get, set, `Connected ${sourceLabel} \u2192 ${targetLabel}`)
    invalidateAnalysisReady(get, set, `add_edge (${edge.source} → ${edge.target})`)
    const id = get().createEdgeId()
    set((s) => {
      const touchedNodeIds = new Set(s.touchedNodeIds)

      // If edge has non-zero confidence, mark source node as touched
      if (edge.data?.confidence && edge.data.confidence > 0) {
        touchedNodeIds.add(edge.source)
      }

      return {
        edges: [...s.edges, { id, ...edge }],
        touchedNodeIds
      }
    })
    return { created: true }
  },

  pushHistory: (debounced = false) => {
    if (debounced) {
      clearTimers()
      historyTimer = setTimeout(() => pushToHistory(get, set), HISTORY_DEBOUNCE_MS)
      return
    }
    pushToHistory(get, set)
  },

  undo: () => {
    const { history, nodes, edges } = get()
    if (history.past.length === 0) return
    const prev = history.past[history.past.length - 1]
    const past = history.past.slice(0, -1)
    // Preserve label from the entry being undone so redo can show it
    const future = [{ nodes, edges, label: prev.label }, ...history.future]
    // Clear full readiness bundle + reset lens on undo (graph shape changed).
    // The freshness verdict is RETAINED across undo (intentionally not in
    // READINESS_CLEAR_FIELDS), so the reverted graph no longer matches it →
    // set the dirty overlay so a retained 'fresh' verdict shows cannot-confirm.
    logConstraintClearIfPresent(get, 'undo')
    // P0-1: the global goal-threshold scalar is NOT in the history snapshot
    // (only {nodes, edges, label}) and is NOT cleared by READINESS_CLEAR_FIELDS,
    // so without this it would survive a graph revert — e.g. set a 60% target
    // then Undo reverts the node but leaves goalThreshold=0.6, which the run path
    // still forwards to PLoT. Re-derive it from the reverted graph's goal node so
    // the scalar and the node stay in lockstep (an undo past the target-set
    // restores null).
    // 0.48.0 — a restore may not resurrect what the server durably deleted.
    // The snapshot predates the receipt, so it is filtered against it rather
    // than applied verbatim; `withholdDurableDeletions` is a no-op (a copy)
    // whenever nothing has been proven deleted, which is the common case.
    const guarded = withholdDurableDeletions(prev, get().durablyDeletedElements, { nodes, edges })
    const notice = buildDurableDeletionNotice('withheld', guarded, prev, nextDurableNoticeSeq())
    set({ nodes: guarded.nodes, edges: guarded.edges, history: { past, future }, ...READINESS_CLEAR_FIELDS, ...deriveGoalThresholdFromNode(guarded.nodes, get().outcomeNodeId), analysisFreshnessDirty: true, lens: createDefaultLensState(), durableDeletionNotice: notice })
    // Reset hash after undo
    const { nodes: newNodes, edges: newEdges } = get()
    set(() => ({ _internal: { lastHistoryHash: historyHash(newNodes, newEdges) } }))
  },

  redo: () => {
    const { history, nodes, edges } = get()
    if (history.future.length === 0) return
    const next = history.future[0]
    const past = [...history.past, { nodes, edges, label: next.label }]
    const future = history.future.slice(1)
    // Clear full readiness bundle + reset lens on redo (graph shape changed).
    // Verdict is retained → reapplied graph no longer matches it → dirty overlay.
    logConstraintClearIfPresent(get, 'redo')
    // P0-1: mirror undo — re-derive the goal-threshold scalar from the reapplied
    // graph's goal node so it cannot outlive the node it describes.
    // 0.48.0 — mirror of undo, and NOT defensive padding. `pushToHistory`
    // clears `future` on every mutation, so a future entry captured BEFORE a
    // durable delete is not reachable today; the guard is here so the invariant
    // is a property of history RESTORATION rather than of one direction, and so
    // a later change to the redo stack's lifecycle cannot quietly re-open the
    // defect on the other side.
    const guarded = withholdDurableDeletions(next, get().durablyDeletedElements, { nodes, edges })
    const notice = buildDurableDeletionNotice('withheld', guarded, next, nextDurableNoticeSeq())
    set({ nodes: guarded.nodes, edges: guarded.edges, history: { past, future }, ...READINESS_CLEAR_FIELDS, ...deriveGoalThresholdFromNode(guarded.nodes, get().outcomeNodeId), analysisFreshnessDirty: true, lens: createDefaultLensState(), durableDeletionNotice: notice })
    // Reset hash after redo
    const { nodes: newNodes, edges: newEdges } = get()
    set(() => ({ _internal: { lastHistoryHash: historyHash(newNodes, newEdges) } }))
  },

  canUndo: () => get().history.past.length > 0,
  canRedo: () => get().history.future.length > 0,

  deleteSelected: () => {
    const { selection, outcomeNodeId, edges, ceeAnalysisReady } = get()
    const count = selection.nodeIds.size + selection.edgeIds.size
    if (count === 0) return
    // Gate before history, invalidation or local removal. With a canonical
    // scenario but no current server hash, every delete entry point must fail
    // closed rather than create a canvas state reload will resurrect.
    if (!recordStructuralDeleteIntent(get, set, {
      nodeIds: selection.nodeIds,
      edgeIds: selection.edgeIds,
    })) return
    pushToHistory(get, set, `Deleted ${count} element${count !== 1 ? 's' : ''}`)
    // P0.5 Fix: Clear outcomeNodeId if the outcome node is being deleted
    const shouldClearOutcome = outcomeNodeId && selection.nodeIds.has(outcomeNodeId)

    // Collect edges being deleted for invalidation check
    const deletedEdges = edges.filter(
      e => selection.edgeIds.has(e.id) ||
           selection.nodeIds.has(e.source) ||
           selection.nodeIds.has(e.target)
    )

    // 0.48.0 — durable removal. ONE intent for the whole multi-select: a node
    // removal takes its incident edges with it, so splitting this into per-
    // element turns would open a dangling-edge window the contract forbids.
    // Before the removal set(), against the graph the user was looking at.
    set((s) => {
      const remaining = s.nodes.filter(n => !selection.nodeIds.has(n.id))
      const newOutcomeId = shouldClearOutcome ? null : s.outcomeNodeId
      return {
        nodes: remaining,
        edges: s.edges.filter(e => !selection.nodeIds.has(e.source) && !selection.nodeIds.has(e.target) && !selection.edgeIds.has(e.id)),
        selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
        outcomeNodeId: newOutcomeId,
        // P0-1 (external review): re-derive the goal-threshold scalar from the
        // remaining graph so a deleted goal's target can't ride the next run
        // (deleting targeted Goal A previously left goalThreshold=60).
        ...deriveGoalThresholdFromNode(remaining, newOutcomeId),
      }
    })

    // Local dirty overlay: any structural removal here (node and/or edge,
    // critical or not) makes a retained 'fresh' verdict no-longer-confirmable.
    // The ceeAnalysisReady invalidation below keeps its existing critical-gating;
    // this only sets the dirty flag and also covers the edge-only branch that is
    // otherwise gated on ceeAnalysisReady being present.
    if (selection.nodeIds.size > 0 || deletedEdges.length > 0) {
      markAnalysisFreshnessDirty(get, set)
    }

    // Check node deletions for invalidation
    if (selection.nodeIds.size > 0) {
      maybeInvalidateOnNodeDelete(get, set, [...selection.nodeIds])
    } else if (ceeAnalysisReady) {
      // Check if any deleted edges connect critical nodes (only if no nodes were deleted)
      for (const edge of deletedEdges) {
        if (shouldInvalidateOnEdgeDelete(edge, ceeAnalysisReady)) {
          invalidateAnalysisReady(get, set, `Deleted edge connecting critical nodes: ${edge.source} → ${edge.target}`)
          break
        }
      }
    }
  },

  deleteNodeById: (nodeId: string) => {
    const node = get().nodes.find(n => n.id === nodeId)
    if (!node) return
    if (!recordStructuralDeleteIntent(get, set, { nodeIds: [nodeId], edgeIds: [] })) return
    const nodeLabel = (node.data as Record<string, unknown>)?.label as string ?? nodeId
    pushToHistory(get, set, `Deleted ${nodeLabel}`)
    const { outcomeNodeId } = get()
    // P0.5 Fix: Clear outcomeNodeId if this is the outcome node
    const shouldClearOutcome = outcomeNodeId === nodeId
    // 0.48.0 — durable removal, before the removal set(). Incident edges are
    // NOT enumerated: CEE's `applyRemoveNode` owns that cascade.
    set((s) => {
      const remaining = s.nodes.filter(n => n.id !== nodeId)
      const newOutcomeId = shouldClearOutcome ? null : s.outcomeNodeId
      return {
        nodes: remaining,
        edges: s.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
        // Clear selection if deleted node was selected
        selection: s.selection.nodeIds.has(nodeId)
          ? { ...s.selection, nodeIds: new Set([...s.selection.nodeIds].filter(id => id !== nodeId)) }
          : s.selection,
        outcomeNodeId: newOutcomeId,
        // P0-1 (external review): re-derive the goal-threshold scalar from the
        // remaining graph so a deleted goal's target can't ride the next run.
        ...deriveGoalThresholdFromNode(remaining, newOutcomeId),
      }
    })

    // Invalidate analysis_ready if deleted node is critical
    maybeInvalidateOnNodeDelete(get, set, [nodeId])
  },

  deleteEdgeById: (edgeId: string) => {
    const { edges } = get()
    const edge = edges.find(e => e.id === edgeId)
    if (!edge) return

    // 0.48.0 — durable removal, addressed by the canonical (from, to) pair.
    if (!recordStructuralDeleteIntent(get, set, { nodeIds: [], edgeIds: [edgeId] })) return
    pushToHistory(get, set, 'Deleted connection')
    set((s) => ({
      edges: s.edges.filter(e => e.id !== edgeId),
      // Clear selection if deleted edge was selected
      selection: s.selection.edgeIds.has(edgeId)
        ? { ...s.selection, edgeIds: new Set([...s.selection.edgeIds].filter(id => id !== edgeId)) }
        : s.selection
    }))

    // Invalidate analysis_ready if edge connected critical nodes
    maybeInvalidateOnEdgeDelete(get, set, edge)
  },

  duplicateSelected: () => {
    const count = get().selection.nodeIds.size
    pushToHistory(get, set, `Duplicated ${count} element${count !== 1 ? 's' : ''}`)
    const { nodes, edges, selection } = get()
    const selectedNodes = nodes.filter(n => selection.nodeIds.has(n.id))
    if (selectedNodes.length === 0) return

    const idMap: Record<string, string> = {}
    const newNodes: Node[] = []
    
    selectedNodes.forEach(node => {
      const newId = get().createNodeId()
      idMap[node.id] = newId
      newNodes.push({
        ...node,
        id: newId,
        position: { x: node.position.x + 50, y: node.position.y + 50 },
        data: { ...node.data }
      })
    })

    const selectedEdges = edges.filter(e => selection.nodeIds.has(e.source) && selection.nodeIds.has(e.target))
    const newEdges: Edge<EdgeData>[] = selectedEdges.map(edge => ({
      ...edge,
      id: get().createEdgeId(),
      source: idMap[edge.source],
      target: idMap[edge.target]
    }))

    set((s) => ({
      nodes: [...s.nodes, ...newNodes],
      edges: [...s.edges, ...newEdges],
      selection: { nodeIds: new Set(newNodes.map(n => n.id)), edgeIds: new Set(), anchorPosition: null }
    }))
    invalidateAnalysisReady(get, set, `duplicate_selected (${newNodes.length} nodes)`)
  },

  copySelected: () => {
    const { nodes, edges, selection } = get()
    const selectedNodes = nodes.filter(n => selection.nodeIds.has(n.id))
    const selectedEdges = edges.filter(e => selection.nodeIds.has(e.source) && selection.nodeIds.has(e.target))
    set({ clipboard: { nodes: selectedNodes, edges: selectedEdges } })
  },

  pasteClipboard: () => {
    const { clipboard } = get()
    if (!clipboard || clipboard.nodes.length === 0) return

    pushToHistory(get, set, `Pasted ${clipboard.nodes.length} element${clipboard.nodes.length !== 1 ? 's' : ''}`)
    const idMap: Record<string, string> = {}
    const newNodes: Node[] = []

    clipboard.nodes.forEach(node => {
      const newId = get().createNodeId()
      idMap[node.id] = newId
      newNodes.push({
        ...node,
        id: newId,
        position: { x: node.position.x + 50, y: node.position.y + 50 },
        data: { ...node.data }
      })
    })

    const newEdges: Edge<EdgeData>[] = clipboard.edges.map(edge => ({
      ...edge,
      id: get().createEdgeId(),
      source: idMap[edge.source],
      target: idMap[edge.target]
    }))

    set((s) => ({
      nodes: [...s.nodes, ...newNodes],
      edges: [...s.edges, ...newEdges],
      selection: { nodeIds: new Set(newNodes.map(n => n.id)), edgeIds: new Set(), anchorPosition: null }
    }))
    invalidateAnalysisReady(get, set, `paste_clipboard (${newNodes.length} nodes)`)
  },

  cutSelected: () => {
    // Atomic operation: copy + delete in single history frame
    // This prevents double-frame if copySelected ever mutates in future
    const { nodes, edges, selection, ceeAnalysisReady } = get()
    const selectedNodes = nodes.filter(n => selection.nodeIds.has(n.id))
    const selectedEdges = edges.filter(e => selection.nodeIds.has(e.source) && selection.nodeIds.has(e.target))

    // Collect all edges being deleted (by node or by direct selection)
    const deletedEdges = edges.filter(
      e => selection.edgeIds.has(e.id) ||
           selection.nodeIds.has(e.source) ||
           selection.nodeIds.has(e.target)
    )

    // Push history once before mutation
    pushToHistory(get, set)

    // Set clipboard and delete in same transaction
    set((s) => ({
      clipboard: { nodes: selectedNodes, edges: selectedEdges },
      nodes: s.nodes.filter(n => !selection.nodeIds.has(n.id)),
      edges: s.edges.filter(e => !selection.nodeIds.has(e.source) && !selection.nodeIds.has(e.target) && !selection.edgeIds.has(e.id)),
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null }
    }))

    // Local dirty overlay: mirror deleteSelected — any structural removal marks
    // the retained verdict no-longer-confirmable, independent of critical-gating.
    if (selection.nodeIds.size > 0 || deletedEdges.length > 0) {
      markAnalysisFreshnessDirty(get, set)
    }

    // Mirror deleteSelected invalidation: check nodes first, then edges
    if (selection.nodeIds.size > 0) {
      maybeInvalidateOnNodeDelete(get, set, [...selection.nodeIds])
    } else if (ceeAnalysisReady) {
      for (const edge of deletedEdges) {
        if (shouldInvalidateOnEdgeDelete(edge, ceeAnalysisReady)) {
          invalidateAnalysisReady(get, set, `cut_edge connecting critical nodes: ${edge.source} → ${edge.target}`)
          break
        }
      }
    }
  },

  selectAll: () => {
    const { nodes, edges, history, _internal } = get()

    // Save current state to history BEFORE selection (if hash matches last save)
    // This ensures undo will work after delete-all
    const currentHash = historyHash(nodes, edges)

    // If hash matches, no structural changes happened since last push
    // But we're about to modify selection, so save current state first
    // This enables: selectAll → delete → undo to work
    if (_internal.lastHistoryHash === currentHash) {
      const cleanNodes = nodes.map(n => ({ ...n, selected: undefined }))
      const cleanEdges = edges.map(e => ({ ...e, selected: undefined }))
      const past = [...history.past, { nodes: cleanNodes, edges: cleanEdges }].slice(-MAX_HISTORY)

      // Mark hash as "dirty" so next operation (like delete) will push
      set({
        history: { past, future: [] },
        _internal: { lastHistoryHash: '' }
      })
    }

    // Set selected: true on all nodes and edges so React Flow shows them as selected
    const updatedNodes = nodes.map(n => ({ ...n, selected: true }))
    const updatedEdges = edges.map(e => ({ ...e, selected: true }))
    set({
      nodes: updatedNodes,
      edges: updatedEdges,
      selection: {
        nodeIds: new Set(nodes.map(n => n.id)),
        edgeIds: new Set(edges.map(e => e.id)),
        anchorPosition: null, // No single anchor when all selected
      }
    })
  },

  nudgeSelected: (dx, dy) => {
    const { selection } = get()
    if (selection.nodeIds.size === 0) return

    // On first nudge in burst, push current state to history
    // Subsequent nudges within 500ms window won't push (coalesced into single undo frame)
    if (!nudgeTimer) {
      pushToHistory(get, set)
    }

    // Apply nudge immediately (responsive)
    set((s) => ({
      nodes: s.nodes.map(n => 
        selection.nodeIds.has(n.id)
          ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
          : n
      )
    }))

    // Reset debounce timer: if 500ms passes without another nudge, burst is complete
    if (nudgeTimer) clearTimeout(nudgeTimer)
    nudgeTimer = setTimeout(() => {
      nudgeTimer = null
    }, 500)
  },

  saveSnapshot: () => {
    const { nodes, edges } = get()
    return persistSnapshot({ nodes, edges })
  },

  importCanvas: (json: string) => {
    const imported = persistImport(json)
    if (!imported) return false

    // Interim 2.467: record this graph's identity as imported-and-unregistered
    // BEFORE the set below, in a TAB-scoped marker. This is what survives a
    // page reload — the autosave puts the imported graph back on the canvas
    // ~0.5 s later, and the hold has to come back with it.
    markGraphImported(imported.nodes, imported.edges)

    // Clear history since this is a full import
    clearTimers()
    
    // Reseed IDs to avoid collisions
    get().reseedIds(imported.nodes, imported.edges)
    
    set({
      nodes: imported.nodes,
      edges: imported.edges,
      // Wave F-A: full graph replacement starts a fresh ordinal history
      optionNumbering: {},
      history: { past: [], future: [] },
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
      showDraftChat: false,
      currentBriefText: null,
      draftComposerText: null,
      // Full graph replaced on import — clear the freshness verdict (it described
      // the previous graph; never carry it onto an imported model) and its dirty
      // overlay (no pending edit applies to a brand-new graph).
      analysisFreshness: null,
      analysisFreshnessDirty: false,
      // ROADMAP 2.1163 / EXT-2: a refusal describes ONE turn against ONE model.
      // Carrying it across an import/reset/scenario switch would claim a refusal
      // that never happened for the model now on the canvas.
      analysisRefusalNotice: null,
      // Step 5 — same argument, and it matters more here because this verdict
      // OUTRANKS the local derivations: carrying a composed verdict across an
      // import/reset/scenario switch would let CEE's statement about the
      // PREVIOUS model silently govern what may be said about this one.
      analysisStateV1: null,
      // Interim 2.467 mitigation (P0 trust, rewalk-2459b attempt 2): an import
      // must never leave a pre-import analysis renderable-as-current. The
      // pre-import results re-bound BY NODE ID to the imported graph's labels
      // and rendered as if computed on it — clear the ENTIRE analysis-results
      // cluster (mirrors resetCanvas's results block) so no pre-import row
      // survives to re-bind. The imported graph has never been analysed.
      previousReport: null,
      results: { status: 'idle', progress: 0 },
      runMeta: {},
      hasCompletedFirstRun: false,
      graphEditedSinceLastRun: false,
      analysisStateReady: false,
      rawV2Response: null,
      v5AnalysisFact: null,
      ceePipelineTrace: null,
      ceeQuality: null,
      nodeRationales: {},
      ceeExtendedWarnings: null,
      ceeGoalConnectivity: null,
      ceeModelQualityFactors: null,
      ceeInterventionHints: null,
      preAnalysisSensitivity: null,
      graphHealth: null,
      needleMovers: [],
      lastAnalysisSeed: null,
      lastQualityMode: null,
      repairsApplied: null,
      hoveredOptionId: null,
      // Interim 2.467: the server has never seen this graph (an import is
      // client-side only). While set, the freshness machinery holds the dirty
      // overlay so a rerun's server 'fresh' verdict — computed against CEE's
      // own pre-import graph — can never display as the affirmative. The
      // marker is written just below, BEFORE this set is observed, so every
      // later graph-replacement site can re-derive the flag from the graph it
      // installs (including after a page reload). See the field's doc.
      importPendingServerRegistration: true,
      // Lane 5 (Codex P0-2): a full import is a new decision context — clear the
      // target, its representation, readiness and outcome selection so the
      // imported model never runs against the previous decision's goal state.
      ...DECISION_CONTEXT_CLEAR,
      // Review fold: re-derive the outcome selection to the imported graph's
      // own goal node (the DECISION_CONTEXT_CLEAR null is overridden here).
      outcomeNodeId: firstGoalNodeId(imported.nodes),
      // Graph Lens: auto-reset on canvas import (full graph replaced)
      lens: createDefaultLensState(),
    })
    // Historical behaviour: importCanvas cleared only the three model-selection
    // fields. Preserving that narrow reset (not full resetDraft, which would also
    // clear lastDraftError, lastDraftDescription, isGenerating, fullDraftAppliedAt).
    useDraftStore.getState().resetAllModels()
    // Interim 2.467: Compare-tab snapshots and comparison mode hold the
    // pre-import analysis too (same re-bind class) — clear both, exactly as
    // loadScenario/resetCanvas do at their graph-replacement boundaries.
    useAnalysisSnapshotStore.getState().clearSnapshots()
    useComparisonStore.getState().resetComparison()

    return true
  },

  exportCanvas: () => {
    const { nodes, edges } = get()
    return persistExport({ nodes, edges })
  },

  applyLayout: async (opts) => {
    // Pre-await guard for explicit (auto-triggered) callers: if the rid
    // they captured before measurement no longer matches the store's
    // latest, a newer setPendingLayout(true) has already superseded this
    // request. Drop before doing any work.
    if (opts?.requestId !== undefined && opts.requestId !== get().layoutRequestId) {
      return { laidOut: false }
    }

    // Re-entry guard + synchronous claim. The claim must happen IN THE
    // SAME SYNCHRONOUS TICK as the guard read — otherwise a second call
    // entering during the dynamic-import yield below would pass the guard
    // before either had marked layoutInProgress=true (e.g. user clicks
    // "Re-layout" twice within a microtask, or two call sites trigger in
    // the same tick). Without this, both calls would push history, run
    // layoutGraph, and commit — double-bumping layoutVersion.
    // ⚠ ALSO A 'LAID NOTHING OUT' EXIT. The review named the pre-await and
    // post-await guards; this re-entry guard is the third, and it resolves the
    // same way — silently, having committed nothing.
    if (get().layoutInProgress) return { laidOut: false }
    set({ layoutInProgress: true })

    // Capture the layout generation we're committing against. Taken AFTER
    // the synchronous claim so the snapshot reflects the rid that is in
    // play for this run. Used by the post-await commit guard for both
    // manual calls (no opts.requestId) and auto-triggered scoped calls.
    const startGen = get().layoutRequestId
    const isCurrentGen = () => get().layoutRequestId === startGen

    try {
      const { nodes, edges } = get()

      // Auto-triggered layouts skip pushHistory because the call site has
      // already pushed history immediately before inserting the unlaid-out
      // graph. A second push here would create an awkward intermediate undo
      // state ("graph at 0,0"). Manual triggers (toolbar, /command) keep
      // history pushing for explicit-relayout undo semantics.
      if (!opts?.skipHistory) {
        pushToHistory(get, set)
      }

      // Dynamic import to avoid bundling ELK if not used. Inside the try
      // so the finally block clears layoutInProgress even if the import
      // itself fails (network, module corruption).
      const { layoutGraph } = await import('./utils/layout')
      const { useLayoutStore } = await import('./layoutStore')
      const { measureNodeHeightsAtLabelBound } = await import('./utils/measureNodeHeightsAtLabelBound')
      const layoutOptions = useLayoutStore.getState()

      // ⭐ MEASURED BEFORE THE AWAIT-FREE WINDOW CLOSES, and at the counter-scale
      // BOUND rather than at today's zoom. `node.measured.height` is a function
      // of the live zoom (`--canvas-label-scale` multiplies the canvas type
      // tokens), so a stride computed from it is correct at one zoom and wrong
      // at every other — measured ×2.05 between zoom 1.0 and 0.5, and witnessed
      // as 13 overlapping pairs that survive a reload. See
      // `utils/measureNodeHeightsAtLabelBound.ts`.
      //
      // ⭐ THIS IS NOT A RUNTIME INPUT — IT REMOVES ONE. Ruling R1 says the
      // canonical layout has no viewport input; today it has a hidden one, the
      // zoom, arriving through `measured.height`. Measuring at a CONSTANT scale
      // makes two layouts of the same graph at different zooms identical.
      const heightAtLabelBound = measureNodeHeightsAtLabelBound()

      // No canvas/viewport argument, deliberately: the canonical layout has no
      // runtime input (founder ruling R1). See `utils/layout.ts`'s header.
      const { nodes: layoutedNodes, layoutNodeWidth } = await layoutGraph(
        nodes,
        edges,
        {
          direction: layoutOptions.direction,
          spacing: layoutOptions.nodeSpacing,
          layerSpacing: layoutOptions.layerSpacing,
          preserveLocked: layoutOptions.respectLocked,
          heightAtLabelBound,
        }
      )

      // Post-await commit guard. The awaits above are an async window during
      // which the store's nodes/edges can change (a new draft, patch, or
      // import). If layoutRequestId bumped while we were running, our
      // layoutedNodes are computed from a stale snapshot — committing them
      // would full-replace the live nodes array and lose any nodes added in
      // the gap. Skip the commit and leave pendingLayout=true so the
      // measurement effect picks up the newer request once layoutInProgress
      // flips false in finally.
      //
      // This guard fires for manual calls too (no opts.requestId): the
      // generation snapshot above captures the rid at start regardless of
      // whether the caller passed one.
      if (!isCurrentGen()) return { laidOut: false }

      layoutOptions.setLayoutNodeWidth(layoutNodeWidth)
      set({
        nodes: layoutedNodes,
        layoutVersion: get().layoutVersion + 1,
        pendingLayout: false,
        // Recorded in the SAME set() as the version bump, so the fit trigger
        // that reads it on the next frame cannot observe a version from this
        // layout beside an initiator from the previous one.
        lastLayoutInitiatedBy: opts?.initiatedBy ?? 'user',
      })
      return { laidOut: true }
    } catch (err) {
      console.error('[CANVAS] Layout failed:', err)
      // ⭐⭐ THE RESCUE REMOVES THIS DEFECT'S ONLY LOUD SIGNAL, SO IT MUST ADD ONE.
      //
      // Before the grid below existed, a failed layout announced itself with an
      // unusable canvas — which is plausibly the only reason this was ever
      // reported at all. Afterwards it is a tidy grid and a small banner. The
      // failure is INTERMITTENT (an independent journey drive on the same base
      // produced a perfectly healthy canvas) and its root cause has never been
      // captured, so trading away the loudness without a durable sink would make
      // an elusive defect harder to diagnose, not easier.
      //
      // ⚠ NOTHING ELSE ON THIS PATH REACHES A SINK. `console.error` is the tab's
      // console. `handleLayoutWithRecovery`'s `console.warn` is DEV-only and it
      // SWALLOWS the rejection, so `main.tsx`'s `unhandledrejection` never fires
      // — and that only pushes to an in-memory array. `captureError` is the one
      // real sink, and `store.ts` did not import it.
      //
      // ⚠ NOT `captureErrorDetail`. That is a DIFFERENT symbol in this file — a
      // client-side ring buffer, not the Sentry sink — and a `captureError` grep
      // here matches it. Two names, one prefix, different destinations.
      //
      // ⚠⚠ AND THE SINK IS NOT LIVE ON STAGING YET — measured at the DEPLOYED
      // BYTES (26 Aug 2026), not inferred from YAML. The staging bundle inlines
      // `VITE_SENTRY_DSN: void 0`, and `resolveMonitoringConfig` computes
      // `sentry: isProdLike && !!dsn`, so this call currently falls to
      // `logger.error('[Monitoring] Error (Sentry disabled): …')` — a console
      // line, not a sink. `MODE` is already `"production"` there, so the DSN is
      // the ONLY missing half. The wiring is correct and starts reporting the
      // moment the variable is set; until then this is the APPEARANCE of
      // observability, and saying so here is the point — a later reader must not
      // inherit "we capture layout failures" as a fact about staging.
      // (Probe was contrast-controlled: the same chunk carries a baked
      // `supabase.co` value and the `[Monitoring] Error (Sentry disabled)`
      // string, so a zero for the DSN is a measurement, not a blind spot.)
      //
      // Context is a COUNT and an IDENTITY, never labels or values: enough to
      // tell a one-node blip from a whole model and to correlate with a
      // scenario, without putting the user's business content into monitoring.
      captureError(err instanceof Error ? err : new Error(String(err)), {
        label: 'canvas.layout.failed',
        nodeCount: get().nodes.length,
        scenarioId: get().currentScenarioId ?? undefined,
      })
      // Clear pendingLayout on failure so the measurement effect does not
      // retrigger when layoutInProgress flips false (would be an infinite
      // retry loop). BUT only if the generation hasn't changed — if a
      // newer request superseded us, leave pendingLayout=true so the
      // newer request runs.
      if (isCurrentGen()) {
        // ⭐⭐ LEAVE A READABLE GRAPH, NOT AN ORIGIN STACK.
        //
        // Until this existed the catch touched NO coordinates, and
        // `applyDraftResult` seeds every drafted node at `{x:0, y:0}` (its sole
        // `position` write) — so any rejection left the user with every node
        // piled on one point under a "Layout failed" banner. Witnessed on a
        // fresh fundraising brief, with the canvas at 328% zoom because the
        // product's own fit never runs without a successful layout and the bare
        // mount `fitView` is bounded only by the instance's `maxZoom={4}`.
        //
        // ⚠ `layoutVersion` IS DELIBERATELY NOT BUMPED. That counter means "the
        // product laid this graph out and owns the camera for it". A grid is a
        // rescue, not a layout, and bumping it would make the error path claim
        // a quality it did not deliver — while also firing the LAYOUT camera
        // trigger, whose contract is "a layout just completed".
        //
        // The camera still gets aimed, and without weakening any guard: with
        // real positions and `pendingLayout` false, the hook's RESTORE trigger
        // becomes eligible on its own terms — it refuses an origin stack
        // through `graphNeedsInitialLayout`, which is exactly what the grid
        // defeats. Breaking the stack is the whole mechanism.
        //
        // `placeNodesDeterministically` returns its input BY REFERENCE when the
        // graph does not need rescuing, so a failure on an already-laid-out
        // graph changes nothing at all.
        const before = get().nodes
        const rescued = placeNodesDeterministically(before)
        set({ pendingLayout: false, nodes: rescued })
        // ⚠ THE RESCUE MUST NOT MAKE THE FAILURE HARDER TO SEE. The banner still
        // fires (this catch rethrows, and `handleLayoutWithRecovery` surfaces
        // it), but the banner is transient and the canvas now looks fine — so
        // an intermittent failure would leave no trace an operator could count.
        // `rescued !== before` is a by-reference comparison: the placement
        // returns its input unchanged when the graph did not need rescuing, so
        // this reports whether coordinates actually moved, not merely that the
        // catch ran.
        trackLayoutFallbackApplied(before.length, rescued !== before)
      }
      // Rethrow so callers can provide user-facing error feedback
      throw err
    } finally {
      set({ layoutInProgress: false })
    }
  },

  applySimpleLayout: (preset, spacing) => {
    const { nodes, edges, selection } = get()
    
    if (nodes.length < 2) {
      return // Nothing to layout
    }
    
    // Convert nodes to layout format
    const layoutNodes = nodes.map(n => ({
      id: n.id,
      width: n.width || 200,
      height: n.height || 80,
      locked: selection.nodeIds.has(n.id) // Preserve selected nodes
    }))
    
    const layoutEdges = edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target
    }))
    
    // Apply layout
    const result = applyLayout(layoutNodes, layoutEdges, {
      preset,
      spacing,
      preserveSelection: false,
      minimizeCrossings: true
    })
    
    // Push to history before applying
    pushToHistory(get, set)
    
    // Update node positions
    const updatedNodes = nodes.map(node => {
      const newPos = result.positions[node.id]
      return newPos ? { ...node, position: newPos } : node
    })
    
    set({ nodes: updatedNodes })
  },

  applyGuidedLayout: (policy) => {
    const { nodes, edges } = get()
    
    if (nodes.length < 2) {
      return
    }
    
    const effectivePolicy = mergePolicy(policy)
    
    // Convert to layout format with semantic node types
    const layoutNodes = nodes.map(n => ({
      id: n.id,
      kind: (n.type || 'decision') as 'goal' | 'decision' | 'option' | 'risk' | 'outcome',
      width: n.width || 200,
      height: n.height || 80,
      locked: effectivePolicy.respectLocked && Boolean(n.data?.locked)
    }))
    
    const layoutEdges = edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target
    }))
    
    // Apply semantic layout with full policy support
    const result = applyLayoutWithPolicy(
      layoutNodes,
      layoutEdges,
      {
        preset: policyToPreset(effectivePolicy),
        spacing: policyToSpacing(effectivePolicy),
        preserveSelection: false,
        minimizeCrossings: true
      },
      effectivePolicy
    )
    
    pushToHistory(get, set)
    
    const updatedNodes = nodes.map(node => {
      const newPos = result.positions[node.id]
      return newPos ? { ...node, position: newPos } : node
    })
    
    set({ nodes: updatedNodes })
  },

  resetCanvas: () => {
    // ── "Start fresh" must be fresh on the NEXT LOAD too ────────────────────
    // Measured defect (link-track item 4c): resetCanvas cleared in-memory state
    // and `currentScenarioId`, but left `olumi-canvas-autosave` and
    // `olumi-canvas-transcript` on disk. The production boot arbiter in
    // ReactFlowGraph then reads `autosave && !scenario` — the exact state a
    // reset produces — and takes the `loadSource = 'autosave'` branch
    // unconditionally, with no age cap and no fresh-entry test. So the previous
    // model came back on the next page load, announced by
    // "Recovered unsaved changes from your last session." A demo that starts
    // over is the case that matters: the operator sees someone else's model.
    //
    // `clearTranscript`'s own docstring already reads "(scenario deleted /
    // canvas reset)" and it had ZERO production call sites — the wiring was
    // designed and never done, which is why nothing went red.
    //
    // Ordering is load-bearing: the transcript file is keyed BY SCENARIO ID, so
    // it must be read before `clearCurrentScenarioId()` discards the key.
    // ⚠ A SAVED DECISION'S CONVERSATION IS NOT THIS COMMAND'S TO DESTROY.
    // `getCurrentScenarioId()` can hold a SAVED record's id — `loadScenario`
    // writes one, and so does `createScenario` via `saveCurrentScenario`, and the
    // ScenarioSwitcher is mounted in both the toolbar and the top bar. Clearing
    // unconditionally meant: save a decision → "Start fresh" → the graph RECORD
    // survives and its conversation is gone, so re-opening it shows the model
    // beside an empty chat. That is precisely the defect `transcriptStore`'s own
    // header was written to fix, re-created by the fix for a different one.
    //
    // "Start fresh" is about the WORKING CANVAS. The unsaved autosave is working
    // state and is cleared; a saved record's transcript belongs to the record and
    // is left alone. Only an UNSAVED decision's transcript is discarded, which is
    // the demo-hazard case this item exists for.
    const scenarioIdBeingReset = scenarios.getCurrentScenarioId()
    const isSavedRecord = scenarioIdBeingReset
      ? scenarios.getScenario(scenarioIdBeingReset) !== undefined
      : false
    scenarios.clearAutosave()
    if (!isSavedRecord) clearTranscript(scenarioIdBeingReset)

    const { nodes, edges } = get()
    if (nodes.length === 0 && edges.length === 0) {
      // Lane 5 (Codex P0-2): the graph is already empty, but a previous
      // decision's threshold / readiness / outcome can still be in the store
      // (e.g. "start fresh" right after loading a decision) — clearing them
      // only inside the set() below meant an empty-graph reset LEAKED them
      // into the next decision's runs. Clear the decision context here too.
      // (The scenario-keyed success measure needs no clear: its only wire
      // influence is the unit cap, which resolveMeasureUnitCap gates on
      // measure.threshold === store.goalThreshold — nulling the threshold
      // breaks that, so a leaked measure can't cap a cleared value.)
      // Interim 2.467 — release. ⚠ NOT derived, and the earlier "derived, never
      // a hardcoded false" framing was decorative HERE: this branch runs only
      // under `nodes.length === 0 && edges.length === 0` (the guard above), and
      // `graphImportDigest` returns null for an empty graph, so the derivation
      // would be constant `false`. Written as the literal it provably is. The
      // COUPLING is what matters: it is the empty-graph null rule (pinned by
      // its own test) that makes this safe — break that rule and this line
      // becomes wrong, silently.
      set({ ...DECISION_CONTEXT_CLEAR, importPendingServerRegistration: false })
      return
    }

    pushToHistory(get, set)

    // Clear current scenario ID - user is starting fresh, not editing old scenario
    scenarios.clearCurrentScenarioId()

    set({
      // Clear graph
      nodes: [],
      // Wave F-A: fresh decision, fresh option-ordinal history
      optionNumbering: {},
      edges: [],
      touchedNodeIds: new Set(),
      nextNodeId: 1,
      nextEdgeId: 1,
      // Clear CEE analysis_ready payload, pipeline trace and quality.
      // (ceeAnalysisReady, ceeAnalysisReadyNodeIds, goalConstraints and
      // lastAuthoritativeGraph are all cleared via DECISION_CONTEXT_CLEAR
      // below — Lane 5, extended by B2/B3. They are deliberately NOT repeated
      // here: the duplicate keys this file used to carry were dead weight
      // that only agreed with the spread by coincidence.)
      analysisFreshness: null,
      analysisFreshnessDirty: false,
      // ROADMAP 2.1163 / EXT-2: a refusal describes ONE turn against ONE model.
      // Carrying it across an import/reset/scenario switch would claim a refusal
      // that never happened for the model now on the canvas.
      analysisRefusalNotice: null,
      // Step 5 — same argument, and it matters more here because this verdict
      // OUTRANKS the local derivations: carrying a composed verdict across an
      // import/reset/scenario switch would let CEE's statement about the
      // PREVIOUS model silently govern what may be said about this one.
      analysisStateV1: null,
      // Interim 2.467 — release. ⚠ NOT derived (same correction as the
      // empty-graph branch above): resetCanvas installs an EMPTY graph, for
      // which the digest is null by the empty-graph rule, so a derivation here
      // is constant `false`. Stated as the literal it is; the empty-graph rule
      // is what keeps it correct.
      importPendingServerRegistration: false,
      // V5 canonical analysis fact — clear on scenario reset (the fact does
      // not survive a graph reset; rerun analysis to mint a fresh one).
      v5AnalysisFact: null,
      draftCoaching: null,
      ceePipelineTrace: null,
      nodeRationales: {},
      ceeQuality: null,
      // Phase 1b: Clear extended CEE data
      ceeExtendedWarnings: null,
      ceeGoalConnectivity: null,
      ceeModelQualityFactors: null,
      ceeInterventionHints: null,
      preAnalysisSensitivity: null,
      // Clear results and analysis state
      previousReport: null, // A1: Clear stale deltas on canvas reset
      results: { status: 'idle', progress: 0 },
      // Lane 1b/5 review folds: the goal threshold, its representation and the
      // outcome-node selection are per-decision — left standing they ride the
      // NEXT decision's runs (the canonical run default-attaches the store
      // threshold). ceeAnalysisReady/-NodeIds are already cleared above.
      ...DECISION_CONTEXT_CLEAR,
      runMeta: {},
      hasCompletedFirstRun: false,
      graphEditedSinceLastRun: false,
      analysisStateReady: false,
      // Clear validation state
      graphHealth: null,
      needleMovers: [],
      // Close results panel
      showResultsPanel: false,
      // Clear scenario tracking in store state
      currentScenarioId: null,
      scenarioPersistedToDb: false,
      // A.15: Clear lifecycle stage
      currentStage: null,
      // A.5+: Clear draft snapshot
      draftChatPreDraftSnapshot: null,
      // Phase 2A: Clear analysis metadata
      lastAnalysisSeed: null,
      lastQualityMode: null,
      repairsApplied: null,
      rawV2Response: null,
      // Graph Lens: reset on canvas clear
      lens: createDefaultLensState(),
    })
    // Reset comparison state on canvas clear (lives in useComparisonStore as of C3-3)
    useComparisonStore.getState().resetComparison()
    // Clear AI model selections (lives in useDraftStore as of C3-5).
    // Historical behaviour: resetCanvas cleared only the three selectedXxxModel
    // fields, not the broader draft state. Preserving that narrow reset.
    useDraftStore.getState().resetAllModels()
  },

  deleteEdge: (id) => {
    const { edges, selection } = get()
    const edge = edges.find(e => e.id === id)
    if (!edge) return

    // 0.48.0 — durable removal. The edge inspector's Delete lands here, so it
    // must record too or that gesture would stay local-only.
    if (!recordStructuralDeleteIntent(get, set, { nodeIds: [], edgeIds: [id] })) return
    pushToHistory(get, set, 'Deleted connection')

    const newEdges = edges.filter(e => e.id !== id)
    const newEdgeIds = new Set(selection.edgeIds)
    newEdgeIds.delete(id)

    set({
      edges: newEdges,
      selection: { ...selection, edgeIds: newEdgeIds }
    })

    // Invalidate analysis_ready if edge connected critical nodes
    maybeInvalidateOnEdgeDelete(get, set, edge)
  },

  updateEdgeEndpoints: (id, updates) => {
    const { edges, nodes } = get()
    const edge = edges.find(e => e.id === id)
    if (!edge) return

    const newSource = updates.source ?? edge.source
    const newTarget = updates.target ?? edge.target

    // No-op guard: skip history + invalidation if endpoints unchanged
    if (newSource === edge.source && newTarget === edge.target) return

    // Validate: no self-loops
    if (newSource === newTarget) {
      return // Caller should show toast: "That connection isn't allowed."
    }

    // Validate: no duplicates
    const duplicate = edges.find(e => 
      e.id !== id && e.source === newSource && e.target === newTarget
    )
    if (duplicate) {
      return // Caller should show toast: "A connector already exists between those nodes."
    }

    // Validate: nodes exist
    const sourceExists = nodes.some(n => n.id === newSource)
    const targetExists = nodes.some(n => n.id === newTarget)
    if (!sourceExists || !targetExists) {
      return
    }

    pushToHistory(get, set)

    const newEdges = edges.map(e => 
      e.id === id 
        ? { ...e, source: newSource, target: newTarget }
        : e
    )

    set({
      edges: newEdges,
      selection: { ...get().selection, edgeIds: new Set([id]) }
    })
    invalidateAnalysisReady(get, set, `update_edge_endpoints (${id}: ${newSource} → ${newTarget})`)
  },

  beginReconnect: (edgeId, end) => {
    const { edges } = get()
    const edge = edges.find(e => e.id === edgeId)
    if (!edge) return

    set({ reconnecting: { edgeId, end } })
  },

  completeReconnect: (nodeId) => {
    const { reconnecting } = get()
    if (!reconnecting) return

    const { edgeId, end } = reconnecting
    const updates = end === 'source' 
      ? { source: nodeId }
      : { target: nodeId }

    get().updateEdgeEndpoints(edgeId, updates)
    set({ reconnecting: null })
  },

  cancelReconnect: () => {
    set({ reconnecting: null })
  },

  reset: () => {
    clearTimers()
    set({
      nodes: initialNodes,
      edges: initialEdges,
      history: { past: [], future: [] },
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
      nextNodeId: 1,
      nextEdgeId: 1,
      // 0.48.0 — MUST be cleared here, and `nextNodeId: 1` above is exactly
      // why. Canvas node ids are sequential integers (`createNodeId` returns
      // `String(nextNodeId)`), so a reset makes the NEXT graph reissue the same
      // ids the previous one used. A durable-delete record surviving that would
      // match a brand-new, never-deleted node by id and withhold it from undo —
      // silently eating the user's work, which is the exact opposite-direction
      // harm this guard exists to avoid. (`resetCanvas`, `importCanvas` and
      // `hydrateGraphSlice` clear it via DECISION_CONTEXT_CLEAR; this action
      // does not apply that block, so it clears them itself.)
      durablyDeletedElements: EMPTY_DURABLE_DELETION_RECORD,
      durableDeletionNotice: null,
      _internal: { lastHistoryHash: historyHash(initialNodes, initialEdges) },
      hasCompletedFirstRun: false,
      showDraftChat: false,
      // Interim 2.467 — release. ⚠ NOT derived: `initialNodes`/`initialEdges`
      // are both `[]` (store.ts, above), so the digest is null by the
      // empty-graph rule and a derivation here is constant `false`.
      importPendingServerRegistration: false,
    })
    // Reset AI model selections (lives in useDraftStore as of C3-5)
    useDraftStore.getState().resetAllModels()
  },

  setOutcomeNode: (nodeId, opts) => {
    // Changing which node is the goal/outcome is analysis-affecting → dirty the
    // freshness overlay on a real change. (Producer paths that also call this —
    // applyDraftResult / applyAutoApplyPatch — dirty via their own mutation marks;
    // load/scenario paths set outcomeNodeId directly and reset the overlay.)
    const changed = get().outcomeNodeId !== nodeId
    // P0-1: user goal-RESELECTION passes { rederiveThreshold: true } so the
    // global scalar follows the newly-selected goal node — it adopts B's own
    // user target or clears A's stale one, never lets A's threshold ride B's
    // runs. Producer paths omit the flag: they carry their own threshold sync
    // (setCeeAnalysisReady bare-sync) and must not have it clobbered here.
    const derived = opts?.rederiveThreshold
      ? deriveGoalThresholdFromNode(get().nodes, nodeId)
      : null
    set(derived ? { outcomeNodeId: nodeId, ...derived } : { outcomeNodeId: nodeId })
    if (changed) markAnalysisFreshnessDirty(get, set)
  },

  reselectGoalNode: (goalId) => {
    // P0-1 (external review round 2): switching the selected goal must
    // INVALIDATE all of the previous goal's producer target fields on readiness
    // — not just the cap — or the panel falls back to the old target
    // (usePreAnalysisData.successThreshold reads ceeAnalysisReady.goal_threshold,
    // which made Goal B render "target missing" AND "60% — From brief"). Order:
    // clear readiness FIRST (while the store scalar is still non-null, so
    // setCeeAnalysisReady's bare-sync can't re-adopt the old value), THEN
    // re-derive the scalar from the new goal node.
    const { ceeAnalysisReady, setCeeAnalysisReady, setOutcomeNode } = get()
    if (ceeAnalysisReady) {
      setCeeAnalysisReady({
        ...ceeAnalysisReady,
        goal_node_id: goalId,
        goal_threshold: undefined,
        goal_threshold_raw: undefined,
        goal_threshold_unit: undefined,
        goal_threshold_cap: undefined,
      })
    } else {
      setCeeAnalysisReady({ status: undefined, goal_node_id: goalId, options: [] })
    }
    setOutcomeNode(goalId, { rederiveThreshold: true })
  },

  setGoalThreshold: (threshold, opts) => {
    // The goal threshold is sent to PLoT, so a user change is analysis-affecting
    // → dirty the freshness overlay on a real change. The CEE-sync caller inside
    // setCeeAnalysisReady passes { fromCeeSync: true } so an ingestion write does
    // NOT self-dirty.
    // Lane 5: default to 'raw' (every user/editor writer stores raw units); the
    // bare-sync passes representation: 'normalised' when it stores CEE's already
    // 0-1 value. A null threshold clears the tag.
    const changed = get().goalThreshold !== threshold
    set({
      goalThreshold: threshold,
      goalThresholdRepresentation: threshold == null ? null : opts?.representation ?? 'raw',
    })
    if (changed && !opts?.fromCeeSync) markAnalysisFreshnessDirty(get, set)
  },

  setGoalThresholdAndUpdateNode: (goalNodeId, value, opts) => {
    // User commit → raw user units (Lane 5).
    set({ goalThreshold: value, goalThresholdRepresentation: value == null ? null : 'raw' })
    pushToHistory(get, set)
    if (!get().nodes.some(n => n.id === goalNodeId)) {
      // The whole point of this action is the atomic store+node pair (Codex
      // B2). A stale id silently recreates the split-brain node-side — make
      // it detectable.
      console.warn(
        '[store] setGoalThresholdAndUpdateNode: goal node not found — global value set, node annotation skipped',
        { goalNodeId },
      )
    }
    set((s) => ({
      nodes: s.nodes.map(n =>
        n.id === goalNodeId
          ? {
              ...n,
              data: {
                ...n.data,
                success_threshold: value,
                threshold_source: value !== null ? 'user' : undefined,
                threshold_confirmed: false,
                // UI-SEM-086: keep the unit the user's own input carried; leave
                // any existing (CEE-backfilled) unit untouched when none given.
                ...(value !== null && opts?.unit ? { goal_threshold_unit: opts.unit } : {}),
              },
            }
          : n
      ),
    }))
    invalidateAnalysisReady(get, set, `goal_threshold_change (${goalNodeId})`)
  },

  // Results actions
  // Note: Preserve existing report/hash during re-run so UI doesn't flash empty
  // Results only fully cleared in resetCanvas() or when new results arrive
  resultsStart: ({ seed, wasForced }) => {
    const prevResults = get().results
    set({
      results: {
        status: 'preparing',
        progress: 0,
        seed,
        wasForced,
        startedAt: Date.now(),
        error: undefined,
        // Preserve previous results during re-run
        report: prevResults.report,
        hash: prevResults.hash,
        drivers: prevResults.drivers,
        runId: undefined,
        finishedAt: undefined,
        isDuplicateRun: undefined,
        // ROADMAP 2.1127 — a new run begins. The retained report keeps the
        // epoch of the run that produced it, so a failure settled by THIS run
        // is distinguishable from a report left over from an earlier one.
        runEpoch: (prevResults.runEpoch ?? 0) + 1,
        reportEpoch: prevResults.reportEpoch,
        errorEpoch: undefined
      },
      // Graph Lens: auto-reset on new analysis run
      lens: createDefaultLensState(),
      // A new run is in flight — the previous snapshot's hash + rawV2Response
      // are preserved in the store (for continuity) but MUST NOT be sent to
      // CEE on subsequent conversational turns. Flipped back to true only in
      // resultsComplete after the new snapshot is fully written.
      analysisStateReady: false,
    })
  },

  resultsConnecting: (runId) => {
    set(s => ({
      results: {
        ...s.results,
        status: 'connecting',
        runId,
        progress: Math.max(s.results.progress, 5)
      }
    }))
  },

  resultsProgress: (percent) => {
    set(s => ({
      results: {
        ...s.results,
        status: 'streaming',
        // Cap at 90% until complete event arrives
        progress: Math.min(percent, 90)
      }
    }))
  },

  resultsComplete: ({ report, hash, drivers, ceeReview, ceeTrace, ceeError, ceeReviewV1: _ceeReviewV1, ceeTraceV1: _ceeTraceV1, ceeErrorV1: _ceeErrorV1, enrichment, resultsSource, rawV2Response, v5Enrichment }) => {
    const { nodes, edges, results, currentScenarioId, graphHealth: existingHealth } = get()

    const finishedAt = Date.now()
    const completedAtIso = new Date(finishedAt).toISOString()
    const seedString = results.seed != null ? String(results.seed) : null

    // Brief 37: Pass existing health to avoid creating new objects when unchanged
    const healthFromQuality = graphHealthFromQuality(report.graph_quality, existingHealth)

    // A1: Snapshot current report values before overwriting
    const currentReport = get().results.report
    let snapshot: PreviousReportSnapshot | null = null
    if (currentReport && get().results.status === 'complete') {
      const options: Record<string, OptionSnapshot> = {}
      // ReportV1.option_probabilities: Record<string, OptionProbability>
      const optionProbs = currentReport.option_probabilities
      if (optionProbs) {
        for (const [optId, prob] of Object.entries(optionProbs)) {
          options[optId] = {
            winProbability: prob.win_probability,
            // GOAL-PROBABILITY IDENTITY: the snapshot must hold the same number
            // the surfaces showed, not a second derivation of it — a snapshot
            // that disagrees with the panel it snapshotted is the same defect
            // one run later. Read the owner's choice.
            goalProbability:
              selectGoalProbability(prob as GoalProbabilityInput).goalProbability ?? undefined,
          }
        }
      }
      // Robustness accessed via index signature (not typed on ReportV1).
      // Cast through unknown: same pattern as enrichment.ts:181 — typed shape
      // treated as opaque for runtime field probing.
      const reportRecord = currentReport as unknown as Record<string, unknown>
      const robustness = reportRecord.robustness as Record<string, unknown> | undefined
      const rankingStability =
        typeof robustness?.recommendation_stability === 'number' ? robustness.recommendation_stability :
        typeof robustness?.ranking_stability === 'number' ? robustness.ranking_stability :
        undefined
      snapshot = {
        options,
        rankingStability,
      }
    }

    set(s => ({
      previousReport: snapshot,
      results: {
        ...s.results,
        status: 'complete',
        progress: 100,
        report,
        hash,
        drivers,
        finishedAt,
        error: undefined,
        enrichment: enrichment ?? null, // Phase 1B: Persist enrichment from PLoT
        resultsSource: resultsSource ?? 'direct', // A.9: provenance
        settledWithoutNewReport: undefined, // Lane 3: a REAL completion
        // ROADMAP 2.1127 — this report belongs to the run currently in flight.
        // Stamped here, inside the store, so every producer gets it and none
        // can forget to pass it.
        reportEpoch: s.results.runEpoch,
      },
      graphHealth: (() => {
        if (!healthFromQuality) return s.graphHealth ?? null
        if (!s.graphHealth) return healthFromQuality
        // Preserve structural validation output when issues are present,
        // but allow engine-derived health to refresh when there are no issues.
        if (s.graphHealth.issues.length > 0) return s.graphHealth
        return healthFromQuality
      })(),
      currentScenarioLastResultHash: hash ?? null,
      currentScenarioLastRunAt: completedAtIso,
      currentScenarioLastRunSeed: seedString,
      hasCompletedFirstRun: true,
      graphEditedSinceLastRun: false,
      // The snapshot (report, hash, rawV2Response) has been fully written in
      // this same set() call, so the flag flips atomically alongside the
      // write. Any buildRequest read that observes rawV2Response will also
      // observe analysisStateReady === true.
      analysisStateReady: true,
      // Phase 2A: Persist analysis metadata for Model Card Lite / trust strip
      // Read from raw V2RunResponse (typed) instead of casting through ReportV1
      lastAnalysisSeed: (() => {
        const raw = rawV2Response?.meta?.seed_used
        if (raw == null) return null
        const n = Number(raw)
        return Number.isFinite(n) ? n : null
      })(),
      lastQualityMode: rawV2Response?.meta?.detail_level ?? null,
      repairsApplied: rawV2Response?.repairs_applied ?? null,
      rawV2Response: rawV2Response ?? null,
    }))

    // Persist last run metadata onto the active scenario record (if any)
    if (currentScenarioId) {
      scenarios.updateScenario(currentScenarioId, {
        last_result_hash: hash,
        last_run_at: completedAtIso,
        last_run_seed: seedString || undefined
      })
    }

    // NOTE: Baseline defaults to 0 ("do nothing" scenario) in OutputsDock.tsx
    // This allows comparison display: "+X pts above 'do nothing'"
    // Future: Could store per-option outcomes for cross-option comparison

    // Save to run history.
    //
    // `results.seed` is set by `resultsStart`, which ONLY the direct Run-button
    // path calls. The canonical V5 / conversation path dispatches through
    // `resultsAnalysing` ("no seed is known yet"), so on a fresh session
    // `results.seed` is `undefined` and this write was skipped entirely —
    // while `last_result_hash` above was written regardless. A returning user
    // therefore had a scenario record pointing at a run that had never been
    // stored, `tryRestoreResultsFromHistory` found nothing, and the answer
    // was replaced by the pre-analysis "Analyse first pass" state with the
    // model still on the canvas. Verified live on staging 25 Jul 2026:
    // `olumi-canvas-run-history` was never created by a conversation-driven run.
    //
    // The fallback is the engine's OWN echo (`meta.seed_used`) — the same
    // value `useConversation` maps into the report — NOT a fabricated 0. When
    // there is no echo either, the write is still skipped: a run identity
    // built on an invented seed would fork the graph hash (CLAUDE.md trap #10).
    //
    // ⚠ THIS FALLBACK IS CURRENTLY INERT ON THE DEPLOYED PATH — do not read it
    // as "the returning-user answer is fixed". Corrected 25 Jul 2026 after
    // capturing the live wire (CLAUDE.md trap #16: a grepped symbol proves
    // presence-in-repo, never presence-on-the-live-wire).
    //
    // The branch this fallback was written against — `envelope.analysis_response`
    // in useConversation.ts, which carries the "Journey step 8" comment and the
    // #381 storeAnalysis fix — IS NOT THE LIVE PATH. Captured twice from
    // deployed staging, a real analysis returns on POST /proxy/v5/turn with NO
    // `analysis_response` key at all: the result is `blocks[0]` of type
    // `analysis_result`, payload at `blocks[0].enrichment.option_comparison`,
    // and `seed_used` appears NOWHERE in the envelope. The live handler is
    // applyV5State.ts (~L1015) and it calls resultsComplete with
    // `rawV2Response: null` explicitly ("V5 carries no V2 envelope").
    //
    // So on the deployed path BOTH inputs are absent: `results.seed` is
    // undefined (only resultsStart sets it, and only the direct Run button
    // calls that) and `rawV2Response` is null. `runHistorySeed` stays
    // undefined, this write is still skipped, and — because the Supabase
    // storeAnalysis call lives in that same dead branch — the answer has NO
    // store at all. `last_result_hash` above is still written unconditionally,
    // so a returning session looks up a run that was never saved.
    // Live-confirmed 3/3: `olumi-canvas-run-history` does not exist as a
    // localStorage key even after a completed analysis.
    //
    // Reviving this needs a producer-boundary decision, not a UI change: CEE
    // echoes a run seed/identity on the `analysis_result` block, or run
    // identity is re-based on `report.model_card.response_hash` (which IS
    // present) instead of a seed-bearing graph hash. This code is kept because
    // it is correct and is the right shape for that moment — not because it
    // does anything today. See parallel-briefs/RETURNING-USER-2026-07-25.md §3.
    const echoedSeed = (() => {
      const raw = rawV2Response?.meta?.seed_used
      if (raw == null) return undefined
      const n = Number(raw)
      return Number.isFinite(n) ? n : undefined
    })()
    const runHistorySeed = results.seed ?? echoedSeed

    if (report && runHistorySeed !== undefined) {
      const graphHash = generateGraphHash(nodes, edges, runHistorySeed)

      const graphSnapshot = JSON.parse(JSON.stringify({ nodes, edges })) as {
        nodes: typeof nodes
        edges: typeof edges
      }

      const storedRun: StoredRun = {
        id: results.runId || crypto.randomUUID(),
        ts: Date.now(),
        seed: runHistorySeed,
        hash,
        adapter: 'auto', // TODO: Track actual adapter used
        summary: (report as any).summary || '',
        graphHash,
        report,
        drivers: drivers?.map(d => ({
          kind: d.kind,
          id: d.id,
          label: undefined // Backend should provide label if available
        })),
        graph: graphSnapshot, // v1.2: Store graph snapshot for computing deltas
        ceeReview: ceeReview ?? null,
        ceeTrace: ceeTrace ?? null,
        ceeError: ceeError ?? null
      }

      const isDuplicate = addRun(storedRun)

      // Store duplicate flag so UI can show appropriate toast
      set(s => ({
        results: {
          ...s.results,
          isDuplicateRun: isDuplicate
        }
      }))
    }

    // ⭐ THE ANSWER IS PERSISTED HERE, beside the graph it was computed over.
    //
    // This is what makes the returning user's result survive; everything above
    // it about run history is the OLD, seed-gated path and stays inert on the
    // live V5 wire (see the block comment there). See store/scenarios.ts
    // `PersistedAnalysis` for the full two-dead-links diagnosis.
    //
    // IT MUST BE HERE AND NOT LEFT TO THE 30s TIMER. useAutosave's dirty check
    // is `computeGraphHash(nodes, edges)` — GRAPH ONLY. Completing an analysis
    // changes no node and no edge, so the hash is identical and the timer's
    // `currentHash === lastSavedHashRef.current` early-return SKIPS the write
    // entirely. Relying on the timer would have persisted the answer only if
    // the user happened to edit the graph afterwards — i.e. a fix that passes a
    // store test and does nothing for the user who runs an analysis and leaves.
    //
    // Sourced from the POST-set() state (Zustand's set is synchronous), so the
    // record written is exactly the one this completion produced.
    try {
      scenarios.saveAutosave(projectAutosaveData(autosaveSourceFromStore(get())))
    } catch (err) {
      // Never let a persistence failure take down a completed run — the answer
      // is already on screen. saveAutosave already handles quota by dropping
      // the analysis and keeping the graph; this catch covers the rest.
      console.warn('[resultsComplete] Failed to persist analysis to autosave', err)
    }

    // Refinement Journey: capture analysis snapshot for Compare tab.
    //
    // ⭐ ROADMAP 2.350 — THIS GATE USED TO READ `rawV2Response && report`, AND
    // THAT CONJUNCT IS WHY COMPARE HAD NO DATA ON THE DEPLOYED WIRE AT ALL.
    // The V5 applicator — the only analyse path in production — calls this
    // action with `rawV2Response: null` EXPLICITLY ("V5 carries no V2
    // envelope"). So this capture never executed on a real turn, for ANY tier,
    // and the tab's only other feed (`useCompareHistoryHydration`) skips
    // guests by design while staging serves every session as guest. Result:
    // a guest who ran the analysis twice was shown an empty state instructing
    // them to "run the analysis again". Witnessed on the 2026-08-04b walk
    // (`p3b/P3b-compare-before.json`: runPickerCount 0, compare-empty-state).
    //
    // The V5 branch reads the analysis block's OWN enrichment — the same
    // material the persisted rebuild parses, through the same shared reader
    // (`stores/analysisEnrichmentShape.ts`), because a persisted run_analysis
    // fact IS this enrichment after CEE wrote it.
    if (isCompareTabEnabled() && report && (rawV2Response || v5Enrichment)) {
      try {
        const snapshotStore = useAnalysisSnapshotStore.getState()
        const capturedEvents = (get()._hydratedEvents ?? []) as ScenarioEvent[]
        const prevTimestamp = snapshotStore.getLatest()?.timestamp ?? null
        const runNumber = snapshotStore.getRunCount() + 1
        const snapshot = rawV2Response
          ? buildAnalysisSnapshot({
              rawV2Response,
              report,
              nodes,
              edges,
              runNumber,
              events: capturedEvents,
              previousSnapshotTimestamp: prevTimestamp,
            })
          : buildSnapshotFromV5Analysis({
              enrichment: v5Enrichment,
              // Run identity, shared with the Results panel: `hash` is the
              // response_hash the applicator already used to decide this was a
              // NEW analysis. Carrying it is what lets addSnapshot reject a
              // re-delivered run, and what lets a later sign-in merge dedupe
              // this session run against its own persisted row.
              responseHash: hash,
              nodes,
              edges,
              runNumber,
              events: capturedEvents,
              previousSnapshotTimestamp: prevTimestamp,
            })
        // null ⇒ the block could not be read as a completed analysis. Omit the
        // run rather than publish a snapshot of zeros nobody measured.
        if (snapshot) snapshotStore.addSnapshot(snapshot)
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[resultsComplete] Snapshot capture failed', err)
        }
      }
    }
  },

  resultsError: ({ code, message, retryAfter, request_id, canRetry, affectedOptions }) => {
    set(s => ({
      results: {
        ...s.results,
        status: 'error',
        // retryAfter: reserved for future rate-limit handling, not currently displayed
        error: { code, message, retryAfter, request_id, canRetry, affectedOptions },
        finishedAt: Date.now(),
        // ROADMAP 2.1127 — which run failed. Compared against `reportEpoch` by
        // any surface that wants to say whose numbers are on screen: equal
        // means the retained report is THIS run's (the failure landed after
        // `resultsComplete`), different means it is genuinely a previous run's,
        // and a missing stamp on either side means UNKNOWN — claim nothing.
        errorEpoch: s.results.runEpoch,
      },
      // Run failed — the prior snapshot (preserved on the results object)
      // may still be the user's best available context, but the new-run
      // snapshot never landed. Leave analysisStateReady where resultsStart
      // set it (false) so subsequent turns omit analysis_state until the
      // user successfully reruns.
      analysisStateReady: false,
    }))
  },

  captureErrorDetail: (detail: ErrorDetail) => {
    set(s => ({
      runMeta: {
        ...s.runMeta,
        // Keep last 10 errors to avoid memory bloat
        errorDetails: [...(s.runMeta.errorDetails ?? []), detail].slice(-10),
      }
    }))
  },

  clearErrorDetails: () => {
    set(s => ({
      runMeta: {
        ...s.runMeta,
        errorDetails: [],
      }
    }))
  },

  resultsCancelled: () => {
    set(s => ({
      results: {
        ...s.results,
        status: 'cancelled',
        finishedAt: Date.now()
      },
      // Run cancelled — same reasoning as resultsError: the new snapshot
      // never landed, so don't send stale analysis_state on subsequent turns.
      analysisStateReady: false,
    }))
  },

  optionNumbering: {},
  registerOptionNumbering: (optionIds) => {
    if (optionIds.length === 0) return
    const previous = get().optionNumbering
    const next = assignStableOptionNumbers(previous, optionIds)
    // Merge is append-only: skip the set entirely when nothing was new.
    if (Object.keys(next).length === Object.keys(previous).length) return
    set({ optionNumbering: next })
  },

  resultsAnalysing: () => {
    set(s => ({
      results: {
        ...s.results,
        status: 'preparing',
        progress: 0,
        startedAt: Date.now(),
        finishedAt: undefined,
        error: undefined,
        settledWithoutNewReport: undefined, // Lane 3: new run in flight
        // ROADMAP 2.1127 — resultsStart parity: a new run begins here too (this
        // is the V5/conversation path's opener, useConversation.ts:4318).
        runEpoch: (s.results.runEpoch ?? 0) + 1,
        errorEpoch: undefined,
        // Everything else (report/hash/seed/drivers/reportEpoch) preserved so a
        // settle-back after a resultless turn restores the prior run intact.
      },
      // Graph Lens: auto-reset on new analysis run (resultsStart parity).
      lens: createDefaultLensState(),
      // A new run is in flight — same contract as resultsStart: the previous
      // snapshot must not be sent to CEE while the new one is pending.
      analysisStateReady: false,
    }))
  },

  resultsSettle: () => {
    const s = get()
    if (s.results.status !== 'preparing') return
    if (s.results.report) {
      set(st => ({
        results: {
          ...st.results,
          status: 'complete',
          progress: 100,
          // Lane 3 (SF2): this 'complete' restored the OLD report — the
          // completion toast must not announce a completed rerun.
          settledWithoutNewReport: true,
        },
        // The preserved snapshot is (again) the latest valid analysis.
        analysisStateReady: true,
      }))
    } else {
      set(st => ({
        results: {
          ...st.results,
          status: 'idle',
          progress: 0,
        },
      }))
    }
  },

  resultsLoadHistorical: (run: RestorableRun, restoredForScenarioId?: string | null) => {
    if (typeof window !== 'undefined') {
      try {
        const win = window as any
        win.__SAFE_DEBUG__ ||= { logs: [] }
        const debug = win.__SAFE_DEBUG__
        const logs = Array.isArray(debug.logs) ? debug.logs : null
        if (logs && logs.length < 1000) {
          logs.push({
            t: Date.now(),
            m: 'canvas:resultsLoadHistorical',
            data: {
              id: run.id,
              seed: run.seed,
              hash: run.hash,
            }
          })
        }
      } catch {}
    }

    // Brief 37: Pass existing health to avoid creating new objects when unchanged
    const existingHealth = get().graphHealth
    const healthFromQuality = graphHealthFromQuality(run.report?.graph_quality, existingHealth)

    // ⭐ THE ONE AUTHORISED STAMP WRITE. Every other `results` write — including
    // the ten that carry this slice forward by spread — has the stamp stripped
    // by `createRestoreStampGuard`. Must sit immediately before the `set` it
    // authorises: the token is consumed by the very next call.
    authoriseRestoreStampOnNextSet()
    set(s => ({
      results: {
        status: 'complete',
        progress: 100,
        runId: run.id,
        seed: run.seed,
        hash: run.hash,
        report: run.report,
        startedAt: run.ts,
        finishedAt: run.ts,
        drivers: run.drivers as any,
        error: undefined,
        // ROADMAP 2.1127 — this action REPLACES the whole results object, so it
        // must carry the provenance stamps or a restored run would read as
        // UNKNOWN and a later failure could make no attribution at all. A
        // historical run is BY DEFINITION not the run that fails next: the
        // counter only ever increments from 1, so the sentinel epoch below can
        // never collide with a future `errorEpoch`.
        runEpoch: s.results.runEpoch,
        reportEpoch: HISTORICAL_REPORT_EPOCH,
        errorEpoch: undefined,
        // ⭐ The ONE writer of this field. `?? null` is deliberate: an omitted
        // argument records "no scenario identity", which `loadScenario` reads
        // as "clear" — never as "belongs to whatever is loading".
        restoredForScenarioId: restoredForScenarioId ?? null,
      },
      runMeta: {
        diagnostics: undefined,
        correlationIdHeader: undefined,
        degraded: undefined,
        ceeReview: run.ceeReview ?? null,
        ceeTrace: run.ceeTrace ?? null,
        ceeError: run.ceeError ?? null
      },
      graphHealth: (() => {
        if (!healthFromQuality) return s.graphHealth ?? null
        if (!s.graphHealth) return healthFromQuality
        if (s.graphHealth.issues.length > 0) return s.graphHealth
        return healthFromQuality
      })(),
      isDirty: false,
      hasCompletedFirstRun: true,
      graphEditedSinceLastRun: false,
      // Historical loads have no rawV2Response, so buildRequest's v2Results
      // will be null and analysis_state will be omitted regardless. Flag
      // kept false to document intent (the snapshot isn't a fresh run).
      analysisStateReady: false,
      rawV2Response: null, // Historical runs don't carry raw V2 response
      // RCA-D1/RCA-C: a hydrated snapshot has no live capture proving it matches
      // the current graph (v5AnalysisFact is session-only and never restored, so
      // every reload is an orphaned result). Mark the CEE freshness verdict
      // 'unknown' (cannot-confirm) — never 'fresh', never the overclaiming
      // 'stale' — so the results surface reads "can't confirm this is current",
      // the stale engine critique is freshness-gated off (OutputsDock), and the
      // hero is routed off green "Analysis complete" via the orphan signal. A
      // later analysis_ready turn upgrades this verdict honestly.
      analysisFreshness: { freshness: 'unknown', freshnessReason: 'hydrated_without_capture' },
      analysisFreshnessDirty: false,
    }))
  },

  resultsHydrateFromSupabase: (hydrated) => {
    const { results: hydratedResults, runMeta: hydratedRunMeta } = hydrated

    // Invariant: status must be 'complete' for hydration to proceed
    if (hydratedResults.status !== 'complete' || !hydratedResults.report) {
      if (import.meta.env.DEV) {
        console.warn('[store] resultsHydrateFromSupabase: invariant violation — status is not complete or report missing, skipping')
      }
      return
    }

    // Brief 37: Pass existing health to avoid creating new objects when unchanged
    const existingHealth = get().graphHealth
    const healthFromQuality = graphHealthFromQuality(
      hydratedResults.report?.graph_quality,
      existingHealth,
    )

    set(s => ({
      results: {
        ...s.results,
        ...hydratedResults,
        // ROADMAP 2.1127 — the SAME reasoning as `resultsLoadHistorical`, and
        // it must be repeated here because this action installs a restored
        // report by SPREAD: `hydrateAnalysis.ts:138-152` returns no epoch keys,
        // so on a COLD scenario load (`useScenario.ts:727-734`, whenever
        // `row.analysis_status === 'ready'`) `reportEpoch` would stay
        // `undefined`. A later failed rerun then reads UNKNOWN and SUPPRESSES
        // the attribution chip while the restored numbers stay mounted — an
        // under-claim, but a lost TRUE disclosure.
        //
        // A restored report is by definition not the output of the run that
        // fails next, and `runEpoch` only ever counts up from 1, so the
        // sentinel can never collide with a future `errorEpoch`.
        //
        // ⚠ These two keys must stay AFTER the spreads: a hydrated payload that
        // one day carries its own epoch fields must not overwrite the provenance
        // this action is asserting.
        reportEpoch: HISTORICAL_REPORT_EPOCH,
        errorEpoch: undefined,
      },
      runMeta: {
        ...s.runMeta,
        ...hydratedRunMeta,
      },
      graphHealth: (() => {
        if (!healthFromQuality) return s.graphHealth ?? null
        if (!s.graphHealth) return healthFromQuality
        if (s.graphHealth.issues.length > 0) return s.graphHealth
        return healthFromQuality
      })(),
      hasCompletedFirstRun: true,
      graphEditedSinceLastRun: false,
      // Supabase hydration has no rawV2Response — same reasoning as
      // resultsLoadHistorical above.
      analysisStateReady: false,
      rawV2Response: null, // Supabase hydration doesn't carry raw V2 response
      // RCA-D1/RCA-C: mark the hydrated result 'unknown' (cannot-confirm) — see
      // the matching note in resultsLoadHistorical above.
      analysisFreshness: { freshness: 'unknown', freshnessReason: 'hydrated_without_capture' },
      analysisFreshnessDirty: false,
    }))
  },

  resultsReset: () => {
    set({
      previousReport: null,
      results: {
        status: 'idle',
        progress: 0
      },
      // Graph Lens: auto-reset on results clear (prevents stale lens reactivating on next run)
      lens: createDefaultLensState(),
      hoveredOptionId: null,
      rawV2Response: null,
      // Results cleared — no valid snapshot.
      analysisStateReady: false,
      // Clear all runMeta including V1 CEE fields to prevent stale Decision Review
      runMeta: {
        diagnostics: undefined,
        correlationIdHeader: undefined,
        degraded: undefined,
        ceeReview: null,
        ceeTrace: null,
        ceeError: null,
        ceeReviewV1: null,
        ceeTraceV1: null,
        ceeErrorV1: null,
        decisionReview030: null,
        ceeDebugHeaders: undefined,
      },
    })
  },

  setRunMeta: (meta: RunMetaState) => {
    // Sanitisation at ingestion - single authoritative point for CEE/M1 data
    // Components receive clean data without needing to sanitise at render time
    const sanitised: RunMetaState = {
      ...meta,
      ceeReviewV1: meta.ceeReviewV1 !== undefined
        ? sanitizeCeeReviewPayload(meta.ceeReviewV1)
        : undefined,
      m1Review: meta.m1Review !== undefined
        ? sanitizeM1Review(meta.m1Review)
        : undefined,
    }

    set(s => ({
      runMeta: {
        ...s.runMeta,
        ...sanitised
      }
    }))
  },

  // Scenario actions
  loadScenario: (id: string) => {
    const scenario = scenarios.getScenario(id)
    if (!scenario) {
      console.warn('[Canvas] Scenario not found:', id)
      return false
    }

    const { nodes, edges: rawEdges } = scenario.graph

    // Upgrade persisted edges (generic Edge) to strongly-typed Edge<EdgeData>
    const edges: Edge<EdgeData>[] = rawEdges.map((edge) => ({
      ...edge,
      data: {
        ...DEFAULT_EDGE_DATA,
        ...(edge.data as Partial<EdgeData> | undefined ?? {}),
      },
    }))

    // Reseed IDs to avoid conflicts
    get().reseedIds(nodes, edges)

    // Re-derive the goal/outcome selection AND the goal-threshold scalar from the
    // restored graph's own goal node (both computed once). outcomeNodeId is never
    // persisted; the threshold rides the node's success_threshold
    // (threshold_source==='user') and must follow it across a refresh, or the V7
    // goal lens gates 'no_target' post-reload (mirror of the hydrateGraphSlice
    // fix, live defect 2026-07-23). Returns {null,null} when the goal node carries
    // no user target — leaving the CEE bare-sync below free to repopulate.
    const { outcomeNodeId: restoredGoalId, ...restoredGoalThreshold } = deriveGoalContext(nodes)

    // A.7: Suppress direct_graph_edit events during scenario hydration
    set((s) => ({ _externalMutationActive: s._externalMutationActive + 1 }))
    try {
    set({
      nodes,
      edges,
      currentScenarioId: id,
      // Wave F-A: option ordinals never cross a scenario boundary
      optionNumbering: {},
      scenarioPersistedToDb: true,
      currentScenarioFraming: scenario.framing ?? null,
      currentScenarioLastResultHash: scenario.last_result_hash ?? null,
      currentScenarioLastRunAt: scenario.last_run_at ?? null,
      currentScenarioLastRunSeed: scenario.last_run_seed ?? null,
      previousReport: null, // A1: Clear stale deltas on scenario switch
      // The previous scenario's REPORT goes with its deltas. Without this, a
      // switch to a scenario that has never been analysed — or whose run this
      // browser's history no longer holds — left the previous decision's
      // completed report on screen, attributed to the one just opened:
      // `tryRestoreResultsFromHistory` below returns early on a falsy or
      // unmatched hash and clears nothing. When history DOES hold the run,
      // `resultsLoadHistorical` overlays this idle state a few lines down, so
      // a restorable report is not lost.
      results: createIdleResults(),
      // Scenario switch always invalidates analysis freshness. If run history
      // is found below, resultsLoadHistorical will overlay (also sets false/null).
      // Without this, switching to a scenario with no last_result_hash leaves
      // analysisStateReady: true and rawV2Response from the previous scenario,
      // causing buildRequest to ship stale analysis on the first turn.
      analysisStateReady: false,
      rawV2Response: null,
      // Freshness verdict is per-scenario and session-derived — clear on switch
      // so a verdict (and any pending dirty overlay) from the previous scenario
      // cannot leak into this one.
      analysisFreshness: null,
      analysisFreshnessDirty: false,
      // ROADMAP 2.1163 / EXT-2: a refusal describes ONE turn against ONE model.
      // Carrying it across an import/reset/scenario switch would claim a refusal
      // that never happened for the model now on the canvas.
      analysisRefusalNotice: null,
      // Step 5 — same argument, and it matters more here because this verdict
      // OUTRANKS the local derivations: carrying a composed verdict across an
      // import/reset/scenario switch would let CEE's statement about the
      // PREVIOUS model silently govern what may be said about this one.
      analysisStateV1: null,
      // Interim 2.467, DERIVED: `scenarios.getScenario` is localStorage, not
      // the server — a scenario saved while an imported graph was on the canvas
      // restores an unregistered graph. Derive from what is being installed.
      importPendingServerRegistration: isGraphPendingImportRegistration(nodes, edges),
      isDirty: false,
      history: { past: [], future: [] },
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
      touchedNodeIds: new Set(),
      showDraftChat: false,
      // Composer draft is scoped to a scenario — clear it on switch so a draft
      // for "buy vs build" can't bleed into "hire vs contract".
      draftComposerText: null,
      // Lane 1b/5 review folds: the goal threshold is per-decision — the
      // previous scenario's target must not ride this scenario's runs (the V2
      // boundary reads it every run; canonical V5 runs default-attach it). It is
      // re-derived (not cleared) from THIS scenario's own goal node below, so a
      // user's success target survives a refresh; a target-less goal yields
      // {null,null} and the CEE-sync (bare goal_threshold on analysis_ready
      // ingestion) or a fresh user commit repopulates it as before.
      ...restoredGoalThreshold,
      // loadScenario restores ceeAnalysisReady below, but outcomeNodeId is
      // NEITHER persisted NOR restored (review fold: the earlier comment was
      // wrong) — re-derive it to the LOADED graph's goal node so a stale id
      // from the previous scenario cannot collide with a same-id node here.
      outcomeNodeId: restoredGoalId,
      // ⭐ B2, EXTENDED TO THIS LEG: the element-identity record is PER-SCENARIO
      // and this path replaced the graph without touching it. After A -> B the
      // record still described A while the canvas showed B — the exact harm
      // DECISION_CONTEXT_CLEAR's own comment names ("a previous scenario's set
      // would authorise deleting same-id nodes in the newly loaded graph"), and
      // this method does not spread that block.
      //
      // It is not a tidiness. The record's MEMBERSHIP consumer is the
      // applied-edit reconciler (`mergeAppliedGraph.ts:477-484`), where
      // membership AUTHORISES a removal — so an over-broad record lets a receipt
      // delete a node of B's that CEE never held. And the id collision is the
      // NORMAL case: ids are sequential integer strings (`createNodeId`) and
      // `reseedIds` re-bases `nextNodeId` from the LOADED graph alone, so two
      // scenarios of different sizes reissue the same ids by construction.
      //
      // ⚠ SEEDED, NOT CLEARED, AND NEVER `null`. `null` means "no evidence";
      // an empty record means "evidence that this scenario holds nothing", and
      // the three EXISTENCE consumers (`ownsServerGraph` at :1900 and :2002,
      // `graphAcceptedForCanvas` in useProvisionalAnalysisDelivery) read the
      // difference. The sibling leg of this same gesture
      // (`useScenario.loadScenario` -> `hydrateGraphSlice`, below) records the
      // loaded graph's full identity, and so does the boot arbiter's other
      // branch; clearing here would leave one branch of one gesture unable to
      // reconcile a deletion until a second receipt arrived. `nodes`/`edges`
      // are the graph being installed by this very `set`, so the record and the
      // canvas cannot disagree. An empty scenario yields an EMPTY record, which
      // is the honest value for it.
      lastAuthoritativeGraph: identityFromCanvasGraph(nodes, edges),
    })

    // Exit comparison mode when switching scenarios (lives in useComparisonStore as of C3-3)
    useComparisonStore.getState().resetComparison()

    scenarios.setCurrentScenarioId(id)

    // Clear analysis snapshots — old snapshots are stale for the new scenario
    useAnalysisSnapshotStore.getState().clearSnapshots()

    // Validate and restore ceeAnalysisReady if present
    if (scenario.ceeAnalysisReady) {
      const validation = validateCeeAnalysisReady(
        scenario.ceeAnalysisReady,
        scenario.ceeAnalysisReadyNodeIds ?? null,
        nodes
      )

      if (validation.isValid) {
        get().setCeeAnalysisReady(scenario.ceeAnalysisReady)
        if (import.meta.env.DEV) {
          console.warn('[loadScenario] Restored ceeAnalysisReady:', {
            options: scenario.ceeAnalysisReady.options.length,
            goal: scenario.ceeAnalysisReady.goal_node_id,
          })
        }
      } else {
        if (import.meta.env.DEV) {
          console.warn('[loadScenario] Stale ceeAnalysisReady discarded:', validation)
        }
        get().setCeeAnalysisReady(null)
      }
    } else {
      get().setCeeAnalysisReady(null)
    }

    // Restore results from run history if this scenario has a last run
    tryRestoreResultsFromHistory(scenario.last_result_hash, get().resultsLoadHistorical)

    // ROADMAP 2.932: restore the scenario's persisted hard constraints — or
    // CLEAR them when the record has none, so a previous decision's constraints
    // never ride the newly-loaded scenario. readPersistedGoalConstraints returns
    // null for an absent/empty/malformed value (fail-open on the untyped JSONB),
    // which is exactly the clear signal.
    //
    // ⚠ MUST BE THE LAST WORD ON goalConstraints IN THIS METHOD. setCeeAnalysisReady(null)
    // above runs READINESS_CLEAR_FIELDS, which nulls goalConstraints — so a
    // restore placed before it is silently clobbered on every scenario whose
    // ceeAnalysisReady is absent or stale (the common case). fromProducerSync: a
    // scenario load is not a user edit, and freshness was already nulled above.
    get().setGoalConstraints(readPersistedGoalConstraints(scenario.graph), {
      fromProducerSync: true,
    })

    return true
    } finally {
      // A.7: End suppression after hydration is complete (always, even on throw)
      set((s) => ({ _externalMutationActive: Math.max(0, s._externalMutationActive - 1) }))
    }
  },

  saveCurrentScenario: (name?: string) => {
    const {
      nodes,
      edges,
      currentScenarioId,
      currentScenarioFraming,
      currentScenarioLastResultHash,
      currentScenarioLastRunAt,
      currentScenarioLastRunSeed,
      ceeAnalysisReady,
      ceeAnalysisReadyNodeIds,
      goalConstraints,
    } = get()

    // P0-2: Set saving state
    set({ isSaving: true })

    // Does a saved record already exist for the current ID? `currentScenarioId` can be
    // a lazily-allocated conversation UUID (set by the first CEE turn) that has NO record
    // yet. In that case we must ADOPT that UUID as the new record's ID rather than mint a
    // replacement — otherwise updateScenario() would silently no-op and the model would be
    // lost. This keeps model identity == CEE conversation identity across a save.
    const hasExistingRecord =
      currentScenarioId != null && scenarios.getScenario(currentScenarioId) != null

    try {
      if (hasExistingRecord) {
        // Update existing scenario (ID preserved)
        scenarios.updateScenario(currentScenarioId!, {
          name,
          // ROADMAP 2.932: persist the hard constraints INTO the graph JSONB,
          // the same shape (and snake-case key) the authenticated DB path uses,
          // so a guest scenario save round-trips them instead of dropping them.
          graph: buildPersistedGraph(nodes, edges, goalConstraints),
          framing: currentScenarioFraming || undefined,
          last_result_hash: currentScenarioLastResultHash || undefined,
          last_run_at: currentScenarioLastRunAt || undefined,
          last_run_seed: currentScenarioLastRunSeed || undefined,
          ceeAnalysisReady: ceeAnalysisReady ?? null,
          ceeAnalysisReadyNodeIds: ceeAnalysisReadyNodeIds ?? null,
        })
        // Clear autosave since work is now saved to scenario
        scenarios.clearAutosave()
        // Clear _baseline_snapshot from all nodes (transient session state)
        const cleansedNodes = get().nodes.map((n) => {
          if (n.data?._baseline_snapshot != null) {
            const { _baseline_snapshot, ...rest } = n.data as any
            return { ...n, data: rest }
          }
          return n
        })
        set({
          nodes: cleansedNodes,
          isDirty: false,
          isSaving: false,
          lastSavedAt: Date.now()
        })
        return currentScenarioId!
      } else {
        // No record yet. Create one, ADOPTING the existing conversation UUID when present
        // (so the saved model reuses the same ID); otherwise createScenario mints a fresh
        // UUID. Auto-generate a name if not provided.
        const scenarioName = name
          || currentScenarioFraming?.title
          || `Decision - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

        const scenario = scenarios.createScenario({
          name: scenarioName,
          id: currentScenarioId ?? undefined,
          nodes,
          edges,
          // ROADMAP 2.932: persist the hard constraints on the new record too.
          goalConstraints,
          framing: currentScenarioFraming || undefined,
          last_result_hash: currentScenarioLastResultHash || undefined,
          last_run_at: currentScenarioLastRunAt || undefined,
          last_run_seed: currentScenarioLastRunSeed || undefined,
          ceeAnalysisReady: ceeAnalysisReady ?? null,
          ceeAnalysisReadyNodeIds: ceeAnalysisReadyNodeIds ?? null,
        })
        // Clear autosave since work is now saved to scenario
        scenarios.clearAutosave()
        // Clear _baseline_snapshot from all nodes (transient session state)
        const newCleansedNodes = get().nodes.map((n) => {
          if (n.data?._baseline_snapshot != null) {
            const { _baseline_snapshot, ...rest } = n.data as any
            return { ...n, data: rest }
          }
          return n
        })

        set({
          nodes: newCleansedNodes,
          currentScenarioId: scenario.id,
          scenarioPersistedToDb: true,
          isDirty: false,
          isSaving: false,
          lastSavedAt: Date.now()
        })

        return scenario.id
      }
    } catch (error) {
      set({ isSaving: false })
      throw error
    }
  },

  createScenarioFromTemplate: ({ templateId, templateVersion, name }) => {
    const { nodes, edges } = get()

    const scenario = scenarios.createScenario({
      name,
      nodes,
      edges,
      source_template_id: templateId,
      source_template_version: templateVersion
    })

    set({
      currentScenarioId: scenario.id,
      scenarioPersistedToDb: true,
      isDirty: false,
      showDraftChat: false,
    })

    return scenario.id
  },

  duplicateCurrentScenario: (newName?: string) => {
    const { currentScenarioId } = get()
    if (!currentScenarioId) {
      console.warn('[Canvas] No current scenario to duplicate')
      return null
    }

    const duplicate = scenarios.duplicateScenario(currentScenarioId, newName)
    if (!duplicate) return null

    // Load the duplicate
    get().loadScenario(duplicate.id)
    return duplicate.id
  },

  renameCurrentScenario: (name: string) => {
    const { currentScenarioId } = get()
    if (!currentScenarioId) {
      console.warn('[Canvas] No current scenario to rename')
      return
    }

    scenarios.renameScenario(currentScenarioId, name)
  },

  deleteScenario: (id: string) => {
    const { currentScenarioId } = get()

    scenarios.deleteScenario(id)

    // If we deleted the current scenario, clear the current ID
    if (currentScenarioId === id) {
      set({ currentScenarioId: null, scenarioPersistedToDb: false })
    }
  },

  markDirty: () => {
    set({ isDirty: true })
  },

  markClean: () => {
    set({ isDirty: false })
  },

  // Panel actions
  setShowResultsPanel: (show: boolean) => {
    const prev = get().showResultsPanel
    if (!prev && show) {
      trackResultsViewed()
    }
    set({ showResultsPanel: show })
    saveUIPreference('showResultsPanel', show)
    // Task C: Panel coordination — results panel closes overlay panels
    if (show) {
      useUIStore.getState().openRightPanel('results')
      set({ showProvenanceHub: false, showAIClarifier: false })
    } else if (useUIStore.getState().activeRightPanel === 'results') {
      useUIStore.getState().closeRightPanel()
    }
    recordCrossSurfaceEvent({
      eventType: show ? 'results_panel_opened' : 'results_panel_closed',
      summary: show ? 'Results panel opened' : 'Results panel closed',
      payloadSummary: { previous: prev, next: show },
    })

    if (typeof window !== 'undefined') {
      try {
        const win = window as any
        win.__SAFE_DEBUG__ ||= { logs: [] }
        const debug = win.__SAFE_DEBUG__
        const logs = Array.isArray(debug.logs) ? debug.logs : null
        if (logs && logs.length < 1000) {
          logs.push({
            t: Date.now(),
            m: 'canvas:setShowResultsPanel',
            data: { prev, next: show }
          })
        }
      } catch {}
    }
  },

  setShowInspectorPanel: (show: boolean) => {
    set({ showInspectorPanel: show })
    saveUIPreference('showInspectorPanel', show)
    if (show) {
      const selection = get().selection
      recordCrossSurfaceEvent({
        eventType: 'inspector_opened',
        summary: 'Inspector panel opened',
        payloadSummary: {
          node_ids: [...selection.nodeIds],
          edge_ids: [...selection.edgeIds],
        },
      })
    }
  },

  openTemplatesPanel: (invoker?: HTMLElement) => {
    set({
      showTemplatesPanel: true,
      templatesPanelInvoker: invoker || null
    })
    saveUIPreference('showTemplatesPanel', true)
  },

  closeTemplatesPanel: () => {
    const { templatesPanelInvoker } = get()
    set({
      showTemplatesPanel: false,
      templatesPanelInvoker: null
    })
    saveUIPreference('showTemplatesPanel', false)

    // Restore focus to invoker after a brief delay (allows panel to unmount)
    if (templatesPanelInvoker && typeof templatesPanelInvoker.focus === 'function') {
      setTimeout(() => {
        try {
          templatesPanelInvoker.focus()
        } catch (err) {
          // Element may have been removed from DOM
        }
      }, 100)
    }
  },

  setShowDraftChat: (show: boolean) => {
    set({ showDraftChat: show })
    saveUIPreference('showDraftChat', show)
    recordUserAction({
      actionType: show ? 'expanded AI panel' : 'collapsed AI panel',
      payloadSummary: { next: show },
    })
  },

  // AI Model Selection, setIsGenerating, lastDraftDescription, lastDraftError
  // moved to useDraftStore as of C3-5.

  // A.15: Stage setter
  setCurrentStage: (stage) => set({ currentStage: stage }),

  // A.5+: Draft snapshot + undo (stays here because undoDraft writes the
  // snapshot atomically alongside graph + readiness + lens).
  setDraftChatPreDraftSnapshot: (snapshot) => set({ draftChatPreDraftSnapshot: snapshot }),
  undoDraft: () => {
    const { draftChatPreDraftSnapshot } = get()
    if (!draftChatPreDraftSnapshot) return

    pushToHistory(get, set)

    logConstraintClearIfPresent(get, 'undoDraftChatDraft')
    set({
      nodes: draftChatPreDraftSnapshot.nodes,
      edges: draftChatPreDraftSnapshot.edges,
      draftChatPreDraftSnapshot: null,
      // Clear full readiness bundle + pipeline trace on draft undo
      ...READINESS_CLEAR_FIELDS,
      // Lane 5 (review fold): undo reverts to the pre-draft graph — the
      // drafted decision's target must not survive onto it. Clear the
      // threshold pair (consistent with clearing readiness above) and
      // re-derive the outcome selection to the reverted graph's goal node.
      goalThreshold: null,
      goalThresholdRepresentation: null,
      outcomeNodeId: firstGoalNodeId(draftChatPreDraftSnapshot.nodes),
      // Verdict is retained → reverted graph no longer matches it → dirty overlay.
      analysisFreshnessDirty: true,
      // Interim 2.467, DERIVED: undo can put an IMPORTED graph back on the
      // canvas (import → draft → undo). The draft released the hold because a
      // CEE draft is CEE's own graph; the graph this restores may well not be,
      // so re-derive. Without this the dirty overlay set above is cleared by
      // the next 'fresh' verdict and the affirmative returns — the full P0,
      // in-session, no reload needed.
      importPendingServerRegistration: isGraphPendingImportRegistration(
        draftChatPreDraftSnapshot.nodes,
        draftChatPreDraftSnapshot.edges,
      ),
      ceePipelineTrace: null,
      // Graph Lens: auto-reset on draft undo (graph shape changed)
      lens: createDefaultLensState(),
    })

    // Crash resilience. Sourced from the POST-set() state (Zustand's set is
    // synchronous), so the autosave records exactly what the undo produced:
    // the pre-draft graph, and ceeAnalysisReady deliberately CLEARED by
    // READINESS_CLEAR_FIELDS above — the drafted verdict must not survive onto
    // a graph whose option nodes no longer exist. Previously this literal
    // omitted scenarioId, ceeAnalysisReady and selectedGoalNode, so an undo
    // REPLACED the periodic autosave with one that had lost the scenario id
    // and the goal selection.
    scenarios.saveAutosave(projectAutosaveData(autosaveSourceFromStore(get())))
  },

  setCeeAnalysisReady: (analysisReady: CEEAnalysisReady | null) => {
    if (import.meta.env.DEV) {
      console.warn('[Canvas] === SET CEE_ANALYSIS_READY ===')
      console.warn('[Canvas] setCeeAnalysisReady called with:', analysisReady ? 'payload' : 'null')
      if (analysisReady) {
        console.warn('[Canvas] options count:', analysisReady.options?.length)
        console.warn('[Canvas] goal_node_id:', analysisReady.goal_node_id)
      }
      console.trace('[Canvas] setCeeAnalysisReady call stack')
    }
    if (analysisReady) {
      // Store current node IDs for staleness detection
      const { nodes } = get()
      const nodeIds = nodes.map((n) => n.id)
      set({ ceeAnalysisReady: analysisReady, ceeAnalysisReadyNodeIds: nodeIds })
      // Sync goal threshold from CEE to store (fixes "?" badge on goals with thresholds).
      // goal_threshold_raw FIRST: the store field's contract is user units (see
      // the goalThreshold field comment). goal_threshold is normalised 0-1 — syncing
      // it here painted the Results target line at 0.8 when the real target was
      // 20% (staging trust review, 2026-07). When no raw arrives, the value is
      // bare NORMALISED 0-1 — Lane 5 (Codex P0-1) TAGS it 'normalised' rather
      // than storing it as raw: the old code assumed "capless ⇒ raw ≡
      // normalised", but the GOAL NODE can carry a cap the request boundary
      // then divides by (0.6 / 100 → 0.006 on the live wire). The explicit tag
      // makes the request boundary pass a normalised value through untouched.
      //
      // ROADMAP 2.315 PART 2 — THE CONSUMER DOES NOT RE-DERIVE AN ATTESTED VALUE.
      // A `norm × cap` branch used to sit here: when a payload carried a cap but
      // no raw, it multiplied them and TAGGED THE PRODUCT 'raw'. A value this
      // consumer computed was then indistinguishable, downstream, from one the
      // producer attested.
      //
      // ⚠ BE PRECISE ABOUT WHY IT IS GONE — an earlier draft of this comment said
      // CEE #798 "makes it reachable", and that is FALSE in a dangerous
      // direction. #798 is RAW-ANCHORED: a cap cannot reach the wire without a
      // raw beside it, so `ceeRaw != null` always wins and the norm × cap branch
      // stays UNREACHABLE. What #798 changed is that caps are emitted AT ALL —
      // and its anchor is precisely what keeps the branch dead. Crediting #798
      // with creating the hazard would invite a future reader to remove that
      // anchor believing the UI defends itself. (The anchor was verified in the
      // CEE repo by the paired review of #798/#563, not by this file's author.)
      //
      // The branch is removed as DEFENCE IN DEPTH against exactly that: the
      // anchor lives in another repo on another schema pin, and a consumer must
      // not be able to manufacture an attested magnitude if it ever loosens.
      //
      // Removing it does NOT reopen the double-normalisation that branch was
      // added to prevent. The value is stored UNTOUCHED and tagged 'normalised',
      // and `resolveChipGoalThreshold` (useV2Run.ts) short-circuits on that tag
      // and never divides by a cap. Same value on the wire, nothing invented,
      // and the display no longer claims a raw scale it cannot support.
      const ceeRaw = (analysisReady as any).goal_threshold_raw
      const ceeNorm = (analysisReady as any).goal_threshold
      let ceeThreshold: number | null | undefined
      let ceeRepresentation: 'raw' | 'normalised'
      if (ceeRaw != null) {
        ceeThreshold = ceeRaw
        ceeRepresentation = 'raw'
      } else {
        ceeThreshold = ceeNorm // bare, already 0-1 — stored as received, tagged
        ceeRepresentation = 'normalised'
      }
      // ROADMAP 2.315 PART 1 — ONE SENTENCE HAD TWO WRITERS AND TWO GATES.
      // This write (the NUMBER) was gated on `goalThreshold == null`. The goal
      // node's UNIT is written by `backfillGoalThresholdOntoGoalNode`, which is
      // UNGATED and fires from the same payload on every accepted graph_patch
      // (mirrorAnalysisReady) and every V5 turn carrying analysis_ready that
      // does not flow through applyDraftResult (applyV5State's catch-all).
      // READINESS_CLEAR_FIELDS clears neither. So a session that had already
      // stored a bare NORMALISED 0.8 kept the 0.8 while taking the later
      // payload's '£', and Inspector v2 rendered "≥ 0.8 £" — a magnitude on one
      // scale wearing the other scale's unit.
      //
      // The gate now also lets an ATTESTED RAW value supersede the store's own
      // un-attested normalised guess. It is safe against clobbering a user's
      // target because 'normalised' has exactly ONE writer in the repo — the
      // bare-sync branch immediately above.
      //
      // COMPLETE MANIFEST, 8 assignment sites (derive it again before relying on
      // it — `grep -rn "goalThresholdRepresentation:" src --include='*.ts'
      // --include='*.tsx'`, minus the three type declarations at :351/:1227/:1267):
      //   store.ts :1173, :1520, :3950  → null (initial state / resets)
      //   store.ts :1238, :1240         → deriveGoalThresholdFromNode: 'raw' | null
      //   store.ts :2920                → setGoalThreshold: opts.representation ?? 'raw'
      //                                   ← the ONLY site that can yield 'normalised',
      //                                     and the bare-sync above is its only
      //                                     non-test caller passing `representation:`
      //   store.ts :2927                → setGoalThresholdAndUpdateNode: hard-coded 'raw'
      //   applyDraftResult.ts :228      → null, written beside `goalThreshold: null`,
      //                                   so it cannot arm this gate
      // So the only state this can overwrite is a value this same reducer guessed.
      //
      // Untagged (null) is treated as raw here, as everywhere else in the
      // estate, so legacy/restored state is left alone.
      const supersedesOwnNormalisedGuess =
        ceeRepresentation === 'raw' && get().goalThresholdRepresentation === 'normalised'
      if (ceeThreshold != null && (get().goalThreshold == null || supersedesOwnNormalisedGuess)) {
        // Producer write (syncing the threshold FROM the analysis) — must not
        // self-dirty the freshness overlay.
        get().setGoalThreshold(
          typeof ceeThreshold === 'number' ? ceeThreshold : Number(ceeThreshold),
          { fromCeeSync: true, representation: ceeRepresentation },
        )
      }
      // Persist to sessionStorage for tab-refresh survival (with node IDs for validation)
      //
      // ⛔ EXCEPT A BLOCKED REFUSAL, which is not a readiness verdict and must
      // not survive a reload. `setAnalysisRefusalNotice` below states the rule
      // for its sibling in as many words — persisting it "would restore a
      // refusal into a session where no analysis was refused" — and after CEE
      // began carrying model identity on refusals, this payload is exactly that
      // shape. Restoring it hands the user the refusal's EVIDENCE on a fresh tab
      // while its EXPLANATION is deliberately withheld.
      //
      // `validateCeeAnalysisReady` rejects the same condition on the way back
      // in, so this is belt-and-braces: not writing it is cheaper than relying
      // on every restore path to check.
      const isBlockedRefusal = analysisReady.status === 'blocked'
      try {
        if (isBlockedRefusal) {
          sessionStorage.removeItem('olumi-cee-analysis-ready')
          sessionStorage.removeItem('olumi-cee-analysis-ready-node-ids')
        } else {
          sessionStorage.setItem('olumi-cee-analysis-ready', JSON.stringify(analysisReady))
          sessionStorage.setItem('olumi-cee-analysis-ready-node-ids', JSON.stringify(nodeIds))
        }
      } catch {}
    } else {
      logConstraintClearIfPresent(get, 'setCeeAnalysisReady(null)')
      set(READINESS_CLEAR_FIELDS)
      try {
        sessionStorage.removeItem('olumi-cee-analysis-ready')
        sessionStorage.removeItem('olumi-cee-analysis-ready-node-ids')
      } catch {}
    }
  },

  setDraftCoaching: (coaching: CEEDraftCoaching | null) => {
    set({ draftCoaching: coaching })
  },

  setV5AnalysisFact: (fact: V5AnalysisFactState | null) => {
    set({ v5AnalysisFact: fact })
  },

  // ROADMAP 2.1163 / EXT-2. Deliberately a plain assignment with NO
  // sessionStorage/localStorage write: this store has no persist() middleware,
  // so persistence is opt-in per setter (contrast setCeeAnalysisReady, which
  // writes 'olumi-cee-analysis-ready'). Adding a write here — or adding this
  // field to the autosave projection — would restore a refusal into a session
  // where no analysis was refused.
  setAnalysisRefusalNotice: (notice: AnalysisRefusalNotice | null) => {
    set({ analysisRefusalNotice: notice })
  },

  // Step 5. Deliberately a bare set with NO sessionStorage write and NO
  // autosave-projection entry — see the field's doc for why persisting a
  // composed verdict would assert it into a session where CEE never gave it.
  setAnalysisStateV1: (state: AnalysisStateV1 | null) => {
    set({ analysisStateV1: state })
  },

  setAnalysisFreshness: (rawAnalysisReady: unknown) => {
    set((state) => {
      const next = deriveAnalysisFreshnessUpdate(state.analysisFreshness, rawAnalysisReady)
      // A newly-applied analysis_ready verdict supersedes any pending local edits:
      // clear the dirty overlay. `next !== prev` is true only when the reducer
      // accepted a present payload (newer/unorderable) — absent or strictly-older
      // payloads retain BOTH the verdict and the dirty overlay.
      const verdictChanged = next !== state.analysisFreshness
      if (!verdictChanged) return {}
      const updates: Partial<CanvasState> = { analysisFreshness: next }
      // ...UNLESS an emitted edit is still undispatched. This verdict was
      // computed by the server WITHOUT that edit, so clearing the overlay here
      // would affirm "reflects the current model" over a change the server has
      // never seen. Keep the verdict (it is the newest thing the server said)
      // but hold the overlay until the edit actually reaches the wire.
      //
      // ...OR unless the payload never mentioned freshness at all
      // (VERDICT_ABSENT_FROM_PAYLOAD — a readiness-only `analysis_ready`, which
      // is exactly what a `graph_patch: applied` reply carries). Same argument,
      // weaker premise: the overlay records that the user changed the model since
      // the last verdict, and SILENCE about freshness is not evidence the server
      // re-verified anything. Clearing it there is what inverted the freshness
      // strip — bar present when CEE REJECTED the edit, absent when it APPLIED
      // it, taking the tab's only re-analyse control with it (ROADMAP 2.129 (a),
      // live-proven on staging `98aae72e`).
      const verdictIsSilentOnFreshness = next?.freshnessReason === VERDICT_ABSENT_FROM_PAYLOAD
      //
      // ...OR unless the canvas graph is an IMPORT the server has never seen
      // (interim 2.467, P0 trust — rewalk-2459b attempt 2). The verdict was
      // computed against CEE's OWN persisted graph; the import replaced the
      // canvas client-side only, so "fresh" here is a true statement about the
      // WRONG graph. Same argument as the pendingEmittedEdits hold, strongest
      // premise: the server has seen NONE of the current model. This is not
      // merely "don't clear": a 'fresh' verdict FORCES the overlay on, so the
      // affirmative is unreachable regardless of how the overlay was left by
      // earlier writes (e.g. a historical-restore's dirty:false).
      if (state.importPendingServerRegistration) {
        if (next?.freshness === 'fresh') {
          updates.analysisFreshnessDirty = true
        }
      } else if (
        state.analysisFreshnessDirty &&
        state.pendingEmittedEdits === 0 &&
        !verdictIsSilentOnFreshness
      ) {
        updates.analysisFreshnessDirty = false
      }
      return updates
    })
  },

  // Public dirty-overlay API for EXTERNAL mutators that bypass the internal edit
  // chokepoints — accepted CEE graph patches (bare-setState graph writes), the
  // context-menu commit path, and the draft producers. Delegates to the module
  // helper so the idempotent set lives in one place (no drift between the two).
  markAnalysisFreshnessDirty: () => markAnalysisFreshnessDirty(get, set),
  // The 3-flag staleness invariant for EXTERNAL structural mutators, set
  // atomically. Two staleness systems exist with disjoint readers: the legacy
  // pair (graphEditedSinceLastRun/analysisStateReady) and the freshness
  // overlay the banners actually read (analysisFreshnessDirty). A mutation
  // path that sets one and misses the other ships a false "analysis reflects
  // the current model" — that exact miss shipped once (#344). New external
  // mutators call THIS, not the flags piecemeal.
  markGraphStructurallyEdited: () => {
    set(() => ({ graphEditedSinceLastRun: true, analysisStateReady: false }))
    markAnalysisFreshnessDirty(get, set)
  },
  // F10: an analysis_result landed (new hash) but the response carried NO
  // freshness verdict. Overwrite the slice — never retain a pre-run 'stale'
  // over results the run itself just produced — and clear the local dirty
  // overlay (the run consumed the current graph). Deliberately bypasses
  // deriveAnalysisFreshnessUpdate: that reducer's retain-on-absence rule is
  // for CEE turns; this is a run-completion event, not a CEE verdict.
  //
  // The overwrite records the CEE verdict it replaced in `supersededVerdict`
  // so the reducer's echo guard keeps comparing against the last CEE payload
  // — otherwise a byte-identical pre-run 'stale' echoed on the next
  // conversational turn would read as NEW and resurrect "model changed" over
  // the run's own results. Flattened: chained run writes carry the deepest
  // CEE verdict, never a nested run write.
  noteRunCompletedWithoutVerdict: () => {
    set((state) => ({
      analysisFreshness: {
        freshness: 'unknown' as const,
        freshnessReason: RUN_COMPLETED_WITHOUT_VERDICT,
        supersededVerdict:
          state.analysisFreshness?.supersededVerdict ?? state.analysisFreshness ?? undefined,
      },
      // Same rule as setAnalysisFreshness: a run that completed without seeing
      // a still-undispatched edit must not un-dirty the overlay.
      // Interim 2.467: a run against an unregistered import keeps the overlay
      // too — the run consumed CEE's own graph, not the imported canvas.
      analysisFreshnessDirty:
        state.pendingEmittedEdits > 0 || state.importPendingServerRegistration,
    }))
  },
  clearAnalysisFreshnessDirty: () => {
    // Called when a genuinely NEW analysis_result lands. It still must not
    // clear the overlay while an emitted edit is queued behind the in-flight
    // lock — that analysis was computed without it.
    if (get().pendingEmittedEdits > 0) return
    // Interim 2.467: nor while the canvas graph is an import the server has
    // never seen — the new analysis_result was computed against CEE's own
    // pre-import graph (applyV5State calls this right after
    // setAnalysisFreshness applied the rerun's 'fresh'; clearing here would
    // undo the import hold and re-attach the affirmative — the exact
    // rewalk-2459b 2c-10 frame).
    if (get().importPendingServerRegistration) return
    if (get().analysisFreshnessDirty) set(() => ({ analysisFreshnessDirty: false }))
  },

  /**
   * Publish the dispatcher's undispatched-edit count. DERIVED from the
   * deferral buffer's own length by its owner — never incremented here.
   */
  setPendingEmittedEdits: (count: number) => {
    const next = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
    if (get().pendingEmittedEdits !== next) set(() => ({ pendingEmittedEdits: next }))
  },

  setGoalConstraints: (constraints, opts) => {
    // The goal constraints are sent to PLoT, so a USER change is
    // analysis-affecting → dirty the freshness overlay on a real content
    // change. Same class as setGoalThreshold (analysis-affecting-but-not-
    // structural): it uses markAnalysisFreshnessDirty ONLY, never the legacy
    // structural pair — the graph hash is constraint-blind (single-graph
    // 0.21.0, Paul-gated), and the banners that claimed a false "analysis
    // reflects the current model" read the freshness overlay. Producer/reset
    // callers (draft ingestion, V5 apply, run reset) pass fromProducerSync so
    // their ingestion write does not self-dirty. No-op discipline: a set whose
    // content equals the current value must NOT dirty.
    const changed = !goalConstraintsEqual(get().goalConstraints, constraints)
    set({ goalConstraints: constraints })
    if (changed && !opts?.fromProducerSync) markAnalysisFreshnessDirty(get, set)
  },

  setLastAuthoritativeGraph: (graph) => {
    set({ lastAuthoritativeGraph: graph })
  },

  setServerGraphIdentity: (identity) => {
    set({ serverGraphIdentity: identity })
  },

  setLastServerGraphHash: (hash) => {
    // Never absence→clear: a turn that carries no `graph_hash` says nothing
    // about the persisted graph, and forgetting the last good base would send
    // the next delete down the stand-down path for no reason. Only an explicit
    // null (decision-context change) clears, and that goes through
    // DECISION_CONTEXT_CLEAR rather than here.
    if (typeof hash !== 'string' || hash.length === 0) return
    if (get().lastServerGraphHash === hash) return
    set({ lastServerGraphHash: hash })
  },

  takePendingStructuralDeletes: () => {
    const queued = get().pendingStructuralDeletes
    if (queued.length === 0) return []
    set({ pendingStructuralDeletes: [] })
    return queued
  },

  takePendingStructuralRenames: () => {
    const queued = get().pendingStructuralRenames
    if (queued.length === 0) return []
    set({ pendingStructuralRenames: [] })
    return queued
  },

  takePendingStructuralAdds: () => {
    const queued = get().pendingStructuralAdds
    if (queued.length === 0) return []
    set({ pendingStructuralAdds: [] })
    return queued
  },

  beginStructuralAddSend: () => {
    const queued = get().pendingStructuralAdds
    if (queued.length === 0) return null
    const intent = queued[0]!
    const record: StructuralAddLifecycleRecord = {
      intent,
      // Captured at DISPATCH, exactly like the resolver's `scenarioIdAtDispatch`
      // — read later it would name whatever decision the user has since opened.
      scenarioId: get().currentScenarioId ?? null,
      status: 'in_flight',
    }
    // ONE `set()`: the gesture leaves the queue and enters the lifecycle in the
    // same transaction, so no observer can ever see it in neither.
    set((s) => ({
      pendingStructuralAdds: s.pendingStructuralAdds.slice(1),
      structuralAddLifecycle: [...s.structuralAddLifecycle, record].slice(
        -STRUCTURAL_ADD_LIFECYCLE_LIMIT,
      ),
    }))
    return record
  },

  settleStructuralAdd: (intentId, status: StructuralAddTerminalStatus) => {
    set((s) => {
      const idx = s.structuralAddLifecycle.findIndex((r) => r.intent.id === intentId)
      if (idx === -1) return {}
      const existing = s.structuralAddLifecycle[idx]!
      // IDEMPOTENT: a terminal verdict is never rewritten. Two authorities can
      // reach one attempt (the resolver inside `sendTurn`, and the drain's
      // every-exit settle), and the second must not downgrade the first.
      if (existing.status !== 'in_flight') return {}
      const next = s.structuralAddLifecycle.slice()
      next[idx] = { ...existing, status }
      return { structuralAddLifecycle: next }
    })
  },

  applyStructuralAddRevert: (removal) => {
    set((s) => {
      if (!s.nodes.some((n) => n.id === removal.nodeId)) return {}
      return {
        nodes: s.nodes.filter((n) => n.id !== removal.nodeId),
        // ⚠ NOT A USER EDIT — an add being REVERTED. Counter raised in the SAME
        // `set()` as the write; a later one arrives after the differ's
        // subscriber has already seen the change, and `useGraphEditEvents`
        // would then announce a removal the user never made
        // (`applyStructuralDeleteRevert`'s mutant MUT-ORDER, same mechanism).
        _externalMutationActive: s._externalMutationActive + 1,
      }
    })
    set((s) => ({ _externalMutationActive: Math.max(0, s._externalMutationActive - 1) }))
    markAnalysisFreshnessDirty(get, set)
  },

  beginStructuralRenameSend: () => {
    const queued = get().pendingStructuralRenames
    if (queued.length === 0) return null
    const intent = queued[0]!
    const record: StructuralRenameLifecycleRecord = {
      intent,
      // Captured at DISPATCH, exactly like the resolver's `scenarioIdAtDispatch`
      // — read later it would name whatever decision the user has since opened.
      scenarioId: get().currentScenarioId ?? null,
      status: 'in_flight',
    }
    // ONE `set()`: the gesture leaves the queue and enters the lifecycle in the
    // same transaction, so no observer can ever see it in neither.
    set((s) => ({
      pendingStructuralRenames: s.pendingStructuralRenames.slice(1),
      structuralRenameLifecycle: [...s.structuralRenameLifecycle, record].slice(
        -STRUCTURAL_RENAME_LIFECYCLE_LIMIT,
      ),
    }))
    return record
  },

  settleStructuralRename: (intentId, status: StructuralRenameTerminalStatus) => {
    set((s) => {
      const idx = s.structuralRenameLifecycle.findIndex((r) => r.intent.id === intentId)
      if (idx === -1) return {}
      const existing = s.structuralRenameLifecycle[idx]!
      // IDEMPOTENT: a terminal verdict is never rewritten. Two authorities can
      // reach one attempt (the resolver inside `sendTurn`, and the drain's
      // every-exit settle), and the second must not downgrade the first.
      if (existing.status !== 'in_flight') return {}
      const next = s.structuralRenameLifecycle.slice()
      next[idx] = { ...existing, status }
      return { structuralRenameLifecycle: next }
    })
  },

  applyStructuralRenameRevert: (restore) => {
    set((s) => ({
      nodes: s.nodes.map((n) => {
        if (n.id !== restore.nodeId) return n
        // Annotated, not inferred: `n.data`'s inferred type is narrow, so the
        // spread's result would not admit a `provenance` key and the two writes
        // below would be TS2339 under the gate's stricter project.
        const data: Record<string, unknown> = {
          ...(n.data as Record<string, unknown>),
          label: restore.label,
        }
        // "Absent" and "present with value undefined" are different bytes and
        // only one of them is what `provenance` means, so the key is DELETED
        // rather than written as undefined when it was not there before.
        if (restore.provenanceWasPresent) data.provenance = restore.provenance
        else delete data.provenance
        return { ...n, data } as typeof n
      }),
    }))
  },

  recordDurableDeletion: (removed) => {
    if (removed.nodeIds.length === 0 && removed.edgeIds.length === 0) return
    const record = addDurableDeletion(get().durablyDeletedElements, removed)
    // The receipt can land AFTER an undo has already put the elements back (the
    // send is a round-trip; Cmd+Z is instant). Reconcile the LIVE canvas so it
    // cannot keep asserting a node the server has proven gone — this is a no-op
    // in the ordinary case, where the elements left on the delete and never
    // returned.
    const { nodes, edges } = get()
    const reconciled = reconcileDurableDeletions({ nodes, edges }, record)
    const notice = buildDurableDeletionNotice(
      'reconciled',
      reconciled,
      { nodes, edges },
      nextDurableNoticeSeq(),
    )
    if (notice === null) {
      // Nothing came off the canvas: record the verdict and say nothing. A
      // notice here would announce a removal the user never saw happen.
      set({ durablyDeletedElements: record })
      return
    }
    set((s) => ({
      durablyDeletedElements: record,
      nodes: reconciled.nodes,
      edges: reconciled.edges,
      durableDeletionNotice: notice,
      ...deriveGoalThresholdFromNode(reconciled.nodes, s.outcomeNodeId),
    }))
    markAnalysisFreshnessDirty(get, set)
  },

  clearDurableDeletionNotice: () => {
    if (get().durableDeletionNotice === null) return
    set({ durableDeletionNotice: null })
  },

  applyStructuralDeleteRevert: (restore) => {
    if (restore.nodes.length === 0 && restore.edges.length === 0) return
    set((s) => {
      const presentNodeIds = new Set(s.nodes.map((n) => n.id))
      const presentEdgeIds = new Set(s.edges.map((e) => e.id))
      const nodes = [...s.nodes, ...restore.nodes.filter((n) => !presentNodeIds.has(n.id))]
      const edges = [...s.edges, ...restore.edges.filter((e) => !presentEdgeIds.has(e.id))]
      return {
        nodes,
        edges,
        // ⚠ NOT A USER EDIT — a delete being REVERTED. Counter raised in the SAME
        // `set()` as the write (a later one arrives after the subscriber has
        // already seen the change; mutant MUT-ORDER).
        _externalMutationActive: s._externalMutationActive + 1,
        // The restored graph is the one the server still holds, so any retained
        // 'fresh' verdict is no longer confirmable against what is on screen.
        ...deriveGoalThresholdFromNode(nodes, s.outcomeNodeId),
      }
    })
    set((s) => ({ _externalMutationActive: Math.max(0, s._externalMutationActive - 1) }))
    markAnalysisFreshnessDirty(get, set)
  },

  setCeePipelineTrace: (trace: CeePipelineTrace | null) => {
    if (import.meta.env.DEV && trace) {
      console.warn('[Canvas] setCeePipelineTrace:', {
        status: trace.status,
        total_duration_ms: trace.total_duration_ms,
        llm_call_count: trace.llm_call_count,
        stages: trace.stages.length,
      })
    }
    set({ ceePipelineTrace: trace })
  },

  // Note: nodeRationales is written directly via setState in DraftChat.tsx
  // (batched alongside other CEE metadata to avoid extra render commits).
  // No dedicated action — the data shape is trivial and only one call site exists.

  setCeeQuality: (quality: CeeQualityDimensions | null) => {
    if (import.meta.env.DEV && quality) {
      console.warn('[Canvas] setCeeQuality:', quality)
    }
    set({ ceeQuality: quality })
  },

  // Phase 1b actions
  setCeeExtendedWarnings: (warnings: CEEDraftWarning[] | null) => {
    if (import.meta.env.DEV && warnings) {
      console.warn('[Canvas] setCeeExtendedWarnings:', warnings.length, 'warnings')
    }
    set({ ceeExtendedWarnings: warnings })
  },

  setCeeGoalConnectivity: (connectivity: CEEGoalConnectivity | null) => {
    if (import.meta.env.DEV && connectivity) {
      console.warn('[Canvas] setCeeGoalConnectivity:', connectivity.status)
    }
    set({ ceeGoalConnectivity: connectivity })
  },

  setCeeModelQualityFactors: (factors: CEEModelQualityFactors | null) => {
    if (import.meta.env.DEV && factors) {
      console.warn('[Canvas] setCeeModelQualityFactors:', factors)
    }
    set({ ceeModelQualityFactors: factors })
  },

  setCeeInterventionHints: (hints: Record<string, CEEInterventionHint> | null) => {
    if (import.meta.env.DEV && hints) {
      console.warn('[Canvas] setCeeInterventionHints:', Object.keys(hints).length, 'hints')
    }
    set({ ceeInterventionHints: hints })
  },

  setPreAnalysisSensitivity: (sensitivity: PreAnalysisSensitivity | null) => {
    if (import.meta.env.DEV && sensitivity) {
      console.warn('[Canvas] setPreAnalysisSensitivity:', sensitivity.method,
        Object.keys(sensitivity.factor_influence).length, 'factors',
        Object.keys(sensitivity.edge_influence).length, 'edges')
    }
    set({ preAnalysisSensitivity: sensitivity })
  },

  setEngineLimits: (limits, source, fetchedAt, error) => {
    set({
      engineLimits: limits,
      engineLimitsSource: source,
      engineLimitsLoading: false,
      engineLimitsError: error ?? null,
      engineLimitsFetchedAt: fetchedAt,
    })
  },

  setEngineLimitsLoading: (loading) => {
    set({ engineLimitsLoading: loading })
  },

  // M4: Graph Health actions
  validateGraph: async () => {
    // Get nodes/edges for validation (before await to ensure consistency)
    const { nodes, edges } = get()

    // Dynamic import to avoid bundling validation if not used
    const { validateGraph: validate } = await import('./validation/graphValidator')
    const health = validate(nodes, edges)

    // Brief 37 Optimization: Re-check current store state AFTER async import
    // to avoid race conditions where multiple calls see stale existingHealth
    const existingHealth = get().graphHealth

    // Skip update if health is unchanged (prevents re-renders from new object refs)
    if (existingHealth &&
        existingHealth.status === health.status &&
        existingHealth.score === health.score &&
        existingHealth.issues.length === health.issues.length &&
        existingHealth.issues.every((issue, i) =>
          issue.id === health.issues[i]?.id &&
          issue.type === health.issues[i]?.type
        )) {
      return // No change, skip update
    }

    set({ graphHealth: health })
  },

  setShowIssuesPanel: (show: boolean) => {
    const prev = get().showIssuesPanel
    if (!prev && show) {
      trackIssuesOpened()
    }
    set({ showIssuesPanel: show })
    saveUIPreference('showIssuesPanel', show)
  },

  applyRepair: async (issueId: string) => {
    const { graphHealth, nodes, edges } = get()
    if (!graphHealth) return

    const issue = graphHealth.issues.find(i => i.id === issueId)
    if (!issue || !issue.suggestedFix) return

    // Push to history before repair
    pushToHistory(get, set)

    const { applyRepair: apply } = await import('./validation/graphRepair')
    const { nodes: repairedNodes, edges: repairedEdges } = apply(nodes, edges, issue.suggestedFix)

    const typedEdges: Edge<EdgeData>[] = repairedEdges.map(edge => ({
      ...edge,
      data: {
        ...DEFAULT_EDGE_DATA,
        ...(edge.data as Partial<EdgeData> | undefined ?? {}),
      },
    }))

    set({ nodes: repairedNodes, edges: typedEdges })
    invalidateAnalysisReady(get, set, `apply_repair (${issueId})`)

    // Re-validate after repair
    get().validateGraph()
  },

  applyAllRepairs: async () => {
    const { graphHealth, nodes, edges } = get()
    if (!graphHealth) return

    const fixableIssues = graphHealth.issues.filter(i => i.suggestedFix)
    if (fixableIssues.length === 0) return

    // Push to history before repairs
    pushToHistory(get, set)

    const { quickFixAll } = await import('./validation/graphRepair')
    const { nodes: repairedNodes, edges: repairedEdges } = quickFixAll(nodes, edges, graphHealth.issues)

    const typedEdges: Edge<EdgeData>[] = repairedEdges.map(edge => ({
      ...edge,
      data: {
        ...DEFAULT_EDGE_DATA,
        ...(edge.data as Partial<EdgeData> | undefined ?? {}),
      },
    }))

    set({ nodes: repairedNodes, edges: typedEdges })
    invalidateAnalysisReady(get, set, `apply_all_repairs (${fixableIssues.length} issues)`)

    // Re-validate after repairs
    get().validateGraph()
  },

  applyAutoFixChanges: (changes: { nodes?: Node[]; edges?: Edge<EdgeData>[] }) => {
    // Push to history before auto-fix (allows undo)
    pushToHistory(get, set)

    // Apply changes with proper typing
    const updates: Partial<CanvasState> = {}

    if (changes.nodes) {
      updates.nodes = changes.nodes
    }

    if (changes.edges) {
      updates.edges = changes.edges.map(edge => ({
        ...edge,
        data: {
          ...DEFAULT_EDGE_DATA,
          ...(edge.data as Partial<EdgeData> | undefined ?? {}),
        },
      }))
    }

    set(updates)
    invalidateAnalysisReady(get, set, 'apply_auto_fix_changes')

    // Re-validate after auto-fix
    get().validateGraph()
  },

  setNeedleMovers: (movers: NeedleMover[]) => {
    set({ needleMovers: movers })
  },

  // Phase 3: Interaction actions (accepts array, stores as Set for O(1) lookup)
  setHighlightedNodes: (ids: string[]) => {
    set({ highlightedNodes: new Set(ids) })
  },
  setOlumiAttention: (a) => {
    set({ olumiAttention: a })
  },
  clearOlumiAttention: () => {
    // No-op when nothing is held: an unconditional write churns identity and
    // re-renders every node subscribed to this slice.
    if (get().olumiAttention === null) return
    set({ olumiAttention: null })
  },
  setHighlightedEdges: (ids: string[]) => {
    set({ highlightedEdges: new Set(ids) })
  },
  // Analysis-graph projection (accepts arrays, stores as Sets for O(1) lookup
  // by edge/node components; same idiom as the highlight sets above).
  setAnalysisHighlight: (source, ids) => {
    set({
      analysisHighlight: {
        source,
        edgeIds: new Set(ids.edgeIds ?? []),
        nodeIds: new Set(ids.nodeIds ?? []),
      },
    })
  },
  clearAnalysisHighlight: () => {
    const cur = get().analysisHighlight
    // Idempotent: skip the write when already clear so we never churn the Set
    // identity and needlessly re-run every edge/node projection selector.
    if (cur.source === null && cur.edgeIds.size === 0 && cur.nodeIds.size === 0) return
    set({ analysisHighlight: { source: null, edgeIds: new Set<string>(), nodeIds: new Set<string>() } })
  },
  setDimmedNodes: (ids: string[]) => {
    set({ dimmedNodeIds: new Set(ids) })
  },
  // 6A: selection-dimmed edges. Skip-if-unchanged (same guard as
  // setEditedSinceRunNodes) because every StyledEdge subscribes to this set;
  // writing an equal-but-new Set on each effect run would re-render every edge
  // on the canvas for no visual change.
  setDimmedEdges: (ids: string[]) => {
    const prev = get().dimmedEdgeIds
    if (prev.size === ids.length && ids.every((id) => prev.has(id))) return
    set({ dimmedEdgeIds: new Set(ids) })
  },
  // F3 (graph-visuals): transient focus dim. Flows through the SAME
  // dimmedNodeIds field BaseNode's dim classes already consume — no new
  // node-side consumer. focusDimSourceId marks the dim as focus-owned so
  // usePathHighlight leaves it alone and clearFocusDim can't clobber a
  // selection path-dim.
  setFocusDim: (sourceId: string, dimmedIds: string[]) => {
    set({ focusDimSourceId: sourceId, dimmedNodeIds: new Set(dimmedIds) })
  },
  clearFocusDim: () => {
    if (get().focusDimSourceId === null) return
    set({ focusDimSourceId: null, dimmedNodeIds: new Set<string>() })
  },
  setLodActive: (active: boolean) => {
    if (get().lodActive === active) return
    set({ lodActive: active })
  },
  setEditedSinceRunNodes: (ids: string[]) => {
    // No-op set-skip when unchanged so the effect's recompute on every node
    // edit doesn't re-render all nodes needlessly.
    const prev = get().editedSinceRunNodeIds
    if (prev.size === ids.length && ids.every((id) => prev.has(id))) return
    set({ editedSinceRunNodeIds: new Set(ids) })
  },
  // S.4: Toggle "user-reviewed" confirmation (session-only, resets on refresh)
  toggleConfirmedNode: (nodeId: string) => {
    const current = get().confirmedNodeIds
    const next = new Set(current)
    if (next.has(nodeId)) {
      next.delete(nodeId)
    } else {
      next.add(nodeId)
    }
    set({ confirmedNodeIds: next })
  },
  // Decision Graph Display v2 Task 11: Option hover for intervention highlighting
  setHoveredOption: (optionId: string | null) => {
    // Correction #1: When lens option isolation is active, suppress hover updates
    // so the panel highlight stays on the lens-selected option.
    const { lens } = get()
    if (lens.active === 'option' && lens.selectedOptionId && optionId !== null) {
      return
    }
    set({ hoveredOptionId: optionId })
  },

  // Graph Lens actions
  setLens: (mode, optionId) => {
    const { lens: prev } = get()
    const updates: Partial<CanvasState> = {
      lens: { ...prev, active: mode, selectedOptionId: optionId ?? null },
    }
    // Panel sync: when selecting an option lens, update hoveredOptionId
    if (mode === 'option' && optionId) {
      updates.hoveredOptionId = optionId
    }
    // When switching away from option mode, clear hoveredOptionId
    if (mode !== 'option') {
      updates.hoveredOptionId = null
    }
    set(updates)
  },

  cycleLensOption: (direction) => {
    const state = get()
    if (state.lens.active !== 'option') return
    // option_comparison is a real V2RunResponse field that flows into the
    // ReportV1-typed slot but isn't declared on the static type. Mirrors
    // the established cast pattern at LensDropdown.tsx:96 (same field,
    // same purpose — lens picker dropdown vs. lens cycle hotkey).
    const options = (state.results.report as Record<string, unknown> | null | undefined)
      ?.option_comparison as Array<{ option_id: string; option_label: string }> | undefined
    if (!Array.isArray(options) || options.length === 0) return

    const currentId = state.lens.selectedOptionId
    const currentIndex = currentId
      ? options.findIndex((o: { option_id: string }) => o != null && typeof o === 'object' && o.option_id === currentId)
      : -1
    const len = options.length
    const nextIndex = direction === 'next'
      ? (currentIndex + 1) % len
      : (currentIndex - 1 + len) % len
    const nextOption = options[nextIndex] as { option_id?: string } | undefined
    const nextId = nextOption?.option_id
    if (!nextId) return
    set({
      lens: { ...state.lens, active: 'option', selectedOptionId: nextId },
      hoveredOptionId: nextId,
    })
  },

  resetLens: () => {
    const { lens } = get()
    if (lens.active === 'full' && lens.selectedOptionId === null && lens._dimmedNodeIds.size === 0) return
    set({ lens: createDefaultLensState(), hoveredOptionId: null })
  },

  setLensVisuals: (visuals) => {
    const { lens } = get()
    const EMPTY = new Set<string>()
    const EMPTY_CEP = new Map<string, CausalLensEdgeParams>()
    const EMPTY_ENC = new Map<string, 'grounded' | 'assumed' | 'none' | 'na'>()
    const EMPTY_EEC = new Map<string, 'evidence' | 'assumed' | 'unknown'>()
    // Skip no-op updates to avoid re-renders (use setsEqual/mapsEqual for collection comparison)
    if (
      setsEqual(lens._dimmedNodeIds, visuals.dimmedNodeIds) &&
      setsEqual(lens._dimmedEdgeIds, visuals.dimmedEdgeIds) &&
      setsEqual(lens._fragileEdgeIds, visuals.fragileEdgeIds) &&
      mapsEqual(lens._sensitivityWeights, visuals.sensitivityWeights) &&
      lens._sensitivityQuartiles?.q25 === visuals.sensitivityQuartiles?.q25 &&
      lens._sensitivityQuartiles?.q75 === visuals.sensitivityQuartiles?.q75 &&
      setsEqual(lens._hiddenNodeIds, visuals.hiddenNodeIds ?? EMPTY) &&
      setsEqual(lens._hiddenEdgeIds, visuals.hiddenEdgeIds ?? EMPTY) &&
      mapsEqual(lens._causalEdgeParams, visuals.causalEdgeParams ?? EMPTY_CEP) &&
      mapsEqual(lens._evidenceNodeClass, visuals.evidenceNodeClass ?? EMPTY_ENC) &&
      mapsEqual(lens._evidenceEdgeClass, visuals.evidenceEdgeClass ?? EMPTY_EEC)
    ) {
      return
    }
    set({
      lens: {
        ...lens,
        _dimmedNodeIds: visuals.dimmedNodeIds,
        _dimmedEdgeIds: visuals.dimmedEdgeIds,
        _sensitivityWeights: visuals.sensitivityWeights,
        _sensitivityQuartiles: visuals.sensitivityQuartiles,
        _fragileEdgeIds: visuals.fragileEdgeIds,
        _hiddenNodeIds: visuals.hiddenNodeIds ?? EMPTY,
        _hiddenEdgeIds: visuals.hiddenEdgeIds ?? EMPTY,
        _causalEdgeParams: visuals.causalEdgeParams ?? EMPTY_CEP,
        _evidenceNodeClass: visuals.evidenceNodeClass ?? EMPTY_ENC,
        _evidenceEdgeClass: visuals.evidenceEdgeClass ?? EMPTY_EEC,
      },
    })
  },

  // M5: Provenance actions
  addDocument: (document) => {
    // P0: Document memory guard - reject files >1MB
    const MAX_FILE_SIZE = 1 * 1024 * 1024 // 1MB
    const MAX_CHAR_PER_FILE = 5000 // 5k chars
    const MAX_TOTAL_CHARS = 25000 // 25k total

    if (document.size && document.size > MAX_FILE_SIZE) {
      throw new Error('This file is too large for in-app preview. Please reduce its size.')
    }

    // Calculate current total stored chars
    const { documents } = get()
    const currentTotal = documents.reduce((sum, doc) =>
      sum + (doc.displayBytes || 0), 0)

    // Truncate content if needed
    let content = document.content || ''
    let truncated = false
    if (content.length > MAX_CHAR_PER_FILE) {
      content = content.slice(0, MAX_CHAR_PER_FILE) + '…'
      truncated = true
    }

    const displayBytes = content.length

    // Check total cap
    if (currentTotal + displayBytes > MAX_TOTAL_CHARS) {
      throw new Error(`Document storage limit reached (${MAX_TOTAL_CHARS} chars). Remove existing documents to add new ones.`)
    }

    // Generate checksum for integrity (FNV-1a hash)
    const checksum = document.content
      ? generateContentHash(document.content)
      : undefined

    const id = crypto.randomUUID()
    const newDoc: Document = {
      ...document,
      id,
      content, // Truncated text only
      uploadedAt: new Date(),
      displayBytes,
      truncated,
      checksum
    }
    set(s => ({ documents: [...s.documents, newDoc] }))
    return id
  },

  removeDocument: (id) => {
    set(s => ({
      documents: s.documents.filter(d => d.id !== id),
      citations: s.citations.filter(c => c.documentId !== id)
    }))
  },

  // S7-FILEOPS: Rename document with undo/redo and event emission
  renameDocument: (id, newName) => {
    const { documents } = get()
    const doc = documents.find(d => d.id === id)
    if (!doc) return

    const oldName = doc.name
    const trimmed = newName.trim()

    // Update document name
    set(s => ({
      documents: s.documents.map(d =>
        d.id === id ? { ...d, name: trimmed } : d
      )
    }))

    // Emit rename event for provenance chip sync
    docsTest.emitDocumentRenamed(id, oldName, trimmed)

    // Push to history for undo/redo
    get().pushHistory()
  },

  // S7-FILEOPS: Set document search query with session persistence
  setDocumentSearchQuery: (query) => {
    set({ documentSearchQuery: query })
    saveSearchQuery(query)
  },

  // S7-FILEOPS: Set document sort with session persistence
  setDocumentSort: (field, direction) => {
    set({ documentSortField: field, documentSortDirection: direction })
    saveSortPreferences(field, direction)
  },

  // ⚠ NO CALLERS. `addCitation` has never been called — not here, not anywhere in
  // src/, and not once in the repo's entire history (`git log --all -S'addCitation('`
  // returns zero commits). `citations` is therefore empty by construction: it is
  // initialised `[]`, only ever FILTERED (on document delete), and the sole push is
  // the line below, which nothing reaches.
  //
  // Consequence: the Provenance Hub (ProvenanceHubTab, rendered from ReactFlowGraph)
  // can only ever render "0 citations from N documents" / "No citations found". The
  // M5 Grounding & Provenance milestone shipped its UI and its document-upload half,
  // but the citation-production half was never built. Do not wire an opener onto that
  // panel without first wiring a producer here.
  //
  // The live citation surface today is the conversation CitationLegend
  // (src/canvas/conversation/InlineBlocks.tsx), fed from the V5 stream at
  // useConversation.ts:~1300 — a different, working pipeline. See PR "stranded panels".
  addCitation: (citation) => {
    const id = crypto.randomUUID()
    const newCitation: Citation = {
      ...citation,
      id,
      createdAt: new Date()
    }
    set(s => ({ citations: [...s.citations, newCitation] }))
  },

  setShowProvenanceHub: (show: boolean) => {
    set({ showProvenanceHub: show })
    saveUIPreference('showProvenanceHub', show)
    // Task C: Panel coordination — opening provenance closes other right panels
    if (show) {
      useUIStore.getState().openRightPanel('provenance')
      set({ showAIClarifier: false })
    } else if (useUIStore.getState().activeRightPanel === 'provenance') {
      useUIStore.getState().closeRightPanel()
    }
  },

  setShowDocumentsDrawer: (show: boolean) => {
    set({ showDocumentsDrawer: show })
    saveUIPreference('showDocumentsDrawer', show)
  },

  toggleProvenanceRedaction: () => {
    set(s => ({ provenanceRedactionEnabled: !s.provenanceRedactionEnabled }))
  },

  setShowComparePanel: (show: boolean) => {
    set({ showComparePanel: show })
    saveUIPreference('showComparePanel', show)
  },

  // M6: Scenario Comparison Mode orchestrators.
  // These reset lens atomically alongside the comparison-mode write, so they
  // stay in canvas store. They call useComparisonStore for the comparison-state
  // write (canvas -> extracted store direction is allowed).
  enterComparisonMode: (scenariosOrScenarioA, scenarioB, comparison = null, apiResponse = null, meta = {}) => {
    const scenarios = (Array.isArray(scenariosOrScenarioA)
      ? scenariosOrScenarioA
      : [scenariosOrScenarioA, scenarioB]
    ).filter((scenario): scenario is { nodes: Node[]; edges: Edge<EdgeData>[]; label: string } => Boolean(scenario))

    const labels = scenarios.map((scenario) => scenario.label)

    useComparisonStore.getState().setComparisonMode({
      active: true,
      scenarios,
      labels,
      selectedIndices: [0, 1],
      hasMoreOptions: meta.hasMoreOptions ?? false,
      allOptionsCount: meta.allOptionsCount ?? scenarios.length,
      comparison,
      apiResponse,
    })
    set({ lens: createDefaultLensState() })
  },

  exitComparisonMode: () => {
    useComparisonStore.getState().setComparisonMode({
      active: false,
      scenarios: [],
      labels: [],
      selectedIndices: [0, 1],
      hasMoreOptions: false,
      allOptionsCount: 0,
      comparison: null,
      apiResponse: null,
    })
    set({ lens: createDefaultLensState() })
  },

  // Pending-layout setter (D2 of layout-stabilisation brief). Setting to
  // true also bumps layoutRequestId so the measurement hook in
  // ReactFlowGraph can detect a second draft arriving before the first has
  // settled and supersede it (stale-request guard).
  setPendingLayout: (value: boolean) => {
    if (value) {
      set({ pendingLayout: true, layoutRequestId: get().layoutRequestId + 1 })
    } else {
      set({ pendingLayout: false })
    }
  },

  // Debug: Raw CEE output mode setter
  setDebugRawCeeOutput: (value: boolean) => {
    if (value) {
      console.warn('[CEE] Raw output mode enabled')
    }
    set({ debugRawCeeOutput: value })
  },

  // Canvas view mode setter (persists to sessionStorage, triggers relayout to prevent overlap)
  setViewMode: (mode: 'standard' | 'expert') => {
    if (get().viewMode === mode) return
    set({ viewMode: mode })
    try { sessionStorage.setItem('canvas.viewMode', mode) } catch { /* noop */ }
    // Detailed view expands nodes — relayout after React measures new sizes.
    // NOTE: silent failure here materially harms diagnosis — route through
    // the layout progress store so the banner surfaces the error + retry.
    setTimeout(() => {
      handleLayoutWithRecovery(() => get().applyLayout())
    }, 150)
  },

  // Week 3: AI Clarifier actions
  setShowAIClarifier: (show: boolean) => {
    set({ showAIClarifier: show })
    // Close draft chat when opening clarifier
    if (show) {
      set({ showDraftChat: false })
      // Task C: Panel coordination — opening clarifier closes other right panels
      useUIStore.getState().openRightPanel('clarifier')
      set({ showProvenanceHub: false })
    }
    // Clean up clarifier state when closing
    if (!show) {
      get().completeClarifierSession()
      if (useUIStore.getState().activeRightPanel === 'clarifier') {
        useUIStore.getState().closeRightPanel()
      }
    }
  },

  startClarifierSession: (prompt: string, context: string) => {
    set({
      clarifierSession: {
        prompt,
        context,
        answers: [],
        round: 0,
        status: 'active',
      },
      clarifierPreviewNodeIds: [],
      clarifierPreviewEdgeIds: [],
    })
  },

  updateClarifierAnswers: (answers: Array<{ question_id: string; answer: string }>) => {
    set(s => {
      if (!s.clarifierSession) return s
      return {
        clarifierSession: {
          ...s.clarifierSession,
          answers,
          round: s.clarifierSession.round + 1,
        },
      }
    })
  },

  completeClarifierSession: () => {
    const state = get()
    // Remove any preview nodes/edges that weren't finalized
    if (state.clarifierPreviewNodeIds.length > 0 || state.clarifierPreviewEdgeIds.length > 0) {
      set(s => ({
        nodes: s.nodes.filter(n => !s.clarifierPreviewNodeIds.includes(n.id)),
        edges: s.edges.filter(e => !s.clarifierPreviewEdgeIds.includes(e.id)),
        clarifierSession: null,
        clarifierPreviewNodeIds: [],
        clarifierPreviewEdgeIds: [],
      }))
    } else {
      set({
        clarifierSession: null,
        clarifierPreviewNodeIds: [],
        clarifierPreviewEdgeIds: [],
      })
    }
  },

  applyClarifierGraph: (graph: { nodes: any[]; edges: any[] }, options: { preview: boolean }) => {
    const state = get()

    // Remove any existing preview nodes/edges first
    const existingNodes = state.nodes.filter(n => !state.clarifierPreviewNodeIds.includes(n.id))
    const existingEdges = state.edges.filter(e => !state.clarifierPreviewEdgeIds.includes(e.id))

    // CRITICAL: Build ID mapping from old -> new node IDs
    // This ensures edges point to the correct newly-created nodes
    const nodeIdMap = new Map<string, string>()

    if (options.preview) {
      // Add as ghost nodes/edges (preview mode)
      const previewNodes = graph.nodes.map((n: any, idx: number) => {
        const newId = `preview-${state.nextNodeId + idx}`
        // Map original node ID to new preview ID
        nodeIdMap.set(n.id, newId)

        return {
          id: newId,
          type: n.kind || n.type || 'decision',
          position: n.position || { x: 200 + (idx % 3) * 250, y: 100 + Math.floor(idx / 3) * 200 },
          data: {
            label: n.label || 'Untitled',
            body: n.body,
            isPreview: true,
          },
          style: {
            opacity: 0.6,
            border: '2px dashed var(--sky-500)',
          },
        }
      })

      const previewEdges = graph.edges.map((e: any, i: number) => {
        const originalSource = e.from || e.source
        const originalTarget = e.to || e.target

        // Use mapped IDs - this is the critical fix!
        const mappedSource = nodeIdMap.get(originalSource)
        const mappedTarget = nodeIdMap.get(originalTarget)

        // Skip edge if nodes don't exist in mapping
        if (!mappedSource || !mappedTarget) {
          console.warn('[applyClarifierGraph] Skipping edge - node not found in mapping:', {
            originalSource,
            originalTarget,
            availableIds: Array.from(nodeIdMap.keys()),
          })
          return null
        }

        // v1.2: Determine edge kind based on data available
        // If probability is present → decision-probability, otherwise → influence-weight
        const hasProb = e.probability !== undefined
        const edgeKind = hasProb ? 'decision-probability' as const : 'influence-weight' as const
        // Use probability for confidence, fall back to belief if no probability
        const confidence = e.probability ?? e.belief ?? 0.5

        return {
          id: `preview-e${state.nextEdgeId + i}`,
          source: mappedSource,
          target: mappedTarget,
          type: 'styled',
          data: {
            ...DEFAULT_EDGE_DATA,
            kind: edgeKind,
            weight: e.weight ?? 0.5,
            belief: e.belief ?? confidence,
            confidence,
            // Set-vs-defaulted markers (domain/edgeValueProvenance.ts). Stamped
            // only when the clarifier actually sent the value; the `?? 0.5`
            // fallthrough above is a UI default and stays unstamped.
            ...edgeValueSourcePatch({
              weight: e.weight != null ? 'cee' : undefined,
            }),
            isPreview: true,
          },
          style: {
            strokeDasharray: '5,5',
            opacity: 0.6,
          },
        }
      }).filter(Boolean) as typeof existingEdges

      // ⚠ NOT A USER EDIT — a clarifier PREVIEW being inserted. Same-`set()`
      // suppression, for the reason in applyStructuralDeleteRevert.
      set((s) => ({
        nodes: [...existingNodes, ...previewNodes],
        edges: [...existingEdges, ...previewEdges],
        clarifierPreviewNodeIds: previewNodes.map(n => n.id),
        clarifierPreviewEdgeIds: previewEdges.map(e => e.id),
        _externalMutationActive: s._externalMutationActive + 1,
      }))
      set((s) => ({ _externalMutationActive: Math.max(0, s._externalMutationActive - 1) }))

      // Auto-layout to arrange nodes using ELK layered algorithm (top-down)
      if (import.meta.env.DEV) {
        console.warn('[applyClarifierGraph] Applying ELK layout after clarifier insertion (preview)', {
          addedNodes: previewNodes.length,
          addedEdges: previewEdges.length,
          totalNodes: get().nodes.length,
          totalEdges: get().edges.length,
        })
      }
      // P1.3: defer layout via measurement-aware lifecycle. The hook in
      // ReactFlowGraph runs applyLayout once nodes are measured;
      // layoutVersion increments and drives fitView.
      get().setPendingLayout(true)
    } else {
      // Apply permanently (finalize mode)
      pushToHistory(get, set)

      const finalNodes = graph.nodes.map((n: any, idx: number) => {
        const newId = state.createNodeId()
        // Map original node ID to new final ID
        nodeIdMap.set(n.id, newId)

        return {
          id: newId,
          type: n.kind || n.type || 'decision',
          position: n.position || { x: 200 + (idx % 3) * 250, y: 100 + Math.floor(idx / 3) * 200 },
          data: {
            label: n.label || 'Untitled',
            body: n.body,
            uncertainty: n.uncertainty,
          },
        }
      })

      const finalEdges = graph.edges.map((e: any) => {
        const originalSource = e.from || e.source
        const originalTarget = e.to || e.target

        // Use mapped IDs - this is the critical fix!
        const mappedSource = nodeIdMap.get(originalSource)
        const mappedTarget = nodeIdMap.get(originalTarget)

        // Skip edge if nodes don't exist in mapping
        if (!mappedSource || !mappedTarget) {
          console.warn('[applyClarifierGraph] Skipping edge - node not found in mapping:', {
            originalSource,
            originalTarget,
            availableIds: Array.from(nodeIdMap.keys()),
          })
          return null
        }

        const id = state.createEdgeId()
        // v1.2: Determine edge kind based on data available
        // If probability is present → decision-probability, otherwise → influence-weight
        const hasProb = e.probability !== undefined
        const edgeKind = hasProb ? 'decision-probability' as const : 'influence-weight' as const
        // Use probability for confidence, fall back to belief if no probability
        const confidence = e.probability ?? e.belief ?? 0.5

        return {
          id,
          source: mappedSource,
          target: mappedTarget,
          type: 'styled',
          data: {
            ...DEFAULT_EDGE_DATA,
            kind: edgeKind,
            weight: e.weight ?? 0.5,
            belief: e.belief ?? confidence,
            confidence,
            // As in the preview path above: stamp only what the clarifier sent.
            ...edgeValueSourcePatch({
              weight: e.weight != null ? 'cee' : undefined,
            }),
            provenance: e.provenance || 'AI-drafted',
          },
        }
      }).filter(Boolean) as typeof existingEdges

      set({
        nodes: [...existingNodes, ...finalNodes],
        edges: [...existingEdges, ...finalEdges],
        clarifierPreviewNodeIds: [],
        clarifierPreviewEdgeIds: [],
        clarifierSession: null,
        showAIClarifier: false,
      })

      // Auto-layout to arrange nodes using ELK layered algorithm (top-down)
      if (import.meta.env.DEV) {
        console.warn('[applyClarifierGraph] Applying ELK layout after clarifier insertion (finalize)', {
          addedNodes: finalNodes.length,
          addedEdges: finalEdges.length,
          totalNodes: get().nodes.length,
          totalEdges: get().edges.length,
        })
      }
      // P1.3: defer layout via measurement-aware lifecycle.
      get().setPendingLayout(true)
    }
  },

  clearClarifierPreview: () => {
    const state = get()
    const remainingNodes = state.nodes.filter(n => !state.clarifierPreviewNodeIds.includes(n.id))
    const remainingEdges = state.edges.filter(e => !state.clarifierPreviewEdgeIds.includes(e.id))
    // ⚠ NOT A USER EDIT — a clarifier preview being WITHDRAWN. Same-`set()`
    // suppression, for the reason in applyStructuralDeleteRevert.
    set((s) => ({
      nodes: remainingNodes,
      edges: remainingEdges,
      clarifierPreviewNodeIds: [],
      clarifierPreviewEdgeIds: [],
      _externalMutationActive: s._externalMutationActive + 1,
    }))
    set((s) => ({ _externalMutationActive: Math.max(0, s._externalMutationActive - 1) }))
  },

  exportLocal: () => {
    const { nodes, edges, results } = get()
    const currentDecisionRationale = useComparisonStore.getState().currentDecisionRationale

    const exportData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      graph: { nodes, edges },
      lastRun: results.report ? {
        // summary lives at insights.summary on ReportV1; bands prefer the
        // normalised run.bands path with results.{conservative,likely,optimistic}
        // as the legacy fallback (matches extractP50 in runHistory.ts:266).
        summary: results.report.insights?.summary,
        p10: results.report.run?.bands?.p10 ?? results.report.results?.conservative ?? null,
        p50: results.report.run?.bands?.p50 ?? results.report.results?.likely ?? null,
        p90: results.report.run?.bands?.p90 ?? results.report.results?.optimistic ?? null,
        seed: results.seed,
        hash: results.hash
      } : null,
      rationale: currentDecisionRationale,
      note: 'Local export — openable on this device/profile only.'
    }

    return JSON.stringify(exportData, null, 2)
  },

  // P2: Hydration hygiene - merge only graph/scenario bits, ignore unknown keys
  hydrateGraphSlice: (loaded) => {
    const updates: Partial<CanvasState> = {}

    // Only merge known graph/scenario keys
    if (loaded.nodes !== undefined) {
      updates.nodes = loaded.nodes
    }
    if (loaded.edges !== undefined) {
      updates.edges = loaded.edges
    }
    if (loaded.currentScenarioId !== undefined) {
      updates.currentScenarioId = loaded.currentScenarioId
      // Wave F-A: option ordinals are per-scenario continuity — a hydrated
      // scenario starts a fresh numbering history.
      updates.optionNumbering = {}
    }

    // Reset history and selection for clean state
    if (loaded.nodes || loaded.edges) {
      updates.history = { past: [], future: [] }
      updates.selection = { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null }
      updates.touchedNodeIds = new Set()
      // A loaded graph is a new context — clear the freshness verdict and its
      // dirty overlay so neither leaks from the previous graph/scenario.
      updates.analysisFreshness = null
      updates.analysisFreshnessDirty = false
      // ROADMAP 2.1163 / EXT-2 — same argument as the verdict: a refusal
      // belongs to the graph it was refused for.
      updates.analysisRefusalNotice = null
      // Step 5 — a composed analysis-state verdict belongs to the graph it was
      // composed for, and it outranks the local derivations, so leaking it
      // across a load would be worse than leaking the verdict alone.
      updates.analysisStateV1 = null
      // Interim 2.467, DERIVED (see the field's doc): this path's live callers
      // pass the localStorage AUTOSAVE or loadState() — NOT a server-known
      // graph. Re-deriving from the graph being installed is what makes a
      // reload that restores the imported graph keep the hold, while a hydrate
      // of any other graph releases it.
      updates.importPendingServerRegistration = isGraphPendingImportRegistration(
        loaded.nodes,
        loaded.edges,
      )
      // Lane 5 (Codex P0-2): this is the PRODUCTION scenario-load path
      // (useScenario → hydrateGraphSlice). Before this, it cleared freshness
      // but RETAINED goalThreshold / ceeAnalysisReady / outcomeNodeId, so the
      // canonical default-attach could send the previous decision's target on
      // the newly-loaded scenario's run. The Supabase loader does NOT restore
      // these afterwards (review fold: the earlier claim was wrong) — so the
      // threshold/readiness are cleared and the outcome selection is
      // RE-DERIVED to the loaded graph's own goal node (not left null, which
      // empties the goal selector, nor left stale).
      Object.assign(updates, DECISION_CONTEXT_CLEAR)
      // Re-derive the full goal context (outcome selection + threshold scalar +
      // representation) from the RESTORED graph's own goal node, in one call, so
      // the two halves cannot drift. The node's success_threshold
      // (threshold_source==='user') rides nodes[] and is the durable source of
      // truth; the scalar is a derived cache. DECISION_CONTEXT_CLEAR above nulled
      // it — without this re-derive the guest autosave restore path left it null
      // and the V7 goal lens gated 'no_target' though the node carried a target
      // (live defect, 2026-07-23). outcomeNodeId is re-derived here (not left
      // null, which empties the goal selector, nor left stale); the threshold is
      // {null,null} when the goal node carries no user target.
      Object.assign(updates, deriveGoalContext(loaded.nodes))
      // B3: assign the LOADED constraints or null — never leave the previous
      // scenario's in place. DECISION_CONTEXT_CLEAR above already nulled the
      // field; this line is what makes a cold load RESTORE it. The `?? null`
      // is load-bearing: an absent key must clear, not inherit.
      updates.goalConstraints = loaded.goalConstraints ?? null
      // B2: the persisted graph IS CEE's view of this scenario, so everything
      // in it is an element CEE has acknowledged. Seeding the identity set
      // here is what lets the FIRST applied-edit receipt after a cold load
      // reconcile a deletion; without it the reconciler would fail safe and
      // never remove anything until a second receipt arrived.
      updates.lastAuthoritativeGraph = identityFromCanvasGraph(
        loaded.nodes,
        loaded.edges,
      )
    }

    // Apply updates without clobbering panels/results/other slices
    // A.7: Increment suppression counter before mutating
    set((s) => ({ ...updates, _externalMutationActive: s._externalMutationActive + 1 }))
    try {
      // Reseed IDs to prevent collisions
      if (loaded.nodes && loaded.edges) {
        get().reseedIds(loaded.nodes, loaded.edges)
      }
    } finally {
      // A.7: End suppression after hydration (always, even on throw)
      set((s) => ({ _externalMutationActive: Math.max(0, s._externalMutationActive - 1) }))
    }
  },

  cleanup: clearTimers,

  // A.7: External mutation suppression — reference-counted so nested calls
  // don't prematurely clear suppression when two callers overlap.
  beginExternalGraphMutation: (source, opts) => {
    if (import.meta.env.DEV) {
      console.debug(`[canvas] beginExternalGraphMutation(${source})`)
    }
    set((s) => ({
      _externalMutationActive: s._externalMutationActive + 1,
      ...(opts?.suppressHistory ? { _suppressHistory: true } : {}),
    }))
  },

  endExternalGraphMutation: () => {
    set((s) => ({
      _externalMutationActive: Math.max(0, s._externalMutationActive - 1),
      _suppressHistory: false,
    }))
  },

  updateScenarioFraming: (partial) => {
    set(s => ({
      currentScenarioFraming: {
        ...(s.currentScenarioFraming ?? {}),
        ...partial,
      },
      isDirty: true,
    }))
  }
}})

// Expose store on window for E2E tests (Playwright helpers and direct injection)
if (typeof window !== 'undefined') {
  ;(window as any).useCanvasStore = useCanvasStore
}

// Crash-moment autosave flush: give the canvas error boundary (entry chunk,
// must not import this module) a way to snapshot the CURRENT graph into the
// autosave slot the production boot path restores from. Registered at module
// init so it covers every surface that mounts the store, with no mount-order
// or unmount-timing dependency. See persist/crashFlush.ts.
registerCrashSnapshotProvider(() => {
  const s = useCanvasStore.getState()
  return {
    nodes: s.nodes,
    edges: s.edges,
    scenarioId: s.currentScenarioId,
    ceeAnalysisReady: s.ceeAnalysisReady ?? undefined,
    // Must match the periodic autosave's field set — the crash flush REPLACES
    // whatever the 30s timer last wrote. CrashSnapshot's fields are required
    // so an omission here is a compile error, not a silent field drop.
    //
    // Read through an index cast because `selectedGoalNode` is NOT declared on
    // CanvasState (see autosaveProjection's note): RecoveryBanner writes it via
    // a bare setState and useAutosave reads it through a pre-existing wide-tsc
    // error. Casting here keeps the crash path at parity with the timer without
    // inventing a store field this lane has no mandate to add.
    selectedGoalNode: (s as unknown as { selectedGoalNode?: string | null }).selectedGoalNode ?? null,
    // The answer rides the crash flush too — a crash after a completed analysis
    // must not be the one path that silently drops it.
    analysis: analysisSnapshotFromStore(s),
    // ROADMAP 2.932: the constraints ride the crash flush too, at parity with
    // the 30s timer — a crash must not be the one path that drops them.
    goalConstraints: s.goalConstraints ?? null,
  }
})

// F3 (graph-visuals): the focus dim must never survive its focused node.
// Nodes can be removed by MANY paths (delete action, AI patch, undo, full
// graph replacement), so the invariant lives at the store boundary rather
// than in each mutation: whenever the nodes array changes while a focus dim
// is active, clear the dim if its source node is gone. Near-zero cost — the
// guard exits on the first check unless a focus dim is active.
useCanvasStore.subscribe((state, prevState) => {
  const sourceId = state.focusDimSourceId
  if (sourceId === null || state.nodes === prevState.nodes) return
  if (!state.nodes.some((n) => n.id === sourceId)) {
    state.clearFocusDim()
  }
})

// React #185 DEBUG: Internal set() instrumentation is now done at store creation time
// (see createDebugSet function above) - this captures ALL store updates including
// those from store actions that use the internal `set` function.
//
// Usage: Add ?stateDebug=1 to URL, then after React #185 error, run in console:
//   window.__SAFE_DEBUG__.logs.filter(l => l.m === 'canvas:set').slice(-30)
// Look for repeating stack traces - that's the looping culprit!

/**
 * Validation selectors and helpers
 */

// Re-export InvalidNodeInfo type for compatibility
export type InvalidNode = InvalidNodeInfo

/**
 * Get all nodes with invalid outgoing probability sums
 * A node is invalid if it has 2+ non-zero outgoing edges and probabilities don't sum to 100% (±1%)
 * Uses shared validation util with touched node tracking to avoid flagging pristine nodes
 */
export const getInvalidNodes = (state: CanvasState): InvalidNode[] => {
  return getInvalidNodesUtil(state.nodes as Node<NodeData>[], state.edges, state.touchedNodeIds)
}

/**
 * Check if the canvas has any validation errors
 */
export const hasValidationErrors = (state: CanvasState): boolean => {
  return getInvalidNodes(state).length > 0
}

/**
 * Get the next invalid node (for Alt+V cycling)
 * If currentNodeId is provided, returns the next invalid node after it
 * Otherwise returns the first invalid node
 */
export const getNextInvalidNode = (state: CanvasState, currentNodeId?: string): InvalidNode | null => {
  return getNextInvalidNodeUtil(state.nodes as Node<NodeData>[], state.edges, state.touchedNodeIds, currentNodeId)
}

/**
 * Results panel selectors
 */
export const selectResultsStatus = (state: CanvasState): ResultsStatus => state.results.status
export const selectProgress = (state: CanvasState): number => state.results.progress
/**
 * Wave1-L2: wall-clock ms when the in-flight run started. Every path that
 * enters a running status stamps it, and it lives in the store rather than in
 * component state, so run-status narration keeps the TRUE elapsed time across
 * remounts and tab switches.
 */
export const selectResultsStartedAt = (state: CanvasState): number | undefined => state.results.startedAt
export const selectReport = (state: CanvasState): ReportV1 | null | undefined => state.results.report
export const selectDrivers = (state: CanvasState): Array<{ kind: 'node' | 'edge'; id: string }> | undefined => state.results.drivers
// ⚠ ROADMAP 2.1127 — this selector's return type was a HAND-COPIED duplicate of
// the `results.error` field type (`:202`) and had drifted: `canRetry` is
// accepted by `resultsError`, written into the state, and declared on the state
// — but was missing here, so every consumer reading through this selector was
// blind to a field the store actually carries. Derived from the state type now,
// so it cannot drift again (CLAUDE.md trap 12: derive, don't mirror).
export const selectError = (state: CanvasState): CanvasState['results']['error'] => state.results.error

/**
 * ROADMAP 2.1127 — is the report currently on screen PROVABLY from a run
 * EARLIER than the one that just failed?
 *
 * Three outcomes, and the third is the point:
 *   true  — stamps present and different: a genuinely previous run's results.
 *   false — stamps present and equal: the failure landed AFTER this run's own
 *           `resultsComplete` (useV2Run's unguarded window, `:991`→`:1109`), so
 *           the numbers on screen ARE this run's.
 *   false — either stamp missing: provenance UNKNOWN. A surface may not claim
 *           "previous analysis" on an unknown, so unknown fails CLOSED to no
 *           claim rather than to the more convenient one.
 */
export const selectReportIsFromEarlierRun = (state: CanvasState): boolean => {
  const { reportEpoch, errorEpoch, report } = state.results
  if (!report) return false
  if (typeof reportEpoch !== 'number' || typeof errorEpoch !== 'number') return false
  return reportEpoch !== errorEpoch
}
export const selectRunId = (state: CanvasState): string | undefined => state.results.runId
export const selectSeed = (state: CanvasState): number | undefined => state.results.seed
export const selectHash = (state: CanvasState): string | undefined => state.results.hash
/** A.9: Provenance of the current results — 'direct' | 'conversation' | undefined */
export const selectResultsSource = (state: CanvasState): 'direct' | 'conversation' | undefined => state.results.resultsSource
/** A1: Previous report snapshot for delta display */
export const selectPreviousReport = (state: CanvasState): PreviousReportSnapshot | null => state.previousReport

/**
 * Graph Lens selectors
 */
export type LensMode = 'full' | 'option' | 'sensitivity' | 'fragile' | 'causal' | 'evidence' | 'robustness'
export const selectLensMode = (state: CanvasState): LensMode => state.lens.active
export const selectLensOptionId = (state: CanvasState): string | null => state.lens.selectedOptionId

/**
 * Canvas view mode selector
 */
export type ViewMode = 'standard' | 'expert'
export const selectViewMode = (state: CanvasState): ViewMode => state.viewMode
