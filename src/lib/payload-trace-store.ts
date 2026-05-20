/**
 * Payload Trace Store (Debug Panel Contract Inspector)
 *
 * Stores full request/response payloads for debug inspection.
 * Limited to dev/staging environments to avoid memory bloat.
 *
 * Works alongside debug-state.ts which stores metadata only.
 */

import { create } from 'zustand'
import {
  validateResponse,
  detectService,
  type ContractValidationResult,
} from './contract-validators'
import { redactPayload, DEBUG_BUNDLE_REDACTION_OPTIONS } from '../utils/payloadRedaction'

/**
 * Scrub secret-shaped substrings from a free-form string. The repo's
 * structural redactor (`redactPayload`) operates on KEYS — for free-form
 * captures like `Error.cause` snippets we need a substring-level scrub
 * before the value lands in the diagnostic bundle.
 *
 * Patterns covered (ordered by length so longer overlapping patterns
 * match first):
 *   - JWT-shape three-segment base64 (`eyJ...`).
 *   - `bearer <token>` (case-insensitive, captures up to whitespace).
 *   - `(api[_-]?key|token|secret|password|authorization)[\s=:]+<value>`.
 *
 * Replacement is a fixed `[REDACTED:<reason>]` so reviewers can see the
 * value WAS redacted without inferring the original content. The function
 * is local to payload-trace-store because it is the only current consumer
 * — any future caller should consider promoting this to a shared util.
 */
function scrubSecretsInString(input: string): string {
  let out = input;
  // JWT — three base64-segment shape.
  out = out.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[REDACTED:JWT]');
  // Bearer + opaque token.
  out = out.replace(/\bbearer\s+\S+/gi, 'bearer [REDACTED]');
  // Sensitive-key=value / sensitive-key: value pairs.
  out = out.replace(
    /\b(api[_-]?key|token|secret|password|authorization)\s*[:=]\s*\S+/gi,
    '$1=[REDACTED]',
  );
  return out;
}

// Use shared debug-bundle redaction options for consistency across all capture paths.
// Includes neverRedactKeys for constraint_analysis, observed_state, goal_constraints.
const PAYLOAD_REDACTION_OPTIONS = DEBUG_BUNDLE_REDACTION_OPTIONS

// ============================================================================
// Types
// ============================================================================

export interface TracedPayload {
  /** Request ID (correlates with debug-state) */
  id: string
  /** Service type */
  service: 'CEE' | 'PLoT' | 'ISL' | 'BFF' | 'M2' | 'unknown'
  /** Endpoint path */
  endpoint: string
  /** HTTP method */
  method: string
  /** Request timestamp */
  timestamp: number
  /** Request duration in ms (set after response) */
  duration?: number
  /** HTTP status code (set after response) */
  status?: number

  /** Turn type from request builder (preserved before stripTurnType removes it from wire payload) */
  turnType?: string

  /** Request data */
  request: {
    headers: Record<string, string>
    body: unknown
  }

  /** Response data (set after response) */
  response?: {
    headers: Record<string, string>
    body: unknown
  }

  /** Contract validation result (computed on response) */
  contractValidation?: ContractValidationResult

  /** Error message if request failed */
  error?: string

  /** Native Error.name when fetch threw (e.g. "TypeError" for blocked preflight). */
  errorName?: string

  /** Safe Error.cause snippet, truncated. */
  errorCause?: string

  /**
   * Failure-source classification for incomplete responses. Mirrors
   * `ErrorSource` in v5/responseParser.ts but adds `'preflight_or_network'`
   * for fetch() throws (CORS preflight blocks, offline, DNS failures, etc.)
   * because the browser cannot expose preflight response detail to JS.
   */
  source?:
    | 'cee'
    | 'plot'
    | 'proxy'
    | 'netlify'
    | 'browser_timeout'
    | 'preflight_or_network'
    | 'unknown'

  /** Whether request is complete */
  completed: boolean
}

export interface PayloadTraceStore {
  /** Stored payloads (most recent first) */
  payloads: TracedPayload[]
  /** Selected payload ID for detail view */
  selectedId: string | null
  /** Filter: service type */
  filterService: string | null
  /** Filter: status (success, error, schema) */
  filterStatus: string | null
  /** Search query */
  searchQuery: string

  /** Actions */
  recordRequestPayload: (params: {
    id: string
    endpoint: string
    method: string
    headers: Record<string, string>
    body: unknown
    turnType?: string
  }) => void

  recordResponsePayload: (params: {
    id: string
    status: number
    headers: Record<string, string>
    body: unknown
    duration: number
    error?: string
    /** Native Error.name (e.g. "TypeError", "AbortError") when fetch threw. */
    errorName?: string
    /** Safe-to-log Error.cause snippet when fetch threw. Truncated to 200 chars. */
    errorCause?: string
    /**
     * Source classification for failed/incomplete responses. Mirrors the
     * `ErrorSource` union in v5/responseParser.ts but adds
     * `'preflight_or_network'` for fetch() throws (CORS preflight blocks,
     * offline, DNS failures, etc.). The browser cannot expose preflight
     * response detail to JS, so this classification IS the diagnostic.
     */
    source?:
      | 'cee'
      | 'plot'
      | 'proxy'
      | 'netlify'
      | 'browser_timeout'
      | 'preflight_or_network'
      | 'unknown'
  }) => void

  selectPayload: (id: string | null) => void
  setFilterService: (service: string | null) => void
  setFilterStatus: (status: string | null) => void
  setSearchQuery: (query: string) => void
  clearPayloads: () => void
  exportPayloads: () => string
}

// ============================================================================
// Constants
// ============================================================================

/** Maximum payloads to store (last 20 as per spec) */
const MAX_PAYLOADS = 20

/**
 * Closed-by-default payload-inspection gate.
 *
 * Security stance: a build with NO indication that it is a development
 * or staging environment MUST NOT capture payloads. Previous behaviour
 * defaulted to `'development'` when `VITE_APP_ENV` was unset, which
 * meant a production build that forgot to set the var would fall open.
 * Now the gate is closed unless one of these is explicitly true:
 *
 *   1. `import.meta.env.DEV === true` (Vite dev server)
 *   2. `VITE_APP_ENV === "development"`
 *   3. `VITE_APP_ENV === "staging"`
 *   4. `VITE_ENABLE_PAYLOAD_INSPECTION === "true"` (explicit opt-in)
 *
 * Every other state (missing / empty / `"production"` / unknown) keeps
 * capture disabled and emits a specific reason code so the debug
 * bundle can explain itself.
 */
export type PayloadInspectionReason =
  | 'vite_dev_mode_enabled'
  | 'app_env_development_enabled'
  | 'app_env_staging_enabled'
  | 'explicit_debug_flag_enabled'
  | 'missing_app_env_capture_disabled'
  | 'empty_app_env_capture_disabled'
  | 'production_env_capture_disabled'
  | 'unknown_app_env_capture_disabled'
  /**
   * Round-2 review (P1): the bundle assembler couldn't reach the
   * trace-store module to query the gate (dynamic import failed,
   * test mock missing, SSR edge case). Emitted by the consumer
   * (`exportBundle.ts`) — NEVER returned by `getPayloadInspectionStatus`
   * itself, which runs at module-load time and cannot fail. Reviewers
   * see "diagnostic lookup itself failed" rather than a missing field.
   */
  | 'inspection_status_unavailable'

interface InspectionEvaluation {
  enabled: boolean
  resolvedAppEnv: string
  reason: PayloadInspectionReason
}

/**
 * Pure evaluator — kept as a module-level constant for stability
 * across the bundle (the resolved values are captured at module load),
 * but factored out so tests can re-trigger module load with stubbed
 * env vars and see the priority rules without any extra wiring.
 *
 * Priority order (first match wins):
 *   - Vite DEV mode → enabled (`vite_dev_mode_enabled`)
 *   - Explicit debug flag → enabled (`explicit_debug_flag_enabled`)
 *   - VITE_APP_ENV === 'development' → enabled
 *   - VITE_APP_ENV === 'staging' → enabled
 *   - VITE_APP_ENV undefined → disabled (`missing_app_env_capture_disabled`)
 *   - VITE_APP_ENV === '' → disabled (`empty_app_env_capture_disabled`)
 *   - VITE_APP_ENV === 'production' → disabled (`production_env_capture_disabled`)
 *   - Any other value → disabled (`unknown_app_env_capture_disabled`)
 */
function evaluatePayloadInspection(): InspectionEvaluation {
  const rawAppEnv = import.meta.env.VITE_APP_ENV as string | undefined
  const debugFlag = import.meta.env.VITE_ENABLE_PAYLOAD_INSPECTION as
    | string
    | undefined
  const isDev = Boolean(import.meta.env.DEV)
  // `resolvedAppEnv` reports what was actually observed so reviewers
  // can debug the bundle without rebuilding. Use empty string when
  // missing entirely (distinct from the empty-string-set case via
  // the `reason` field).
  const resolvedAppEnv = typeof rawAppEnv === 'string' ? rawAppEnv : ''

  if (isDev) {
    return { enabled: true, resolvedAppEnv, reason: 'vite_dev_mode_enabled' }
  }
  if (debugFlag === 'true') {
    return {
      enabled: true,
      resolvedAppEnv,
      reason: 'explicit_debug_flag_enabled',
    }
  }
  if (rawAppEnv === 'development') {
    return {
      enabled: true,
      resolvedAppEnv,
      reason: 'app_env_development_enabled',
    }
  }
  if (rawAppEnv === 'staging') {
    return {
      enabled: true,
      resolvedAppEnv,
      reason: 'app_env_staging_enabled',
    }
  }
  if (rawAppEnv === undefined) {
    return {
      enabled: false,
      resolvedAppEnv,
      reason: 'missing_app_env_capture_disabled',
    }
  }
  if (rawAppEnv === '') {
    return {
      enabled: false,
      resolvedAppEnv,
      reason: 'empty_app_env_capture_disabled',
    }
  }
  if (rawAppEnv === 'production') {
    return {
      enabled: false,
      resolvedAppEnv,
      reason: 'production_env_capture_disabled',
    }
  }
  return {
    enabled: false,
    resolvedAppEnv,
    reason: 'unknown_app_env_capture_disabled',
  }
}

const INSPECTION_EVAL = evaluatePayloadInspection()
const RESOLVED_APP_ENV = INSPECTION_EVAL.resolvedAppEnv
const PAYLOAD_INSPECTION_ENABLED = INSPECTION_EVAL.enabled

/**
 * Diagnostic surface — exposes the module-load environment + enabled
 * state + the specific reason code so the merged debug bundle can
 * show WHY traces are absent. The `reason` field is always populated
 * (one of `PayloadInspectionReason`) rather than null — reviewers
 * always see a stable code, including for the enabled branches.
 */
export interface PayloadInspectionStatus {
  readonly enabled: boolean
  readonly resolvedAppEnv: string
  readonly reason: PayloadInspectionReason
}

export function getPayloadInspectionStatus(): PayloadInspectionStatus {
  return {
    enabled: INSPECTION_EVAL.enabled,
    resolvedAppEnv: INSPECTION_EVAL.resolvedAppEnv,
    reason: INSPECTION_EVAL.reason,
  }
}

// One-time non-noisy info message at module load when capture is off.
//
// Gated behind `import.meta.env.DEV` so production users never see
// console noise. The disable-reason is also surfaced via
// `getPayloadInspectionStatus()` and persisted in the merged
// diagnostic bundle, so reviewers running a deployed staging build
// still have non-console paths to discover the cause.
if (
  !PAYLOAD_INSPECTION_ENABLED &&
  typeof console !== 'undefined' &&
  Boolean(import.meta.env.DEV)
) {
  // eslint-disable-next-line no-console
  console.info(
    `[diagnostic] payload inspection disabled (reason=${INSPECTION_EVAL.reason}, ` +
      `VITE_APP_ENV="${RESOLVED_APP_ENV}"). ` +
      'Set VITE_APP_ENV=staging on the deploy context (or ' +
      'VITE_ENABLE_PAYLOAD_INSPECTION=true) to capture debug bundles.',
  )
}

/** Check if payload inspection should be enabled */
function isPayloadInspectionEnabled(): boolean {
  return PAYLOAD_INSPECTION_ENABLED
}

// ============================================================================
// Store
// ============================================================================

export const usePayloadTraceStore = create<PayloadTraceStore>((set, get) => ({
  payloads: [],
  selectedId: null,
  filterService: null,
  filterStatus: null,
  searchQuery: '',

  recordRequestPayload: (params) => {
    if (!isPayloadInspectionEnabled()) return

    const service = detectService(params.endpoint)

    const payload: TracedPayload = {
      id: params.id,
      service,
      endpoint: params.endpoint,
      method: params.method,
      timestamp: Date.now(),
      ...(params.turnType ? { turnType: params.turnType } : {}),
      request: {
        headers: redactPayload(params.headers, PAYLOAD_REDACTION_OPTIONS) as Record<string, string>,
        body: redactPayload(params.body, PAYLOAD_REDACTION_OPTIONS),
      },
      completed: false,
    }

    set((state) => {
      const newPayloads = [payload, ...state.payloads]
      // Limit to MAX_PAYLOADS
      if (newPayloads.length > MAX_PAYLOADS) {
        newPayloads.pop()
      }
      return { payloads: newPayloads }
    })
  },

  recordResponsePayload: (params) => {
    if (!isPayloadInspectionEnabled()) return

    set((state) => {
      const payloads = state.payloads.map((p) => {
        if (p.id !== params.id) return p

        // Compute contract validation
        const contractValidation = validateResponse(
          p.endpoint,
          params.body,
          params.id
        )

        // P1 fix (2026-05): scrub secret-shaped substrings from the
        // captured Error.cause string so bearer tokens, JWTs, and
        // sensitive-key=value pairs cannot leak into the diagnostic
        // bundle. `redactPayload` only redacts by KEY, so a free-form
        // string from Error.cause needs a substring-level pass first.
        // We then run the structural redactor for any non-string causes
        // (cause objects via `cause: {...}`), and finally truncate.
        const redactedErrorCause = (() => {
          if (params.errorCause === undefined) return undefined;
          const stringScrubbed =
            typeof params.errorCause === 'string'
              ? scrubSecretsInString(params.errorCause)
              : params.errorCause;
          const structurallyRedacted = redactPayload(
            stringScrubbed,
            PAYLOAD_REDACTION_OPTIONS,
          );
          const asString =
            typeof structurallyRedacted === 'string'
              ? structurallyRedacted
              : JSON.stringify(structurallyRedacted);
          return asString.length > 200 ? asString.slice(0, 200) : asString;
        })();

        return {
          ...p,
          status: params.status,
          duration: params.duration,
          error: params.error,
          ...(params.errorName ? { errorName: params.errorName } : {}),
          ...(redactedErrorCause ? { errorCause: redactedErrorCause } : {}),
          ...(params.source ? { source: params.source } : {}),
          response: {
            headers: redactPayload(params.headers, PAYLOAD_REDACTION_OPTIONS) as Record<string, string>,
            body: redactPayload(params.body, PAYLOAD_REDACTION_OPTIONS),
          },
          contractValidation,
          completed: true,
        }
      })

      return { payloads }
    })
  },

  selectPayload: (id) => set({ selectedId: id }),

  setFilterService: (service) => set({ filterService: service }),

  setFilterStatus: (status) => set({ filterStatus: status }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  clearPayloads: () => set({ payloads: [], selectedId: null }),

  exportPayloads: () => {
    const { payloads } = get()
    const inspection = getPayloadInspectionStatus()
    const exportData = {
      exportedAt: new Date().toISOString(),
      environment: import.meta.env.VITE_APP_ENV || 'development',
      // P1 fix (2026-05): inspection status mirrors the merged
      // diagnostic bundle. Reviewers reading a raw exportPayloads()
      // output can see WHY traces are missing without crossing into
      // the merged-bundle path.
      inspection: {
        enabled: inspection.enabled,
        resolvedAppEnv: inspection.resolvedAppEnv,
        reason: inspection.reason,
      },
      payloadCount: payloads.length,
      payloads: payloads.map((p) => ({
        id: p.id,
        service: p.service,
        endpoint: p.endpoint,
        method: p.method,
        timestamp: new Date(p.timestamp).toISOString(),
        duration: p.duration,
        status: p.status,
        completed: p.completed,
        error: p.error,
        // P1 fix (2026-05): include error metadata + source
        // classification so failed/preflight requests are diagnosable
        // from the standalone export, not just the merged debug bundle.
        errorName: p.errorName,
        errorCause: p.errorCause,
        source: p.source,
        request: p.request,
        response: p.response,
        contractValidation: p.contractValidation,
      })),
    }
    return JSON.stringify(exportData, null, 2)
  },
}))

// ============================================================================
// Selectors
// ============================================================================

/**
 * Get filtered payloads based on current filters
 */
export function getFilteredPayloads(state: PayloadTraceStore): TracedPayload[] {
  let payloads = state.payloads

  // Filter by service
  if (state.filterService) {
    payloads = payloads.filter((p) => p.service === state.filterService)
  }

  // Filter by status
  if (state.filterStatus === 'success') {
    payloads = payloads.filter((p) => p.status && p.status >= 200 && p.status < 300)
  } else if (state.filterStatus === 'error') {
    payloads = payloads.filter((p) => p.error || (p.status && p.status >= 400))
  } else if (state.filterStatus === 'schema') {
    payloads = payloads.filter((p) => p.contractValidation && !p.contractValidation.valid)
  }

  // Search within payloads
  if (state.searchQuery) {
    const query = state.searchQuery.toLowerCase()
    payloads = payloads.filter((p) => {
      // Search in endpoint
      if (p.endpoint.toLowerCase().includes(query)) return true
      // Search in request body (stringified)
      if (JSON.stringify(p.request.body).toLowerCase().includes(query)) return true
      // Search in response body (stringified)
      if (p.response && JSON.stringify(p.response.body).toLowerCase().includes(query)) return true
      return false
    })
  }

  return payloads
}

/**
 * Get selected payload
 */
export function getSelectedPayload(state: PayloadTraceStore): TracedPayload | null {
  if (!state.selectedId) return null
  return state.payloads.find((p) => p.id === state.selectedId) ?? null
}

/**
 * Get summary statistics
 */
export function getPayloadStats(state: PayloadTraceStore): {
  total: number
  pending: number
  success: number
  errors: number
  schemaIssues: number
} {
  const payloads = state.payloads
  return {
    total: payloads.length,
    pending: payloads.filter((p) => !p.completed).length,
    success: payloads.filter((p) => p.status && p.status >= 200 && p.status < 300).length,
    errors: payloads.filter((p) => p.error || (p.status && p.status >= 400)).length,
    schemaIssues: payloads.filter((p) => p.contractValidation && !p.contractValidation.valid).length,
  }
}

// ============================================================================
// Integration Hook
// ============================================================================

/**
 * Hook to record payloads from service calls
 *
 * Usage:
 * ```typescript
 * // Before request
 * recordRequestPayload({
 *   id: requestId,
 *   endpoint: '/bff/cee/draft-graph',
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: requestBody,
 * })
 *
 * // After response
 * recordResponsePayload({
 *   id: requestId,
 *   status: response.status,
 *   headers: Object.fromEntries(response.headers),
 *   body: responseBody,
 *   duration: Date.now() - startTime,
 * })
 * ```
 */
export function usePayloadRecording() {
  const recordRequestPayload = usePayloadTraceStore((s) => s.recordRequestPayload)
  const recordResponsePayload = usePayloadTraceStore((s) => s.recordResponsePayload)
  return { recordRequestPayload, recordResponsePayload }
}

// ============================================================================
// Standalone Recording Functions (for non-React code)
// ============================================================================

/**
 * Record a request payload (for use outside React components)
 */
export function recordRequestPayload(params: {
  id: string
  endpoint: string
  method: string
  headers: Record<string, string>
  body: unknown
  turnType?: string
}): void {
  usePayloadTraceStore.getState().recordRequestPayload(params)
}

/**
 * Record a response payload (for use outside React components)
 */
export function recordResponsePayload(params: {
  id: string
  status: number
  headers: Record<string, string>
  body: unknown
  duration: number
  error?: string
  errorName?: string
  errorCause?: string
  source?:
    | 'cee'
    | 'plot'
    | 'proxy'
    | 'netlify'
    | 'browser_timeout'
    | 'preflight_or_network'
    | 'unknown'
}): void {
  usePayloadTraceStore.getState().recordResponsePayload(params)
}

// ============================================================================
// Data Shape Anomaly Recording (Error Resilience)
// ============================================================================

/**
 * Shape anomaly for malformed response data.
 * Captures what we received vs what we expected.
 */
export interface DataShapeAnomaly {
  timestamp: number
  location: string
  field: string
  expected: string
  received: string
  receivedType: string
  receivedValue: unknown
  context?: Record<string, unknown>
}

/** In-memory buffer for shape anomalies (limited to last 50) */
const shapeAnomalies: DataShapeAnomaly[] = []
const MAX_ANOMALIES = 50

/**
 * Record a data shape anomaly when backend returns unexpected types.
 * Used for debugging backend contract drift.
 *
 * @param location - Where in the code the anomaly was detected (e.g., "responseMapper.mapDrivers")
 * @param field - The field with the unexpected shape (e.g., "factor_sensitivity[0].elasticity")
 * @param expected - What type was expected (e.g., "number")
 * @param receivedValue - The actual value received
 * @param context - Optional additional context (e.g., surrounding fields)
 */
export function recordDataShapeAnomaly(
  location: string,
  field: string,
  expected: string,
  receivedValue: unknown,
  context?: Record<string, unknown>
): void {
  if (!isPayloadInspectionEnabled()) return

  const anomaly: DataShapeAnomaly = {
    timestamp: Date.now(),
    location,
    field,
    expected,
    received: summarizeValue(receivedValue),
    receivedType: typeof receivedValue,
    receivedValue: safeClone(receivedValue),
    context,
  }

  shapeAnomalies.unshift(anomaly)
  if (shapeAnomalies.length > MAX_ANOMALIES) {
    shapeAnomalies.pop()
  }

  // Also log in dev for immediate visibility
  if (import.meta.env?.DEV) {
    console.warn('[DataShapeAnomaly]', {
      location,
      field,
      expected,
      received: anomaly.received,
      value: receivedValue,
    })
  }
}

/**
 * Get recorded shape anomalies (for debug panel display).
 */
export function getDataShapeAnomalies(): DataShapeAnomaly[] {
  return [...shapeAnomalies]
}

/**
 * Clear recorded shape anomalies.
 */
export function clearDataShapeAnomalies(): void {
  shapeAnomalies.length = 0
}

/**
 * Export shape anomalies as JSON (for bug reports).
 */
export function exportDataShapeAnomalies(): string {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    count: shapeAnomalies.length,
    anomalies: shapeAnomalies.map((a) => ({
      ...a,
      timestamp: new Date(a.timestamp).toISOString(),
    })),
  }, null, 2)
}

/**
 * Create a summary string for an unexpected value.
 */
function summarizeValue(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (Array.isArray(value)) return `Array(${value.length})`
  if (typeof value === 'object') {
    const keys = Object.keys(value as object)
    return `Object{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}}`
  }
  if (typeof value === 'string') {
    return value.length > 50 ? `"${value.slice(0, 50)}..."` : `"${value}"`
  }
  return String(value)
}

/**
 * Safe clone for storing in anomaly buffer (handles circular refs).
 */
function safeClone(value: unknown, depth = 0): unknown {
  if (depth > 3) return '[max depth]'
  if (value === null || value === undefined) return value
  if (typeof value !== 'object') return value

  try {
    if (Array.isArray(value)) {
      return value.slice(0, 10).map((v) => safeClone(v, depth + 1))
    }
    const result: Record<string, unknown> = {}
    const entries = Object.entries(value as object).slice(0, 20)
    for (const [k, v] of entries) {
      result[k] = safeClone(v, depth + 1)
    }
    return result
  } catch {
    return '[clone failed]'
  }
}
