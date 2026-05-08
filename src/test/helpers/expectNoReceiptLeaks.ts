/**
 * expectNoReceiptLeaks — strict assertion helper for V5 / V4 graph-patch
 * receipt rendering.
 *
 * Asserts the rendered receipt's `outerHTML` does not contain:
 *   - raw element IDs (matched via the production RAW_ID_PATTERN)
 *   - mathematical operator glyphs (`<=` / `>=` / `≤` / `≥` / `lte` / `gte`)
 *     — receipts must use decision-language phrases per the V5 UI contract
 *   - any internal schema field, handler keyword, or wire-allowed action
 *     type literal that should never reach the rendered surface
 *   - raw JSON tells (`{"`, `":`)
 *
 * Use this on receipt cards (V5GraphPatchBlock, V4 GraphPatchBlockRenderer).
 * Do NOT use this on suggested-action chips — those have intentional
 * attributes (e.g. `data-testid="chip-prop_<hex>"`) that this helper
 * would (correctly) reject. Use `expectNoChipMetadataLeaks` for chips.
 */

import { expect } from 'vitest'
import { RAW_ID_PATTERN } from '../../canvas/conversation/friendlyOperation'

/**
 * Forbidden internal terms in the rendered receipt DOM. Exported so failing
 * assertions can cite the exact leaked term in test output.
 *
 * These are unique snake_case / SCREAMING_SNAKE / namespaced strings that
 * would never appear in legitimate user-facing copy by accident — checked
 * as plain substrings (case-insensitive).
 *
 * Short English-prone substrings (`mean`, `std`, `noop`, `operator`,
 * `provenance`, `before`, `after`) are checked separately as
 * word-boundary regexes in `RECEIPT_FORBIDDEN_WORD_REGEXES` to avoid
 * false positives on legitimate copy like the V4 dismiss button label
 * "Not what I meant".
 */
export const RECEIPT_FORBIDDEN_TERMS: readonly string[] = [
  // Schema field names + raw JSON shape tells.
  'target_id',
  'node_id',
  'edge_id',
  'constraint_id',
  'handler_id',
  'graph_hash',
  'proposal_ref',
  'chip_metadata',
  'pending_actions',
  'raw_value',
  'fact_type',
  '{"',
  '":',
  // V5 + V4 operation names — wire-only.
  'set_factor_value',
  'add_constraint',
  'adjust_edge_strength',
  'update_node',
  'update_edge',
  'add_node',
  'add_edge',
  'remove_node',
  'remove_edge',
  // Wire-allowed action type literals — never user-facing copy.
  'apply_proposed_change',
  'run_analysis',
  'what_would_flip',
  'explain_result',
  'explain_results',
  'explain_from_structure',
  'compare_options',
  // Validation / error machinery — never user-facing copy.
  'STRUCTURAL_VALIDATION_FAILED',
  'INTERNAL_ERROR',
  'zod',
  'invalid_type',
  'precondition',
  // Block-type discriminator — must never reach user-facing copy.
  // V4 retains this in internal DOM machinery (`block-graph-patch-{patch_id}`
  // testid + CSS module classes like `graphPatchBlock`); V4 receipt tests
  // therefore use `expectNoReceiptUserFacingTextLeaks` (textContent +
  // aria-labels only), which scopes the assertion to what the user sees
  // and explicitly accepts the internal-DOM exception. V5 uses Tailwind
  // (no CSS modules) and a renamed testid (`v5-change-receipt`), so the
  // full-outerHTML form catches any regression on that surface.
  'graph-patch',
  'graph_patch',
  'graphpatch',
]

/**
 * Raw edge-id pattern — supplements the production `RAW_ID_PATTERN`
 * (which deliberately omits `edge_` since edge IDs are not the typical
 * leak vector — V5 receipts resolve edges via from/to endpoint labels).
 * Defensive coverage so any leaked `edge_xxx` substring trips the helper.
 */
export const RECEIPT_FORBIDDEN_RAW_EDGE_ID_PATTERN = /\bedge_[a-z0-9_]+/i

/**
 * Word-boundary forbidden terms — short strings whose substrings appear
 * in legitimate UI copy (e.g. "meant" in V4's "Not what I meant" button)
 * but whose standalone-word forms would still indicate a real leak from
 * the schema layer (e.g. an unwrapped `strength.mean` value).
 *
 * Each entry must match only the standalone word, never an embedded
 * substring. Entries are checked with the `i` (case-insensitive) flag.
 */
export const RECEIPT_FORBIDDEN_WORD_REGEXES: readonly RegExp[] = [
  /\bmean\b/i,
  /\bstd\b/i,
  /\bnoop\b/i,
  /\bbefore\b/i,
  /\bafter\b/i,
  /\boperator\b/i,
  /\bprovenance\b/i,
]

/**
 * Operator-glyph guard — symbol forms forbidden in the default receipt
 * surface. Decision-language phrases ("at most" / "at least") are the
 * contract.
 */
export const RECEIPT_FORBIDDEN_OPERATOR_GLYPHS = /(?:<=|>=|≤|≥|\blte\b|\bgte\b)/i

/**
 * Assert a receipt element's `outerHTML` carries no raw IDs, no operator
 * glyphs, and no forbidden internal/wire term. On failure, the assertion
 * message cites the specific leaked term so the test output points at the
 * regression rather than dumping the whole DOM.
 */
export function expectNoReceiptLeaks(element: HTMLElement): void {
  const rendered = element.outerHTML
  const lowered = rendered.toLowerCase()

  expect(
    rendered,
    'receipt outerHTML matched RAW_ID_PATTERN (raw element id leaked)',
  ).not.toMatch(RAW_ID_PATTERN)

  expect(
    rendered,
    'receipt outerHTML matched RECEIPT_FORBIDDEN_RAW_EDGE_ID_PATTERN (raw edge id leaked)',
  ).not.toMatch(RECEIPT_FORBIDDEN_RAW_EDGE_ID_PATTERN)

  expect(
    rendered,
    'receipt outerHTML matched RECEIPT_FORBIDDEN_OPERATOR_GLYPHS (use decision-language phrases)',
  ).not.toMatch(RECEIPT_FORBIDDEN_OPERATOR_GLYPHS)

  for (const term of RECEIPT_FORBIDDEN_TERMS) {
    expect(
      lowered,
      `receipt outerHTML leaked forbidden term: "${term}"`,
    ).not.toContain(term.toLowerCase())
  }

  for (const pattern of RECEIPT_FORBIDDEN_WORD_REGEXES) {
    expect(
      rendered,
      `receipt outerHTML leaked forbidden standalone word matching ${pattern}`,
    ).not.toMatch(pattern)
  }
}

/**
 * Variant of `expectNoReceiptLeaks` that scopes the assertion to the
 * user-facing surface only — visible `textContent` and `aria-label`
 * attributes — rather than full `outerHTML`.
 *
 * Use this where the rendered card carries internal DOM machinery in
 * its testid / CSS class names that intentionally repeats schema-like
 * tokens (e.g. V4's `data-testid="block-graph-patch-{patch_id}"` and
 * its `graphPatchBlock` CSS module classes). Scoping to textContent +
 * aria-labels expresses the contract precisely: those tokens may
 * persist in implementation-detail attributes, but they MUST NOT bleed
 * into anything the user reads or hears via assistive tech.
 *
 * Tradeoff: this form does NOT catch attribute-level leaks (e.g. a
 * future `data-operation="add_constraint"` regression). For that, use
 * the strict `expectNoReceiptLeaks` against full outerHTML on a
 * surface that already has clean attributes (V5 receipts).
 */
export function expectNoReceiptUserFacingTextLeaks(element: HTMLElement): void {
  const textContent = element.textContent ?? ''
  const elementOwnAriaLabel = element.getAttribute('aria-label') ?? ''
  const childAriaLabels = Array.from(element.querySelectorAll('[aria-label]'))
    .map((el) => el.getAttribute('aria-label') ?? '')
    .join('\n')
  const surface = [textContent, elementOwnAriaLabel, childAriaLabels].join('\n')
  const lowered = surface.toLowerCase()

  expect(
    surface,
    'user-facing receipt surface matched RAW_ID_PATTERN (raw element id leaked)',
  ).not.toMatch(RAW_ID_PATTERN)

  expect(
    surface,
    'user-facing receipt surface matched RECEIPT_FORBIDDEN_RAW_EDGE_ID_PATTERN (raw edge id leaked)',
  ).not.toMatch(RECEIPT_FORBIDDEN_RAW_EDGE_ID_PATTERN)

  expect(
    surface,
    'user-facing receipt surface matched RECEIPT_FORBIDDEN_OPERATOR_GLYPHS (use decision-language phrases)',
  ).not.toMatch(RECEIPT_FORBIDDEN_OPERATOR_GLYPHS)

  for (const term of RECEIPT_FORBIDDEN_TERMS) {
    expect(
      lowered,
      `user-facing receipt surface leaked forbidden term: "${term}"`,
    ).not.toContain(term.toLowerCase())
  }

  for (const pattern of RECEIPT_FORBIDDEN_WORD_REGEXES) {
    expect(
      surface,
      `user-facing receipt surface leaked forbidden standalone word matching ${pattern}`,
    ).not.toMatch(pattern)
  }
}
