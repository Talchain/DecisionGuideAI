/**
 * v5GraphPatchDescription — derive a clean human receipt from a
 * V5GraphPatchBlock without leaking raw IDs, operators, or schema field
 * names into the default UI surface.
 *
 * This is the V5 analogue of `friendlyOperation.ts` (which serves V4
 * PatchOperation). It exists separately because the V5 block shape is
 * fixed at `{ type, status, operation, target_id, before, after }` in
 * the @talchain/schemas boundary package — we cannot add friendly fields
 * to the wire without a schema-package release. So the friendly receipt
 * is computed UI-side from the canvas store.
 *
 * Resolution priority for entity labels:
 *   1. Canvas store node label (looked up via target_id).
 *   2. Generic element-type word derived from id prefix (e.g. "constraint").
 *   3. Generic verb fallback ("Updated the model").
 *
 * Raw IDs (target_id) and operator strings ('lte', 'set_factor_value', etc.)
 * MUST NOT appear in the returned summary. The RAW_ID_PATTERN check
 * mirrors the V4 `friendlyOperation.RAW_ID_PATTERN` so any regression
 * in the upstream label data is caught.
 */

import { RAW_ID_PATTERN } from '../../canvas/conversation/friendlyOperation'
import type { V5GraphPatchBlock } from '../../canvas/conversation/types'

// ---------------------------------------------------------------------------
// Operation labels (already friendlied; kept here as the single source of truth
// for V5 ops so the block component does not duplicate the table).
// ---------------------------------------------------------------------------

export const V5_OPERATION_LABELS: Record<V5GraphPatchBlock['operation'], string> = {
  set_factor_value: 'Updated factor',
  add_constraint: 'Added constraint',
  adjust_edge_strength: 'Adjusted connection',
}

const V5_NOOP_LABELS: Record<V5GraphPatchBlock['operation'], string> = {
  set_factor_value: 'Factor already at this value',
  add_constraint: 'Constraint already in place',
  adjust_edge_strength: 'Connection strength already set',
}

// ---------------------------------------------------------------------------
// Operator → decision-language phrase (used for constraints).
//
// Mirrors the CEE format-confirmation table at
// `olumi-assistants-service/src/orchestrator-v5/tools/handlers/d1-shared/
// format-confirmation.ts:60–68` so the receipt copy stays coherent with
// CEE's own assistant_text ("at most £50,000" / "at least 30 FTE")
// rather than diverging into mathematical-notation glyphs (≤ / ≥).
// Covers both the symbol form CEE emits today (`<=` / `>=` from
// add-constraint.ts:53 TYPE_TO_OPERATOR) and the short-code form
// (`lte` / `gte`) for forward-compat. Decision-language wording is
// the contract: never render raw operator characters in the default
// surface — see Workstream 1 audit contract C.
// ---------------------------------------------------------------------------

const CONSTRAINT_OPERATOR_PHRASES: Record<string, string> = {
  lte: 'at most',
  '<=': 'at most',
  gte: 'at least',
  '>=': 'at least',
  lt: 'less than',
  '<': 'less than',
  gt: 'more than',
  '>': 'more than',
  eq: 'exactly',
  '=': 'exactly',
}

// ---------------------------------------------------------------------------
// Element type derivation (mirrors friendlyOperation.elementTypeFromId).
// ---------------------------------------------------------------------------

const ID_PREFIX_TO_TYPE: readonly { pattern: RegExp; type: string }[] = [
  { pattern: /^option_|^opt_/i, type: 'option' },
  { pattern: /^factor_|^fac_/i, type: 'factor' },
  { pattern: /^goal_/i, type: 'goal' },
  { pattern: /^decision_|^dec_/i, type: 'decision' },
  { pattern: /^outcome_|^out_/i, type: 'outcome' },
  { pattern: /^constraint_|^con_/i, type: 'constraint' },
  { pattern: /^risk_/i, type: 'risk' },
  { pattern: /^edge_/i, type: 'connection' },
]

function elementTypeFromId(id: string, fallback: string): string {
  for (const { pattern, type } of ID_PREFIX_TO_TYPE) {
    if (pattern.test(id)) return type
  }
  return fallback
}

// ---------------------------------------------------------------------------
// Value formatting.
// ---------------------------------------------------------------------------

// Currency units → human prefix glyph. Both ISO codes (CEE may emit
// `'GBP'` from a structured proposal) AND symbol forms (CEE
// add-constraint.ts passes the user-supplied symbol verbatim — e.g.
// `'£'`) must render as a left-prefixed glyph on the value, not as a
// trailing suffix. Mirroring both representations means a CEE refactor
// that swaps one form for the other does not silently regress receipt
// formatting from `£50,000` to `50,000 £`.
const CURRENCY_PREFIXES: Record<string, string> = {
  GBP: '£',
  '£': '£',
  USD: '$',
  $: '$',
  EUR: '€',
  '€': '€',
}

// Percent unit — match the literal `%` symbol or the word "percent"
// case-insensitively. Lowercased before lookup so mixed-case forms
// (e.g. `'Percent'`) collapse to the same path as `'percent'` /
// `'PERCENT'` (NR2 — defensive, current CEE only emits `%`).
const PERCENT_UNITS: ReadonlySet<string> = new Set(['%', 'percent'])

/**
 * Format a numeric value with optional unit. Currencies render as a
 * symbol prefix with thousands separators (covering both ISO codes
 * and symbol forms). Percent renders as `N%` with no space. Other
 * units render as a suffix with a space. Non-numeric values fall back
 * to a string coercion (the caller should already have filtered
 * these).
 */
export function formatConstraintValue(
  value: unknown,
  unit?: string | null,
): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return typeof value === 'string' ? value : '—'
  }
  if (unit) {
    // Currencies — match symbol or ISO code (case-insensitive).
    const currencyGlyph =
      CURRENCY_PREFIXES[unit] ?? CURRENCY_PREFIXES[unit.toUpperCase()]
    if (currencyGlyph) {
      return `${currencyGlyph}${value.toLocaleString('en-GB')}`
    }
    if (PERCENT_UNITS.has(unit.toLowerCase())) {
      return `${value.toLocaleString('en-GB')}%`
    }
    return `${value.toLocaleString('en-GB')} ${unit}`
  }
  return value.toLocaleString('en-GB')
}

function formatScalar(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toLocaleString('en-GB', { maximumFractionDigits: 3 })
  }
  if (typeof value === 'string') return value
  if (value == null) return '—'
  return ''
}

/**
 * Coerce an edge-strength field into a scalar number for receipt
 * rendering. CEE adjust_edge_strength emits the object form
 * `{ mean, std }` (handler ts:218); legacy / synthetic blocks may
 * pass a bare scalar. We surface the `mean` because it is the
 * decision-relevant magnitude — `std` is a confidence band that
 * does not belong in a one-line receipt summary.
 *
 * Returns `null` for unknown shapes so callers can branch to a
 * blank-suppression path rather than rendering an empty string.
 */
function strengthScalar(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const meanRaw = (value as { mean?: unknown }).mean
    if (typeof meanRaw === 'number' && Number.isFinite(meanRaw)) return meanRaw
  }
  return null
}

/**
 * Parse the arrow-form target_id CEE adjust_edge_strength emits
 * (`from→to`, handler ts:262). Returns null for non-arrow ids so
 * callers can fall back to the legacy edge-id resolver.
 */
function parseArrowFormFromId(id: string): string | null {
  const idx = id.indexOf('→')
  if (idx <= 0) return null
  return id.slice(0, idx)
}

function parseArrowFormToId(id: string): string | null {
  const idx = id.indexOf('→')
  if (idx <= 0 || idx === id.length - 1) return null
  return id.slice(idx + 1)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface V5PatchDeps {
  /**
   * Pre-built map of node ID → display label, built once per render from
   * the canvas store. Mirrors the friendlyOperation.DescribeOpDeps shape.
   */
  readonly nodeLabels: ReadonlyMap<string, string>
  /**
   * Pre-built map of edge ID → { from, to } source/target node IDs.
   * Resolve display labels via nodeLabels.
   */
  readonly edgeEndpoints: ReadonlyMap<string, { from: string; to: string }>
}

export interface V5PatchReceipt {
  /**
   * Action label — the title-case verb phrase, e.g. "Updated factor",
   * "Added constraint", "Adjusted connection". Safe to show as a heading.
   */
  readonly actionLabel: string
  /**
   * Human entity description, e.g. "team morale" (factor),
   * "budget" (constraint label), or "team morale → outcome" (edge).
   * Empty string if no label could be resolved — callers should fall
   * back to actionLabel alone.
   */
  readonly entityLabel: string
  /**
   * Human change description, e.g. "4% → 5%" (factor),
   * "at most £50,000" (constraint), "0.3 → 0.6" (edge strength).
   * Empty when before/after offers no useful diff (e.g. on noop).
   * Constraint operators render as decision-language phrases
   * ("at most" / "at least") — never as glyphs ("≤" / "≥") — per
   * the V5 UI rendering contract.
   */
  readonly changeSummary: string
  /**
   * Whether the patch was applied or a noop. Mirrors the wire status.
   */
  readonly status: 'applied' | 'noop'
}

/**
 * Resolve a node display label using the canvas store, with the same
 * RAW_ID_PATTERN guard the V4 path uses. Returns empty string when no
 * safe label is found.
 */
function resolveNodeLabel(
  id: string,
  deps: V5PatchDeps,
): string {
  const label = deps.nodeLabels.get(id)
  if (label && label.trim() && !RAW_ID_PATTERN.test(label)) return label
  return ''
}

/**
 * Resolve an edge display label as "from → to". Returns empty strings
 * when endpoints are unknown.
 */
function resolveEdgeEndpoints(
  id: string,
  deps: V5PatchDeps,
): { from: string; to: string } {
  const ep = deps.edgeEndpoints.get(id)
  if (!ep) return { from: '', to: '' }
  return {
    from: resolveNodeLabel(ep.from, deps),
    to: resolveNodeLabel(ep.to, deps),
  }
}

/**
 * Build a clean receipt from a V5 graph patch block. The result never
 * contains raw IDs, schema field names, or operator codes.
 *
 * `before` and `after` are read for change summary derivation (e.g.
 * "4% → 5%" or "at most £50,000") but their raw keys are never
 * surfaced. Operator phrases use decision language ("at most" /
 * "at least") rather than mathematical glyphs.
 */
export function buildV5PatchReceipt(
  block: V5GraphPatchBlock,
  deps: V5PatchDeps,
): V5PatchReceipt {
  const status = block.status
  const actionLabel = status === 'noop'
    ? V5_NOOP_LABELS[block.operation] ?? V5_OPERATION_LABELS[block.operation]
    : V5_OPERATION_LABELS[block.operation]

  switch (block.operation) {
    case 'set_factor_value': {
      const entityLabel = resolveNodeLabel(block.target_id, deps)
        || elementTypeFromId(block.target_id, 'factor')
      // CEE set_factor_value emits an ObservedSnapshot with both
      // normalised `value` (e.g. 0.05) and user-facing `raw_value` +
      // `unit` (e.g. 5 + '%'). The receipt MUST render the
      // user-facing pair when present; falling back to `value` would
      // surface raw normalised decimals (`0.04 → 0.05` instead of
      // `4% → 5%`). See set-factor-value.ts:263 for the snapshot
      // shape and formatFactorChange for the assistant_text mirror.
      const beforeRaw = block.before as
        | { value?: unknown; raw_value?: unknown; unit?: unknown }
        | null
      const afterRaw = block.after as
        | { value?: unknown; raw_value?: unknown; unit?: unknown }
        | null
      const beforeUnit = typeof beforeRaw?.unit === 'string' ? beforeRaw.unit : null
      const afterUnit = typeof afterRaw?.unit === 'string' ? afterRaw.unit : null
      const beforeNumeric =
        beforeRaw?.raw_value !== undefined ? beforeRaw.raw_value : beforeRaw?.value
      const afterNumeric =
        afterRaw?.raw_value !== undefined ? afterRaw.raw_value : afterRaw?.value
      const beforeStr = beforeUnit
        ? formatConstraintValue(beforeNumeric, beforeUnit)
        : formatScalar(beforeNumeric)
      const afterStr = afterUnit
        ? formatConstraintValue(afterNumeric, afterUnit)
        : formatScalar(afterNumeric)
      let changeSummary = ''
      if (status === 'applied' && afterStr && afterStr !== '—') {
        changeSummary = beforeStr && beforeStr !== '—' && beforeStr !== afterStr
          ? `${beforeStr} → ${afterStr}`
          : afterStr
      }
      return { actionLabel, entityLabel, changeSummary, status }
    }

    case 'add_constraint': {
      // For constraints the human "label" comes from the after payload,
      // not from a node label lookup (constraints aren't graph nodes
      // with a separate label cache — they live on the goal node).
      const after = block.after as
        | { label?: unknown; value?: unknown; unit?: unknown; operator?: unknown }
        | null
      const before = block.before as
        | { value?: unknown; unit?: unknown; operator?: unknown }
        | null
      const labelRaw = typeof after?.label === 'string' ? after.label : ''
      const entityLabel = labelRaw && !RAW_ID_PATTERN.test(labelRaw) ? labelRaw : ''
      const opRaw = typeof after?.operator === 'string' ? after.operator : ''
      const operatorPhrase = CONSTRAINT_OPERATOR_PHRASES[opRaw] ?? ''
      const valueStr = formatConstraintValue(
        after?.value,
        typeof after?.unit === 'string' ? after.unit : null,
      )
      let changeSummary = ''
      if (operatorPhrase && valueStr && valueStr !== '—') {
        changeSummary = `${operatorPhrase} ${valueStr}`.trim()
      } else if (valueStr && valueStr !== '—') {
        changeSummary = valueStr
      }
      // On an applied update (before existed), prefix the prior value.
      if (status === 'applied' && before && changeSummary) {
        const beforeOpPhrase = CONSTRAINT_OPERATOR_PHRASES[
          typeof before.operator === 'string' ? before.operator : ''
        ] ?? ''
        const beforeValue = formatConstraintValue(
          before.value,
          typeof before.unit === 'string' ? before.unit : null,
        )
        const beforeStr = `${beforeOpPhrase} ${beforeValue}`.trim()
        if (beforeStr && beforeStr !== changeSummary && beforeValue !== '—') {
          changeSummary = `${beforeStr} → ${changeSummary}`
        }
      }
      return { actionLabel, entityLabel, changeSummary, status }
    }

    case 'adjust_edge_strength': {
      // CEE adjust_edge_strength emits target_id as the arrow form
      // `from→to` (handler ts:262: `${parsed.from}→${parsed.to}`),
      // and before/after as { from, to, strength: { mean, std },
      // effect_direction }. The earlier scalar-only path silently
      // produced an empty change summary on real CEE payloads. Parse
      // both shapes here so the receipt is informative either way.
      const beforeRaw = block.before as
        | { from?: unknown; to?: unknown; strength?: unknown; effect_direction?: unknown }
        | null
      const afterRaw = block.after as
        | { from?: unknown; to?: unknown; strength?: unknown; effect_direction?: unknown }
        | null

      // Resolve endpoints: prefer the snapshot's from/to ids (handler-
      // emitted, canonical), fall back to parsing the arrow-form
      // target_id, fall back to deps.edgeEndpoints (legacy edge-id
      // shape). Each tier produces friendly labels via nodeLabels.
      const fromId =
        (typeof afterRaw?.from === 'string' && afterRaw.from) ||
        (typeof beforeRaw?.from === 'string' && beforeRaw.from) ||
        parseArrowFormFromId(block.target_id) ||
        ''
      const toId =
        (typeof afterRaw?.to === 'string' && afterRaw.to) ||
        (typeof beforeRaw?.to === 'string' && beforeRaw.to) ||
        parseArrowFormToId(block.target_id) ||
        ''
      const fromLabel = fromId ? resolveNodeLabel(fromId, deps) : ''
      const toLabel = toId ? resolveNodeLabel(toId, deps) : ''
      let entityLabel = ''
      if (fromLabel && toLabel) {
        entityLabel = `${fromLabel} → ${toLabel}`
      } else {
        // Fall back to the legacy edge-id resolver for callers that
        // pass an actual edge id (older fixtures / synthetic blocks).
        const ep = resolveEdgeEndpoints(block.target_id, deps)
        if (ep.from && ep.to) entityLabel = `${ep.from} → ${ep.to}`
      }

      const beforeStrengthScalar = strengthScalar(beforeRaw?.strength)
      const afterStrengthScalar = strengthScalar(afterRaw?.strength)
      const beforeStr = formatScalar(beforeStrengthScalar)
      const afterStr = formatScalar(afterStrengthScalar)
      let changeSummary = ''
      if (status === 'applied' && afterStr && afterStr !== '—') {
        changeSummary = beforeStr && beforeStr !== '—' && beforeStr !== afterStr
          ? `${beforeStr} → ${afterStr}`
          : afterStr
      }

      // Direction flips (positive ↔ negative) carry user-relevant
      // meaning even when |strength| is unchanged. Append a short
      // hint when the direction changed.
      const beforeDir = typeof beforeRaw?.effect_direction === 'string' ? beforeRaw.effect_direction : null
      const afterDir = typeof afterRaw?.effect_direction === 'string' ? afterRaw.effect_direction : null
      if (status === 'applied' && beforeDir && afterDir && beforeDir !== afterDir) {
        const dirHint = `direction now ${afterDir}`
        changeSummary = changeSummary ? `${changeSummary}, ${dirHint}` : dirHint
      }
      return { actionLabel, entityLabel, changeSummary, status }
    }

    default: {
      // Defensive fallback for an unknown operation kind. Never leaks
      // the raw target_id; emits the generic action label only.
      return {
        actionLabel: 'Updated the model',
        entityLabel: '',
        changeSummary: '',
        status,
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Convenience: build deps from a flat node/edge collection.
// ---------------------------------------------------------------------------

interface NodeLike {
  id: string
  data?: { label?: unknown }
}

interface EdgeLike {
  id: string
  source?: string
  target?: string
}

/**
 * Build the deps maps from canvas-store nodes and edges. The block
 * component should call this once per render and pass the result to
 * `buildV5PatchReceipt`.
 */
export function buildV5PatchDeps(
  nodes: readonly NodeLike[],
  edges: readonly EdgeLike[],
): V5PatchDeps {
  const nodeLabels = new Map<string, string>()
  for (const n of nodes) {
    const label = typeof n.data?.label === 'string' ? n.data.label : ''
    if (label) nodeLabels.set(n.id, label)
  }
  const edgeEndpoints = new Map<string, { from: string; to: string }>()
  for (const e of edges) {
    if (typeof e.source === 'string' && typeof e.target === 'string') {
      edgeEndpoints.set(e.id, { from: e.source, to: e.target })
    }
  }
  return { nodeLabels, edgeEndpoints }
}
