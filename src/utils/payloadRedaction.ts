/**
 * Payload Redaction Utility
 *
 * Sanitises payloads before storage to protect privacy and prevent
 * performance issues from storing large debug data.
 *
 * Features:
 * - Caps arrays to first N items
 * - Truncates long strings
 * - Limits object depth
 * - Respects total size limits
 * - Dev/staging only full capture
 */

// =============================================================================
// Types
// =============================================================================

export interface RedactionOptions {
  /** Maximum array items to keep (default: 5) */
  maxArrayItems?: number
  /** Maximum string length (default: 500) */
  maxStringLength?: number
  /** Maximum object depth (default: 3) */
  maxDepth?: number
  /** Keys to always redact (default: common sensitive keys) */
  sensitiveKeys?: string[]
  /** Keys that look sensitive but are safe to keep (e.g., token_usage for LLM metrics) */
  safeKeys?: string[]
  /** Per-field array limits for diagnostic-critical fields */
  fieldArrayLimits?: Record<string, number>
  /** Keys whose string values bypass maxStringLength (e.g., 'text' for llm_raw.text in debug).
   *  Still subject to neverTruncateMaxLength as a safety cap. */
  neverTruncateKeys?: string[]
  /** Safety cap for neverTruncateKeys strings (default: 200_000 chars ~200KB). Prevents memory blowout. */
  neverTruncateMaxLength?: number
  /** Keys whose subtrees bypass max-depth redaction.
   *  When a key matches, depth resets so the subtree gets maxDepth more levels.
   *  Sensitive-key masking, string truncation, and array capping still apply. */
  neverRedactKeys?: string[]
}

const DEFAULT_OPTIONS: Required<RedactionOptions> = {
  maxArrayItems: 30,
  maxStringLength: 500,
  maxDepth: 3,
  sensitiveKeys: ['password', 'token', 'secret', 'apiKey', 'api_key', 'authorization'],
  // Keys that match sensitiveKeys patterns but are safe (e.g., LLM token metrics)
  safeKeys: ['token_usage', 'prompt_tokens', 'completion_tokens', 'total_tokens'],
  fieldArrayLimits: {
    // Diagnostic-critical fields with same limit as default
    option_comparison: 30,
    options: 30,
    critiques: 30,
    factor_sensitivity: 30,
    actions: 30,
    warnings: 30,
    errors: 30,
  },
  neverTruncateKeys: [],
  neverTruncateMaxLength: 200_000,
  neverRedactKeys: [],
}

function getDebugLlmRawMaxChars(): number {
  const envValue =
    import.meta.env.DEBUG_LLM_RAW_MAX_CHARS ??
    import.meta.env.VITE_DEBUG_LLM_RAW_MAX_CHARS
  const parsed = Number(envValue)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 8000
}

export const DEBUG_LLM_RAW_MAX_CHARS = getDebugLlmRawMaxChars()

/**
 * Redaction options for debug bundles.
 * Higher limits than defaults to preserve diagnostic data.
 * Shared between payload-trace-store and buildRawErrorData.
 */
export const DEBUG_BUNDLE_REDACTION_OPTIONS: RedactionOptions = {
  maxDepth: 8,
  maxArrayItems: 100,
  maxStringLength: 1000,
  neverTruncateKeys: ['text', 'output_preview', 'output', 'content'],
  neverTruncateMaxLength: DEBUG_LLM_RAW_MAX_CHARS,
  neverRedactKeys: ['constraint_analysis', 'observed_state', 'goal_constraints'],
}

/** Maximum size for raw error data storage (50KB) */
export const MAX_RAW_ERROR_SIZE = 50_000

// =============================================================================
// Environment Checks
// =============================================================================

/**
 * Check if detailed payload capture is allowed.
 * Only enabled in development or staging environments.
 */
export function shouldCaptureDetailedPayload(): boolean {
  return (
    import.meta.env.DEV ||
    import.meta.env.MODE === 'staging' ||
    import.meta.env.VITE_APP_ENV === 'staging'
  )
}

// =============================================================================
// Redaction Functions
// =============================================================================

/**
 * Redact a payload for safe storage.
 *
 * - Caps arrays to first N items with count indicator
 * - Truncates strings over limit
 * - Replaces large objects with summary
 * - Respects max depth to prevent stack overflow
 * - Redacts sensitive keys
 *
 * @param payload - Raw payload to redact
 * @param options - Redaction configuration
 * @returns Redacted payload safe for storage
 */
export function redactPayload(
  payload: unknown,
  options: RedactionOptions = {}
): unknown {
  const opts: Required<RedactionOptions> = { ...DEFAULT_OPTIONS, ...options }
  const visited = new WeakSet<object>()
  return redactValue(payload, opts, 0, undefined, visited)
}

/**
 * Bounded recursive check: does this value's subtree contain any key in exemptKeys?
 * Scans up to EXEMPT_SCAN_DEPTH levels to avoid unbounded traversal on large payloads.
 */
const EXEMPT_SCAN_DEPTH = 4

function containsExemptDescendant(
  value: unknown,
  exemptKeys: string[],
  scanDepth = 0,
): boolean {
  if (exemptKeys.length === 0 || scanDepth > EXEMPT_SCAN_DEPTH) return false
  if (value === null || value === undefined || typeof value !== 'object') return false

  if (Array.isArray(value)) {
    return value.some(item => containsExemptDescendant(item, exemptKeys, scanDepth + 1))
  }

  const keys = Object.keys(value as object)
  if (keys.some(k => exemptKeys.includes(k))) return true
  return keys.some(k =>
    containsExemptDescendant((value as Record<string, unknown>)[k], exemptKeys, scanDepth + 1)
  )
}

function redactValue(
  value: unknown,
  opts: Required<RedactionOptions>,
  depth: number,
  currentKey: string | undefined,
  visited: WeakSet<object>
): unknown {
  // Null/undefined pass through
  if (value === null || value === undefined) {
    return value
  }

  // Primitives
  if (typeof value === 'boolean' || typeof value === 'number') {
    return value
  }

  // Strings - truncate if too long (unless key is exempt via neverTruncateKeys)
  if (typeof value === 'string') {
    const isExempt = currentKey != null && opts.neverTruncateKeys.includes(currentKey)
    if (isExempt) {
      // Exempt keys bypass maxStringLength but still have a safety cap
      if (value.length > opts.neverTruncateMaxLength) {
        return `${value.slice(0, opts.neverTruncateMaxLength)}... [truncated_by: bundle_redaction_safety_cap, ${value.length} chars total]`
      }
      return value
    }
    if (value.length > opts.maxStringLength) {
      return `${value.slice(0, opts.maxStringLength)}... [truncated_by: bundle_redaction, ${value.length} chars total]`
    }
    return value
  }

  // Depth-exempt check: if currentKey is in neverRedactKeys, reset depth
  const isDepthExempt = currentKey != null && opts.neverRedactKeys.includes(currentKey)
  const effectiveDepth = isDepthExempt ? 0 : depth

  // Max depth check (skipped for exempt keys via depth reset)
  if (effectiveDepth >= opts.maxDepth) {
    // Before redacting, check if this subtree contains any neverRedactKeys descendant.
    // If so, fall through to process so exempt descendants can be preserved.
    if (!containsExemptDescendant(value, opts.neverRedactKeys)) {
      if (Array.isArray(value)) {
        return { __redacted: true, type: 'array', length: value.length }
      }
      if (typeof value === 'object') {
        return { __redacted: true, type: 'object', keys: Object.keys(value as object).slice(0, 10) }
      }
      return { __redacted: true, type: typeof value }
    }
    // Has exempt descendant: fall through — process normally, exempt keys get depth reset
  }

  // Circular reference check for objects and arrays
  if (typeof value === 'object') {
    if (visited.has(value as object)) {
      return { __circular: true, type: Array.isArray(value) ? 'array' : 'object' }
    }
    visited.add(value as object)
  }

  // Arrays - cap items (use per-field limit if available)
  if (Array.isArray(value)) {
    const fieldLimit = currentKey && opts.fieldArrayLimits[currentKey]
    const effectiveLimit = typeof fieldLimit === 'number' ? fieldLimit : opts.maxArrayItems

    const items = value.slice(0, effectiveLimit).map(item =>
      redactValue(item, opts, effectiveDepth + 1, undefined, visited)
    )

    if (value.length > effectiveLimit) {
      return {
        __truncated: true,
        items,
        totalCount: value.length,
        effectiveLimit,
        message: `... and ${value.length - effectiveLimit} more items`,
      }
    }

    return items
  }

  // Objects - redact sensitive keys and recurse
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const redacted: Record<string, unknown> = {}

    for (const key of Object.keys(obj)) {
      // Check if key is explicitly safe (e.g., token_usage for LLM metrics)
      const isSafeKey = opts.safeKeys.some(sk => key.toLowerCase() === sk.toLowerCase())

      // Redact sensitive keys (unless explicitly safe)
      if (!isSafeKey && opts.sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
        redacted[key] = '[REDACTED]'
        continue
      }

      // Pass key name to enable per-field array limits
      redacted[key] = redactValue(obj[key], opts, effectiveDepth + 1, key, visited)
    }

    return redacted
  }

  // Functions, symbols, etc.
  return { __redacted: true, type: typeof value }
}

/**
 * Enforce size limit on serialized data.
 * Returns a placeholder if the data exceeds the limit.
 *
 * @param data - Data to check
 * @param maxSize - Maximum size in characters (default: MAX_RAW_ERROR_SIZE)
 * @returns Original data if within limit, or size-exceeded placeholder
 */
export function enforcePayloadSizeLimit<T>(
  data: T,
  maxSize: number = MAX_RAW_ERROR_SIZE
): T | { __sizeLimitExceeded: true; originalSize: number } {
  try {
    const serialized = JSON.stringify(data)
    if (serialized.length > maxSize) {
      return {
        __sizeLimitExceeded: true,
        originalSize: serialized.length,
      }
    }
    return data
  } catch {
    // If serialization fails, return error placeholder
    return {
      __sizeLimitExceeded: true,
      originalSize: -1, // Unknown size due to serialization error
    } as any
  }
}

function isSizeLimitExceeded(
  value: unknown
): value is { __sizeLimitExceeded: true; originalSize: number } {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as any).__sizeLimitExceeded === true &&
    typeof (value as any).originalSize === 'number'
  )
}

// =============================================================================
// Raw Error Data Builder
// =============================================================================

export interface RawErrorDataInput {
  payload?: unknown
  expectedShape?: string
  validationErrors?: string[]
  validationWarnings?: string[]
  /** Custom redaction options. Defaults to DEBUG_BUNDLE_REDACTION_OPTIONS. */
  redactionOptions?: RedactionOptions
}

/**
 * Build raw error data with proper redaction and size limits.
 *
 * In production, only captures metadata (no payload).
 * In dev/staging, captures redacted payload within size limits.
 */
export function buildRawErrorData(input: RawErrorDataInput): {
  payload?: unknown
  expectedShape?: string
  validationErrors?: string[]
  validationWarnings?: string[]
  timestamp: string
} {
  const timestamp = new Date().toISOString()

  // Production: minimal capture
  if (!shouldCaptureDetailedPayload()) {
    return {
      payload: { __productionRedacted: true },
      expectedShape: input.expectedShape,
      validationErrors: input.validationErrors?.slice(0, 5),
      validationWarnings: input.validationWarnings?.slice(0, 5),
      timestamp,
    }
  }

  // Dev/staging: capture with redaction
  const redactedPayload = input.payload !== undefined
    ? redactPayload(input.payload, input.redactionOptions ?? DEBUG_BUNDLE_REDACTION_OPTIONS)
    : undefined

  const rawData = {
    payload: redactedPayload,
    expectedShape: input.expectedShape,
    validationErrors: input.validationErrors?.slice(0, 10),
    validationWarnings: input.validationWarnings?.slice(0, 10),
    timestamp,
  }

  // Enforce size limit
  const limited = enforcePayloadSizeLimit(rawData)
  if (isSizeLimitExceeded(limited)) {
    return {
      payload: limited,
      expectedShape: input.expectedShape,
      validationErrors: input.validationErrors?.slice(0, 10),
      validationWarnings: input.validationWarnings?.slice(0, 10),
      timestamp,
    }
  }
  return limited as typeof rawData
}

// =============================================================================
// Utility Exports
// =============================================================================

/**
 * Hash a stack trace for telemetry (doesn't leak full trace).
 * Uses simple hash to group similar errors.
 */
export function hashStackTrace(stack: string | undefined): string {
  if (!stack) return 'no_stack'

  // Extract just the first 3 stack frames and hash
  const frames = stack.split('\n').slice(0, 4).join('\n')

  // Simple string hash
  let hash = 0
  for (let i = 0; i < frames.length; i++) {
    const char = frames.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }

  return `stack_${Math.abs(hash).toString(16)}`
}
