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

  const sourcePill = item.sourceBadge === 'ai'
    ? { label: 'AI estimate', borderClass: 'border-info/30' }
    : item.sourceBadge === 'brief'
      ? { label: 'From brief', borderClass: 'border-success/30' }
      : null

  return {
    key: item.key,
    title: item.label,
    detail: item.detail,
    category: item.category as TriageCardCategory,
    influence: influence ?? null,
    action,
    sourcePill,
  }
}
