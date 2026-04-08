/**
 * mapImprovementToTriageCard — Pure mapper from ImprovementItem to TriageCard props.
 *
 * Converts pre-analysis improvement items into the shape expected by the shared
 * TriageCard component. ImprovementCategory matches TriageCardCategory 1:1 for
 * 'fix', 'verify', 'add_evidence', 'strengthen'.
 */

import type { ImprovementItem } from './hooks/usePreAnalysisData'
import type { TriageCardCategory, TriageCardAction } from '@/components/shared/TriageCard'
import { isCurrencyUnit } from '@/canvas/utils/labelUtils'

export interface TriageCardItem {
  key: string
  title: string
  detail: string
  /** One-line action-oriented subtitle shown below the title */
  subtitle: string | undefined
  category: TriageCardCategory
  influence: number | null
  action: TriageCardAction | undefined
  sourcePill: { label: string; borderClass: string } | null
}

/** Qualitative label for 0–1 scale values (inclusive boundaries) */
function qualitativeLabel(v: number): string {
  if (v <= 0.2) return 'very low'
  if (v <= 0.4) return 'low'
  if (v <= 0.6) return 'moderate'
  if (v <= 0.8) return 'high'
  return 'very high'
}

/** Locale-aware number formatter with thousand separators for values > 999 */
const NUMBER_FMT = new Intl.NumberFormat('en-GB')
function formatNumber(n: number): string {
  if (Math.abs(n) >= 1000) return NUMBER_FMT.format(n)
  // Preserve decimal precision for small values, drop trailing zeros
  return Number.isInteger(n) ? String(n) : String(n)
}

/**
 * Format a raw value with its unit for display.
 *
 * Rules (from design brief):
 * - Currency symbols prefix the number: £5,000 not 5000 £
 * - Percentage suffix: 4.5% not % 4.5
 * - Time/generic units suffix with a space: 3 months, 500 users
 * - Numbers > 999 get thousand separators via Intl.NumberFormat
 * - Empty/"scale" unit + 0–1 value falls back to qualitative label
 */
function formatValueWithUnit(rawValue: number, unit: string | undefined | null): string {
  if ((!unit || unit === 'scale') && rawValue >= 0 && rawValue <= 1) {
    return qualitativeLabel(rawValue)
  }
  if (!unit) return formatNumber(rawValue)
  if (isCurrencyUnit(unit)) return `${unit}${formatNumber(rawValue)}`
  if (unit === '%') return `${formatNumber(rawValue)}%`
  return `${formatNumber(rawValue)} ${unit}`
}

/** Map ImprovementActionKind → TriageCardAction.kind */
function mapActionKind(kind: string): TriageCardAction['kind'] {
  switch (kind) {
    case 'confirm': return 'confirm'
    case 'edit': return 'edit'
    case 'assumption': return 'confirm'
    default: return 'edit'
  }
}

/** Parse "Source → Target" edge title into { source, target } labels */
function parseEdgeTitle(title: string): { source: string; target: string } | null {
  const parts = title.split(' → ')
  if (parts.length >= 2) return { source: parts[0].trim(), target: parts.slice(1).join(' → ').trim() }
  return null
}

/** Cap subtitle length to keep cards single-line and avoid ellipsis truncation. */
const MAX_SUBTITLE_LEN = 60

function trimSubtitle(s: string): string {
  return s.length <= MAX_SUBTITLE_LEN ? s : s.slice(0, MAX_SUBTITLE_LEN - 1).trimEnd()
}

/** Derive contextual coaching subtitle from item metadata */
function deriveSubtitle(item: ImprovementItem): string | undefined {
  // Edge / relationship items
  if (item.focus?.type === 'edge') {
    if (item.subgroup === 'contested') return 'Needs your judgement: estimates disagree'
    const parsed = parseEdgeTitle(item.label)
    if (parsed) {
      // If source has a value context, reference it
      if (item.rawValue != null) {
        return trimSubtitle(`How strongly does ${parsed.source} (${formatValueWithUnit(item.rawValue, item.unit)}) affect ${parsed.target}?`)
      }
      // No source value yet — coaching that fits in 60 chars regardless of label length
      return 'No data yet. Set a value to include in analysis.'
    }
    return 'Set whether this relationship is weak, moderate, or strong'
  }

  // Factor with no data (only when focus is a node — structural fix items like
  // "fewer than 2 options" don't have a focus target and shouldn't get this subtitle)
  if (item.detail === 'No observed data' || (item.category === 'fix' && item.focus?.type === 'node')) {
    return 'No data yet. Set a value to include in analysis.'
  }

  // Use CEE suggestion when available (most contextual coaching)
  if (item.hint) {
    return trimSubtitle(item.hint)
  }

  // AI-estimated factor
  if (item.sourceBadge === 'ai') {
    return 'AI estimate. Does this match?'
  }

  // Brief-sourced factor
  if (item.sourceBadge === 'brief') {
    return 'From your brief. Does this look right?'
  }

  return undefined
}

export function mapImprovementToTriageCard(
  item: ImprovementItem,
  influence: number | undefined,
): TriageCardItem {
  const action: TriageCardAction | undefined = item.action
    ? {
        kind: mapActionKind(item.action.kind),
        label: item.action.label,
        targetId: item.action.targetId,
        targetType: item.action.targetType,
      }
    : undefined

  // Source pill: AI estimate, From brief, or No data (for fix items without a source badge)
  const sourcePill = item.sourceBadge === 'ai'
    ? { label: 'AI estimate', borderClass: 'border-info/30' }
    : item.sourceBadge === 'brief'
      ? { label: 'From brief', borderClass: 'border-success/30' }
      : (item.category === 'fix' || item.detail === 'No observed data' || item.detail === 'No evidence')
        ? { label: 'No data', borderClass: 'border-danger/30' }
        : null

  // Subtitle: action-oriented one-liner explaining what to do
  const subtitle = deriveSubtitle(item)

  return {
    key: item.key,
    title: item.label,
    detail: item.detail,
    subtitle,
    category: item.category as TriageCardCategory,
    influence: influence ?? null,
    action,
    sourcePill,
  }
}
