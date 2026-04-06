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
import { stripEncodingNotation, sanitizeCoachingText } from './cleanFactorLabel'

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
  /** V14.1: VOI-derived action label ("Check first" / "Check next") */
  voiLevel?: string | null
  // M2 enrichment fields (populated in Phase 5)
  whatCouldHappen?: string
  whatToDo?: string
  /** V12 B4: Node IDs for graph links (from M2 bias finding affected_elements) */
  affectedNodeIds?: string[]
  /** ISL EVPI: expected improvement in percentage points (gated on presence) */
  evpiPp?: number
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

/** Internal-string blocklist — titles matching these patterns are replaced with safe fallback. */
const INTERNAL_PATTERN = /constraint_|observed_state|intercept=|node_id=|edge_id=|fac_[a-z_]+_/i

/** Extract a clean title from a fragile edge UncertaintyItem.
 *  V12.1 Fix 4: Uses from_label only (factor name), not the full edge path.
 *  V12.1 Fix 1: Guards against internal field names leaking. */
function edgeTitle(item: UncertaintyItem): string {
  const edgeMatch = item.message.match(/[""\u201C]([^""\u201D]+)\s*\u2192\s*([^""\u201D]+)[""\u201D]/)
  if (edgeMatch?.[1]) {
    const fromLabel = stripEncodingNotation(edgeMatch[1].trim())
    if (INTERNAL_PATTERN.test(fromLabel)) return 'Check and update this factor'
    return fromLabel
  }
  const cleaned = stripEncodingNotation(item.message)
  if (INTERNAL_PATTERN.test(cleaned)) return 'Check and update this factor'
  return cleaned
}

/** Map factor confidence (0-1) to a level label. */
function confidenceToLevel(confidence: number | null | undefined): 'low' | 'medium' | 'high' | undefined {
  if (confidence == null) return undefined
  if (confidence < 0.5) return 'low'
  if (confidence < 0.7) return 'medium'
  return 'high'
}

/**
 * V14.2: Rank-based VOI labels. ISL VOI scores are relative (not normalised
 * to 0–1), so absolute thresholds don't work. Use rank instead:
 * - Rank 1 AND voi > 0 → "Check first"
 * - Rank 2–3 AND voi > 0 → "Check next"
 * - voi === 0 or rank > 3 → no pill
 *
 * @param voi - Raw VOI score from ISL
 * @param rank - 0-indexed position in VOI-descending sorted list
 */
function voiToLabel(voi: number | undefined | null, rank: number): string | null {
  if (voi == null || !Number.isFinite(voi) || voi <= 0) return null
  if (rank === 0) return 'Check first'
  if (rank <= 2) return 'Check next'
  return null
}

// ─── V14.3: Dual-verb filter for validation group ────────────────────────────

/** Implementation verbs that contradict the "Validate" group header */
const IMPLEMENTATION_VERB = /\b(proceed|implement|execute|roll out|launch|ship|deploy|go ahead)\b/i

/** Validation verbs that indicate the action IS validation-oriented */
const VALIDATION_VERB = /\b(validate|confirm|measure|benchmark|gather|test|check|review|verify|assess)\b/i

/**
 * Returns true if an action text is appropriate for "Validate before committing".
 * Actions with implementation verbs but no validation verbs are excluded.
 * e.g. "Proceed with X" → false, "Proceed to validate X" → true, "Gather data on X" → true.
 */
function isValidationAction(text: string): boolean {
  if (!IMPLEMENTATION_VERB.test(text)) return true
  return VALIDATION_VERB.test(text)
}

// ─── Main function ───────────────────────────────────────────────────────────

/** V12: M2 bias finding (real PLoT shape) */
export interface M2BiasFindingInput {
  type: string
  source: string
  description: string
  affectedElements: string[]
  linkedCritiqueCode: string
}

/** V12: M2 decision quality prompt (real PLoT shape) */
export interface M2DecisionQualityPromptInput {
  principle: string
  appliesBecause: string
  question: string
}

/** V12: M2 evidence enhancement per factor */
export interface M2EvidenceEnhancementInput {
  specific_action: string
  decision_hygiene: string
}

export interface GroupActionItemsInput {
  /** Fragile edge uncertainties (code === 'SENSITIVE_ASSUMPTION') */
  fragileEdges: UncertaintyItem[]
  /** Evidence gaps from M1 coaching */
  evidenceGaps: EvidenceGapItem[]
  /** M2 bias findings — structured from PLoT review */
  biasFindings?: string[] | M2BiasFindingInput[]
  /** M2 pre-mortem items — strings from assumptions or M2 decision quality prompts */
  preMortem?: string[] | M2DecisionQualityPromptInput[]
  /** Multi-constraint analysis from winning option (for binding/near-miss items) */
  constraintAnalysis?: ConstraintAnalysis
  /** V11: Factor node IDs to exclude from action items (hinge shown in VOI block) */
  excludeFactorIds?: string[]
  /** V12: M2 evidence enhancements keyed by factor_id — enriches Group 2 items */
  evidenceEnhancements?: Record<string, M2EvidenceEnhancementInput>
  /** V12: Next actions from M1 coaching — merged into Group 1 */
  nextActions?: Array<{
    action: string
    rationale: string
    priority: number
    targetType?: string
    targetId?: string
    targetLabel?: string
  }>
}

export function groupActionItems(input: GroupActionItemsInput): ActionGroup[] {
  const { fragileEdges, evidenceGaps, biasFindings, preMortem, constraintAnalysis, excludeFactorIds, evidenceEnhancements, nextActions } = input

  // V11: Factors already shown in VOI block — exclude from action item lists
  const excludeSet = new Set(excludeFactorIds ?? [])

  // ── Group 1: Validate before committing ──────────────────────────────────
  // Build dedup keys from ALL fragile edges (including excluded) to prevent
  // the same factor appearing in Group 2 after being excluded from Group 1.
  const group1Keys = new Set<string>()
  const group1ItemsAll: ActionItem[] = fragileEdges.map(item => {
    const key = edgeDedupKey(item)
    group1Keys.add(key)
    // Also add individual node IDs for cross-group dedup (next_actions, evidence gaps)
    for (const nodeId of item.affectedNodes ?? []) {
      group1Keys.add(nodeId)
    }
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

  // V12: Merge next_actions into Group 1 alongside fragile edges
  if (nextActions) {
    for (const action of nextActions) {
      const targetId = action.targetId ?? ''
      // Dedupe against existing Group 1 keys and excluded factors
      // Skip empty targetId for dedup checks — multiple targetless actions are valid
      if (targetId && (group1Keys.has(targetId) || excludeSet.has(targetId))) continue
      if (!isValidationAction(action.action)) continue // V14.3: Skip implementation actions
      if (targetId) group1Keys.add(targetId) // Prevent same factor appearing in Group 2
      group1Items.push({
        id: `next-${targetId || action.action.slice(0, 30)}`,
        title: action.action, // sanitized at data layer
        subtitle: action.rationale || undefined,
        targetId: targetId || undefined,
        targetType: 'node',
        source: 'model',
      })
    }
  }

  // ── Group 2: Investigate ─────────────────────────────────────────────────
  // Exclude evidence gaps whose dedup key matches Group 1 OR excluded factors
  const group2Items: ActionItem[] = evidenceGaps
    .filter(gap => !group1Keys.has(gap.factorId) && !excludeSet.has(gap.factorId))
    .sort((a, b) => {
      // Prefer evpi_percentage_points, then evpi (absolute), then VOI
      const aPp = (a as any).evpiPp as number | undefined
      const bPp = (b as any).evpiPp as number | undefined
      if (typeof aPp === 'number' && typeof bPp === 'number') return bPp - aPp
      const aEvpi = (a as any).evpi as number | undefined
      const bEvpi = (b as any).evpi as number | undefined
      if (typeof aEvpi === 'number' && typeof bEvpi === 'number') return bEvpi - aEvpi
      return b.voi - a.voi
    })
    .map((gap, voiRank) => {
      // V12: Enrich with M2 evidence enhancements when available
      const enhancement = evidenceEnhancements?.[gap.factorId]
      return {
        id: gap.factorId,
        title: stripEncodingNotation(gap.factorLabel),
        subtitle: gap.suggestion || undefined,
        targetId: gap.targetNodeId ?? gap.factorId ?? undefined,
        targetType: 'node' as const,
        confidenceLevel: confidenceToLevel(
          gap.confidence != null ? gap.confidence / 100 : undefined
        ),
        voiLevel: voiToLabel(gap.voi, voiRank),
        source: 'model' as const,
        whatCouldHappen: enhancement?.decision_hygiene,
        whatToDo: enhancement?.specific_action,
        evpiPp: typeof gap.evpiPp === 'number' ? gap.evpiPp : undefined,
      }
    })

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
  // V12: Handle both legacy string[] and structured M2BiasFindingInput[]
  const group3Items: ActionItem[] = (biasFindings ?? []).map((finding, i) => {
    if (typeof finding === 'string') {
      return { id: `bias-${i}`, title: sanitizeCoachingText(finding), source: 'brief' as const }
    }
    // Structured M2 bias finding — description sanitized at data layer
    return {
      id: `bias-${finding.type}-${i}`,
      title: finding.description,
      subtitle: finding.affectedElements.length > 0
        ? `Affects: ${finding.affectedElements.join(', ')}`
        : undefined,
      affectedNodeIds: finding.affectedElements.length > 0 ? finding.affectedElements : undefined,
      source: 'model' as const,
    }
  })

  // ── Group 4: What could go wrong (M2 only) ──────────────────────────────
  // V12: Handle both legacy string[] and structured M2DecisionQualityPromptInput[]
  const group4Items: ActionItem[] = (preMortem ?? []).map((item, i) => {
    if (typeof item === 'string') {
      return { id: `premortem-${i}`, title: sanitizeCoachingText(item), source: 'brief' as const }
    }
    // Structured M2 decision quality prompt — fields sanitized at data layer
    return {
      id: `dqp-${i}`,
      title: item.principle,
      subtitle: item.question,
      whatCouldHappen: item.appliesBecause,
      source: 'model' as const,
    }
  })

  return [
    {
      key: 'validate',
      label: 'Validate before committing',
      icon: 'AlertTriangle',
      iconColour: 'text-danger',
      intro: 'If any of these are wrong, the result could change.',
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
