/**
 * Debug Bundle Export Utility
 *
 * Exports all debug data as a comprehensive JSON bundle or individual files.
 * Creates a structured bundle containing all payloads and diagnostic info.
 */

import type {
  DebugData,
  BuildVersions,
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

interface DebugBundle {
  /** Bundle metadata */
  meta: {
    version: '1.4'
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
    node_extraction: unknown
    connectivity: unknown
  }
  /** ISL diagnostic details */
  isl_diagnostic: {
    data_source: 'downstream_calls' | 'direct_capture' | 'none'
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
    factors: Array<{ id: string; label: string; type: string; description?: string }>
    edges: Array<{
      id: string
      source: string
      target: string
      label?: string
      strength?: number
      strength_mean?: number
      strength_std?: number
      belief_exists?: number
      effect_direction?: string
    }>
    options: Array<{ id: string; label: string; type: string; description?: string }>
  }

  // Enhancement sections (Debug Panel V2.1)

  /** Orchestrator status from CEE pipeline */
  orchestrator?: OrchestratorStatus | null

  /** V12.4 category field presence check for factors */
  v12_4_checks?: V12_4Checks | null

  /** Request ID chain for tracking ID propagation across services */
  request_id_chain?: RequestIdChain | null

  /** Feature flags at the time of request */
  feature_flags_at_request?: FeatureFlagsAtRequest | null

  /** Timestamps per service for timing analysis */
  timing?: ServiceTiming | null

  /** Schema version consistency check */
  schema_versions?: SchemaVersions | null

  /** CEE Observability data (sanitized - raw I/O stripped) */
  cee_observability?: Omit<CEEObservabilityData, 'llm_calls'> & {
    llm_calls: Array<Omit<CEEObservabilityData['llm_calls'][number], 'raw_prompt' | 'raw_response'>>
  } | null
}

// =============================================================================
// Types for Graph Data Export
// =============================================================================

export interface FullGraphData {
  nodes: Array<{
    id: string
    data: {
      label?: string
      kind?: string
      type?: string
      description?: string
    }
  }>
  edges: Array<{
    id: string
    source: string
    target: string
    label?: string
    data?: {
      strength?: number
      strength_mean?: number
      confidence?: number
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

function generateReadme(data: DebugData): string {
  const timestamp = formatTimestamp()
  const requestId = data.overall.request_id ?? 'unknown'
  const environment = getEnvironment()

  return `# Olumi Debug Bundle

Generated: ${timestamp}
Request ID: ${requestId}
Environment: ${environment}

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
- Long strings truncated to 1000 characters (except llm_raw.text which is preserved in full)
- Arrays capped to 100 items
- Sensitive keys (password, token, secret, apiKey) masked
- Object depth limited to 8 levels

Despite redaction, payloads may still contain decision content
(factor names, option labels, goal descriptions).

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
 * Transform canvas graph data into export format
 *
 * Node kind priority: data.kind > data.type (lowercased) > 'factor'
 * Edge strength priority: data.strength_mean > data.strength > data.confidence
 */
function transformGraphData(graphData: FullGraphData): NonNullable<DebugBundle['full_graph']> {
  const factors: DebugBundle['full_graph'] extends { factors: infer T } | undefined ? T : never = []
  const options: DebugBundle['full_graph'] extends { options: infer T } | undefined ? T : never = []

  for (const node of graphData.nodes) {
    // Use kind (preferred) or fall back to type
    const nodeKind = (node.data?.kind ?? node.data?.type ?? 'factor').toLowerCase()
    const entry = {
      id: node.id,
      label: node.data?.label ?? '',
      type: nodeKind,
      description: node.data?.description,
    }

    if (nodeKind === 'option') {
      options.push(entry)
    } else {
      // All non-option nodes go into factors (goals, decisions, factors, risks, etc.)
      factors.push(entry)
    }
  }

  const edges = graphData.edges.map((edge) => {
    // Extract strength with priority: strength_mean > strength > confidence
    const strength = edge.data?.strength_mean ?? edge.data?.strength ?? edge.data?.confidence
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.data?.label ?? edge.label,
      strength,
      // Include additional edge metadata for analysis
      strength_mean: edge.data?.strength_mean,
      strength_std: edge.data?.strength_std,
      belief_exists: edge.data?.belief_exists,
      effect_direction: edge.data?.effect_direction,
    }
  })

  return { factors, edges, options }
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
// Export Functions
// =============================================================================

/**
 * Build a complete debug bundle from DebugData
 */
export function buildDebugBundle(data: DebugData, options: ExportOptions = {}): DebugBundle {
  const timestamp = formatTimestamp()
  const versionInfo = getVersionInfo()
  const clientBuild = getClientBuild()

  // Transform graph data if requested
  const fullGraph =
    options.includeFullGraph && options.graphData
      ? transformGraphData(options.graphData)
      : undefined

  // Detect if any payloads or full_graph were truncated during capture
  const payloadsTruncated = detectTruncation(data.payloads)
  const graphTruncated = fullGraph ? detectTruncation(fullGraph) : false
  const truncationApplied = payloadsTruncated || graphTruncated

  return {
    meta: {
      version: '1.4',
      created_at: timestamp,
      request_id: data.overall.request_id,
      client_build: clientBuild,
      environment: getEnvironment(),
      redaction: {
        enabled: true,
        max_string_length: 1000,
        max_array_items: 100,
        max_depth: 8,
        never_truncate_keys: ['text'],
      },
      ...(truncationApplied && {
        truncation_applied: true,
        truncation_message: 'Large graph — arrays capped at 100 items',
      }),
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
      cee_request: data.payloads.cee_request ?? null,
      cee_response: data.payloads.cee_response ?? null,
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
    },
    gates: data.gates.map((g) => ({
      name: g.name,
      status: g.status,
      message: g.message,
    })),
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

    // Enhancement sections (Debug Panel V2.1)
    orchestrator: data.orchestrator,
    v12_4_checks: data.v12_4_checks,
    request_id_chain: data.request_id_chain,
    feature_flags_at_request: data.feature_flags_at_request,
    timing: data.timing,
    schema_versions: data.schema_versions,

    // CEE Observability (sanitized - raw I/O always stripped for security)
    cee_observability: data.cee_observability
      ? {
          llm_calls: data.cee_observability.llm_calls.map(
            ({ raw_prompt, raw_response, ...call }) => call
          ),
          validation: data.cee_observability.validation,
          orchestrator: data.cee_observability.orchestrator,
          totals: data.cee_observability.totals,
          request_id: data.cee_observability.request_id,
          raw_io_included: false, // Always false in exports for security
        }
      : null,
  }
}

/**
 * Export all debug data as a single JSON bundle file
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
