/**
 * usePreAnalysisData - Issue Normalisation Layer for Pre-Analysis Panel v2.1
 *
 * Normalises all issue sources into a single NormalisedIssue structure:
 * - draft_warnings (from CEE extended_warnings)
 * - validation_warnings (from usePreRunValidation)
 * - connectivity (from CEE goal_connectivity)
 * - derived (client-side detection like same-lever, missing baseline)
 *
 * This provides a unified data layer for the PreAnalysisReadinessPanel.
 */

import { useMemo } from 'react'
import { useCanvasStore } from '../store'
import { useShallow } from 'zustand/shallow'
import { usePreRunValidation, type ValidationBlocker } from './usePreRunValidation'
import { useGraphReadiness } from './useGraphReadiness'
import type { Node, Edge } from '@xyflow/react'
import { CIL_WARNING_CODES } from '@talchain/schemas'
import type {
  CEEDraftWarning,
  CEEGoalConnectivity,
  CEEOptionV3,
  CEEModelQualityFactors,
  CEEInterventionHint,
} from '../../adapters/cee/types'

// ============================================================================
// Types
// ============================================================================

/**
 * Normalised issue structure - all sources map to this
 */
export interface NormalisedIssue {
  /** Unique identifier (warningKey, not mixed id/code) */
  key: string
  /** Severity level */
  severity: 'blocker' | 'high' | 'medium' | 'low'
  /** Issue category for grouping and priority */
  category: 'connectivity' | 'framing' | 'estimates' | 'validation'
  /** 1-line problem description */
  title: string
  /** 1-line explanation of why it matters */
  why: string
  /** Focus target for canvas navigation */
  focus?: {
    type: 'node' | 'edge'
    id: string
    label: string
  }
  /** Available actions for this issue */
  actions: NormalisedAction[]
  /** Source of this issue for debugging/analytics */
  source: 'draft_warning' | 'validation_warning' | 'connectivity' | 'derived'
}

/**
 * Action available for an issue
 */
export interface NormalisedAction {
  /** Unique key for tracking */
  key: string
  /** Button text (from controlled set) */
  label: string
  /** Action type */
  kind: 'focus' | 'navigate' | 'apply'
}

/**
 * Quality scores from CEE
 */
export interface QualityScores {
  structure: number
  coverage: number
  safety: number
}

/**
 * Limiting factor result
 */
export interface LimitingFactor {
  label: string
  hasActiveIssues: boolean
}

// ============================================================================
// Constants - Controlled CTA Labels
// ============================================================================

/**
 * Controlled CTA labels - never use fix_hint as button text
 */
export const CTA_LABELS = {
  focus: 'Focus \u2192',
  markBaseline: 'Mark baseline \u2192',
  addOption: 'Add option \u2192',
  reviewRelationship: 'Review \u2192',
  strengthenConnection: 'Connect \u2192',
  view: 'View \u2192',
} as const

/**
 * Category mapping for warning codes
 */
const CATEGORY_MAP: Record<string, NormalisedIssue['category']> = {
  // Framing issues
  missing_baseline: 'framing',
  MISSING_BASELINE: 'framing',
  same_lever: 'framing',
  SAME_LEVER_OPTIONS: 'framing',
  goal_no_baseline_value: 'framing',
  GOAL_NO_BASELINE_VALUE: 'framing',

  // Estimates issues
  RANGE_DEGENERATE: 'estimates',
  NORMALISATION_INPUT_INSUFFICIENT: 'estimates',

  // Validation issues
  GOAL_CONNECTIVITY_NONE: 'validation',
  STRENGTH_CLUSTERING: 'validation',
  EDGE_ORIGIN_DEFAULTED: 'validation',

  // Connectivity (handled separately but mapped for consistency)
  connectivity_none: 'connectivity',
  connectivity_partial: 'connectivity',
}

/**
 * Title mapping for warning codes
 */
const TITLE_MAP: Record<string, string> = {
  missing_baseline: 'No baseline option identified',
  MISSING_BASELINE: 'No baseline option identified',
  same_lever: 'Multiple options target the same factor',
  SAME_LEVER_OPTIONS: 'Multiple options target the same factor',
  goal_no_baseline_value: 'Goal has no baseline value',
  GOAL_NO_BASELINE_VALUE: 'Goal has no baseline value',
  RANGE_DEGENERATE: 'Range values need review',
  NORMALISATION_INPUT_INSUFFICIENT: 'Insufficient data for normalisation',
  STRENGTH_CLUSTERING: 'Relationship strengths are clustered',
  EDGE_ORIGIN_DEFAULTED: 'Relationship uses default values',
  GOAL_CONNECTIVITY_NONE: 'Options don\'t connect to your goal',
  INTERVENTION_TARGET_NOT_FOUND: 'Options reference missing factor',
  OPTIONS_NEED_MAPPING: 'Options need numeric values',
  EMPTY_INTERVENTIONS: 'Options have no interventions',
  MISSING_GOAL_NODE: 'No goal selected',
  GOAL_NODE_NOT_FOUND: 'Goal node was deleted',
  GOAL_NODE_KIND_MISMATCH: 'Selected node is not a goal',
  ANALYSIS_NOT_READY: 'Draft incomplete — try re-drafting',
  needs_encoding: 'Options need numeric values',
  needs_user_mapping: 'Options need configuration',
}

/**
 * Actions mapping for warning codes
 */
const ACTIONS_MAP: Record<string, NormalisedAction[]> = {
  missing_baseline: [
    { key: 'mark_baseline', label: CTA_LABELS.markBaseline, kind: 'navigate' },
  ],
  MISSING_BASELINE: [
    { key: 'mark_baseline', label: CTA_LABELS.markBaseline, kind: 'navigate' },
  ],
  same_lever: [
    { key: 'focus', label: CTA_LABELS.focus, kind: 'focus' },
    { key: 'add_option', label: CTA_LABELS.addOption, kind: 'navigate' },
  ],
  SAME_LEVER_OPTIONS: [
    { key: 'focus', label: CTA_LABELS.focus, kind: 'focus' },
    { key: 'add_option', label: CTA_LABELS.addOption, kind: 'navigate' },
  ],
  goal_no_baseline_value: [
    { key: 'focus', label: CTA_LABELS.focus, kind: 'focus' },
  ],
  GOAL_NO_BASELINE_VALUE: [
    { key: 'focus', label: CTA_LABELS.focus, kind: 'focus' },
  ],
}

/**
 * Edge-related warning codes that should focus edge first
 */
const EDGE_WARNINGS = new Set([
  CIL_WARNING_CODES.EDGE_STRENGTH_LOW,
  'weak_path',
  'STRENGTH_CLUSTERING',
  'EDGE_ORIGIN_DEFAULTED',
])

// ============================================================================
// Normalisation Functions
// ============================================================================

/**
 * Get focus target with precedence: edge first for edge warnings, else node
 */
function getFocusTarget(
  edgeIds: string[],
  nodeIds: string[],
  warningKey: string,
  nodes: Node[],
  edges: Edge[]
): NormalisedIssue['focus'] | undefined {
  // Edge-related warnings focus edge first
  if (EDGE_WARNINGS.has(warningKey) && edgeIds.length > 0) {
    const edgeId = edgeIds[0]
    const edge = edges.find(e => e.id === edgeId)
    if (edge) {
      const sourceNode = nodes.find(n => n.id === edge.source)
      const targetNode = nodes.find(n => n.id === edge.target)
      const sourceLabel = (sourceNode?.data as any)?.label ?? edge.source
      const targetLabel = (targetNode?.data as any)?.label ?? edge.target
      return { type: 'edge', id: edgeId, label: `${sourceLabel} \u2192 ${targetLabel}` }
    }
    // Fallback if edge not found
    const [fromId, toId] = edgeId.split('->')
    return { type: 'edge', id: edgeId, label: `${fromId} \u2192 ${toId}` }
  }

  // Node focus for non-edge warnings or when no edge available
  if (nodeIds.length > 0) {
    const nodeId = nodeIds[0]
    const node = nodes.find(n => n.id === nodeId)
    const label = (node?.data as any)?.label ?? nodeId
    return { type: 'node', id: nodeId, label }
  }

  return undefined
}

/**
 * Normalise a CEE draft warning into NormalisedIssue
 */
function normaliseDraftWarning(
  warning: CEEDraftWarning,
  nodes: Node[],
  edges: Edge[]
): NormalisedIssue {
  // Use id as the warning key (not code)
  const warningKey = warning.id

  // Get category from code, fallback to validation
  const category = CATEGORY_MAP[warning.code ?? ''] ?? 'validation'

  // Get title from code, fallback to message
  const title = TITLE_MAP[warning.code ?? ''] ?? warning.message

  // Get focus target with precedence
  const focus = getFocusTarget(
    warning.affected_edge_ids,
    warning.affected_node_ids,
    warning.code ?? '',
    nodes,
    edges
  )

  // Get actions from code, fallback to focus action
  const actions = ACTIONS_MAP[warning.code ?? ''] ?? [
    { key: 'focus', label: CTA_LABELS.focus, kind: 'focus' as const },
  ]

  return {
    key: warningKey,
    severity: warning.severity,
    category,
    title,
    why: warning.fix_hint ?? warning.message, // fix_hint becomes explanatory "why", NOT button
    focus,
    actions,
    source: 'draft_warning',
  }
}

/**
 * Normalise a validation blocker into NormalisedIssue
 */
function normaliseValidationBlocker(
  blocker: ValidationBlocker,
  nodes: Node[]
): NormalisedIssue {
  const warningKey = `validation_${blocker.code}`
  const nodeId = blocker.action?.nodeId ?? blocker.affectedIds?.[0]

  // Get human-readable label for affected node
  let focusLabel = nodeId ?? ''
  if (nodeId) {
    const node = nodes.find(n => n.id === nodeId)
    focusLabel = (node?.data as any)?.label ?? nodeId
  }

  return {
    key: warningKey,
    severity: 'blocker',
    category: 'validation',
    title: TITLE_MAP[blocker.code] ?? blocker.message,
    why: blocker.message,
    focus: nodeId ? { type: 'node', id: nodeId, label: focusLabel } : undefined,
    actions: nodeId
      ? [{ key: 'focus', label: CTA_LABELS.focus, kind: 'focus' }]
      : [],
    source: 'validation_warning',
  }
}

/**
 * Create connectivity issue from goal connectivity status
 * Connectivity is a system signal, not a synthetic warning
 */
function getConnectivityIssue(
  connectivity: CEEGoalConnectivity | null
): NormalisedIssue | null {
  if (!connectivity || connectivity.status === 'full') return null

  return {
    key: 'connectivity_issue',
    severity: connectivity.status === 'none' ? 'blocker' : 'high',
    category: 'connectivity',
    title: connectivity.status === 'none'
      ? "Options don't connect to your goal"
      : 'Weak path from options to goal',
    why: 'Results may be unreliable without clear causal paths.',
    focus: undefined, // Connectivity issues don't have single focus
    actions: [
      { key: 'strengthen', label: CTA_LABELS.strengthenConnection, kind: 'navigate' },
    ],
    source: 'connectivity',
  }
}

/**
 * Create same-lever derived issue
 */
function getSameLeverIssue(
  sameLeverFactors: Array<{
    factorId: string
    factorLabel: string
    optionLabels: string[]
  }>,
  nodes: Node[]
): NormalisedIssue | null {
  if (sameLeverFactors.length === 0) return null

  const firstFactor = sameLeverFactors[0]
  const node = nodes.find(n => n.id === firstFactor.factorId)

  return {
    key: 'same_lever_derived',
    severity: 'medium',
    category: 'framing',
    title: 'Multiple options target the same factor',
    why: `${firstFactor.optionLabels.join(', ')} all target "${firstFactor.factorLabel}". Consider alternatives that affect different factors.`,
    focus: node ? { type: 'node', id: firstFactor.factorId, label: firstFactor.factorLabel } : undefined,
    actions: [
      { key: 'focus', label: CTA_LABELS.focus, kind: 'focus' },
      { key: 'add_option', label: CTA_LABELS.addOption, kind: 'navigate' },
    ],
    source: 'derived',
  }
}

/**
 * Create missing baseline derived issue
 */
function getMissingBaselineIssue(
  hasBaseline: boolean,
  optionCount: number
): NormalisedIssue | null {
  // Only show if we have 2+ options and no baseline
  if (hasBaseline || optionCount < 2) return null

  return {
    key: 'missing_baseline_derived',
    severity: 'low',
    category: 'framing',
    title: 'No baseline option identified',
    why: 'Consider marking one option as your "do nothing" or "status quo" baseline for comparison.',
    focus: undefined,
    actions: [
      { key: 'mark_baseline', label: CTA_LABELS.markBaseline, kind: 'navigate' },
    ],
    source: 'derived',
  }
}

// ============================================================================
// Sorting and Priority
// ============================================================================

/**
 * Priority order for categories (lower = higher priority)
 */
const CATEGORY_PRIORITY: Record<NormalisedIssue['category'], number> = {
  connectivity: 0,
  framing: 1,
  estimates: 2,
  validation: 3,
}

/**
 * Priority order for severities (lower = higher priority)
 */
const SEVERITY_PRIORITY: Record<NormalisedIssue['severity'], number> = {
  blocker: 0,
  high: 1,
  medium: 2,
  low: 3,
}

/**
 * Sort issues by priority: category first, then severity
 */
export function sortIssuesByPriority(issues: NormalisedIssue[]): NormalisedIssue[] {
  return [...issues].sort((a, b) => {
    // Sort by category first
    const catDiff = CATEGORY_PRIORITY[a.category] - CATEGORY_PRIORITY[b.category]
    if (catDiff !== 0) return catDiff

    // Then by severity
    return SEVERITY_PRIORITY[a.severity] - SEVERITY_PRIORITY[b.severity]
  })
}

/**
 * Get limiting factor with priority: active issues first, then lowest score
 */
export function getLimitingFactor(
  quality: QualityScores | null,
  issues: NormalisedIssue[]
): LimitingFactor {
  // 1. Connectivity broken
  const connectivityIssue = issues.find(i =>
    i.category === 'connectivity' && i.severity === 'blocker'
  )
  if (connectivityIssue) {
    return { label: "Options don't connect to your goal", hasActiveIssues: true }
  }

  // 2. Active framing issues
  const framingIssues = issues.filter(i => i.category === 'framing')
  if (framingIssues.length > 0) {
    return { label: 'Framing needs attention', hasActiveIssues: true }
  }

  // 3. Active estimates issues
  const estimatesIssues = issues.filter(i => i.category === 'estimates')
  if (estimatesIssues.length > 0) {
    return { label: 'Estimates need review', hasActiveIssues: true }
  }

  // 4. Active validation issues
  const validationIssues = issues.filter(i => i.category === 'validation')
  if (validationIssues.length > 0) {
    return { label: 'Validation needs attention', hasActiveIssues: true }
  }

  // 5. Fallback to lowest quality dimension
  if (!quality) {
    return { label: 'Model quality unknown', hasActiveIssues: false }
  }

  const dimensions = [
    { name: 'Structure', score: quality.structure },
    { name: 'Coverage', score: quality.coverage },
    { name: 'Validation', score: quality.safety },
  ]
  const lowest = dimensions.sort((a, b) => a.score - b.score)[0]
  return { label: `${lowest.name} is limiting factor`, hasActiveIssues: false }
}

// ============================================================================
// Main Hook
// ============================================================================

export interface PreAnalysisData {
  /** All normalised issues from all sources */
  allIssues: NormalisedIssue[]
  /** Top 3 issues sorted by priority for Fix First section */
  fixFirstIssues: NormalisedIssue[]
  /** Count of remaining issues not in Fix First */
  remainingCount: number
  /** Limiting factor information */
  limitingFactor: LimitingFactor
  /** Quality scores */
  quality: QualityScores | null
  /** Whether analysis can run */
  canRun: boolean
  /** Whether there are any blockers */
  hasBlockers: boolean
  /** Ready options count */
  readyOptionsCount: number
  /** Total options count */
  totalOptionsCount: number
  /** Edge provenance statistics for Details accordion */
  edgeProvenance: {
    attributedCount: number
    totalCount: number
  } | null
  /** Is readiness data loading */
  isLoading: boolean
}

/**
 * Hook that provides normalised pre-analysis data
 */
export function usePreAnalysisData(): PreAnalysisData {
  // Store data
  const nodes = useCanvasStore(useShallow(s => s.nodes))
  const edges = useCanvasStore(useShallow(s => s.edges))
  const ceeAnalysisReady = useCanvasStore(s => s.ceeAnalysisReady)
  const ceeQuality = useCanvasStore(s => s.ceeQuality)
  const ceeExtendedWarnings = useCanvasStore(s => s.ceeExtendedWarnings)
  const ceeGoalConnectivity = useCanvasStore(s => s.ceeGoalConnectivity)
  const ceeModelQualityFactors = useCanvasStore(s => s.ceeModelQualityFactors)
  const ceeInterventionHints = useCanvasStore(s => s.ceeInterventionHints)

  // Validation and readiness hooks
  const preRunValidation = usePreRunValidation()
  const { readiness, loading: readinessLoading } = useGraphReadiness()

  // Normalise all issues
  const allIssues = useMemo(() => {
    const issues: NormalisedIssue[] = []
    const seenKeys = new Set<string>()

    // 1. Connectivity issue (system signal)
    const connectivityIssue = getConnectivityIssue(ceeGoalConnectivity)
    if (connectivityIssue && !seenKeys.has(connectivityIssue.key)) {
      issues.push(connectivityIssue)
      seenKeys.add(connectivityIssue.key)
    }

    // 2. Validation blockers
    for (const blocker of preRunValidation.blockers) {
      const normalised = normaliseValidationBlocker(blocker, nodes)
      if (!seenKeys.has(normalised.key)) {
        issues.push(normalised)
        seenKeys.add(normalised.key)
      }
    }

    // 3. CEE extended warnings (filter out observability-level)
    if (ceeExtendedWarnings) {
      for (const warning of ceeExtendedWarnings) {
        // Skip EDGE_ORIGIN_DEFAULTED - observability-level, not user-facing
        if (warning.code === 'EDGE_ORIGIN_DEFAULTED') continue

        const normalised = normaliseDraftWarning(warning, nodes, edges)
        if (!seenKeys.has(normalised.key)) {
          issues.push(normalised)
          seenKeys.add(normalised.key)
        }
      }
    }

    // 4. Derived: Same lever detection
    const sameLeverFactors = detectSameLever(ceeAnalysisReady?.options, nodes, ceeInterventionHints)
    // Only add if CEE didn't already provide SAME_LEVER_OPTIONS warning
    if (sameLeverFactors.length > 0 && !seenKeys.has('SAME_LEVER_OPTIONS')) {
      const sameLeverIssue = getSameLeverIssue(sameLeverFactors, nodes)
      if (sameLeverIssue && !seenKeys.has(sameLeverIssue.key)) {
        issues.push(sameLeverIssue)
        seenKeys.add(sameLeverIssue.key)
      }
    }

    // 5. Derived: Missing baseline detection
    const optionNodes = nodes.filter(n => n.type === 'option' || n.type === 'decision')
    const hasBaseline = optionNodes.some(n => (n.data as any)?.is_baseline === true) ||
      ceeModelQualityFactors?.has_baseline_option === true
    // Only add if CEE didn't already provide MISSING_BASELINE warning
    if (!seenKeys.has('MISSING_BASELINE') && !seenKeys.has('missing_baseline')) {
      const baselineIssue = getMissingBaselineIssue(hasBaseline, optionNodes.length)
      if (baselineIssue && !seenKeys.has(baselineIssue.key)) {
        issues.push(baselineIssue)
        seenKeys.add(baselineIssue.key)
      }
    }

    return issues
  }, [
    nodes,
    edges,
    preRunValidation.blockers,
    ceeExtendedWarnings,
    ceeGoalConnectivity,
    ceeAnalysisReady?.options,
    ceeModelQualityFactors,
    ceeInterventionHints,
  ])

  // Fix First: top 3 sorted by priority
  const { fixFirstIssues, remainingCount } = useMemo(() => {
    const sorted = sortIssuesByPriority(allIssues)
    return {
      fixFirstIssues: sorted.slice(0, 3),
      remainingCount: Math.max(0, sorted.length - 3),
    }
  }, [allIssues])

  // Quality scores
  const quality: QualityScores | null = useMemo(() => {
    if (!ceeQuality) return null
    return {
      structure: ceeQuality.structure,
      coverage: ceeQuality.coverage,
      safety: ceeQuality.safety,
    }
  }, [ceeQuality])

  // Limiting factor
  const limitingFactor = useMemo(() => {
    return getLimitingFactor(quality, allIssues)
  }, [quality, allIssues])

  // Can run analysis
  const hasBlockers = allIssues.some(i => i.severity === 'blocker')
  const graphCanRun = readinessLoading ? true : (readiness?.can_run_analysis ?? true)
  // Single source of truth: usePreRunValidation handles status checking
  // (including LLM omission resilience). No redundant independent status gate.
  const canRun = preRunValidation.canRun && !hasBlockers && graphCanRun

  // Ready options count
  const readyOptionsCount = ceeAnalysisReady?.options?.filter(o => o.status === 'ready').length ??
    nodes.filter(n => n.type === 'option' || n.type === 'decision').length
  const totalOptionsCount = ceeAnalysisReady?.options?.length ??
    nodes.filter(n => n.type === 'option' || n.type === 'decision').length

  // Edge provenance for Details accordion
  const edgeProvenance = useMemo(() => {
    if (edges.length === 0) return null

    let attributedCount = 0
    for (const edge of edges) {
      const data = edge.data as { formProvenance?: string; provenance?: string } | undefined
      const provenance = data?.formProvenance ?? data?.provenance
      if (provenance && provenance !== 'unknown') {
        attributedCount++
      }
    }

    return {
      attributedCount,
      totalCount: edges.length,
    }
  }, [edges])

  return {
    allIssues,
    fixFirstIssues,
    remainingCount,
    limitingFactor,
    quality,
    canRun,
    hasBlockers,
    readyOptionsCount,
    totalOptionsCount,
    edgeProvenance,
    isLoading: readinessLoading,
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Detect same-lever issues (multiple options targeting same factor)
 */
function detectSameLever(
  options: CEEOptionV3[] | undefined,
  nodes: Node[],
  interventionHints: Record<string, CEEInterventionHint> | null
): Array<{ factorId: string; factorLabel: string; optionLabels: string[] }> {
  if (!options) return []

  // Filter to ready options with at least one intervention
  const validOptions = options.filter(
    o => o.status === 'ready' && Object.keys(o.interventions || {}).length > 0
  )

  if (validOptions.length < 2) return []

  // Count how many options target each factor
  const targetCounts: Record<string, { optionLabels: string[]; factorId: string }> = {}

  for (const option of validOptions) {
    const targets = Object.keys(option.interventions || {})
    for (const targetId of targets) {
      if (!targetCounts[targetId]) {
        targetCounts[targetId] = { optionLabels: [], factorId: targetId }
      }
      targetCounts[targetId].optionLabels.push(option.label)
    }
  }

  // Find factors targeted by 2+ options
  return Object.entries(targetCounts)
    .filter(([, info]) => info.optionLabels.length >= 2)
    .map(([factorId, info]) => {
      const factorNode = nodes.find(n => n.id === factorId)
      return {
        factorId,
        factorLabel: (factorNode?.data as any)?.label ?? factorId,
        optionLabels: info.optionLabels,
      }
    })
}

export default usePreAnalysisData
