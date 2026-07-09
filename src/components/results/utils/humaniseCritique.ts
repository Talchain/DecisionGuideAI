/**
 * humaniseCritique — converts raw PLoT critique messages into user-safe copy.
 *
 * PLoT critiques can contain internal field names like `constraint_fac_customer_churn_max`,
 * `observed_state.value`, `intercept=0`. This utility maps known critique codes to
 * human-readable templates and provides a safe fallback for unknown codes that NEVER
 * exposes the raw message to users.
 *
 * Global rule: labels resolve via nodeId → graph store lookup ONLY.
 * Never parsed from critique message strings.
 *
 * Factor label resolution chain:
 * 1. nodeId from affectedNodes → look up in nodeLabels map → use node.label
 * 2. affectedNodes present but not in map → "This factor" + factorId
 * 3. No affectedNodes → "This factor", no factorId
 */

import type { UncertaintyItem } from '../types'

// ─── Public types ────────────────────────────────────────────────────────────

export interface HumanisedCritique {
  title: string
  description: string
  /** V14.3: Canonical user-safe text for banner display. null = exclude from banner. */
  displayText: string | null
  suggestion?: string
  /** Resolved factor/node ID for GraphLink CTA */
  factorId?: string
}

// ─── Code → template map ─────────────────────────────────────────────────────

type TemplateFactory = (factorLabel: string) => Omit<HumanisedCritique, 'factorId' | 'displayText'>

const CODE_TEMPLATES: Record<string, TemplateFactory> = {
  MISSING_OBSERVED_STATE: (label) => ({
    title: `${label} is missing a current value`,
    description: 'A default was assumed, so results involving this factor may be less reliable.',
    suggestion: `Add your current estimate for ${label}`,
  }),
  CONSTRAINT_MISSING_VALUE: (label) => ({
    title: `${label} target can't be fully evaluated`,
    description: 'This factor is missing data needed to assess your success target accurately.',
    suggestion: `Set a value for ${label}`,
  }),
  LOW_EVIDENCE: () => ({
    title: 'Limited evidence available',
    description: 'Some factors have low evidence coverage, which may affect reliability.',
    suggestion: 'Add data or expert estimates for factors with low confidence',
  }),
  NO_RISK_NODES: () => ({
    title: 'No risk factors connected',
    description: 'The model doesn\'t include any risk nodes. Consider whether risks could affect the outcome.',
    suggestion: 'Add risk factors that could influence your decision',
  }),
  ORPHAN_NODES: () => ({
    title: 'Some factors aren\'t connected',
    description: 'Parts of your model aren\'t linked to the main decision and won\'t affect the analysis.',
    suggestion: 'Connect or remove disconnected factors',
  }),
  DECISION_AFTER_OUTCOME: () => ({
    title: 'Model structure needs review',
    description: 'Some connections may not follow the expected cause-and-effect flow.',
    suggestion: 'Check that factors flow into outcomes, not the other way around',
  }),
  ASSUMPTIONS_USED: () => ({
    title: 'Default assumptions applied',
    description: 'Some values were assumed because data wasn\'t provided. Results may be less reliable for these areas.',
    suggestion: 'Review and update assumed values where you have better information',
  }),
  EMPTY_COMPUTED_RESULTS: () => ({
    title: 'Analysis returned limited results',
    description: 'The computation completed but produced fewer results than expected.',
    suggestion: 'Check your model structure and try running the analysis again',
  }),
  GRAPH_SIZE_INFO: () => ({
    title: 'Large model',
    description: 'Your model has many nodes. Analysis may take longer and results could be less precise.',
  }),
  EVIDENCE_SUGGESTION: () => ({
    title: 'Consider adding more evidence',
    description: 'Adding data or references to key factors would strengthen the analysis.',
    suggestion: 'Gather data for your highest-impact factors',
  }),
  CONSTRAINT_TARGET_NO_OBSERVED_VALUE: (label) => ({
    title: `${label} has no estimate set`,
    description: 'Results may be unreliable without a current value for this constraint.',
    suggestion: 'Set estimate',
  }),
  CONSTRAINT_MISSING_RANGE: (label) => ({
    title: `${label} is missing a range for its constraint`,
    description: 'A range is needed to assess whether this target can be met.',
    suggestion: 'Set range',
  }),
  CONSTRAINT_FILTERED_TEMPORAL: () => ({
    title: 'Some time-based constraints were excluded',
    description: 'Temporal constraints outside the analysis window were filtered from results.',
    // No suggestion — not actionable by the user
  }),
  CONSTRAINT_OUT_OF_DOMAIN: (label) => ({
    title: `${label} constraint value is outside the expected range`,
    description: 'The target for this constraint falls outside the range the model can assess.',
    suggestion: 'Review',
  }),
  CONSTRAINT_NO_DERIVABLE_RANGE: (label) => ({
    title: `${label} has no estimate set`,
    description: 'Constraint results may be less precise. Set a value to sharpen the analysis.',
    suggestion: 'Set estimate',
  }),
  INBOUND_STRENGTH_SUM_EXCEEDED: (label) => ({
    title: `The factors driving ${label} may be over-weighted`,
    description: 'The combined strength of connections into this node exceeds the expected range. Consider reducing some edge strengths.',
    suggestion: 'Review connection strengths',
  }),
  MIXED_RANGE_DERIVATION: () => ({
    title: 'Some factor ranges use estimates rather than confirmed values',
    description: 'Not all factor ranges are derived from the same source. Results may be less consistent.',
    suggestion: 'Review factor data sources',
  }),
  // ROADMAP 1.12 — warning surfacing. Producer WARNING-severity code (PLoT
  // constraint-reliability.ts): a goal constraint's target could not be
  // scaled/evaluated reliably (default-range threshold and/or a defaulted
  // base), so PLoT withholds goal-fit probabilities for the run rather than
  // emit a meaningless number. Doctrine rule 6 (defaulted-value disclosure):
  // names the concrete, actionable fix — set a value/range — never quotes
  // the withheld number itself.
  CONSTRAINT_TARGET_UNRELIABLE: (label) => ({
    title: `${label}'s success target can't be evaluated reliably`,
    description: 'The value needed to assess this target is missing or unscaled, so goal-fit results were withheld for this run rather than shown as a meaningless number.',
    suggestion: `Set a value or range for ${label}`,
  }),
}

// ─── Internal token detection ────────────────────────────────────────────────

/** V14.3: Consolidated internal-token regex. If resolved text trips this, displayText = null. */
const INTERNAL_TOKEN_REGEX = /constraint_[a-z_]+|observed_state\.|intercept\s*=|fac_[a-z_]+|blocks_analysis|node_id\s*=|edge_id\s*=|opt_[a-z_]+|goal_[a-z_]+|compared as-is by ISL|no derivable range/i

// ─── Label resolution ────────────────────────────────────────────────────────

const FALLBACK_LABEL = 'This factor'

/**
 * V12.2: Generate human-readable label from raw factor ID.
 * Strips fac_ prefix, replaces underscores with spaces, title cases each word.
 */
function factorIdToLabel(factorId: string): string {
  let label = factorId.replace(/^fac_/, '').replace(/_/g, ' ')
  label = label.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  return label
}

/**
 * Resolve a human-readable factor label from the critique.
 *
 * Resolution chain (global rule: nodeId → graph store only, never parse messages):
 * 1. affectedNodes[0] → nodeLabels map → use label
 * 2. affectedNodes[0] exists but not in map → derive label from ID (V12.2)
 * 3. No affectedNodes → "This factor", no factorId
 */
function resolveFactorLabel(
  item: UncertaintyItem,
  nodeLabels?: Map<string, string>,
): { label: string; factorId?: string } {
  const nodeId = item.affectedNodes?.[0]
  if (nodeId && nodeLabels?.has(nodeId)) {
    return { label: nodeLabels.get(nodeId)!, factorId: nodeId }
  }
  if (nodeId) {
    // V12.2: Derive label from ID instead of generic fallback
    return { label: factorIdToLabel(nodeId), factorId: nodeId }
  }

  return { label: FALLBACK_LABEL }
}

// ─── Main function ───────────────────────────────────────────────────────────

/**
 * Convert a raw PLoT critique into user-safe copy.
 *
 * @param item — UncertaintyItem from useResultsSectionData
 * @param nodeLabels — Map of nodeId → display label (from graph nodes)
 * @returns Humanised title, description, suggestion, and optional factorId
 */
export function humaniseCritique(
  item: UncertaintyItem,
  nodeLabels?: Map<string, string>,
): HumanisedCritique {
  const { label: factorLabel, factorId } = resolveFactorLabel(item, nodeLabels)

  // Try mapped template
  const template = CODE_TEMPLATES[item.code]
  if (template) {
    const result = template(factorLabel)
    const displayText = INTERNAL_TOKEN_REGEX.test(result.title) ? null : result.title
    return { ...result, displayText, factorId }
  }

  // V16.2: Message-based detection for known ISL patterns sent as GENERAL code
  if (/no derivable range/i.test(item.message)) {
    const result = CODE_TEMPLATES.CONSTRAINT_NO_DERIVABLE_RANGE(factorLabel)
    const displayText = INTERNAL_TOKEN_REGEX.test(result.title) ? null : result.title
    return { ...result, displayText, factorId }
  }

  // Safe fallback — NEVER expose raw message
  if (import.meta.env.DEV) {
    console.warn('[humaniseCritique] Unmapped critique code:', item.code, '| Raw message:', item.message)
  }

  // V14.2→V14.3b: Prefer user_message from PLoT (humanised by the engine) over generic fallback.
  // No auto-generated suggestion — only template-matched codes get actionable CTAs.
  // Items without suggestion are excluded from the banner but shown in ConfidenceSection.
  // V14.3b: If userMessage contains internal tokens, fall through to generic fallback —
  // never use contaminated text as title (which renders in ConfidenceSection Group 2).
  if (item.userMessage && !INTERNAL_TOKEN_REGEX.test(item.userMessage)) {
    return {
      title: item.userMessage,
      description: 'Review this factor to improve result accuracy.',
      displayText: item.userMessage,
      factorId,
    }
  }

  // No user_message and no template match → generic fallback.
  // displayText: null → excluded from banner. Title/description still render
  // inside ConfidenceSection rows for unmapped codes.
  return {
    title: 'Review this factor\'s inputs',
    description: 'Some information needed to assess this factor isn\'t available yet.',
    displayText: null,
    factorId,
  }
}
