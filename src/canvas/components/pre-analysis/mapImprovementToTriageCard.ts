/**
 * mapImprovementToTriageCard — Pure mapper from ImprovementItem to TriageCard props.
 *
 * Converts pre-analysis improvement items into the shape expected by the shared
 * TriageCard component. ImprovementCategory matches TriageCardCategory 1:1 for
 * 'fix', 'verify', 'add_evidence', 'strengthen'.
 */

import type { ImprovementItem } from './hooks/usePreAnalysisData'
import type { TriageCardCategory, TriageCardAction } from '@/components/shared/TriageCard'
import { resolveTriageBodyText } from '@/components/shared/resolveTriageBodyText'
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
 * Structural / category-specific body text that is not "coaching" per se —
 * edge relationship prompts, no-data placeholders — always take precedence
 * over coaching because they describe the item's nature.
 */
function deriveStructuralContext(item: ImprovementItem): string | undefined {
  if (item.focus?.type === 'edge') {
    if (item.subgroup === 'contested') return 'Needs your judgement: estimates disagree'
    const parsed = parseEdgeTitle(item.label)
    if (parsed) return `How strongly does ${parsed.source} affect ${parsed.target}?`
    return 'Set whether this relationship is weak, moderate, or strong'
  }
  if (item.detail === 'No observed data' || (item.category === 'fix' && item.focus?.type === 'node')) {
    return 'No data yet. Set a value to include in analysis.'
  }
  return undefined
}

/**
 * Deterministic sensitivity-context subtitle — used only when CEE has no
 * richer coaching string. Priority: influence → EVPI → graph degree. Every
 * value traces to data already in the envelope or the canvas graph.
 */
function deriveSensitivityContext(item: ImprovementItem): string | undefined {
  const ctx = item.sensitivityContext
  if (!ctx) return undefined
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
  return undefined
}

/**
 * Brief 4 Task 2 + P0 #3 remediation: resolve the single body string via
 * resolveTriageBodyText so pre-analysis and post-analysis cards share the
 * same precedence rule (coaching → derived context → generic).
 *
 * Structural context (edge prompts, No data placeholders) still short-circuits
 * before coaching, because it describes the item's nature rather than
 * coaching about it.
 */
function deriveSubtitle(item: ImprovementItem): string | undefined {
  // TODO(pre-analysis-power-v2): per-card "why this matters" structural-impact line — deferred for tier B brief pending payload field
  const structural = deriveStructuralContext(item)
  if (structural) return structural
  const { text } = resolveTriageBodyText({
    coaching: item.hint,
    context: deriveSensitivityContext(item),
  })
  return text.length > 0 ? text : undefined
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

  // Source pill — pre-analysis-power-v1 brief Task 4 (partial):
  //   'ai'    → "Olumi's estimate" (renamed from "AI estimate")
  //   'brief' → "From brief" (unchanged)
  //   absent + no-value-state + edge → "Needs judgement"
  //   absent + no-value-state + node → "Needs value"
  // TODO(pre-analysis-power-v2): "External assumption" badge variant — deferred for tier B brief pending payload field
  const isNoValueState =
    item.category === 'fix' || item.detail === 'No observed data' || item.detail === 'No evidence'
  const sourcePill = item.sourceBadge === 'ai'
    ? { label: "Olumi's estimate", borderClass: 'border-info/30' }
    : item.sourceBadge === 'brief'
      ? { label: 'From brief', borderClass: 'border-success/30' }
      : isNoValueState
        ? item.focus?.type === 'edge'
          ? { label: 'Needs judgement', borderClass: 'border-warning/30' }
          : { label: 'Needs value', borderClass: 'border-warning/30' }
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
