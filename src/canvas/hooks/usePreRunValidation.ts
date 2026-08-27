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
import type { Node, Edge } from '@xyflow/react'
import type { UIOption } from '../../types/options'
import { normaliseOptionFromLegacyNode, type LegacyOptionNode } from '../../types/options'
import { validateAllEdges, ceeOptionToUIOption } from '../../adapters/plot/v2'
import {
  RECOGNISED_ANALYSIS_READY_STATUSES,
  type CEEAnalysisReady,
  type RecognisedAnalysisReadyStatus,
} from '../../adapters/cee/types'
import {
  ANALYSIS_REFUSAL_GENERIC_REASON,
  describeAnalysisRefusalReason,
} from '../store/analysisRefusalNotice'
import { detectBaseline } from '../utils/baselineDetection'
import { DEFAULT_EDGE_DATA } from '../domain/edges'
import { verboseWarn } from '../../utils/verboseLog'
import { getEdgeKey } from '../domain/edgeUtils'
import type { ValidationWarning, ValidationBlocker } from '@talchain/schemas'

/**
 * What this gate DOES about each status it recognises.
 *
 * ⭐ THIS MAP IS THE DRIFT GUARD, and it is load-bearing rather than
 * decorative — every branch below is selected from it, so it cannot agree with
 * itself while the validator does something else (trap 13b).
 *
 * `Record<RecognisedAnalysisReadyStatus, …>` is total by construction:
 *   • a member ADDED to `RECOGNISED_ANALYSIS_READY_STATUSES` and not given a
 *     disposition here is a TS2741 missing-property error;
 *   • a member REMOVED there leaves an excess key here — a TS2353 error.
 * Either way the BUILD breaks. That is the fail-loud CLAUDE.md trap 12 asks for
 * where derivation is impossible, and derivation IS impossible here: CEE's
 * `AnalysisReadyStatus` is not exported by `@talchain/schemas` at the 0.48.0 pin
 * (measured with contrast controls — see the note on the vocabulary itself).
 *
 * Before this map, the recognised set was a hand-typed copy of the producer's
 * enum that was one member short. `blocked` fell through to the defensive
 * unrecognised branch, so a refused analysis told the user
 * `Unrecognised analysis status "blocked". Please re-draft.` and offered a
 * re-draft that discards options added in chat.
 */
type StatusDisposition =
  /** CEE says this model can be analysed. */
  | 'runnable'
  /** CEE REFUSED: a validation failure prevents analysis. `blocked_reason` says why. */
  | 'producer_blocked'
  /** Deterministic user action required — hard block, never bypassed. */
  | 'hard_block_brief'
  /** LLM metadata omission; bypassable when the option data is actually resolved. */
  | 'soft_bypassable'
  /** No readiness verdict on this turn. Not a verdict — but not a licence to run. */
  | 'generic_not_ready'

const STATUS_DISPOSITION: Record<RecognisedAnalysisReadyStatus, StatusDisposition> = {
  ready: 'runnable',
  needs_user_mapping: 'soft_bypassable',
  needs_encoding: 'soft_bypassable',
  needs_user_input: 'hard_block_brief',
  blocked: 'producer_blocked',
  unknown: 'generic_not_ready',
}

/**
 * CEE statuses that the LLM produces when it drops metadata (e.g. `category`).
 * These can be soft-bypassed when the actual option data is resolved.
 * Also used by PreAnalysisPanel to determine retry eligibility.
 *
 * DERIVED from the disposition map — never hand-listed again.
 */
export const SOFT_BYPASS_STATUSES: ReadonlySet<string> = new Set(
  Object.entries(STATUS_DISPOSITION)
    .filter(([, disposition]) => disposition === 'soft_bypassable')
    .map(([status]) => status),
)

/**
 * All recognised analysis_ready.status values. Unrecognised values still trigger
 * the defensive hard block — recognising `blocked` must not become recognising
 * everything, or a jargon message is merely traded for a silent wrong answer.
 */
const RECOGNISED_STATUSES: ReadonlySet<string> = new Set(
  RECOGNISED_ANALYSIS_READY_STATUSES,
)

function dispositionOf(status: string): StatusDisposition | undefined {
  return RECOGNISED_STATUSES.has(status)
    ? STATUS_DISPOSITION[status as RecognisedAnalysisReadyStatus]
    : undefined
}

// ============================================================================
// Types
// ============================================================================

// Re-export shared types for existing consumers
export type { ValidationWarning, ValidationBlocker } from '@talchain/schemas'

export interface RecommendedFix {
  /** Type of fix */
  type: 'clear_stale_goal' | 'clear_stale_outcome'
  /** State update to apply */
  stateUpdate: Record<string, unknown>
  /** Reason for the fix */
  reason: string
}

/**
 * CEE blocker types that are informational — they do NOT block analysis.
 * constraint_dropped: phantom constraint references that CEE couldn't match
 * to a factor in the user's model. The analysis runs without them.
 */
export const NON_BLOCKING_CEE_TYPES: ReadonlySet<string> = new Set([
  'constraint_dropped',
])

export interface ValidationResult {
  /** Whether analysis can proceed */
  canRun: boolean
  /** Issues that prevent running */
  blockers: ValidationBlocker[]
  /** Non-blocking issues shown as informational warnings (e.g. constraint_dropped) */
  informationalBlockers: ValidationBlocker[]
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
 * Whether a CEE option is resolved for run purposes.
 *
 * Baseline options (the option where nothing changes) correctly carry empty interventions, so they
 * are exempt from the intervention requirement.
 *
 * ROADMAP 2.924 — this is the SINGLE predicate behind both the soft-bypass gate
 * and the user-facing copy derived from it. Deriving the sentence from the same
 * predicate that closed the gate is what stops the two drifting: the message can
 * never name a different set of options than the one the gate objected to.
 */
function isCeeOptionResolved(option: {
  status?: string
  label?: string
  interventions?: Record<string, unknown>
}): boolean {
  if (option.status !== 'ready') return false
  if (detectBaseline(option.label ?? '').isBaseline) return true
  return Object.keys(option.interventions || {}).length > 0
}

/**
 * Truthful description of what the un-resolved options actually need.
 *
 * ROADMAP 2.924 — the previous copy asserted a CAUSE it could not know ("Some
 * options have categorical values that need encoding") on a capture where the
 * option carried NO values at all (`interventions: {}`, chat-added). These
 * sentences name the OBSERVABLE state instead, which stays true across the whole
 * domain that reaches them: an option with no interventions has certainly not had
 * its values set, whatever upstream reason CEE had for downgrading the status.
 */
function describeUnresolvedOptions(
  status: string,
  unresolved: Array<{ label?: string }>
): string {
  const soleLabel = unresolved.length === 1 ? (unresolved[0]?.label ?? '').trim() : ''
  const subject = soleLabel ? `"${soleLabel}"` : `${unresolved.length} options`
  const verb = soleLabel ? 'needs' : 'need'

  if (status === 'needs_user_mapping') {
    const object = soleLabel ? 'it affects' : 'they affect'
    return `${subject} ${verb} to say which factors ${object} before analysis can run.`
  }

  // needs_encoding
  const possessive = soleLabel ? 'its' : 'their'
  return `${subject} ${verb} ${possessive} values set as numbers before analysis can run.`
}

/**
 * Validate overall analysis_ready status.
 *
 * analysis_ready is the SINGLE SOURCE OF TRUTH for run gating.
 * Top-level cee_response.options[] is for display only — never used for gating.
 *
 * Status handling is selected from STATUS_DISPOSITION, never from a string
 * comparison, so the set of statuses this function knows how to answer and the
 * set it recognises cannot drift apart:
 * - 'runnable'          ('ready'): proceed
 * - 'producer_blocked'  ('blocked'): CEE refused — explain, offer nothing destructive
 * - 'hard_block_brief'  ('needs_user_input'): hard block (deterministic, no bypass)
 * - 'soft_bypassable'   ('needs_user_mapping' / 'needs_encoding'): bypass when options resolve
 * - 'generic_not_ready' ('unknown'): no verdict; generic block + re-draft
 * - unrecognised: defensive hard block
 */
function validateOverallStatus(
  ceeAnalysisReady?: CEEAnalysisReady | null
): { blockers: ValidationBlocker[]; warnings: ValidationWarning[]; userQuestions: string[] } {
  const blockers: ValidationBlocker[] = []
  const warnings: ValidationWarning[] = []
  const userQuestions: string[] = []

  // If no ceeAnalysisReady or no status, don't block (legacy fallback path)
  if (!ceeAnalysisReady?.status) {
    return { blockers, warnings, userQuestions }
  }

  // Defensive: reject unrecognised status values
  const disposition = dispositionOf(ceeAnalysisReady.status)
  if (!disposition) {
    blockers.push({
      code: 'ANALYSIS_NOT_READY',
      message: `Unrecognised analysis status "${ceeAnalysisReady.status}". Please re-draft.`,
      action: { type: 'retry_draft', label: 'Retry Draft' },
    })
    return { blockers, warnings, userQuestions }
  }

  // Check overall status
  if (disposition !== 'runnable') {
    // CEE REFUSED this model. The status is a verdict about the GRAPH
    // (graph_structure / numeric_integrity / internal — cee
    // analysis-ready-helper.ts:1109-1113), not about an option the user can
    // open and fill in, so none of this panel's affordances recovers it.
    //
    // P8 — never ask what you cannot accept: we therefore offer NO action
    // rather than a button whose direct answer we cannot honour. `retry_draft`
    // would be worse than useless — it discards options the user added in chat
    // (the destruction ROADMAP 2.924 removed from the sibling branch) while
    // leaving a structural fault untouched.
    //
    // The sentence is DERIVED from the producer's own vocabulary via
    // `describeAnalysisRefusalReason`, the map `AnalysisRefusalNotice` already
    // uses for the same `blocked_reason` codes. Sharing one map is what stops
    // the two surfaces contradicting each other on a single payload — both
    // render on this turn. An unmapped or absent code gets the honest generic,
    // never a guessed specific.
    //
    // ⚠ NOT INHERITED: `ANALYSIS_REFUSAL_POINTER` ("The assistant's reply
    // explains the next step"). That guarantee was derived for the
    // handler-failure carrier (`composeHandlerFailureBody` sets `assistant_text`
    // on every recoverable branch). THIS carrier is the readiness one, and no
    // equivalent guarantee has been established for it — so asserting the
    // pointer here would be a promise about a different producer's behaviour.
    if (disposition === 'producer_blocked') {
      const reason = ceeAnalysisReady.blocked_reason
      const mapped = typeof reason === 'string' && reason.trim().length > 0
        ? describeAnalysisRefusalReason(reason)
        : null
      blockers.push({
        code: 'ANALYSIS_BLOCKED',
        message: mapped ?? ANALYSIS_REFUSAL_GENERIC_REASON,
      })
      if (ceeAnalysisReady.user_questions?.length) {
        userQuestions.push(...ceeAnalysisReady.user_questions)
      }
      return { blockers, warnings, userQuestions }
    }

    // needs_user_input: deterministic user action required — always hard block
    if (disposition === 'hard_block_brief') {
      blockers.push({
        code: 'ANALYSIS_NOT_READY',
        message: 'Your decision brief needs changes before analysis can run.',
        action: { type: 'retry_draft', label: 'Edit brief' },
      })
      if (ceeAnalysisReady.user_questions?.length) {
        userQuestions.push(...ceeAnalysisReady.user_questions)
      }
      return { blockers, warnings, userQuestions }
    }

    // LLM omission resilience: For known soft statuses that the LLM produces when
    // it drops `category` on factor nodes, check if options are actually
    // resolved. If so, the status was downgraded due to missing metadata —
    // not a genuine structural problem.
    const isSoftStatus = disposition === 'soft_bypassable'

    // Baseline options correctly have empty interventions (nothing changes).
    // Exclude them from the intervention requirement in the soft bypass check.
    const allOptionsResolved = isSoftStatus && (ceeAnalysisReady.options?.every(
      isCeeOptionResolved
    ) ?? false)

    if (!allOptionsResolved) {
      // ROADMAP 2.924 — the options the gate actually objected to, derived from
      // the SAME predicate as the gate above so the sentence and the gate cannot
      // disagree about which options are unresolved.
      const unresolvedOptions = (ceeAnalysisReady.options ?? []).filter(
        o => !isCeeOptionResolved(o)
      )
      const firstUnresolved = unresolvedOptions[0]

      // Truthful copy only for the two soft statuses this branch has words for.
      // A recognised-but-unhandled status (i.e. 'unknown') keeps the generic
      // sentence AND the re-draft remedy below — re-drafting is the right move
      // there, and no option of the user's is named to preserve.
      const message =
        isSoftStatus && unresolvedOptions.length > 0
          ? describeUnresolvedOptions(ceeAnalysisReady.status, unresolvedOptions)
          : 'Analysis not ready'

      // ROADMAP 2.924 — NON-DESTRUCTIVE REMEDY. This branch fires on options the
      // user may have just added in chat; `retry_draft` would DISCARD them.
      // `configure_option` routes to the product's existing working path — the
      // same action OPTIONS_NEED_MAPPING and EMPTY_INTERVENTIONS already emit,
      // which opens that option in the inspector instead of replacing the model.
      const unresolvedLabel = (firstUnresolved?.label ?? '').trim()
      const remedy: NonNullable<ValidationBlocker['action']> =
        isSoftStatus && firstUnresolved
          ? {
              type: 'configure_option',
              label: unresolvedLabel ? `Configure "${unresolvedLabel}"` : 'Configure options',
              optionId: firstUnresolved.id,
            }
          : { type: 'retry_draft', label: 'Retry Draft' }

      // Layer 1 gate relaxation (amendment #1): When interventions ARE populated
      // but allOptionsResolved failed (e.g. some options still need mapping),
      // downgrade to warning instead of hard blocker.
      const anyInterventionsPopulated = isSoftStatus && (ceeAnalysisReady.options?.some(
        o => !detectBaseline(o.label ?? '').isBaseline && Object.keys(o.interventions || {}).length > 0
      ) ?? false)

      if (anyInterventionsPopulated) {
        // Downgrade to warning — interventions exist but status disagrees
        warnings.push({
          code: 'ANALYSIS_NOT_READY',
          message,
          suggestion:
            remedy.type === 'configure_option'
              ? `${remedy.label} to set the values that are still missing — re-drafting would replace the options you already have.`
              : 'Some options have interventions but the model flagged issues. Consider re-drafting.',
        })
      } else {
        blockers.push({
          code: 'ANALYSIS_NOT_READY',
          message,
          action: remedy,
        })
      }
    }

    // Capture user_questions from CEE regardless of blocker
    if (ceeAnalysisReady.user_questions?.length) {
      userQuestions.push(...ceeAnalysisReady.user_questions)
    }
  }

  return { blockers, warnings, userQuestions }
}

/**
 * Validate that analysis_ready has required shape when present.
 *
 * Structural invariant: analysis_ready.options must be present and non-empty.
 * Per-option invariants (status, interventions) are enforced by validateOptions().
 */
function validateAnalysisReadyInvariants(
  ceeAnalysisReady?: CEEAnalysisReady | null
): { blockers: ValidationBlocker[] } {
  const blockers: ValidationBlocker[] = []

  // Only check when analysis_ready is present (no check for legacy fallback path)
  if (!ceeAnalysisReady) return { blockers }

  // Invariant: options must be present and non-empty
  if (!ceeAnalysisReady.options || ceeAnalysisReady.options.length === 0) {
    blockers.push({
      code: 'ANALYSIS_READY_INVALID',
      message: 'Analysis response is missing option data. Please re-draft.',
      action: { type: 'retry_draft', label: 'Retry Draft' },
    })
    return { blockers }
  }

  return { blockers }
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
  edges?: Edge[],
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
        detectBaseline(o.label ?? '').isBaseline && Object.keys(o.interventions).length === 0
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

    // Check for options with unknown status (not in CEE's contract)
    const unknownStatusOptions = options.filter((o) => o.status === 'unknown')
    if (unknownStatusOptions.length > 0) {
      blockers.push({
        code: 'OPTIONS_UNKNOWN_STATUS',
        message: `${unknownStatusOptions.length} option(s) have invalid status. Please re-draft.`,
        affectedIds: unknownStatusOptions.map((o) => o.id),
        action: { type: 'retry_draft', label: 'Retry Draft' },
      })
    }

    // Check for options with empty interventions
    const emptyInterventionOptions = options.filter((o) => {
      if (o.status !== 'ready') return false
      if (Object.keys(o.interventions).length !== 0) return false
      return !detectBaseline(o.label ?? '').isBaseline
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
  //
  // This fallback is a safety net. The canonical source is CEE's analysis_ready
  // in the orchestrator envelope. Remove this fallback once all paths reliably
  // provide analysis_ready.
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

  // When ceeAnalysisReady is null, check whether option nodes have intervention
  // edges (option→factor) on the graph. If they do, the model was generated by
  // CEE and the options are provisionally configured — don't produce a misleading
  // OPTIONS_NEED_MAPPING blocker. If they have NO edges, the user hasn't
  // generated a model yet, so show an accurate message.
  const needsMappingOptions = options.filter((o) => {
    if (o.status !== 'needs_user_mapping') return false
    const isBaselineEmpty =
      detectBaseline(o.label ?? '').isBaseline && Object.keys(o.interventions).length === 0
    return !isBaselineEmpty
  })
  if (needsMappingOptions.length > 0) {
    if (!ceeAnalysisReady && edges) {
      // Check if EVERY non-baseline option needing mapping has at least one
      // outgoing edge to a non-option node (intervention edge from CEE model
      // generation). If any option lacks edges, the model is incomplete.
      const optionIds = new Set(optionNodes.map((n) => n.id))
      const allOptionsHaveEdges = needsMappingOptions.every((o) =>
        edges.some((e) => e.source === o.id && !optionIds.has(e.target))
      )

      if (allOptionsHaveEdges) {
        // Every option has intervention edges — provisionally ready. CEE hasn't
        // provided analysis_ready yet but the graph structure is sound.
        // Skip the blocker; the next CEE envelope will gate authoritatively.
      } else {
        // No intervention edges — user hasn't generated a model yet
        blockers.push({
          code: 'OPTIONS_NEED_MAPPING',
          message: 'Generate a model to configure options',
          affectedIds: needsMappingOptions.map((o) => o.id),
          action: {
            type: 'retry_draft',
            label: 'Generate model',
          },
        })
      }
    } else {
      // CEE path present but options still need mapping — genuine blocker
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
  }

  // Check for options with empty interventions (marked ready but no interventions)
  const emptyInterventionOptions = options.filter((o) => {
    if (o.status !== 'ready') return false
    if (Object.keys(o.interventions).length !== 0) return false
    return !detectBaseline(o.label ?? '').isBaseline
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
 * Detect when most edges still have default weight.
 * Fires when >80% of edges use DEFAULT_EDGE_DATA.weight and total >5.
 * Per user amendment #6: specific copy for the warning.
 */
function checkDefaultStrengths(
  edges: Edge[]
): ValidationWarning | null {
  if (edges.length <= 5) return null

  const defaultWeight = DEFAULT_EDGE_DATA.weight
  const defaultCount = edges.filter((e) => {
    const w = (e.data as { weight?: number })?.weight
    return w === defaultWeight || w === undefined || w === null
  }).length

  const ratio = defaultCount / edges.length
  if (ratio <= 0.8) return null

  return {
    code: 'STRENGTH_DEFAULTS_DOMINANT',
    message: `${defaultCount} of ${edges.length} relationships use default strength — results may lack differentiation`,
    suggestion: 'Click relationships to set custom strengths for more accurate analysis.',
  }
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
  allWarnings.push(...overallValidation.warnings)
  userQuestions = overallValidation.userQuestions

  // 0b. Pre-run invariants: validate analysis_ready shape when present
  const invariantValidation = validateAnalysisReadyInvariants(ceeAnalysisReady)
  allBlockers.push(...invariantValidation.blockers)

  // 1. Validate goal node
  const goalValidation = validateGoalNode(goalNodeId, nodes)
  allBlockers.push(...goalValidation.blockers)
  allFixes.push(...goalValidation.fixes)

  // 2. Validate options (ceeAnalysisReady takes priority when available)
  const { options, blockers: optBlockers, warnings: optWarnings } = validateOptions(nodes, edges, ceeAnalysisReady)
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

    // 6. Check for dominant default strengths
    const strengthWarning = checkDefaultStrengths(edges)
    if (strengthWarning) {
      allWarnings.push(strengthWarning)
    }
  }

  // 7. Merge CEE-provided blockers (supplement graph-derived blockers)
  // CEE blockers have richer pipeline context; deduplicate by factor_id, preferring CEE version.
  // External factors are excluded — they legitimately have no option→factor edges.
  // Non-blocking types (constraint_dropped) are separated into informationalBlockers.
  const allInformationalBlockers: ValidationBlocker[] = []

  if (ceeAnalysisReady?.blockers?.length) {
    // Build node lookup for category checks
    const nodeById = new Map(nodes.map(n => [n.id, n]))

    // Dedupe CEE blockers by factor_id (keep first occurrence)
    // Exclude external factors — they represent environmental conditions outside user control
    const seenCeeFactorIds = new Set<string>()
    const dedupedCeeBlockers = ceeAnalysisReady.blockers.filter(b => {
      if (seenCeeFactorIds.has(b.factor_id)) return false
      seenCeeFactorIds.add(b.factor_id)

      // Tolerate unreachable external factors (category === 'external')
      const factorNode = nodeById.get(b.factor_id)
      const category = (factorNode?.data as { category?: string } | undefined)?.category
      if (category === 'external') return false

      return true
    })

    // Partition CEE blockers into blocking vs informational
    const blockingCeeBlockers = dedupedCeeBlockers.filter(b => !NON_BLOCKING_CEE_TYPES.has(b.blocker_type ?? ''))
    const informationalCeeBlockers = dedupedCeeBlockers.filter(b => NON_BLOCKING_CEE_TYPES.has(b.blocker_type ?? ''))

    const ceeFactorIds = new Set(blockingCeeBlockers.map(b => b.factor_id))

    // Remove graph-derived blockers that overlap with CEE blockers (check ALL affectedIds entries)
    for (let i = allBlockers.length - 1; i >= 0; i--) {
      const existing = allBlockers[i]
      if (existing.affectedIds?.some(id => ceeFactorIds.has(id))) {
        allBlockers.splice(i, 1)
      }
    }

    // Add blocking CEE blockers
    for (const ceeBlocker of blockingCeeBlockers) {
      allBlockers.push({
        code: 'CEE_BLOCKER',
        message: ceeBlocker.reason,
        affectedIds: [ceeBlocker.factor_id],
        action: { type: 'retry_draft', label: ceeBlocker.factor_label ?? ceeBlocker.factor_id },
      })
    }

    // Add informational CEE blockers (shown but don't block run)
    for (const ceeBlocker of informationalCeeBlockers) {
      allInformationalBlockers.push({
        code: 'CONSTRAINT_DROPPED',
        message: ceeBlocker.reason,
        affectedIds: [ceeBlocker.factor_id],
        action: { type: 'info', label: ceeBlocker.factor_label ?? ceeBlocker.factor_id },
      })
    }
  }

  return {
    canRun: allBlockers.length === 0,
    blockers: allBlockers,
    informationalBlockers: allInformationalBlockers,
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
    .map((e) => getEdgeKey(e))
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
 * Uses individual field selectors and fingerprinting to prevent unnecessary re-renders.
 */
export function usePreRunValidation(): ValidationResult {
  const outcomeNodeId = useCanvasStore((s) => s.outcomeNodeId)
  // Individual field selectors (React #185 guard): the store only replaces the
  // nodes/edges array when a node/edge object actually changes (applyNodeChanges/
  // applyEdgeChanges), so the reference is stable between real changes and the
  // default Object.is equality is sufficient — no useShallow needed.
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
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
        verboseWarn('[PreRunValidation] Validation result changed:', {
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
          console.warn(`[Validation] Applying recommended fix: ${fix.reason}`)
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
