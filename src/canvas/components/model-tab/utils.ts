/**
 * Shared utilities for the model-tab component suite.
 *
 * Polish 4 follow-up (review): all three shared unit sets — generic
 * placeholder units, single-char currency symbols, and ISO currency codes —
 * now come from labelUtils as a single source of truth. The earlier local
 * copies caused drift (the model-tab added BTC to ISO codes but labelUtils
 * didn't) and were a documented piece of tech debt. Audit comment at the
 * top of labelUtils.ts inventories every value-rendering surface.
 */

import type { ObservedState } from './types'
import { factorIsConfirmable } from '../../domain/valueProvenance'
import { classifyValueProvenance, type ValueProvenanceKind } from '../../domain/valueProvenance'
import type { EdgeDirectionDisplay } from '../../domain/edgeValueProvenance'
import { selectDriverDisplayModel, extractPolicyRow } from '../../../components/results/driverDisplayModel'
import {
  GENERIC_PLACEHOLDER_UNITS,
  CURRENCY_SYMBOLS,
  ISO_CURRENCY_CODES,
} from '../../utils/labelUtils'

// ── Value formatting ──────────────────────────────────────────────────────────

/** Returns true for currency units (symbol or ISO code). */
export function isCurrencyUnit(unit: string): boolean {
  const trimmed = unit.trim()
  return CURRENCY_SYMBOLS.has(trimmed) || ISO_CURRENCY_CODES.has(trimmed)
}

// `isGenericUnit` was REMOVED by the 16 Aug 2026 mount train (design §7.5):
// no production importer — `formatValueWithUnit` below consults
// GENERIC_PLACEHOLDER_UNITS directly. Contrast control at removal time:
// `formatValueWithUnit` resolves to 18 importing files.

/** Smart number: integers stay integer, decimals use minimal precision (max 2dp, no trailing zeros) */
export function formatSmartNumber(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString('en-GB')
  if (Math.abs(n) < 1) {
    const fixed = n.toFixed(2)
    return fixed.replace(/\.?0+$/, '')
  }
  return n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

/** Format value+unit: currency symbols prefix ("£49"), ISO currency codes prefix ("USD 49"), everything else suffixes ("9 months", "0 FTE") */
export function formatValueWithUnit(rawValue: number, unit: string): string {
  const trimmedUnit = unit.trim()
  if (CURRENCY_SYMBOLS.has(trimmedUnit)) {
    return `${trimmedUnit}${formatSmartNumber(rawValue)}`
  }
  if (ISO_CURRENCY_CODES.has(trimmedUnit)) {
    return `${trimmedUnit} ${formatSmartNumber(rawValue)}`
  }
  // Generic placeholder units (scale, index, score, …) — drop the suffix.
  // Single source of truth lives in labelUtils.GENERIC_PLACEHOLDER_UNITS.
  if (GENERIC_PLACEHOLDER_UNITS.has(trimmedUnit.toLowerCase())) {
    return formatSmartNumber(rawValue)
  }
  return `${formatSmartNumber(rawValue)} ${trimmedUnit}`
}

/** Derive primary human-readable value from observed state */
export function getPrimaryValue(obs: ObservedState): string | null {
  if (obs.raw_value !== undefined && obs.unit) {
    return formatValueWithUnit(obs.raw_value, obs.unit)
  }
  if (obs.raw_value !== undefined) {
    return formatSmartNumber(obs.raw_value)
  }
  return null
}

// ── Source mapping ────────────────────────────────────────────────────────────

/**
 * ROADMAP 2.638 S2 — keyed on the canonical CLASS, not on three literals.
 *
 * The old map listed `brief_extraction`, `cee_inference` and `user` only, and
 * its `?? source` fallback then rendered the RAW WIRE LITERAL to the user:
 * `mapSourceToDisplay('user_confirmed')` returned the string
 * `"user_confirmed"`. This feeds the Model tab's copy-to-clipboard text, so the
 * leak left the estate in what a user pastes into a document.
 *
 * TOTAL over `ValueProvenanceKind` — a new kind is a type error, not a silent
 * pass-through (trap 12).
 */
const KIND_LABELS: Record<ValueProvenanceKind, string> = {
  brief: 'From brief',
  ai: 'AI estimate',
  confirmed: 'Confirmed by you',
  edited: 'User edited',
  assumption: 'Your assumption',
  human: 'Set by you',
  // 0.40.0 — see SourceProvenancePill: no name on a persistent surface.
  panel: 'From your panel',
}

export function mapSourceToDisplay(source: string | undefined): string | null {
  if (!source) return null
  const cls = classifyValueProvenance(source)
  return cls ? KIND_LABELS[cls.kind] : source
}

// `mapSourceToTooltip` was REMOVED by the 16 Aug 2026 mount train (design
// §7.5): no importer anywhere in `src/`, its own declaration aside.

// ── Factor verification ─────────────────────────────────────────────────────

/**
 * Count factors the user can actually verify — what every "N to verify" surface
 * renders (`StatusBar`, `WorkspaceShellTabStrip`, `ModelHealthSection`,
 * `FactorsSection`'s accordion label, and the v2 attention chip).
 *
 * ⚠ IT IS `factorIsConfirmable`, NOT `factorNeedsVerification` (narrowed 19 Aug
 * 2026). The bare predicate counted factors with NO VALUE AT ALL — nothing to
 * confirm, an enabled Confirm the authority declines, and a number the user
 * could never drive to zero. The count and the affordance are now the same
 * question asked once, and that question is the write authority's own condition.
 *
 * ⚠ THE PREDICATE MOVED OUT (18 Aug 2026) and this function holds no copy of it.
 * It lived here inline while a second, deliberate port lived in
 * `model-tab-v2/adapters.ts` — the estate's own documented mirror, pinned by a
 * corpus that could only prove the two AGREED.
 */
export function countFactorsToVerify(factorNodes: ReadonlyArray<{ data: unknown }>): number {
  return factorNodes.filter(n => factorIsConfirmable(n.data)).length
}

// ── Strength semantic labels ──────────────────────────────────────────────────
// Re-export from strengthBands.ts (canonical thresholds from validation_ui_data_contract_v1.1).
export { getDirectionalStrengthLabel as strengthSemanticLabel } from './strengthBands'

// ── Direction-gated display helpers (ROADMAP 2.263) ──────────────────────────
//
// The COLOUR and the LEADING SIGN are direction claims that carry no words, and
// they leaked the same fabrication the label did: `signedMean >= 0` painted an
// undirected edge green and printed `+0.30`, because `resolveEdgeSignedStrength
// Display` hands back `+|weight|` when nothing states a direction. Both now ask
// the resolver, so an unstated direction reads as a plain neutral magnitude.

/**
 * Tone class for a direction claim. Neutral unless the direction is STATED —
 * green/red are verdicts and an unstated direction has no verdict to report.
 */
export function directionToneClass(direction: EdgeDirectionDisplay): string {
  if (!direction.show) return 'text-text-light'
  return direction.direction === 'negative' ? 'text-danger' : 'text-success'
}

/**
 * A signed scalar rendered only as signed as the evidence allows.
 *
 * Stated direction → the sign is meaningful, so `+0.30` / `-0.30`.
 * Unstated        → print the MAGNITUDE with no sign at all. A bare `+` is a
 *                   claim, and `-` would be a different one; the honest render
 *                   of "we have a size but not a direction" is the size.
 */
export function signedScalarText(
  value: number,
  direction: EdgeDirectionDisplay,
  digits: number,
): string {
  if (!direction.show) return Math.abs(value).toFixed(digits)
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`
}

// ── Factor influence (model-tab factor cards) ───────────────────────────────

/**
 * Derive a factor_id → influence score map for the model-tab "factor cards
 * sorted by influence" (FactorsSection) — THROUGH the shared display policy.
 *
 * Lane 2 (Codex R3-B1 class): this function previously adopted the producer
 * `influence_score` PER-FACTOR with elasticity-flavoured fallbacks — under
 * partial producer coverage that mixes two incomparable bases in one
 * ranking, and the model-tab card could contradict the graph badge for the
 * SAME node (useNodeDisplayMetadata already ranks via selectDriverDisplayModel).
 * Now both feed the one policy: producer influence_score is adopted only
 * when EVERY factor carries it (complete-metric-set); otherwise every factor
 * falls back to per-set normalised |elasticity|.
 *
 * ROADMAP 1.7 note (superseded in the partial case, honoured in the complete
 * case): a pinned/intervention-overridden factor carries sensitivity 0 while
 * being the model's most influential — with COMPLETE producer coverage (the
 * normal staging path) its influence_score still wins, values unchanged.
 * Under PARTIAL coverage the policy's no-mixed-basis rule wins, matching the
 * badge/panel/hero/tornado — the trade-off the repo accepted in PR #292/#301.
 *
 * Absence semantics preserved: never derived, never defaulted — a factor
 * row with NO finite metric at all is simply absent from the map.
 */
export function deriveFactorInfluenceMap(report: unknown): Map<string, number> | undefined {
  if (report == null || typeof report !== 'object') return undefined
  const r = report as Record<string, unknown>
  const enrichment = r.enrichment as Record<string, unknown> | undefined
  const sensitivityAnalysis = enrichment?.sensitivity_analysis as Record<string, unknown> | undefined
  // Source precedence matches the graph badge (useNodeDisplayMetadata):
  // certified factor_sensitivity FIRST, the untyped enrichment passthrough
  // as fallback (Lane 2 review fold — the two surfaces must rank the same
  // row-set for the same node).
  const factors = (r.factor_sensitivity as unknown[] | undefined) ??
    (sensitivityAnalysis?.factors as unknown[] | undefined) ??
    []
  if (!Array.isArray(factors) || factors.length === 0) return undefined

  // Rows come from the SHARED extractor (panel-parity field semantics) so
  // the coverage-complete verdict cannot skew per surface.
  const rows = factors
    .map((raw) => extractPolicyRow(raw))
    .filter((row): row is NonNullable<ReturnType<typeof extractPolicyRow>> => row != null)
  if (rows.length === 0) return undefined

  const displayModel = selectDriverDisplayModel(rows)
  const map = new Map<string, number>()
  for (const row of rows) {
    const entry = displayModel.get(row.key)
    if (entry) map.set(row.key, entry.value)
  }
  return map.size > 0 ? map : undefined
}

/**
 * Will the MOUNTED Model row actually DISPLAY a value for this factor?
 *
 * ⚠ THIS IS NOT `factorHasConfirmableValue`, AND CONFLATING THEM SHIPPED A FALSE
 * PROMISE. That predicate answers "may the authority stamp a confirmation?" and
 * reads `observedState.value` (MODEL scale). This one answers "will the user SEE
 * a value when they arrive?" and goes through `getPrimaryValue`, which reads only
 * `raw_value` (USER-UNIT). The two diverge on a real, staging-witnessed class:
 * a capped factor stores `{value: 0.7}` with NO `raw_value`, so the authority
 * accepts it and the row shows nothing.
 *
 * ⚠ NEITHER FIELD ALONE IS A GATE. `valueProvenance.ts` warns that gating on
 * `raw_value` "refuses a whole class of factors the authority would have
 * accepted — an UNDER-count, the exact mirror of the over-count". That warning is
 * correct, which is why this predicate does NOT gate anything: it only chooses
 * between the "review" and "set" wordings. Nothing is hidden on its account.
 *
 * Composed from `getPrimaryValue` itself rather than restating its rule, so it
 * cannot drift from what the row renders. The narrowing mirrors
 * `model-tab-v2/adapters.ts` `narrowObservedState` for exactly the two fields
 * `getPrimaryValue` reads; `__tests__/factorDisplaysValue.spec.ts` pins the two
 * against a shared corpus so a change to either REDs.
 */
export function factorDisplaysValue(data: unknown): boolean {
  const d = data as Record<string, unknown> | undefined
  const obs = (d?.observedState ?? d?.observed_state) as Record<string, unknown> | undefined
  if (!obs) return false
  const raw = obs.raw_value
  const unit = obs.unit
  return (
    getPrimaryValue({
      raw_value: typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined,
      unit: typeof unit === 'string' ? unit : undefined,
    }) !== null
  )
}
