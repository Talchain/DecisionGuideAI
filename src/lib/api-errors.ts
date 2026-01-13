/**
 * Typed API Error Classes
 *
 * Provides specific error types for better error classification,
 * telemetry, and user messaging.
 *
 * Error Hierarchy:
 * - ApiError (base)
 *   - NetworkError: Connection/timeout issues
 *   - MalformedApiResponseError: Schema validation failures
 *   - ProcessingError: Internal processing failures
 */

// =============================================================================
// Base API Error
// =============================================================================

export interface ApiErrorContext {
  requestId?: string
  endpoint?: string
  timestamp: string
  rawPayload?: unknown
}

export class ApiError extends Error {
  readonly code: string
  readonly context: ApiErrorContext
  readonly retryable: boolean

  constructor(
    message: string,
    code: string,
    context: Partial<ApiErrorContext> = {},
    retryable = false
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.retryable = retryable
    this.context = {
      timestamp: new Date().toISOString(),
      ...context,
    }

    // Maintain proper stack trace in V8
    const captureStackTrace = (Error as any).captureStackTrace as
      | ((targetObject: object, constructorOpt?: Function) => void)
      | undefined
    if (captureStackTrace) {
      captureStackTrace(this, this.constructor)
    }
  }
}

// =============================================================================
// Network Error
// =============================================================================

export class NetworkError extends ApiError {
  readonly status?: number

  constructor(
    message: string,
    status?: number,
    context: Partial<ApiErrorContext> = {}
  ) {
    super(message, 'NETWORK_ERROR', context, true) // Network errors are retryable
    this.name = 'NetworkError'
    this.status = status
  }

  static fromFetchError(error: unknown, context: Partial<ApiErrorContext> = {}): NetworkError {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return new NetworkError('Unable to connect to server', undefined, context)
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      return new NetworkError('Request timed out', undefined, context)
    }
    return new NetworkError(
      error instanceof Error ? error.message : 'Network request failed',
      undefined,
      context
    )
  }
}

// =============================================================================
// Malformed API Response Error
// =============================================================================

export interface ValidationFailure {
  field: string
  expected: string
  received: string
}

export class MalformedApiResponseError extends ApiError {
  readonly validationErrors: ValidationFailure[]
  readonly rawPayload: unknown

  constructor(
    message: string,
    validationErrors: ValidationFailure[],
    rawPayload: unknown,
    context: Partial<ApiErrorContext> = {}
  ) {
    super(message, 'MALFORMED_RESPONSE', { ...context, rawPayload }, false)
    this.name = 'MalformedApiResponseError'
    this.validationErrors = validationErrors
    this.rawPayload = rawPayload
  }

  /**
   * Get user-friendly summary of validation errors
   */
  getSummary(): string {
    if (this.validationErrors.length === 0) {
      return this.message
    }
    const issues = this.validationErrors
      .slice(0, 3)
      .map(e => `${e.field}: expected ${e.expected}, got ${e.received}`)
      .join('; ')
    return `Response validation failed: ${issues}`
  }

  /**
   * Get debug-friendly data for store
   */
  toDebugData(): {
    payload: unknown
    expectedShape: string
    validationErrors: string[]
    timestamp: string
  } {
    return {
      payload: this.rawPayload,
      expectedShape: this.validationErrors.map(e => `${e.field}: ${e.expected}`).join(', '),
      validationErrors: this.validationErrors.map(
        e => `${e.field}: expected ${e.expected}, received ${e.received}`
      ),
      timestamp: this.context.timestamp,
    }
  }
}

// =============================================================================
// Processing Error
// =============================================================================

export class ProcessingError extends ApiError {
  readonly originalError?: Error

  constructor(
    message: string,
    originalError?: Error,
    context: Partial<ApiErrorContext> = {}
  ) {
    super(message, 'PROCESSING_ERROR', context, false)
    this.name = 'ProcessingError'
    this.originalError = originalError
  }

  static wrap(error: unknown, context: Partial<ApiErrorContext> = {}): ProcessingError {
    if (error instanceof ProcessingError) {
      return error
    }
    if (error instanceof Error) {
      return new ProcessingError(error.message, error, context)
    }
    return new ProcessingError(String(error), undefined, context)
  }
}

// =============================================================================
// Type Guards
// =============================================================================

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError
}

export function isMalformedApiResponseError(error: unknown): error is MalformedApiResponseError {
  return error instanceof MalformedApiResponseError
}

export function isProcessingError(error: unknown): error is ProcessingError {
  return error instanceof ProcessingError
}

// =============================================================================
// Error Classification Helper
// =============================================================================

export type ErrorCategory = 'network' | 'malformed' | 'processing' | 'unknown'

export function classifyError(error: unknown): ErrorCategory {
  if (isNetworkError(error)) return 'network'
  if (isMalformedApiResponseError(error)) return 'malformed'
  if (isProcessingError(error)) return 'processing'
  return 'unknown'
}

/**
 * Convert any error to an ApiError for consistent handling
 */
export function normalizeError(error: unknown, context: Partial<ApiErrorContext> = {}): ApiError {
  if (error instanceof ApiError) {
    return error
  }

  // Check for fetch/network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return NetworkError.fromFetchError(error, context)
  }

  // Check for abort errors
  if (error instanceof DOMException && error.name === 'AbortError') {
    return NetworkError.fromFetchError(error, context)
  }

  // Default to processing error
  return ProcessingError.wrap(error, context)
}
