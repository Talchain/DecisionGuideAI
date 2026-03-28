/**
 * mapImprovementToTriageCard — Pure mapper from ImprovementItem to TriageCard props.
 *
 * Converts pre-analysis improvement items into the shape expected by the shared
 * TriageCard component. ImprovementCategory matches TriageCardCategory 1:1 for
 * 'fix', 'verify', 'add_evidence', 'strengthen'.
 */

import type { ImprovementItem } from './hooks/usePreAnalysisData'
import type { TriageCardCategory, TriageCardAction } from '@/components/shared/TriageCard'

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

/** Map ImprovementActionKind → TriageCardAction.kind */
function mapActionKind(kind: string): TriageCardAction['kind'] {
  switch (kind) {
    case 'confirm': return 'confirm'
    case 'edit': return 'edit'
    case 'assumption': return 'confirm'
    default: return 'edit'
  }
}

/** Derive action-oriented subtitle from item metadata */
function deriveSubtitle(item: ImprovementItem): string | undefined {
  // Edge items: calibrate or verify the relationship
  if (item.focus?.type === 'edge') {
    if (item.subgroup === 'contested') return 'Needs your judgement: estimates disagree'
    if (item.sourceBadge === 'ai') return 'Confirm whether this relationship is real'
    return 'Set whether this link is weak, moderate, or strong'
  }

  // Factor with no data (only when focus is a node — structural fix items like
  // "fewer than 2 options" don't have a focus target and shouldn't get this subtitle)
  if (item.detail === 'No observed data' || (item.category === 'fix' && item.focus?.type === 'node')) {
    return 'No value set. Even a rough estimate helps.'
  }

  // AI-estimated factor with a current value
  if (item.sourceBadge === 'ai') {
    if (item.rawValue != null) {
      const display = item.unit ? `${item.rawValue} ${item.unit}` : String(item.rawValue)
      return `Current: ${display}. Confirm or edit.`
    }
    return 'Confirm or edit the AI estimate'
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
