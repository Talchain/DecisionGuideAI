/**
 * mapImprovementToTriageCard — Pure mapper from ImprovementItem to TriageCard props.
 *
 * Converts pre-analysis improvement items into the shape expected by the shared
 * TriageCard component. ImprovementCategory matches TriageCardCategory 1:1 for
 * 'fix', 'verify', 'add_evidence', 'strengthen'.
 */

import type { ImprovementItem } from './hooks/usePreAnalysisData'
import type { TriageCardCategory, TriageCardAction } from '@/components/shared/TriageCard'
import { formatValueWithUnit } from '@/canvas/utils/formatValueWithUnit'

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

// formatValueWithUnit is imported from @/canvas/utils/formatValueWithUnit (shared utility, unified spec §2.4).

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
      // P0-1: previously rendered "How strongly does {source} ({rawValue} {unit})
      // affect {target}?" — but ImprovementItem.rawValue belongs to the *target*
      // factor of the verify item, not the source referenced in the question.
      // The parenthetical was showing the wrong factor's value. Drop it entirely
      // rather than reach into the canvas store from a pure mapper.
      return trimSubtitle(`How strongly does ${parsed.source} affect ${parsed.target}?`)
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
