/**
 * expectNoChipMetadataLeaks — purpose-built no-leak helper for ActionChip
 * elements.
 *
 * Differs from `expectNoReceiptLeaks` because chip rendering has intentional
 * attributes that would (correctly) be rejected by the strict receipt helper:
 *   - `data-testid="chip-{id}"` may carry id prefixes such as `prop_` (used
 *     by forward-compat proposal chips). The receipt helper's
 *     RAW_ID_PATTERN deliberately matches these; for chips the id-bearing
 *     testid is the contract.
 *   - `data-chip-role="facilitator|challenger|scientist"` is a styling hook.
 *
 * What this helper enforces is what the chip surface MUST NOT carry: the
 * structured `parameters` payload, the wire `action_type` string, proposal
 * refs, handler ids, schema/internal terms, and raw JSON tells.
 *
 * Use on a chip `<button>` (or its container) — not on receipts.
 */

import { expect } from 'vitest'

/**
 * Forbidden chip-DOM tells. Excludes the chip-id-bearing attributes
 * intentionally rendered by ActionChipRow (data-testid, data-chip-role).
 */
export const CHIP_FORBIDDEN_TERMS: readonly string[] = [
  // Structured chip metadata that must never serialise into DOM.
  'parameters',
  'chip_metadata',
  'proposal_ref',
  'pending_actions',
  'handler_id',
  'graph_hash',
  // Forward-compat: future proposal payloads may carry public_label /
  // public_message on chip metadata. The current UI ignores them; they
  // must not appear in DOM as either field names or values.
  'public_label',
  'public_message',
  // Wire-allowed action type literals — the chip dispatches `message`,
  // not the action_type string, so the literal must not leak.
  'action_type',
  'apply_proposed_change',
  'run_analysis',
  'what_would_flip',
  'explain_result',
  'explain_results',
  'explain_from_structure',
  'compare_options',
  'set_factor_value',
  'add_constraint',
  'adjust_edge_strength',
  'update_node',
  'update_edge',
  'add_node',
  'add_edge',
  // Validation / error machinery.
  'STRUCTURAL_VALIDATION_FAILED',
  'INTERNAL_ERROR',
  'zod',
  'invalid_type',
  // Raw JSON tells.
  '{"',
  '":',
]

/**
 * Assert a chip element's `outerHTML` carries no metadata, parameters,
 * action type, proposal ref, schema/internal term, or raw JSON.
 *
 * Cites the specific leaked term on failure.
 */
export function expectNoChipMetadataLeaks(element: HTMLElement): void {
  const lowered = element.outerHTML.toLowerCase()
  for (const term of CHIP_FORBIDDEN_TERMS) {
    expect(
      lowered,
      `chip outerHTML leaked forbidden term: "${term}"`,
    ).not.toContain(term.toLowerCase())
  }
}
