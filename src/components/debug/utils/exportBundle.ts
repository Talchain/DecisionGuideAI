/**
 * Debug Bundle Export Utility
 *
 * Exports all debug data as a comprehensive JSON bundle or individual files.
 * Creates a structured bundle containing all payloads and diagnostic info.
 *
 * v1.5: Comprehensive capture upgrade — always-on.
 */

import type {
  DebugData,
  BuildVersions,
  CeeTraceData,
  DiagnosticChecks,
  LlmRawData,
  ValidationIssue,
  ValidationSummary,
  OrchestratorStatus,
  V12_4Checks,
  RequestIdChain,
  FeatureFlagsAtRequest,
  ServiceTiming,
  SchemaVersions,
  CEEObservabilityData,
} from '../hooks/useDebugData'
import { getVersionInfo, getClientBuild } from '../../../lib/version-cache'
import { getBufferedLogs, type BufferedLog } from '../../../utils/debugLogBuffer'
import { DEBUG_LLM_RAW_MAX_CHARS } from '../../../utils/payloadRedaction'
import { getUserActions } from '../../../lib/debug-state'

// =============================================================================
// Types
// =============================================================================

interface DiagnosticInfo {
  timestamp: string
  request_id: string | null
  environment: string
  client_version: string
  user_agent: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

function getPipelinePath(value: unknown): 'unified' | 'legacy' | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (normalized.includes('unified')) return 'unified'
  if (normalized.includes('legacy')) return 'legacy'
  return null
}

function toWarningsList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object' && typeof (item as Record<string, unknown>).code === 'string') {
        return (item as Record<string, unknown>).code as string
      }
      return null
    })
    .filter((v): v is string => typeof v === 'string')
}

function extractIslRawFields(islResponse: unknown) {
  const isl = asRecord(islResponse)
  const factorSensitivity = Array.isArray(isl?.factor_sensitivity_3c_fields)
    ? isl.factor_sensitivity_3c_fields
    : []

  return {
    stability_thresholds: asRecord(isl?.stability_thresholds),
    factor_sensitivity_3c_fields: factorSensitivity.filter(
      (item): item is Record<string, unknown> => !!item && typeof item === 'object'
    ),
    confounding_sensitivity: asRecord(isl?.confounding_sensitivity),
  }
}

function extractCausalClaimsDiagnostic(ceeResponse: unknown): DebugBundle['pipeline']['causal_claims_diagnostic'] {
  const cee = asRecord(ceeResponse)
  const trace = asRecord(cee?.trace)
  const pipeline = asRecord(trace?.pipeline ?? cee?.pipeline)

  const hasCausalClaimsField =
    (pipeline && Object.prototype.hasOwnProperty.call(pipeline, 'causal_claims')) ||
    (cee && Object.prototype.hasOwnProperty.call(cee, 'causal_claims'))

  const rawClaims = (pipeline?.causal_claims ?? cee?.causal_claims) as unknown
  const validatedClaims = (pipeline?.validated_causal_claims ?? cee?.validated_causal_claims) as unknown
  const droppedClaims = (pipeline?.dropped_causal_claims ?? cee?.dropped_causal_claims) as unknown

  const rawCount = Array.isArray(rawClaims) ? rawClaims.length : 0
  const validatedCount = Array.isArray(validatedClaims)
    ? validatedClaims.length
    : (typeof pipeline?.causal_claims_validated_count === 'number'
        ? pipeline.causal_claims_validated_count
        : 0)
  const droppedCount = Array.isArray(droppedClaims)
    ? droppedClaims.length
    : Math.max(rawCount - validatedCount, 0)

  const warnings = [
    ...toWarningsList(cee?.validation_warnings),
    ...toWarningsList(trace?.validation_warnings),
    ...toWarningsList(pipeline?.validation_warnings),
  ].filter((code) => code.includes('CAUSAL_CLAIM'))

  return {
    llm_emitted: Boolean(hasCausalClaimsField),
    raw_count: rawCount,
    validated_count: validatedCount,
    dropped_count: droppedCount,
    warnings,
  }
}

function extractCeePipelineQuickFields(data: DebugData): {
  cee_pipeline_path: 'unified' | 'legacy' | null
  cee_strp_mutations_count: number | null
} {
  const repairSummary = asRecord(data.cee_observability?.repair_summary)
  const pathFromRepairSummary = getPipelinePath(
    repairSummary?.cee_pipeline_path ?? repairSummary?.pipeline_path
  )
  const pathFromProvenance = getPipelinePath(data.pipeline.cee_provenance?.pipeline_path)

  const strpFromRepairSummary =
    typeof repairSummary?.cee_strp_mutations_count === 'number'
      ? repairSummary.cee_strp_mutations_count
      : typeof repairSummary?.strp_mutations_count === 'number'
        ? repairSummary.strp_mutations_count
        : Array.isArray(repairSummary?.strp_mutations)
          ? repairSummary.strp_mutations.length
          : null

  const strpFromPipeline = Array.isArray((data.pipeline.strp as Record<string, unknown> | undefined)?.mutations)
    ? (((data.pipeline.strp as Record<string, unknown>).mutations as unknown[]).length)
    : null

  return {
    cee_pipeline_path: pathFromRepairSummary ?? pathFromProvenance,
    cee_strp_mutations_count: strpFromRepairSummary ?? strpFromPipeline,
  }
}

// =============================================================================
// V1.5 types — display_state, enriched full_graph, orchestrator context,
// user actions, panel state
// =============================================================================

/** V1.5: Display state snapshot — what the UI actually rendered at export time */
export interface DisplayState {
  active_panel: string | null
  active_tab: string | null
  active_section: string | null
  canvas_node_count: number
  canvas_edge_count: number
  canvas_node_types: Record<string, number>
  rendered_options: Array<{
    id: string
    label_displayed: string | null
    win_probability_displayed: string | null
    rank_displayed: number | null
  }> | null
  rendered_factors: Array<{
    id: string
    label_displayed: string | null
    value_displayed: string | null
    sensitivity_displayed: string | null
  }> | null
  analysis_status_displayed: string | null
  hero_headline_displayed: string | null
}

/** V1.5: Enriched full_graph node with all store fields */
export interface EnrichedGraphNode {
  id: string
  label: string
  type: string
  kind?: string
  description?: string
  observed_state?: Record<string, unknown> | null
  category?: string | null
  interventions?: unknown[] | null
  interventionKeys?: string[] | null
  data?: Record<string, unknown>
}

/** V1.5: Enriched full_graph edge with all store fields */
export interface EnrichedGraphEdge {
  id: string
  source: string
  target: string
  label?: string
  strength?: number
  strength_mean?: number
  strength_std?: number
  belief_exists?: number
  effect_direction?: string
  weight?: number
  direction?: string
  beliefStrength?: number
}

/** V1.5: Enriched full_graph with _meta */
export interface EnrichedFullGraph {
  _meta: {
    node_type_field: string
    enriched: true
  }
  factors: EnrichedGraphNode[]
  edges: EnrichedGraphEdge[]
  options: EnrichedGraphNode[]
}

/** V1.5: Orchestrator context */
export interface OrchestratorContext {
  turn_count: number
  current_turn_type: string | null
  last_turn_id: string | null
  active_coaching_signals: string[]
  last_response_blocks: Array<{
    block_type: string
    block_id: string | null
    state: string
  }> | null
  conversation_length: number
  zone1_prompt_id: string | null
  zone2_assembly_keys: string[] | null
  _unavailable_reason?: string
}

/** V1.5: User action entry */
export interface UserActionEntry {
  action: string
  timestamp: string
  detail?: Record<string, unknown>
}

/** V1.5: Panel state */
export interface PanelStateV1_5 {
  available: true
  source: 'export_time_snapshot'
  panels: Record<string, { visible: boolean; active_tab?: string }>
}

// =============================================================================
// Bundle type — supports both v1.4 and v1.5
// =============================================================================

interface DebugBundle {
  /** Bundle metadata */
  meta: {
    version: '1.5'
    created_at: string
    request_id: string | null
    client_build: string | null
    environment: string
    /** Redaction policy applied at capture time */
    redaction: {
      enabled: true
      max_string_length: number
      max_array_items: number
      max_depth: number
      never_truncate_keys?: string[]
      never_truncate_max_length?: number
    }
    /** Whether any arrays were truncated during capture */
    truncation_applied?: boolean
    /** Message when truncation occurred */
    truncation_message?: string
  }
  /** Diagnostic summary */
  diagnostic: DiagnosticInfo
  /** Service build versions */
  builds: BuildVersions
  /** All payloads */
  payloads: {
    cee_request: unknown
    cee_response: unknown
    plot_request: unknown
    plot_response: unknown
    isl_request: unknown
    isl_response: unknown
  }
  /** Service status summary */
  services: {
    cee: { status: number | null; duration_ms: number | null; success: boolean } | null
    plot: { status: number | null; duration_ms: number | null; success: boolean } | null
    isl: { status: number | null; duration_ms: number | null; success: boolean } | null
  }
  /** Pipeline summary */
  pipeline: {
    status: string
    total_duration_ms: number | null
    llm_metadata: unknown
    llm_raw: LlmRawData | null
    cee_pipeline_path: 'unified' | 'legacy' | null
    cee_strp_mutations_count: number | null
    causal_claims_diagnostic: {
      llm_emitted: boolean
      raw_count: number
      validated_count: number
      dropped_count: number
      warnings: string[]
    }
    node_extraction: unknown
    connectivity: unknown
  }
  /** ISL diagnostic details */
  isl_diagnostic: {
    data_source: 'downstream_calls' | 'direct_capture' | 'plot_response_extraction' | 'none'
    downstream_calls_path_found: string | null
    downstream_calls_paths_checked: string[]
    plot_response_keys: string[]
    downstream_calls_content: unknown
    plot_build: string | null
    expected_plot_build_with_feature: string
    endpoint: string | null
    status_code: number | null
    duration_ms: number | null
    success: boolean | null
    error: string | null
    isl_raw_fields: {
      stability_thresholds: Record<string, unknown> | null
      factor_sensitivity_3c_fields: Array<Record<string, unknown>>
      confounding_sensitivity: Record<string, unknown> | null
    }
  }
  /** Gate statuses */
  gates: Array<{ name: string; status: string; message?: string }>
  /** Graph validation issues (ISL critiques + UI-side checks) */
  validation: {
    summary: ValidationSummary & {
      cee_repairs?: number
      cee_retries?: number
    }
    issues: ValidationIssue[]
  }
  /** Captured console logs */
  console_logs: BufferedLog[]
  /** Diagnostic checks for troubleshooting */
  diagnostic_checks: DiagnosticChecks
  /** README content */
  readme: string
  /** Full graph data (when explicitly requested) */
  full_graph?: {
    _meta?: { node_type_field: string; enriched: true }
    factors: Array<Record<string, unknown>>
    edges: Array<Record<string, unknown>>
    options: Array<Record<string, unknown>>
  }

  // Enhancement sections (Debug Panel V2.1)

  /** Orchestrator status from CEE pipeline */
  orchestrator?: OrchestratorStatus | OrchestratorContext | null

  /** V12.4 category field presence check for factors */
  v12_4_checks?: V12_4Checks | null

  /** Request ID chain for tracking ID propagation across services */
  request_id_chain?: RequestIdChain | null

  /** Feature flags at the time of request */
  feature_flags_at_request?: FeatureFlagsAtRequest | Record<string, boolean> | null

  /** Timestamps per service for timing analysis */
  timing?: ServiceTiming | null

  /** Schema version consistency check */
  schema_versions?: SchemaVersions | null

  /** CEE Observability data (sanitized - raw I/O stripped) */
  cee_observability?: Omit<CEEObservabilityData, 'llm_calls'> & {
    llm_calls: Array<Omit<CEEObservabilityData['llm_calls'][number], 'raw_prompt' | 'raw_response'>>
  } | null
  /** CEE routing + trace metadata including resolved LLM model/provider */
  cee_trace?: CeeTraceData | null
  export_summary_schema: {
    derivation: 'export_time_from_debugdata_only'
    runtime_capture_included: boolean
    note: string
  }
  session: {
    timestamp: string
    request_id: string | null
    build_info: {
      client_build: string | null
      client_version: string
      environment: string
    }
    feature_flags: Record<string, unknown> | null
    scenario_id: null
    current_route: null
    session_id: null
    session_started_at: null
    session_duration_ms: null
  }
  user_actions: UserActionEntry[] | []
  request_summary: Array<{
    request_id: string | null
    ui_generated_request_id: string | null
    plot_request_id: string | null
    isl_request_id: string | null
    cee_trace_id: string | null
    request_chain_present: boolean
  }>
  response_summary: Array<{
    service: 'cee' | 'plot' | 'isl'
    status: number | null
    duration_ms: number | null
    success: boolean | null
    error: string | null
    payload_present: boolean
  }>
  repair_and_filter_summary: Array<{
    source: string
    available: boolean
    repairs_applied: number | null
    repair_types: string[] | null
    retries: number | null
  }>
  render_summary: {
    available: boolean
    source: null
  }
  panel_state: {
    available: boolean
    source: null | 'export_time_snapshot'
    panels?: Record<string, { visible: boolean; active_tab?: string }>
  }
  cross_surface_events: []

  /** Display state snapshot — what the UI actually rendered at export time */
  display_state: DisplayState | null
}

// =============================================================================
// Types for Graph Data Export
// =============================================================================

export interface FullGraphData {
  nodes: Array<{
    id: string
    data: Record<string, unknown> & {
      label?: string
      kind?: string
      type?: string
      description?: string
      observedState?: Record<string, unknown>
      category?: string
      interventions?: unknown[]
      interventionKeys?: string[]
    }
  }>
  edges: Array<{
    id: string
    source: string
    target: string
    label?: string
    data?: Record<string, unknown> & {
      strength?: number
      strength_mean?: number
      strength_std?: number
      confidence?: number
      belief_exists?: number
      beliefExists?: number
      beliefStrength?: number
      effect_direction?: string
      direction?: string
      weight?: number
      label?: string
      kind?: string
    }
  }>
}

export interface ExportOptions {
  /** Include full graph data (factors, edges, options) */
  includeFullGraph?: boolean
  /** Graph data from canvas store */
  graphData?: FullGraphData
  /** V1.5: Display state captured at export time */
  displayState?: DisplayState | null
}

// =============================================================================
// Helpers
// =============================================================================

function getEnvironment(): string {
  return import.meta.env.VITE_APP_ENV || 'development'
}

function formatTimestamp(): string {
  return new Date().toISOString()
}

function formatShortTimestamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
}

function buildRequestSummaries(data: DebugData): DebugBundle['request_summary'] {
  return [{
    request_id: data.overall.request_id ?? null,
    ui_generated_request_id: data.request_id_chain?.ui_generated ?? null,
    plot_request_id: data.request_id_chain?.from_plot?.plot ?? null,
    isl_request_id: data.request_id_chain?.from_plot?.isl ?? null,
    cee_trace_id: data.request_id_chain?.draft_trace?.cee_trace ?? null,
    request_chain_present: Boolean(data.request_id_chain?.plot_chain_present || data.request_id_chain?.from_plot),
  }]
}

function buildResponseSummaries(data: DebugData): DebugBundle['response_summary'] {
  return ([
    ['cee', data.services.cee, data.payloads.cee_response],
    ['plot', data.services.plot, data.payloads.plot_response],
    ['isl', data.services.isl, data.payloads.isl_response],
  ] as const).map(([service, serviceData, payload]) => ({
    service,
    status: serviceData?.status ?? null,
    duration_ms: serviceData?.duration_ms ?? null,
    success: serviceData?.success ?? null,
    error: serviceData?.error ?? null,
    payload_present: payload != null,
  }))
}

function buildRepairSummaries(data: DebugData): DebugBundle['repair_and_filter_summary'] {
  const repairSummary = asRecord(data.cee_observability?.repair_summary)
  const validation = data.cee_observability?.validation ?? null

  return [{
    source: 'cee_observability.repair_summary',
    available: repairSummary !== null || validation !== null,
    repairs_applied: typeof repairSummary?.repairs_applied === 'number'
      ? repairSummary.repairs_applied
      : validation?.repairs_triggered
        ? validation.repair_types.length
        : null,
    repair_types: Array.isArray(repairSummary?.repair_types)
      ? repairSummary.repair_types.filter((item): item is string => typeof item === 'string')
      : validation?.repair_types ?? null,
    retries: validation
      ? (validation.retry_triggered ? validation.attempts - 1 : 0)
      : null,
  }]
}

function generateReadme(data: DebugData): string {
  const timestamp = formatTimestamp()
  const requestId = data.overall.request_id ?? 'unknown'
  const environment = getEnvironment()

  return `# Olumi Debug Bundle

Generated: ${timestamp}
Request ID: ${requestId}
Environment: ${environment}
Version: 1.5

## Contents

- diagnostic.json - System and request metadata
- cee_request.json - CEE draft-graph request payload
- cee_response.json - CEE draft-graph response payload
- plot_request.json - PLoT v2/run request payload
- plot_response.json - PLoT v2/run response payload
- isl_request.json - ISL robustness request payload (if available)
- isl_response.json - ISL robustness response payload (if available)

## Data Redaction Notice

Payloads are REDACTED at capture time:
- Long strings truncated to 1000 characters (except llm_raw text-like fields, capped at ${DEBUG_LLM_RAW_MAX_CHARS} chars)
- Arrays capped to 100 items
- Sensitive keys (password, token, secret, apiKey) masked
- Object depth limited to 8 levels

Despite redaction, payloads may still contain decision content
(factor names, option labels, goal descriptions).

## V1.5 Sections

- display_state — Snapshot of what the UI was rendering at export time
- user_actions — Ring buffer of recent user interactions (max 50)
- panel_state.panels — Visibility state of all panels
- full_graph (enriched) — Full node/edge data including observed_state, category, interventions
- orchestrator — Conversation orchestrator context (turn count, blocks, coaching signals)
- schema_versions — Schema versions used for CEE/PLoT requests/responses
- feature_flags_at_request — All VITE_ENABLE_/VITE_FEATURE_ flags at export time

## Usage

1. Share this bundle with the engineering team for debugging
2. Do NOT share publicly - contains decision content even after redaction
3. Request ID can be used to correlate with server logs

## Service Status

CEE: ${data.services.cee?.success ? 'OK' : data.services.cee?.error ? 'ERROR' : 'N/A'}
PLoT: ${data.services.plot?.success ? 'OK' : data.services.plot?.error ? 'ERROR' : 'N/A'}
ISL: ${data.services.isl?.success ? 'OK' : data.services.isl?.error ? 'ERROR' : 'N/A'}
`
}

function downloadFile(content: string, filename: string, type = 'application/json'): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Transform canvas graph data into enriched export format.
 * Captures the full node/edge data from the store for data-produced-vs-displayed comparison.
 */
function transformGraphDataEnriched(graphData: FullGraphData): EnrichedFullGraph {
  const factors: EnrichedGraphNode[] = []
  const options: EnrichedGraphNode[] = []

  for (const node of graphData.nodes) {
    const nodeKind = (node.data?.kind ?? node.data?.type ?? 'factor').toLowerCase()
    const entry: EnrichedGraphNode = {
      id: node.id,
      label: node.data?.label ?? '',
      type: nodeKind,
      kind: node.data?.kind ?? undefined,
      description: node.data?.description,
      observed_state: node.data?.observedState ?? null,
      category: node.data?.category ?? null,
      interventions: node.data?.interventions ?? null,
      interventionKeys: node.data?.interventionKeys ?? null,
    }

    if (nodeKind === 'option') {
      options.push(entry)
    } else {
      factors.push(entry)
    }
  }

  const edges: EnrichedGraphEdge[] = graphData.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.data?.label ?? edge.label,
    strength: edge.data?.strength_mean ?? edge.data?.strength ?? edge.data?.confidence,
    strength_mean: edge.data?.strength_mean,
    strength_std: edge.data?.strength_std,
    belief_exists: edge.data?.belief_exists ?? edge.data?.beliefExists,
    effect_direction: edge.data?.effect_direction ?? edge.data?.direction,
    weight: edge.data?.weight,
    direction: edge.data?.direction,
    beliefStrength: edge.data?.beliefStrength,
  }))

  return {
    _meta: {
      node_type_field: 'type',
      enriched: true,
    },
    factors,
    edges,
    options,
  }
}

/**
 * Minimum array size threshold for reporting truncation in export metadata.
 * Only report truncation_applied when arrays had more items than this limit.
 */
const TRUNCATION_REPORT_THRESHOLD = 100

/**
 * Recursively check if any value was truncated with totalCount exceeding the threshold.
 * Only returns true when arrays actually had more than TRUNCATION_REPORT_THRESHOLD items.
 */
function detectTruncation(value: unknown, visited = new WeakSet<object>()): boolean {
  if (value === null || value === undefined) return false
  if (typeof value !== 'object') return false

  // Prevent circular reference loops
  if (visited.has(value as object)) return false
  visited.add(value as object)

  // Check for truncation marker with meaningful truncation (totalCount > threshold)
  const record = value as Record<string, unknown>
  if (record.__truncated === true && typeof record.totalCount === 'number') {
    // Only report truncation if the array actually exceeded the threshold
    if (record.totalCount > TRUNCATION_REPORT_THRESHOLD) {
      return true
    }
    // Array was truncated but at a smaller limit - don't propagate this truncation
    return false
  }

  // Recurse into arrays
  if (Array.isArray(value)) {
    return value.some((item) => detectTruncation(item, visited))
  }

  // Recurse into object values
  return Object.values(record).some((v) => detectTruncation(v, visited))
}

// =============================================================================
// V1.5: Collect feature flags snapshot
// =============================================================================

/**
 * Snapshot all VITE_ENABLE_ and VITE_FEATURE_ env vars at export time.
 * Returns a flat boolean map.
 */
function collectFeatureFlagsSnapshot(): Record<string, boolean> {
  const flags: Record<string, boolean> = {}
  try {
    const env = import.meta.env
    for (const key of Object.keys(env)) {
      if (key.startsWith('VITE_ENABLE_') || key.startsWith('VITE_FEATURE_')) {
        const val = env[key]
        flags[key] = val === '1' || val === 'true' || val === true
      }
    }
  } catch {
    // SSR or test environment
  }
  return flags
}

// =============================================================================
// V1.5: Collect schema versions from payloads
// =============================================================================

function collectSchemaVersions(data: DebugData): SchemaVersions {
  // Fall back to downstream CEE when direct payloads are null (orchestrator flow)
  const ceeReq = asRecord(data.payloads.cee_request) ?? asRecord(data.payloads.cee_downstream_request)
  const ceeRes = asRecord(data.payloads.cee_response) ?? asRecord(data.payloads.cee_downstream_response)
  const plotReq = asRecord(data.payloads.plot_request)
  const plotRes = asRecord(data.payloads.plot_response)
  const islReq = asRecord(data.payloads.isl_request)
  const islRes = asRecord(data.payloads.isl_response)

  const ceeRequestVersion = (ceeReq?.schema_version ?? ceeReq?._schema_version ?? ceeReq?.version) as string | null ?? null
  const ceeResponseVersion = (ceeRes?.schema_version ?? (asRecord(ceeRes?.trace)?.schema_version)) as string | null ?? null
  const plotRequestVersion = (plotReq?.schema_version ?? plotReq?._schema_version ?? plotReq?.version) as string | null ?? null
  const plotResponseVersion = (plotRes?.schema_version ?? (asRecord(plotRes?.meta)?.schema_version)) as string | null ?? null
  const islRequestVersion = (islReq?.schema_version ?? islReq?._schema_version ?? islReq?.version) as string | null ?? null
  const islResponseVersion = (islRes?.schema_version ?? (asRecord(islRes?.meta)?.schema_version)) as string | null ?? null

  const versions = [ceeRequestVersion, ceeResponseVersion, plotRequestVersion, plotResponseVersion, islRequestVersion, islResponseVersion].filter(Boolean)
  const consistent = versions.length <= 1 || new Set(versions).size === 1

  return {
    cee_request: ceeRequestVersion,
    cee_response: ceeResponseVersion,
    plot_request: plotRequestVersion,
    plot_response: plotResponseVersion,
    isl_request: islRequestVersion,
    isl_response: islResponseVersion,
    consistent,
  }
}

// =============================================================================
// V1.5: Collect user actions from debug-state ring buffer
// =============================================================================

function collectUserActions(): UserActionEntry[] {
  try {
    const actions = getUserActions()
    // Map from debug-state format to bundle format, cap at 50
    // Redact raw_message/display_text (user content) → replace with message_length
    return actions.slice(-50).map((a) => ({
      action: a.actionType,
      timestamp: a.timestamp,
      detail: redactUserActionDetail(a.payloadSummary),
    }))
  } catch {
    return []
  }
}

/** Strip user-authored text from action detail, preserving structural metadata */
function redactUserActionDetail(
  detail: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!detail) return detail
  const redacted = { ...detail }
  let hasRedaction = false
  for (const key of ['raw_message', 'display_text'] as const) {
    if (key in redacted) {
      const val = redacted[key]
      const len = typeof val === 'string' ? val.length : null
      delete redacted[key]
      if (!hasRedaction) {
        redacted.message_length = len
        hasRedaction = true
      }
    }
  }
  return redacted
}

// =============================================================================
// V1.5: Build orchestrator context from available stores
// =============================================================================

async function buildOrchestratorContext(): Promise<OrchestratorContext> {
  try {
    // Dynamic import to avoid circular deps
    const { useCanvasStore } = await import('../../../canvas/store')
    const state = useCanvasStore.getState()

    const runMeta = state.runMeta
    const ceeAnalysisReady = runMeta?.ceeAnalysisReady

    // Derive turn count from user actions (conversation messages are in React
    // state, not a Zustand store, so we approximate from the debug-state ring buffer)
    const actions = getUserActions()
    const chatActions = actions.filter((a) =>
      a.actionType === 'sent chat message' ||
      a.actionType === 'clicked chip' ||
      a.actionType === 'clicked retry' ||
      a.actionType === 'clicked run analysis'
    )
    const turnCount = chatActions.length
    const conversationLength = actions.length

    return {
      turn_count: turnCount,
      current_turn_type: ceeAnalysisReady ? 'explicit_generate' : null,
      last_turn_id: null,
      active_coaching_signals: [],
      last_response_blocks: null,
      conversation_length: conversationLength,
      zone1_prompt_id: null,
      zone2_assembly_keys: null,
      ...(turnCount === 0 && {
        _unavailable_reason: 'Turn count derived from user action ring buffer (may undercount if buffer wrapped).',
      }),
    }
  } catch {
    return {
      turn_count: 0,
      current_turn_type: null,
      last_turn_id: null,
      active_coaching_signals: [],
      last_response_blocks: null,
      conversation_length: 0,
      zone1_prompt_id: null,
      zone2_assembly_keys: null,
      _unavailable_reason: 'Canvas store not accessible from bundle assembly context.',
    }
  }
}

// =============================================================================
// V1.5: Build panel state from canvas store
// =============================================================================

async function buildPanelState(): Promise<PanelStateV1_5> {
  try {
    const { useCanvasStore } = await import('../../../canvas/store')
    const state = useCanvasStore.getState()

    return {
      available: true,
      source: 'export_time_snapshot',
      panels: {
        results: { visible: state.showResultsPanel ?? false },
        inspector: { visible: state.showInspectorPanel ?? false },
        chat: { visible: state.showDraftChat ?? false },
        templates: { visible: state.showTemplatesPanel ?? false },
        issues: { visible: state.showIssuesPanel ?? false },
      },
    }
  } catch {
    return {
      available: true,
      source: 'export_time_snapshot',
      panels: {},
    }
  }
}

// =============================================================================
// V1.5: Capture display state from canvas store at export time
// =============================================================================

/**
 * Derive the hero headline that HeroSection.tsx would display.
 * Mirrors the M1 headline logic: "{Winner} performs best" when analysis
 * succeeded with multiple options, or status-based fallbacks.
 */
function deriveHeroHeadline(
  results: Record<string, unknown> | null | undefined,
  optionCount: number,
): string | null {
  if (!results) return null
  const status = results.status as string | undefined
  if (status !== 'success' && status !== 'computed') return status ? `Analysis ${status}` : null
  if (optionCount === 0) return 'No options to evaluate'

  // Find winner from option_comparison (same source as HeroSection)
  const apiResponse = results.apiResponse as Record<string, unknown> | undefined
  const comparison = apiResponse?.option_comparison as
    Array<{ option_label?: string; win_probability?: number }> | undefined
  if (comparison && comparison.length > 0) {
    const sorted = [...comparison].sort(
      (a, b) => (b.win_probability ?? 0) - (a.win_probability ?? 0),
    )
    const winnerLabel = sorted[0]?.option_label
    if (winnerLabel) {
      if (optionCount === 1) return `${winnerLabel} is your only option`
      return `${winnerLabel} performs best`
    }
  }

  return null
}

/** Extract rendered factor state from canvas nodes for display_state */
function extractRenderedFactors(
  nodes: Array<{ id: string; data: unknown }>,
): DisplayState['rendered_factors'] {
  const factorNodes = nodes.filter((n) => {
    const d = n.data as Record<string, unknown> | undefined
    return d?.kind === 'factor' || d?.type === 'factor'
  })
  if (factorNodes.length === 0) return null

  return factorNodes.map((n) => {
    const d = n.data as Record<string, unknown>
    const obs = d?.observedState as Record<string, unknown> | undefined
    const value = obs?.value
    const unit = obs?.unit as string | undefined
    const valueStr = typeof value === 'number'
      ? (unit ? `${value} ${unit}` : String(value))
      : null
    return {
      id: n.id,
      label_displayed: (d?.label as string) ?? null,
      value_displayed: valueStr,
      sensitivity_displayed: null, // Sensitivity is computed at results time, not stored on nodes
    }
  })
}

/**
 * Capture what the UI is currently rendering: node/edge counts, node type
 * breakdown, and panel visibility. Called at export time from the async path.
 */
export async function captureDisplayState(): Promise<DisplayState> {
  try {
    const { useCanvasStore } = await import('../../../canvas/store')
    const state = useCanvasStore.getState()

    const nodes = state.nodes ?? []
    const edges = state.edges ?? []

    // Count node types
    const nodeTypes: Record<string, number> = {}
    for (const node of nodes) {
      const kind = ((node.data as Record<string, unknown>)?.kind as string)
        ?? ((node.data as Record<string, unknown>)?.type as string)
        ?? 'unknown'
      nodeTypes[kind] = (nodeTypes[kind] ?? 0) + 1
    }

    // Extract rendered options (from results if available)
    const results = state.results as Record<string, unknown> | null | undefined
    const optionNodes = nodes.filter((n) => {
      const d = n.data as Record<string, unknown> | undefined
      return d?.kind === 'option' || d?.type === 'option'
    })
    const renderedOptions = optionNodes.length > 0
      ? optionNodes.map((n, idx) => {
          const d = n.data as Record<string, unknown>
          return {
            id: n.id,
            label_displayed: (d?.label as string) ?? null,
            win_probability_displayed: null as string | null,
            rank_displayed: idx + 1,
          }
        })
      : null

    // Determine active panel
    const activePanel = state.showResultsPanel
      ? 'results'
      : state.showInspectorPanel
        ? 'inspector'
        : state.showDraftChat
          ? 'chat'
          : null

    // Analysis status from results store (hero headline is computed in UI components, not stored)
    const analysisStatus = results?.status as string | null ?? null

    return {
      active_panel: activePanel,
      active_tab: null, // Tab state is local to components, not in store
      active_section: null,
      canvas_node_count: nodes.length,
      canvas_edge_count: edges.length,
      canvas_node_types: nodeTypes,
      rendered_options: renderedOptions,
      rendered_factors: extractRenderedFactors(nodes),
      analysis_status_displayed: analysisStatus,
      hero_headline_displayed: deriveHeroHeadline(results, optionNodes.length),
    }
  } catch {
    return {
      active_panel: null,
      active_tab: null,
      active_section: null,
      canvas_node_count: 0,
      canvas_edge_count: 0,
      canvas_node_types: {},
      rendered_options: null,
      rendered_factors: null,
      analysis_status_displayed: null,
      hero_headline_displayed: null,
    }
  }
}

// =============================================================================
// V1.5: Fix gate capture — read final state at export time
// =============================================================================

function buildGatesPostPipeline(data: DebugData): DebugBundle['gates'] {
  const gates = data.gates.map((g) => ({
    name: g.name,
    status: g.status,
    message: g.message,
  }))

  // Task 6: If pipeline succeeded but graph_readiness is 'fail', override to 'pass'
  // This corrects the timing issue where gates were captured pre-run
  const pipelineSucceeded = data.overall.status === 'success'
  if (pipelineSucceeded) {
    for (const gate of gates) {
      if (gate.name === 'graph_readiness' && gate.status === 'fail') {
        gate.status = 'pass'
        gate.message = (gate.message ?? '') + ' [corrected: pipeline succeeded]'
      }
    }
  }

  return gates
}

// =============================================================================
// Export Functions
// =============================================================================

/**
 * Build a complete debug bundle from DebugData.
 * Always produces v1.5 bundles with enriched data.
 */
export function buildDebugBundle(data: DebugData, options: ExportOptions = {}): DebugBundle {
  const timestamp = formatTimestamp()
  const versionInfo = getVersionInfo()
  const clientBuild = getClientBuild()
  const requestSummary = buildRequestSummaries(data)
  const responseSummary = buildResponseSummaries(data)
  const repairAndFilterSummary = buildRepairSummaries(data)

  // Transform graph data if requested (always enriched)
  let fullGraph: DebugBundle['full_graph'] | undefined
  if (options.includeFullGraph && options.graphData) {
    fullGraph = transformGraphDataEnriched(options.graphData)
  }

  // Detect if any payloads or full_graph were truncated during capture
  const payloadsTruncated = detectTruncation(data.payloads)
  const graphTruncated = fullGraph ? detectTruncation(fullGraph) : false
  const truncationApplied = payloadsTruncated || graphTruncated
  const pipelineQuickFields = extractCeePipelineQuickFields(data)
  const causalClaimsDiagnostic = extractCausalClaimsDiagnostic(data.payloads.cee_response)
  const islRawFields = extractIslRawFields(data.payloads.isl_response)

  // User actions from debug-state ring buffer
  const userActions = collectUserActions()

  // Feature flags snapshot
  const featureFlagsAtRequest = collectFeatureFlagsSnapshot()

  // Schema versions from payloads (fallback to data if already extracted)
  const schemaVersions = data.schema_versions ?? collectSchemaVersions(data)

  // Gate state with post-pipeline correction
  const gates = buildGatesPostPipeline(data)

  return {
    meta: {
      version: '1.5',
      created_at: timestamp,
      request_id: data.overall.request_id,
      client_build: clientBuild,
      environment: getEnvironment(),
      redaction: {
        enabled: true,
        max_string_length: 1000,
        max_array_items: 100,
        max_depth: 8,
        never_truncate_keys: ['text', 'output_preview', 'output', 'content'],
        never_truncate_max_length: DEBUG_LLM_RAW_MAX_CHARS,
      },
      ...(truncationApplied && {
        truncation_applied: true,
        truncation_message: 'Large graph — arrays capped at 100 items',
      }),
    },
    export_summary_schema: {
      derivation: 'export_time_from_debugdata_only',
      runtime_capture_included: true,
      note: 'V1.5: Includes runtime capture (user_actions, display_state). Enriched full_graph captures all store fields.',
    },
    diagnostic: {
      timestamp,
      request_id: data.overall.request_id,
      environment: getEnvironment(),
      client_version: versionInfo?.short ?? 'unknown',
      user_agent: navigator.userAgent,
    },
    builds: data.builds,
    payloads: {
      // Fall back to downstream CEE calls (extracted from PLoT response) when
      // CEE wasn't called directly (orchestrator flow nests CEE inside PLoT)
      cee_request: data.payloads.cee_request ?? data.payloads.cee_downstream_request ?? null,
      cee_response: data.payloads.cee_response ?? data.payloads.cee_downstream_response ?? null,
      plot_request: data.payloads.plot_request ?? null,
      plot_response: data.payloads.plot_response ?? null,
      isl_request: data.payloads.isl_request ?? null,
      isl_response: data.payloads.isl_response ?? null,
    },
    services: {
      cee: data.services.cee
        ? {
            status: data.services.cee.status,
            duration_ms: data.services.cee.duration_ms,
            success: data.services.cee.success,
          }
        : null,
      plot: data.services.plot
        ? {
            status: data.services.plot.status,
            duration_ms: data.services.plot.duration_ms,
            success: data.services.plot.success,
          }
        : null,
      isl: data.services.isl
        ? {
            status: data.services.isl.status,
            duration_ms: data.services.isl.duration_ms,
            success: data.services.isl.success,
          }
        : null,
    },
    pipeline: {
      status: data.pipeline.status,
      total_duration_ms: data.pipeline.total_duration_ms ?? null,
      llm_metadata: data.pipeline.llm_metadata ?? null,
      llm_raw: data.pipeline.llm_raw ?? null,
      cee_pipeline_path: pipelineQuickFields.cee_pipeline_path,
      cee_strp_mutations_count: pipelineQuickFields.cee_strp_mutations_count,
      causal_claims_diagnostic: causalClaimsDiagnostic,
      node_extraction: data.pipeline.node_extraction ?? null,
      connectivity: data.pipeline.connectivity ?? null,
    },
    isl_diagnostic: {
      data_source: data.diagnostics.isl_data_source,
      downstream_calls_path_found: data.diagnostics.downstream_calls_path_found,
      downstream_calls_paths_checked: data.diagnostics.downstream_calls_paths_checked,
      plot_response_keys: data.payloads.plot_response
        ? Object.keys(data.payloads.plot_response as Record<string, unknown>)
        : [],
      downstream_calls_content: (data.payloads.plot_response as Record<string, unknown>)?.downstream_calls ?? null,
      plot_build: data.builds.plot,
      expected_plot_build_with_feature: '463baf6+',
      endpoint: data.services.isl?.endpoint ?? null,
      status_code: data.services.isl?.status ?? null,
      duration_ms: data.services.isl?.duration_ms ?? null,
      success: data.services.isl?.success ?? null,
      error: data.services.isl?.error ?? null,
      isl_raw_fields: islRawFields,
    },
    gates,
    validation: {
      summary: {
        ...data.validation.summary,
        ...(data.cee_observability?.validation && {
          cee_repairs: data.cee_observability.validation.repairs_triggered
            ? data.cee_observability.validation.repair_types.length
            : 0,
          cee_retries: data.cee_observability.validation.retry_triggered
            ? data.cee_observability.validation.attempts - 1
            : 0,
        }),
      },
      issues: data.validation.issues,
    },
    console_logs: getBufferedLogs(),
    diagnostic_checks: data.diagnostics,
    readme: generateReadme(data),
    ...(fullGraph && { full_graph: fullGraph }),
    session: {
      timestamp,
      request_id: data.overall.request_id,
      build_info: {
        client_build: clientBuild,
        client_version: versionInfo?.short ?? 'unknown',
        environment: getEnvironment(),
      },
      feature_flags: (featureFlagsAtRequest as Record<string, unknown> | null) ?? null,
      scenario_id: null,
      current_route: null,
      session_id: null,
      session_started_at: null,
      session_duration_ms: null,
    },
    user_actions: userActions,
    request_summary: requestSummary,
    response_summary: responseSummary,
    repair_and_filter_summary: repairAndFilterSummary,
    render_summary: {
      available: false,
      source: null,
    },
    panel_state: {
      available: false,
      source: null,
    },
    cross_surface_events: [],

    // Enhancement sections (Debug Panel V2.1)
    orchestrator: data.orchestrator,
    v12_4_checks: data.v12_4_checks,
    request_id_chain: data.request_id_chain,
    feature_flags_at_request: featureFlagsAtRequest,
    timing: data.timing,
    schema_versions: schemaVersions,

    // CEE routing + trace metadata (resolved model/provider from _route_metadata)
    cee_trace: data.ceeTrace ?? null,

    // CEE Observability (sanitized - raw I/O always stripped for security)
    cee_observability: data.cee_observability
      ? {
          llm_calls: data.cee_observability.llm_calls.map(
            ({ raw_prompt, raw_response, ...call }) => call
          ),
          validation: data.cee_observability.validation,
          orchestrator: data.cee_observability.orchestrator,
          totals: data.cee_observability.totals,
          graph_metrics: data.cee_observability.graph_metrics,
          graph_diffs: data.cee_observability.graph_diffs,
          request_id: data.cee_observability.request_id,
          raw_io_included: false, // Always false in exports for security
          repair_summary: data.cee_observability.repair_summary,
        }
      : null,

    // Display state (provided by caller at export time)
    display_state: options.displayState ?? null,
  }
}

/**
 * Build a complete debug bundle with async V1.5 sections.
 * Populates panel_state and orchestrator from stores (requires async import).
 * Use this from the export handler in DebugPanelV2.
 */
export async function buildDebugBundleAsync(data: DebugData, options: ExportOptions = {}): Promise<DebugBundle> {
  // Capture display state from store before building bundle
  if (!options.displayState) {
    try {
      options = { ...options, displayState: await captureDisplayState() }
    } catch {
      // Proceed without display state
    }
  }

  const bundle = buildDebugBundle(data, options)

  // Populate async sections: panel_state, orchestrator context
  try {
    const panelState = await buildPanelState()
    bundle.panel_state = panelState
  } catch {
    // Keep default
  }

  try {
    const orchContext = await buildOrchestratorContext()
    // Only override if the original orchestrator was null
    if (!bundle.orchestrator) {
      bundle.orchestrator = orchContext
    }
  } catch {
    // Keep default
  }

  return bundle
}

/**
 * Export all debug data as a single JSON bundle file (async).
 * Captures display_state, panel_state, and orchestrator context from stores.
 *
 * Filename format: olumi-debug-{short_request_id}-{date}.json
 */
export async function exportDebugBundleAsync(data: DebugData, options: ExportOptions = {}): Promise<void> {
  const bundle = await buildDebugBundleAsync(data, options)
  const json = JSON.stringify(bundle, null, 2)

  const shortId = data.overall.request_id?.slice(0, 8) ?? 'unknown'
  const date = formatShortTimestamp().slice(0, 8) // YYYYMMDD
  const filename = `olumi-debug-${shortId}-${date}.json`

  downloadFile(json, filename)
}

/**
 * Export all debug data as a single JSON bundle file (sync).
 * Does not capture display_state or panel_state from stores — use
 * exportDebugBundleAsync for full capture.
 *
 * Filename format: olumi-debug-{short_request_id}-{date}.json
 */
export function exportDebugBundle(data: DebugData, options: ExportOptions = {}): void {
  const bundle = buildDebugBundle(data, options)
  const json = JSON.stringify(bundle, null, 2)

  const shortId = data.overall.request_id?.slice(0, 8) ?? 'unknown'
  const date = formatShortTimestamp().slice(0, 8) // YYYYMMDD
  const filename = `olumi-debug-${shortId}-${date}.json`

  downloadFile(json, filename)
}

/**
 * Export individual payload file
 */
export function exportPayloadFile(
  payload: unknown,
  payloadType: string,
  requestId: string | null
): void {
  const json = JSON.stringify(payload, null, 2)
  const shortId = requestId?.slice(0, 8) ?? 'unknown'
  const timestamp = formatShortTimestamp()
  const filename = `${payloadType}-${shortId}-${timestamp}.json`

  downloadFile(json, filename)
}

/**
 * Copy request ID to clipboard
 */
export async function copyRequestId(requestId: string | null): Promise<boolean> {
  if (!requestId) return false

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(requestId)
      return true
    }

    // Fallback for older browsers
    const textarea = document.createElement('textarea')
    textarea.value = requestId
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textarea)
    return success
  } catch {
    return false
  }
}

export default exportDebugBundle
