/**
 * validateResponse — defensive last-line validator for orchestrator responses.
 *
 * CEE validates first. This catches anything that slips through:
 * - Empty assistant_text with no blocks → inject fallback text
 * - suggested_actions items missing label or message → filter
 * - blocks items missing type → filter
 * - Nothing renderable at all → inject fallback text
 *
 * Non-mutating: returns a new envelope. Original preserved for debug.
 * Emits a single telemetry event per envelope when repairs are made.
 *
 * Repair types:
 *   'empty_text'           — assistant_text was empty/null with no blocks
 *   'missing_chip_message' — suggested_actions item had no message field
 *   'missing_chip_label'   — suggested_actions item had no label field
 *   'missing_block_type'   — blocks item had no type field
 *   'nothing_renderable'   — response had no text, no blocks, no valid chips
 */

import { trackEvent } from '../../lib/posthog'
import type { OrchestratorResponseEnvelopeV2, OrchestratorStreamEvent } from './types'

export type RepairType =
  | 'empty_text'
  | 'missing_chip_message'
  | 'missing_chip_label'
  | 'missing_block_type'
  | 'nothing_renderable'
  | 'repair_log_stripped'

export interface ValidateResponseResult {
  cleaned: OrchestratorResponseEnvelopeV2
  repairs: RepairType[]
}

/**
 * Patterns matching PLoT internal repair log lines that must never be shown to users.
 * Each pattern matches a full line (after trimming). Lines matching any pattern are removed.
 */
const REPAIR_LOG_PATTERNS: RegExp[] = [
  /^\[DEFAULT_EXISTS_PROBABILITY\]/,
  /^\[STD_FLOOR\]/,
  /^\[CLAMP_/,
  /^\[MISSING_/,
  /^\[FALLBACK_/,
  /^\[REPAIR:/,
]

/**
 * Strip internal PLoT repair log lines from assistant_text.
 * Returns the cleaned text with repair lines removed.
 * If all lines are repair logs, returns empty string.
 */
export function stripRepairLogLines(text: string): string {
  const lines = text.split('\n')
  const cleaned = lines.filter((line) => {
    const trimmed = line.trim()
    if (trimmed === '') return true // preserve blank lines
    return !REPAIR_LOG_PATTERNS.some((p) => p.test(trimmed))
  })
  return cleaned.join('\n').trim()
}

export const FALLBACK_TEXT =
  "I received your message but couldn't generate a complete response. Try rephrasing."

export function validateResponse(
  envelope: OrchestratorResponseEnvelopeV2,
  requestId?: string,
): ValidateResponseResult {
  const repairs: RepairType[] = []

  // Filter blocks missing type identifier.
  // Blocks may use either 'type' (adapted format) or 'block_type' (V2 wrapped CEE format).
  // adaptCEEBlock() in useConversation normalises both into a 'type' field downstream.
  const rawBlocks = envelope.blocks ?? []
  const cleanedBlocks = rawBlocks.filter((b) => {
    const obj = b as Record<string, unknown>
    if (!b || (typeof obj.type !== 'string' && typeof obj.block_type !== 'string')) {
      repairs.push('missing_block_type')
      return false
    }
    return true
  })

  // Normalise chips: CEE serialises the dispatch text as `prompt` but the UI
  // ActionChip interface uses `message`. Map `prompt` → `message` when present.
  // Then filter chips missing label or message.
  const rawChips = envelope.suggested_actions ?? []
  const cleanedChips = rawChips.map((c) => {
    const wire = c as ActionChip & { prompt?: string }
    if (!wire.message && wire.prompt) {
      // Map prompt → message but preserve prompt on the chip for deterministic routing
      return { ...wire, message: wire.prompt } as ActionChip
    }
    return c
  }).filter((c) => {
    if (!c.label) {
      repairs.push('missing_chip_label')
      return false
    }
    if (!c.message) {
      repairs.push('missing_chip_message')
      return false
    }
    return true
  })

  let assistantText = envelope.assistant_text ?? ''

  // Strip PLoT repair log lines that leak into assistant_text.
  // These are internal messages like "[DEFAULT_EXISTS_PROBABILITY] Missing value, using default"
  // repeated many times. Users must never see internal repair logs.
  if (assistantText) {
    const stripped = stripRepairLogLines(assistantText)
    if (stripped !== assistantText) {
      repairs.push('repair_log_stripped')
      assistantText = stripped
    }
  }

  // Inject fallback when text is empty AND there are no valid blocks.
  // Suppress fallback when a graph_patch block is present — silent graph mutations
  // (draft_graph, edit_graph) are rendered on canvas, not as chat text.
  const hasText = assistantText.trim().length > 0
  const hasBlocks = cleanedBlocks.length > 0
  const hasGraphPatch = rawBlocks.some((b) => {
    const obj = b as Record<string, unknown>
    return obj?.type === 'graph_patch' || obj?.block_type === 'graph_patch'
  })
  if (!hasText && !hasBlocks && !hasGraphPatch) {
    repairs.push(cleanedChips.length > 0 ? 'empty_text' : 'nothing_renderable')
    assistantText = FALLBACK_TEXT
  }

  const cleaned: OrchestratorResponseEnvelopeV2 = {
    ...envelope,
    assistant_text: assistantText,
    blocks: cleanedBlocks.length > 0 ? cleanedBlocks : undefined,
    suggested_actions: cleanedChips.length > 0 ? cleanedChips : undefined,
  }

  if (repairs.length > 0) {
    trackEvent('ui.response.repaired', {
      request_id: requestId,
      repairs,
    })
  }

  return { cleaned, repairs }
}

// ---------------------------------------------------------------------------
// § 2 — Envelope shape validation (Brief 4, Task 1)
// ---------------------------------------------------------------------------

const SHAPE_FALLBACK_TEXT =
  'Something went wrong processing the response.'

/**
 * Validate the gross structural shape of a raw JSON value before it is used
 * as an `OrchestratorResponseEnvelopeV2`.
 *
 * This is a shape guard, not a full Zod schema. It catches:
 *   - `null`, arrays, strings, numbers, booleans (not an object)
 *   - `assistant_text` that is not `string | null | undefined`
 *   - `blocks` that is not `undefined | null | array`
 *   - `suggested_actions` that is not `undefined | null | array`
 *
 * On failure: logs a structured warning, emits telemetry, and returns a safe
 * fallback envelope instead of throwing.
 */
export function validateEnvelopeShape(raw: unknown): OrchestratorResponseEnvelopeV2 {
  // Must be a non-null, non-array object
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    const rawType = raw === null ? 'null' : Array.isArray(raw) ? 'array' : typeof raw
    console.warn('[validateEnvelopeShape] Envelope is not an object', { rawType, preview: String(raw).slice(0, 200) })
    trackEvent('ui.envelope_shape_invalid', { violation: 'not_object', raw_type: rawType })
    return { assistant_text: SHAPE_FALLBACK_TEXT }
  }

  const obj = raw as Record<string, unknown>
  const violations: string[] = []

  // assistant_text must be string | null | undefined
  if (obj.assistant_text !== undefined && obj.assistant_text !== null && typeof obj.assistant_text !== 'string') {
    violations.push('assistant_text_not_string_or_null')
    obj.assistant_text = null
  }

  // blocks must be undefined | null | array
  if (obj.blocks !== undefined && obj.blocks !== null && !Array.isArray(obj.blocks)) {
    violations.push('blocks_not_array')
    obj.blocks = undefined
  }

  // suggested_actions must be undefined | null | array
  if (obj.suggested_actions !== undefined && obj.suggested_actions !== null && !Array.isArray(obj.suggested_actions)) {
    violations.push('suggested_actions_not_array')
    obj.suggested_actions = undefined
  }

  if (violations.length > 0) {
    console.warn('[validateEnvelopeShape] Envelope shape violations repaired', { violations })
    trackEvent('ui.envelope_shape_invalid', { violations })
  }

  return raw as OrchestratorResponseEnvelopeV2
}

// ---------------------------------------------------------------------------
// § 3 — Stream event shape validation (Brief 4, Task 1)
// ---------------------------------------------------------------------------

const KNOWN_STREAM_EVENT_TYPES = new Set([
  'turn_start', 'text_delta', 'tool_start', 'block', 'tool_result', 'turn_complete', 'error', 'progress',
])

/**
 * Validate the shape of a parsed SSE event before it is used as an
 * `OrchestratorStreamEvent`. Returns `null` for events that should be skipped.
 */
export function validateStreamEventShape(parsed: Record<string, unknown>, resolvedType: string | undefined): OrchestratorStreamEvent | null {
  if (!resolvedType || typeof resolvedType !== 'string') {
    console.warn('[validateStreamEventShape] SSE event missing type', { keys: Object.keys(parsed) })
    trackEvent('ui.stream_event_shape_invalid', { violation: 'missing_type' })
    return null
  }

  // Warn on unknown event types (forward-compatible: pass through, don't reject)
  if (!KNOWN_STREAM_EVENT_TYPES.has(resolvedType)) {
    console.warn('[validateStreamEventShape] Unknown SSE event type', { type: resolvedType })
    trackEvent('ui.stream_event_shape_invalid', { violation: 'unknown_type', type: resolvedType })
  }

  // For turn_complete, validate the nested envelope (inject fallback if missing)
  if (resolvedType === 'turn_complete') {
    const envelope = parsed.envelope
    if (envelope == null) {
      console.warn('[validateStreamEventShape] turn_complete missing envelope')
      trackEvent('ui.stream_event_shape_invalid', { violation: 'missing_envelope' })
      parsed.envelope = { assistant_text: SHAPE_FALLBACK_TEXT }
    } else {
      parsed.envelope = validateEnvelopeShape(envelope)
    }
  }

  return { ...parsed, type: resolvedType } as OrchestratorStreamEvent
}
