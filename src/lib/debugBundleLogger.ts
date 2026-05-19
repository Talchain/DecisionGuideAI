/**
 * Structured render-log events for debug-bundle export.
 *
 * Emits four events around debug export lifecycle:
 *   - dgai.debug_bundle.export_started
 *   - dgai.debug_bundle.capture_status
 *   - dgai.debug_bundle.scientific_validation_summary
 *   - dgai.debug_bundle.export_completed
 *
 * Privacy-safe by construction:
 *   - Allowlisted field keys only (compile-time enforced).
 *   - Missing values emit as `null`, never substituted.
 *   - Never accepts free-form payloads, prose, IDs beyond export_id.
 *
 * Backed by the existing `logger.info` channel so global log-level
 * configuration applies.
 */

import { logger } from './logger'

export type DebugBundleEventName =
  | 'dgai.debug_bundle.export_started'
  | 'dgai.debug_bundle.capture_status'
  | 'dgai.debug_bundle.scientific_validation_summary'
  | 'dgai.debug_bundle.export_completed'

/**
 * Permitted structural field set. Any field not on this list is rejected
 * by `emitDebugBundleEvent` at runtime (and is a compile error at the
 * TypeScript level via the `DebugBundleEventFields` type below).
 */
export const ALLOWED_DEBUG_BUNDLE_EVENT_FIELDS = [
  'export_id',
  'scenario_id_source',
  'capture_pipeline_status',
  'coherence_state',
  'coherence_issue_count',
  'canonical_flag_on',
  'has_v5_capture',
  'parse_ok',
  'has_results',
  'scientific_validation_available_count',
  'scientific_validation_unavailable_count',
  'bundle_size_bytes',
  'omitted_sections_count',
] as const

export type DebugBundleEventField =
  (typeof ALLOWED_DEBUG_BUNDLE_EVENT_FIELDS)[number]

/**
 * Compile-time enforced event-field shape. Every emitted event must
 * provide exactly these keys (values may be null). Tests assert that no
 * other key ever ends up in the emitted payload.
 */
export type DebugBundleEventFields = Record<
  DebugBundleEventField,
  string | number | boolean | null
>

/**
 * Sensitive substrings that must never appear in any emitted field
 * value. Caller bugs (e.g. accidentally passing a raw header or user
 * prose) get filtered with `'[REDACTED]'` rather than emitted verbatim.
 *
 * Tests verify the guard catches each pattern.
 */
const SENSITIVE_SUBSTRINGS: readonly RegExp[] = [
  /\beyJ[\w-]+\.[\w-]+\.[\w-]+/i, // JWT
  /\bbearer\s+\S+/i, // Bearer token
  /\b(api[_-]?key|token|secret|password|authorization)\s*[:=]/i,
  /[\w.+-]+@[\w-]+\.[\w.-]+/, // email
]

function scrubField(value: string | number | boolean | null): string | number | boolean | null {
  if (typeof value !== 'string') return value
  if (value.length === 0) return value
  for (const pattern of SENSITIVE_SUBSTRINGS) {
    if (pattern.test(value)) return '[REDACTED]'
  }
  return value
}

/**
 * Emit a structured debug-bundle event. Returns the fully-resolved
 * payload (post-allowlist + scrub) so callers / tests can inspect it.
 */
export function emitDebugBundleEvent(
  event: DebugBundleEventName,
  fields: DebugBundleEventFields,
): Readonly<DebugBundleEventFields & { event: DebugBundleEventName }> {
  // Strip any fields not on the allowlist (caller bug guard) and scrub
  // remaining string values for sensitive substrings.
  const safe: Partial<DebugBundleEventFields> = {}
  for (const key of ALLOWED_DEBUG_BUNDLE_EVENT_FIELDS) {
    const raw = fields[key]
    safe[key] = raw === undefined ? null : scrubField(raw)
  }

  const payload = {
    event,
    ...(safe as DebugBundleEventFields),
  } as const

  logger.info(payload)
  return payload
}

/**
 * Pure factory for building the standard fields object from a partial.
 * Missing keys default to null. Useful in callers that build the
 * payload incrementally during export.
 */
export function buildDebugBundleEventFields(
  partial: Partial<DebugBundleEventFields>,
): DebugBundleEventFields {
  const out = {} as DebugBundleEventFields
  for (const key of ALLOWED_DEBUG_BUNDLE_EVENT_FIELDS) {
    out[key] = partial[key] ?? null
  }
  return out
}
