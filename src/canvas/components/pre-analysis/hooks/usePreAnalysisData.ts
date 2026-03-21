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
import { CURRENCY_SYMBOLS } from '../../../utils/labelUtils'
import type { Node, Edge } from '@xyflow/react'
import type { BiasType } from '../primitives/BiasIcon'
// Import existing readiness hook for canonical canRun/hasBlockers logic
import { usePreAnalysisData as useExistingPreAnalysisData } from '../../../hooks/usePreAnalysisData'
// Import label cleaning utility to strip encoding patterns from factor labels
import { cleanFactorLabel } from '../../../../components/results/utils/cleanFactorLabel'
// Import blocker enrichment for structured blocker cards
import { enrichAndSortBlockers, hydrateBlockerLabels, deduplicateBlockers, type EnrichedBlocker } from '../blockerEnrichment'
// Import pre-run validation for enrichedBlockers
import { usePreRunValidation } from '../../../hooks/usePreRunValidation'
// Import baseline detection for quality check #2
import { detectBaseline } from '../../../utils/baselineDetection'
// Import observed_state helpers for consistent access
import { getObservedState } from '../../../utils/observedStateHelpers'
// Import quality dimensions type from store
import type { CeeQualityDimensions } from '../../../store'
// Import validation types for contested edge support
import type { ValidationMetadata } from '../../../domain/validation'

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
  /** Optional uncertainty drivers from CEE for verify items */
  uncertaintyDrivers?: string[]
  /** Source badge type: 'brief' | 'ai' */
  sourceBadge?: 'brief' | 'ai'
  /** Secondary hint text (e.g. verification_prompt from CEE) */
  hint?: string
  /** Subgroup key for divider rows within the reviewAssumptions tier */
  subgroup?: 'contested' | 'cee_inference' | 'brief_extraction' | 'user_reviewed'
  /** Factor's current raw value (for inline editing) */
  rawValue?: number | null
  /** Factor's cap for normalisation (for inline editing) */
  cap?: number | null
  /** Factor's display unit (for inline editing) */
  unit?: string | null
}

/** Option preview data for Task 3 */
export interface OptionPreviewData {
  id: string
  label: string
  status: string
  isBaseline: boolean
  interventions: Array<{
    factorId: string
    factorLabel: string
    interventionValue: number
    currentValue: number | null
    direction: 'up' | 'down' | 'same'
    /** Factor's cap for presentation-layer denormalisation (UI-PRES-004) */
    cap: number | null
    /** Factor's display unit */
    unit: string | null
    /** Factor's current raw value (for "unchanged" detection) */
    currentRawValue: number | null
  }>
}

/** Decision quality check for Task 4 */
export interface QualityCheck {
  id: string
  /** One-sentence nudge text */
  message: string
  /** Optional secondary explanation shown below message in lighter text */
  detail?: string
  /** CTA button label */
  cta: string
  /** CTA action kind (matches improvement action kinds or custom) */
  ctaAction: string
  /** Pill label: Framing, Verify, or Bias */
  pill: 'framing' | 'verify' | 'bias'
}

/** Evidence quality level */
export type EvidenceQualityLevel = 'high' | 'medium' | 'low'

/** Evidence quality result */
export interface EvidenceQuality {
  level: EvidenceQualityLevel
  ratio: number
  /** Factors NOT from AI sources (brief, user-confirmed, etc.) */
  nonAiCount: number
  /** Total factor count */
  totalCount: number
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
  /** Enriched blockers from usePreRunValidation, sorted by priority */
  enrichedBlockers: EnrichedBlocker[]
  /** Informational (non-blocking) items like constraint_dropped — shown but don't prevent run */
  informationalBlockers: EnrichedBlocker[]
  /** Threshold provenance text */
  thresholdProvenance: string | null
  /** Source badge for threshold: 'brief' when extracted from brief, 'ai' when AI-generated */
  thresholdSourceBadge: 'brief' | 'ai' | null
  /** Model adjustments from CEE (STRP/repair pipeline mutations), with resolved labels */
  modelAdjustments: Array<{ type?: string; code?: string; field?: string; detail?: string; reason?: string; target?: string; targetNodeId?: string }>
  /** Pre-mortem analysis from PLoT m1_review (null when absent) */
  preMortem: { failure_scenario: string; warning_signs: string[]; mitigation: string } | null
  /** Task 2: Raw goal threshold from CEE (user-facing value, e.g. 200) */
  goalThresholdRaw: number | null
  /** Task 2: Goal threshold unit from CEE (e.g. "customers") */
  goalThresholdUnit: string | null
  /** Task 2: Whether the goal selection is confirmed by user */
  isGoalConfirmed: boolean
  /** Task 3: Option preview data */
  optionPreviews: OptionPreviewData[]
  /** Task 4: Decision quality checks that fired */
  qualityChecks: QualityCheck[]
  /** Task 6: Repair actions from trace.pipeline.repair_summary */
  repairActions: string[]
  /** Task 7: Quality scores from CEE draft */
  ceeQuality: CeeQualityDimensions | null
  /** Task 8: Whether most edges have default strengths (warning, not blocker) */
  hasDefaultStrengths: boolean
  /** Task 8: Percentage of edges with default strengths */
  defaultStrengthPercent: number
  /** One-line coaching summary synthesising model readiness */
  coachingSummary: string | null
  /** Contested edges with full validation metadata for calibration cards */
  contestedEdges: Array<{ edge: Edge; validation: import('../../../../canvas/domain/validation').ValidationMetadata }>
  /** Balance score for decision health ring (0–1) */
  balanceScore: number
}

// ============================================================================
// Constants
// ============================================================================

// Category priority is implicit in iteration order: fix > verify > add_evidence > strengthen

// CURRENCY_SYMBOLS imported from '../../../utils/labelUtils'

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
const REVIEWED_SOURCES = new Set(['user_confirmed', 'user_assumption', 'user_override'])

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
 * CEE option type for intervention lookup
 */
interface CEEOptionWithInterventions {
  id: string
  interventions?: Record<string, { value?: number | null } | number>
}

/**
 * Check if a factor is targeted by any option's intervention.
 *
 * IMPORTANT: Interventions live in ceeAnalysisReady.options[], NOT in node.data.interventions.
 * See OptionNode.tsx:16-17 and pathFinding.ts:199-200 for context.
 *
 * Supports two intervention formats:
 * - Simple: Record<factorId, number>
 * - Nested: Record<factorId, { value: number }> (CEE V3 format)
 */
function hasInterventionTargeting(
  factorId: string,
  optionNodes: Node[],
  ceeOptions?: CEEOptionWithInterventions[]
): boolean {
  // Primary source: ceeAnalysisReady.options (canonical after CEE response)
  if (ceeOptions) {
    for (const ceeOption of ceeOptions) {
      const interventions = ceeOption.interventions
      if (interventions && Object.prototype.hasOwnProperty.call(interventions, factorId)) {
        const value = interventions[factorId]
        // Handle simple format (number)
        if (typeof value === 'number') {
          return true
        }
        // Handle nested format ({ value: number }) - CEE V3 format
        if (value && typeof value === 'object' && 'value' in value) {
          const nestedValue = value.value
          if (typeof nestedValue === 'number') {
            return true
          }
        }
      }
    }
  }

  // Fallback: node.data.interventions (for backward compatibility / pre-CEE state)
  for (const option of optionNodes) {
    const interventions = (option.data as { interventions?: Record<string, unknown> })?.interventions
    if (interventions && Object.prototype.hasOwnProperty.call(interventions, factorId)) {
      const value = interventions[factorId]
      // Handle simple format (number)
      if (typeof value === 'number') {
        return true
      }
      // Handle nested format ({ value: number })
      if (value && typeof value === 'object' && 'value' in value) {
        const nestedValue = (value as { value: unknown }).value
        if (typeof nestedValue === 'number') {
          return true
        }
      }
    }
  }
  return false
}

/**
 * Check if a factor needs user review
 *
 * v1.1: brief_extraction factors are now reviewable (user can confirm extracted values)
 *
 * Returns true if:
 * - Source is AI (ai, cee_inference, inferred) - needs review
 * - Source is brief_extraction - user-provided but should be confirmed
 * - Source is user-reviewed (user_confirmed, user_assumption) - was reviewable, now reviewed
 */
function needsReview(node: Node): boolean {
  const data = node.data as { observed_state?: { source?: string }; observedState?: { source?: string }; source?: string }
  const observedState = data?.observed_state ?? data?.observedState
  const source = observedState?.source ?? data?.source
  if (!source) return false

  // AI sources that need review
  if (AI_SOURCES.has(source)) return true

  // brief_extraction: user-provided via brief, should be confirmed
  if (source === 'brief_extraction') return true

  // User-reviewed sources (were reviewable, user took action)
  if (REVIEWED_SOURCES.has(source)) return true

  return false
}

/**
 * Get formatted value from node's observed_state.
 * Used as fallback detail for "Set by" items and verify rows when raw_value is absent.
 */
function getAiEstimatedValue(node: Node): string | null {
  // Check both snake_case (observed_state) and camelCase (observedState) for compatibility
  const data = node.data as {
    observed_state?: { value?: number; raw_value?: number; unit?: string }
    observedState?: { value?: number; raw_value?: number; unit?: string }
    value?: number
  }
  const observedState = data?.observed_state ?? data?.observedState
  const value = observedState?.value ?? data?.value
  const rawValue = observedState?.raw_value
  if (value === undefined || value === null) return null
  if (typeof value !== 'number') return String(value)

  // v1.1: always show numeric value — binary Yes/No coercion removed
  // (was converting 0 → "No" which garbled factor rows in hiring brief)

  // Format based on unit
  const unit = observedState?.unit
  if (unit === '%') {
    // Guard: if value > 1, assume it's already a percentage (e.g., 4 = 4%)
    // Otherwise treat as fractional (e.g., 0.04 = 4%)
    const percentValue = value > 1 ? Math.round(value) : Math.round(value * 100)
    return percentValue + '%'
  }
  if (unit && CURRENCY_SYMBOLS.has(unit)) {
    // Prefer raw_value for currency - it's the actual amount, not normalized 0-1 value
    // Example: raw_value=100000 with unit="£" → "£100,000" (not "£0" from value=0.2)
    const displayValue = rawValue ?? value
    return unit + Math.round(displayValue).toLocaleString()
  }
  // Default: display with reasonable precision
  return value.toFixed(1)
}

/**
 * Format observed_state for display: raw_value + unit as primary, cap as context, normalised fallback.
 * Shared by verify items and "Set by" items for consistent formatting.
 */
/**
 * Map a normalised 0–1 value to a qualitative level.
 * Used for factors without cap/unit where numeric display is meaningless.
 */
function toQualitativeLevel(v: number): string {
  if (v < 0.2) return 'very low'
  if (v < 0.4) return 'low'
  if (v < 0.6) return 'moderate'
  if (v < 0.8) return 'high'
  return 'very high'
}

function formatObservedStateDetail(os: ReturnType<typeof getObservedState>): string {
  // Qualitative factors: no meaningful unit AND (no cap, or cap=1 which is just the normalised ceiling)
  // Empty string unit is treated the same as absent — CEE sometimes sends unit: ""
  const isQualitative = !os.unit && (os.cap == null || os.cap === 1)

  if (os.raw_value != null) {
    const unit = os.unit
    let primary: string
    if (unit && CURRENCY_SYMBOLS.has(unit)) {
      primary = `${unit}${Number(os.raw_value).toLocaleString()}`
    } else if (unit === '%') {
      primary = `${os.raw_value}%`
    } else if (unit) {
      primary = `${os.raw_value} ${unit}`
    } else if (isQualitative && Number(os.raw_value) >= 0 && Number(os.raw_value) <= 1) {
      // No unit, no meaningful cap, value in 0–1 range — show qualitative level
      return toQualitativeLevel(Number(os.raw_value))
    } else {
      primary = String(os.raw_value)
    }
    if (os.cap != null && !isQualitative) {
      // Suppress "of 100" for percentages — "50%" not "50% of 100"
      if (unit === '%' && Number(os.cap) === 100) return primary
      // Suppress cap for currency units — "£49" not "£49 of £100"
      // The cap is a normalisation ceiling, not a meaningful budget limit
      if (unit && CURRENCY_SYMBOLS.has(unit)) return primary
      // Don't repeat suffix units — "9 months of 18" not "9 months of 18 months"
      return `${primary} of ${String(os.cap)}`
    }
    return primary
  }
  if (os.value != null) {
    const numValue = Number(os.value)
    if (isQualitative && numValue >= 0 && numValue <= 1) return toQualitativeLevel(numValue)
    if (numValue >= 0 && numValue <= 1) return `${numValue.toFixed(2)} (scale 0–1)`
    return String(numValue)
  }
  return ''
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
 * Check if edge has negative strength.
 *
 * Canvas edges store unsigned magnitude in `weight` and sign in `direction`.
 * DraftChat maps CEE V3 `strength.mean` / flat `strength_mean` → weight + direction.
 * V1 nested `strength.mean` is NOT present on canvas edges.
 */
function hasNegativeStrength(edge: Edge): boolean {
  const data = edge.data as { direction?: string; weight?: number } | undefined
  return data?.direction === 'negative' && (data?.weight ?? 0) > 0
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
  const m1ReviewAssumptions = useCanvasStore(s => s.runMeta?.m1ReviewAssumptions)
  // Task 7: Quality scores from CEE draft
  const ceeQuality = useCanvasStore(s => s.ceeQuality)
  // Task 6: Pipeline trace for repair_summary
  const ceePipelineTrace = useCanvasStore(s => s.ceePipelineTrace)
  // Pre-analysis sensitivity data for influence-based sorting
  const preAnalysisSensitivity = useCanvasStore(s => s.preAnalysisSensitivity)

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
    const hasBaseline = optionNodes.some(n => {
      const explicit = (n.data as { is_baseline?: boolean })?.is_baseline === true
      const label = (n.data as { label?: string })?.label ?? ''
      return explicit || detectBaseline(label).isBaseline
    })

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
      const cleanedLabel = cleanFactorLabel(getNodeLabel(node)).label
      result.fix.push({
        key: `disconnected_${node.id}`,
        category: 'fix',
        label: `Connect "${cleanedLabel}"`,
        detail: 'Node has no relationships',
        focus: { type: 'node', id: node.id, label: cleanedLabel },
      })
    }

    // === VERIFY CATEGORY ===
    // Factors with observed_state from brief_extraction OR AI-inferred source
    // v1.1: brief_extraction factors are now reviewable (user can confirm extracted values)
    // Phase 3.1: Use verification_prompts from CEE when available for better detail text
    //
    // Binary lever exclusion: factors with no raw_value/cap/unit where every
    // intervention across all options is exactly 0 or 1 are mechanism nodes
    // (e.g. "Tech Lead Hired"), not assumptions to validate.
    const ceeOptions = ceeAnalysisReady?.options ?? []
    const verificationPrompts = ceeAnalysisReady?.verification_prompts ?? {}
    for (const factor of nodesByKind.factor) {
      const os = getObservedState(factor.data)
      // Include any factor with observed_state value (not null)
      if (os.value == null) continue

      // Exclude binary lever factors: no rich metadata + all interventions are 0 or 1
      if (os.raw_value == null && os.cap == null && os.unit == null) {
        const interventionValues: number[] = []
        for (const opt of ceeOptions) {
          const iv = (opt.interventions ?? {})[factor.id]
          if (iv != null) {
            const numericIv = typeof iv === 'number' ? iv : (iv as { value?: number })?.value
            if (numericIv != null) interventionValues.push(numericIv)
          }
        }
        if (interventionValues.length > 0 && interventionValues.every(v => v === 0 || v === 1)) {
          continue
        }
      }

      const source = os.source
      const isBriefExtraction = source === 'brief_extraction'
      const isAi = isAiInferred(factor)

      const rawLabel = getNodeLabel(factor)
      const { label: cleanedLabel } = cleanFactorLabel(rawLabel)
      const value = getAiEstimatedValue(factor)
      const verificationPrompt = verificationPrompts[factor.id]

      // Extract uncertainty_drivers from observed_state
      const uncertaintyDrivers = Array.isArray(os.uncertainty_drivers)
        ? os.uncertainty_drivers.filter((d): d is string => typeof d === 'string')
        : undefined

      // Determine source badge type
      const sourceBadge: 'brief' | 'ai' | undefined =
        isBriefExtraction ? 'brief' :
        isAi ? 'ai' :
        undefined

      // Build context line: raw_value + unit always primary, verification_prompt → hint
      const contextLine = formatObservedStateDetail(os) || (isAi ? 'Estimated by AI' : '')

      // Verification prompt demoted to secondary hint (never overrides raw_value)
      const hint = verificationPrompt || undefined

      // Subgroup for divider rows within reviewAssumptions tier
      let subgroup: ImprovementItem['subgroup']
      if (source === 'brief_extraction') {
        subgroup = 'brief_extraction'
      } else if (['ai', 'cee_inference', 'inferred', 'engine', 'ai_estimate'].includes(source ?? '')) {
        subgroup = 'cee_inference'
      } else if (['user_confirmed', 'user_assumption', 'user_override'].includes(source ?? '')) {
        subgroup = 'user_reviewed'
      }

      result.verify.push({
        key: `verify_${factor.id}`,
        category: 'verify',
        label: cleanedLabel,
        detail: contextLine || value || 'Value needed',
        bias: 'confidence',
        focus: { type: 'node', id: factor.id, label: cleanedLabel },
        action: { label: 'Confirm', kind: 'confirm', targetId: factor.id, targetType: 'node' },
        uncertaintyDrivers,
        sourceBadge,
        hint,
        subgroup,
        rawValue: os.raw_value ?? null,
        cap: os.cap ?? null,
        unit: os.unit ?? null,
      })
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

    // === CONTESTED EDGES (highest priority in reviewAssumptions) ===
    // Filter edges with contested validation that CEE surfaced for user review
    for (const edge of edges) {
      const data = edge.data as { validation?: ValidationMetadata; label?: string } | undefined
      const validation = data?.validation
      if (!validation) continue
      if (validation.status !== 'contested') continue
      if (!validation.surfaced) continue
      if (validation.user_action !== 'pending') continue

      const sourceNode = nodes.find(n => n.id === edge.source)
      const targetNode = nodes.find(n => n.id === edge.target)
      const sourceLabel = sourceNode ? cleanFactorLabel(getNodeLabel(sourceNode)).label : edge.source
      const targetLabel = targetNode ? cleanFactorLabel(getNodeLabel(targetNode)).label : edge.target
      const edgeLabel = data?.label || `${sourceLabel} → ${targetLabel}`

      result.verify.push({
        key: `contested_${edge.id}`,
        category: 'verify',
        label: edgeLabel,
        detail: `Contested: two AI passes disagree (divergence ${Math.round(validation.max_divergence * 100)}%)`,
        focus: { type: 'edge', id: edge.id, label: edgeLabel },
        subgroup: 'contested',
      })
    }

    // PLoT m1_review.key_assumptions — each is a plain string to display in Review assumptions tier
    const keyAssumptions = m1ReviewAssumptions?.key_assumptions ?? []
    for (const assumption of keyAssumptions) {
      result.verify.push({
        key: `m1_assumption_${result.verify.length}`,
        category: 'verify',
        label: assumption,
        detail: '',
        bias: 'confidence',
      })
    }

    // Sort verify items by subgroup: contested → cee_inference → brief_extraction → user_reviewed → ungrouped
    // Within each subgroup, sort by factor_influence desc when sensitivity data available
    const SUBGROUP_ORDER: Record<string, number> = { contested: -1, cee_inference: 0, brief_extraction: 1, user_reviewed: 2 }
    const factorInfluence = preAnalysisSensitivity?.factor_influence
    result.verify.sort((a, b) => {
      const ao = a.subgroup != null ? (SUBGROUP_ORDER[a.subgroup] ?? 3) : 3
      const bo = b.subgroup != null ? (SUBGROUP_ORDER[b.subgroup] ?? 3) : 3
      if (ao !== bo) return ao - bo
      // Within contested subgroup, sort by evoi_impact desc (post-analysis) or max_divergence desc (pre-analysis)
      if (a.subgroup === 'contested' && b.subgroup === 'contested') {
        const aEdge = edges.find(e => e.id === a.focus?.id)
        const bEdge = edges.find(e => e.id === b.focus?.id)
        const aVal = (aEdge?.data as { validation?: ValidationMetadata } | undefined)?.validation
        const bVal = (bEdge?.data as { validation?: ValidationMetadata } | undefined)?.validation
        if (aVal && bVal) {
          // Items with evoi_impact rank above those without
          const aHasEvoi = aVal.evoi_impact != null
          const bHasEvoi = bVal.evoi_impact != null
          if (aHasEvoi !== bHasEvoi) return aHasEvoi ? -1 : 1
          // Post-analysis: sort by evoi_impact desc
          if (aHasEvoi && bHasEvoi) {
            return bVal.evoi_impact! - aVal.evoi_impact!
          }
          // Pre-analysis: max_divergence desc, then distance_to_goal asc
          if (aVal.max_divergence !== bVal.max_divergence) {
            return bVal.max_divergence - aVal.max_divergence
          }
          return aVal.distance_to_goal - bVal.distance_to_goal
        }
      }
      // Within other subgroups, sort by factor_influence desc when available
      if (factorInfluence && a.focus?.type === 'node' && b.focus?.type === 'node') {
        const aInfluence = factorInfluence[a.focus.id] ?? -1
        const bInfluence = factorInfluence[b.focus.id] ?? -1
        if (aInfluence !== bInfluence) return bInfluence - aInfluence
      }
      return 0
    })

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

    // Missing baseline — surfaced only in Decision quality (no_baseline check).
    // Not duplicated here to avoid showing the same nudge in two locations.

    // Too few options - coaching question
    if (optionNodes.length <= 1) {
      result.strengthen.push({
        key: 'few_options',
        category: 'strengthen',
        label: optionNodes.length === 0
          ? 'What options are you considering? Add at least two alternatives to compare.'
          : 'Have you considered all your options? A single option limits comparison.',
        detail: optionNodes.length === 0
          ? 'A decision model needs at least two options to evaluate trade-offs.'
          : 'Having only one choice means there\u2019s nothing to compare against. What else could you do?',
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
  }, [nodes, edges, nodesByKind, ceeAnalysisReady?.options, ceeAnalysisReady?.verification_prompts, ceeAnalysisReady?.low_confidence_edges, m1ReviewAssumptions, preAnalysisSensitivity])

  // Contested edges with full validation metadata for calibration card rendering
  const contestedEdges = useMemo(() => {
    return edges
      .filter(e => {
        const v = (e.data as { validation?: ValidationMetadata } | undefined)?.validation
        return v?.status === 'contested' && v?.surfaced && v?.user_action === 'pending'
      })
      .map(e => ({
        edge: e,
        validation: (e.data as { validation: ValidationMetadata }).validation,
      }))
  }, [edges])

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
      return { level: 'low', ratio: 0, nonAiCount: 0, totalCount: 0 }
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

    return { level, ratio, nonAiCount, totalCount: total }
  }, [nodesByKind.factor])

  // Use existing readiness hook for canonical canRun/hasBlockers logic
  // This ensures we don't create a second source of truth for run-gating
  const existingReadiness = useExistingPreAnalysisData()

  const canonicalBlockerCount = existingReadiness.allIssues.filter((issue) => issue.severity === 'blocker').length
  const isReady = existingReadiness.canRun
  const hasBlockers = existingReadiness.hasBlockers
  const blockerCount = canonicalBlockerCount
  const isLoading = existingReadiness.isLoading || (ceeAnalysisReady === null && nodes.length > 0 && !hasBlockers)

  // Enriched blockers from usePreRunValidation — structured cards for BlockersSection
  // Pipeline: enrich → sort → hydrate labels from graph nodes → deduplicate by factor_id
  const preRunValidation = usePreRunValidation()
  const nodesById = useMemo(
    () => new Map(nodes.map(n => [n.id, { label: (n.data as { label?: string })?.label }])),
    [nodes]
  )
  const enrichedBlockers = useMemo(
    () => {
      const enriched = enrichAndSortBlockers(preRunValidation.blockers)
      const hydrated = hydrateBlockerLabels(enriched, nodesById)
      return deduplicateBlockers(hydrated)
    },
    [preRunValidation.blockers, nodesById]
  )

  // Informational blockers (e.g. constraint_dropped) — shown but don't block run
  const informationalBlockers = useMemo(
    () => {
      const enriched = enrichAndSortBlockers(preRunValidation.informationalBlockers)
      const hydrated = hydrateBlockerLabels(enriched, nodesById)
      return deduplicateBlockers(hydrated)
    },
    [preRunValidation.informationalBlockers, nodesById]
  )

  // Success threshold - priority: user-set > CEE goal_threshold > node goal_threshold > observed_state.value > success_threshold > threshold > factor_target_* nodes
  const successThreshold = useMemo(() => {
    // User-set threshold takes highest priority — handleThresholdChange writes
    // threshold_source: 'user' + success_threshold to the goal node
    if (goalNode) {
      const gd = goalNode.data as { threshold_source?: string; success_threshold?: number }
      if (gd?.threshold_source === 'user' && gd?.success_threshold != null) {
        return gd.success_threshold
      }
    }

    // CEE goal_threshold (auto-derived from brief)
    if (ceeAnalysisReady?.goal_threshold != null) return ceeAnalysisReady.goal_threshold

    if (goalNode) {
      const data = goalNode.data as {
        goal_threshold?: number
        observed_state?: { value?: number }
        success_threshold?: number
        threshold?: number
      }

      // Priority order per brief (goal node data)
      if (data?.goal_threshold != null) return data.goal_threshold
      if (data?.observed_state?.value != null) return data.observed_state.value
      if (data?.success_threshold != null) return data.success_threshold
      if (data?.threshold != null) return data.threshold
    }

    // Task 3: Fallback to factor_target_* or factor_value_* nodes with brief_extraction source
    // These are target values detected from the user's brief
    for (const node of nodes) {
      const id = node.id
      if (id.startsWith('factor_target_') || id.startsWith('factor_value_')) {
        const nodeData = node.data as {
          observed_state?: { value?: number; source?: string }
          observedState?: { value?: number; source?: string }
          value?: number
          source?: string
        }
        const observedState = nodeData?.observed_state ?? nodeData?.observedState
        const source = observedState?.source ?? nodeData?.source
        const value = observedState?.value ?? nodeData?.value

        // Only use brief_extraction sources (user-provided target values)
        if (source === 'brief_extraction' && value != null) {
          return value
        }
      }
    }

    return null
  }, [ceeAnalysisReady?.goal_threshold, goalNode, nodes])

  // Auto-derived when threshold comes from CEE, goal node data, or factor_target_* nodes (not user-set)
  const isThresholdAutoDerived = useMemo(() => {
    // Phase 3.2: CEE goal_threshold is auto-derived
    if (ceeAnalysisReady?.goal_threshold != null) return true

    if (goalNode) {
      const data = goalNode.data as {
        threshold_source?: string
        goal_threshold?: number
        observed_state?: { value?: number }
      }

      // If user explicitly set it, not auto-derived
      if (data?.threshold_source === 'user') return false

      // Auto-derived if value came from goal_threshold or observed_state.value
      if ((data?.goal_threshold != null) || (data?.observed_state?.value != null)) {
        return true
      }
    }

    // Task 3: If threshold came from factor_target_* node, it's auto-derived (detected from brief)
    for (const node of nodes) {
      const id = node.id
      if (id.startsWith('factor_target_') || id.startsWith('factor_value_')) {
        const nodeData = node.data as {
          observed_state?: { value?: number; source?: string }
          observedState?: { value?: number; source?: string }
          value?: number
          source?: string
        }
        const observedState = nodeData?.observed_state ?? nodeData?.observedState
        const source = observedState?.source ?? nodeData?.source
        const value = observedState?.value ?? nodeData?.value

        if (source === 'brief_extraction' && value != null) {
          return true
        }
      }
    }

    return false
  }, [ceeAnalysisReady?.goal_threshold, goalNode, nodes])

  // Threshold confirmed when explicitly marked as such in goal node data
  const isThresholdConfirmed = useMemo(() => {
    if (!goalNode) return false

    const data = goalNode.data as {
      threshold_confirmed?: boolean
    }

    return data?.threshold_confirmed === true
  }, [goalNode])

  // Threshold provenance - source text explaining where the threshold came from
  // Check provenance.reasoning on goal node, observed_state.reasoning, or factor_target_* label
  const thresholdProvenance = useMemo<string | null>(() => {
    // Check if threshold came from CEE
    if (ceeAnalysisReady?.goal_threshold != null) {
      // Check for goal_threshold_reasoning in CEE response (if it exists)
      const reasoning = (ceeAnalysisReady as { goal_threshold_reasoning?: string })?.goal_threshold_reasoning
      if (reasoning && typeof reasoning === 'string') {
        return reasoning
      }
      return null
    }

    // Check goal node for provenance/reasoning
    if (goalNode) {
      const data = goalNode.data as {
        goal_threshold?: number
        observed_state?: { value?: number; reasoning?: string }
        provenance?: { reasoning?: string }
        threshold_reasoning?: string
      }

      // Check if threshold came from goal node
      if (data?.goal_threshold != null || data?.observed_state?.value != null) {
        // Try various provenance fields
        if (data?.observed_state?.reasoning) return data.observed_state.reasoning
        if (data?.provenance?.reasoning) return data.provenance.reasoning
        if (data?.threshold_reasoning) return data.threshold_reasoning
      }
    }

    // Check if threshold came from factor_target_* node
    for (const node of nodes) {
      const id = node.id
      if (id.startsWith('factor_target_') || id.startsWith('factor_value_')) {
        const nodeData = node.data as {
          observed_state?: { value?: number; source?: string; reasoning?: string }
          observedState?: { value?: number; source?: string; reasoning?: string }
          value?: number
          source?: string
          label?: string
        }
        const observedState = nodeData?.observed_state ?? nodeData?.observedState
        const source = observedState?.source ?? nodeData?.source
        const value = observedState?.value ?? nodeData?.value

        // If this node provided the threshold
        if (source === 'brief_extraction' && value != null) {
          // Check for reasoning first
          if (observedState?.reasoning) return observedState.reasoning
          // Fall back to node label as provenance context
          const label = nodeData?.label
          if (label && typeof label === 'string') {
            return label
          }
        }
      }
    }

    return null
  }, [ceeAnalysisReady, goalNode, nodes])

  // Threshold source badge: 'brief' when extracted from brief, 'ai' when AI-generated
  const thresholdSourceBadge = useMemo<'brief' | 'ai' | null>(() => {
    if (!isThresholdAutoDerived) return null
    // CEE goal_threshold is extracted from user brief
    if (ceeAnalysisReady?.goal_threshold != null) return 'brief'
    // factor_target_* with brief_extraction source
    for (const node of nodes) {
      if (node.id.startsWith('factor_target_') || node.id.startsWith('factor_value_')) {
        const nd = node.data as { observed_state?: { source?: string }; observedState?: { source?: string } }
        const src = nd?.observed_state?.source ?? nd?.observedState?.source
        if (src === 'brief_extraction') return 'brief'
      }
    }
    // Default: AI-generated
    return 'ai'
  }, [isThresholdAutoDerived, ceeAnalysisReady?.goal_threshold, nodes])

  // Calculate reviewed factors progress from node data (not UI state)
  // Total = factors that appear in the verify section (excludes binary levers)
  // Reviewed = factors where user has taken Confirm or Assumption action
  const { reviewedFactorsCount, totalReviewableFactorsCount } = useMemo(() => {
    const factorNodes = nodesByKind.factor
    const options = ceeAnalysisReady?.options ?? []
    let reviewed = 0
    let total = 0

    for (const factor of factorNodes) {
      const os = getObservedState(factor.data)
      if (os.value == null) continue

      // Exclude binary levers (must match verify filter)
      if (os.raw_value == null && os.cap == null && os.unit == null) {
        const ivValues: number[] = []
        for (const opt of options) {
          const iv = (opt.interventions ?? {})[factor.id]
          if (iv != null) {
            const numericIv = typeof iv === 'number' ? iv : (iv as { value?: number })?.value
            if (numericIv != null) ivValues.push(numericIv)
          }
        }
        if (ivValues.length > 0 && ivValues.every(v => v === 0 || v === 1)) {
          continue
        }
      }

      total++
      if (isReviewedByUser(factor)) {
        reviewed++
      }
    }

    return { reviewedFactorsCount: reviewed, totalReviewableFactorsCount: total }
  }, [nodesByKind.factor, ceeAnalysisReady?.options])

  // =========================================================================
  // Task 2: Goal threshold raw + unit for hero inputs
  // =========================================================================
  const goalThresholdRaw = useMemo<number | null>(() => {
    if (ceeAnalysisReady?.goal_threshold_raw != null) return ceeAnalysisReady.goal_threshold_raw as number
    if (goalNode) {
      const data = goalNode.data as { goal_threshold_raw?: number }
      return data?.goal_threshold_raw ?? null
    }
    return null
  }, [ceeAnalysisReady?.goal_threshold_raw, goalNode])

  const goalThresholdUnit = useMemo<string | null>(() => {
    if (ceeAnalysisReady?.goal_threshold_unit) return ceeAnalysisReady.goal_threshold_unit as string
    if (goalNode) {
      const data = goalNode.data as { goal_threshold_unit?: string }
      return data?.goal_threshold_unit ?? null
    }
    return null
  }, [ceeAnalysisReady?.goal_threshold_unit, goalNode])

  // Goal confirmed tracks whether the user explicitly confirmed goal selection
  const isGoalConfirmed = useMemo(() => {
    if (!goalNode) return false
    return (goalNode.data as { goal_confirmed?: boolean })?.goal_confirmed === true
  }, [goalNode])

  // =========================================================================
  // Task 3: Option previews from analysis_ready.options[]
  // =========================================================================
  const optionPreviews = useMemo<OptionPreviewData[]>(() => {
    const options = ceeAnalysisReady?.options ?? []
    if (options.length === 0) return []

    return options.map(opt => {
      const optionNode = nodes.find(n => n.id === opt.id)
      // Detect baseline by explicit flag or label heuristic
      const explicitBaseline = (optionNode?.data as { is_baseline?: boolean })?.is_baseline === true
      const labelBaseline = detectBaseline(opt.label ?? '').isBaseline
      const isBaseline = explicitBaseline || labelBaseline

      const interventionEntries = Object.entries(opt.interventions ?? {})
      const interventions = interventionEntries.map(([factorId, intervention]) => {
        const factorNode = nodes.find(n => n.id === factorId)
        // Strip all parenthetical descriptors for compact option preview display
        const baseLabel = factorNode ? cleanFactorLabel(getNodeLabel(factorNode)).label : factorId
        const factorLabel = baseLabel.replace(/\s*\([^)]*\)\s*/g, '').trim() || baseLabel
        const interventionValue = typeof intervention === 'number'
          ? intervention
          : (intervention as { value?: number })?.value ?? 0

        // Get current observed value for direction comparison
        const os = getObservedState(factorNode?.data)
        const currentValue = os.value ?? null

        // UI-PRES-004: include cap/unit for presentation-layer denormalisation
        const factorCap = os.cap ?? null
        const factorUnit = os.unit ?? null
        // Raw value for "unchanged" detection (prefer raw_value, fall back to value×cap)
        const currentRawValue = os.raw_value != null
          ? os.raw_value
          : (currentValue != null && factorCap != null ? currentValue * factorCap : null)

        // Compute raw intervention value using same discrete detection as formatInterventionDisplay
        // so that direction arrows and unchanged text use the same value space
        let rawInterventionValue: number
        if (factorCap == null) {
          rawInterventionValue = interventionValue
        } else {
          const isDiscreteRaw = Number.isInteger(interventionValue) &&
            interventionValue >= 0 && interventionValue <= factorCap
          rawInterventionValue = isDiscreteRaw ? interventionValue : interventionValue * factorCap
        }

        // Direction from raw values (consistent with unchanged detection)
        let direction: 'up' | 'down' | 'same' = 'same'
        if (
          currentRawValue != null &&
          Number.isFinite(currentRawValue) &&
          Number.isFinite(rawInterventionValue)
        ) {
          const rivRounded = Math.round(rawInterventionValue * 1000) / 1000
          const crvRounded = Math.round((currentRawValue as number) * 1000) / 1000
          if (rivRounded > crvRounded) direction = 'up'
          else if (rivRounded < crvRounded) direction = 'down'
        }

        return { factorId, factorLabel, interventionValue, currentValue, direction, cap: factorCap, unit: factorUnit, currentRawValue }
      })

      // Suppress interventions that don't change the factor's current value.
      // Qualitative factors (cap=null/1, no unit): compare normalised values directly
      // (currentRawValue is null for these, so direction='same' default can't be used).
      // Dimensional factors: direction='same' is only set when currentRawValue is known and matches.
      const filteredInterventions = interventions.filter(iv => {
        const isQualitative = !iv.unit && (iv.cap == null || iv.cap === 1)
        if (isQualitative && iv.currentValue != null) {
          return Math.round(iv.interventionValue * 1000) !== Math.round(iv.currentValue * 1000)
        }
        return iv.currentRawValue == null || iv.direction !== 'same'
      })

      return {
        id: opt.id,
        label: opt.label,
        status: opt.status,
        isBaseline,
        interventions: filteredInterventions,
      }
    })
  }, [ceeAnalysisReady?.options, nodes])

  // =========================================================================
  // Task 4: Decision quality checks (6 client-side heuristics)
  // =========================================================================
  const qualityChecks = useMemo<QualityCheck[]>(() => {
    const checks: QualityCheck[] = []
    const optionNodes = [...nodesByKind.option, ...nodesByKind.decision]

    // 1. No risks modelled
    if (nodesByKind.risk.length === 0) {
      checks.push({
        id: 'no_risks',
        message: 'No risks in your model: what could go wrong?',
        cta: 'Add risk',
        ctaAction: 'add_risk',
        pill: 'framing',
      })
    }

    // 2. No baseline option (check explicit flag + label heuristic)
    const hasBaselineOption = optionNodes.some(n => {
      const explicit = (n.data as { is_baseline?: boolean })?.is_baseline === true
      const label = (n.data as { label?: string })?.label ?? ''
      return explicit || detectBaseline(label).isBaseline
    })
    if (!hasBaselineOption && optionNodes.length >= 2) {
      checks.push({
        id: 'no_baseline',
        message: "No 'do nothing' option. Can't tell if action beats inaction",
        cta: 'Add baseline',
        ctaAction: 'add_baseline',
        pill: 'framing',
      })
    }

    // 2b. Goal baseline missing — goal has no current-state value at all.
    // Fires when goal exists but observed_state is absent or observed_state.value is null/undefined.
    // Does NOT fire when a value is present (even without a separate baseline) — PLoT can use
    // the value itself as an implicit baseline.
    if (goalNode) {
      const goalOs = getObservedState(goalNode.data)
      if (goalOs.value == null) {
        checks.push({
          id: 'goal_baseline_missing',
          message: 'No current baseline set. Analysis will show target reach likelihood, not improvement from today',
          cta: 'Set current value',
          ctaAction: 'set_goal_baseline',
          pill: 'framing',
        })
      }
    }

    // 3. All positive edges (no negative effect_direction)
    const hasNegative = edges.some(hasNegativeStrength)
    if (!hasNegative && edges.length > 0) {
      checks.push({
        id: 'all_positive_edges',
        message: 'No trade-offs captured: every factor helps. Is that realistic?',
        cta: 'Review structure',
        ctaAction: 'review_structure',
        pill: 'framing',
      })
    }

    // 4. Same levers (>80% intervention factor overlap across non-baseline options)
    const ceeOptions = ceeAnalysisReady?.options ?? []
    const nonBaselineOptions = ceeOptions.filter(o => {
      const optNode = nodes.find(n => n.id === o.id)
      const explicit = (optNode?.data as { is_baseline?: boolean })?.is_baseline === true
      const labelBased = detectBaseline(o.label ?? '').isBaseline
      return !explicit && !labelBased && Object.keys(o.interventions ?? {}).length > 0
    })
    if (nonBaselineOptions.length >= 2) {
      const factorSets = nonBaselineOptions.map(o => new Set(Object.keys(o.interventions ?? {})))
      const allFactors = new Set(factorSets.flatMap(s => [...s]))
      if (allFactors.size > 0) {
        const intersection = [...allFactors].filter(f => factorSets.every(s => s.has(f)))
        const overlapRatio = intersection.length / allFactors.size
        if (overlapRatio > 0.8) {
          checks.push({
            id: 'same_levers',
            message: 'Options affect the same factors: may not represent different strategies',
            detail: 'When options change the same drivers, results may cluster together; consider whether your options represent genuinely different approaches',
            cta: 'Review options',
            ctaAction: 'review_options',
            pill: 'verify',
          })
        }
      }
    }

    // Factor nodes — shared by checks 4b and 5
    const factors = nodesByKind.factor

    // 4b. No external factors — every factor is controllable, missing environmental context
    if (factors.length >= 3) {
      const hasExternal = factors.some(n => {
        const cat = (n.data as { category?: string })?.category?.trim().toLowerCase()
        return cat === 'external' || cat === 'observable'
      })
      if (!hasExternal) {
        checks.push({
          id: 'zero_external_factors',
          message: 'No external factors: what market or environmental conditions could affect the outcome?',
          cta: 'Review structure',
          ctaAction: 'review_structure',
          pill: 'framing',
        })
      }
    }

    // 5. Many AI estimates (AI-sourced > brief_extraction count)
    // Fire whenever AI-sourced factors outnumber brief-sourced ones, regardless of whether
    // those factors have observed_state.value set. Factors without a value are still AI
    // estimates the user should validate.
    if (factors.length > 0) {
      const aiCount = factors.filter(isAiSource).length
      const briefCount = factors.length - aiCount
      if (aiCount > briefCount) {
        checks.push({
          id: 'many_ai_estimates',
          message: 'Most values estimated by AI. Consider validating the top 2\u20133',
          cta: 'Review assumptions',
          ctaAction: 'review_assumptions',
          pill: 'verify',
        })
      }
    }

    // 6. No target — only fire when CEE indicates quantitative goal
    // (goal_threshold_unit or goal_threshold_cap present) or user started then cleared.
    // Never fire on purely qualitative goals (spec: absence of target is not a warning).
    const hasQuantitativeGoalHint = goalNode && (
      (goalNode.data as { goal_threshold_unit?: string })?.goal_threshold_unit != null ||
      (goalNode.data as { goal_threshold_cap?: number })?.goal_threshold_cap != null
    )
    const userClearedTarget = goalNode &&
      (goalNode.data as { threshold_source?: string })?.threshold_source === 'user' &&
      successThreshold === null

    if (successThreshold === null && (hasQuantitativeGoalHint || userClearedTarget)) {
      checks.push({
        id: 'no_target',
        message: "No success target: results rank options but can't show probability of success",
        cta: 'Set target',
        ctaAction: 'set_target',
        pill: 'framing',
      })
    }

    // 7. CEE bias findings — append after deterministic checks, deduplicate
    const biasFindings = ceeAnalysisReady?.bias_findings ?? []
    for (const finding of biasFindings) {
      // Deduplicate: skip if a deterministic check with similar scope already fired
      const isDuplicate =
        (finding.type === 'confirmation' && checks.some(c => c.id === 'all_positive_edges')) ||
        (finding.type === 'anchoring' && checks.some(c => c.id === 'many_ai_estimates'))
      if (isDuplicate) continue

      checks.push({
        id: `bias_${finding.id}`,
        message: finding.description,
        detail: finding.mechanism ?? undefined,
        cta: 'Ask AI about this',
        ctaAction: `ask_ai_bias_${finding.id}`,
        pill: 'bias',
      })
    }

    return checks
  }, [nodesByKind, edges, ceeAnalysisReady?.options, ceeAnalysisReady?.bias_findings, successThreshold, goalNode, totalReviewableFactorsCount])

  // =========================================================================
  // Task 6: Model adjustments with resolved labels + repair actions from trace
  // =========================================================================
  const modelAdjustments = useMemo(() => {
    const raw = ceeAnalysisReady?.model_adjustments ?? []
    return raw.map(adj => {
      const target = adj.target
      if (!target) return adj
      // Resolve node_id to human-readable label
      const node = nodes.find(n => n.id === target)
      const nodeLabel = node ? (node.data as { label?: string })?.label : null
      if (nodeLabel) {
        return { ...adj, target: nodeLabel, targetNodeId: target }
      }
      // Fallback: strip fac_ prefix, replace _ with spaces, title case
      const cleaned = target
        .replace(/^fac_/, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c: string) => c.toUpperCase())
      return { ...adj, target: cleaned, targetNodeId: target }
    })
  }, [ceeAnalysisReady?.model_adjustments, nodes])

  // Repair actions from trace.pipeline.repair_summary
  const repairActions = useMemo<string[]>(() => {
    if (!ceePipelineTrace) return []
    // repair_summary may be nested under different paths depending on CEE version
    const trace = ceePipelineTrace as unknown as Record<string, unknown>
    const repairSummary = trace.repair_summary ?? trace.repair
    if (!repairSummary || typeof repairSummary !== 'object') return []

    const summary = repairSummary as Record<string, unknown>
    // Extract deterministic_repairs[].action text
    const repairs = summary.deterministic_repairs
    if (!Array.isArray(repairs)) return []

    return repairs
      .map((r: unknown) => {
        if (r && typeof r === 'object' && 'action' in r) {
          return String((r as { action: unknown }).action)
        }
        return null
      })
      .filter((s): s is string => s !== null)
  }, [ceePipelineTrace])

  // =========================================================================
  // Task 8: Default edge strengths detection
  // Uses epsilon tolerance for float comparison
  // =========================================================================
  const { hasDefaultStrengths, defaultStrengthPercent } = useMemo(() => {
    if (edges.length === 0) return { hasDefaultStrengths: false, defaultStrengthPercent: 0 }

    const isDefaultEdge = (edge: Edge) => {
      const data = edge.data as { weight?: number; strengthStd?: number } | undefined
      const mean = data?.weight ?? 0.5
      const std = data?.strengthStd ?? 0.125
      // Epsilon tolerance for float comparison
      return Math.abs(mean - 0.5) < 0.01 && Math.abs(std - 0.125) < 0.01
    }

    const defaultCount = edges.filter(isDefaultEdge).length
    const percent = defaultCount / edges.length
    return {
      hasDefaultStrengths: percent > 0.8,
      defaultStrengthPercent: Math.round(percent * 100),
    }
  }, [edges])

  // Balance score for decision health ring (Task 5)
  const balanceScore = useMemo(() => {
    let score = 0
    const optionNodes = [...nodesByKind.option, ...nodesByKind.decision]
    // 1. Has negative edges
    if (edges.some(hasNegativeStrength)) score += 0.25
    // 2. Has risk nodes
    if (nodesByKind.risk.length > 0) score += 0.25
    // 3. Has baseline option
    const hasBaseline = optionNodes.some(n => {
      const explicit = (n.data as { is_baseline?: boolean })?.is_baseline === true
      const label = (n.data as { label?: string })?.label ?? ''
      return explicit || detectBaseline(label).isBaseline
    })
    if (hasBaseline) score += 0.25
    // 4. Option diversity (2+ non-baseline options)
    const nonBaselineCount = optionNodes.filter(n => {
      const explicit = (n.data as { is_baseline?: boolean })?.is_baseline === true
      const label = (n.data as { label?: string })?.label ?? ''
      return !explicit && !detectBaseline(label).isBaseline
    }).length
    if (nonBaselineCount >= 2) score += 0.25
    return score
  }, [edges, nodesByKind])

  // Coaching summary — one-line text synthesising the model's readiness state.
  // Primary: CEE coaching.summary (decision-specific). Fallback: count-based string.
  const coachingSummary = useMemo<string | null>(() => {
    if (isLoading) return null

    // Primary: use CEE-provided coaching summary when available (takes precedence over guards)
    const ceeSummary = ceeAnalysisReady?.coaching_summary
    if (ceeSummary) return ceeSummary

    if (!isReady && blockerCount > 0) return null // blockers section handles this

    const fixCount = tiers.mustAddress.count
    const verifyCount = tiers.reviewAssumptions.count
    const qCheckCount = qualityChecks.length

    if (fixCount > 0) {
      return `${fixCount} issue${fixCount !== 1 ? 's' : ''} to fix before running analysis.`
    }
    if (qCheckCount > 0 && verifyCount > 0) {
      return `${verifyCount} assumption${verifyCount !== 1 ? 's' : ''} to review and ${qCheckCount} quality suggestion${qCheckCount !== 1 ? 's' : ''} to consider.`
    }
    if (verifyCount > 0) {
      return `${verifyCount} assumption${verifyCount !== 1 ? 's' : ''} to review before running.`
    }
    if (qCheckCount > 0) {
      return `${qCheckCount} quality suggestion${qCheckCount !== 1 ? 's' : ''} to consider.`
    }
    if (isReady && totalImprovements === 0) {
      return 'Model looks ready; no issues detected.'
    }
    return null
  }, [isLoading, isReady, blockerCount, ceeAnalysisReady?.coaching_summary, tiers, qualityChecks, totalImprovements])

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
    thresholdProvenance,
    thresholdSourceBadge,
    isLoading,
    reviewedFactorsCount,
    totalReviewableFactorsCount,
    enrichedBlockers,
    informationalBlockers,
    modelAdjustments,
    preMortem: m1ReviewAssumptions?.pre_mortem ?? null,
    goalThresholdRaw,
    goalThresholdUnit,
    isGoalConfirmed,
    optionPreviews,
    qualityChecks,
    repairActions,
    ceeQuality,
    hasDefaultStrengths,
    defaultStrengthPercent,
    coachingSummary,
    contestedEdges,
    balanceScore,
  }
}

export default usePreAnalysisData
