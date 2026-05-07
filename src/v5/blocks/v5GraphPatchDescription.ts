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
// Operator → human glyph (used for constraints).
// ---------------------------------------------------------------------------

const CONSTRAINT_OPERATOR_LABELS: Record<string, string> = {
  lte: '≤',
  '<=': '≤',
  gte: '≥',
  '>=': '≥',
  lt: '<',
  '<': '<',
  gt: '>',
  '>': '>',
  eq: '=',
  '=': '=',
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

const PERCENT_UNITS: ReadonlySet<string> = new Set(['%', 'percent', 'PERCENT'])

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
    if (PERCENT_UNITS.has(unit)) {
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
   * Human change description, e.g. "0.5 → 0.7" (factor), "≤ £50,000"
   * (constraint), "moderate → strong" (edge strength). Empty when
   * before/after offers no useful diff (e.g. on noop).
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
 * "0.5 → 0.7" or "≤ £50,000") but their raw keys are never surfaced.
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
      const operatorGlyph = CONSTRAINT_OPERATOR_LABELS[opRaw] ?? ''
      const valueStr = formatConstraintValue(
        after?.value,
        typeof after?.unit === 'string' ? after.unit : null,
      )
      let changeSummary = ''
      if (operatorGlyph && valueStr && valueStr !== '—') {
        changeSummary = `${operatorGlyph} ${valueStr}`.trim()
      } else if (valueStr && valueStr !== '—') {
        changeSummary = valueStr
      }
      // On an applied update (before existed), prefix the prior value.
      if (status === 'applied' && before && changeSummary) {
        const beforeOpGlyph = CONSTRAINT_OPERATOR_LABELS[
          typeof before.operator === 'string' ? before.operator : ''
        ] ?? ''
        const beforeValue = formatConstraintValue(
          before.value,
          typeof before.unit === 'string' ? before.unit : null,
        )
        const beforeStr = `${beforeOpGlyph} ${beforeValue}`.trim()
        if (beforeStr && beforeStr !== changeSummary && beforeValue !== '—') {
          changeSummary = `${beforeStr} → ${changeSummary}`
        }
      }
      return { actionLabel, entityLabel, changeSummary, status }
    }

    case 'adjust_edge_strength': {
      const { from, to } = resolveEdgeEndpoints(block.target_id, deps)
      const entityLabel = from && to ? `${from} → ${to}` : ''
      const before = (block.before as { strength?: unknown } | null)?.strength
      const after = (block.after as { strength?: unknown } | null)?.strength
      const beforeStr = formatScalar(before)
      const afterStr = formatScalar(after)
      let changeSummary = ''
      if (status === 'applied' && afterStr) {
        changeSummary = beforeStr && beforeStr !== afterStr
          ? `${beforeStr} → ${afterStr}`
          : afterStr
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
