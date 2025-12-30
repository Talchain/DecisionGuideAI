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

import { useMemo, useEffect } from 'react'
import { useCanvasStore } from '../store'
import type { Node, Edge } from '@xyflow/react'
import type { UIOption } from '../../types/options'
import { normaliseOptionFromLegacyNode, type LegacyOptionNode } from '../../types/options'
import { validateAllEdges, EdgeValidationError, ceeOptionToUIOption } from '../../adapters/plot/v2'
import type { CEEAnalysisReady } from '../../adapters/cee/types'

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

    if (import.meta.env.DEV) {
      console.log('[PreRunValidation] Using ceeAnalysisReady options:', {
        count: options.length,
        statuses: options.map((o) => ({ id: o.id, status: o.status })),
      })
    }

    // Check for options needing mapping (CEE may return some as needs_user_mapping)
    const needsMappingOptions = options.filter((o) => o.status === 'needs_user_mapping')
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
    const emptyInterventionOptions = options.filter(
      (o) => o.status === 'ready' && Object.keys(o.interventions).length === 0
    )
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

  if (import.meta.env.DEV) {
    console.log('[PreRunValidation] Using canvas node options (no ceeAnalysisReady):', {
      count: options.length,
      statuses: options.map((o) => ({ id: o.id, status: o.status })),
    })
  }

  // Check for options needing mapping
  // P0: Block analysis until options have interventions configured
  const needsMappingOptions = options.filter((o) => o.status === 'needs_user_mapping')
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
  const emptyInterventionOptions = options.filter(
    (o) => o.status === 'ready' && Object.keys(o.interventions).length === 0
  )
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
        affectedId: missingDirection[0].edgeId ?? `${missingDirection[0].from}->${missingDirection[0].to}`,
      })
    }

    if (missingWeight.length > 0) {
      warnings.push({
        code: 'EDGES_MISSING_WEIGHT',
        message: `${missingWeight.length} edge(s) are missing strength/weight values`,
        suggestion:
          'Analysis will use default strength. Click edges to set strength for better results.',
        affectedId: missingWeight[0].edgeId ?? `${missingWeight[0].from}->${missingWeight[0].to}`,
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
  }
}

// ============================================================================
// React Hook
// ============================================================================

/**
 * Hook for pre-run validation with automatic fix application.
 *
 * Returns validation result and automatically applies recommended fixes
 * for stale references (once, not on every render).
 *
 * When ceeAnalysisReady is present in the store, its options take priority
 * over canvas node options for validation (CEE has resolved interventions).
 */
export function usePreRunValidation(): ValidationResult {
  const outcomeNodeId = useCanvasStore((s) => s.outcomeNodeId)
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const ceeAnalysisReady = useCanvasStore((s) => s.ceeAnalysisReady)
  const setOutcomeNode = useCanvasStore((s) => s.setOutcomeNode)

  const validation = useMemo(
    () => validateBeforeRun(outcomeNodeId, nodes, edges, ceeAnalysisReady),
    [outcomeNodeId, nodes, edges, ceeAnalysisReady]
  )

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
