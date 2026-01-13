/**
 * Diagnostic Bundle Export
 *
 * Creates a privacy-safe diagnostic bundle for debugging and support.
 * Contains: versions, gate statuses, request traces, session metadata.
 *
 * Privacy guarantees:
 * - No PII (user IDs, emails, names)
 * - No raw payloads (only hashes)
 * - No auth tokens or credentials
 * - Timestamps are included for correlation
 *
 * @example
 * ```typescript
 * import { exportDiagnosticBundle, createDiagnosticBundle } from '@/lib/diagnostic-bundle'
 *
 * // Trigger download
 * await exportDiagnosticBundle()
 *
 * // Or get bundle data directly
 * const bundle = createDiagnosticBundle()
 * console.log(bundle)
 * ```
 */

import { getRecentTraces, getPendingTraces, getFailedTraces, type RequestTrace, type DownstreamCall } from './debug-state'
import { useGateStore, ALL_GATES, type GateName } from './gate-state'
import { getClientBuild, getVersionInfo } from './version-cache'
import { getAllServiceHealthArray, type ServiceHealthInfo } from './service-health'
import type { CeePipelineTrace } from '../adapters/cee/types'
import type { ErrorDetail } from '../types/cee'
import { redactPayload } from '../utils/payloadRedaction'

/**
 * Sanitized downstream call for export
 */
interface SanitizedDownstreamCall {
  service: string
  status: number
  elapsedMs: number
  payloadHash: string
  responseHash?: string
}

/**
 * Sanitized trace received for export
 */
interface SanitizedTraceReceived {
  requestId: string
  payloadHash: string
  verified: boolean
}

/**
 * Sanitized request trace for export
 * (removes any potentially sensitive fields)
 */
interface SanitizedTrace {
  requestId: string
  endpoint: string
  method: string
  payloadHash: string
  timestamp: string
  status?: number
  responseHash?: string
  service?: string
  serviceBuild?: string
  elapsedMs?: number
  completed?: boolean
  /** Downstream service calls (if any) */
  downstream?: SanitizedDownstreamCall[]
  /** Trace verification data (if present) */
  traceReceived?: SanitizedTraceReceived
  // Note: we don't include rawError or upstreamHost for privacy
}

/**
 * Gate snapshot for export
 */
interface GateSnapshot {
  gate: GateName
  status: string
  updatedAt: string
  message?: string
  service?: string
}

/**
 * Service health info
 */
interface ServiceHealth {
  name: string
  build?: string
  status: 'unknown' | 'healthy' | 'degraded' | 'down'
  lastSeen?: string
}

/**
 * Browser/environment info (non-identifying)
 */
interface EnvironmentInfo {
  userAgent: string
  language: string
  platform: string
  screenWidth: number
  screenHeight: number
  devicePixelRatio: number
  timezone: string
  online: boolean
}

/**
 * Integration verification summary
 */
interface IntegrationVerification {
  /** Overall integration status */
  ok: boolean
  /** Number of traces with downstream calls */
  tracesWithDownstream: number
  /** Number of verified trace chains */
  verifiedChains: number
  /** Number of failed downstream calls */
  failedDownstreamCalls: number
  /** Issues detected */
  issues: string[]
}

/**
 * Full diagnostic bundle structure
 */
export interface DiagnosticBundle {
  /** Bundle format version */
  version: '1.0'
  /** Bundle creation timestamp (ISO 8601) */
  createdAt: string
  /** Client application info */
  client: {
    build: string
    branch?: string
    commit?: string
    builtAt?: string
    environment: string
  }
  /** Environment info (non-identifying) */
  environment: EnvironmentInfo
  /** Stage gate statuses */
  gates: GateSnapshot[]
  /** Recent request traces (sanitized) */
  traces: {
    recent: SanitizedTrace[]
    pending: SanitizedTrace[]
    failed: SanitizedTrace[]
  }
  /** Service health info (from response headers) */
  services: ServiceHealth[]
  /** Integration verification summary */
  integration: IntegrationVerification
  /** Session metadata */
  session: {
    durationMs: number
    pageUrl: string
    referrer: string
  }
}

/** Session start time for duration calculation */
const sessionStart = Date.now()

/**
 * Sanitize downstream calls for export
 */
function sanitizeDownstreamCalls(calls?: DownstreamCall[]): SanitizedDownstreamCall[] | undefined {
  if (!calls || calls.length === 0) return undefined
  return calls.map((call) => ({
    service: call.service,
    status: call.status,
    elapsedMs: call.elapsedMs,
    payloadHash: call.payloadHash,
    responseHash: call.responseHash,
  }))
}

/**
 * Sanitize trace received for export
 */
function sanitizeTraceReceived(trace: RequestTrace): SanitizedTraceReceived | undefined {
  if (!trace.traceReceived) return undefined
  return {
    requestId: trace.traceReceived.requestId,
    payloadHash: trace.traceReceived.payloadHash,
    verified: trace.traceReceived.payloadHash === trace.payloadHash,
  }
}

/**
 * Sanitize a request trace for export
 * Removes potentially sensitive fields
 */
function sanitizeTrace(trace: RequestTrace): SanitizedTrace {
  return {
    requestId: trace.requestId,
    endpoint: trace.endpoint,
    method: trace.method,
    payloadHash: trace.payloadHash,
    timestamp: trace.timestamp,
    status: trace.status,
    responseHash: trace.responseHash,
    service: trace.service,
    serviceBuild: trace.serviceBuild,
    elapsedMs: trace.elapsedMs,
    completed: trace.completed,
    downstream: sanitizeDownstreamCalls(trace.downstream),
    traceReceived: sanitizeTraceReceived(trace),
    // Intentionally omit: error (may contain stack traces), upstreamHost (internal infra)
  }
}

/**
 * Get environment info (non-identifying)
 */
function getEnvironmentInfo(): EnvironmentInfo {
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screenWidth: screen.width,
    screenHeight: screen.height,
    devicePixelRatio: window.devicePixelRatio,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    online: navigator.onLine,
  }
}

/**
 * Extract unique services from traces
 */
function extractServicesFromTraces(traces: RequestTrace[]): Map<string, ServiceHealth> {
  const serviceMap = new Map<string, ServiceHealth>()

  for (const trace of traces) {
    if (trace.service && !serviceMap.has(trace.service)) {
      serviceMap.set(trace.service, {
        name: trace.service,
        build: trace.serviceBuild,
        status: trace.completed && trace.status && trace.status >= 200 && trace.status < 300 ? 'healthy' : 'unknown',
        lastSeen: trace.responseTimestamp || trace.timestamp,
      })
    }
  }

  return serviceMap
}

/**
 * Merge health endpoint data with trace-extracted services
 */
function mergeServiceHealth(
  traceServices: Map<string, ServiceHealth>,
  healthServices: ServiceHealthInfo[]
): ServiceHealth[] {
  const merged = new Map(traceServices)

  for (const healthInfo of healthServices) {
    const existing = merged.get(healthInfo.name)
    if (existing) {
      // Merge: prefer health endpoint data for status/version
      merged.set(healthInfo.name, {
        ...existing,
        build: healthInfo.version || existing.build,
        status: healthInfo.status,
      })
    } else {
      // Add new service from health endpoint
      merged.set(healthInfo.name, {
        name: healthInfo.name,
        build: healthInfo.version,
        status: healthInfo.status,
        lastSeen: new Date().toISOString(),
      })
    }
  }

  // Sort by name for consistency
  return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Compute integration verification summary from traces
 */
function computeIntegrationVerification(traces: RequestTrace[]): IntegrationVerification {
  const issues: string[] = []
  let tracesWithDownstream = 0
  let verifiedChains = 0
  let failedDownstreamCalls = 0

  for (const trace of traces) {
    // Count traces with downstream calls
    if (trace.downstream && trace.downstream.length > 0) {
      tracesWithDownstream++

      // Count failed downstream calls
      for (const call of trace.downstream) {
        if (call.status >= 400) {
          failedDownstreamCalls++
          issues.push(`${call.service} returned ${call.status} for ${trace.endpoint}`)
        }
      }
    }

    // Check trace verification
    if (trace.traceReceived) {
      if (trace.traceReceived.payloadHash === trace.payloadHash) {
        verifiedChains++
      } else {
        issues.push(`Hash mismatch: sent ${trace.payloadHash?.slice(0, 6)}, received ${trace.traceReceived.payloadHash?.slice(0, 6)}`)
      }
    }
  }

  return {
    ok: issues.length === 0,
    tracesWithDownstream,
    verifiedChains,
    failedDownstreamCalls,
    issues: issues.slice(0, 10), // Limit to 10 issues
  }
}

/**
 * Create a diagnostic bundle with current state
 */
export async function createDiagnosticBundle(): Promise<DiagnosticBundle> {
  const versionInfo = getVersionInfo()
  const clientBuild = getClientBuild()
  const gateState = useGateStore.getState()

  const recentTraces = getRecentTraces()
  const pendingTraces = getPendingTraces()
  const failedTraces = getFailedTraces()

  // Build gate snapshots
  const gates: GateSnapshot[] = ALL_GATES.map((gate) => {
    const record = gateState.gates[gate]
    return {
      gate,
      status: record.status,
      updatedAt: record.updatedAt,
      message: record.message,
      service: record.service,
    }
  })

  // Extract service health from traces and health endpoints
  const traceServices = extractServicesFromTraces(recentTraces)
  let healthServices: ServiceHealthInfo[] = []
  try {
    healthServices = await getAllServiceHealthArray()
  } catch (err) {
    // Graceful degradation - continue with trace data only
    if (import.meta.env.DEV) {
      console.warn('[diagnostic-bundle] Failed to fetch service health:', err)
    }
  }
  const services = mergeServiceHealth(traceServices, healthServices)

  // Sanitize page URL (remove query params that might contain sensitive data)
  const pageUrl = new URL(window.location.href)
  // Keep only non-sensitive query params
  const safeParams = ['diag', 'view', 'tab']
  for (const key of Array.from(pageUrl.searchParams.keys())) {
    if (!safeParams.includes(key)) {
      pageUrl.searchParams.delete(key)
    }
  }

  return {
    version: '1.0',
    createdAt: new Date().toISOString(),
    client: {
      build: clientBuild,
      branch: versionInfo?.branch,
      commit: versionInfo?.commit,
      builtAt: versionInfo?.timestamp,
      environment: String(import.meta.env.VITE_APP_ENV || 'development'),
    },
    environment: getEnvironmentInfo(),
    gates,
    traces: {
      recent: recentTraces.map(sanitizeTrace),
      pending: pendingTraces.map(sanitizeTrace),
      failed: failedTraces.map(sanitizeTrace),
    },
    services,
    integration: computeIntegrationVerification(recentTraces),
    session: {
      durationMs: Date.now() - sessionStart,
      pageUrl: pageUrl.pathname + pageUrl.search,
      referrer: document.referrer ? new URL(document.referrer).hostname : '',
    },
  }
}

/**
 * Generate filename for diagnostic bundle
 * Format: diag-{build}-{timestamp}.json
 */
function generateFilename(): string {
  const build = getClientBuild()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `diag-${build}-${timestamp}.json`
}

/**
 * Export diagnostic bundle as downloadable JSON file
 */
export async function exportDiagnosticBundle(): Promise<void> {
  const bundle = await createDiagnosticBundle()
  const json = JSON.stringify(bundle, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const filename = generateFilename()

  // Create temporary link and trigger download
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // Clean up blob URL
  URL.revokeObjectURL(url)

  // Log export for debugging
  if (import.meta.env.DEV) {
    console.log('[diagnostic-bundle] Exported:', filename)
  }
}

/**
 * Get diagnostic bundle as string (for copy/paste)
 */
export async function getDiagnosticBundleString(): Promise<string> {
  const bundle = await createDiagnosticBundle()
  return JSON.stringify(bundle, null, 2)
}

// =============================================================================
// Merged Debug Export (Task 1: Combined diagnostic + contract-trace + anomalies)
// =============================================================================

/**
 * Merged debug export structure
 * Combines all available debug data into a single file
 */
export interface MergedDebugExport {
  meta: {
    timestamp: string
    environment: string
    uiBuild: string
    branch?: string
  }
  diagnostic: DiagnosticBundle
  ceePipelineTrace?: CeePipelineTrace | null
  errorDetails?: ErrorDetail[]
  contractTrace: {
    payloadCount: number
    payloads: unknown[]
  }
  dataShapeAnomalies: {
    count: number
    anomalies: unknown[]
  }
  boundaryEvents: unknown[] // Placeholder for future boundary event logging
}

/**
 * Create merged debug export with all available data
 */
export async function createMergedDebugExport(extras?: {
  ceePipelineTrace?: CeePipelineTrace | null
  errorDetails?: ErrorDetail[]
}): Promise<MergedDebugExport> {
  // Import payload trace store dynamically to avoid circular deps
  const { usePayloadTraceStore, getDataShapeAnomalies } = await import('./payload-trace-store')

  const diagnostic = await createDiagnosticBundle()

  // Get contract trace payloads
  const payloadState = usePayloadTraceStore.getState()
  const contractTrace = {
    payloadCount: payloadState.payloads.length,
    payloads: payloadState.payloads.map((p) => ({
      id: p.id,
      service: p.service,
      endpoint: p.endpoint,
      method: p.method,
      timestamp: new Date(p.timestamp).toISOString(),
      duration: p.duration,
      status: p.status,
      completed: p.completed,
      error: p.error,
      request: p.request
        ? {
            headers: redactPayload(p.request.headers) as Record<string, string>,
            body: redactPayload(p.request.body),
          }
        : undefined,
      response: p.response
        ? {
            headers: redactPayload(p.response.headers) as Record<string, string>,
            body: redactPayload(p.response.body),
          }
        : undefined,
      contractValidation: p.contractValidation,
    })),
  }

  // Get data shape anomalies
  const anomalies = getDataShapeAnomalies()
  const dataShapeAnomalies = {
    count: anomalies.length,
    anomalies: anomalies.map((a) => ({
      ...a,
      timestamp: new Date(a.timestamp).toISOString(),
    })),
  }

  const versionInfo = getVersionInfo()
  const clientBuild = getClientBuild()

  return {
    meta: {
      timestamp: new Date().toISOString(),
      environment: String(import.meta.env.VITE_APP_ENV || 'development'),
      uiBuild: clientBuild,
      branch: versionInfo?.branch,
    },
    diagnostic,
    ceePipelineTrace: extras?.ceePipelineTrace,
    errorDetails: extras?.errorDetails,
    contractTrace,
    dataShapeAnomalies,
    boundaryEvents: [], // Boundary events logged to console, not stored in-memory
  }
}

/**
 * Generate filename for merged debug export
 * Format: olumi-diagnostic-{timestamp}.json
 */
function generateMergedFilename(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `olumi-diagnostic-${timestamp}.json`
}

/**
 * Export merged debug data as downloadable JSON file
 */
export async function exportMergedDebugBundle(extras?: {
  ceePipelineTrace?: CeePipelineTrace | null
  errorDetails?: ErrorDetail[]
}): Promise<void> {
  const bundle = await createMergedDebugExport(extras)
  const json = JSON.stringify(bundle, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const filename = generateMergedFilename()

  // Create temporary link and trigger download
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // Clean up blob URL
  URL.revokeObjectURL(url)

  if (import.meta.env.DEV) {
    console.log('[diagnostic-bundle] Exported merged:', filename)
  }
}

 export const __test__ = {
   generateMergedFilename,
 }
