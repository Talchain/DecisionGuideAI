// Hardened store with timer cleanup, ID reseeding, edge debouncing
import { create } from 'zustand'
import { Node, Edge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from '@xyflow/react'
import { saveSnapshot as persistSnapshot, importCanvas as persistImport, exportCanvas as persistExport } from './persist'
import { setsEqual } from './store/utils'
import { DEFAULT_EDGE_DATA, type EdgeData } from './domain/edges'
import { NODE_REGISTRY, type NodeType } from './domain/nodes'
import { applyLayout, applyLayoutWithPolicy } from './layout'
import { mergePolicy } from './layout/policy'
import { policyToPreset, policyToSpacing } from './layout/adapters'
import { getInvalidNodes as getInvalidNodesUtil, getNextInvalidNode as getNextInvalidNodeUtil, type InvalidNodeInfo } from './utils/validateOutgoing'
import type { ReportV1, ErrorV1 } from '../adapters/plot/types'
import type { PLoTEnrichment } from '../adapters/plot/enrichment'
import { trackResultsViewed, trackIssuesOpened } from './utils/sandboxTelemetry'
import { addRun, generateGraphHash, loadRuns, type StoredRun } from './store/runHistory'
import * as scenarios from './store/scenarios'
import type { Scenario, ScenarioFraming } from './store/scenarios'
import type { GraphHealth, ValidationIssue, NeedleMover } from './validation/types'
import type { Document, Citation } from './share/types'
import type { Snapshot, DecisionRationale, ComparisonResult } from './snapshots/types'
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
} from '../adapters/cee/types'
import type { LimitsV1 } from '../adapters/plot/types'
import type { ScenarioStage } from '../types/scenario'
import type { CeeDebugHeaders } from './utils/ceeDebugHeaders'
import { loadSearchQuery, loadSortPreferences, saveSearchQuery, saveSortPreferences, __test__ as docsTest } from './store/documents'
import { loadUIPreferences, saveUIPreference } from './store/uiPreferences'
import { validateCeeAnalysisReady } from './utils/ceeAnalysisReadyValidation'
import { recordCrossSurfaceEvent, recordUserAction } from '../lib/debug-state'

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

// Brief 37 Optimization: Stable empty array to prevent re-renders
// graphHealthFromQuality() returns this when no issues exist, avoiding new array allocation
const EMPTY_VALIDATION_ISSUES: ValidationIssue[] = []

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
      if (process.env.NODE_ENV === 'development') {
        console.debug('[canvas] Restored results from history:', resultHash)
      }
      return true
    }
    if (process.env.NODE_ENV === 'development') {
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
  error?: { code: string; message: string; retryAfter?: number; request_id?: string; canRetry?: boolean } | null
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
  history: { past: { nodes: Node[]; edges: Edge<EdgeData>[] }[]; future: { nodes: Node[]; edges: Edge<EdgeData>[] }[] }
  selection: { nodeIds: Set<string>; edgeIds: Set<string>; anchorPosition: { x: number; y: number } | null }
  clipboard: ClipboardData | null
  reconnecting: ReconnectState | null
  touchedNodeIds: Set<string>  // Nodes with edited probabilities
  outcomeNodeId: string | null  // Selected outcome node for analysis
  goalThreshold: number | null  // Optional success threshold for probability_of_goal
  nextNodeId: number
  nextEdgeId: number
  _internal: { lastHistoryHash: string }
  results: ResultsState  // Analysis results panel state
  runMeta: RunMetaState
  /** A1: Snapshot of key values from the previous analysis run for delta display */
  previousReport: PreviousReportSnapshot | null
  // Scenario state
  currentScenarioId: string | null  // Active scenario ID
  currentScenarioFraming: ScenarioFraming | null
  // A.15: Decision lifecycle stage (hydrated from Supabase, updated by orchestrator)
  currentStage: ScenarioStage | null
  currentScenarioLastResultHash: string | null  // Most recent analysis hash for the active scenario
  currentScenarioLastRunAt: string | null  // ISO timestamp of last analysis run for the active scenario
  currentScenarioLastRunSeed: string | null  // Seed used for last analysis run (stringified)
  hasCompletedFirstRun: boolean  // True after at least one successful or restored run in this session
  graphEditedSinceLastRun: boolean  // True when graph has been structurally edited since last analysis run
  isDirty: boolean  // Has unsaved changes
  isSaving: boolean  // P0-2: Currently saving
  lastSavedAt: number | null  // P0-2: Timestamp of last successful save
  // Panel visibility
  showResultsPanel: boolean
  showInspectorPanel: boolean
  showTemplatesPanel: boolean
  templatesPanelInvoker: HTMLElement | null
  showDraftChat: boolean
  // AI Model Selection (session-only, not persisted to localStorage)
  // Only non-default models are sent to API to keep payloads clean
  selectedGenerationModel: string | null  // null = use default (gpt-4o)
  selectedRepairModel: string | null      // null = use default (claude-sonnet-4-20250514)
  selectedEnrichmentModel: string | null  // null = use default (claude-sonnet-4-20250514)
  // A.5+: Pre-draft canvas snapshot for undo-draft capability
  draftChatPreDraftSnapshot: { nodes: Node[]; edges: Edge<EdgeData>[] } | null
  // Last draft description (persisted to maintain context across panel close/reopen)
  lastDraftDescription: string
  // Last draft error (NOT cleared in resetCanvas — survives retry cycles)
  lastDraftError: {
    message: string
    status?: number
    correlationId?: string
    timestamp: number
    /** Whether the error is retryable. false = deterministic validation failure. */
    retryable?: boolean
  } | null
  // CEE V3: analysis_ready payload from last draft
  // Used by useV2Run to build requests with resolved interventions
  ceeAnalysisReady: CEEAnalysisReady | null
  // Node IDs that existed when ceeAnalysisReady was stored
  // Used to detect stale analysis_ready after graph edits
  ceeAnalysisReadyNodeIds: string[] | null
  // CEE goal constraints from draft-graph response root (for PLoT multi-constraint analysis)
  goalConstraints: CEEGoalConstraint[] | null
  // CEE Pipeline trace from last draft-graph response (for debug panel)
  ceePipelineTrace: CeePipelineTrace | null
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
  dimmedNodeIds: Set<string>
  // S.4: Session-only "user-reviewed" tracking — resets on page refresh
  confirmedNodeIds: Set<string>
  // Decision Graph Display v2 Task 11: Option hover state for intervention highlighting
  hoveredOptionId: string | null
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
  // M6: Compare & Decision Rationale
  selectedSnapshotsForComparison: string[] // Snapshot IDs
  showComparePanel: boolean
  currentDecisionRationale: DecisionRationale | null
  // M6: Scenario Comparison Mode (replaces main canvas with side-by-side view)
  comparisonMode: {
    active: boolean
    scenarios: Array<{ nodes: Node[]; edges: Edge<EdgeData>[]; label: string; optionId?: string }>
    labels: string[]
    selectedIndices?: [number, number]
    hasMoreOptions?: boolean
    allOptionsCount?: number
    comparison: ComparisonResult | null // Diff data for stats bar and changes view
    // ISL/legacy compare API response with outcome predictions per scenario
    apiResponse?: {
      base_scenario?: { id: string; name: string; outcome_predictions: Record<string, number> }
      alternative_scenarios?: Array<{ id: string; name: string; outcome_predictions: Record<string, number> }>
      option_comparison?: Array<{ option_id: string; option_label: string; outcome?: { mean: number; p10: number; p50: number; p90: number }; expected_outcome?: number; win_probability?: number }>
      analysis_status?: string
    } | null
  }
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
  // Pending fit view request (set by AI graph insertion, cleared by ReactFlowGraph)
  pendingFitView: boolean
  setPendingFitView: (value: boolean) => void
  // Track 3: Hydrated thread entries from scenario row (consumed once by useConversation, then cleared)
  _hydratedThread: unknown[] | null
  // Track 3: Hydrated scenario events from scenario row (consumed by Journey tab)
  _hydratedEvents: unknown[] | null
  // Phase 2A: Analysis metadata for Model Card Lite and trust surfaces
  lastAnalysisSeed: number | null
  lastQualityMode: string | null
  repairsApplied: Array<{ code?: string; type?: string; layer?: string; field_path?: string; before?: unknown; after?: unknown; severity?: string; node_id?: string; value?: unknown; source?: string; reason?: string }> | null
  // Task 2: Signal for AI panel auto-collapse. Set when a full_draft auto_apply patch
  // is applied for the first time. DraftChat watches this to collapse without
  // reacting to every incremental node change.
  fullDraftAppliedAt: number | null
  setFullDraftAppliedAt: (ts: number) => void
  // Debug: Raw CEE output mode (bypasses post-processing repairs)
  // Set via URL param ?rawCee=1 or Debug Panel checkbox
  debugRawCeeOutput: boolean
  setDebugRawCeeOutput: (value: boolean) => void
  updateScenarioFraming: (partial: ScenarioFraming) => void
  addNode: (pos?: { x: number; y: number }, type?: NodeType) => void
  /** Create a new node with an edge connecting it to an existing node. Returns the new node ID. */
  addNodeWithEdge: (
    pos: { x: number; y: number },
    type: NodeType,
    connectTo: string,
    edgeDirection: 'to-target' | 'from-target',
  ) => string
  updateNodeLabel: (id: string, label: string) => void
  updateNode: (id: string, updates: Partial<Node>) => void
  updateEdge: (id: string, updates: Partial<Edge<EdgeData>>) => void
  updateEdgeData: (id: string, data: Partial<EdgeData>) => void
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onSelectionChange: (params: { nodes: Node[]; edges: Edge<EdgeData>[] }) => void
  selectNodeWithoutHistory: (nodeId: string) => void
  selectNodes: (nodeIds: string[]) => void
  clearSelection: () => void
  addEdge: (edge: Omit<Edge<EdgeData>, 'id'>) => void
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
  applyLayout: () => Promise<void>
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
  setOutcomeNode: (nodeId: string | null) => void
  // Goal threshold for probability_of_goal
  setGoalThreshold: (threshold: number | null) => void
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
  }) => void
  resultsError: (params: { code: string; message: string; retryAfter?: number; request_id?: string; canRetry?: boolean }) => void
  /** Capture detailed error information for Debug Panel */
  captureErrorDetail: (detail: ErrorDetail) => void
  /** Clear all captured error details */
  clearErrorDetails: () => void
  resultsCancelled: () => void
  resultsReset: () => void
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
  setSelectedGenerationModel: (modelId: string | null) => void
  setSelectedRepairModel: (modelId: string | null) => void
  setSelectedEnrichmentModel: (modelId: string | null) => void
  resetModelToDefault: (operation: 'generation' | 'repair' | 'enrichment') => void
  // A.15: Stage setter
  setCurrentStage: (stage: ScenarioStage | null) => void
  // A.5+: Draft snapshot + undo
  setDraftChatPreDraftSnapshot: (snapshot: { nodes: Node[]; edges: Edge<EdgeData>[] } | null) => void
  undoDraft: () => void
  setLastDraftDescription: (description: string) => void
  setLastDraftError: (error: { message: string; status?: number; correlationId?: string; timestamp: number } | null) => void
  setCeeAnalysisReady: (analysisReady: CEEAnalysisReady | null) => void
  setGoalConstraints: (constraints: CEEGoalConstraint[] | null) => void
  setCeePipelineTrace: (trace: CeePipelineTrace | null) => void
  setCeeQuality: (quality: CeeQualityDimensions | null) => void
  // Phase 1b actions
  setCeeExtendedWarnings: (warnings: CEEDraftWarning[] | null) => void
  setCeeGoalConnectivity: (connectivity: CEEGoalConnectivity | null) => void
  setCeeModelQualityFactors: (factors: CEEModelQualityFactors | null) => void
  setCeeInterventionHints: (hints: Record<string, CEEInterventionHint> | null) => void
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
  setDimmedNodes: (ids: string[]) => void
  // S.4: Toggle "user-reviewed" confirmation on a node (session-only)
  toggleConfirmedNode: (nodeId: string) => void
  // Decision Graph Display v2 Task 11: Option hover for intervention highlighting
  setHoveredOption: (optionId: string | null) => void
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
  // M6: Compare & Snapshots actions
  setSelectedSnapshotsForComparison: (snapshotIds: string[]) => void
  setShowComparePanel: (show: boolean) => void
  setDecisionRationale: (rationale: DecisionRationale | null) => void
  exportLocal: () => string
  // M6: Scenario Comparison Mode actions
  enterComparisonMode: (
    scenariosOrScenarioA:
      | Array<{ nodes: Node[]; edges: Edge<EdgeData>[]; label: string; optionId?: string }>
      | { nodes: Node[]; edges: Edge<EdgeData>[]; label: string; optionId?: string },
    scenarioB?: { nodes: Node[]; edges: Edge<EdgeData>[]; label: string; optionId?: string } | null,
    comparison?: ComparisonResult | null,
    apiResponse?: { base_scenario?: { id: string; name: string; outcome_predictions: Record<string, number> }; alternative_scenarios?: Array<{ id: string; name: string; outcome_predictions: Record<string, number> }>; option_comparison?: Array<{ option_id: string; option_label: string; outcome?: { mean: number; p10: number; p50: number; p90: number }; expected_outcome?: number; win_probability?: number }>; analysis_status?: string } | null,
    meta?: { hasMoreOptions?: boolean; allOptionsCount?: number }
  ) => void
  setComparisonSelectedIndices: (indices: [number, number]) => void
  exitComparisonMode: () => void
  // P2: Hydration hygiene
  hydrateGraphSlice: (loaded: { nodes?: Node[]; edges?: Edge<EdgeData>[]; currentScenarioId?: string | null }) => void
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
  const n = nodes.map(n => `${n.id}@${n.position.x},${n.position.y}:${n.type ?? ''}:${n.data?.label ?? ''}`).join('|')
  const e = edges.map(e => `${e.id}:${e.source}>${e.target}:${e.label ?? ''}:${(e.data as any)?.schemaVersion ?? ''}`).join('|')
  return `${n}#${e}`
}

function pushToHistory(get: () => CanvasState, set: (fn: (s: CanvasState) => Partial<CanvasState>) => void) {
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

  const past = [...history.past, { nodes: cleanNodes, edges: cleanEdges }].slice(-MAX_HISTORY)
  set(() => ({
    history: { past, future: [] },
    _internal: { lastHistoryHash: h },
    graphEditedSinceLastRun: true,
  }))
}

function scheduleHistoryPush(get: () => CanvasState, set: (fn: (s: CanvasState) => Partial<CanvasState>) => void) {
  if (historyTimer) clearTimeout(historyTimer)
  historyTimer = setTimeout(() => pushToHistory(get, set), HISTORY_DEBOUNCE_MS)
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
 * Invalidate ceeAnalysisReady when critical nodes are deleted.
 * Critical nodes: goal_node_id, option nodes, intervention target nodes.
 * Adding nodes or editing labels does NOT invalidate.
 */
function invalidateAnalysisReady(
  get: () => CanvasState,
  set: (fn: (s: CanvasState) => Partial<CanvasState>) => void,
  reason?: string
) {
  const { ceeAnalysisReady } = get()
  if (ceeAnalysisReady) {
    if (import.meta.env.DEV) {
      console.warn('[Canvas] === INVALIDATE ANALYSIS_READY ===')
      console.warn('[Canvas] Reason:', reason ?? 'unspecified')
      console.warn('[Canvas] Had options:', ceeAnalysisReady.options?.length)
      console.trace('[Canvas] invalidateAnalysisReady call stack')
    }
    set(() => ({
      ceeAnalysisReady: null,
      ceeAnalysisReadyNodeIds: null,
      ceeQuality: null,
      goalConstraints: null,
      // Phase 1b: Clear extended CEE data
      ceeExtendedWarnings: null,
      ceeGoalConnectivity: null,
      ceeModelQualityFactors: null,
      ceeInterventionHints: null,
    }))
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
  const { ceeAnalysisReady } = get()
  if (shouldInvalidateOnEdgeDelete(edge, ceeAnalysisReady)) {
    invalidateAnalysisReady(get, set, `Deleted edge connecting critical nodes: ${edge.source} → ${edge.target}`)
    return true
  }
  return false
}

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
  // Wrap set with debugging if enabled
  const set = createDebugSet(originalSet, _stateDebugEnabled)

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
  currentScenarioFraming: null,
  currentStage: null,
  currentScenarioLastResultHash: null,
  currentScenarioLastRunAt: null,
  currentScenarioLastRunSeed: null,
  hasCompletedFirstRun: false,
  graphEditedSinceLastRun: false,
  isDirty: false,
  isSaving: false,  // P0-2: Initially not saving
  lastSavedAt: null,  // P0-2: No save yet
  // Phase 3: Panel visibility with persistence
  ...{
    showResultsPanel: false,
    showInspectorPanel: false,
    showTemplatesPanel: false,
    showDraftChat: false,
    // AI Model Selection (session-only, start with defaults)
    selectedGenerationModel: null,
    selectedRepairModel: null,
    selectedEnrichmentModel: null,
    draftChatPreDraftSnapshot: null,
    lastDraftDescription: '',
    lastDraftError: null,
    showIssuesPanel: false,
    showProvenanceHub: false,
    showDocumentsDrawer: false,
    showComparePanel: false,
    ...loadUIPreferences(), // Override with persisted preferences
  },
  // CEE V3: analysis_ready payload
  ceeAnalysisReady: null,
  ceeAnalysisReadyNodeIds: null,
  // CEE goal constraints from draft-graph response root
  goalConstraints: null,
  // CEE Pipeline trace from last draft
  ceePipelineTrace: null,
  // CEE quality dimensions from draft-graph response
  ceeQuality: null,
  // Phase 1b: Extended CEE data
  ceeExtendedWarnings: null,
  ceeGoalConnectivity: null,
  ceeModelQualityFactors: null,
  ceeInterventionHints: null,
  // Engine limits (session-scoped singleton)
  engineLimits: null,
  engineLimitsSource: null,
  engineLimitsLoading: true,
  engineLimitsError: null,
  engineLimitsFetchedAt: null,
  // M6: Scenario Comparison Mode
  comparisonMode: {
    active: false,
    scenarios: [],
    labels: [],
    selectedIndices: [0, 1],
    hasMoreOptions: false,
    allOptionsCount: 0,
    comparison: null,
    apiResponse: null,
  },
  templatesPanelInvoker: null,
  // M4: Graph Health & Repair
  graphHealth: null,
  needleMovers: [],
  highlightedNodes: new Set<string>(),
  highlightedEdges: new Set<string>(),
  dimmedNodeIds: new Set<string>(),
  confirmedNodeIds: new Set<string>(),
  hoveredOptionId: null,
  // M5: Grounding & Provenance
  documents: [],
  citations: [],
  provenanceRedactionEnabled: true, // M5: Redaction ON by default
  // S7-FILEOPS: Document management initial state
  documentSearchQuery: loadSearchQuery(),
  ...loadSortPreferences(),
  // M6: Compare & Decision Rationale
  selectedSnapshotsForComparison: [],
  currentDecisionRationale: null,
  // A.7: External mutation suppression reference count (0 = inactive)
  _externalMutationActive: 0,
  _suppressHistory: false,
  // Week 3: AI Clarifier initial state
  showAIClarifier: false,
  clarifierSession: null,
  clarifierPreviewNodeIds: [],
  clarifierPreviewEdgeIds: [],
  // Pending fit view request (set by AI graph insertion, cleared by ReactFlowGraph)
  pendingFitView: false,
  // Track 3: Hydrated thread/events (transient, consumed once)
  _hydratedThread: null,
  _hydratedEvents: null,
  // Phase 2A: Analysis metadata for Model Card Lite
  lastAnalysisSeed: null,
  lastQualityMode: null,
  repairsApplied: null,
  fullDraftAppliedAt: null,
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
    pushToHistory(get, set)
    // Note: Adding nodes does NOT invalidate ceeAnalysisReady
    // Only deletion of critical nodes (goal, option, intervention targets) invalidates
    const id = get().createNodeId()
    set((s) => ({ nodes: [...s.nodes, { id, type, position: pos || { x: 200, y: 200 }, data: { label: `Node ${id}` } }] }))
  },

  addNodeWithEdge: (pos, type, connectTo, edgeDirection) => {
    pushToHistory(get, set)
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
          data: { label: `New ${type}`, kind: type, category: 'controllable' },
        },
      ],
      edges: [
        ...s.edges,
        {
          id: edgeId,
          source,
          target,
          type: 'styled' as const,
          data: { ...DEFAULT_EDGE_DATA },
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
    pushToHistory(get, set)
    set((s) => ({ 
      nodes: s.nodes.map(n => n.id === id ? { ...n, ...updates, data: { ...n.data, ...updates.data } } : n) 
    }))
  },

  updateEdge: (id, updates) => {
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
    get().updateEdge(id, { data: clampedData })
  },

  onNodesChange: (changes) => {
    // Guard no-op changes
    if (!changes || changes.length === 0) return

    // Debounce history for drag operations
    const isDrag = changes.some(c => c.type === 'position' && (c as any).dragging)

    // Only invalidate analysis_ready if deleted nodes are critical (goal, option, intervention targets)
    const removedChanges = changes.filter(c => c.type === 'remove')
    if (removedChanges.length > 0) {
      const deletedNodeIds = removedChanges.map(c => (c as { id: string }).id)
      maybeInvalidateOnNodeDelete(get, set, deletedNodeIds)
    }

    set((s) => {
      const updatedNodes = applyNodeChanges(changes, s.nodes)

      let selection = s.selection
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
    } else {
      // Immediate push for non-drag changes (select, remove, add)
      pushToHistory(get, set)
    }
  },

  onEdgesChange: (changes) => {
    // Guard no-op changes
    if (!changes || changes.length === 0) return

    // Note: Edge changes do NOT invalidate ceeAnalysisReady
    // Only deletion of critical nodes (goal, option, intervention targets) invalidates
    // Causal path validation is handled separately by usePreRunValidation

    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) as Edge<EdgeData>[] }))

    // Edges don't have position changes, always push immediately
    pushToHistory(get, set)
  },

  onSelectionChange: ({ nodes, edges }) => {
    const newNodeIds = new Set(nodes.map(n => n.id))
    const newEdgeIds = new Set(edges.map(e => e.id))

    const { selection, nodes: allNodes } = get()

    // Handle initial state safely
    const prevNodeIds = selection?.nodeIds ?? new Set<string>()
    const prevEdgeIds = selection?.edgeIds ?? new Set<string>()

    // Compare by value using setsEqual utility
    const nodeIdsChanged = !setsEqual(newNodeIds, prevNodeIds)
    const edgeIdsChanged = !setsEqual(newEdgeIds, prevEdgeIds)

    // Early return if selection didn't actually change (prevents render loop)
    if (!nodeIdsChanged && !edgeIdsChanged) return

    // Calculate anchor position for contextual inspector popover
    let anchorPosition: { x: number; y: number } | null = null

    if (nodes.length === 1) {
      // Single node selected - anchor to right-center of node
      const node = nodes[0]
      const nodeWidth = node.measured?.width ?? node.width ?? 180
      const nodeHeight = node.measured?.height ?? node.height ?? 60
      anchorPosition = {
        x: node.position.x + nodeWidth,
        y: node.position.y + nodeHeight / 2,
      }
    } else if (edges.length === 1 && nodes.length === 0) {
      // Single edge selected - anchor to midpoint between source and target
      const edge = edges[0]
      const sourceNode = allNodes.find(n => n.id === edge.source)
      const targetNode = allNodes.find(n => n.id === edge.target)
      if (sourceNode && targetNode) {
        const sourceWidth = sourceNode.measured?.width ?? sourceNode.width ?? 180
        const sourceHeight = sourceNode.measured?.height ?? sourceNode.height ?? 60
        const targetWidth = targetNode.measured?.width ?? targetNode.width ?? 180
        const targetHeight = targetNode.measured?.height ?? targetNode.height ?? 60
        anchorPosition = {
          x: (sourceNode.position.x + sourceWidth / 2 + targetNode.position.x + targetWidth / 2) / 2,
          y: (sourceNode.position.y + sourceHeight / 2 + targetNode.position.y + targetHeight / 2) / 2,
        }
      }
    }

    // Only commit when different
    set({
      selection: {
        nodeIds: newNodeIds,
        edgeIds: newEdgeIds,
        anchorPosition,
      },
    })
  },

  // Select a node without pushing to history (for focus/navigation)
  selectNodeWithoutHistory: (nodeId) => {
    const { nodes } = get()
    const node = nodes.find(n => n.id === nodeId)
    let anchorPosition: { x: number; y: number } | null = null
    if (node) {
      const nodeWidth = node.measured?.width ?? node.width ?? 180
      const nodeHeight = node.measured?.height ?? node.height ?? 60
      anchorPosition = {
        x: node.position.x + nodeWidth,
        y: node.position.y + nodeHeight / 2,
      }
    }
    set(s => ({
      nodes: s.nodes.map(n => ({
        ...n,
        selected: n.id === nodeId
      })),
      selection: {
        nodeIds: new Set([nodeId]),
        edgeIds: new Set(),
        anchorPosition,
      }
    }))
  },

  // Select multiple nodes (for probability editor navigation)
  selectNodes: (nodeIds) => {
    const { nodes } = get()
    // Calculate anchor for first node if single selection
    let anchorPosition: { x: number; y: number } | null = null
    if (nodeIds.length === 1) {
      const node = nodes.find(n => n.id === nodeIds[0])
      if (node) {
        const nodeWidth = node.measured?.width ?? node.width ?? 180
        const nodeHeight = node.measured?.height ?? node.height ?? 60
        anchorPosition = {
          x: node.position.x + nodeWidth,
          y: node.position.y + nodeHeight / 2,
        }
      }
    }
    set(s => ({
      nodes: s.nodes.map(n => ({
        ...n,
        selected: nodeIds.includes(n.id)
      })),
      selection: {
        nodeIds: new Set(nodeIds),
        edgeIds: new Set(),
        anchorPosition,
      }
    }))
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
    // Validate source/target nodes exist to prevent dangling edges
    const { nodes } = get()
    const nodeIds = new Set(nodes.map(n => n.id))
    if (!nodeIds.has(edge.source)) {
      if (import.meta.env.DEV) console.warn(`[Canvas] addEdge: source node "${edge.source}" not found`)
      return
    }
    if (!nodeIds.has(edge.target)) {
      if (import.meta.env.DEV) console.warn(`[Canvas] addEdge: target node "${edge.target}" not found`)
      return
    }

    pushToHistory(get, set)
    // Note: Adding edges does NOT invalidate ceeAnalysisReady
    // Only deletion of critical nodes (goal, option, intervention targets) invalidates
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
    const future = [{ nodes, edges }, ...history.future]
    // Invalidate ceeAnalysisReady so panel re-evaluates from restored graph state
    set({ nodes: prev.nodes, edges: prev.edges, history: { past, future }, ceeAnalysisReady: null, goalConstraints: null })
    // Reset hash after undo
    const { nodes: newNodes, edges: newEdges } = get()
    set(() => ({ _internal: { lastHistoryHash: historyHash(newNodes, newEdges) } }))
  },

  redo: () => {
    const { history, nodes, edges } = get()
    if (history.future.length === 0) return
    const next = history.future[0]
    const past = [...history.past, { nodes, edges }]
    const future = history.future.slice(1)
    // Invalidate ceeAnalysisReady so panel re-evaluates from restored graph state
    set({ nodes: next.nodes, edges: next.edges, history: { past, future }, ceeAnalysisReady: null, goalConstraints: null })
    // Reset hash after redo
    const { nodes: newNodes, edges: newEdges } = get()
    set(() => ({ _internal: { lastHistoryHash: historyHash(newNodes, newEdges) } }))
  },

  canUndo: () => get().history.past.length > 0,
  canRedo: () => get().history.future.length > 0,

  deleteSelected: () => {
    pushToHistory(get, set)
    const { selection, outcomeNodeId, edges, ceeAnalysisReady } = get()
    // P0.5 Fix: Clear outcomeNodeId if the outcome node is being deleted
    const shouldClearOutcome = outcomeNodeId && selection.nodeIds.has(outcomeNodeId)

    // Collect edges being deleted for invalidation check
    const deletedEdges = edges.filter(
      e => selection.edgeIds.has(e.id) ||
           selection.nodeIds.has(e.source) ||
           selection.nodeIds.has(e.target)
    )

    set((s) => ({
      nodes: s.nodes.filter(n => !selection.nodeIds.has(n.id)),
      edges: s.edges.filter(e => !selection.nodeIds.has(e.source) && !selection.nodeIds.has(e.target) && !selection.edgeIds.has(e.id)),
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
      outcomeNodeId: shouldClearOutcome ? null : s.outcomeNodeId,
    }))

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
    pushToHistory(get, set)
    const { outcomeNodeId } = get()
    // P0.5 Fix: Clear outcomeNodeId if this is the outcome node
    const shouldClearOutcome = outcomeNodeId === nodeId
    set((s) => ({
      nodes: s.nodes.filter(n => n.id !== nodeId),
      edges: s.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
      // Clear selection if deleted node was selected
      selection: s.selection.nodeIds.has(nodeId)
        ? { ...s.selection, nodeIds: new Set([...s.selection.nodeIds].filter(id => id !== nodeId)) }
        : s.selection,
      outcomeNodeId: shouldClearOutcome ? null : s.outcomeNodeId,
    }))

    // Invalidate analysis_ready if deleted node is critical
    maybeInvalidateOnNodeDelete(get, set, [nodeId])
  },

  deleteEdgeById: (edgeId: string) => {
    const { edges } = get()
    const edge = edges.find(e => e.id === edgeId)
    if (!edge) return

    pushToHistory(get, set)
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
    pushToHistory(get, set)
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

    pushToHistory(get, set)
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
  },

  cutSelected: () => {
    // Atomic operation: copy + delete in single history frame
    // This prevents double-frame if copySelected ever mutates in future
    const { nodes, edges, selection } = get()
    const selectedNodes = nodes.filter(n => selection.nodeIds.has(n.id))
    const selectedEdges = edges.filter(e => selection.nodeIds.has(e.source) && selection.nodeIds.has(e.target))
    
    // Push history once before mutation
    pushToHistory(get, set)
    
    // Set clipboard and delete in same transaction
    set((s) => ({
      clipboard: { nodes: selectedNodes, edges: selectedEdges },
      nodes: s.nodes.filter(n => !selection.nodeIds.has(n.id)),
      edges: s.edges.filter(e => !selection.nodeIds.has(e.source) && !selection.nodeIds.has(e.target) && !selection.edgeIds.has(e.id)),
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null }
    }))
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
      history: { past: [], future: [] },
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
      showDraftChat: false,
      // Reset model selection on import
      selectedGenerationModel: null,
      selectedRepairModel: null,
      selectedEnrichmentModel: null,
    })
    
    return true
  },

  exportCanvas: () => {
    const { nodes, edges } = get()
    return persistExport({ nodes, edges })
  },

  applyLayout: async () => {
    const { nodes, edges } = get()
    
    // Dynamic import to avoid bundling ELK if not used
    const { layoutGraph } = await import('./utils/layout')
    const { useLayoutStore } = await import('./layoutStore')
    const layoutOptions = useLayoutStore.getState()
    
    // Push to history before layout
    pushToHistory(get, set)
    
    try {
      const { nodes: layoutedNodes } = await layoutGraph(nodes, edges, {
        direction: layoutOptions.direction,
        spacing: layoutOptions.nodeSpacing,
        layerSpacing: layoutOptions.layerSpacing,
        preserveLocked: layoutOptions.respectLocked
      })
      
      set({ nodes: layoutedNodes })
    } catch (err) {
      console.error('[CANVAS] Layout failed:', err)
      // Rethrow so callers can provide user-facing error feedback
      throw err
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
    if (nodes.length === 0 && edges.length === 0) return

    pushToHistory(get, set)

    // Clear current scenario ID - user is starting fresh, not editing old scenario
    scenarios.clearCurrentScenarioId()

    set({
      // Clear graph
      nodes: [],
      edges: [],
      touchedNodeIds: new Set(),
      nextNodeId: 1,
      nextEdgeId: 1,
      // Clear AI model selections but keep panel visible
      selectedGenerationModel: null,
      selectedRepairModel: null,
      selectedEnrichmentModel: null,
      // Clear CEE analysis_ready payload, pipeline trace, quality, and constraints
      ceeAnalysisReady: null,
      ceeAnalysisReadyNodeIds: null,
      goalConstraints: null,
      ceePipelineTrace: null,
      ceeQuality: null,
      // Phase 1b: Clear extended CEE data
      ceeExtendedWarnings: null,
      ceeGoalConnectivity: null,
      ceeModelQualityFactors: null,
      ceeInterventionHints: null,
      // Clear results and analysis state
      previousReport: null, // A1: Clear stale deltas on canvas reset
      results: { status: 'idle', progress: 0 },
      runMeta: {},
      hasCompletedFirstRun: false,
      graphEditedSinceLastRun: false,
      // Clear validation state
      graphHealth: null,
      needleMovers: [],
      // Close results panel
      showResultsPanel: false,
      // M6: Exit comparison mode if active
      comparisonMode: {
        active: false,
        scenarios: [],
        labels: [],
        selectedIndices: [0, 1],
        comparison: null,
        apiResponse: null,
      },
      // Clear scenario tracking in store state
      currentScenarioId: null,
      // A.15: Clear lifecycle stage
      currentStage: null,
      // A.5+: Clear draft snapshot
      draftChatPreDraftSnapshot: null,
      // Phase 2A: Clear analysis metadata
      lastAnalysisSeed: null,
      lastQualityMode: null,
      repairsApplied: null,
    })
  },

  deleteEdge: (id) => {
    const { edges, selection } = get()
    const edge = edges.find(e => e.id === id)
    if (!edge) return

    pushToHistory(get, set)

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
      // Reset model selection on canvas reset
      selectedGenerationModel: null,
      selectedRepairModel: null,
      selectedEnrichmentModel: null,
    })
  },

  setOutcomeNode: (nodeId) => {
    set({ outcomeNodeId: nodeId })
  },

  setGoalThreshold: (threshold) => {
    set({ goalThreshold: threshold })
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
      }
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

  resultsComplete: ({ report, hash, drivers, ceeReview, ceeTrace, ceeError, ceeReviewV1, ceeTraceV1, ceeErrorV1, enrichment, resultsSource }) => {
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
      const optionResults = (currentReport as any)?.option_comparison ?? (currentReport as any)?.results ?? []
      for (const opt of optionResults) {
        if (opt.option_id || opt.id) {
          options[opt.option_id ?? opt.id] = {
            winProbability: opt.win_probability ?? opt.winProbability,
            outcomeMean: opt.expected_outcome ?? opt.outcome?.mean ?? opt.expected,
            goalProbability: opt.probability_of_goal ?? opt.goalProbability,
          }
        }
      }
      const robustness = (currentReport as any)?.robustness
      snapshot = {
        options,
        rankingStability: robustness?.recommendation_stability ?? robustness?.ranking_stability,
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
      // Phase 2A: Persist analysis metadata for Model Card Lite / trust strip
      lastAnalysisSeed: (report as any)?.meta?.seed_used ?? (report as any)?.meta?.seed ?? null,
      lastQualityMode: (report as any)?.meta?.detail_level ?? null,
      repairsApplied: (report as any)?.repairs_applied ?? null,
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
  },

  resultsError: ({ code, message, retryAfter, request_id, canRetry }) => {
    set(s => ({
      results: {
        ...s.results,
        status: 'error',
        // retryAfter: reserved for future rate-limit handling, not currently displayed
        error: { code, message, retryAfter, request_id, canRetry },
        finishedAt: Date.now()
      }
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
      }
    }))
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
    }))
  },

  resultsReset: () => {
    set({
      previousReport: null,
      results: {
        status: 'idle',
        progress: 0
      },
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

    // A.7: Suppress direct_graph_edit events during scenario hydration
    set((s) => ({ _externalMutationActive: s._externalMutationActive + 1 }))
    try {
    set({
      nodes,
      edges,
      currentScenarioId: id,
      currentScenarioFraming: scenario.framing ?? null,
      currentScenarioLastResultHash: scenario.last_result_hash ?? null,
      currentScenarioLastRunAt: scenario.last_run_at ?? null,
      currentScenarioLastRunSeed: scenario.last_run_seed ?? null,
      previousReport: null, // A1: Clear stale deltas on scenario switch
      isDirty: false,
      history: { past: [], future: [] },
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
      touchedNodeIds: new Set(),
      showDraftChat: false,
      // M6: Exit comparison mode when switching scenarios
      comparisonMode: {
        active: false,
        scenarios: [],
        labels: [],
        selectedIndices: [0, 1],
        comparison: null,
        apiResponse: null,
      },
    })

    scenarios.setCurrentScenarioId(id)

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

    try {
      if (currentScenarioId) {
        // Update existing scenario
        scenarios.updateScenario(currentScenarioId, {
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
        return currentScenarioId
      } else {
        // Create new scenario - auto-generate name if not provided
        const scenarioName = name
          || currentScenarioFraming?.title
          || `Decision - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

        const scenario = scenarios.createScenario({
          name: scenarioName,
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
      set({ currentScenarioId: null })
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

  // AI Model Selection setters (session-only, no localStorage persistence)
  setSelectedGenerationModel: (modelId: string | null) => {
    set({ selectedGenerationModel: modelId })
  },

  setSelectedRepairModel: (modelId: string | null) => {
    set({ selectedRepairModel: modelId })
  },

  setSelectedEnrichmentModel: (modelId: string | null) => {
    set({ selectedEnrichmentModel: modelId })
  },

  // Reset a specific model to default (used for error recovery)
  resetModelToDefault: (operation: 'generation' | 'repair' | 'enrichment') => {
    const resetMap = {
      generation: { selectedGenerationModel: null },
      repair: { selectedRepairModel: null },
      enrichment: { selectedEnrichmentModel: null },
    }
    set(resetMap[operation])
  },

  // A.15: Stage setter
  setCurrentStage: (stage) => set({ currentStage: stage }),

  // A.5+: Draft snapshot + undo
  setDraftChatPreDraftSnapshot: (snapshot) => set({ draftChatPreDraftSnapshot: snapshot }),
  undoDraft: () => {
    const { draftChatPreDraftSnapshot } = get()
    if (!draftChatPreDraftSnapshot) return

    pushToHistory(get, set)

    set({
      nodes: draftChatPreDraftSnapshot.nodes,
      edges: draftChatPreDraftSnapshot.edges,
      draftChatPreDraftSnapshot: null,
      // Clear analysis state from the undone draft
      ceeAnalysisReady: null,
      ceeAnalysisReadyNodeIds: null,
      ceePipelineTrace: null,
      ceeQuality: null,
    })

    // Crash resilience
    saveAutosave(
      draftChatPreDraftSnapshot.nodes,
      draftChatPreDraftSnapshot.edges,
    )
  },

  // Store last draft description for persistence across panel close/reopen
  setLastDraftDescription: (description: string) => {
    set({ lastDraftDescription: description })
    saveUIPreference('lastDraftDescription', description)
  },

  setLastDraftError: (error) => {
    set({ lastDraftError: error })
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
      // Persist to sessionStorage for tab-refresh survival (with node IDs for validation)
      try {
        sessionStorage.setItem('olumi-cee-analysis-ready', JSON.stringify(analysisReady))
        sessionStorage.setItem('olumi-cee-analysis-ready-node-ids', JSON.stringify(nodeIds))
      } catch {}
    } else {
      set({
        ceeAnalysisReady: null,
        ceeAnalysisReadyNodeIds: null,
        ceeQuality: null,
        goalConstraints: null,
        // Phase 1b: Clear extended CEE data
        ceeExtendedWarnings: null,
        ceeGoalConnectivity: null,
        ceeModelQualityFactors: null,
        ceeInterventionHints: null,
      })
      try {
        sessionStorage.removeItem('olumi-cee-analysis-ready')
        sessionStorage.removeItem('olumi-cee-analysis-ready-node-ids')
      } catch {}
    }
  },

  setGoalConstraints: (constraints: CEEGoalConstraint[] | null) => {
    set({ goalConstraints: constraints })
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
  setDimmedNodes: (ids: string[]) => {
    set({ dimmedNodeIds: new Set(ids) })
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
    set({ hoveredOptionId: optionId })
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
  },

  setShowDocumentsDrawer: (show: boolean) => {
    set({ showDocumentsDrawer: show })
    saveUIPreference('showDocumentsDrawer', show)
  },

  toggleProvenanceRedaction: () => {
    set(s => ({ provenanceRedactionEnabled: !s.provenanceRedactionEnabled }))
  },

  // M6: Compare & Snapshots actions
  setSelectedSnapshotsForComparison: (snapshotIds: string[]) => {
    // De-duplicate: Keep most recent two unique IDs, maintain order
    const unique = Array.from(new Set(snapshotIds))
    const capped = unique.slice(-2) // Most recent two

    // Ignore no-op re-selects (same IDs in same order)
    const current = get().selectedSnapshotsForComparison
    if (capped.length === current.length &&
        capped.every((id, i) => id === current[i])) {
      return // No-op
    }

    set({ selectedSnapshotsForComparison: capped })
  },

  setShowComparePanel: (show: boolean) => {
    set({ showComparePanel: show })
    saveUIPreference('showComparePanel', show)
  },

  setDecisionRationale: (rationale: DecisionRationale | null) => {
    set({ currentDecisionRationale: rationale })
  },

  // M6: Scenario Comparison Mode actions
  enterComparisonMode: (scenariosOrScenarioA, scenarioB, comparison = null, apiResponse = null, meta = {}) => {
    const scenarios = (Array.isArray(scenariosOrScenarioA)
      ? scenariosOrScenarioA
      : [scenariosOrScenarioA, scenarioB]
    ).filter((scenario): scenario is { nodes: Node[]; edges: Edge<EdgeData>[]; label: string } => Boolean(scenario))

    const labels = scenarios.map((scenario) => scenario.label)

    set({
      comparisonMode: {
        active: true,
        scenarios,
        labels,
        selectedIndices: [0, 1],
        hasMoreOptions: meta.hasMoreOptions ?? false,
        allOptionsCount: meta.allOptionsCount ?? scenarios.length,
        comparison,
        apiResponse,
      },
    })
  },

  setComparisonSelectedIndices: (indices) => {
    set((state) => ({
      comparisonMode: {
        ...state.comparisonMode,
        selectedIndices: indices,
      },
    }))
  },

  exitComparisonMode: () => {
    set({
      comparisonMode: {
        active: false,
        scenarios: [],
        labels: [],
        selectedIndices: [0, 1],
        hasMoreOptions: false,
        allOptionsCount: 0,
        comparison: null,
        apiResponse: null,
      },
    })
  },

  // Pending fit view setter
  setPendingFitView: (value: boolean) => {
    set({ pendingFitView: value })
  },

  setFullDraftAppliedAt: (ts: number) => {
    set({ fullDraftAppliedAt: ts })
  },

  // Debug: Raw CEE output mode setter
  setDebugRawCeeOutput: (value: boolean) => {
    if (value) {
      console.warn('[CEE] Raw output mode enabled')
    }
    set({ debugRawCeeOutput: value })
  },

  // Week 3: AI Clarifier actions
  setShowAIClarifier: (show: boolean) => {
    set({ showAIClarifier: show })
    // Close draft chat when opening clarifier
    if (show) {
      set({ showDraftChat: false })
    }
    // Clean up clarifier state when closing
    if (!show) {
      get().completeClarifierSession()
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
      get().applyLayout().catch(err => {
        console.warn('[applyClarifierGraph] Layout failed:', err)
      })
      // Request fit view after layout completes (handled by ReactFlowGraph)
      set({ pendingFitView: true })
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
      get().applyLayout().catch(err => {
        console.warn('[applyClarifierGraph] Layout failed:', err)
      })
      // Request fit view after layout completes (handled by ReactFlowGraph)
      set({ pendingFitView: true })
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
    const { nodes, edges, results, currentDecisionRationale } = get()

    const exportData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      graph: { nodes, edges },
      lastRun: results.report ? {
        summary: results.report.summary,
        p10: results.report.p10,
        p50: results.report.p50,
        p90: results.report.p90,
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
    }

    // Reset history and selection for clean state
    if (loaded.nodes || loaded.edges) {
      updates.history = { past: [], future: [] }
      updates.selection = { nodeIds: new Set(), edgeIds: new Set() }
      updates.touchedNodeIds = new Set()
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
  return getInvalidNodesUtil(state.nodes, state.edges, state.touchedNodeIds)
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
  return getNextInvalidNodeUtil(state.nodes, state.edges, state.touchedNodeIds, currentNodeId)
}

/**
 * Results panel selectors
 */
export const selectResultsStatus = (state: CanvasState): ResultsStatus => state.results.status
export const selectProgress = (state: CanvasState): number => state.results.progress
export const selectReport = (state: CanvasState): ReportV1 | null | undefined => state.results.report
export const selectDrivers = (state: CanvasState): Array<{ kind: 'node' | 'edge'; id: string }> | undefined => state.results.drivers
export const selectError = (state: CanvasState): { code: string; message: string; retryAfter?: number; request_id?: string } | null | undefined => state.results.error
export const selectRunId = (state: CanvasState): string | undefined => state.results.runId
export const selectSeed = (state: CanvasState): number | undefined => state.results.seed
export const selectHash = (state: CanvasState): string | undefined => state.results.hash
/** A.9: Provenance of the current results — 'direct' | 'conversation' | undefined */
export const selectResultsSource = (state: CanvasState): 'direct' | 'conversation' | undefined => state.results.resultsSource
/** A1: Previous report snapshot for delta display */
export const selectPreviousReport = (state: CanvasState): PreviousReportSnapshot | null => state.previousReport
