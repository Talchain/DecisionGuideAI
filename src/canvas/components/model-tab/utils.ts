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
import { selectDriverDisplayModel } from '../../../components/results/driverDisplayModel'
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

/** Returns true for units that represent abstract/dimensionless scales.
 *  Source of truth: GENERIC_PLACEHOLDER_UNITS in labelUtils.ts. */
export function isGenericUnit(unit: string): boolean {
  return GENERIC_PLACEHOLDER_UNITS.has(unit.trim().toLowerCase())
}

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

const SOURCE_LABELS: Record<string, string> = {
  brief_extraction: 'From brief',
  cee_inference: 'AI estimate',
  user: 'User edited',
}

const SOURCE_TOOLTIPS: Record<string, string> = {
  brief_extraction: 'Source: brief_extraction',
  cee_inference: 'Source: cee_inference',
  user: 'Source: user',
}

export function mapSourceToDisplay(source: string | undefined): string | null {
  if (!source) return null
  return SOURCE_LABELS[source] ?? source
}

export function mapSourceToTooltip(source: string | undefined): string | undefined {
  if (!source) return undefined
  return SOURCE_TOOLTIPS[source] ?? `Source: ${source}`
}

// ── Factor verification ─────────────────────────────────────────────────────

/** Count factors needing user verification (no source, or AI estimate). */
export function countFactorsToVerify(factorNodes: ReadonlyArray<{ data: unknown }>): number {
  return factorNodes.filter(n => {
    const data = n.data as Record<string, unknown> | undefined
    const obs = (data?.observedState ?? data?.observed_state) as Record<string, unknown> | undefined
    return !obs?.source || obs?.source === 'cee_inference'
  }).length
}

// ── Strength semantic labels ──────────────────────────────────────────────────
// Re-export from strengthBands.ts (canonical thresholds from validation_ui_data_contract_v1.1).
export { getStrengthLabel as strengthSemanticLabel } from './strengthBands'

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
  const factors = (sensitivityAnalysis?.factors as unknown[] | undefined) ??
    (r.factor_sensitivity as unknown[] | undefined) ??
    []
  if (!Array.isArray(factors) || factors.length === 0) return undefined

  const rows: Array<{ key: string; influenceScore?: number | null; rawElasticity: number }> = []
  for (const raw of factors) {
    if (raw == null || typeof raw !== 'object') continue
    const f = raw as Record<string, unknown>
    const id = (f.factor_id ?? f.factorId ?? f.node_id ?? f.nodeId) as string | undefined
    if (!id) continue
    const producer = (f.influence_score ?? f.influenceScore) as number | undefined
    const legacy = (f.elasticity ?? f.sensitivity_score ?? f.importance_score) as number | undefined
    const hasProducer = typeof producer === 'number' && Number.isFinite(producer)
    const hasLegacy = typeof legacy === 'number' && Number.isFinite(legacy)
    if (!hasProducer && !hasLegacy) continue // no usable metric — absent, never defaulted
    rows.push({
      key: id,
      influenceScore: hasProducer ? producer : null,
      rawElasticity: hasLegacy ? legacy : 0,
    })
  }
  if (rows.length === 0) return undefined

  const displayModel = selectDriverDisplayModel(rows)
  const map = new Map<string, number>()
  for (const row of rows) {
    const entry = displayModel.get(row.key)
    if (entry) map.set(row.key, entry.value)
  }
  return map.size > 0 ? map : undefined
}
