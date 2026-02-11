/**
 * blockerEnrichment — Local display metadata for validation blockers.
 *
 * Maps blocker codes from usePreRunValidation → human-readable titles,
 * descriptions, severity, and retry eligibility.
 *
 * ⚠️  READ-ONLY GUARDRAIL: This file enriches blockers for the UI.
 *     It must NEVER mutate ValidationBlocker objects or store state.
 *     It must NEVER import or call usePreRunValidation, DraftChat, or store setters.
 */

import type { ValidationBlocker } from '@talchain/schemas'

// ── Types ────────────────────────────────────────────────────────

export type BlockerSeverity = 'critical' | 'warning'

export interface BlockerDisplayMeta {
  title: string
  description: string
  severity: BlockerSeverity
  /** Whether the blocker can be resolved by retrying the CEE draft */
  supportsRetry: boolean
}

export interface EnrichedBlocker {
  /** Original blocker from validation */
  blocker: ValidationBlocker
  /** Display metadata */
  display: BlockerDisplayMeta
  /** Sort order (lower = higher priority) */
  sortOrder: number
}

// ── Display metadata by blocker code ─────────────────────────────

const BLOCKER_DISPLAY: Record<string, BlockerDisplayMeta> = {
  // Structural fatal
  MISSING_GOAL_NODE: {
    title: 'No goal selected',
    description: 'Select a goal node to define what you want to achieve.',
    severity: 'critical',
    supportsRetry: false,
  },
  GOAL_NODE_NOT_FOUND: {
    title: 'Goal node deleted',
    description: 'The selected goal node no longer exists. Select a new goal.',
    severity: 'critical',
    supportsRetry: false,
  },
  GOAL_NODE_KIND_MISMATCH: {
    title: 'Selected node is not a goal',
    description: 'The selected node needs to be marked as a goal type.',
    severity: 'critical',
    supportsRetry: false,
  },
  NO_OPTIONS: {
    title: 'No options to compare',
    description: 'Add at least two options for the analysis to compare.',
    severity: 'critical',
    supportsRetry: false,
  },

  // Draft failure / missing mapping
  ANALYSIS_NOT_READY: {
    title: 'Analysis not ready',
    description: 'The AI draft needs adjustments before analysis can run. Try re-drafting.',
    severity: 'warning',
    supportsRetry: true,
  },
  OPTIONS_NEED_MAPPING: {
    title: 'Options missing interventions',
    description: 'Some options need intervention values configured before analysis.',
    severity: 'warning',
    supportsRetry: true,
  },
  EMPTY_INTERVENTIONS: {
    title: 'Empty interventions',
    description: 'One or more options have no interventions defined. Re-draft to resolve.',
    severity: 'warning',
    supportsRetry: true,
  },
  INTERVENTION_TARGETS_OPTION: {
    title: 'Invalid intervention target',
    description: 'An option targets another option node, which is not allowed.',
    severity: 'critical',
    supportsRetry: false,
  },
  CATEGORY_MISSING: {
    title: 'Missing factor categories',
    description: 'Some factors are missing their category. Re-draft to resolve.',
    severity: 'warning',
    supportsRetry: true,
  },
}

/** Fallback for unknown blocker codes */
const UNKNOWN_BLOCKER: BlockerDisplayMeta = {
  title: 'Validation issue',
  description: 'An issue is preventing analysis from running.',
  severity: 'warning',
  supportsRetry: false,
}

// ── Sort order (lower = higher priority in the list) ─────────────

const BLOCKER_SORT_ORDER: Record<string, number> = {
  // Structural fatal (show first)
  MISSING_GOAL_NODE: 10,
  GOAL_NODE_NOT_FOUND: 11,
  GOAL_NODE_KIND_MISMATCH: 12,
  NO_OPTIONS: 13,
  INTERVENTION_TARGETS_OPTION: 14,
  // Draft failure (show second)
  ANALYSIS_NOT_READY: 20,
  OPTIONS_NEED_MAPPING: 21,
  EMPTY_INTERVENTIONS: 22,
  CATEGORY_MISSING: 23,
}

const DEFAULT_SORT_ORDER = 50

// ── Public API ───────────────────────────────────────────────────

/**
 * Enrich a ValidationBlocker with display metadata.
 * Pure function — no side effects or store access.
 */
export function enrichBlocker(blocker: ValidationBlocker): EnrichedBlocker {
  const display = BLOCKER_DISPLAY[blocker.code] ?? {
    ...UNKNOWN_BLOCKER,
    // Use the original message as description for unknown codes
    description: blocker.message || UNKNOWN_BLOCKER.description,
  }

  return {
    blocker,
    display,
    sortOrder: BLOCKER_SORT_ORDER[blocker.code] ?? DEFAULT_SORT_ORDER,
  }
}

/**
 * Enrich and sort a list of blockers.
 * Returns enriched blockers in deterministic priority order.
 */
export function enrichAndSortBlockers(blockers: ValidationBlocker[]): EnrichedBlocker[] {
  return blockers
    .map(enrichBlocker)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}
