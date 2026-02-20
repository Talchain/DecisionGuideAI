/**
 * groupActionItems — groups fragile edges, evidence gaps, and optional M2 data
 * into prioritised action groups with deduplication.
 *
 * Groups (priority order — items appear in highest-priority group only):
 * 1. Validate before committing — from fragile edges
 * 2. Investigate — from evidence gaps (excluding exact dedup matches from Group 1)
 * 3. Worth reflecting on — from M2 bias findings (future)
 * 4. What could go wrong — from M2 pre-mortem (future)
 */

import type { UncertaintyItem, EvidenceGapItem } from '../types'
import type { ConstraintAnalysis } from '../../../types/constraints'
import { stripEncodingNotation } from './cleanFactorLabel'

// ─── Public types ────────────────────────────────────────────────────────────

export interface ActionItem {
  /** Dedup key: `from→to` for edges, `factorId` for evidence gaps */
  id: string
  /** Edge label or factor label */
  title: string
  /** Suggestion text or confidence note */
  subtitle?: string
  /** For GraphLink — node or edge ID */
  targetId?: string
  /** Target type for focus helper */
  targetType?: 'node' | 'edge'
  /** Confidence level for pill display */
  confidenceLevel?: 'low' | 'medium' | 'high'
  /** Coaching tag */
  source: 'model' | 'brief'
  // M2 enrichment fields (populated in Phase 5)
  whatCouldHappen?: string
  whatToDo?: string
}

export interface ActionGroup {
  /** Group key, e.g. 'validate', 'investigate', 'reflect', 'premortem' */
  key: string
  /** Display label */
  label: string
  /** Lucide icon name */
  icon: string
  /** Tailwind colour class for icon */
  iconColour: string
  /** Intro text below header (Groups 1 and 2 only) */
  intro?: string
  /** Items in this group */
  items: ActionItem[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract dedup key from an UncertaintyItem (fragile edge).
 * Uses affectedNodes as from→to if 2+ nodes present; falls back to first node.
 */
function edgeDedupKey(item: UncertaintyItem): string {
  const nodes = item.affectedNodes ?? []
  if (nodes.length >= 2) return `${nodes[0]}→${nodes[1]}`
  if (nodes.length === 1) return nodes[0]
  // Fallback: hash from message (shouldn't normally happen)
  return `msg:${item.message.slice(0, 40)}`
}

/** Extract a clean title from a fragile edge UncertaintyItem. */
function edgeTitle(item: UncertaintyItem): string {
  const edgeMatch = item.message.match(/[""\u201C]([^""\u201D]+)\s*→\s*([^""\u201D]+)[""\u201D]/)
  if (edgeMatch?.[1] && edgeMatch?.[2]) {
    return `${stripEncodingNotation(edgeMatch[1].trim())} → ${stripEncodingNotation(edgeMatch[2].trim())}`
  }
  return stripEncodingNotation(item.message)
}

/** Map factor confidence (0-1) to a level label. */
function confidenceToLevel(confidence: number | null | undefined): 'low' | 'medium' | 'high' | undefined {
  if (confidence == null) return undefined
  if (confidence < 0.5) return 'low'
  if (confidence < 0.7) return 'medium'
  return 'high'
}

// ─── Main function ───────────────────────────────────────────────────────────

export interface GroupActionItemsInput {
  /** Fragile edge uncertainties (code === 'SENSITIVE_ASSUMPTION') */
  fragileEdges: UncertaintyItem[]
  /** Evidence gaps from M1 coaching */
  evidenceGaps: EvidenceGapItem[]
  /** M2 bias findings (Phase 5) */
  biasFindings?: string[]
  /** M2 pre-mortem items (Phase 5) */
  preMortem?: string[]
  /** Multi-constraint analysis from winning option (for binding/near-miss items) */
  constraintAnalysis?: ConstraintAnalysis
  /** V11: Factor node IDs to exclude from action items (hinge shown in VOI block) */
  excludeFactorIds?: string[]
}

export function groupActionItems(input: GroupActionItemsInput): ActionGroup[] {
  const { fragileEdges, evidenceGaps, biasFindings, preMortem, constraintAnalysis, excludeFactorIds } = input

  // V11: Factors already shown in VOI block — exclude from action item lists
  const excludeSet = new Set(excludeFactorIds ?? [])

  // ── Group 1: Validate before committing ──────────────────────────────────
  // Build dedup keys from ALL fragile edges (including excluded) to prevent
  // the same factor appearing in Group 2 after being excluded from Group 1.
  const group1Keys = new Set<string>()
  const group1ItemsAll: ActionItem[] = fragileEdges.map(item => {
    const key = edgeDedupKey(item)
    group1Keys.add(key)
    return {
      id: key,
      title: edgeTitle(item),
      subtitle: item.threshold?.alternativeOption
        ? `${stripEncodingNotation(item.threshold.alternativeOption)} becomes the better choice`
        : undefined,
      targetId: item.affectedNodes?.[0],
      targetType: 'node' as const,
      confidenceLevel: confidenceToLevel(item.factorConfidence),
      source: 'model' as const,
    }
  })

  // V11: Filter out excluded factors from display (hinge shown in VOI block)
  const group1Items = excludeSet.size > 0
    ? group1ItemsAll.filter(item => !excludeSet.has(item.targetId ?? ''))
    : group1ItemsAll

  // Binding constraint → Group 1 ("Validate before committing")
  // When binding: true, this constraint is most likely to prevent meeting all targets.
  if (constraintAnalysis?.constraints) {
    for (const c of constraintAnalysis.constraints) {
      if (c.binding) {
        group1Items.push({
          id: `binding-${c.node_id}`,
          title: `${c.label} is the binding constraint`,
          subtitle: 'Most likely to prevent you from meeting all your targets.',
          targetId: c.node_id,
          targetType: 'node',
          source: 'model',
        })
      }
    }
  }

  // ── Group 2: Investigate ─────────────────────────────────────────────────
  // Exclude evidence gaps whose dedup key matches Group 1 OR excluded factors
  const group2Items: ActionItem[] = evidenceGaps
    .filter(gap => !group1Keys.has(gap.factorId) && !excludeSet.has(gap.factorId))
    .sort((a, b) => b.voi - a.voi)
    .map(gap => ({
      id: gap.factorId,
      title: stripEncodingNotation(gap.factorLabel),
      subtitle: gap.suggestion || undefined,
      targetId: gap.targetNodeId ?? gap.factorId ?? undefined,
      targetType: 'node' as const,
      confidenceLevel: confidenceToLevel(
        gap.confidence != null ? gap.confidence / 100 : undefined
      ),
      source: 'model' as const,
    }))

  // Near-miss constraints → Group 2 ("Investigate")
  // When near_miss_fraction > 0.3, many scenarios miss by a small margin.
  if (constraintAnalysis?.constraints) {
    for (const c of constraintAnalysis.constraints) {
      if (c.near_miss_fraction > 0.3) {
        group2Items.push({
          id: `near-miss-${c.node_id}`,
          title: `${c.label} is close to failing`,
          subtitle: `${Math.round(c.near_miss_fraction * 100)}% of scenarios miss by a small margin, worth validating your estimate.`,
          targetId: c.node_id,
          targetType: 'node',
          confidenceLevel: 'medium',
          source: 'model',
        })
      }
    }
  }

  // ── Group 3: Worth reflecting on (M2 only) ──────────────────────────────
  const group3Items: ActionItem[] = (biasFindings ?? []).map((finding, i) => ({
    id: `bias-${i}`,
    title: finding,
    source: 'brief' as const,
  }))

  // ── Group 4: What could go wrong (M2 only) ──────────────────────────────
  const group4Items: ActionItem[] = (preMortem ?? []).map((item, i) => ({
    id: `premortem-${i}`,
    title: item,
    source: 'brief' as const,
  }))

  return [
    {
      key: 'validate',
      label: 'Validate before committing',
      icon: 'AlertTriangle',
      iconColour: 'text-danger',
      intro: 'If any of these are wrong, the recommendation could change.',
      items: group1Items,
    },
    {
      key: 'investigate',
      label: 'Investigate',
      icon: 'Search',
      iconColour: 'text-info',
      intro: 'Low confidence, worth checking before you commit.',
      items: group2Items,
    },
    {
      key: 'reflect',
      label: 'Worth reflecting on',
      icon: 'EyeOff',
      iconColour: 'text-text-light',
      items: group3Items,
    },
    {
      key: 'premortem',
      label: 'What could go wrong',
      icon: 'Shield',
      iconColour: 'text-danger',
      items: group4Items,
    },
  ]
}
