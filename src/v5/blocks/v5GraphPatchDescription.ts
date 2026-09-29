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
import { classifyUnit, formatMoneyFigure } from '../../utils/unitClassifier'
import type { V5GraphPatchBlock } from '../../canvas/conversation/types'
import type { CEEGoalConstraint } from '../../adapters/cee/types'
import { isKnownLimitFrame, labelAlreadyStatesLimit, limitChangeSentence } from '../../canvas/utils/goalConstraintText'

// ---------------------------------------------------------------------------
// Operation labels (already friendlied; kept here as the single source of truth
// for V5 ops so the block component does not duplicate the table).
// ---------------------------------------------------------------------------

/**
 * ⭐⭐ THE ACTION LABEL NAMES THE FIELD, NOT JUST THE ENTITY.
 *
 * Fresh-guest browser witness, 20 Aug 2026 (UI `7153fbd7` / CEE `65445df`). Two
 * writes landed under the "Applied" badge that answered a question the user had
 * not asked: an edge STRENGTH moved 1 → 0.6, and a factor's OWN VALUE moved
 * 0.5 → 0.7, both while the product's blocker was asking for that option ×
 * factor pair's EFFECT VALUE — a third number, on the same two entities.
 *
 * The card already named the entity and the before → after. What it could not
 * do was let the reader tell WHICH NUMBER had moved: "Adjusted connection" and
 * "Updated factor" both describe a change to an entity, not to a field. On a
 * surface where three different numbers hang off the same option → factor pair,
 * that is the difference between a receipt a user can check and one they cannot.
 *
 * ⚠ THE BADGE BESIDE THIS IS STILL THE BARE WORD "Applied"
 * (`V5GraphPatchBlock.tsx:115`), gated on `block.status` alone. It stays: the
 * badge answers *did it land?* and this label answers *what moved?* — two
 * questions, named apart. What is fixed here is that the second question now
 * has an answer.
 */
export const V5_OPERATION_LABELS: Record<V5GraphPatchBlock['operation'], string> = {
  set_factor_value: 'Updated factor value',
  add_constraint: 'Added constraint',
  adjust_edge_strength: 'Adjusted connection strength',
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

/** A patch's operator (either spelling) as the ASCII comparator `limitChangeSentence` reads; anything else is `null`. */
const CHANGE_OPERATOR: Record<string, '<=' | '<' | '>=' | '>'> = {
  lte: '<=', '<=': '<=', lt: '<', '<': '<', gte: '>=', '>=': '>=', gt: '>', '>': '>',
}

/** The change a patched limit states, or `null` for a level (said below exactly as before). */
function saidLimitChange(side: { value?: unknown; unit?: unknown; operator?: unknown; value_frame?: unknown } | null): string | null {
  if (side === null || typeof side.operator !== 'string') return null
  const operator = CHANGE_OPERATOR[side.operator]
  if (operator === undefined) return null
  return limitChangeSentence({ ...side, operator } as unknown as CEEGoalConstraint)
}

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

// Money goes through the ONE money-figure rule (`formatMoneyFigure`,
// `utils/unitClassifier`): an ISO code (`'GBP'`, from a structured proposal)
// and a symbol (`'£'`, add-constraint.ts passes the user's verbatim) both read
// `£50,000`, and a rate reads `£49 / month`, as every other surface prints it.

// Percent unit — routed through `classifyUnit`, the single source of truth
// (U2). This file used to carry its own `PERCENT_UNITS = new Set(['%',
// 'percent'])`, one of SIX live copies of the same recogniser, and it was the
// one that had visibly drifted: it never learned `'percentage'`, so a CEE
// `unit: 'percentage'` rendered "20%" on five surfaces and "20 percentage" in
// this receipt. `classifyUnit` handles the glyph, both words, case and
// whitespace in one place.

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
    const money = formatMoneyFigure(value, unit)
    if (money !== null) return money
    if (classifyUnit(unit).kind === 'percent') {
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
   * Action label — the title-case verb phrase naming the FIELD that moved,
   * e.g. "Updated factor value", "Added constraint", "Adjusted connection
   * strength". Safe to show as a heading.
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
        | { label?: unknown; node_id?: unknown; value?: unknown; unit?: unknown; operator?: unknown; value_frame?: unknown }
        | null
      const before = block.before as
        | { value?: unknown; unit?: unknown; operator?: unknown; value_frame?: unknown }
        | null
      const labelRaw = typeof after?.label === 'string' ? after.label : ''
      const carriedLabel = labelRaw && !RAW_ID_PATTERN.test(labelRaw) ? labelRaw : ''
      // ⛔ PR Review 5881464028 blocking 2 + DL 5881499189: beside a CHANGE, or an unread frame, a carried label that
      // states a numeric level ("Cloud cost <= 0.1") is a second, false statement of the limit. The subject becomes
      // the constrained node's own name, or nothing. An ordinary subject label, and any label on a level, stay.
      const levelLabelBesideNonLevel = (): string => {
        if (!carriedLabel || !labelAlreadyStatesLimit(carriedLabel)) return carriedLabel
        const nodeName = typeof after?.node_id === 'string' ? deps.nodeLabels.get(after.node_id) : undefined
        return nodeName && !RAW_ID_PATTERN.test(nodeName) ? nodeName : ''
      }
      let entityLabel = carriedLabel
      const opRaw = typeof after?.operator === 'string' ? after.operator : ''
      const operatorPhrase = CONSTRAINT_OPERATOR_PHRASES[opRaw] ?? ''
      const valueStr = formatConstraintValue(
        after?.value,
        typeof after?.unit === 'string' ? after.unit : null,
      )
      let changeSummary = ''
      // ⛔ A frame the UI cannot read: the number's meaning is unknown, so the receipt states no bound at all rather
      // than a level (PR Review 5880865579). The applicator defers the same patch.
      const frameUnread = (side: { value_frame?: unknown } | null): boolean =>
        side !== null && side.value_frame !== undefined && !isKnownLimitFrame(side.value_frame)
      if (frameUnread(after)) return { actionLabel, entityLabel: levelLabelBesideNonLevel(), changeSummary, status }
      // ⭐ R1 S4-core (CEE #2261; PR Review 5880215622 blocking 2): a limit stated as a CHANGE from today is said as
      // the change ("no more than 10% above today"), by the same sayer as the cards — never "at most 0.1".
      const afterChange = saidLimitChange(after)
      if (afterChange !== null) {
        changeSummary = afterChange
        entityLabel = levelLabelBesideNonLevel()
      } else if (operatorPhrase && valueStr && valueStr !== '—') {
        changeSummary = `${operatorPhrase} ${valueStr}`.trim()
      } else if (valueStr && valueStr !== '—') {
        changeSummary = valueStr
      }
      // On an applied update (before existed), prefix the prior value — each side in its own frame.
      if (status === 'applied' && before && changeSummary && !frameUnread(before)) {
        const beforeChange = saidLimitChange(before)
        const beforeOpPhrase = CONSTRAINT_OPERATOR_PHRASES[
          typeof before.operator === 'string' ? before.operator : ''
        ] ?? ''
        const beforeValue = formatConstraintValue(
          before.value,
          typeof before.unit === 'string' ? before.unit : null,
        )
        const beforeStr = beforeChange ?? `${beforeOpPhrase} ${beforeValue}`.trim()
        if (beforeStr && beforeStr !== changeSummary && (beforeChange !== null || beforeValue !== '—')) {
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
