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
 * sorted by influence" (FactorsSection). ROADMAP 1.7 (provisional_doctrine_v0):
 * `influence_score` (producer-owned, ISL/PLoT) is a DISTINCT measure from
 * sensitivity/elasticity — a pinned/intervention-overridden factor can carry
 * sensitivity 0 (options fix its value, so perturbing it moves nothing) while
 * still being the model's single most causally influential factor. Reading
 * elasticity/sensitivity_score/importance_score FIRST (the pre-fix
 * behaviour) rendered those factors' cards at 0%, the opposite of what the
 * producer said.
 *
 * Priority mirrors the doctrine already applied at
 * useNodeDisplayMetadata.ts / mapV5AnalysisToReport.ts / useResultsSectionData.ts:
 * influence_score (0-1, direct) before the legacy elasticity-flavoured
 * fallbacks. Additive read only — never derived, never defaulted; a factor
 * with no usable score is simply absent from the map.
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

  const map = new Map<string, number>()
  for (const raw of factors) {
    if (raw == null || typeof raw !== 'object') continue
    const f = raw as Record<string, unknown>
    const id = (f.factor_id ?? f.factorId ?? f.node_id ?? f.nodeId) as string | undefined
    const score = (f.influence_score ?? f.influenceScore ?? f.elasticity ?? f.sensitivity_score ?? f.importance_score) as
      | number
      | undefined
    if (id && typeof score === 'number' && Number.isFinite(score)) {
      map.set(id, score)
    }
  }
  return map.size > 0 ? map : undefined
}
