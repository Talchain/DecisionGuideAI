/**
 * humaniseCritique — converts raw PLoT critique messages into user-safe copy.
 *
 * PLoT critiques can contain internal field names like `constraint_fac_customer_churn_max`,
 * `observed_state.value`, `intercept=0`. This utility maps known critique codes to
 * human-readable templates and provides a safe fallback for unknown codes that NEVER
 * exposes the raw message to users.
 *
 * Factor label resolution chain:
 * 1. nodeId from affectedNodes → look up in nodeLabels map → use node.label
 * 2. Extract node ID from message if encoded (e.g. `fac_xxx`)
 * 3. Fallback: "a key factor"
 */

import type { UncertaintyItem } from '../types'

// ─── Public types ────────────────────────────────────────────────────────────

export interface HumanisedCritique {
  title: string
  description: string
  suggestion?: string
  /** Resolved factor/node ID for GraphLink CTA */
  factorId?: string
}

// ─── Code → template map ─────────────────────────────────────────────────────

type TemplateFactory = (factorLabel: string) => Omit<HumanisedCritique, 'factorId'>

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
}

// ─── Label resolution ────────────────────────────────────────────────────────

const FALLBACK_LABEL = 'a key factor'

/**
 * Resolve a human-readable factor label from the critique.
 *
 * Resolution chain:
 * 1. affectedNodes[0] → nodeLabels map
 * 2. Extract node ID pattern from raw message (fac_xxx, constraint_fac_xxx)
 * 3. Fallback: "a key factor"
 */
function resolveFactorLabel(
  item: UncertaintyItem,
  nodeLabels?: Map<string, string>,
): { label: string; factorId?: string } {
  // 1. Try affectedNodes[0]
  const nodeId = item.affectedNodes?.[0]
  if (nodeId && nodeLabels?.has(nodeId)) {
    return { label: nodeLabels.get(nodeId)!, factorId: nodeId }
  }
  if (nodeId) {
    return { label: FALLBACK_LABEL, factorId: nodeId }
  }

  // 2. Try extracting node ID from message
  const idMatch = item.message?.match(/(?:constraint_)?(fac_[a-z0-9_]+)/i)
  if (idMatch) {
    const extractedId = idMatch[1]
    if (nodeLabels?.has(extractedId)) {
      return { label: nodeLabels.get(extractedId)!, factorId: extractedId }
    }
    // Also try the full match (with constraint_ prefix)
    const fullId = idMatch[0]
    if (nodeLabels?.has(fullId)) {
      return { label: nodeLabels.get(fullId)!, factorId: fullId }
    }
    return { label: FALLBACK_LABEL, factorId: extractedId }
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
    return { ...result, factorId }
  }

  // Safe fallback — NEVER expose raw message
  if (import.meta.env.DEV) {
    console.warn('[humaniseCritique] Unmapped critique code:', item.code, '| Raw message:', item.message)
  }

  return {
    title: 'Review this factor\'s inputs',
    description: 'Some information needed to assess this factor isn\'t available yet.',
    suggestion: 'Check and update this factor',
    factorId,
  }
}
