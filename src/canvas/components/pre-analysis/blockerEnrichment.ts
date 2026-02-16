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

export type BlockerSeverity = 'critical' | 'warning' | 'info'

export interface BlockerDisplayMeta {
  title: string
  description: string
  severity: BlockerSeverity
  /** Whether the blocker can be resolved by retrying the CEE draft */
  supportsRetry: boolean
  /** Actionable suggestions shown to the user */
  suggestedActions: string[]
}

export interface BlockerGuidance {
  title: string
  description: string
  suggestedActions: string[]
}

export interface EnrichedBlocker {
  /** Original blocker from validation */
  blocker: ValidationBlocker
  /** Display metadata */
  display: BlockerDisplayMeta
  /** Sort order (lower = higher priority) */
  sortOrder: number
}

// ── ID display hygiene ───────────────────────────────────────────

const ID_PREFIXES = ['constraint_fac_', 'constraint_', 'fac_', 'out_', 'risk_', 'opt_', 'dec_', 'goal_']

/** Check whether a string looks like a raw node ID rather than a human-readable label. */
export function looksLikeId(s: string): boolean {
  // Known ID prefixes are always IDs regardless of casing
  if (/^(fac|constraint|out|risk|opt|dec|goal)_/.test(s)) return true
  // Underscore-delimited, no spaces, all lowercase → likely machine-generated ID
  // Mixed-case labels like "Net_Profit" or "GDP_Growth" are left alone
  return s.includes('_') && !s.includes(' ') && s === s.toLowerCase()
}

/** Convert a raw node ID into a human-readable title-cased label. */
export function prettifyId(id: string): string {
  let label = id
  for (const prefix of ID_PREFIXES) {
    if (label.startsWith(prefix)) {
      label = label.slice(prefix.length)
      break
    }
  }
  return label
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

// ── Display metadata by blocker code ─────────────────────────────

const BLOCKER_DISPLAY: Record<string, BlockerDisplayMeta> = {
  // Structural fatal
  MISSING_GOAL_NODE: {
    title: 'No goal selected',
    description: 'Select a goal node to define what you want to achieve.',
    severity: 'critical',
    supportsRetry: false,
    suggestedActions: ['Select a goal node'],
  },
  GOAL_NODE_NOT_FOUND: {
    title: 'Goal node deleted',
    description: 'The selected goal node no longer exists. Select a new goal.',
    severity: 'critical',
    supportsRetry: false,
    suggestedActions: ['Select a new goal node'],
  },
  GOAL_NODE_KIND_MISMATCH: {
    title: 'Selected node is not a goal',
    description: 'The selected node needs to be marked as a goal type.',
    severity: 'critical',
    supportsRetry: false,
    suggestedActions: ['Change node type to goal'],
  },
  NO_OPTIONS: {
    title: 'No options to compare',
    description: 'Add at least two options for the analysis to compare.',
    severity: 'critical',
    supportsRetry: false,
    suggestedActions: ['Add at least two options'],
  },

  // Draft failure / missing mapping
  ANALYSIS_NOT_READY: {
    title: 'Analysis not ready',
    description: 'The AI draft needs adjustments before analysis can run. Try re-drafting.',
    severity: 'warning',
    supportsRetry: true,
    suggestedActions: ['Retry draft', 'Edit brief'],
  },
  ANALYSIS_READY_INVALID: {
    title: 'Invalid analysis response',
    description: 'Analysis response is missing option data. Please re-draft.',
    severity: 'warning',
    supportsRetry: true,
    suggestedActions: ['Retry draft'],
  },
  OPTIONS_NEED_MAPPING: {
    title: 'Options need configuration',
    description: "Some options don't have clear effects on the model's factors.",
    severity: 'warning',
    supportsRetry: true,
    suggestedActions: ['Map option effects to factors'],
  },
  EMPTY_INTERVENTIONS: {
    title: 'Option has no effects',
    description: "This option doesn't change any factors in the model.",
    severity: 'warning',
    supportsRetry: true,
    suggestedActions: ['Add effects', 'Remove option'],
  },
  INTERVENTION_TARGETS_OPTION: {
    title: 'Invalid intervention target',
    description: 'An option targets another option node, which is not allowed.',
    severity: 'critical',
    supportsRetry: false,
    suggestedActions: ['Fix intervention target'],
  },
  CATEGORY_MISSING: {
    title: 'Missing factor categories',
    description: 'Some factors are missing their category. Re-draft to resolve.',
    severity: 'warning',
    supportsRetry: true,
    suggestedActions: ['Retry draft'],
  },

  // CEE-provided blockers
  CEE_BLOCKER: {
    title: 'Factor not connected',
    description: 'This factor influences outcomes but no option directly affects it.',
    severity: 'warning',
    supportsRetry: true,
    suggestedActions: ['Connect it to an option', 'Remove if not relevant'],
  },

  // Informational (non-blocking) — constraint_dropped
  CONSTRAINT_DROPPED: {
    title: 'Constraint not applied',
    description: "The system couldn't match this constraint to a factor in your model. The analysis will run without it.",
    severity: 'info',
    supportsRetry: false,
    suggestedActions: [],
  },
}

/** Fallback for unknown blocker codes */
const UNKNOWN_BLOCKER: BlockerDisplayMeta = {
  title: 'Validation issue',
  description: 'An issue is preventing analysis from running.',
  severity: 'warning',
  supportsRetry: false,
  suggestedActions: [],
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
  ANALYSIS_READY_INVALID: 21,
  OPTIONS_NEED_MAPPING: 22,
  EMPTY_INTERVENTIONS: 23,
  CATEGORY_MISSING: 24,
  // CEE blockers (show third)
  CEE_BLOCKER: 30,
  // Informational (show last — non-blocking)
  CONSTRAINT_DROPPED: 40,
}

const DEFAULT_SORT_ORDER = 50

// ── Public API ───────────────────────────────────────────────────

/**
 * Enrich a ValidationBlocker with display metadata.
 * Pure function — no side effects or store access.
 */
export function enrichBlocker(blocker: ValidationBlocker): EnrichedBlocker {
  let display = BLOCKER_DISPLAY[blocker.code] ?? {
    ...UNKNOWN_BLOCKER,
    // Use the original message as description for unknown codes
    description: blocker.message || UNKNOWN_BLOCKER.description,
  }

  // CEE_BLOCKER: use factor label from action.label for contextual title
  // Prettify if the label looks like a raw ID (e.g., "fac_keeping_monthly_churn")
  if (blocker.code === 'CEE_BLOCKER' && blocker.action?.label) {
    const rawLabel = blocker.action.label
    const displayLabel = looksLikeId(rawLabel) ? prettifyId(rawLabel) : rawLabel
    display = {
      ...display,
      title: `"${displayLabel}" is not connected`,
    }
  }

  // CONSTRAINT_DROPPED: use constraint label for contextual title
  if (blocker.code === 'CONSTRAINT_DROPPED' && blocker.action?.label) {
    const rawLabel = blocker.action.label
    const displayLabel = looksLikeId(rawLabel) ? prettifyId(rawLabel) : rawLabel
    display = {
      ...display,
      title: `Constraint not applied: "${displayLabel}"`,
    }
  }

  // ANALYSIS_NOT_READY: pass through status-specific message from validation
  // (e.g., "Some options have categorical values that need encoding")
  if (blocker.code === 'ANALYSIS_NOT_READY' && blocker.message) {
    display = {
      ...display,
      description: blocker.message,
    }
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

/**
 * Hydrate blocker titles with real node labels from the graph.
 * For CEE_BLOCKER and CONSTRAINT_DROPPED items, replaces prettified-ID
 * titles with actual node labels when a matching node is found.
 */
export function hydrateBlockerLabels(
  blockers: EnrichedBlocker[],
  nodesById: Map<string, { label?: string }>
): EnrichedBlocker[] {
  const HYDRATE_CODES = new Set(['CEE_BLOCKER', 'CONSTRAINT_DROPPED'])
  return blockers.map(enriched => {
    if (!HYDRATE_CODES.has(enriched.blocker.code)) return enriched

    const factorId = enriched.blocker.affectedIds?.[0]
    if (!factorId) return enriched

    const node = nodesById.get(factorId)
    const nodeLabel = node?.label
    if (!nodeLabel || looksLikeId(nodeLabel)) return enriched

    const title = enriched.blocker.code === 'CONSTRAINT_DROPPED'
      ? `Constraint not applied: "${nodeLabel}"`
      : `"${nodeLabel}" is not connected`

    return {
      ...enriched,
      display: {
        ...enriched.display,
        title,
      },
    }
  })
}

/**
 * Deduplicate enriched blockers by node identity.
 * First occurrence wins (preserves richer CEE metadata).
 * Non-node blockers (no affectedIds) are always kept.
 */
export function deduplicateBlockers(blockers: EnrichedBlocker[]): EnrichedBlocker[] {
  const seen = new Set<string>()
  return blockers.filter(b => {
    const key = b.blocker.affectedIds?.[0] ?? `${b.blocker.code}:${b.blocker.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ── Contextual guidance lookup ───────────────────────────────────

/** Guidance entries keyed by blocker/status code with optional label interpolation */
const GUIDANCE_MAP: Record<string, {
  title: (ctx?: { nodeLabel?: string; optionLabel?: string }) => string
  description: string
  suggestedActions: string[]
}> = {
  UNREACHABLE_FACTOR_RETAINED: {
    title: (ctx) => ctx?.nodeLabel ? `"${ctx.nodeLabel}" is not connected` : 'Factor is not connected',
    description: 'This factor influences outcomes but no option directly affects it.',
    suggestedActions: ['Connect it to an option', 'Remove if not relevant'],
  },
  STATUS_QUO_UNREACHABLE: {
    title: () => '"Do nothing" option incomplete',
    description: 'The status quo option needs connections to show what happens without action.',
    suggestedActions: ['Describe consequences of inaction', 'Remove status quo'],
  },
  needs_user_mapping: {
    title: () => 'Options need configuration',
    description: "Some options don't have clear effects on the model's factors.",
    suggestedActions: ['Map option effects to factors'],
  },
  needs_encoding: {
    title: () => 'Values need confirmation',
    description: 'Some option values need to be converted to numbers for analysis.',
    suggestedActions: ['Confirm numeric values'],
  },
  EMPTY_INTERVENTIONS: {
    title: (ctx) => ctx?.optionLabel ? `"${ctx.optionLabel}" has no effects` : 'Option has no effects',
    description: "This option doesn't change any factors in the model.",
    suggestedActions: ['Add effects', 'Remove option'],
  },
}

/**
 * Look up plain-language guidance for a blocker or status code.
 * Returns contextual title (with label interpolation), description, and suggested actions.
 *
 * This is a separate API from enrichBlocker — it handles codes that don't map 1:1
 * to ValidationBlocker.code values (e.g., raw CEE status codes like 'needs_user_mapping',
 * or future violation codes like 'UNREACHABLE_FACTOR_RETAINED'). The current rendering
 * path uses enrichBlocker → BLOCKER_DISPLAY for actual blockers; this function provides
 * guidance for arbitrary status/violation codes.
 */
export function getBlockerGuidance(
  code: string,
  context?: { nodeLabel?: string; optionLabel?: string }
): BlockerGuidance {
  const entry = GUIDANCE_MAP[code]
  if (entry) {
    return {
      title: entry.title(context),
      description: entry.description,
      suggestedActions: entry.suggestedActions,
    }
  }

  // Fall back to BLOCKER_DISPLAY if no specific guidance
  const display = BLOCKER_DISPLAY[code]
  if (display) {
    return {
      title: display.title,
      description: display.description,
      suggestedActions: display.suggestedActions,
    }
  }

  return {
    title: 'Validation issue',
    description: 'An issue is preventing analysis from running.',
    suggestedActions: [],
  }
}
