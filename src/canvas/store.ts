// Hardened store with timer cleanup, ID reseeding, edge debouncing
import { create } from 'zustand'
import { Node, Edge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from '@xyflow/react'
import { saveSnapshot as persistSnapshot, importCanvas as persistImport, exportCanvas as persistExport } from './persist'
import { setsEqual, mapsEqual } from './store/utils'
import { assignStableOptionNumbers } from './store/stableOptionNumbers'
import { DEFAULT_EDGE_DATA, USER_EDGE_DEFAULTS, type EdgeData } from './domain/edges'
import { NODE_REGISTRY, type NodeType, type NodeData } from './domain/nodes'
import { hasAnalyticalNodeChange, hasAnalyticalEdgeChange } from './domain/analyticalChange'
import { applyLayout, applyLayoutWithPolicy } from './layout'
import { mergePolicy } from './layout/policy'
import { policyToPreset, policyToSpacing } from './layout/adapters'
import { getInvalidNodes as getInvalidNodesUtil, getNextInvalidNode as getNextInvalidNodeUtil, type InvalidNodeInfo } from './utils/validateOutgoing'
import type { ReportV1 } from '../adapters/plot/types'
import type { V2RunResponse } from '../adapters/plot/v2/types'
import type { PLoTEnrichment } from '../adapters/plot/enrichment'
import { trackResultsViewed, trackIssuesOpened } from './utils/sandboxTelemetry'
import { addRun, generateGraphHash, loadRuns, type StoredRun } from './store/runHistory'
import { RUN_COMPLETED_WITHOUT_VERDICT, deriveAnalysisFreshnessUpdate, type AnalysisFreshnessState } from './store/analysisFreshness'
import * as scenarios from './store/scenarios'
import type { ScenarioFraming } from './store/scenarios'
import { projectAutosaveData, autosaveSourceFromStore } from './store/autosaveProjection'
import { registerCrashSnapshotProvider } from './persist/crashFlush'
import type { GraphHealth, ValidationIssue, NeedleMover } from './validation/types'
import type { Document, Citation } from './share/types'
import type { ComparisonResult } from './snapshots/types'
import type { CeeDecisionReviewPayload, CeeTraceMeta, CeeErrorViewModel } from './decisionReview/types'
import type { CeeDecisionReviewPayloadV1, CeeTrace, CeeError, M1Review, M1Coaching, ErrorDetail } from '../types/cee'
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
import { isCompareTabEnabled } from '../flags'
import { useAnalysisSnapshotStore } from './stores/analysisSnapshotStore'
import { buildAnalysisSnapshot } from './stores/analysisSnapshotFactory'
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
    _causalEdgeParams: new Map<string, { mean: number; std: number | null; existsProb: number | null }>(),
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
export interface CeeQualityDimensions {
  overall: number    // 1-10 scale
  structure: number  // 1-10 scale
  coverage: number   // 1-10 scale
  causality: number  // 1-10 scale
  safety: number     // 1-10 scale
}

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
}

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
    _causalEdgeParams: Map<string, { mean: number; std: number | null; existsProb: number | null }>
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
  addNode: (pos?: { x: number; y: number }, type?: NodeType) => LimitExceeded | null
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
   */
  batchUpdateNodes: (
    updates: Array<{ id: string; data: Partial<Node['data']> }>,
    label?: string,
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
  applyLayout: (opts?: { skipHistory?: boolean; requestId?: number }) => Promise<void>
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
  resultsLoadHistorical: (run: StoredRun) => void
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
  /** Public dirty-overlay setter for external graph mutators (e.g. accepted CEE graph patches) that bypass the internal edit chokepoints. */
  markAnalysisFreshnessDirty: () => void
  /** Atomically set all three staleness flags — the entry point for external structural mutators. */
  markGraphStructurallyEdited: () => void
  /** F10: run completed (new analysis_result hash) with no freshness verdict on the response. */
  noteRunCompletedWithoutVerdict: () => void
  /** Clear the dirty overlay when a genuinely new analysis run completes (reliable run identity, e.g. a new analysis_result response_hash). */
  clearAnalysisFreshnessDirty: () => void
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
    causalEdgeParams?: Map<string, { mean: number; std: number | null; existsProb: number | null }>
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
  const n = nodes.map(n => `${n.id}@${n.position.x},${n.position.y}:${n.type ?? ''}:${n.data?.label ?? ''}:${(n.data as { success_threshold?: unknown })?.success_threshold ?? ''}:${(n.data as { threshold_source?: unknown })?.threshold_source ?? ''}`).join('|')
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

// Create the store with optional debugging middleware
// Enable via URL param ?stateDebug=1 to capture ALL set() calls with stack traces
const _stateDebugEnabled = isStateDebugEnabled()

export const useCanvasStore = create<CanvasState>((originalSet, get) => {
  // Wrap set with debugging if enabled.
  // Cast: Zustand's setState is overloaded (replace?: false vs replace: true),
  // local SetState declares a single signature with replace?: boolean. The
  // wrapper preserves runtime behaviour exactly — only the static signature
  // differs.
  const set = createDebugSet(originalSet as SetState<CanvasState>, _stateDebugEnabled)

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
  ceeAnalysisReadyNodeIds: null,
  // V5 canonical analysis fact (v5-canonical-analysis brief)
  v5AnalysisFact: null,
  // CEE coaching payload (session-local; never persisted)
  draftCoaching: null,
  // CEE goal constraints from draft-graph response root
  goalConstraints: null,
  // B2: no authoritative graph seen yet — reconciler removes nothing.
  lastAuthoritativeGraph: null,
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
  highlightedEdges: new Set<string>(),
  analysisHighlight: { source: null, edgeIds: new Set<string>(), nodeIds: new Set<string>() },
  dimmedNodeIds: new Set<string>(),
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

  addNode: (pos, type = 'decision') => {
    // Node limit check (PRD guardrail)
    const { nodes, edges, engineLimits } = get()
    const limitKind = wouldExceedLimits(nodes.length, edges.length, 1, 0, engineLimits)
    if (limitKind) return limitKind

    pushToHistory(get, set, `Added ${type}`)
    invalidateAnalysisReady(get, set, `add_node (${type})`)
    const id = get().createNodeId()
    set((s) => ({ nodes: [...s.nodes, { id, type, position: pos || { x: 200, y: 200 }, data: { label: `Node ${id}` } }] }))
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
    pushToHistory(get, set)
    set((s) => ({ nodes: s.nodes.map(n => n.id === id ? { ...n, data: { ...n.data, label } } : n) }))
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

  batchUpdateNodes: (updates, label) => {
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

    pushToHistory(get, set, label ?? `Batch updated ${changedCount} node${changedCount !== 1 ? 's' : ''}`)
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

    // Selection toggles are non-structural; skip history churn on pure select changes.
    const isSelectOnly = changes.every(c => c.type === 'select' || c.type === 'dimensions')

    // Debounce history for drag operations
    const isDrag = changes.some(c => c.type === 'position' && (c as any).dragging)

    // Only invalidate analysis_ready if deleted nodes are critical (goal, option, intervention targets)
    const removedChanges = changes.filter(c => c.type === 'remove')
    if (removedChanges.length > 0) {
      const deletedNodeIds = removedChanges.map(c => (c as { id: string }).id)
      maybeInvalidateOnNodeDelete(get, set, deletedNodeIds)
    }

    const hasSelectChange = changes.some(c => c.type === 'select')

    set((s) => {
      const updatedNodes = applyNodeChanges(changes, s.nodes)

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

    const isSelectOnly = changes.every(c => c.type === 'select')
    const hasSelectChange = changes.some(c => c.type === 'select')

    // Edge removals via React Flow's built-in delete (default deleteKeyCode =
    // Backspace/Delete) reach the store ONLY through this handler — they never go
    // through deleteEdgeById / deleteSelected. Route the removed edges through the
    // edge-delete chokepoint so they mark the freshness overlay dirty (and
    // invalidate readiness for critical edges), matching every other edge-delete
    // path. Resolve the removed edges from the PRE-change edge list.
    const removedEdgeChanges = changes.filter((c) => c.type === 'remove')
    if (removedEdgeChanges.length > 0) {
      const edgesBefore = get().edges
      for (const change of removedEdgeChanges) {
        const removed = edgesBefore.find((e) => e.id === (change as { id: string }).id)
        if (removed) maybeInvalidateOnEdgeDelete(get, set, removed)
      }
    }

    set((s) => {
      const updatedEdges = applyEdgeChanges(changes, s.edges) as Edge<EdgeData>[]
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
    set({ nodes: prev.nodes, edges: prev.edges, history: { past, future }, ...READINESS_CLEAR_FIELDS, ...deriveGoalThresholdFromNode(prev.nodes, get().outcomeNodeId), analysisFreshnessDirty: true, lens: createDefaultLensState() })
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
    set({ nodes: next.nodes, edges: next.edges, history: { past, future }, ...READINESS_CLEAR_FIELDS, ...deriveGoalThresholdFromNode(next.nodes, get().outcomeNodeId), analysisFreshnessDirty: true, lens: createDefaultLensState() })
    // Reset hash after redo
    const { nodes: newNodes, edges: newEdges } = get()
    set(() => ({ _internal: { lastHistoryHash: historyHash(newNodes, newEdges) } }))
  },

  canUndo: () => get().history.past.length > 0,
  canRedo: () => get().history.future.length > 0,

  deleteSelected: () => {
    const { selection, outcomeNodeId, edges, ceeAnalysisReady } = get()
    const count = selection.nodeIds.size + selection.edgeIds.size
    pushToHistory(get, set, `Deleted ${count} element${count !== 1 ? 's' : ''}`)
    // P0.5 Fix: Clear outcomeNodeId if the outcome node is being deleted
    const shouldClearOutcome = outcomeNodeId && selection.nodeIds.has(outcomeNodeId)

    // Collect edges being deleted for invalidation check
    const deletedEdges = edges.filter(
      e => selection.edgeIds.has(e.id) ||
           selection.nodeIds.has(e.source) ||
           selection.nodeIds.has(e.target)
    )

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
    const nodeLabel = (get().nodes.find(n => n.id === nodeId)?.data as Record<string, unknown>)?.label as string ?? nodeId
    pushToHistory(get, set, `Deleted ${nodeLabel}`)
    const { outcomeNodeId } = get()
    // P0.5 Fix: Clear outcomeNodeId if this is the outcome node
    const shouldClearOutcome = outcomeNodeId === nodeId
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
      return
    }

    // Re-entry guard + synchronous claim. The claim must happen IN THE
    // SAME SYNCHRONOUS TICK as the guard read — otherwise a second call
    // entering during the dynamic-import yield below would pass the guard
    // before either had marked layoutInProgress=true (e.g. user clicks
    // "Re-layout" twice within a microtask, or two call sites trigger in
    // the same tick). Without this, both calls would push history, run
    // layoutGraph, and commit — double-bumping layoutVersion.
    if (get().layoutInProgress) return
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
      const layoutOptions = useLayoutStore.getState()

      const canvasSize = layoutOptions.canvasSize ?? undefined
      const { nodes: layoutedNodes, layoutNodeWidth } = await layoutGraph(
        nodes,
        edges,
        {
          direction: layoutOptions.direction,
          spacing: layoutOptions.nodeSpacing,
          layerSpacing: layoutOptions.layerSpacing,
          preserveLocked: layoutOptions.respectLocked,
        },
        canvasSize
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
      if (!isCurrentGen()) return

      layoutOptions.setLayoutNodeWidth(layoutNodeWidth)
      set({
        nodes: layoutedNodes,
        layoutVersion: get().layoutVersion + 1,
        pendingLayout: false,
      })
    } catch (err) {
      console.error('[CANVAS] Layout failed:', err)
      // Clear pendingLayout on failure so the measurement effect does not
      // retrigger when layoutInProgress flips false (would be an infinite
      // retry loop). BUT only if the generation hasn't changed — if a
      // newer request superseded us, leave pendingLayout=true so the
      // newer request runs.
      if (isCurrentGen()) {
        set({ pendingLayout: false })
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
      set({ ...DECISION_CONTEXT_CLEAR })
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
      _internal: { lastHistoryHash: historyHash(initialNodes, initialEdges) },
      hasCompletedFirstRun: false,
      showDraftChat: false,
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
        isDuplicateRun: undefined
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

  resultsComplete: ({ report, hash, drivers, ceeReview, ceeTrace, ceeError, ceeReviewV1: _ceeReviewV1, ceeTraceV1: _ceeTraceV1, ceeErrorV1: _ceeErrorV1, enrichment, resultsSource, rawV2Response }) => {
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
            goalProbability: prob.goal_probability,
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

    // Save to run history
    if (report && results.seed !== undefined) {
      const graphHash = generateGraphHash(nodes, edges, results.seed)

      const graphSnapshot = JSON.parse(JSON.stringify({ nodes, edges })) as {
        nodes: typeof nodes
        edges: typeof edges
      }

      const storedRun: StoredRun = {
        id: results.runId || crypto.randomUUID(),
        ts: Date.now(),
        seed: results.seed,
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

    // Refinement Journey: capture analysis snapshot for Compare tab
    if (isCompareTabEnabled() && rawV2Response && report) {
      try {
        const snapshotStore = useAnalysisSnapshotStore.getState()
        const capturedEvents = (get()._hydratedEvents ?? []) as ScenarioEvent[]
        const prevTimestamp = snapshotStore.getLatest()?.timestamp ?? null
        const snapshot = buildAnalysisSnapshot({
          rawV2Response,
          report,
          nodes,
          edges,
          runNumber: snapshotStore.getRunCount() + 1,
          events: capturedEvents,
          previousSnapshotTimestamp: prevTimestamp,
        })
        snapshotStore.addSnapshot(snapshot)
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
        finishedAt: Date.now()
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
        // Everything else (report/hash/seed/drivers) preserved so a
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

  resultsLoadHistorical: (run: StoredRun) => {
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
        error: undefined
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
          graph: { nodes, edges },
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
      // 20% (staging trust review, 2026-07). When raw is absent but a cap exists,
      // derive raw from the producer's own pair (norm × cap) — a genuine RAW
      // value. When neither raw nor an analysis_ready cap exists, the value is
      // bare NORMALISED 0-1 — Lane 5 (Codex P0-1) TAGS it 'normalised' rather
      // than storing it as raw: the old code assumed "capless ⇒ raw ≡
      // normalised", but the GOAL NODE can carry a cap the request boundary
      // then divides by (0.6 / 100 → 0.006 on the live wire). The explicit tag
      // makes the request boundary pass a normalised value through untouched.
      const ceeRaw = (analysisReady as any).goal_threshold_raw
      const ceeNorm = (analysisReady as any).goal_threshold
      const ceeCap = (analysisReady as any).goal_threshold_cap
      const hasCap = typeof ceeCap === 'number' && Number.isFinite(ceeCap) && ceeCap > 0
      let ceeThreshold: number | null | undefined
      let ceeRepresentation: 'raw' | 'normalised'
      if (ceeRaw != null) {
        ceeThreshold = ceeRaw
        ceeRepresentation = 'raw'
      } else if (typeof ceeNorm === 'number' && hasCap) {
        ceeThreshold = ceeNorm * ceeCap // derived raw from the producer's own pair
        ceeRepresentation = 'raw'
      } else {
        ceeThreshold = ceeNorm // bare, already 0-1
        ceeRepresentation = 'normalised'
      }
      if (ceeThreshold != null && get().goalThreshold == null) {
        // Producer write (syncing the threshold FROM the analysis) — must not
        // self-dirty the freshness overlay.
        get().setGoalThreshold(
          typeof ceeThreshold === 'number' ? ceeThreshold : Number(ceeThreshold),
          { fromCeeSync: true, representation: ceeRepresentation },
        )
      }
      // Persist to sessionStorage for tab-refresh survival (with node IDs for validation)
      try {
        sessionStorage.setItem('olumi-cee-analysis-ready', JSON.stringify(analysisReady))
        sessionStorage.setItem('olumi-cee-analysis-ready-node-ids', JSON.stringify(nodeIds))
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
      if (state.analysisFreshnessDirty) updates.analysisFreshnessDirty = false
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
      analysisFreshnessDirty: false,
    }))
  },
  clearAnalysisFreshnessDirty: () => {
    if (get().analysisFreshnessDirty) set(() => ({ analysisFreshnessDirty: false }))
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
    const EMPTY_CEP = new Map<string, { mean: number; std: number | null; existsProb: number | null }>()
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
            isPreview: true,
          },
          style: {
            strokeDasharray: '5,5',
            opacity: 0.6,
          },
        }
      }).filter(Boolean) as typeof existingEdges

      set({
        nodes: [...existingNodes, ...previewNodes],
        edges: [...existingEdges, ...previewEdges],
        clarifierPreviewNodeIds: previewNodes.map(n => n.id),
        clarifierPreviewEdgeIds: previewEdges.map(e => e.id),
      })

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
    set({
      nodes: remainingNodes,
      edges: remainingEdges,
      clarifierPreviewNodeIds: [],
      clarifierPreviewEdgeIds: [],
    })
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
export const selectError = (state: CanvasState): { code: string; message: string; retryAfter?: number; request_id?: string; affectedOptions?: Array<{ id: string; label: string }> } | null | undefined => state.results.error
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
