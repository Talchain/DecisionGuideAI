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
import type { OrchestratorResponseEnvelopeV2 } from './types'

export type RepairType =
  | 'empty_text'
  | 'missing_chip_message'
  | 'missing_chip_label'
  | 'missing_block_type'
  | 'nothing_renderable'

export interface ValidateResponseResult {
  cleaned: OrchestratorResponseEnvelopeV2
  repairs: RepairType[]
}

const FALLBACK_TEXT =
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

  // Filter chips missing label or message
  const rawChips = envelope.suggested_actions ?? []
  const cleanedChips = rawChips.filter((c) => {
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

  // Inject fallback when text is empty AND there are no valid blocks
  const hasText = assistantText.trim().length > 0
  const hasBlocks = cleanedBlocks.length > 0
  if (!hasText && !hasBlocks) {
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
