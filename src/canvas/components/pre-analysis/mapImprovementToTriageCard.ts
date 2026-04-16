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
  /** Canonical signal_id from Signal Registry v3 §7 (optional — deferred population). */
  signal_id?: string
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

/** Parse "Source → Target" edge title into { source, target } labels */
function parseEdgeTitle(title: string): { source: string; target: string } | null {
  const parts = title.split(' → ')
  if (parts.length >= 2) return { source: parts[0].trim(), target: parts.slice(1).join(' → ').trim() }
  return null
}

/**
 * Derive contextual coaching subtitle from item metadata.
 *
 * Brief 4 Task 2: no character cap. ExpandableCoachingText in TriageCard
 * handles overflow via two-line clamp + expand toggle.
 */
function deriveSubtitle(item: ImprovementItem): string | undefined {
  // Edge / relationship items
  if (item.focus?.type === 'edge') {
    if (item.subgroup === 'contested') return 'Needs your judgement: estimates disagree'
    const parsed = parseEdgeTitle(item.label)
    if (parsed) {
      return `How strongly does ${parsed.source} affect ${parsed.target}?`
    }
    return 'Set whether this relationship is weak, moderate, or strong'
  }

  // Factor with no data (only when focus is a node — structural fix items like
  // "fewer than 2 options" don't have a focus target and shouldn't get this subtitle)
  if (item.detail === 'No observed data' || (item.category === 'fix' && item.focus?.type === 'node')) {
    return 'No data yet. Set a value to include in analysis.'
  }

  // Use CEE hint when available (richest contextual coaching)
  if (item.hint) {
    return item.hint
  }

  // Brief 4 Task 8: deterministic per-factor context when no CEE hint.
  // Priority: influence → EVPI → graph degree. All values trace to data
  // already in the envelope or the canvas graph — no fabrication.
  const ctx = item.sensitivityContext
  if (ctx) {
    if (typeof ctx.voi === 'number' && ctx.voi > 0.5) {
      return `Drives ${Math.round(ctx.voi * 100)}% of outcome variance`
    }
    if (typeof ctx.evpiPp === 'number' && ctx.evpiPp > 0.3) {
      const pp = Math.round(ctx.evpiPp * 10) / 10
      return `Resolving could improve confidence by ${pp}pp`
    }
    if (typeof ctx.downstreamDegree === 'number' && ctx.downstreamDegree > 0) {
      const suffix = ctx.downstreamDegree === 1 ? 'relationship' : 'relationships'
      return `Connects to ${ctx.downstreamDegree} downstream ${suffix}`
    }
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
    signal_id: item.signal_id,
    title: item.label,
    detail: item.detail,
    subtitle,
    category: item.category as TriageCardCategory,
    influence: influence ?? null,
    action,
    sourcePill,
  }
}
