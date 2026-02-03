/**
 * Pre-Run Validation Hook (Phase 0.6)
 *
 * Pure validation that returns recommended fixes without mutating state.
 * This prevents side effects during validation and gives callers control
 * over when/whether to apply fixes.
 *
 * Key principles:
 * - Validation is pure (no side effects)
 * - Returns recommended fixes as data, not applied directly
 * - Caller decides whether to apply fixes
 * - Mirrors common backend blockers for early detection
 */

import { useMemo, useEffect, useRef } from 'react'
import { useCanvasStore } from '../store'
import { useShallow } from 'zustand/shallow'
import type { Node, Edge } from '@xyflow/react'
import type { UIOption } from '../../types/options'
import { normaliseOptionFromLegacyNode, type LegacyOptionNode } from '../../types/options'
import { validateAllEdges, ceeOptionToUIOption } from '../../adapters/plot/v2'
import type { CEEAnalysisReady } from '../../adapters/cee/types'
import { detectBaseline } from '../utils/baselineDetection'

// ============================================================================
// Types
// ============================================================================

export interface ValidationBlocker {
  /** Unique code for this blocker type */
  code: string
  /** Human-readable message */
  message: string
  /** Affected node/option IDs */
  affectedIds?: string[]
  /** Suggested action */
  action?: {
    type: string
    label: string
    nodeId?: string
    optionId?: string
  }
}

export interface ValidationWarning {
  /** Unique code for this warning type */
  code: string
  /** Human-readable message */
  message: string
  /** Additional suggestion */
  suggestion?: string
  /** Affected node/option ID */
  affectedId?: string
}

export interface RecommendedFix {
  /** Type of fix */
  type: 'clear_stale_goal' | 'clear_stale_outcome'
  /** State update to apply */
  stateUpdate: Record<string, unknown>
  /** Reason for the fix */
  reason: string
}

export interface ValidationResult {
  /** Whether analysis can proceed */
  canRun: boolean
  /** Issues that prevent running */
  blockers: ValidationBlocker[]
  /** Issues that should be addressed but don't block */
  warnings: ValidationWarning[]
  /** Recommended state changes (caller decides whether to apply) */
  recommendedFixes?: RecommendedFix[]
  /** User-facing questions from CEE explaining why analysis can't proceed */
  userQuestions?: string[]
}

// ============================================================================
// Validation Functions (Pure)
// ============================================================================

/**
 * Validate goal node state.
 * Returns blockers if goal is missing/invalid, and recommended fixes for stale references.
 */
function validateGoalNode(
  goalNodeId: string | null,
  nodes: Node[]
): { blockers: ValidationBlocker[]; fixes: RecommendedFix[] } {
  const blockers: ValidationBlocker[] = []
  const fixes: RecommendedFix[] = []

  if (!goalNodeId) {
    blockers.push({
      code: 'MISSING_GOAL_NODE',
      message: 'No goal node selected',
      action: { type: 'select_goal_node', label: 'Select goal node' },
    })
    return { blockers, fixes }
  }

  const goalNode = nodes.find((n) => n.id === goalNodeId)

  if (!goalNode) {
    // Stale reference — recommend fix
    blockers.push({
      code: 'GOAL_NODE_NOT_FOUND',
      message: 'Selected goal node no longer exists',
      action: { type: 'select_goal_node', label: 'Select new goal node' },
    })

    fixes.push({
      type: 'clear_stale_goal',
      stateUpdate: { outcomeNodeId: null },
      reason: `Goal node "${goalNodeId}" was deleted`,
    })
    return { blockers, fixes }
  }

  // Check if node is actually a goal type
  const nodeKind = (goalNode.data as { kind?: string })?.kind
  if (nodeKind !== 'goal' && nodeKind !== 'outcome') {
    blockers.push({
      code: 'GOAL_NODE_KIND_MISMATCH',
      message: `Selected node "${(goalNode.data as { label?: string })?.label || goalNode.id}" is not marked as a goal`,
      action: { type: 'mark_as_goal', nodeId: goalNode.id, label: 'Mark as goal' },
    })
  }

  return { blockers, fixes }
}

/**
 * Validate overall analysis_ready status.
 *
 * Checks the top-level status field which indicates if the graph
 * has structural issues (e.g., no causal path to goal).
 */
function validateOverallStatus(
  ceeAnalysisReady?: CEEAnalysisReady | null
): { blockers: ValidationBlocker[]; userQuestions: string[] } {
  const blockers: ValidationBlocker[] = []
  const userQuestions: string[] = []

  // If no ceeAnalysisReady or no status, don't block (legacy fallback path)
  if (!ceeAnalysisReady?.status) {
    return { blockers, userQuestions }
  }

  // Check overall status
  if (ceeAnalysisReady.status !== 'ready') {
    const statusMessages: Record<string, string> = {
      needs_user_mapping: 'Graph has structural issues that need your input',
      needs_encoding: 'Some options have categorical values that need encoding',
    }

    blockers.push({
      code: 'ANALYSIS_NOT_READY',
      message: statusMessages[ceeAnalysisReady.status] || 'Analysis not ready',
      action: { type: 'review_graph', label: 'Review graph' },
    })

    // Capture user_questions from CEE
    if (ceeAnalysisReady.user_questions?.length) {
      userQuestions.push(...ceeAnalysisReady.user_questions)
    }
  }

  return { blockers, userQuestions }
}

/**
 * Extract and validate options.
 *
 * Priority:
 * 1. If ceeAnalysisReady has options, use those (CEE has resolved interventions)
 * 2. Otherwise, extract from canvas nodes (legacy fallback)
 */
function validateOptions(
  nodes: Node[],
  ceeAnalysisReady?: CEEAnalysisReady | null
): { options: UIOption[]; blockers: ValidationBlocker[]; warnings: ValidationWarning[] } {
  const blockers: ValidationBlocker[] = []
  const warnings: ValidationWarning[] = []

  // Priority 1: Use ceeAnalysisReady options if available
  // These come from CEE with resolved interventions and are authoritative
  if (ceeAnalysisReady?.options?.length) {
    const options = ceeAnalysisReady.options.map(ceeOptionToUIOption)

    // Note: Logging moved to usePreRunValidation hook to reduce noise
    // Only logs when validation result actually changes

    // Check for options needing mapping (CEE may return some as needs_user_mapping)
    const needsMappingOptions = options.filter((o) => {
      if (o.status !== 'needs_user_mapping') return false
      const isBaselineEmpty =
        detectBaseline(o.label).isBaseline && Object.keys(o.interventions).length === 0
      return !isBaselineEmpty
    })
    if (needsMappingOptions.length > 0) {
      blockers.push({
        code: 'OPTIONS_NEED_MAPPING',
        message: `${needsMappingOptions.length} option(s) need intervention values`,
        affectedIds: needsMappingOptions.map((o) => o.id),
        action: {
          type: 'configure_option',
          label: 'Configure options',
          optionId: needsMappingOptions[0].id,
        },
      })
    }

    // Check for options with empty interventions
    const emptyInterventionOptions = options.filter((o) => {
      if (o.status !== 'ready') return false
      if (Object.keys(o.interventions).length !== 0) return false
      return !detectBaseline(o.label).isBaseline
    })
    if (emptyInterventionOptions.length > 0) {
      blockers.push({
        code: 'EMPTY_INTERVENTIONS',
        message: `${emptyInterventionOptions.length} option(s) have no interventions`,
        affectedIds: emptyInterventionOptions.map((o) => o.id),
        action: {
          type: 'configure_option',
          label: 'Add interventions',
          optionId: emptyInterventionOptions[0].id,
        },
      })
    }

    return { options, blockers, warnings }
  }

  // Priority 2: Extract from canvas nodes (legacy fallback)
  const optionNodes = nodes.filter(
    (n) => n.type === 'option' || n.type === 'decision'
  )

  if (optionNodes.length === 0) {
    blockers.push({
      code: 'NO_OPTIONS',
      message: 'No options to compare',
      action: { type: 'add_option', label: 'Add an option' },
    })
    return { options: [], blockers, warnings }
  }

  // Convert to UIOption format
  const validNodeIds = new Set(nodes.map((n) => n.id))
  const options = optionNodes.map((node) =>
    normaliseOptionFromLegacyNode(node as unknown as LegacyOptionNode, validNodeIds)
  )

  // Note: Logging moved to usePreRunValidation hook to reduce noise
  // Only logs when validation result actually changes

  // Check for options needing mapping
  // P0: Block analysis until options have interventions configured
  const needsMappingOptions = options.filter((o) => {
    if (o.status !== 'needs_user_mapping') return false
    const isBaselineEmpty =
      detectBaseline(o.label).isBaseline && Object.keys(o.interventions).length === 0
    return !isBaselineEmpty
  })
  if (needsMappingOptions.length > 0) {
    blockers.push({
      code: 'OPTIONS_NEED_MAPPING',
      message: `${needsMappingOptions.length} option(s) need intervention values`,
      affectedIds: needsMappingOptions.map((o) => o.id),
      action: {
        type: 'configure_option',
        label: 'Configure options',
        optionId: needsMappingOptions[0].id,
      },
    })
  }

  // Check for options with empty interventions (marked ready but no interventions)
  const emptyInterventionOptions = options.filter((o) => {
    if (o.status !== 'ready') return false
    if (Object.keys(o.interventions).length !== 0) return false
    return !detectBaseline(o.label).isBaseline
  })
  if (emptyInterventionOptions.length > 0) {
    blockers.push({
      code: 'EMPTY_INTERVENTIONS',
      message: `${emptyInterventionOptions.length} option(s) have no interventions`,
      affectedIds: emptyInterventionOptions.map((o) => o.id),
      action: {
        type: 'configure_option',
        label: 'Add interventions',
        optionId: emptyInterventionOptions[0].id,
      },
    })
  }

  return { options, blockers, warnings }
}

/**
 * Check intervention targets for validity.
 */
function validateInterventionTargets(
  options: UIOption[],
  nodes: Node[]
): { blockers: ValidationBlocker[]; warnings: ValidationWarning[] } {
  const blockers: ValidationBlocker[] = []
  const warnings: ValidationWarning[] = []

  const nodeIds = new Set(nodes.map((n) => n.id))
  const optionNodeIds = new Set(
    nodes
      .filter((n) => n.type === 'option' || n.type === 'decision')
      .map((n) => n.id)
  )

  for (const option of options) {
    if (option.status !== 'ready') continue

    for (const targetId of Object.keys(option.interventions)) {
      // Check target exists
      if (!nodeIds.has(targetId)) {
        warnings.push({
          code: 'INTERVENTION_TARGET_NOT_FOUND',
          message: `Option "${option.label}" targets node "${targetId}" which doesn't exist`,
          affectedId: option.id,
        })
      }

      // Check target isn't an option node
      if (optionNodeIds.has(targetId)) {
        blockers.push({
          code: 'INTERVENTION_TARGETS_OPTION',
          message: `Option "${option.label}" targets another option node, which is not allowed`,
          action: {
            type: 'edit_interventions',
            optionId: option.id,
            label: 'Fix intervention',
          },
        })
      }
    }
  }

  return { blockers, warnings }
}

/**
 * Validate edges for required fields (non-blocking warning).
 * The V2 adapter uses lenient mode (fallback defaults) for missing fields,
 * but we warn users so they can improve data quality.
 */
function validateEdges(
  edges: Edge[]
): { warnings: ValidationWarning[] } {
  const warnings: ValidationWarning[] = []

  // Use strict mode to detect issues (but don't block — just warn)
  const errors = validateAllEdges(edges as any, { strict: true })

  if (errors.length > 0) {
    // Group by missing field type for clearer messaging
    const missingDirection = errors.filter((e) =>
      e.missingFields.includes('direction')
    )
    const missingWeight = errors.filter((e) =>
      e.missingFields.includes('weight')
    )

    if (missingDirection.length > 0) {
      warnings.push({
        code: 'EDGES_MISSING_DIRECTION',
        message: `${missingDirection.length} edge(s) are missing effect direction (positive/negative)`,
        suggestion:
          'Analysis will use default direction. Click edges to set effect direction for better results.',
        affectedId: missingDirection[0].edgeId ?? `${missingDirection[0].fromNode}->${missingDirection[0].toNode}`,
      })
    }

    if (missingWeight.length > 0) {
      warnings.push({
        code: 'EDGES_MISSING_WEIGHT',
        message: `${missingWeight.length} edge(s) are missing strength/weight values`,
        suggestion:
          'Analysis will use default strength. Click edges to set strength for better results.',
        affectedId: missingWeight[0].edgeId ?? `${missingWeight[0].fromNode}->${missingWeight[0].toNode}`,
      })
    }
  }

  return { warnings }
}

/**
 * Check for potentially identical options.
 */
function checkIdenticalOptions(
  options: UIOption[]
): ValidationWarning | null {
  const readyOptions = options.filter((o) => o.status === 'ready')

  // Create canonical signatures
  const signatures = new Map<string, string>()

  for (const option of readyOptions) {
    const entries = Object.entries(option.interventions)
      // Guard against undefined intervention values (can happen during autosave recovery)
      .filter(([, iv]) => iv && typeof iv.value === 'number')
      .map(([nodeId, iv]) => `${nodeId}:${iv.value.toFixed(9)}`)
      .sort()
    const sig = entries.join('|')

    if (signatures.has(sig)) {
      return {
        code: 'IDENTICAL_OPTIONS_SUSPECTED',
        message: `Options "${signatures.get(sig)}" and "${option.label}" appear to have identical interventions`,
        suggestion:
          'Backend will block if confirmed. Consider differentiating these options.',
      }
    }

    signatures.set(sig, option.label)
  }

  return null
}

/**
 * Main validation function - pure, no side effects.
 *
 * @param goalNodeId - The selected goal node ID
 * @param nodes - Canvas nodes
 * @param edges - Canvas edges (optional)
 * @param ceeAnalysisReady - CEE analysis_ready payload (optional, takes priority over canvas nodes for options)
 */
export function validateBeforeRun(
  goalNodeId: string | null,
  nodes: Node[],
  edges?: Edge[],
  ceeAnalysisReady?: CEEAnalysisReady | null
): ValidationResult {
  const allBlockers: ValidationBlocker[] = []
  const allWarnings: ValidationWarning[] = []
  const allFixes: RecommendedFix[] = []
  let userQuestions: string[] = []

  // 0. Validate overall analysis_ready status FIRST
  // This catches structural issues like "no causal path to goal"
  const overallValidation = validateOverallStatus(ceeAnalysisReady)
  allBlockers.push(...overallValidation.blockers)
  userQuestions = overallValidation.userQuestions

  // 1. Validate goal node
  const goalValidation = validateGoalNode(goalNodeId, nodes)
  allBlockers.push(...goalValidation.blockers)
  allFixes.push(...goalValidation.fixes)

  // 2. Validate options (ceeAnalysisReady takes priority when available)
  const { options, blockers: optBlockers, warnings: optWarnings } = validateOptions(nodes, ceeAnalysisReady)
  allBlockers.push(...optBlockers)
  allWarnings.push(...optWarnings)

  // 3. Validate intervention targets (only if we have options)
  if (options.length > 0) {
    const targetValidation = validateInterventionTargets(options, nodes)
    allBlockers.push(...targetValidation.blockers)
    allWarnings.push(...targetValidation.warnings)

    // 4. Check for identical options
    const identicalWarning = checkIdenticalOptions(options)
    if (identicalWarning) {
      allWarnings.push(identicalWarning)
    }
  }

  // 5. Validate edges (non-blocking warnings for missing fields)
  if (edges && edges.length > 0) {
    const edgeValidation = validateEdges(edges)
    allWarnings.push(...edgeValidation.warnings)
  }

  return {
    canRun: allBlockers.length === 0,
    blockers: allBlockers,
    warnings: allWarnings,
    recommendedFixes: allFixes.length > 0 ? allFixes : undefined,
    userQuestions: userQuestions.length > 0 ? userQuestions : undefined,
  }
}

// ============================================================================
// React Hook
// ============================================================================

/**
 * Create a stable fingerprint for validation inputs.
 * Only changes when validation-relevant data changes.
 */
function createValidationFingerprint(
  outcomeNodeId: string | null,
  nodes: Node[],
  edges: Edge[],
  ceeAnalysisReady: CEEAnalysisReady | null
): string {
  // Only track data that affects validation
  const nodeFingerprint = nodes
    .map((n) => `${n.id}:${n.type}:${(n.data as { kind?: string })?.kind || ''}`)
    .sort()
    .join(',')

  const edgeFingerprint = edges
    .map((e) => `${e.source}->${e.target}`)
    .sort()
    .join(',')

  const ceeFingerprint = ceeAnalysisReady
    ? `${ceeAnalysisReady.status || 'none'}:${ceeAnalysisReady.options?.length || 0}:${
        ceeAnalysisReady.options?.map((o) => `${o.id}:${o.status}`).join(',') || ''
      }`
    : 'null'

  return `${outcomeNodeId || 'null'}|${nodeFingerprint}|${edgeFingerprint}|${ceeFingerprint}`
}

/**
 * Hook for pre-run validation with automatic fix application.
 *
 * Returns validation result and automatically applies recommended fixes
 * for stale references (once, not on every render).
 *
 * When ceeAnalysisReady is present in the store, its options take priority
 * over canvas node options for validation (CEE has resolved interventions).
 *
 * Uses shallow selectors and fingerprinting to prevent unnecessary re-renders.
 */
export function usePreRunValidation(): ValidationResult {
  const outcomeNodeId = useCanvasStore((s) => s.outcomeNodeId)
  // Use shallow comparison to prevent re-renders when array content is the same
  const nodes = useCanvasStore(useShallow((s) => s.nodes))
  const edges = useCanvasStore(useShallow((s) => s.edges))
  const ceeAnalysisReady = useCanvasStore((s) => s.ceeAnalysisReady)
  const setOutcomeNode = useCanvasStore((s) => s.setOutcomeNode)

  // Track fingerprint to detect actual changes
  const lastLoggedResultRef = useRef<{ canRun: boolean; blockerCount: number } | null>(null)

  // Create fingerprint for current inputs
  const fingerprint = useMemo(
    () => createValidationFingerprint(outcomeNodeId, nodes, edges, ceeAnalysisReady),
    [outcomeNodeId, nodes, edges, ceeAnalysisReady]
  )

  const validation = useMemo(() => {
    const result = validateBeforeRun(outcomeNodeId, nodes, edges, ceeAnalysisReady)

    // Only log when validation result actually changes (DEV mode)
    if (import.meta.env.DEV) {
      const currentLogKey = { canRun: result.canRun, blockerCount: result.blockers.length }
      const lastLogKey = lastLoggedResultRef.current

      // Log only on first run or when result changes
      if (
        !lastLogKey ||
        lastLogKey.canRun !== currentLogKey.canRun ||
        lastLogKey.blockerCount !== currentLogKey.blockerCount
      ) {
        console.log('[PreRunValidation] Validation result changed:', {
          canRun: result.canRun,
          blockers: result.blockers.length,
          usingCEE: Boolean(ceeAnalysisReady?.options?.length),
        })
        lastLoggedResultRef.current = currentLogKey
      }
    }

    return result
  }, [fingerprint, outcomeNodeId, nodes, edges, ceeAnalysisReady])

  // Apply recommended fixes (once, not on every render)
  useEffect(() => {
    if (validation.recommendedFixes?.length) {
      for (const fix of validation.recommendedFixes) {
        if (import.meta.env.DEV) {
          console.log(`[Validation] Applying recommended fix: ${fix.reason}`)
        }

        // Apply the fix based on type
        if (fix.type === 'clear_stale_goal' || fix.type === 'clear_stale_outcome') {
          if ('outcomeNodeId' in fix.stateUpdate && fix.stateUpdate.outcomeNodeId === null) {
            setOutcomeNode(null)
          }
        }
      }
    }
  }, [validation.recommendedFixes, setOutcomeNode])

  return validation
}

/**
 * Simple boolean check for whether analysis can run.
 * Useful for button disabled state.
 */
export function useCanRunAnalysis(): boolean {
  const validation = usePreRunValidation()
  return validation.canRun
}
