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
import { redactPayload } from '../utils/payloadRedaction'

const PAYLOAD_REDACTION_OPTIONS = {
  maxDepth: 8, // Increased from 6 to preserve response.body.trace.pipeline.llm_quality.corrections[]
  maxArrayItems: 100, // Increased from 10 to support Full Graph export without truncation
  maxStringLength: 1000,
} as const

// ============================================================================
// Types
// ============================================================================

export interface TracedPayload {
  /** Request ID (correlates with debug-state) */
  id: string
  /** Service type */
  service: 'CEE' | 'PLoT' | 'ISL' | 'BFF' | 'unknown'
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
  }) => void

  recordResponsePayload: (params: {
    id: string
    status: number
    headers: Record<string, string>
    body: unknown
    duration: number
    error?: string
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

/** Check if payload inspection should be enabled */
function isPayloadInspectionEnabled(): boolean {
  // Only in dev/staging
  const env = import.meta.env.VITE_APP_ENV || 'development'
  return env === 'development' || env === 'staging'
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

        return {
          ...p,
          status: params.status,
          duration: params.duration,
          error: params.error,
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
    const exportData = {
      exportedAt: new Date().toISOString(),
      environment: import.meta.env.VITE_APP_ENV || 'development',
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
