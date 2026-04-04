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

/** Qualitative label for 0–1 scale values */
function qualitativeLabel(v: number): string {
  if (v <= 0.2) return 'very low'
  if (v <= 0.4) return 'low'
  if (v <= 0.6) return 'moderate'
  if (v <= 0.8) return 'high'
  return 'very high'
}

/** Format a raw value with its unit for display */
function formatValueWithUnit(rawValue: number, unit: string | undefined): string {
  if ((!unit || unit === 'scale') && rawValue >= 0 && rawValue <= 1) {
    return qualitativeLabel(rawValue)
  }
  if (!unit) return String(rawValue)
  if (isCurrencyUnit(unit)) return `${unit}${rawValue.toLocaleString()}`
  if (unit === '%') return `${rawValue}%`
  return `${rawValue} ${unit}`
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

/** Derive contextual coaching subtitle from item metadata */
function deriveSubtitle(item: ImprovementItem): string | undefined {
  // Edge / relationship items
  if (item.focus?.type === 'edge') {
    if (item.subgroup === 'contested') return 'Needs your judgement: estimates disagree'
    const parsed = parseEdgeTitle(item.label)
    if (parsed) {
      // If source has a value context, reference it
      if (item.rawValue != null) {
        return `How strongly does ${parsed.source} (currently ${formatValueWithUnit(item.rawValue, item.unit)}) affect ${parsed.target}?`
      }
      return `Set ${parsed.source}'s value first, then calibrate this`
    }
    return 'Set whether this relationship is weak, moderate, or strong'
  }

  // Factor with no data (only when focus is a node — structural fix items like
  // "fewer than 2 options" don't have a focus target and shouldn't get this subtitle)
  if (item.detail === 'No observed data' || (item.category === 'fix' && item.focus?.type === 'node')) {
    return 'No value set. Even a rough estimate helps.'
  }

  // Use CEE suggestion when available (most contextual coaching)
  if (item.hint) {
    return item.hint
  }

  // AI-estimated factor
  if (item.sourceBadge === 'ai') {
    if (item.rawValue != null) {
      return `Olumi estimated this as ${formatValueWithUnit(item.rawValue, item.unit)}. Does that match your expectation?`
    }
    return 'Olumi estimated this value. Edit in the inspector to set your own.'
  }

  // Brief-sourced factor
  if (item.sourceBadge === 'brief') {
    return 'You provided this in your brief. Confirm or adjust.'
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
