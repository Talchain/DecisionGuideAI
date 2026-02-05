/**
 * usePreAnalysisData - Pre-Analysis Panel Data Hook (M1)
 *
 * Single derivation point for all panel data from graph state.
 * Returns a typed object consumed by every panel section.
 *
 * Four Improvement Categories:
 * - Fix: Structural blockers (missing baseline, fewer than 2 options, disconnected nodes)
 * - Verify: Factors where source === 'cee_inference' (AI-estimated values)
 * - Add evidence: Edges with no evidence metadata
 * - Strengthen: Rule-based structural checks (few options, no constraints, no risks, no negative edges)
 *
 * M2 Merge Point:
 * Includes optional coaching parameter in hook signature. When undefined (M1),
 * returns rule-based data. M2 will pass CEE CoachingPayload here.
 */

import { useMemo } from 'react'
import { useCanvasStore } from '../../../store'
import { useShallow } from 'zustand/shallow'
import type { Node, Edge } from '@xyflow/react'
import type { BiasType } from '../primitives/BiasIcon'
// Import existing readiness hook for canonical canRun/hasBlockers logic
import { usePreAnalysisData as useExistingPreAnalysisData } from '../../../hooks/usePreAnalysisData'
// Import label cleaning utility to strip encoding patterns from factor labels
import { cleanFactorLabel } from '../../../../components/results/utils/cleanFactorLabel'

// ============================================================================
// Types
// ============================================================================

/** Improvement category per brief spec */
export type ImprovementCategory = 'fix' | 'verify' | 'add_evidence' | 'strengthen'

/** Action kind for improvement items */
export type ImprovementActionKind = 'confirm' | 'edit' | 'add' | 'assumption' | 'add_baseline' | 'add_option' | 'add_risk'

/** Single improvement item */
export interface ImprovementItem {
  /** Unique key for React rendering */
  key: string
  /** Category for grouping */
  category: ImprovementCategory
  /** Display label */
  label: string
  /** Detail/explanation text */
  detail: string
  /** Optional bias type for BiasIcon */
  bias?: BiasType
  /** Focus target for canvas navigation */
  focus?: {
    type: 'node' | 'edge'
    id: string
    label: string
  }
  /** Action button config */
  action?: {
    label: string
    kind: ImprovementActionKind
    /** Target node/edge ID for the action */
    targetId?: string
    /** Target type (node or edge) */
    targetType?: 'node' | 'edge'
  }
}

/** Evidence quality level */
export type EvidenceQualityLevel = 'high' | 'medium' | 'low'

/** Evidence quality result */
export interface EvidenceQuality {
  level: EvidenceQualityLevel
  ratio: number
}

/** Nodes grouped by kind */
export interface NodesByKind {
  goal: Node[]
  decision: Node[]
  option: Node[]
  factor: Node[]
  risk: Node[]
  outcome: Node[]
}

/** M2 Coaching payload placeholder */
export interface CoachingPayload {
  // M2: Will contain CEE coaching data
  // For now, this is a placeholder type
  headline?: string
  suggestions?: Array<{ label: string; detail: string }>
}

/** Tier type for three-tier hierarchy */
export type TierType = 'mustAddress' | 'reviewAssumptions' | 'optional'

/** Tier data structure */
export interface TierData {
  items: ImprovementItem[]
  count: number
}

/** Tiers grouped for panel rendering */
export interface TiersData {
  mustAddress: TierData
  reviewAssumptions: TierData
  optional: TierData
}

/** Hook return type */
export interface PreAnalysisData {
  /** Improvements grouped by category */
  improvementsByCategory: Record<ImprovementCategory, ImprovementItem[]>
  /** Improvements grouped by tier (three-tier hierarchy) */
  tiers: TiersData
  /** Total count of all improvements */
  totalImprovements: number
  /** Top 3 items, priority order: Fix > Verify > Add evidence > Strengthen */
  topActions: ImprovementItem[]
  /** Evidence quality assessment */
  evidenceQuality: EvidenceQuality
  /** Whether analysis can run (from analysis_ready.status) */
  isReady: boolean
  /** Whether there are any Fix items (blockers) */
  hasBlockers: boolean
  /** Count of blocker issues from canonical readiness logic */
  blockerCount: number
  /** Nodes grouped by kind for Model Snapshot */
  nodesByKind: NodesByKind
  /** Total edge count */
  edgeCount: number
  /** Currently selected goal node */
  goalNode: Node | null
  /** Success threshold value (auto-derived or user-set) */
  successThreshold: number | null
  /** Whether success threshold was auto-derived */
  isThresholdAutoDerived: boolean
  /** Whether success threshold is confirmed by user */
  isThresholdConfirmed: boolean
  /** Whether CEE data is still loading (ceeAnalysisReady is null but we have nodes) */
  isLoading: boolean
  /** Count of factors with user_confirmed or user_assumption source (reviewed) */
  reviewedFactorsCount: number
  /** Total count of factors with observed_state (reviewable) */
  totalReviewableFactorsCount: number
}

// ============================================================================
// Constants
// ============================================================================

// Category priority is implicit in iteration order: fix > verify > add_evidence > strengthen

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get node label with fallback
 */
function getNodeLabel(node: Node): string {
  return (node.data as { label?: string })?.label ?? node.id
}

/**
 * Check if a factor has AI-inferred source
 *
 * Canonical source types for observed_state.source (from CEE/adapters):
 * - 'ai' | 'cee_inference' | 'inferred' — AI-estimated values (need user verification)
 * - 'user' — User-confirmed values
 * - 'default' — Default/placeholder values
 *
 * Note: No enum exists in the codebase; ObservedState.source is typed as string.
 * See: src/adapters/cee/types.ts → ObservedState interface
 *
 * IMPORTANT: Evidence quality uses BLOCKLIST approach for AI sources.
 * Only EXPLICIT AI sources count as AI-inferred. Everything else is non-AI:
 * - AI sources (blocklist): 'ai', 'cee_inference', 'inferred'
 * - Non-AI sources: 'brief_extraction', 'user', 'user_confirmed', 'user_assumption', 'default', undefined
 */
function isAiInferred(node: Node): boolean {
  // Check both snake_case (observed_state) and camelCase (observedState) for compatibility
  // DraftChat stores as observedState, but tests and CEE response may use observed_state
  const data = node.data as { observed_state?: { source?: string }; observedState?: { source?: string }; source?: string }
  const observedState = data?.observed_state ?? data?.observedState
  const source = observedState?.source ?? data?.source
  return source === 'ai' || source === 'cee_inference' || source === 'inferred'
}

/**
 * AI sources blocklist for evidence quality calculation.
 *
 * A factor is "AI-inferred" if its source is in this blocklist.
 * Everything NOT in this blocklist is considered non-AI (user-provided),
 * including: 'brief_extraction', 'user', 'user_confirmed', 'user_assumption',
 * 'default', undefined, or any other value.
 *
 * This blocklist approach ensures we don't accidentally exclude valid
 * non-AI sources that may be added in the future.
 */
const AI_SOURCES = new Set(['ai', 'cee_inference', 'inferred'])

function isAiSource(node: Node): boolean {
  // Check both snake_case (observed_state) and camelCase (observedState) for compatibility
  const data = node.data as { observed_state?: { source?: string }; observedState?: { source?: string }; source?: string }
  const observedState = data?.observed_state ?? data?.observedState
  const source = observedState?.source ?? data?.source
  // Only explicit AI sources return true; undefined/unknown = NOT AI
  return source !== undefined && AI_SOURCES.has(source)
}

/**
 * Check if a factor has been reviewed by user (confirmed or marked as assumption)
 */
const REVIEWED_SOURCES = new Set(['user_confirmed', 'user_assumption'])

function isReviewedByUser(node: Node): boolean {
  const data = node.data as { observed_state?: { source?: string }; observedState?: { source?: string }; source?: string }
  const observedState = data?.observed_state ?? data?.observedState
  const source = observedState?.source ?? data?.source
  return source !== undefined && REVIEWED_SOURCES.has(source)
}

/**
 * Check if a factor has category === 'controllable'
 */
function isControllableFactor(node: Node): boolean {
  const data = node.data as { category?: string }
  const category = data?.category?.trim().toLowerCase()
  return category === 'controllable'
}

/**
 * Check if a factor is targeted by any option's intervention.
 * Options store interventions as Record<factorId, value>.
 */
function hasInterventionTargeting(factorId: string, optionNodes: Node[]): boolean {
  for (const option of optionNodes) {
    const interventions = (option.data as { interventions?: Record<string, unknown> })?.interventions
    if (interventions && Object.prototype.hasOwnProperty.call(interventions, factorId)) {
      return true
    }
  }
  return false
}

/**
 * Check if a factor needs user review (AI-estimated, not brief_extraction)
 *
 * Only factors with AI sources need review. brief_extraction is user-provided
 * via the brief, so it doesn't need additional review.
 *
 * Returns true if:
 * - Source is AI (ai, cee_inference, inferred) - needs review
 * - Source is user-reviewed (user_confirmed, user_assumption) - was AI, now reviewed
 */
function needsReview(node: Node): boolean {
  const data = node.data as { observed_state?: { source?: string }; observedState?: { source?: string }; source?: string }
  const observedState = data?.observed_state ?? data?.observedState
  const source = observedState?.source ?? data?.source
  if (!source) return false

  // AI sources that need review
  if (AI_SOURCES.has(source)) return true

  // User-reviewed sources (were AI, user took action)
  if (REVIEWED_SOURCES.has(source)) return true

  // brief_extraction, default, and other sources don't need review
  return false
}

/**
 * Get AI-estimated value from node, formatted with appropriate units
 *
 * @param node - The factor node
 * @param isBinary - Whether the factor is binary (0/1), from cleanFactorLabel qualifier
 */
function getAiEstimatedValue(node: Node, isBinary = false): string | null {
  // Check both snake_case (observed_state) and camelCase (observedState) for compatibility
  const data = node.data as {
    observed_state?: { value?: number; unit?: string }
    observedState?: { value?: number; unit?: string }
    value?: number
  }
  const observedState = data?.observed_state ?? data?.observedState
  const value = observedState?.value ?? data?.value
  if (value === undefined || value === null) return null
  if (typeof value !== 'number') return String(value)

  // Binary factors: display Yes/No instead of 0/1
  if (isBinary) {
    // Treat values close to 0 as "No", close to 1 as "Yes"
    // Values in between are rounded (>0.5 = Yes, <=0.5 = No)
    if (value <= 0.5) return 'No'
    return 'Yes'
  }

  // Format based on unit
  const unit = observedState?.unit
  if (unit === '%') {
    // Guard: if value > 1, assume it's already a percentage (e.g., 4 = 4%)
    // Otherwise treat as fractional (e.g., 0.04 = 4%)
    const percentValue = value > 1 ? Math.round(value) : Math.round(value * 100)
    return percentValue + '%'
  }
  if (unit === '£' || unit === '$') {
    // Round to whole numbers for cleaner display of AI estimates
    return unit + Math.round(value).toLocaleString()
  }
  // Default: display with reasonable precision
  return value.toFixed(1)
}

/**
 * Check if edge has evidence metadata
 */
function hasEvidence(edge: Edge): boolean {
  const data = edge.data as { evidence?: unknown; sources?: unknown[]; provenance?: string } | undefined
  if (!data) return false
  // Has evidence if: evidence field exists, sources array has items, or provenance is set
  if (data.evidence) return true
  if (Array.isArray(data.sources) && data.sources.length > 0) return true
  if (data.provenance && data.provenance !== 'unknown' && data.provenance !== 'default') return true
  return false
}

/**
 * Check if edge has negative strength
 */
function hasNegativeStrength(edge: Edge): boolean {
  const data = edge.data as { strength?: { mean?: number } } | undefined
  return (data?.strength?.mean ?? 0) < 0
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Pre-Analysis Panel data hook
 *
 * @param coaching - Optional M2 coaching payload (undefined in M1)
 */
export function usePreAnalysisData(_coaching?: CoachingPayload): PreAnalysisData {
  // M2 merge point: _coaching parameter will be used when CEE CoachingPayload is available
  // Store selectors
  const nodes = useCanvasStore(useShallow(s => s.nodes))
  const edges = useCanvasStore(useShallow(s => s.edges))
  const ceeAnalysisReady = useCanvasStore(s => s.ceeAnalysisReady)

  // Group nodes by kind
  const nodesByKind = useMemo<NodesByKind>(() => {
    const result: NodesByKind = {
      goal: [],
      decision: [],
      option: [],
      factor: [],
      risk: [],
      outcome: [],
    }

    for (const node of nodes) {
      const kind = node.type as keyof NodesByKind
      if (result[kind]) {
        result[kind].push(node)
      }
    }

    return result
  }, [nodes])

  // Goal node
  const goalNode = useMemo(() => {
    const goalId = ceeAnalysisReady?.goal_node_id
    if (goalId) {
      return nodes.find(n => n.id === goalId) ?? nodesByKind.goal[0] ?? null
    }
    return nodesByKind.goal[0] ?? null
  }, [nodes, ceeAnalysisReady?.goal_node_id, nodesByKind.goal])

  // Build improvements by category
  const improvementsByCategory = useMemo(() => {
    const result: Record<ImprovementCategory, ImprovementItem[]> = {
      fix: [],
      verify: [],
      add_evidence: [],
      strengthen: [],
    }

    // === FIX CATEGORY ===
    const optionNodes = [...nodesByKind.option, ...nodesByKind.decision]
    const hasBaseline = optionNodes.some(n => (n.data as { is_baseline?: boolean })?.is_baseline === true)

    // Fewer than 2 options
    if (optionNodes.length < 2) {
      result.fix.push({
        key: 'fewer_than_2_options',
        category: 'fix',
        label: 'Add options',
        detail: 'At least 2 required',
        bias: 'framing',
      })
    }

    // Missing goal
    if (nodesByKind.goal.length === 0) {
      result.fix.push({
        key: 'missing_goal',
        category: 'fix',
        label: 'Add goal',
        detail: 'Define what you want to achieve',
      })
    }

    // Disconnected nodes (nodes with no edges)
    const connectedNodeIds = new Set<string>()
    for (const edge of edges) {
      connectedNodeIds.add(edge.source)
      connectedNodeIds.add(edge.target)
    }
    const disconnectedNodes = nodes.filter(n => !connectedNodeIds.has(n.id) && n.type !== 'goal')
    for (const node of disconnectedNodes.slice(0, 3)) {
      result.fix.push({
        key: `disconnected_${node.id}`,
        category: 'fix',
        label: `Connect "${getNodeLabel(node)}"`,
        detail: 'Node has no relationships',
        focus: { type: 'node', id: node.id, label: getNodeLabel(node) },
      })
    }

    // === VERIFY CATEGORY ===
    // Factors with AI-inferred source, EXCLUDING controllable factors with interventions
    // (controllable factors with interventions are "choices the user will make", not assumptions to verify)
    // Phase 3.1: Use verification_prompts from CEE when available for better detail text
    const verificationPrompts = ceeAnalysisReady?.verification_prompts ?? {}
    for (const factor of nodesByKind.factor) {
      if (isAiInferred(factor)) {
        // Phase 2.5: Exclude controllable factors that have interventions targeting them
        // These are user choices, not assumptions that need verification
        if (isControllableFactor(factor) && hasInterventionTargeting(factor.id, optionNodes)) {
          continue
        }

        const rawLabel = getNodeLabel(factor)
        const { label: cleanedLabel, qualifier } = cleanFactorLabel(rawLabel)
        // Binary factors have "Yes/No" qualifier - use it for better value display
        const isBinary = qualifier === 'Yes/No' || qualifier === 'On/Off' || qualifier === 'True/False'
        const value = getAiEstimatedValue(factor, isBinary)
        // Phase 3.1: Prefer verification prompt from CEE over raw value
        const verificationPrompt = verificationPrompts[factor.id]
        result.verify.push({
          key: `verify_${factor.id}`,
          category: 'verify',
          label: cleanedLabel,
          detail: verificationPrompt || value || 'Value needed',
          bias: 'confidence',
          focus: { type: 'node', id: factor.id, label: cleanedLabel },
          action: { label: 'Confirm', kind: 'confirm', targetId: factor.id, targetType: 'node' },
        })
      }
    }

    // Phase 3.3: Low-confidence edges from CEE (max 3, in Review assumptions tier)
    const lowConfidenceEdges = ceeAnalysisReady?.low_confidence_edges ?? []
    for (const edgeItem of lowConfidenceEdges.slice(0, 3)) {
      const edge = edges.find(e => e.id === edgeItem.edge_id)
      if (edge) {
        const sourceNode = nodes.find(n => n.id === edge.source)
        const targetNode = nodes.find(n => n.id === edge.target)
        const sourceLabel = sourceNode ? cleanFactorLabel(getNodeLabel(sourceNode)).label : edge.source
        const targetLabel = targetNode ? cleanFactorLabel(getNodeLabel(targetNode)).label : edge.target
        const edgeLabel = `${sourceLabel} → ${targetLabel}`

        result.verify.push({
          key: `verify_edge_${edge.id}`,
          category: 'verify',
          label: edgeLabel,
          detail: edgeItem.prompt,
          bias: 'confidence',
          focus: { type: 'edge', id: edge.id, label: edgeLabel },
          action: { label: 'Edit', kind: 'edit', targetId: edge.id, targetType: 'edge' },
        })
      }
    }

    // === ADD EVIDENCE CATEGORY ===
    // Edges with no evidence metadata
    for (const edge of edges) {
      if (!hasEvidence(edge)) {
        const sourceNode = nodes.find(n => n.id === edge.source)
        const targetNode = nodes.find(n => n.id === edge.target)
        // Apply cleanFactorLabel to strip encoding notation from factor labels
        const sourceLabel = sourceNode ? cleanFactorLabel(getNodeLabel(sourceNode)).label : edge.source
        const targetLabel = targetNode ? cleanFactorLabel(getNodeLabel(targetNode)).label : edge.target

        result.add_evidence.push({
          key: `evidence_${edge.id}`,
          category: 'add_evidence',
          label: `${sourceLabel} → ${targetLabel}`,
          detail: 'No evidence',
          focus: { type: 'edge', id: edge.id, label: `${sourceLabel} → ${targetLabel}` },
          action: { label: 'Add', kind: 'add', targetId: edge.id, targetType: 'edge' },
        })
      }
    }

    // === STRENGTHEN CATEGORY ===
    // Coaching question format: question + why line + CTA actions

    // Missing baseline - optional recommendation (not a blocker)
    if (!hasBaseline && optionNodes.length >= 2) {
      result.strengthen.push({
        key: 'missing_baseline',
        category: 'strengthen',
        label: 'Add a baseline option',
        detail: 'Compare against doing nothing to see if any change is worth it',
        bias: 'anchoring',
        action: { label: 'Add', kind: 'add_baseline' },
      })
    }

    // Only 2 options - coaching question
    if (optionNodes.length === 2) {
      result.strengthen.push({
        key: 'only_2_options',
        category: 'strengthen',
        label: 'Have you considered all your options?',
        detail: 'Having only two choices can lead to binary thinking. What else could you do?',
        action: { label: 'Add Option', kind: 'add_option' },
      })
    }

    // No risks modelled - coaching question
    if (nodesByKind.risk.length === 0) {
      result.strengthen.push({
        key: 'no_risks',
        category: 'strengthen',
        label: 'Are there constraints you need to stay within? Budget limits or timeline boundaries make results more realistic.',
        detail: '',
        action: { label: 'Add a constraint', kind: 'add_risk' },
      })
    }

    // No negative effects modelled - coaching question with multiple CTAs
    const hasNegativeEdge = edges.some(hasNegativeStrength)
    if (!hasNegativeEdge && edges.length > 0) {
      // Find first option node to focus on for "Add a negative relationship" CTA
      const focusNode = optionNodes[0]
      result.strengthen.push({
        key: 'no_negative_effects',
        category: 'strengthen',
        label: 'Could any of these changes have downsides? Adding risks or negative relationships helps avoid over-confidence.',
        detail: '',
        focus: focusNode ? {
          type: 'node' as const,
          id: focusNode.id,
          label: getNodeLabel(focusNode),
        } : undefined,
        action: { label: 'Add a risk', kind: 'add_risk' },
      })
    }

    return result
  }, [nodes, edges, nodesByKind, ceeAnalysisReady?.verification_prompts, ceeAnalysisReady?.low_confidence_edges])

  // Total improvements
  const totalImprovements = useMemo(() => {
    return Object.values(improvementsByCategory).reduce((sum, items) => sum + items.length, 0)
  }, [improvementsByCategory])

  // Three-tier grouping for Phase 2 panel structure
  const tiers = useMemo<TiersData>(() => {
    // Must address: Fix category
    const mustAddressItems = improvementsByCategory.fix
    // Review assumptions: Verify category
    const reviewAssumptionsItems = improvementsByCategory.verify
    // Optional improvements: Add evidence + Strengthen categories
    const optionalItems = [...improvementsByCategory.add_evidence, ...improvementsByCategory.strengthen]

    return {
      mustAddress: {
        items: mustAddressItems,
        count: mustAddressItems.length,
      },
      reviewAssumptions: {
        items: reviewAssumptionsItems,
        count: reviewAssumptionsItems.length,
      },
      optional: {
        items: optionalItems,
        count: optionalItems.length,
      },
    }
  }, [improvementsByCategory])

  // Top 3 actions (priority order: Fix > Verify > Add evidence > Strengthen)
  const topActions = useMemo(() => {
    const allItems: ImprovementItem[] = []
    for (const category of ['fix', 'verify', 'add_evidence', 'strengthen'] as ImprovementCategory[]) {
      allItems.push(...improvementsByCategory[category])
    }
    // Already in priority order due to iteration order
    return allItems.slice(0, 3)
  }, [improvementsByCategory])

  // Input confidence (formerly evidence quality)
  // Formula: nonAiFactors / totalFactors
  // Uses BLOCKLIST approach: only 'ai', 'cee_inference', 'inferred' are AI
  // Everything else is non-AI: 'brief_extraction', 'user', 'user_confirmed',
  // 'user_assumption', 'default', undefined, or any other value
  // Thresholds: ≥0.7 High, ≥0.4 Medium, <0.4 Low
  // Edge case: 0 total factors = Low (no data to base confidence on)
  const evidenceQuality = useMemo<EvidenceQuality>(() => {
    const factors = nodesByKind.factor
    const total = factors.length

    if (total === 0) {
      // Dev debug log
      if (process.env.NODE_ENV === 'development') {
        console.debug('[InputConfidence]', { totalFactors: 0, nonAiFactors: 0, ratio: 0, level: 'low' })
      }
      return { level: 'low', ratio: 0 } // No factors = Low confidence (no data)
    }

    // Count factors that are NOT AI-inferred (blocklist approach)
    const nonAiCount = factors.filter(f => !isAiSource(f)).length
    const ratio = nonAiCount / total

    let level: EvidenceQualityLevel
    if (ratio >= 0.7) {
      level = 'high'
    } else if (ratio >= 0.4) {
      level = 'medium'
    } else {
      level = 'low'
    }

    // Dev debug log
    if (process.env.NODE_ENV === 'development') {
      console.debug('[InputConfidence]', { totalFactors: total, nonAiFactors: nonAiCount, ratio, level })
    }

    return { level, ratio }
  }, [nodesByKind.factor])

  // Use existing readiness hook for canonical canRun/hasBlockers logic
  // This ensures we don't create a second source of truth for run-gating
  const existingReadiness = useExistingPreAnalysisData()

  // isReady uses existing hook for canonical run-gating logic
  // hasBlockers and blockerCount sync with Header (which uses mustAddress.count)
  // This ensures both Header and Footer show consistent blocked/ready state
  const isReady = existingReadiness.canRun && tiers.mustAddress.count === 0
  const hasBlockers = tiers.mustAddress.count > 0
  const blockerCount = tiers.mustAddress.count

  // Loading state: CEE data hasn't arrived yet but we have nodes (expecting CEE data)
  // This prevents showing misleading "Blocked" during initial load
  const isLoading = ceeAnalysisReady === null && nodes.length > 0

  // Success threshold - priority: CEE goal_threshold > node goal_threshold > observed_state.value > success_threshold > threshold
  const successThreshold = useMemo(() => {
    // Phase 3.2: CEE goal_threshold takes highest priority
    if (ceeAnalysisReady?.goal_threshold != null) return ceeAnalysisReady.goal_threshold

    if (!goalNode) return null

    const data = goalNode.data as {
      goal_threshold?: number
      observed_state?: { value?: number }
      success_threshold?: number
      threshold?: number
    }

    // Priority order per brief (node data fallbacks)
    if (data?.goal_threshold != null) return data.goal_threshold
    if (data?.observed_state?.value != null) return data.observed_state.value
    if (data?.success_threshold != null) return data.success_threshold
    if (data?.threshold != null) return data.threshold
    return null
  }, [ceeAnalysisReady?.goal_threshold, goalNode])

  // Auto-derived when threshold comes from CEE or goal node data (not user-set)
  const isThresholdAutoDerived = useMemo(() => {
    // Phase 3.2: CEE goal_threshold is auto-derived
    if (ceeAnalysisReady?.goal_threshold != null) return true

    if (!goalNode) return false

    const data = goalNode.data as {
      threshold_source?: string
      goal_threshold?: number
      observed_state?: { value?: number }
    }

    // If user explicitly set it, not auto-derived
    if (data?.threshold_source === 'user') return false

    // Auto-derived if value came from goal_threshold or observed_state.value
    return (data?.goal_threshold != null) || (data?.observed_state?.value != null)
  }, [ceeAnalysisReady?.goal_threshold, goalNode])

  // Threshold confirmed when explicitly marked as such in goal node data
  const isThresholdConfirmed = useMemo(() => {
    if (!goalNode) return false

    const data = goalNode.data as {
      threshold_confirmed?: boolean
    }

    return data?.threshold_confirmed === true
  }, [goalNode])

  // Calculate reviewed factors progress from node data (not UI state)
  // Total = AI-estimated factors that need review (excludes brief_extraction)
  // Also excludes controllable factors with interventions (to match UI)
  // Reviewed = factors where user has taken Confirm or Assumption action
  const { reviewedFactorsCount, totalReviewableFactorsCount } = useMemo(() => {
    const factorNodes = nodesByKind.factor
    const optionNodes = [...nodesByKind.option, ...nodesByKind.decision]
    let reviewed = 0
    let total = 0

    for (const factor of factorNodes) {
      if (needsReview(factor)) {
        // Phase 2.5: Exclude controllable factors with interventions from progress count
        // (these don't appear in the UI, so shouldn't count toward progress)
        if (isControllableFactor(factor) && hasInterventionTargeting(factor.id, optionNodes)) {
          continue
        }
        total++
        if (isReviewedByUser(factor)) {
          reviewed++
        }
      }
    }

    return { reviewedFactorsCount: reviewed, totalReviewableFactorsCount: total }
  }, [nodesByKind.factor, nodesByKind.option, nodesByKind.decision])

  return {
    improvementsByCategory,
    tiers,
    totalImprovements,
    topActions,
    evidenceQuality,
    isReady,
    hasBlockers,
    blockerCount,
    nodesByKind,
    edgeCount: edges.length,
    goalNode,
    successThreshold,
    isThresholdAutoDerived,
    isThresholdConfirmed,
    isLoading,
    reviewedFactorsCount,
    totalReviewableFactorsCount,
  }
}

export default usePreAnalysisData
